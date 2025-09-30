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
    const startTime = Date.now();

    // Update status to analyzing
    await supabase
      .from('documents')
      .update({ status: 'analyzing' })
      .eq('id', documentId);

    // Fetch document metadata
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error('Document not found:', docError);
      await supabase
        .from('documents')
        .update({ status: 'error' })
        .eq('id', documentId);
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
      await supabase
        .from('documents')
        .update({ status: 'error' })
        .eq('id', documentId);
      return new Response(
        JSON.stringify({ error: 'Failed to download document' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read file content - handle PDFs differently
    const isPDF = document.file_type === 'application/pdf';
    const fileBuffer = await fileData.arrayBuffer();
    
    // Calculate hash from buffer
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Convert to base64 for PDFs, text for others
    let fileContent = '';
    let base64Data = '';
    
    if (isPDF) {
      base64Data = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
      console.log('PDF detected, using base64 encoding. Size:', fileBuffer.byteLength, 'Hash:', contentHash);
    } else {
      const decoder = new TextDecoder();
      fileContent = decoder.decode(fileBuffer);
      console.log('Text file detected. Content length:', fileContent.length, 'Hash:', contentHash);
    }

    // Check if we already have a valid analysis for this content
    const { data: existingAnalysis } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('document_id', documentId)
      .eq('is_valid', true)
      .maybeSingle();

    if (existingAnalysis && document.content_hash === contentHash) {
      console.log('Using cached analysis');
      await supabase
        .from('documents')
        .update({ status: 'analyzed' })
        .eq('id', documentId);
      return new Response(
        JSON.stringify({
          success: true,
          analysis: existingAnalysis,
          cached: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Invalidate old analyses if content changed
    if (document.content_hash && document.content_hash !== contentHash) {
      await supabase
        .from('analysis_results')
        .update({ is_valid: false })
        .eq('document_id', documentId);
    }

    // Update content hash
    await supabase
      .from('documents')
      .update({ content_hash: contentHash })
      .eq('id', documentId);

    // Enhanced prompt - different for PDFs vs text files
    const analysisPrompt = isPDF 
      ? `Analysera detta PDF-dokument grundligt och noggrant.

Dokumenttyp: ${document.file_type}
Dokumentnamn: ${document.file_name}

VIKTIGT - För PDF-dokument, fokusera på:
- Tabeller och strukturerad data (bevara format och värden exakt)
- Numeriska värden och KPI:er
- Hierarkisk information och rubriker
- Diagram och figurer (beskriv innehåll)
- Listor och punkter
- Dokumentets övergripande struktur

Returnera strukturerad JSON:

{
  "summary": "Detaljerad sammanfattning som inkluderar all viktig data från tabeller och diagram (max 300 ord)",
  "document_metadata": {
    "document_type": "typ av dokument",
    "has_tables": true/false,
    "has_images": true/false,
    "time_period": "tidsperiod",
    "key_actors": ["aktörer"],
    "geographical_scope": ["områden"],
    "key_sections": ["viktiga sektioner"]
  },
  "extracted_tables": [
    {
      "table_name": "beskrivande namn",
      "headers": ["kolumn1", "kolumn2"],
      "rows": [["värde1", "värde2"]],
      "context": "vad tabellen visar"
    }
  ],
  "themes": {
    "main_themes": ["3-5 huvudteman"],
    "priorities": ["prioriteringar"],
    "strengths": ["styrkor"],
    "challenges": ["utmaningar"]
  },
  "business_intelligence": {
    "economic_kpis": [{"metric": "namn", "value": "exakt värde", "context": "kontext", "source": "var i dokumentet"}],
    "goals": ["mål"],
    "risks": ["risker"],
    "opportunities": ["möjligheter"],
    "actions": ["åtgärder"],
    "deadlines": [{"task": "uppgift", "date": "datum"}]
  },
  "sentiment_analysis": {
    "overall_tone": "ton",
    "confidence_level": "säkerhetsnivå",
    "focus": "fokus"
  },
  "keywords": ["15-20 nyckelord"],
  "extracted_data": {
    "dates": ["datum"],
    "amounts": ["belopp med kontext"],
    "people": ["personer"],
    "organizations": ["organisationer"],
    "locations": ["platser"],
    "key_numbers": [{"label": "beskrivning", "value": "värde"}]
  }
}`
      : `Analysera detta dokument fokuserat och koncist.

Dokumenttyp: ${document.file_type}
Dokumentnamn: ${document.file_name}

Innehåll (första 30000 tecken):
${fileContent.substring(0, 30000)}

Returnera strukturerad JSON:

{
  "summary": "Koncis sammanfattning (max 200 ord)",
  "document_metadata": {
    "document_type": "typ",
    "time_period": "period",
    "key_actors": ["aktörer"],
    "geographical_scope": ["områden"]
  },
  "themes": {
    "main_themes": ["3-5 huvudteman"],
    "priorities": ["prioriteringar"],
    "strengths": ["styrkor"],
    "challenges": ["utmaningar"]
  },
  "business_intelligence": {
    "economic_kpis": [{"metric": "namn", "value": "värde", "context": "kontext"}],
    "goals": ["mål"],
    "risks": ["risker"],
    "opportunities": ["möjligheter"],
    "actions": ["åtgärder"],
    "deadlines": ["deadlines"]
  },
  "sentiment_analysis": {
    "overall_tone": "ton",
    "confidence_level": "säkerhetsnivå",
    "focus": "fokus"
  },
  "keywords": ["10-15 nyckelord"],
  "extracted_data": {
    "dates": ["datum"],
    "amounts": ["belopp"],
    "people": ["personer"],
    "organizations": ["organisationer"],
    "locations": ["platser"]
  }
}`;

    console.log('Sending request to Lovable AI (gemini-2.5-flash)...');

    // Call Lovable AI - use multimodal for PDFs, text for others
    const requestBody = isPDF ? {
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'Du är en expertanalysassistent för PDF-dokument. Analysera dokumentets struktur, tabeller, och innehåll noggrant. Svara alltid i valid JSON-format.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: analysisPrompt
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${document.file_type};base64,${base64Data}`
              }
            }
          ]
        }
      ],
      temperature: 0.2,
    } : {
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'Du är en dokumentanalysassistent. Svara alltid i JSON-format, koncist och strukturerat.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
      temperature: 0.2,
    };

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      await supabase
        .from('documents')
        .update({ status: 'error' })
        .eq('id', documentId);
      
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
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        analysisResult = JSON.parse(contentText);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      analysisResult = {
        summary: aiData.choices[0].message.content,
        keywords: [],
        extracted_data: {}
      };
    }

    const processingTime = Date.now() - startTime;
    console.log('Analysis took:', processingTime, 'ms');

    // Save analysis result with processing time
    const { data: savedResult, error: saveError } = await supabase
      .from('analysis_results')
      .insert({
        document_id: documentId,
        summary: analysisResult.summary,
        keywords: analysisResult.keywords || [],
        extracted_data: analysisResult.extracted_data || {},
        is_valid: true,
        processing_time: processingTime,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save analysis:', saveError);
      await supabase
        .from('documents')
        .update({ status: 'error' })
        .eq('id', documentId);
      return new Response(
        JSON.stringify({ error: 'Failed to save analysis' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update document status to analyzed
    await supabase
      .from('documents')
      .update({ status: 'analyzed' })
      .eq('id', documentId);

    console.log('Analysis complete:', savedResult.id);

    return new Response(
      JSON.stringify({
        success: true,
        analysis: savedResult,
        processing_time: processingTime
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