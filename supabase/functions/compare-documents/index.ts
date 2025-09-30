import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 5; // Analyze max 5 documents in parallel
const MAX_RETRIES = 2;
const RETRY_DELAY = 2000;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function analyzeDocumentWithRetry(
  supabase: any,
  docId: string,
  attempt = 0
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Analyzing document ${docId} (attempt ${attempt + 1}/${MAX_RETRIES + 1})`);
    
    const analyzeResponse = await supabase.functions.invoke('analyze-document', {
      body: { documentId: docId },
    });
    
    if (analyzeResponse.error) {
      throw analyzeResponse.error;
    }
    
    console.log(`Document ${docId} analyzed successfully`);
    return { success: true };
  } catch (error) {
    console.error(`Failed to analyze document ${docId} (attempt ${attempt + 1}):`, error);
    
    if (attempt < MAX_RETRIES) {
      await sleep(RETRY_DELAY * (attempt + 1)); // Exponential backoff
      return analyzeDocumentWithRetry(supabase, docId, attempt + 1);
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentIds } = await req.json();
    console.log('Comparing documents:', documentIds);

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length < 2) {
      return new Response(
        JSON.stringify({ error: 'At least 2 document IDs are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth user ID from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check which documents are already analyzed
    const { data: existingAnalyses } = await supabase
      .from('analysis_results')
      .select('document_id')
      .in('document_id', documentIds)
      .eq('is_valid', true);
    
    const analyzedDocIds = new Set(existingAnalyses?.map((a: any) => a.document_id) || []);
    const unanalyzedDocIds = documentIds.filter((id: string) => !analyzedDocIds.has(id));

    // Analyze unanalyzed documents in batches
    if (unanalyzedDocIds.length > 0) {
      console.log(`Analyzing ${unanalyzedDocIds.length} unanalyzed documents in batches of ${BATCH_SIZE}...`);
      
      const batches = [];
      for (let i = 0; i < unanalyzedDocIds.length; i += BATCH_SIZE) {
        batches.push(unanalyzedDocIds.slice(i, i + BATCH_SIZE));
      }
      
      for (const [batchIndex, batch] of batches.entries()) {
        console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} documents)`);
        
        const results = await Promise.allSettled(
          batch.map(docId => analyzeDocumentWithRetry(supabase, docId))
        );
        
        const failed = results.filter(r => r.status === 'rejected' || !r.value.success);
        if (failed.length > 0) {
          console.error(`${failed.length} documents failed to analyze in batch ${batchIndex + 1}`);
          return new Response(
            JSON.stringify({ 
              error: `Failed to analyze ${failed.length} documents. Please try again with fewer documents.` 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Add delay between batches to avoid rate limiting
        if (batchIndex < batches.length - 1) {
          await sleep(1000);
        }
      }
    }

    // Fetch analyses for all documents
    const { data: analyses, error: analysisError } = await supabase
      .from('analysis_results')
      .select(`
        id,
        document_id,
        summary,
        keywords,
        extracted_data,
        analyzed_at,
        documents!inner(file_name, file_type, uploaded_at)
      `)
      .in('document_id', documentIds)
      .eq('is_valid', true);

    if (analysisError) {
      console.error('Failed to fetch analyses:', analysisError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch document analyses' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!analyses || analyses.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid analyses found for the specified documents' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${analyses.length} analyses to compare`);

    // Prepare optimized comparison prompt
    const comparisonPrompt = `Jämför ${analyses.length} dokument. Ge koncis komparativ analys.

DOKUMENT:
${analyses.map((a: any, idx: number) => `
${idx + 1}. ${a.documents.file_name}
Sammanfattning: ${a.summary.substring(0, 500)}
Nyckelord: ${a.keywords?.slice(0, 10).join(', ') || 'Inga'}
`).join('\n')}

Returnera JSON:

{
  "comparison_summary": "Övergripande jämförelse (150-200 ord)",
  "commonalities": {
    "shared_themes": ["gemensamma teman"],
    "shared_keywords": ["gemensamma nyckelord"],
    "shared_actors": ["gemensamma aktörer"],
    "consistent_priorities": ["konsekventa prioriteringar"]
  },
  "differences": {
    "unique_themes": [{"document": "namn", "themes": ["unika teman"]}],
    "diverging_priorities": ["skilda prioriteringar"],
    "conflicting_information": ["motsägelser"]
  },
  "similarity_matrix": [
    {"document_pair": "Dok 1 vs Dok 2", "similarity_score": 0.75, "similarity_reasoning": "kort förklaring"}
  ],
  "key_insights": ["3-5 viktiga insikter"],
  "recommendations": ["2-3 rekommendationer"]
}`;

    console.log('Sending comparison request to Lovable AI...');

    // Call Lovable AI with rate limiting
    let aiResponse: Response | undefined;
    let retries = 0;
    
    while (retries <= MAX_RETRIES) {
      aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: 'Du är expert på komparativ analys. Svara i JSON-format, koncist och strukturerat.'
            },
            {
              role: 'user',
              content: comparisonPrompt
            }
          ],
          temperature: 0.2,
        }),
      });

      if (aiResponse.status === 429 && retries < MAX_RETRIES) {
        console.log(`Rate limited, retrying in ${RETRY_DELAY * (retries + 1)}ms...`);
        await sleep(RETRY_DELAY * (retries + 1));
        retries++;
        continue;
      }
      
      break;
    }

    if (!aiResponse || !aiResponse.ok) {
      const status = aiResponse?.status || 500;
      const errorText = aiResponse ? await aiResponse.text() : 'No response from AI';
      console.error('AI API error:', status, errorText);
      
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'AI comparison failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    console.log('AI comparison response received');

    let comparisonResult;
    try {
      const contentText = aiData.choices[0].message.content;
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        comparisonResult = JSON.parse(jsonMatch[0]);
      } else {
        comparisonResult = JSON.parse(contentText);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      comparisonResult = {
        comparison_summary: aiData.choices[0].message.content,
        error: 'Failed to parse structured comparison'
      };
    }

    console.log('Saving comparison result to database...');

    // Get user ID from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('Failed to get user:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save comparison result to database
    const { data: savedComparison, error: saveError } = await supabase
      .from('comparative_analysis')
      .insert({
        user_id: user.id,
        document_ids: documentIds,
        comparison_result: comparisonResult,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save comparison:', saveError);
      return new Response(
        JSON.stringify({ error: 'Failed to save comparison' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Comparison complete:', savedComparison.id);

    return new Response(
      JSON.stringify({
        success: true,
        comparison: savedComparison
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in compare-documents function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});