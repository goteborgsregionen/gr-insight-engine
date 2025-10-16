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
  "type": "trend|gap|recommendation|insight",
  "text": "IT-budgeten ökade med 12.5% mellan 2023-2024",
  "evidence_ids": ["E-001", "E-023"],
  "strength": "high|medium|low",
  "assumptions": ["Förutsätter att budgeten är inflationsjusterad"],
  "actors": ["IT-avdelningen"],
  "kpi_tags": ["budget", "IT"]
}

STRENGTH RULES:
- "high": Minst 2 oberoende källor (olika evidens-typer eller dokument)
- "medium": 1 stark källa (tabell med fullständig data)
- "low": Härledd från svag evidens eller antaganden

CROSS-DOCUMENT FOCUS:
- Identifiera TRENDER över tid/dokument
- Upptäck MOTSÄGELSER mellan källor
- Markera DATAGAP där information saknas

IMPORTANT:
- Använd save_claims tool för att spara alla claims
- Inkludera evidence_ids[] för varje claim
- Flagga konflikter som "gap" med low strength`;

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

    // Build evidence summary for AI
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

    // Call Lovable AI with tool calling
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_BASE },
          { role: 'user', content: fullPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'save_claims',
            description: 'Save generated claims with evidence links',
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
                      type: { type: 'string', enum: ['trend', 'gap', 'recommendation', 'insight'] },
                      text: { type: 'string' },
                      evidence_ids: { type: 'array', items: { type: 'string' } },
                      strength: { type: 'string', enum: ['high', 'medium', 'low'] },
                      assumptions: { type: 'array', items: { type: 'string' } },
                      actors: { type: 'array', items: { type: 'string' } },
                      kpi_tags: { type: 'array', items: { type: 'string' } }
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

    // Save claims to database
    const claimsToInsert = claims.map((c: any) => ({
      analysis_session_id: sessionId,
      claim_id: c.claim_id,
      claim_type: c.type,
      text: c.text,
      evidence_ids: c.evidence_ids,
      strength: c.strength,
      assumptions: c.assumptions || [],
      actors: c.actors || [],
      kpi_tags: c.kpi_tags || []
    }));

    const { error: insertError } = await supabase
      .from('claims_posts')
      .insert(claimsToInsert);

    if (insertError) throw insertError;

    // Update session
    const { error: updateError } = await supabase
      .from('analysis_sessions')
      .update({ 
        claims_count: claims.length,
        status: 'claims_generated'
      })
      .eq('id', sessionId);

    if (updateError) throw updateError;

    console.log(`✅ REASON complete: ${claims.length} claims saved`);

    return new Response(JSON.stringify({ 
      success: true, 
      claimsCount: claims.length,
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
