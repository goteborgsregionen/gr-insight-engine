import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Base64 helper removed - now using text-only processing for all files

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, analysis_type = 'standard', custom_prompt } = await req.json();
    console.log('Analyzing document:', documentId, 'with analysis type:', analysis_type);

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

    // Treat all files as text - no base64 encoding needed
    const decoder = new TextDecoder();
    const fileContent = decoder.decode(fileBuffer);
    console.log(`${isPDF ? 'PDF' : 'Text'} file detected. Content length: ${fileContent.length}, Hash: ${contentHash}`);

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

    // Get template-specific prompt modifier
    const getTemplateModifier = (type: string, customPrompt?: string): string => {
      if (type === 'custom' && customPrompt) {
        return `\n\nANVÄNDAR-SPECIFIKT FOKUS:\n${customPrompt}\n`;
      }
      
      const templates: Record<string, string> = {
        economic: `
EKONOMISKT FOKUS - KRITISKT VIKTIGT:
- Extrahera ALLA budgetsiffror, kostnader och ekonomiska värden
- Hitta ALLA KPI:er relaterade till ekonomi och finans
- Identifiera ROI, cost-benefit, och ekonomiska prognoser
- Notera år, jämförelsevärden och trender
- Markera finansiella risker och möjligheter
`,
        security: `
SÄKERHETSFOKUS - KRITISKT VIKTIGT:
- Identifiera ALLA säkerhetsåtgärder och kontroller
- Hitta hot-scenarier, risker och sårbarheter
- Extrahera compliance-krav (GDPR, ISO27001, etc.)
- Notera säkerhetsincidenter och lärdomar
- Hitta säkerhetsbudget och resurser
`,
        strategic: `
STRATEGISKT FOKUS - KRITISKT VIKTIGT:
- Identifiera vision, mission och övergripande mål
- Extrahera långsiktiga planer och milestones
- Hitta strategiska prioriteringar och initiativ
- Notera konkurrensfördelar och differentiering
- Identifiera strategiska risker och beroenden
`,
        technical: `
TEKNISKT FOKUS - KRITISKT VIKTIGT:
- Extrahera tekniska specifikationer och arkitektur
- Identifiera teknologier, plattformar och verktyg
- Hitta tekniska krav och beroenden
- Notera integrationer och API:er
- Identifiera tekniska risker och teknisk skuld
`,
        kpi_metrics: `
KPI-FOKUS - KRITISKT VIKTIGT:
- Extrahera ALLA mätetal och KPI:er
- Hitta målvärden, baseline och actual values
- Identifiera framgångsfaktorer och success criteria
- Notera mätfrekvens och ansvarsfördelning
- Hitta dashboards och rapporteringsstrukturer
`
      };
      
      return templates[type] || '';
    };

    const templateModifier = getTemplateModifier(analysis_type, custom_prompt);

    // Enhanced prompt - different for PDFs vs text files
    const analysisPrompt = isPDF
      ? `Analysera detta PDF-dokument grundligt och noggrant med särskilt fokus på datautvinning.

Dokumenttyp: ${document.file_type}
Dokumentnamn: ${document.file_name}

${templateModifier}

${templateModifier ? 'VIKTIGT: Anpassa din analys efter det fokus som specificeras ovan. Om ekonomiskt fokus: prioritera siffror och KPI:er. Om säkerhetsfokus: prioritera hot och kontroller. Etc.' : ''}

KRITISKT - För VARJE tabell i dokumentet:
1. Extrahera ALLA kolumnrubriker exakt som de står
2. Extrahera ALLA rader - hoppa inte över någon
3. Bevara numeriska värden EXAKT (inklusive enheter som MSEK, %, etc.)
4. Notera sidnummer/sektion där tabellen finns
5. Om tabellen är för stor (>20 rader), ta första 10 och sista 10 + ange [... X rader utelämnade ...]

OBS - Detta är textutvinning från PDF:
- Om texten verkar ofullständig eller saknas kan det vara en scannad PDF utan text layer
- I så fall, lägg till en varning i "warnings" arrayen om att dokumentet kanske behöver OCR
- Fokusera på den text som finns tillgänglig i PDF:ens text layer

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

${templateModifier}

${templateModifier ? 'VIKTIGT: Anpassa din analys efter det fokus som specificeras ovan.' : ''}

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

    // Call Lovable AI - unified text-only request for all file types
    const requestBody = {
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: isPDF 
            ? 'Du är en expertanalysassistent för PDF-dokument. Du får PDF-innehåll i text-format. Analysera strukturen, tabeller, och data noggrant. Svara alltid i valid JSON-format.'
            : 'Du är en dokumentanalysassistent. Svara alltid i JSON-format, koncist och strukturerat.'
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

    // Get focus areas based on template
    const getFocusAreas = (type: string): string[] => {
      const focusMap: Record<string, string[]> = {
        standard: ['summary', 'keywords', 'key_points'],
        economic: ['budgets', 'costs', 'economic_kpis', 'roi', 'financial_trends'],
        security: ['security_measures', 'risks', 'compliance', 'incidents', 'controls'],
        strategic: ['vision', 'goals', 'strategic_initiatives', 'milestones', 'competitive_advantages'],
        technical: ['technical_specs', 'architecture', 'technologies', 'integrations', 'technical_debt'],
        kpi_metrics: ['kpis', 'metrics', 'targets', 'success_criteria', 'measurement_frequency'],
        custom: ['custom_analysis']
      };
      return focusMap[type] || focusMap.standard;
    };

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
        analysis_type: analysis_type,
        custom_prompt: custom_prompt || null,
        analysis_focus: {
          type: analysis_type,
          custom: analysis_type === 'custom',
          focus_areas: getFocusAreas(analysis_type)
        }
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