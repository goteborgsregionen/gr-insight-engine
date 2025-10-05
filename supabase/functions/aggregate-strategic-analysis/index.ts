import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { sessionId } = await req.json();

    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    console.log(`Starting strategic aggregation for session: ${sessionId}`);

    // Authenticate: support both frontend calls (with Authorization header) and service-to-service calls (without header)
    const authHeader = req.headers.get('Authorization');
    let userId: string;

    if (authHeader) {
      // Called from frontend with user token
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        throw new Error('Unauthorized');
      }
      userId = user.id;
    } else {
      // Called from another edge function (process-analysis-queue) - get user_id from session
      const { data: sessionData, error: sessionError } = await supabase
        .from('analysis_sessions')
        .select('user_id')
        .eq('id', sessionId)
        .single();

      if (sessionError || !sessionData) {
        throw new Error('Session not found');
      }
      userId = sessionData.user_id;
      console.log(`Service-to-service call for user: ${userId}`);
    }

    // Fetch the session
    const { data: session, error: sessionError } = await supabase
      .from('analysis_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      throw new Error('Session not found');
    }

    // Fetch all individual analysis results
    const { data: individualResults, error: resultsError } = await supabase
      .from('analysis_results')
      .select('*')
      .in('document_id', session.document_ids);

    if (resultsError) {
      throw new Error('Failed to fetch analysis results');
    }

    // Fetch document details
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id, title, file_name')
      .in('id', session.document_ids);

    if (docsError) {
      throw new Error('Failed to fetch documents');
    }

    console.log(`Found ${individualResults.length} individual analyses for ${documents.length} documents`);

    // Prepare the comprehensive prompt for strategic aggregation
    const strategicPromptTemplate = `
Du är en expert på strategisk policyanalys och ska skapa en omfattande strategisk jämförelseanalys.

ANALYSTYP: Strategisk Jämförelseanalys

MÅL: 
Identifiera långsiktiga mål och strategiska prioriteringar genom att analysera ALLA dokument tillsammans. 
Skapa en samlad strategisk översikt som visar mönster, synergier och gap mellan dokumenten.

INSTRUKTIONER:
1. **Strategisk Översikt**: Ge en omfattande sammanfattning (minst 200 ord) som visar:
   - Den samlade riktningen i alla dokument
   - Hur dokumenten kompletterar och förstärker varandra
   - Övergripande målbilder och visioner
   - Kopplingar till nationella strategier, EU-agendor och Agenda 2030

2. **Gemensamma Fokusområden**: Identifiera 5-7 huvudsakliga tematiska områden som går igen:
   - För varje område: ge en detaljerad beskrivning (minst 50 ord)
   - Lista vilka specifika dokument som tar upp området (med dokumentnamn)
   - Beskriv hur olika dokument belyser området ur olika perspektiv
   Exempel på områden: grön omställning, digitalisering, kompetensförsörjning, inkludering, samverkan, resiliens

3. **Strategisk Målkarta**: Skapa en strukturerad lista med format:
   **Tema** → Konkreta mål → Mätbara indikatorer
   
   För varje tema:
   - Lista 2-4 konkreta mål
   - Ge 2-3 föreslagna indikatorer för uppföljning
   - Ange vilka dokument målen kommer ifrån
   
   Exempel:
   **Grön omställning** → Klimatneutralitet/utsläppsminskning → utsläpp per capita, andel förnybar energi (📄 RUS, 📄 Nationell strategi)

4. **Gap-Analys**: Skapa en FAKTISK TABELL i markdown-format:
   
   | Område | Lokal kommunnivå | Regional/Nationell/EU-nivå | Identifierat gap |
   |--------|------------------|----------------------------|------------------|
   | [exempel: Klimat & energi] | [beskriv lokal nivå från dokumenten] | [beskriv regional/nationell nivå från dokumenten] | [beskriv konkreta gap: kapacitet, finansiering, kompetens, etc.] |
   
   Skapa minst 5-7 rader med konkreta gap baserade på dokumentens innehåll.
   Var specifik om vilka typer av gap det är (genomförandegap, resursgap, kompetensgap, etc.)

5. **Rekommenderade Fokusområden för GR**: Lista 3-5 prioriterade fokusområden med följande struktur för varje:
   
   **[Nummer]. [Tydlig rubrik]** – [kort beskrivning av vad det handlar om]
   
   [Längre förklaring (minst 100 ord per rekommendation) som inkluderar:]
   - Varför detta är viktigt (med dokumentreferens, t.ex. 📄 Dokumentnamn)
   - Konkreta förslag på åtgärder och initiativ
   - Vilka aktörer som bör involveras
   - Koppling till identifierade gap
   - Förväntade resultat/effekter

OUTPUTFORMAT:
Din analys MÅSTE följa denna markdown-struktur:

## Strategisk Översikt
[Omfattande översiktstext på minst 200 ord]

## Gemensamma Fokusområden
**[Område 1]** – [Detaljerad beskrivning med dokumentreferenser]
📄 [Dokumentnamn], 📄 [Dokumentnamn]

**[Område 2]** – [Detaljerad beskrivning med dokumentreferenser]
...

## Strategisk Målkarta (teman → mål → indikatorer)
**[Tema 1]** → [Mål] → [Indikatorer]
📄 [Dokumentreferens]

**[Tema 2]** → [Mål] → [Indikatorer]
...

## Gap-Analys
| Område | Lokal kommunnivå | Regional/Nationell/EU-nivå | Identifierat gap |
|--------|------------------|----------------------------|------------------|
| [Område 1] | [Beskrivning] | [Beskrivning] | [Konkret gap] |
| [Område 2] | [Beskrivning] | [Beskrivning] | [Konkret gap] |
...

## Rekommenderade Fokusområden för GR (3–5)
**1. [Rubrik]** – [Kort beskrivning]

[Längre förklaring med varför, vad, hur, vilka, och dokumentreferenser]
📄 [Dokumentnamn], 📄 [Dokumentnamn]

**2. [Rubrik]** – [Kort beskrivning]
...

---

KRITISKA KVALITETSKRAV:
✅ Varje sektion ska vara omfattande och detaljerad (inte korta punktlistor)
✅ Gap-analysen MÅSTE vara en faktisk markdown-tabell med |
✅ Alla påståenden ska referera till specifika dokument med 📄 emoji
✅ Rekommendationerna ska vara handlingsbara med konkreta åtgärdsförslag
✅ Texten ska vara professionell, tvärsektoriell och strategiskt tänkande
✅ Totalt minst 1500 ord för hela analysen
✅ Använd dokumentens faktiska innehåll, inte generiska formuleringar
`;

    // Build the comprehensive context from all individual analyses
    let analysisContext = "INDIVIDUELLA DOKUMENTANALYSER:\n\n";
    
    for (const result of individualResults) {
      const doc = documents.find(d => d.id === result.document_id);
      analysisContext += `### Dokument: ${doc?.title || doc?.file_name}\n\n`;
      
      if (result.summary) {
        analysisContext += `**Sammanfattning:**\n${result.summary}\n\n`;
      }
      
      if (result.extracted_data?.markdown_output) {
        analysisContext += `**Fullständig analys:**\n${result.extracted_data.markdown_output}\n\n`;
      }
      
      if (result.keywords && result.keywords.length > 0) {
        analysisContext += `**Nyckelord:** ${result.keywords.join(', ')}\n\n`;
      }
      
      analysisContext += "---\n\n";
    }

    // Add custom prompt if provided
    if (session.custom_prompt) {
      analysisContext += `\n\nANVÄNDAR-SPECIFIKA INSTRUKTIONER:\n${session.custom_prompt}\n\n`;
    }

    // Call Lovable AI with tool calling for structured output
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Calling Lovable AI for strategic aggregation...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: strategicPromptTemplate
          },
          {
            role: 'user',
            content: `Analysera följande dokument och skapa en strategisk jämförelseanalys:\n\n${analysisContext}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'create_strategic_analysis',
              description: 'Skapa en omfattande strategisk jämförelseanalys med alla obligatoriska sektioner',
              parameters: {
                type: 'object',
                properties: {
                  strategic_overview: {
                    type: 'string',
                    description: 'OMFATTANDE strategisk översikt (minst 200 ord) som beskriver den samlade riktningen i alla dokument, hur de kompletterar varandra, övergripande målbilder och kopplingar till nationella/EU-strategier'
                  },
                  common_focus_areas: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        area: { 
                          type: 'string',
                          description: 'Namnet på fokusområdet (t.ex. "Grön omställning & elektrifiering")'
                        },
                        description: { 
                          type: 'string',
                          description: 'DETALJERAD beskrivning av området (minst 50 ord) som förklarar hur olika dokument belyser det'
                        },
                        documents: { 
                          type: 'array', 
                          items: { type: 'string' },
                          description: 'Lista med dokumentnamn som tar upp detta område'
                        }
                      },
                      required: ['area', 'description', 'documents']
                    },
                    description: '5-7 huvudsakliga gemensamma fokusområden med detaljerade beskrivningar'
                  },
                  strategic_goals_map: {
                    type: 'string',
                    description: 'Strategisk målkarta i markdown-format med struktur: **Tema** → Mål → Indikatorer. Inkludera dokumentreferenser med 📄 emoji. Minst 5-7 olika teman.'
                  },
                  gap_analysis: {
                    type: 'string',
                    description: 'FAKTISK markdown-tabell med | som avgränsare. Format: | Område | Lokal kommunnivå | Regional/Nationell/EU-nivå | Identifierat gap |. Minst 5-7 rader med konkreta, detaljerade gap baserade på dokumentens faktiska innehåll. Var specifik om gap-typer (genomförandegap, resursgap, kompetensgap, etc.)'
                  },
                  recommended_focus_areas: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { 
                          type: 'string',
                          description: 'Tydlig, handlingsbar rubrik för rekommendationen'
                        },
                        description: { 
                          type: 'string',
                          description: 'OMFATTANDE beskrivning (minst 100 ord) som inkluderar: varför det är viktigt, konkreta åtgärdsförslag, vilka aktörer som bör involveras, koppling till identifierade gap, förväntade resultat'
                        },
                        motivation: { 
                          type: 'string',
                          description: 'Dokumentreferenser som stödjer denna rekommendation (med 📄 emoji)'
                        }
                      },
                      required: ['title', 'description', 'motivation']
                    },
                    description: '3-5 prioriterade, detaljerade och handlingsbara fokusområden för Göteborgsregionen'
                  },
                  full_markdown_output: {
                    type: 'string',
                    description: 'KOMPLETT, PROFESSIONELL analys i markdown-format enligt exakt den mall som specificerats. MÅSTE innehålla ALLA sektioner: ## Strategisk Översikt, ## Gemensamma Fokusområden, ## Strategisk Målkarta, ## Gap-Analys (med faktisk tabell), ## Rekommenderade Fokusområden. Totalt minst 1500 ord. Använd 📄 emoji för dokumentreferenser genomgående.'
                  }
                },
                required: ['strategic_overview', 'common_focus_areas', 'strategic_goals_map', 'gap_analysis', 'recommended_focus_areas', 'full_markdown_output'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: {
          type: 'function',
          function: { name: 'create_strategic_analysis' }
        }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    // Extract structured output from tool call
    let aggregatedAnalysis;
    if (aiData.choices?.[0]?.message?.tool_calls?.[0]) {
      const toolCall = aiData.choices[0].message.tool_calls[0];
      aggregatedAnalysis = JSON.parse(toolCall.function.arguments);
    } else {
      throw new Error('No structured output from AI');
    }

    // Create the final result structure
    const finalResult = {
      type: 'strategic_aggregation',
      analysis_type: session.analysis_type,
      document_count: documents.length,
      documents: documents.map(d => ({
        id: d.id,
        title: d.title,
        file_name: d.file_name
      })),
      strategic_overview: aggregatedAnalysis.strategic_overview,
      common_focus_areas: aggregatedAnalysis.common_focus_areas,
      strategic_goals_map: aggregatedAnalysis.strategic_goals_map,
      gap_analysis: aggregatedAnalysis.gap_analysis,
      recommended_focus_areas: aggregatedAnalysis.recommended_focus_areas,
      full_markdown_output: aggregatedAnalysis.full_markdown_output,
      individual_results: individualResults.map(r => ({
        document_id: r.document_id,
        summary: r.summary,
        keywords: r.keywords
      })),
      completed_at: new Date().toISOString()
    };

    // Update the session with the aggregated result
    const { error: updateError } = await supabase
      .from('analysis_sessions')
      .update({
        analysis_result: finalResult,
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (updateError) {
      throw new Error('Failed to update session: ' + updateError.message);
    }

    console.log(`Strategic aggregation completed for session: ${sessionId}`);

    return new Response(
      JSON.stringify({
        success: true,
        sessionId,
        result: finalResult
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in aggregate-strategic-analysis:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
