import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 5;
const MAX_ATTEMPTS = 3;
const STEP_TIMEOUT = 300000; // 300 seconds per step

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function invokeWithTimeout(
  supabase: any,
  fnName: string,
  body: Record<string, unknown>,
  timeout = STEP_TIMEOUT,
) {
  return Promise.race([
    supabase.functions.invoke(fnName, { body }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${fnName} timeout after ${timeout / 1000}s`)), timeout)
    ),
  ]);
}

async function updateSessionStatus(supabase: any, sessionId: string, status: string) {
  await supabase
    .from('analysis_sessions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', sessionId);
}

// ---------------------------------------------------------------------------
// Per-document pipeline: analyze → extract-evidence
// ---------------------------------------------------------------------------

async function processDocument(supabase: any, item: any) {
  // Mark as processing
  await supabase
    .from('analysis_queue')
    .update({
      status: 'processing',
      attempts: item.attempts + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', item.id);

  // Step 1: analyze-document
  console.log(`[${item.document_id}] Step 1: analyze-document`);
  const { error: analyzeErr } = await invokeWithTimeout(supabase, 'analyze-document', {
    documentId: item.document_id,
  });
  if (analyzeErr) throw analyzeErr;

  // Step 2: extract-evidence (skip if already extracted)
  const { data: doc } = await supabase
    .from('documents')
    .select('evidence_extracted')
    .eq('id', item.document_id)
    .single();

  if (doc?.evidence_extracted) {
    console.log(`[${item.document_id}] Step 2: extract-evidence SKIPPED (already extracted)`);
  } else {
    console.log(`[${item.document_id}] Step 2: extract-evidence`);
    try {
      const { error: extractErr } = await invokeWithTimeout(supabase, 'extract-evidence', {
        documentId: item.document_id,
      });
      if (extractErr) {
        console.warn(`[${item.document_id}] extract-evidence failed (non-fatal):`, extractErr);
      }
    } catch (err) {
      console.warn(`[${item.document_id}] extract-evidence error (non-fatal):`, err);
    }
  }

  // Mark queue item completed
  await supabase
    .from('analysis_queue')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', item.id);

  console.log(`[${item.document_id}] Document pipeline complete`);
  return { success: true, id: item.id, document_id: item.document_id };
}

// ---------------------------------------------------------------------------
// Per-session pipeline: reason-claims → critique → aggregate
// ---------------------------------------------------------------------------

async function runSessionPipeline(supabase: any, session: any, completedDocIds: string[]) {
  const sessionId = session.id;
  console.log(`[session:${sessionId}] Starting session-level ERCW pipeline`);

  // Step 3: reason-claims
  try {
    await updateSessionStatus(supabase, sessionId, 'reasoning_claims');
    console.log(`[session:${sessionId}] Step 3: reason-claims`);
    const { error: reasonErr } = await invokeWithTimeout(supabase, 'reason-claims', {
      sessionId,
      documentIds: completedDocIds,
    });
    if (reasonErr) {
      console.warn(`[session:${sessionId}] reason-claims failed (non-fatal):`, reasonErr);
    }
  } catch (err) {
    console.warn(`[session:${sessionId}] reason-claims error (non-fatal):`, err);
  }

  // Step 4: critique-pre-write
  try {
    await updateSessionStatus(supabase, sessionId, 'critiquing');
    console.log(`[session:${sessionId}] Step 4: critique-pre-write`);
    const { data: critiqueData, error: critiqueErr } = await invokeWithTimeout(
      supabase,
      'critique-pre-write',
      { sessionId, documentIds: completedDocIds },
    );
    if (critiqueErr) {
      console.warn(`[session:${sessionId}] critique-pre-write failed (non-fatal):`, critiqueErr);
    } else if (critiqueData) {
      // Save critique results on session
      await supabase
        .from('analysis_sessions')
        .update({
          critique_passed: critiqueData.passed ?? false,
          critique_results: critiqueData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
    }
  } catch (err) {
    console.warn(`[session:${sessionId}] critique-pre-write error (non-fatal):`, err);
  }

  // Step 5: aggregation
  await updateSessionStatus(supabase, sessionId, 'aggregating');

  if (session.analysis_type === 'strategic') {
    console.log(`[session:${sessionId}] Step 5: aggregate-strategic-analysis`);
    const { error: aggErr } = await invokeWithTimeout(
      supabase,
      'aggregate-strategic-analysis',
      { sessionId },
    );
    if (aggErr) {
      console.error(`[session:${sessionId}] aggregate-strategic-analysis failed:`, aggErr);
    } else {
      console.log(`[session:${sessionId}] Strategic aggregation complete`);
    }
  } else {
    // Standard aggregation – collect results and mark complete
    console.log(`[session:${sessionId}] Step 5: standard aggregation`);
    const { data: results } = await supabase
      .from('analysis_results')
      .select('*')
      .in('document_id', completedDocIds);

    const aggregatedResult = {
      type: completedDocIds.length > 1 ? 'comparison' : 'single',
      documents: completedDocIds,
      results: results || [],
      summary: results?.[0]?.summary || '',
      keywords: [...new Set(results?.flatMap((r: any) => r.keywords || []))],
      completed_at: new Date().toISOString(),
      completed_count: results?.length || 0,
      total_count: session.document_ids.length,
    };

    await supabase
      .from('analysis_sessions')
      .update({
        status: 'completed',
        analysis_result: aggregatedResult,
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing analysis queue (ERCW pipeline)...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch pending queue items
    const { data: queueItems, error: fetchError } = await supabase
      .from('analysis_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', MAX_ATTEMPTS)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('Failed to fetch queue items:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch queue' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending items', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`Processing ${queueItems.length} queue items...`);

    // --- Per-document pipeline (parallel across documents) ---
    const docResults = await Promise.allSettled(
      queueItems.map(async (item: any) => {
        try {
          return await processDocument(supabase, item);
        } catch (error) {
          console.error(`Queue item ${item.id} failed:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const newAttempts = item.attempts + 1;
          const newStatus = newAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending';

          await supabase
            .from('analysis_queue')
            .update({
              status: newStatus,
              attempts: newAttempts,
              error_message: errorMessage,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          return { success: false, id: item.id, document_id: item.document_id, error: errorMessage };
        }
      }),
    );

    const successful = docResults.filter(
      (r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<any>).value?.success,
    ).length;
    const failed = docResults.length - successful;

    console.log(`Document pipeline: ${successful} ok, ${failed} failed`);

    // --- Session-level pipeline (reason → critique → aggregate) ---
    if (successful > 0) {
      // Find sessions that contain the processed documents
      const processedDocIds = queueItems.map((qi: any) => qi.document_id);

      const { data: sessions } = await supabase
        .from('analysis_sessions')
        .select('*')
        .eq('status', 'processing');

      if (sessions) {
        for (const session of sessions) {
          const hasProcessedDocs = session.document_ids.some((id: string) =>
            processedDocIds.includes(id),
          );
          if (!hasProcessedDocs) continue;

          // Check if ALL documents in this session are now completed
          const { data: sessionQueue } = await supabase
            .from('analysis_queue')
            .select('status, document_id')
            .in('document_id', session.document_ids);

          if (!sessionQueue) continue;

          const allCompleted = sessionQueue.every((q: any) => q.status === 'completed');
          if (!allCompleted) {
            console.log(`[session:${session.id}] Not all docs completed yet, skipping session pipeline`);
            continue;
          }

          const completedDocIds = sessionQueue
            .filter((q: any) => q.status === 'completed')
            .map((q: any) => q.document_id);

          try {
            await runSessionPipeline(supabase, session, completedDocIds);
          } catch (err) {
            console.error(`[session:${session.id}] Session pipeline failed:`, err);
            await updateSessionStatus(supabase, session.id, 'failed');
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: docResults.length, successful, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in process-analysis-queue:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
