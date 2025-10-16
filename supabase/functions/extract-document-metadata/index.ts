import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to convert ArrayBuffer to base64 without stack overflow
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // 32KB chunks
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document_id } = await req.json();
    
    if (!document_id) {
      return new Response(
        JSON.stringify({ error: 'document_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .single();

    if (docError || !document) {
      console.error('Error fetching document:', docError);
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('documents')
      .download(document.file_path);

    if (downloadError || !fileData) {
      console.error('Error downloading file:', downloadError);
      return new Response(
        JSON.stringify({ error: 'Failed to download document' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert file to base64 for AI processing
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);

    // Call Lovable AI for metadata extraction
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `Du är en expert på att analysera svenska dokument och extrahera metadata. 
Analysera dokumentet och returnera ENDAST ett JSON-objekt (ingen annan text) med följande struktur:
{
  "internal_title": "Dokumentets huvudrubrik eller titel",
  "document_category": "En av: Strategi & Policy, Ekonomi & Budget, Säkerhet & Efterlevnad, Projekt & Handlingsplan, Rapport & Uppföljning, Protokoll & Beslut, Utbildning & Vägledning, Teknisk Dokumentation, Övrigt",
  "tags": ["tag1", "tag2", "tag3"],
  "time_period": "Tidsperiod om nämnd (t.ex. 2024-2025)",
  "organization": "Organisation eller kommun om nämnd"
}

Regler:
- internal_title: Första huvudrubriken i dokumentet
- document_category: Välj EXAKT en av kategorierna ovan
- tags: 3-5 relevanta svenska nyckelord (t.ex. "digitalisering", "IT", "budget")
- time_period: null om ingen period nämns
- organization: null om ingen organisation nämns
- Returnera ENDAST JSON, ingen extra text`
          },
          {
            role: 'user',
            content: [
              { 
                type: 'text', 
                text: `Extrahera metadata från detta PDF-dokument (filnamn: ${document.file_name})` 
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64}`
                }
              }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI processing failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content from AI:', aiData);
      return new Response(
        JSON.stringify({ error: 'No metadata extracted' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse JSON from AI response
    let metadata;
    try {
      // Extract JSON if wrapped in markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      metadata = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content, parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid AI response format' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update document with extracted metadata
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        internal_title: metadata.internal_title || null,
        document_category: metadata.document_category || null,
        tags: metadata.tags || [],
        time_period: metadata.time_period || null,
        organization: metadata.organization || null,
        auto_tagged_at: new Date().toISOString(),
      })
      .eq('id', document_id);

    if (updateError) {
      console.error('Error updating document:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update document' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully extracted metadata for document:', document_id, metadata);

    return new Response(
      JSON.stringify({ 
        success: true, 
        metadata,
        document_id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-document-metadata:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});