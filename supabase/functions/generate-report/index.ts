import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { marked } from "https://esm.sh/marked@11.1.1";

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

    // Configure marked for better table rendering
    marked.setOptions({
      gfm: true,
      breaks: true,
    });

    // Build HTML report
    const result = session.analysis_result;
    
    // Convert full markdown output to HTML
    let contentHtml = '';
    if (result.full_markdown_output) {
      contentHtml = marked.parse(result.full_markdown_output);
    } else {
      // Fallback to old structure if full_markdown_output is missing
      contentHtml = `<p>${result.summary || 'Ingen analys tillgänglig'}</p>`;
    }

    // Base64 encode GR logo (black version for print/light background)
    const grLogoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    const html = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${session.title} - Analysrapport</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    @media print {
      body { 
        margin: 0;
        padding: 20mm;
      }
      .no-print { display: none; }
      header { page-break-after: avoid; }
      h2 { page-break-after: avoid; }
      table { page-break-inside: avoid; }
      @page {
        margin: 20mm;
        @bottom-right {
          content: "Sida " counter(page) " av " counter(pages);
        }
      }
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.7;
      color: #1a1a1a;
      max-width: 1000px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #ffffff;
    }
    
    /* GR Brand Colors */
    :root {
      --gr-primary: #000000;
      --gr-accent: #0066cc;
      --gr-gray-100: #f8f9fa;
      --gr-gray-200: #e9ecef;
      --gr-gray-300: #dee2e6;
      --gr-gray-600: #6c757d;
      --gr-gray-900: #1a1a1a;
    }
    
    /* Header with GR Logo */
    header {
      border-bottom: 3px solid var(--gr-primary);
      padding-bottom: 30px;
      margin-bottom: 50px;
      position: relative;
    }
    
    .logo {
      max-width: 200px;
      height: auto;
      margin-bottom: 30px;
    }
    
    h1 {
      color: var(--gr-primary);
      margin: 0 0 15px 0;
      font-size: 2.5em;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.2;
    }
    
    .meta {
      color: var(--gr-gray-600);
      font-size: 0.95em;
      margin-top: 15px;
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }
    
    .meta p {
      margin: 0;
    }
    
    /* Typography */
    h2 {
      color: var(--gr-primary);
      border-bottom: 2px solid var(--gr-gray-200);
      padding-bottom: 12px;
      margin-top: 50px;
      margin-bottom: 25px;
      font-size: 1.8em;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    
    h3 {
      color: var(--gr-gray-900);
      margin-top: 30px;
      margin-bottom: 15px;
      font-size: 1.4em;
      font-weight: 600;
    }
    
    h4 {
      color: var(--gr-gray-900);
      margin-top: 25px;
      margin-bottom: 12px;
      font-size: 1.15em;
      font-weight: 600;
    }
    
    p {
      margin: 0 0 15px 0;
    }
    
    /* Content sections */
    main {
      margin-bottom: 60px;
    }
    
    /* Lists */
    ul, ol {
      margin: 15px 0;
      padding-left: 25px;
    }
    
    li {
      margin-bottom: 10px;
      line-height: 1.7;
    }
    
    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 25px 0;
      font-size: 0.95em;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    
    thead tr {
      background-color: var(--gr-primary);
      color: white;
      text-align: left;
      font-weight: 600;
    }
    
    th, td {
      padding: 14px 16px;
      border: 1px solid var(--gr-gray-300);
    }
    
    tbody tr {
      border-bottom: 1px solid var(--gr-gray-300);
    }
    
    tbody tr:nth-of-type(even) {
      background-color: var(--gr-gray-100);
    }
    
    tbody tr:hover {
      background-color: #e3f2fd;
    }
    
    /* Code blocks */
    code {
      background: var(--gr-gray-100);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    
    pre {
      background: var(--gr-gray-100);
      padding: 15px;
      border-radius: 6px;
      overflow-x: auto;
      border-left: 4px solid var(--gr-accent);
    }
    
    pre code {
      background: none;
      padding: 0;
    }
    
    /* Blockquotes */
    blockquote {
      background: var(--gr-gray-100);
      border-left: 4px solid var(--gr-accent);
      margin: 20px 0;
      padding: 15px 20px;
      font-style: italic;
      color: var(--gr-gray-900);
    }
    
    /* Links */
    a {
      color: var(--gr-accent);
      text-decoration: none;
      border-bottom: 1px solid transparent;
      transition: border-color 0.2s;
    }
    
    a:hover {
      border-bottom-color: var(--gr-accent);
    }
    
    /* Horizontal rules */
    hr {
      border: none;
      border-top: 2px solid var(--gr-gray-200);
      margin: 40px 0;
    }
    
    /* Footer */
    footer {
      margin-top: 60px;
      padding-top: 30px;
      border-top: 2px solid var(--gr-gray-200);
      text-align: center;
      color: var(--gr-gray-600);
      font-size: 0.9em;
    }
    
    footer p {
      margin: 5px 0;
    }
    
    /* Utility classes */
    .text-center { text-align: center; }
    .mt-4 { margin-top: 40px; }
    .mb-4 { margin-bottom: 40px; }
  </style>
</head>
<body>
  <header>
    <img src="/logo-horizontal-black.png" alt="GR Logo" class="logo no-print" />
    <h1>${session.title}</h1>
    <div class="meta">
      <p><strong>Skapad:</strong> ${new Date(session.created_at).toLocaleDateString('sv-SE', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}</p>
      <p><strong>Analystyp:</strong> ${session.analysis_type}</p>
      ${result.type === 'comparison' && result.documents ? `
        <p><strong>Antal dokument:</strong> ${result.documents.length}</p>
      ` : ''}
    </div>
  </header>

  <main>
    ${contentHtml}
  </main>

  <footer>
    <p><strong>Genererad av GR:s Dokumentanalysverktyg</strong></p>
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