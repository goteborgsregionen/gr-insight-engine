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

    const { documentIds, analysisType, customPrompt, title, analysisTemplates, contextTemplateIds } = await req.json();

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

    // Fetch and merge context templates if provided
    let mergedContext: any = {};
    let contextText = '';
    
    if (contextTemplateIds && contextTemplateIds.length > 0) {
      const { data: templates, error: templatesError } = await supabase
        .from('context_templates')
        .select('*')
        .in('id', contextTemplateIds);
      
      if (!templatesError && templates) {
        // Merge contexts
        mergedContext = {
          organization_context: {},
          analysis_guidelines: {
            focus_areas: [],
            quality_criteria: [],
          },
          reference_framework: {
            key_documents: [],
            relevant_policies: [],
          },
          custom_instructions: [],
        };

        templates.forEach((template: any) => {
          const data = template.context_data;
          
          if (data.organization_context) {
            Object.assign(mergedContext.organization_context, data.organization_context);
          }
          
          if (data.analysis_guidelines?.focus_areas) {
            mergedContext.analysis_guidelines.focus_areas.push(...data.analysis_guidelines.focus_areas);
          }
          
          if (data.analysis_guidelines?.quality_criteria) {
            mergedContext.analysis_guidelines.quality_criteria.push(...data.analysis_guidelines.quality_criteria);
          }
          
          if (data.reference_framework?.key_documents) {
            mergedContext.reference_framework.key_documents.push(...data.reference_framework.key_documents);
          }
          
          if (data.custom_instructions) {
            mergedContext.custom_instructions.push(data.custom_instructions);
          }
        });

        // Build context text for prompt
        if (mergedContext.organization_context.name || mergedContext.organization_context.vision) {
          contextText += '\n\nORGANISATIONSKONTEXT:\n';
          if (mergedContext.organization_context.name) {
            contextText += `Organisation: ${mergedContext.organization_context.name}\n`;
          }
          if (mergedContext.organization_context.vision) {
            contextText += `Vision: ${mergedContext.organization_context.vision}\n`;
          }
        }
        
        if (mergedContext.analysis_guidelines.focus_areas.length > 0) {
          contextText += '\nFOKUSOMRÅDEN:\n';
          contextText += mergedContext.analysis_guidelines.focus_areas.map((f: string) => `- ${f}`).join('\n');
          contextText += '\n';
        }
        
        if (mergedContext.custom_instructions.length > 0) {
          contextText += '\nANPASSADE INSTRUKTIONER:\n';
          contextText += mergedContext.custom_instructions.join('\n\n');
        }
      }
    }

    // Build the complete prompt using templates
    let fullPrompt = customPrompt || '';
    
    // If analysisType is strategic, use the full strategic template
    if (analysisType === 'strategic' && analysisTemplates) {
      const strategicTemplate = analysisTemplates.find((t: any) => t.id === 'strategic');
      if (strategicTemplate?.promptModifier) {
        fullPrompt = strategicTemplate.promptModifier + (customPrompt ? `\n\n${customPrompt}` : '');
      }
    } else if (customPrompt) {
      fullPrompt = customPrompt;
    }
    
    // Add context to prompt
    if (contextText) {
      fullPrompt = contextText + '\n\n' + fullPrompt;
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
        custom_prompt: fullPrompt || null,
        analysis_result: initialResult,
        status: 'processing',
        context_template_ids: contextTemplateIds || [],
        merged_context: mergedContext,
        full_prompt_preview: contextText + '\n\n' + fullPrompt,
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