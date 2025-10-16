import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { lintTables } from "../_shared/tableNumericLinter.ts";
import { tablesToKpiPoints, detectConflicts } from "../_shared/kpiConflictScanner.ts";

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

    const { sessionId, documentIds } = await req.json();

    if (!sessionId || !documentIds || documentIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing sessionId or documentIds' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🔍 Pre-WRITE Critique for session ${sessionId}, documents: ${documentIds.length}`);

    // Fetch all evidence for these documents
    const { data: evidence, error: evidenceError } = await supabase
      .from('evidence_posts')
      .select('*')
      .in('document_id', documentIds);

    if (evidenceError) throw evidenceError;

    console.log(`📊 Found ${evidence?.length || 0} evidence posts`);

    // Filter table evidence
    const tableEvidence = (evidence || []).filter(e => e.type === 'table');
    const tables = tableEvidence.map(e => ({
      evidenceId: e.evidence_id,
      docId: e.document_id,
      page: e.page,
      table_ref: e.table_ref,
      headers: e.headers || [],
      rows: e.rows || [],
      source_loc: e.source_loc,
      notes: e.notes
    }));

    // 1. Run numeric linter
    console.log(`🔢 Linting ${tables.length} tables...`);
    const numericIssues = lintTables(tables);
    const hasNumericErrors = numericIssues.some(i => i.severity === 'error');
    console.log(`Found ${numericIssues.length} numeric issues (${numericIssues.filter(i => i.severity === 'error').length} errors)`);

    // 2. Run KPI conflict scanner
    console.log(`🔍 Scanning for KPI conflicts...`);
    const kpiPoints = tablesToKpiPoints(tables);
    const conflicts = detectConflicts(kpiPoints);
    const hasConflictErrors = conflicts.some(c => c.severity === 'error');
    console.log(`Found ${conflicts.length} KPI conflicts (${conflicts.filter(c => c.severity === 'error').length} errors)`);

    const passed = !hasNumericErrors && !hasConflictErrors;

    // Save critique result
    const { error: saveError } = await supabase
      .from('critique_results')
      .insert({
        session_id: sessionId,
        document_id: documentIds[0], // Use first document for now
        phase: 'pre_write',
        passed,
        numeric_issues: numericIssues,
        conflicts,
        warnings: [
          ...numericIssues.filter(i => i.severity === 'warning').map(i => i.message),
          ...conflicts.filter(c => c.severity === 'warning').map(c => c.message)
        ]
      });

    if (saveError) {
      console.error('Failed to save critique result:', saveError);
    }

    console.log(`✅ Pre-WRITE Critique ${passed ? 'PASSED' : 'FAILED'}`);

    return new Response(JSON.stringify({
      passed,
      numericIssues,
      conflicts,
      summary: {
        totalIssues: numericIssues.length + conflicts.length,
        errors: numericIssues.filter(i => i.severity === 'error').length + conflicts.filter(c => c.severity === 'error').length,
        warnings: numericIssues.filter(i => i.severity === 'warning').length + conflicts.filter(c => c.severity === 'warning').length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in critique-pre-write:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
