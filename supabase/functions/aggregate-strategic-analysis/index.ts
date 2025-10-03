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

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { sessionId } = await req.json();

    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    console.log(`Starting strategic aggregation for session: ${sessionId}`);

    // Fetch the session
    const { data: session, error: sessionError } = await supabase
      .from('analysis_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
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
ANALYSTYP: Strategisk Jämförelseanalys

MÅL: Identifiera långsiktiga mål och strategiska prioriteringar i dokumenten genom att analysera ALLA dokument tillsammans.

INSTRUKTIONER:
1. Identifiera övergripande mål och visioner i dokumenten.
2. Kartlägg gemensamma fokusområden för kommunerna.
3. Jämför mot nationella strategier och EU-agendor där relevant.
4. Identifiera gap mellan lokala och regionala mål.
5. Lista möjligheter till samarbete och hinder som nämns.

PRESENTATION:
- Strategisk Målkarta: lista av teman → mål → indikatorer.
- Gap-Analys: tabell med skillnader mellan kommuners och regionens/nationens mål.
- Rekommenderade Fokusområden (3–5 punkter) för GR.

OUTPUTFORMAT:
Strukturera analysen i markdown med följande sektioner:

## Strategisk Översikt
En samlad bild av alla dokuments riktning och prioriteringar.

## Gemensamma Fokusområden
Lista tematiska områden som går igen i flera dokument, med referenser till specifika dokument.

## Strategisk Målkarta
Teman → Mål → Indikatorer i tabellformat eller strukturerad lista.

## Gap-Analys
Tabell som visar skillnader mellan lokal/regional/nationell nivå:
| Område | Lokal nivå | Regional/Nationell/EU-nivå | Identifierat gap |

## Rekommenderade Fokusområden
3-5 konkreta fokusområden för Göteborgsregionen med motiveringar.

---

KRITISKT VIKTIGT:
- Analysera dokumenten TILLSAMMANS, inte separat
- Leta efter mönster, motsättningar och synergier mellan dokumenten
- Ge konkreta, handlingsbara rekommendationer
- Referera specifika dokument när du nämner information
- Använd tabeller och strukturerad data där det är relevant
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
              description: 'Skapa en strukturerad strategisk analys',
              parameters: {
                type: 'object',
                properties: {
                  strategic_overview: {
                    type: 'string',
                    description: 'Strategisk översikt av alla dokument'
                  },
                  common_focus_areas: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        area: { type: 'string' },
                        description: { type: 'string' },
                        documents: { type: 'array', items: { type: 'string' } }
                      }
                    },
                    description: 'Gemensamma fokusområden'
                  },
                  strategic_goals_map: {
                    type: 'string',
                    description: 'Strategisk målkarta i markdown-tabellformat'
                  },
                  gap_analysis: {
                    type: 'string',
                    description: 'Gap-analys i markdown-tabellformat'
                  },
                  recommended_focus_areas: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        description: { type: 'string' },
                        motivation: { type: 'string' }
                      }
                    },
                    description: '3-5 rekommenderade fokusområden'
                  },
                  full_markdown_output: {
                    type: 'string',
                    description: 'Komplett analys i markdown-format enligt mallen'
                  }
                },
                required: ['strategic_overview', 'common_focus_areas', 'gap_analysis', 'recommended_focus_areas', 'full_markdown_output']
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
