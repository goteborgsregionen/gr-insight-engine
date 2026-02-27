import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_BASE = `ROLE: Du är en policyanalytiker som arbetar evidence-first.
PRIMARY OBJECTIVE: Leverera beslutbara slutsatser ENDAST från citerad evidens (sidnr/tabell).
STYLE: Professionell, tvärsektoriell; skriv på svenska; undvik generiska fraser.
GUARDRAILS:
- Gör inga antaganden utanför dokument.
- Om data saknas: markera "⚠︎ Datagap" och föreslå hur det kan åtgärdas.
- Inga meningar utan evidens i WRITE-pass.
OUTPUT CONTRACT: Följ EXAKT de givna JSON/Markdown-strukturerna.`;

const EXTRACT_PROMPT = `TASK: EXTRACT — Extrahera verifierbar evidens från dokument.
FOCUS: Tabeller, nyckeltal, citat, aktörer, tidsperiod, mål, åtgärder.

EVIDENCE FORMAT (JSON array, ett objekt per evidens):
{ 
  "id":"E-###", 
  "type":"table|quote|number|figure|section",
  "page":12, 
  "section":"3.2 Budget", 
  "table_ref":"Tabell 3",
  "headers":["År","IT-budget (MSEK)"], 
  "rows":[["2023","40"],["2024","45"]],
  "quote":"(om type=quote) 'Kommunen prioriterar…'",
  "unit_notes":"MSEK, %", 
  "notes":"Fotnot A",
  "source_loc":"p.12, Tabell 3" 
}

RULES:
- Bevara siffror och enheter exakt (MSEK, %, mdr, t, kWh).
- Normalisera decimalseparator till punkt internt (12,5% → 12.5%), men behåll originalsträngen i notes.
- För figurer/diagram, inkludera caption och axlar/mått i notes.
- Om möjligt, lägg till cirka-koordinater (x1,y1,x2,y2) för klickbar källa i UI (valfritt).
- Citat max 40 ord, ordagrant, med page/source_loc.
- Ingen tolkning, inga slutsatser.
- Om tabell > 20 rader: ta första 10 + sista 10 och markera om hur många rader som utelämnas.
- Numrera evidens sekventiellt: E-001, E-002, E-003...
- Varje evidens MÅSTE ha minst: id, type, page, source_loc`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Clone body before reading so error handler can't hit "Body already consumed"
  const bodyText = await req.text();
  let documentId: string | undefined;

  try {
    const startTime = Date.now();
    const parsed = JSON.parse(bodyText);
    documentId = parsed.documentId;

    if (!documentId) {
      throw new Error('documentId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📄 Starting evidence extraction for document:', documentId);

    await supabase
      .from('documents')
      .update({ status: 'extracting_evidence' })
      .eq('id', documentId);

    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error(`Document not found: ${docError?.message}`);
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.file_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Content = btoa(binaryString);

    console.log('📤 Sending to Lovable AI for extraction...');

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        temperature: 0.1,
        messages: [
          { role: 'system', content: SYSTEM_BASE },
          {
            role: 'user',
            content: [
              { type: 'text', text: EXTRACT_PROMPT },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64Content}`
                }
              }
            ]
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'save_evidence',
            description: 'Save extracted evidence posts',
            parameters: {
              type: 'object',
              required: ['evidence_posts'],
              properties: {
                evidence_posts: {
                  type: 'array',
                  description: 'Array of evidence objects',
                  items: {
                    type: 'object',
                    required: ['id', 'type', 'page', 'source_loc'],
                    properties: {
                      id: { type: 'string', pattern: '^E-\\d{3,}$' },
                      type: { type: 'string', enum: ['table', 'quote', 'number', 'figure', 'section'] },
                      page: { type: 'integer', minimum: 1 },
                      section: { type: 'string' },
                      table_ref: { type: 'string' },
                      headers: { type: 'array', items: { type: 'string' } },
                      rows: { type: 'array' },
                      quote: { type: 'string', maxLength: 400 },
                      unit_notes: { type: 'string' },
                      notes: { type: 'string' },
                      source_loc: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'save_evidence' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI extraction failed: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    console.log('✅ AI extraction completed');

    // Robust parsing: handle tool_calls or fallback to content
    let evidencePosts: any[] = [];

    if (aiData.choices?.[0]?.message?.tool_calls?.[0]) {
      const toolCall = aiData.choices[0].message.tool_calls[0];
      evidencePosts = JSON.parse(toolCall.function.arguments).evidence_posts;
      console.log(`📊 Parsed ${evidencePosts.length} evidence via tool_calls`);
    } else if (aiData.choices?.[0]?.message?.content) {
      // Fallback: parse JSON from content text
      const content = aiData.choices[0].message.content;
      console.log('⚠️ No tool_calls found, trying content fallback');
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          evidencePosts = JSON.parse(jsonMatch[0]);
        } else {
          const objMatch = content.match(/\{[\s\S]*"evidence_posts"[\s\S]*\}/);
          if (objMatch) {
            evidencePosts = JSON.parse(objMatch[0]).evidence_posts || [];
          }
        }
        console.log(`📊 Parsed ${evidencePosts.length} evidence via content fallback`);
      } catch (parseErr) {
        console.error('Failed to parse content fallback:', parseErr);
        console.error('Content preview:', content.substring(0, 500));
      }
    } else {
      console.error('❌ Unexpected AI response structure:', JSON.stringify(aiData).substring(0, 1000));
      throw new Error('AI response missing both tool_calls and content');
    }

    if (evidencePosts.length === 0) {
      console.warn('⚠️ No evidence posts extracted');
    }

    // Save to database
    if (evidencePosts.length > 0) {
      const evidenceRecords = evidencePosts.map((evidence: any) => ({
        document_id: documentId,
        evidence_id: evidence.id,
        type: evidence.type,
        page: evidence.page,
        section: evidence.section,
        table_ref: evidence.table_ref,
        headers: evidence.headers,
        rows: evidence.rows,
        quote: evidence.quote,
        unit_notes: evidence.unit_notes,
        notes: evidence.notes,
        source_loc: evidence.source_loc
      }));

      const { error: saveError } = await supabase
        .from('evidence_posts')
        .insert(evidenceRecords);

      if (saveError) {
        throw new Error(`Failed to save evidence: ${saveError.message}`);
      }
    }

    await supabase
      .from('documents')
      .update({
        status: 'evidence_extracted',
        evidence_extracted: true,
        evidence_count: evidencePosts.length,
        extraction_completed_at: new Date().toISOString()
      })
      .eq('id', documentId);

    console.log('✅ Evidence extraction completed successfully');

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    await supabase
      .from('extraction_metrics')
      .insert({
        document_id: documentId,
        duration_ms: durationMs,
        evidence_count: evidencePosts.length,
        file_size_bytes: arrayBuffer.byteLength,
        model: 'google/gemini-2.5-flash',
        created_at: new Date().toISOString()
      });

    console.log(`📊 Metrics: ${durationMs}ms, ${evidencePosts.length} evidence, ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`);

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        evidenceCount: evidencePosts.length,
        metrics: { durationMs, fileSizeBytes: arrayBuffer.byteLength }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Evidence extraction error:', error);
    
    if (documentId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase
          .from('documents')
          .update({ status: 'extraction_failed' })
          .eq('id', documentId);
      } catch (e) {
        console.error('Failed to update error status:', e);
      }
    }

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
