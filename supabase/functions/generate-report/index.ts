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

    const { sessionId, format = 'html' } = await req.json();

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from('analysis_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Generating report for session ${sessionId} in ${format} format`);

    // Build HTML report
    const result = session.analysis_result;
    const html = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${session.title} - Analysrapport</title>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 900px;
      margin: 40px auto;
      padding: 20px;
      background: white;
    }
    header {
      border-bottom: 3px solid #0066cc;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    h1 {
      color: #0066cc;
      margin: 0;
      font-size: 2em;
    }
    .meta {
      color: #666;
      font-size: 0.9em;
      margin-top: 10px;
    }
    h2 {
      color: #0066cc;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
      margin-top: 30px;
    }
    h3 {
      color: #444;
      margin-top: 20px;
    }
    .summary {
      background: #f8f9fa;
      padding: 20px;
      border-left: 4px solid #0066cc;
      margin: 20px 0;
    }
    .documents {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .doc-card {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #ddd;
    }
    .doc-card h4 {
      margin: 0 0 5px 0;
      color: #0066cc;
    }
    .keywords {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 15px 0;
    }
    .keyword {
      background: #0066cc;
      color: white;
      padding: 5px 12px;
      border-radius: 15px;
      font-size: 0.85em;
    }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    li:last-child {
      border-bottom: none;
    }
    li::before {
      content: "▸ ";
      color: #0066cc;
      font-weight: bold;
      margin-right: 8px;
    }
    footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #eee;
      text-align: center;
      color: #666;
      font-size: 0.85em;
    }
  </style>
</head>
<body>
  <header>
    <h1>${session.title}</h1>
    <div class="meta">
      <p>Skapad: ${new Date(session.created_at).toLocaleDateString('sv-SE', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}</p>
      <p>Analystyp: ${session.analysis_type}</p>
    </div>
  </header>

  <main>
    ${result.type === 'comparison' ? `
      <section>
        <h2>Sammanfattning</h2>
        <div class="summary">
          <p>${result.summary || 'Ingen sammanfattning tillgänglig'}</p>
        </div>
      </section>

      <section>
        <h2>Dokument som ingår i analysen</h2>
        <div class="documents">
          ${result.documents?.map((doc: any) => `
            <div class="doc-card">
              <h4>${doc.title}</h4>
              <p style="font-size: 0.85em; color: #666;">${doc.file_name}</p>
            </div>
          `).join('') || ''}
        </div>
      </section>

      ${result.key_themes?.length > 0 ? `
        <section>
          <h2>Huvudteman</h2>
          <div class="keywords">
            ${result.key_themes.map((theme: string) => `
              <span class="keyword">${theme}</span>
            `).join('')}
          </div>
        </section>
      ` : ''}

      ${result.similarities?.length > 0 ? `
        <section>
          <h2>Likheter</h2>
          <ul>
            ${result.similarities.map((s: string) => `<li>${s}</li>`).join('')}
          </ul>
        </section>
      ` : ''}

      ${result.differences?.length > 0 ? `
        <section>
          <h2>Skillnader</h2>
          <ul>
            ${result.differences.map((d: string) => `<li>${d}</li>`).join('')}
          </ul>
        </section>
      ` : ''}

      ${result.recommendations?.length > 0 ? `
        <section>
          <h2>Rekommendationer</h2>
          <ul>
            ${result.recommendations.map((r: string) => `<li>${r}</li>`).join('')}
          </ul>
        </section>
      ` : ''}
    ` : `
      <section>
        <h2>Dokumentinformation</h2>
        <div class="doc-card">
          <h4>${result.document?.title}</h4>
          <p style="font-size: 0.85em; color: #666;">${result.document?.file_name}</p>
        </div>
      </section>

      <section>
        <h2>Sammanfattning</h2>
        <div class="summary">
          <p>${result.summary || 'Ingen sammanfattning tillgänglig'}</p>
        </div>
      </section>

      ${result.keywords?.length > 0 ? `
        <section>
          <h2>Nyckelord</h2>
          <div class="keywords">
            ${result.keywords.map((kw: string) => `
              <span class="keyword">${kw}</span>
            `).join('')}
          </div>
        </section>
      ` : ''}

      ${result.key_findings?.length > 0 ? `
        <section>
          <h2>Viktiga fynd</h2>
          <ul>
            ${result.key_findings.map((f: string) => `<li>${f}</li>`).join('')}
          </ul>
        </section>
      ` : ''}

      ${result.recommendations?.length > 0 ? `
        <section>
          <h2>Rekommendationer</h2>
          <ul>
            ${result.recommendations.map((r: string) => `<li>${r}</li>`).join('')}
          </ul>
        </section>
      ` : ''}
    `}
  </main>

  <footer>
    <p>Genererad av GR:s Dokumentanalysverktyg</p>
    <p>© ${new Date().getFullYear()} Alla rättigheter förbehållna</p>
  </footer>
</body>
</html>`;

    // Update session status to completed
    await supabase
      .from('analysis_sessions')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return new Response(JSON.stringify({ 
      html,
      format,
      title: session.title,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-report:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});