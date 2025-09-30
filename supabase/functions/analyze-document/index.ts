import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function for efficient base64 conversion without stack overflow
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192; // 8KB chunks to avoid stack overflow
  let binary = '';
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  
  return btoa(binary);
}

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
    
    // Validate file size (Gemini's limit is 20MB)
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    if (fileBuffer.byteLength > MAX_FILE_SIZE) {
      console.error('File too large:', fileBuffer.byteLength, 'bytes');
      await supabase
        .from('documents')
        .update({ status: 'error' })
        .eq('id', documentId);
      throw new Error(`Filen är för stor (${Math.round(fileBuffer.byteLength / 1024 / 1024)}MB). Max 20MB tillåtet.`);
    }
    
    // Calculate hash from buffer
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Convert to base64 for PDFs, text for others
    let fileContent = '';
    let base64Data = '';
    
    if (isPDF) {
      base64Data = arrayBufferToBase64(fileBuffer);
      console.log('PDF detected, using chunked base64 encoding. Size:', fileBuffer.byteLength, 'Hash:', contentHash);
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
      ? `Analysera detta PDF-dokument grundligt och noggrant med särskilt fokus på datautvinning.

Dokumenttyp: ${document.file_type}
Dokumentnamn: ${document.file_name}

KRITISKT - För VARJE tabell i dokumentet:
1. Extrahera ALLA kolumnrubriker exakt som de står
2. Extrahera ALLA rader - hoppa inte över någon
3. Bevara numeriska värden EXAKT (inklusive enheter som MSEK, %, etc.)
4. Notera sidnummer/sektion där tabellen finns
5. Om tabellen är för stor (>20 rader), ta första 10 och sista 10 + ange [... X rader utelämnade ...]

KRITISKT - För scannade PDFs eller bilder:
- Använd OCR för att läsa all text noggrant
- Dubbelkolla siffror och datum
- Markera om något är osäkert med [OCR: osäker]

VIKTIGT - För PDF-dokument, fokusera på:
- Tabeller och strukturerad data (bevara format och värden exakt)
- Numeriska värden och KPI:er med fullständig kontext
- Hierarkisk information och rubriker
- Diagram och figurer (beskriv innehåll detaljerat)
- Listor och punkter
- Dokumentets övergripande struktur
- Sidhänvisningar för alla data

Returnera strukturerad JSON:

{
  "summary": "Detaljerad sammanfattning som inkluderar all viktig data från tabeller och diagram (max 300 ord)",
  "document_metadata": {
    "document_type": "typ av dokument (t.ex. IT-strategi, budget, policy)",
    "has_tables": true/false,
    "has_images": true/false,
    "time_period": "tidsperiod som dokumentet täcker",
    "key_actors": ["aktörer och organisationer"],
    "geographical_scope": ["områden och regioner"],
    "key_sections": ["viktiga sektioner med sidnummer"],
    "total_pages": antal_sidor
  },
  "extracted_tables": [
    {
      "table_name": "beskrivande namn",
      "page_number": sidnummer,
      "headers": ["kolumn1", "kolumn2", "kolumn3"],
      "rows": [["värde1", "värde2", "värde3"], ["värde4", "värde5", "värde6"]],
      "context": "vad tabellen visar och varför den är viktig",
      "notes": "eventuella fotnoter eller förklaringar"
    }
  ],
  "themes": {
    "main_themes": ["3-5 huvudteman med kort förklaring"],
    "priorities": ["prioriteringar i prioritetsordning"],
    "strengths": ["styrkor som identifieras"],
    "challenges": ["utmaningar och problem som nämns"]
  },
  "business_intelligence": {
    "economic_kpis": [
      {
        "metric": "Budget IT 2024",
        "value": "45 miljoner SEK",
        "context": "Ökning från 40 MSEK 2023 (+12.5%)",
        "source": "Sida 12, Tabell 3: Ekonomisk plan",
        "trend": "uppåtgående",
        "comparison_baseline": {"year": 2023, "value": "40 MSEK"}
      }
    ],
    "goals": ["konkreta mål med tidsramar"],
    "risks": ["identifierade risker med allvarlighetsgrad"],
    "opportunities": ["möjligheter som framhålls"],
    "actions": ["planerade åtgärder med ansvarig och deadline"],
    "deadlines": [{"task": "uppgift", "date": "datum", "responsible": "ansvarig"}]
  },
  "sentiment_analysis": {
    "overall_tone": "positiv/neutral/negativ/blandad",
    "confidence_level": "hög/medel/låg säkerhet i dokumentet",
    "focus": "huvudsakligt fokusområde"
  },
  "keywords": ["15-25 nyckelord och fraser"],
  "extracted_data": {
    "dates": ["datum med kontext"],
    "amounts": ["belopp med fullständig kontext och enhet"],
    "people": ["personer med roller"],
    "organizations": ["organisationer med relation till dokumentet"],
    "locations": ["platser med kontext"],
    "key_numbers": [{"label": "beskrivning", "value": "värde", "unit": "enhet", "page": sidnummer}]
  },
  "analysis_confidence": {
    "overall_score": 0.85,
    "text_quality": "high",
    "table_extraction_success": true,
    "tables_found": 5,
    "tables_extracted": 5,
    "ocr_required": false,
    "warnings": ["eventuella problem eller osäkerheter"]
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