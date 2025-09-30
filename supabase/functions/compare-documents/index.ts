import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentIds } = await req.json();
    console.log('Comparing documents:', documentIds);

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length < 2) {
      return new Response(
        JSON.stringify({ error: 'At least 2 document IDs are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth user ID from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check which documents are already analyzed
    const { data: existingAnalyses } = await supabase
      .from('analysis_results')
      .select('document_id')
      .in('document_id', documentIds);
    
    const analyzedDocIds = new Set(existingAnalyses?.map((a: any) => a.document_id) || []);
    const unanalyzedDocIds = documentIds.filter((id: string) => !analyzedDocIds.has(id));

    // Analyze unanalyzed documents first
    if (unanalyzedDocIds.length > 0) {
      console.log(`Analyzing ${unanalyzedDocIds.length} unanalyzed documents first...`);
      
      for (const docId of unanalyzedDocIds) {
        try {
          const analyzeResponse = await supabase.functions.invoke('analyze-document', {
            body: { documentId: docId },
          });
          
          if (analyzeResponse.error) {
            console.error(`Failed to analyze document ${docId}:`, analyzeResponse.error);
            return new Response(
              JSON.stringify({ error: `Failed to analyze document ${docId}` }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          console.log(`Document ${docId} analyzed successfully`);
        } catch (analyzeError) {
          console.error(`Error analyzing document ${docId}:`, analyzeError);
          return new Response(
            JSON.stringify({ error: `Error analyzing document ${docId}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Fetch analyses for all documents
    const { data: analyses, error: analysisError } = await supabase
      .from('analysis_results')
      .select(`
        id,
        document_id,
        summary,
        keywords,
        extracted_data,
        analyzed_at,
        documents!inner(file_name, file_type, uploaded_at)
      `)
      .in('document_id', documentIds);

    if (analysisError) {
      console.error('Failed to fetch analyses:', analysisError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch document analyses' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!analyses || analyses.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No analyses found for the specified documents' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${analyses.length} analyses to compare`);

    // Prepare comparison prompt
    const comparisonPrompt = `Jämför följande ${analyses.length} dokument och ge en djupgående komparativ analys.

DOKUMENT ATT JÄMFÖRA:
${analyses.map((a: any, idx: number) => `
DOKUMENT ${idx + 1}: ${a.documents.file_name}
Typ: ${a.documents.file_type}
Uppladdad: ${a.documents.uploaded_at}

Sammanfattning: ${a.summary}
Nyckelord: ${a.keywords?.join(', ') || 'Inga'}
Strukturerad data: ${JSON.stringify(a.extracted_data, null, 2)}
`).join('\n---\n')}

Utför en komparativ analys och returnera följande i JSON-format:

{
  "comparison_summary": "En övergripande sammanfattning av jämförelsen (200-300 ord)",
  
  "commonalities": {
    "shared_themes": ["teman som förekommer i flera/alla dokument"],
    "shared_keywords": ["nyckelord som är gemensamma"],
    "shared_actors": ["aktörer som nämns i flera dokument"],
    "consistent_priorities": ["prioriteringar som är konsekventa"]
  },
  
  "differences": {
    "unique_themes": [
      {"document": "dokumentnamn", "themes": ["unika teman"]}
    ],
    "diverging_priorities": ["områden där dokumenten har olika prioriteringar"],
    "conflicting_information": ["eventuella motsägelser mellan dokumenten"]
  },
  
  "similarity_matrix": [
    {
      "document_pair": "Dokument 1 vs Dokument 2",
      "similarity_score": 0.75,
      "similarity_reasoning": "förklaring av likheten"
    }
  ],
  
  "thematic_trends": {
    "emerging_themes": ["teman som verkar växa över tid (om tillämpligt)"],
    "declining_themes": ["teman som minskar i fokus"],
    "consistent_themes": ["teman som är stabila över dokumenten"]
  },
  
  "value_changes": {
    "economic_trends": ["förändringar i ekonomiska värden/KPIer över tid"],
    "goal_evolution": ["hur mål har förändrats eller utvecklats"],
    "risk_patterns": ["mönster i identifierade risker"]
  },
  
  "key_insights": [
    "Insikt 1: viktig upptäckt från jämförelsen",
    "Insikt 2: annan viktig observation"
  ],
  
  "recommendations": [
    "Rekommendation 1 baserad på jämförelsen",
    "Rekommendation 2 för framtida analyser"
  ]
}`;

    console.log('Sending comparison request to Lovable AI...');

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: 'Du är en expert på komparativ dokumentanalys. Analysera dokument djupt och identifiera meningsfulla mönster, likheter och skillnader. Svara alltid i JSON-format.'
          },
          {
            role: 'user',
            content: comparisonPrompt
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'AI comparison failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    console.log('AI comparison response received');

    let comparisonResult;
    try {
      const contentText = aiData.choices[0].message.content;
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        comparisonResult = JSON.parse(jsonMatch[0]);
      } else {
        comparisonResult = JSON.parse(contentText);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      comparisonResult = {
        comparison_summary: aiData.choices[0].message.content,
        error: 'Failed to parse structured comparison'
      };
    }

    console.log('Saving comparison result to database...');

    // Get user ID from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('Failed to get user:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save comparison result to database
    const { data: savedComparison, error: saveError } = await supabase
      .from('comparative_analysis')
      .insert({
        user_id: user.id,
        document_ids: documentIds,
        comparison_result: comparisonResult,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save comparison:', saveError);
      return new Response(
        JSON.stringify({ error: 'Failed to save comparison' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Comparison complete:', savedComparison.id);

    return new Response(
      JSON.stringify({
        success: true,
        comparison: savedComparison
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in compare-documents function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
