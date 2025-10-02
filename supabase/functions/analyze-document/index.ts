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
    const getTemplatePromptModifier = (type: string, customPrompt?: string): string => {
      if (type === 'custom' && customPrompt) {
        return `\n\nANVÄNDAR-SPECIFIKT FOKUS:\n${customPrompt}\n`;
      }
      
      const templates: Record<string, string> = {
        standard: `
ANALYSTYP: Standard
MÅL: Ge en sammanhängande översikt av de markerade dokumenten.

INSTRUKTIONER:
1. Läs och extrahera huvudsyftet med varje dokument.
2. Identifiera:
   - Viktiga aktörer (kommuner, avdelningar, projekt).
   - Centrala mål och prioriteringar.
   - Viktiga beslut, tidslinjer och resultat.
3. Sammanfatta centrala budskap och teman.
4. Sammanfatta om det finns viktiga likheter kontra skillnader kommuner emellan

PRESENTATION:
- Executive Summary (max 1 A4) för beslutsfattare.
- Punktlista med de 5–7 viktigaste temana.
- Tabell med dokument → tema → ansvarig aktör.
- Kort ordlista över återkommande termer.

OUTPUTFORMAT:
Strukturera i markdown med följande sektioner:
## Executive Summary
## Huvudteman
## Viktiga Aktörer
## Dokument-Tema-Karta
## Nyckeltermer
`,
        economic: `
ANALYSTYP: Ekonomisk
MÅL: Analysera budget, kostnader, investeringar och ekonomiska trender.

INSTRUKTIONER:
1. Extrahera relevanta nyckeltal (kostnad/intäkt per invånare, investeringar, driftkostnader).
2. Identifiera trender över tid (5–10 år där möjligt).
3. Jämför mellan kommunerna samt med nationella referenser.
4. Lyft fram riskområden eller avvikelser.
5. Koppla ekonomiska insikter till strategiska prioriteringar.

PRESENTATION:
- Dashboard med KPI:er (använd tabell med indikator, kommun, GR-snitt, trend).
- Top-5 och Botten-5 kommuner inom centrala indikatorer.
- Kortfattade rekommendationer (3–5 punkter) för resursprioritering.

OUTPUTFORMAT:
Strukturera i markdown med följande sektioner:
## Ekonomisk Översikt
## KPI-Dashboard
## Trender och Jämförelser
## Rekommenderade Åtgärder
`,
        security: `
ANALYSTYP: Säkerhet
MÅL: Identifiera risker och sårbarheter i dokumenten.

INSTRUKTIONER:
1. Identifiera risker inom:
   - IT- och dataskydd.
   - Drift och fysisk infrastruktur.
   - Lag- och standardefterlevnad (GDPR, NIS2).
2. Lista tidigare incidenter eller svagheter.
3. Föreslå riskminskande åtgärder och prioriteringar.

PRESENTATION:
- Riskmatris: sannolikhet × konsekvens.
- Prioriteringslista med risker och föreslagna åtgärder.
- Statusöversikt över kommunernas efterlevnad av standarder.

OUTPUTFORMAT:
Strukturera i markdown med följande sektioner:
## Risköversikt
## Riskmatris
## Prioriterade Åtgärder
## Efterlevnadsstatus
`,
        strategic: `
ANALYSTYP: Strategisk
MÅL: Identifiera långsiktiga mål och strategiska prioriteringar i dokumenten.

INSTRUKTIONER:
1. Identifiera övergripande mål och visioner i dokumenten.
2. Kartlägg gemensamma fokusområden för kommunerna.
3. Jämför mot nationella strategier och EU-agendor.
4. Identifiera gap mellan lokala och regionala mål.
5. Lista möjligheter till samarbete och hinder som nämns.

PRESENTATION:
- Strategisk Målkarta: lista av teman → mål → indikatorer.
- Gap-Analys: tabell med skillnader mellan kommuners och regionens/nationens mål.
- Rekommenderade Fokusområden (3–5 punkter) för GR.

OUTPUTFORMAT:
Strukturera i markdown med följande sektioner:
## Strategisk Översikt
## Gemensamma Fokusområden
## Gap-Analys
## Rekommenderade Fokusområden
`,
        technical: `
ANALYSTYP: Teknisk
MÅL: Kartlägga tekniska system och processer för att hitta förbättringspotential.

INSTRUKTIONER:
1. Identifiera nämnda IT-system och plattformar.
2. Lista processer som idag hanteras manuellt eller ineffektivt.
3. Identifiera bristande interoperabilitet och standarder.
4. Bedöm tekniska risker (föråldrade system, beroenden).

PRESENTATION:
- Systemlandskap med befintliga system och integrationsbehov.
- Processkarta med möjligheter för digitalisering/automatisering.
- Rekommendationslista med prioriterade åtgärder.

OUTPUTFORMAT:
Strukturera i markdown med följande sektioner:
## Teknisk Översikt
## Systemlandskap
## Processkarta
## Rekommenderade Åtgärder
`,
        kpi_metrics: `
ANALYSTYP: KPI & Metrics
MÅL: Utvärdera prestationer och måluppfyllelse utifrån befintliga data.

INSTRUKTIONER:
1. Identifiera befintliga KPI:er som rapporteras i dokumenten.
2. Bedöm måluppfyllelse utifrån tillgängliga data.
3. Jämför prestationer mellan kommunerna och mot nationella mål.
4. Föreslå nya KPI:er där mätning saknas.

PRESENTATION:
- KPI-Dashboard med trafikljusmodell (grön/gul/röd) för måluppfyllelse.
- Gap-analys som visar saknade indikatorer eller data.
- Rekommendationer för förbättrad uppföljning.

OUTPUTFORMAT:
Strukturera i markdown med följande sektioner:
## KPI-Översikt
## KPI-Dashboard
## Gap-Analys
## Rekommenderade KPI:er
`
      };
      
      return templates[type] || '';
    };

    const templateModifier = getTemplatePromptModifier(analysis_type, custom_prompt);

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
VIKTIGT OUTPUT-FORMAT:
Du ska returnera ett JSON-objekt med följande struktur:

