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

    // Get analysis results for these documents
    const { data: analysisResults, error: analysisError } = await supabase
      .from('analysis_results')
      .select('*')
      .in('document_id', documentIds);

    if (analysisError) {
      console.error('Error fetching analysis results:', analysisError);
      return new Response(JSON.stringify({ error: 'Failed to fetch analysis results' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build analysis result based on type
    let analysisResult: any = {};

    if (documentIds.length > 1) {
      // Multi-document comparison
      analysisResult = {
        type: 'comparison',
        documents: documents.map(doc => ({
          id: doc.id,
          title: doc.title,
          file_name: doc.file_name,
        })),
        summary: `Jämförelse av ${documents.length} dokument med ${analysisType} perspektiv`,
        similarities: [],
        differences: [],
        key_themes: [],
        recommendations: [],
      };

      // Extract data from analysis results
      if (analysisResults && analysisResults.length > 0) {
        const allKeywords = analysisResults.flatMap(r => r.keywords || []);
        const uniqueKeywords = [...new Set(allKeywords)];
        analysisResult.key_themes = uniqueKeywords.slice(0, 10);

        const allSummaries = analysisResults.map(r => r.summary).filter(Boolean);
        if (allSummaries.length > 0) {
          analysisResult.summary = `Analysen omfattar ${documents.length} dokument. ${allSummaries[0]}`;
        }
      }
    } else {
      // Single document analysis
      const docAnalysis = analysisResults?.find(r => r.document_id === documentIds[0]);
      analysisResult = {
        type: 'single',
        document: {
          id: documents[0].id,
          title: documents[0].title,
          file_name: documents[0].file_name,
        },
        summary: docAnalysis?.summary || 'Ingen analys tillgänglig',
        keywords: docAnalysis?.keywords || [],
        extracted_data: docAnalysis?.extracted_data || {},
        key_findings: [],
        recommendations: [],
      };
    }

    // Create session
    const sessionTitle = title || `Analys av ${documents.length} dokument - ${new Date().toLocaleDateString('sv-SE')}`;
    
    const { data: session, error: sessionError } = await supabase
      .from('analysis_sessions')
      .insert({
        user_id: user.id,
        title: sessionTitle,
        document_ids: documentIds,
        analysis_type: analysisType || 'standard',
        custom_prompt: customPrompt,
        analysis_result: analysisResult,
        status: 'draft',
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

    console.log(`Analysis session created: ${session.id}`);

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