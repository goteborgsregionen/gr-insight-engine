import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 5;
const MAX_ATTEMPTS = 3;
const ANALYSIS_TIMEOUT = 120000; // 120 seconds

// Wrapper function to add timeout to analyze-document calls
async function analyzeWithTimeout(supabase: any, docId: string, timeout = ANALYSIS_TIMEOUT) {
  return Promise.race([
    supabase.functions.invoke('analyze-document', { body: { documentId: docId } }),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Analysis timeout - exceeded 120 seconds')), timeout)
    )
  ]);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing analysis queue...');

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
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('No pending items in queue');
      return new Response(
        JSON.stringify({ message: 'No pending items', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${queueItems.length} queue items...`);

    const results = await Promise.allSettled(
      queueItems.map(async (item: any) => {
        try {
          // Update status to processing
          await supabase
            .from('analysis_queue')
            .update({ 
              status: 'processing',
              attempts: item.attempts + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);

          // Analyze document with timeout
          const { data, error } = await analyzeWithTimeout(supabase, item.document_id);

          if (error) throw error;

          // Update status to completed
          await supabase
            .from('analysis_queue')
            .update({ 
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);

          console.log(`Queue item ${item.id} completed successfully`);
          return { success: true, id: item.id };
        } catch (error) {
          console.error(`Queue item ${item.id} failed:`, error);
          
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const isTimeout = errorMessage.includes('timeout');
          
          // Update with error - always increment attempts
          const newAttempts = item.attempts + 1;
          const newStatus = newAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
          
          await supabase
            .from('analysis_queue')
            .update({ 
              status: newStatus,
              attempts: newAttempts,
              error_message: isTimeout ? `Timeout after 120s (attempt ${newAttempts}/${MAX_ATTEMPTS})` : errorMessage,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);

          console.log(`Queue item ${item.id} marked as ${newStatus} (attempts: ${newAttempts}/${MAX_ATTEMPTS})`);
          return { success: false, id: item.id, error: errorMessage };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value.success).length;

    console.log(`Queue processing complete: ${successful} successful, ${failed} failed`);

    // After processing, check if any sessions are now complete and need aggregation
    try {
      const processedDocIds = results
        .filter((r): r is PromiseFulfilledResult<{ success: boolean; id: any; error?: string }> => 
          r.status === 'fulfilled' && r.value.success
        )
        .map(r => r.value.id)
        .filter(Boolean);

      if (processedDocIds.length > 0) {
        console.log('Checking for completed sessions...');
        
        // Find analysis sessions that contain these documents
        const { data: sessions, error: sessionsError } = await supabase
          .from('analysis_sessions')
          .select('*')
          .eq('status', 'processing');

        if (!sessionsError && sessions) {
          for (const session of sessions) {
            // Check if session contains any of the processed documents
            const hasProcessedDocs = session.document_ids.some((id: string) => 
              queueItems.some(qi => qi.document_id === id)
            );

            if (!hasProcessedDocs) continue;

            // Check if all documents in the session are analyzed
            const { data: sessionQueue, error: queueError } = await supabase
              .from('analysis_queue')
              .select('status')
              .in('document_id', session.document_ids);

            if (!queueError && sessionQueue) {
              const allCompleted = sessionQueue.every((q: any) => q.status === 'completed');
              const anyFailed = sessionQueue.some((q: any) => q.status === 'failed');

              if (allCompleted && session.analysis_type === 'strategic') {
                // Trigger strategic aggregation
                console.log(`All documents completed for session ${session.id}, triggering strategic aggregation`);
                
                const { error: aggregateError } = await supabase.functions.invoke(
                  'aggregate-strategic-analysis',
                  {
                    body: { sessionId: session.id }
                  }
                );

                if (aggregateError) {
                  console.error(`Failed to trigger aggregation for session ${session.id}:`, aggregateError);
                } else {
                  console.log(`Strategic aggregation triggered for session ${session.id}`);
                }
              } else if (allCompleted || (anyFailed && sessionQueue.filter((q: any) => q.status === 'completed').length > 0)) {
                // For non-strategic analysis or partial completion, mark as completed
                console.log(`Marking session ${session.id} as completed (non-strategic or partial)`);
                
                const { data: results } = await supabase
                  .from('analysis_results')
                  .select('*')
                  .in('document_id', session.document_ids);

                const aggregatedResult = {
                  type: session.document_ids.length > 1 ? 'comparison' : 'single',
                  documents: session.document_ids,
                  results: results || [],
                  summary: results?.[0]?.summary || '',
                  keywords: [...new Set(results?.flatMap((r: any) => r.keywords || []))],
                  completed_at: new Date().toISOString(),
                  partial: anyFailed,
                  failed_count: sessionQueue.filter((q: any) => q.status === 'failed').length,
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
                  .eq('id', session.id);
              }
            }
          }
        }
      }
    } catch (aggregationError) {
      console.error('Error during session aggregation check:', aggregationError);
      // Don't fail the whole function if aggregation check fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful,
        failed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-analysis-queue function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});