{
  "summary": "Kort sammanfattning (200-300 ord) för databas-sökning",
  "keywords": ["nyckelord1", "nyckelord2", ...],
  "markdown_output": "## Din markdown-formaterade output här enligt instruktionerna ovan",
  "extracted_data": {
    "dates": ["datum med kontext"],
    "amounts": ["belopp med fullständig kontext och enhet"],
    "people": ["personer med roller"],
    "organizations": ["organisationer med relation till dokumentet"],
    "locations": ["platser med kontext"],
    "key_numbers": [{"label": "beskrivning", "value": "värde", "unit": "enhet", "page": sidnummer}],
    "tables": [...],
    "document_metadata": {...},
    "business_intelligence": {...}
  }
}

KRITISKT: 
- "markdown_output" fältet ska innehålla den fullständiga analysen formaterad enligt de markdown-sektioner som specificeras i instruktionerna ovan
- Använd markdown-syntax: ## för rubriker, **bold**, listor, tabeller etc.
- "summary" och "keywords" används för databas och sökning
- "extracted_data" innehåller strukturerad metadata och all detaljerad information
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
          content: 'Du är en expertanalysassistent för dokument. Du ska analysera enligt givna instruktioner och returnera output i BÅDE JSON och Markdown. JSON för metadata, Markdown för formaterad presentation.'
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
      
      // Validate that we have markdown_output
      if (!analysisResult.markdown_output) {
        console.warn('No markdown_output in AI response, using summary as fallback');
        analysisResult.markdown_output = analysisResult.summary || '';
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      analysisResult = {
        summary: aiData.choices[0].message.content,
        markdown_output: aiData.choices[0].message.content,
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

    // Save analysis result with processing time and markdown output
    const { data: savedResult, error: saveError } = await supabase
      .from('analysis_results')
      .insert({
        document_id: documentId,
        summary: analysisResult.summary,
        keywords: analysisResult.keywords || [],
        extracted_data: {
          ...analysisResult.extracted_data,
          markdown_output: analysisResult.markdown_output
        },
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