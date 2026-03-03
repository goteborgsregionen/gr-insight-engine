import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_BASE = `Du är en policyanalytiker som skapar strukturerade påståenden (claims) från verifierbar evidens.

CORE PRINCIPLES:
- Varje claim MÅSTE länka till specifika evidens-ID:n
- Evidens = fakta, claims = tolkningar/slutsatser från evidens
- ALDRIG göra påståenden utan evidens-stöd
- Tydlig separation: data (evidens) vs. insikt (claim)`;

const REASON_PROMPT = `TASK: REASON — Skapa strukturerade påståenden (claims) från evidensen nedan.

CLAIM FORMAT:
{
  "claim_id": "C-001",
  "type": "trend|gap|risk|goal|action|kpi|recommendation|insight|contradiction",
  "text": "IT-budgeten ökade med 12.5% mellan 2023-2024",
  "evidence_ids": ["E-001", "E-023"],
  "strength": "high|medium|low",
  "confidence_score": 85,
  "explanation": "Baserat på tabelldata från två oberoende dokument som visar konsistenta budgetsiffror...",
  "assumptions": ["Förutsätter att budgeten är inflationsjusterad"],
  "actors": ["IT-avdelningen"],
  "kpi_tags": ["budget", "IT"],
  "contradicts_claim_id": null
}

STRENGTH RULES:
- "high": Minst 2 oberoende källor (olika evidens-typer eller dokument)
- "medium": 1 stark källa (tabell med fullständig data)
- "low": Härledd från svag evidens eller antaganden

CONFIDENCE SCORE (0-100):
- 90-100: Direkt verifierbart faktum från primärkälla (officiell statistik, årsredovisning)
- 70-89: Starkt stöd från multipla evidensposter, men kräver viss tolkning
- 50-69: Rimlig slutsats baserad på tillgänglig data, men begränsat underlag
- 30-49: Spekulativt eller baserat på indirekta indikatorer
- 0-29: Svag evidens, antaganden dominerar

EXPLANATION (obligatoriskt för varje claim):
- Beskriv steg-för-steg hur du nådde slutsatsen
- Referera till specifika evidens-ID:n (E-XXX) och vad de visar
- Om flera evidensposter: förklara hur de stödjer varandra
- Om antaganden gjordes: förklara varför de är rimliga
- Max 2-3 meningar, koncist men informativt

CROSS-DOCUMENT FOCUS:
- Identifiera TRENDER över tid/dokument
- Upptäck MOTSÄGELSER mellan källor
- Markera DATAGAP där information saknas

CONTRADICTION DETECTION:
- Jämför siffror, procent och årtal mellan olika dokument
- Om samma KPI har olika värden i olika dokument, skapa en "contradiction" claim
- Ange contradicts_claim_id för att referera till det motstridiga påståendet
- Contradictions ska alltid ha strength "high" om båda källorna är tabeller/siffror, annars "medium"
- I claim-texten: beskriv BÅDA värdena och vilka dokument de kommer från

IMPORTANT:
- Använd save_claims tool för att spara alla claims
- Inkludera evidence_ids[] för varje claim
- Inkludera confidence_score (0-100) för varje claim
- Inkludera explanation för varje claim
- Flagga konflikter som "contradiction" med contradicts_claim_id
- Flagga datagap som "gap" med low strength`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { sessionId, documentIds } = await req.json();

    if (!sessionId || !documentIds || documentIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing sessionId or documentIds' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🧠 REASON: Generating claims for session ${sessionId}, ${documentIds.length} documents`);

    // Fetch ALL evidence from ALL documents
    const { data: allEvidence, error: evidenceError } = await supabase
      .from('evidence_posts')
      .select('*')
      .in('document_id', documentIds);

    if (evidenceError) throw evidenceError;

    console.log(`📊 Found ${allEvidence?.length || 0} evidence posts to reason from`);

    // Build evidence summary for AI — include document_id for cross-doc comparison
    const evidenceSummary = (allEvidence || []).map(e => ({
      id: e.evidence_id,
      type: e.type,
      source: e.source_loc,
      document_id: e.document_id,
      content: e.type === 'table' 
        ? `Tabell: ${e.headers?.join(', ')} (${e.rows?.length || 0} rader)` 
        : e.quote || e.notes
    }));

    const fullPrompt = `${REASON_PROMPT}\n\nEVIDENS (från ${documentIds.length} dokument):\n${JSON.stringify(evidenceSummary, null, 2)}`;

    // Call Lovable AI with tool calling — upgraded to gemini-2.5-pro with temperature 0.3
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM_BASE },
          { role: 'user', content: fullPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'save_claims',
            description: 'Save generated claims with evidence links, including contradiction detection',
            parameters: {
              type: 'object',
              required: ['claims'],
              properties: {
                claims: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['claim_id', 'type', 'text', 'evidence_ids', 'strength'],
                    properties: {
                      claim_id: { type: 'string' },
                      type: { type: 'string', enum: ['trend', 'gap', 'risk', 'goal', 'action', 'kpi', 'recommendation', 'insight', 'contradiction'] },
                      text: { type: 'string' },
                      evidence_ids: { type: 'array', items: { type: 'string' } },
                      strength: { type: 'string', enum: ['high', 'medium', 'low'] },
                      confidence_score: { type: 'integer', minimum: 0, maximum: 100, description: 'Confidence score 0-100 based on evidence quality and coverage' },
                      explanation: { type: 'string', description: 'Step-by-step reasoning explaining how the claim was derived from evidence' },
                      assumptions: { type: 'array', items: { type: 'string' } },
                      actors: { type: 'array', items: { type: 'string' } },
                      kpi_tags: { type: 'array', items: { type: 'string' } },
                      contradicts_claim_id: { type: 'string', description: 'ID of the claim this contradicts (e.g. C-003)' }
                    }
                  }
                }
              }
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'save_claims' } }
      }),
    });

    const aiData = await aiResponse.json();
    
    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${JSON.stringify(aiData)}`);
    }

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call returned from AI');
    }

    const claims = JSON.parse(toolCall.function.arguments).claims;
    console.log(`💡 Generated ${claims.length} claims`);

    // Count contradictions
    const contradictions = claims.filter((c: any) => c.type === 'contradiction');
    console.log(`⚠️ Found ${contradictions.length} contradictions`);

    // Save claims to database
    const claimsToInsert = claims.map((c: any) => ({
      analysis_session_id: sessionId,
      claim_id: c.claim_id,
      claim_type: c.type,
      text: c.text,
      evidence_ids: c.evidence_ids,
      strength: c.strength,
      confidence_score: c.confidence_score ?? null,
      explanation: c.explanation ?? null,
      assumptions: c.assumptions || [],
      actors: c.actors || [],
      kpi_tags: c.kpi_tags || [],
      notes: c.contradicts_claim_id ? `contradicts:${c.contradicts_claim_id}` : null
    }));

    const { error: insertError } = await supabase
      .from('claims_posts')
      .insert(claimsToInsert);

    if (insertError) throw insertError;

    // Build contradictions summary and save to session critique_results
    const contradictionsSummary = contradictions.map((c: any) => ({
      claim_id: c.claim_id,
      text: c.text,
      contradicts: c.contradicts_claim_id,
      evidence_ids: c.evidence_ids,
      kpi_tags: c.kpi_tags || []
    }));

    // Update session with claims count and contradiction info
    const { error: updateError } = await supabase
      .from('analysis_sessions')
      .update({ 
        claims_count: claims.length,
        status: 'claims_generated',
        critique_results: {
          contradictions_count: contradictions.length,
          contradictions: contradictionsSummary
        }
      })
      .eq('id', sessionId);

    if (updateError) throw updateError;

    console.log(`✅ REASON complete: ${claims.length} claims saved (${contradictions.length} contradictions)`);

    return new Response(JSON.stringify({ 
      success: true, 
      claimsCount: claims.length,
      contradictionsCount: contradictions.length,
      claims 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in reason-claims:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
