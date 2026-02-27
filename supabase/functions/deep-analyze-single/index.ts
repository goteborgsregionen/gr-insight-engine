import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEEP_ANALYSIS_PROMPT = `Du är en senior strategisk rådgivare. Du har fått en initial dokumentanalys och rå evidens (tabeller, citat, nyckeltal).

Skriv nu en FÖRDJUPAD, KRITISK analys som uppfyller följande krav:

## FORMAT & LÄNGD
- Minst 800 ord, strukturerad i markdown
- Varje påstående MÅSTE referera specifika siffror med sidhänvisning

## OBLIGATORISKA SEKTIONER

### 1. Executive Summary (max 150 ord)
- De 3-5 viktigaste insikterna, varje med en specifik siffra
- En övergripande bedömning: Är organisationen på rätt kurs?

### 2. Finansiell Analys
- Alla nyckeltal med föregående års jämförelse och procentuell förändring
- Intäkts- och kostnadsstruktur
- Investeringsnivå och finansiering
- Soliditet, likviditet och andra finansiella mått
- KRITISK BEDÖMNING: Är trenden hållbar? Var finns risker?

### 3. Verksamhetsanalys
- Måluppfyllelse: Vilka mål nåddes/nåddes inte? Med siffror.
- Resursutnyttjande och effektivitet
- Viktiga händelser under perioden

### 4. Strategiska Trender
- Mönster som framträder i datan (minst 3)
- Jämförelse med föregående period
- Hur utvecklingen förhåller sig till uppsatta mål

### 5. Risk- och Sårbarhetsanalys
- Identifierade risker med konsekvensgrad (hög/medel/låg)
- Risker som INTE nämns men borde finnas (datagap)
- Beroenden och sårbarheter

### 6. Rekommendationer
- 5-7 konkreta, handlingsbara rekommendationer
- Prioritetsordning (1=mest brådskande)
- Varje rekommendation kopplad till specifik data

### 7. Datagap och Begränsningar
- Vad saknas i dokumentet som behövs för fullständig bedömning?
- Vilka frågor kvarstår?

## REGLER
- ALDRIG generiska fraser utan data ("stark prestation", "positiv utveckling")
- Varje påstående = siffra + källa
- Var KRITISK — inte bara refererande
- Om data saknas: markera ⚠️ Datagap`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

    console.log(`🔬 Deep analysis for session: ${sessionId}`);

    // Fetch session
    const { data: session, error: sessErr } = await supabase
      .from('analysis_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessErr || !session) throw new Error(`Session not found: ${sessErr?.message}`);

    // Fetch initial analysis results
    const { data: results } = await supabase
      .from('analysis_results')
      .select('*')
      .in('document_id', session.document_ids)
      .eq('is_valid', true);

    if (!results || results.length === 0) {
      throw new Error('No analysis results found for session');
    }

    // Fetch evidence
    const { data: evidence } = await supabase
      .from('evidence_posts')
      .select('*')
      .in('document_id', session.document_ids)
      .order('page', { ascending: true });

    // Build context for deep analysis
    const initialAnalysis = results.map(r => ({
      document_id: r.document_id,
      summary: r.summary,
      keywords: r.keywords,
      markdown_output: r.extracted_data?.markdown_output || '',
      extracted_data: r.extracted_data
    }));

    const evidenceSummary = (evidence || []).map(e => ({
      id: e.evidence_id,
      type: e.type,
      page: e.page,
      section: e.section,
      table_ref: e.table_ref,
      headers: e.headers,
      rows: e.rows,
      quote: e.quote,
      source_loc: e.source_loc,
      unit_notes: e.unit_notes
    }));

    const userContent = `## Initial analys
${JSON.stringify(initialAnalysis, null, 2)}

## Rå evidens (${evidenceSummary.length} poster)
${JSON.stringify(evidenceSummary, null, 2)}

Skriv nu din fördjupade analys enligt instruktionerna.`;

    console.log(`📤 Sending to gemini-2.5-pro (${evidenceSummary.length} evidence posts)...`);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        temperature: 0.3,
        messages: [
          { role: 'system', content: DEEP_ANALYSIS_PROMPT },
          { role: 'user', content: userContent }
        ]
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw new Error(`AI request failed: ${aiResponse.status} - ${errText}`);
    }

    const aiData = await aiResponse.json();
    const deepMarkdown = aiData.choices?.[0]?.message?.content || '';

    if (!deepMarkdown) {
      throw new Error('Empty response from AI');
    }

    console.log(`✅ Deep analysis complete: ${deepMarkdown.length} chars`);

    // Update session with deep analysis
    const currentResult = session.analysis_result || {};
    const updatedResult = {
      ...currentResult,
      full_markdown_output: deepMarkdown,
      deep_analysis_completed: true,
      deep_analysis_at: new Date().toISOString(),
    };

    // Also update the summary with a better one from deep analysis
    // Extract executive summary from the deep markdown
    const execMatch = deepMarkdown.match(/##\s*(?:1\.\s*)?Executive Summary\s*\n([\s\S]*?)(?=\n##|\n###|$)/i);
    if (execMatch) {
      updatedResult.summary = execMatch[1].trim();
    }

    await supabase
      .from('analysis_sessions')
      .update({
        analysis_result: updatedResult,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return new Response(
      JSON.stringify({ success: true, chars: deepMarkdown.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Deep analysis error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
