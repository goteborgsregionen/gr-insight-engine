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
    const { documentId } = await req.json();
    console.log('Analyzing document:', documentId);

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: 'documentId is required' }),
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

    // Fetch document metadata
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error('Document not found:', docError);
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching document from storage:', document.file_path);

    // Download document from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.file_path);

    if (downloadError || !fileData) {
      console.error('Failed to download document:', downloadError);
      return new Response(
        JSON.stringify({ error: 'Failed to download document' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read file content as text
    const fileContent = await fileData.text();
    console.log('File content length:', fileContent.length);

    // Enhanced prompt for deeper analysis
    const analysisPrompt = `Analysera detta GR-dokument med fokus på affärsinsikter och strategisk information.

Dokumenttyp: ${document.file_type}
Dokumentnamn: ${document.file_name}

Innehåll:
${fileContent.substring(0, 50000)}

Utför en djupanalys och extrahera följande strukturerade information i JSON-format:

{
  "summary": "En koncis sammanfattning av dokumentets huvudsakliga innehåll och syfte (max 300 ord)",
  
  "document_metadata": {
    "document_type": "typ av dokument (t.ex. årsredovisning, strategi, policy, rapport)",
    "time_period": "tidsperiod som dokumentet avser",
    "key_actors": ["huvudaktörer, organisationer eller personer som nämns"],
    "geographical_scope": ["geografiska områden som täcks"]
  },
  
  "themes": {
    "main_themes": ["3-5 huvudteman i dokumentet"],
    "priorities": ["identifierade prioriteringar"],
    "strengths": ["starka punkter eller styrkor som lyfts fram"],
    "challenges": ["utmaningar eller problem som identifieras"]
  },
  
  "business_intelligence": {
    "economic_kpis": [
      {"metric": "namn på nyckeltal", "value": "värde", "context": "sammanhang"}
    ],
    "goals": ["identifierade mål och målsättningar"],
    "risks": ["identifierade risker"],
    "opportunities": ["identifierade möjligheter"],
    "actions": ["konkreta åtgärder eller initiativ som nämns"],
    "deadlines": ["viktiga tidpunkter eller deadlines"]
  },
  
  "sentiment_analysis": {
    "overall_tone": "övergripande ton (t.ex. positiv, neutral, problematisk)",
    "confidence_level": "nivå av säkerhet/osäkerhet i texten",
    "focus": "problem-fokuserad eller lösnings-fokuserad"
  },
  
  "keywords": ["15-20 viktiga nyckelord och begrepp"],
  
  "extracted_data": {
    "dates": ["viktiga datum"],
    "amounts": ["ekonomiska belopp med kontext"],
    "people": ["personer som nämns"],
    "organizations": ["organisationer som nämns"],
    "locations": ["platser som nämns"]
  }
}`;

    console.log('Sending request to Lovable AI...');

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
            content: 'Du är en dokumentanalysassistent som extraherar strukturerad information från dokument. Svara alltid i JSON-format.'
          },
          {
            role: 'user',
            content: analysisPrompt
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
        JSON.stringify({ error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    let analysisResult;
    try {
      const contentText = aiData.choices[0].message.content;
      // Try to extract JSON from the response (sometimes AI wraps it in markdown)
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        analysisResult = JSON.parse(contentText);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback: create a basic analysis result
      analysisResult = {
        summary: aiData.choices[0].message.content,
        keywords: [],
        extracted_data: {}
      };
    }

    console.log('Saving analysis result to database...');

    // Save analysis result to database
    const { data: savedResult, error: saveError } = await supabase
      .from('analysis_results')
      .insert({
        document_id: documentId,
        summary: analysisResult.summary,
        keywords: analysisResult.keywords || [],
        extracted_data: analysisResult.extracted_data || {},
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save analysis:', saveError);
      return new Response(
        JSON.stringify({ error: 'Failed to save analysis' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analysis complete:', savedResult.id);

    return new Response(
      JSON.stringify({
        success: true,
        analysis: savedResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-document function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
