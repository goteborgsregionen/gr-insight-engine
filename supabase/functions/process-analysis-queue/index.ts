import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 5;
const MAX_ATTEMPTS = 3;

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

          // Analyze document
          const { data, error } = await supabase.functions.invoke('analyze-document', {
            body: { documentId: item.document_id },
          });

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
          
          // Update with error
          const newAttempts = item.attempts + 1;
          const newStatus = newAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
          
          await supabase
            .from('analysis_queue')
            .update({ 
              status: newStatus,
              error_message: errorMessage,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);

          return { success: false, id: item.id, error: errorMessage };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value.success).length;

    console.log(`Queue processing complete: ${successful} successful, ${failed} failed`);

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