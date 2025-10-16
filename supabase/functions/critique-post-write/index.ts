import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { critiquePostWrite } from "../_shared/critiquePostWrite.ts";

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

    const { sessionId, reportMarkdown } = await req.json();

    if (!sessionId || !reportMarkdown) {
      return new Response(JSON.stringify({ error: 'Missing sessionId or reportMarkdown' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🔍 Post-WRITE Critique for session ${sessionId}`);

    // Fetch session to get document IDs
    const { data: session, error: sessionError } = await supabase
      .from('analysis_sessions')
      .select('document_ids')
      .eq('id', sessionId)
      .single();

    if (sessionError) throw sessionError;

    const documentIds = session.document_ids;

    // Fetch all evidence IDs from these documents
    const { data: evidence, error: evidenceError } = await supabase
      .from('evidence_posts')
      .select('evidence_id')
      .in('document_id', documentIds);

    if (evidenceError) throw evidenceError;

    const evidenceIds = new Set((evidence || []).map(e => e.evidence_id));
    console.log(`📊 Validating against ${evidenceIds.size} evidence IDs`);

    // Fetch claims for Executive Summary check
    const { data: claims, error: claimsError } = await supabase
      .from('claims_posts')
      .select('claim_id, strength, evidence_ids')
      .eq('analysis_session_id', sessionId);

    if (claimsError) console.warn('Could not fetch claims:', claimsError);

    // Run post-WRITE critique
    const result = critiquePostWrite({
      reportMarkdown,
      evidenceIds,
      claims: (claims || []).map(c => ({
        id: c.claim_id,
        strength: c.strength as "high" | "medium" | "low",
        evidence_ids: c.evidence_ids
      })),
      requiredCoveragePct: 95
    });

    console.log(`📈 Citation Coverage: ${result.coveragePct.toFixed(1)}%`);
    console.log(`❌ Unknown Evidence IDs: ${result.unknownEvidenceIds.length}`);
    console.log(`⚠️  Low Strength in Exec: ${result.execSummary.lowStrengthEvidenceIds?.length || 0}`);

    // Save critique result
    const { error: saveError } = await supabase
      .from('critique_results')
      .insert({
        session_id: sessionId,
        document_id: documentIds[0],
        phase: 'post_write',
        passed: result.passed,
        citation_coverage: result.coveragePct,
        unknown_evidence_ids: result.unknownEvidenceIds,
        warnings: [
          ...(!result.passed && result.coveragePct < 95 
            ? [`Citation coverage too low: ${result.coveragePct.toFixed(1)}% (requires ≥95%)`]
            : []),
          ...(result.unknownEvidenceIds.length > 0 
            ? [`Unknown evidence IDs: ${result.unknownEvidenceIds.join(', ')}`]
            : []),
          ...(result.execSummary.lowStrengthEvidenceIds && result.execSummary.lowStrengthEvidenceIds.length > 0
            ? [`Executive Summary contains low-strength evidence: ${result.execSummary.lowStrengthEvidenceIds.join(', ')}`]
            : [])
        ]
      });

    if (saveError) {
      console.error('Failed to save critique result:', saveError);
    }

    // Update session if critique failed
    if (!result.passed) {
      const { error: updateError } = await supabase
        .from('analysis_sessions')
        .update({ 
          status: 'critique_failed',
          critique_passed: false
        })
        .eq('id', sessionId);

      if (updateError) console.error('Failed to update session:', updateError);
    }

    console.log(`✅ Post-WRITE Critique ${result.passed ? 'PASSED' : 'FAILED'}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in critique-post-write:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
