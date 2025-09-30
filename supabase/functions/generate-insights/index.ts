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
    console.log('Generating aggregate insights...');

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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('Failed to get user:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all analyses for the user
    const { data: analyses, error: analysisError } = await supabase
      .from('analysis_results')
      .select(`
        id,
        document_id,
        summary,
        keywords,
        extracted_data,
        analyzed_at,
        documents!inner(file_name, file_type, uploaded_at, uploaded_by)
      `)
      .eq('documents.uploaded_by', user.id)
      .order('analyzed_at', { ascending: true });

    if (analysisError) {
      console.error('Failed to fetch analyses:', analysisError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch analyses' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!analyses || analyses.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No analyses found. Please analyze some documents first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating insights from ${analyses.length} analyses`);

    // Prepare insights prompt
    const insightsPrompt = `Analysera ALLA följande ${analyses.length} dokument tillsammans och generera aggregerade insikter och trender.

ALLA ANALYSERADE DOKUMENT:
${analyses.map((a: any, idx: number) => `
DOKUMENT ${idx + 1}: ${a.documents.file_name}
Typ: ${a.documents.file_type}
Uppladdad: ${new Date(a.documents.uploaded_at).toLocaleDateString('sv-SE')}
Analyserad: ${new Date(a.analyzed_at).toLocaleDateString('sv-SE')}

Sammanfattning: ${a.summary}
Nyckelord: ${a.keywords?.join(', ') || 'Inga'}
Extraherad data: ${JSON.stringify(a.extracted_data, null, 2)}
`).join('\n---\n')}

Utför en aggregerad analys över ALLA dokument och returnera följande i JSON-format:

{
  "executive_summary": "En övergripande sammanfattning av alla dokument tillsammans (300-400 ord)",
  
  "recurring_themes": [
    {
      "theme": "temanamn",
      "frequency": antal gånger temat förekommer,
      "importance": "hög/medium/låg",
      "documents": ["dokument där temat förekommer"]
    }
  ],
  
  "trends": {
    "temporal_trends": [
      {
        "trend": "beskrivning av trend",
        "direction": "ökande/minskande/stabil",
        "evidence": "bevis från dokumenten"
      }
    ],
    "thematic_evolution": [
      {
        "theme": "temanamn",
        "evolution": "hur temat har utvecklats över tid",
        "significance": "varför detta är viktigt"
      }
    ],
    "value_trends": [
      {
        "metric": "mätetal eller värde",
        "trend": "utveckling av värdet",
        "context": "sammanhang och betydelse"
      }
    ]
  },
  
  "strengths": [
    {
      "strength": "identifierad styrka",
      "evidence": "bevis från dokumenten",
      "prevalence": "hur utbredd styrkan är"
    }
  ],
  
  "improvement_areas": [
    {
      "area": "förbättringsområde",
      "current_state": "nuläge",
      "gaps": "identifierade gap",
      "impact": "potentiell påverkan"
    }
  ],
  
  "anomalies": [
    {
      "anomaly": "avvikelse eller ovanlig observation",
      "location": "var detta förekom",
      "significance": "varför detta är intressant"
    }
  ],
  
  "cross_document_patterns": [
    {
      "pattern": "identifierat mönster",
      "documents_involved": ["berörda dokument"],
      "insight": "vad detta säger oss"
    }
  ],
  
  "recommendations": [
    {
      "recommendation": "rekommendation",
      "rationale": "motivering",
      "priority": "hög/medium/låg",
      "actionable_steps": ["konkreta steg"]
    }
  ],
  
  "key_insights": [
    "Nyckelinsikt 1: viktig upptäckt",
    "Nyckelinsikt 2: annan viktig observation"
  ],
  
  "data_quality_notes": "Kommentarer om datakvalitet och eventuella begränsningar i analysen"
}`;

    console.log('Sending insights request to Lovable AI...');

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
            content: 'Du är en senior strategisk analytiker med expertis i att identifiera mönster, trender och strategiska insikter från stora mängder dokument. Din analys ska vara djup, nyanserad och ge verkligt värde för beslutsfattande. Svara alltid i JSON-format.'
          },
          {
            role: 'user',
            content: insightsPrompt
          }
        ],
        temperature: 0.4,
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
        JSON.stringify({ error: 'AI insights generation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    console.log('AI insights response received');

    let insightsResult;
    try {
      const contentText = aiData.choices[0].message.content;
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        insightsResult = JSON.parse(jsonMatch[0]);
      } else {
        insightsResult = JSON.parse(contentText);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      insightsResult = {
        executive_summary: aiData.choices[0].message.content,
        error: 'Failed to parse structured insights'
      };
    }

    console.log('Saving insights to database...');

    // Extract recommendations as array
    const recommendations = insightsResult.recommendations?.map((r: any) => 
      typeof r === 'string' ? r : r.recommendation
    ) || [];

    // Save insights to database
    const { data: savedInsights, error: saveError } = await supabase
      .from('aggregate_insights')
      .insert({
        user_id: user.id,
        insights: insightsResult,
        trend_data: insightsResult.trends || {},
        recommendations: recommendations,
        analyzed_document_count: analyses.length,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save insights:', saveError);
      return new Response(
        JSON.stringify({ error: 'Failed to save insights' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Insights generation complete:', savedInsights.id);

    return new Response(
      JSON.stringify({
        success: true,
        insights: savedInsights
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-insights function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
