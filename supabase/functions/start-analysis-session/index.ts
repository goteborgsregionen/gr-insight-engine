import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

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

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { documentIds, analysisType, customPrompt, title } = await req.json();

    if (!documentIds || documentIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No documents provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Starting analysis session for user ${user.id} with ${documentIds.length} documents`);

    // Fetch documents
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id, title, file_name')
      .in('id', documentIds)
      .eq('uploaded_by', user.id);

    if (docsError || !documents || documents.length === 0) {
      return new Response(JSON.stringify({ error: 'Documents not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create session with status 'processing'
    const sessionTitle = title || `Analys av ${documents.length} dokument - ${new Date().toLocaleDateString('sv-SE')}`;
    
    const initialResult = {
      type: documentIds.length > 1 ? 'comparison' : 'single',
      documents: documents.map(doc => ({
        id: doc.id,
        title: doc.title,
        file_name: doc.file_name,
      })),
      summary: `Analyserar ${documents.length} dokument...`,
    };

    const { data: session, error: sessionError } = await supabase
      .from('analysis_sessions')
      .insert({
        user_id: user.id,
        title: sessionTitle,
        document_ids: documentIds,
        analysis_type: analysisType || 'standard',
        custom_prompt: customPrompt,
        analysis_result: initialResult,
        status: 'processing',
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      return new Response(JSON.stringify({ error: 'Failed to create session' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Analysis session created: ${session.id} (status: processing)`);

    // Add documents to analysis queue
    console.log(`Adding ${documentIds.length} documents to analysis queue...`);
    for (const docId of documentIds) {
      const { error: queueError } = await supabase
        .from('analysis_queue')
        .insert({
          user_id: user.id,
          document_id: docId,
          status: 'pending',
          priority: 10,
        });

      if (queueError) {
        console.error('Error adding to queue:', queueError);
      }
    }

    // Trigger process-analysis-queue in background
    console.log('Triggering process-analysis-queue...');
    supabase.functions.invoke('process-analysis-queue').then(() => {
      console.log('Queue processing triggered');
    }).catch((err) => {
      console.error('Failed to trigger queue processing:', err);
    });

    return new Response(JSON.stringify({ 
      sessionId: session.id,
      session,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in start-analysis-session:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});