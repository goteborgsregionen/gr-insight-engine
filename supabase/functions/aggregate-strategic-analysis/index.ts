import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { tablesToKpiPoints, detectConflicts } from "../_shared/kpiConflictScanner.ts";
import type { EvidenceTable, ConflictIssue } from "../_shared/kpiConflictScanner.ts";

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

    const { sessionId } = await req.json();

    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    console.log(`Starting strategic aggregation for session: ${sessionId}`);

    // Authenticate: support both frontend calls (with Authorization header) and service-to-service calls (without header)
    const authHeader = req.headers.get('Authorization');
    let userId: string;

    if (authHeader) {
      // Called from frontend with user token
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        throw new Error('Unauthorized');
      }
      userId = user.id;
    } else {
      // Called from another edge function (process-analysis-queue) - get user_id from session
      const { data: sessionData, error: sessionError } = await supabase
        .from('analysis_sessions')
        .select('user_id')
        .eq('id', sessionId)
        .single();

      if (sessionError || !sessionData) {
        throw new Error('Session not found');
      }
      userId = sessionData.user_id;
      console.log(`Service-to-service call for user: ${userId}`);
    }

    // Fetch the session
    const { data: session, error: sessionError } = await supabase
      .from('analysis_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      throw new Error('Session not found');
    }

    // Fetch all individual analysis results
    const { data: individualResults, error: resultsError } = await supabase
      .from('analysis_results')
      .select('*')
      .in('document_id', session.document_ids);

    if (resultsError) {
      throw new Error('Failed to fetch analysis results');
    }

    // Fetch document details
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id, title, file_name')
      .in('id', session.document_ids);

    if (docsError) {
      throw new Error('Failed to fetch documents');
    }

    // Fetch claims for this session
    const { data: claimsPosts } = await supabase
      .from('claims_posts')
      .select('*')
      .eq('analysis_session_id', sessionId);

    // Fetch contradiction claims separately for dedicated prompt section
    const contradictionClaims = (claimsPosts || []).filter(c => c.claim_type === 'contradiction');

    // === BENCHMARKING: Fetch previous completed sessions for comparison ===
    const { data: previousSessions } = await supabase
      .from('analysis_sessions')
      .select('id, title, completed_at, analysis_result, claims_count, critique_passed, critique_results')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .neq('id', sessionId)
      .order('completed_at', { ascending: false })
      .limit(5);

    let benchmarkContext = '';
    if (previousSessions && previousSessions.length > 0) {
      benchmarkContext = '\n\n## BENCHMARKING MOT TIDIGARE ANALYSER\n';
      benchmarkContext += `Det finns ${previousSessions.length} tidigare avslutade analyser att jämföra mot:\n\n`;
      for (const prev of previousSessions) {
        const result = prev.analysis_result as any;
        benchmarkContext += `### ${prev.title} (${prev.completed_at?.split('T')[0] || 'okänt datum'})\n`;
        benchmarkContext += `- Claims: ${prev.claims_count || 0}\n`;
        benchmarkContext += `- Critique passed: ${prev.critique_passed ? 'Ja' : 'Nej'}\n`;
        if (result?.strategic_overview) {
          // Include abbreviated overview for comparison
          const overview = String(result.strategic_overview).slice(0, 300);
          benchmarkContext += `- Översikt: ${overview}...\n`;
        }
        if (result?.kpi_conflicts_count != null) {
          benchmarkContext += `- KPI-konflikter: ${result.kpi_conflicts_count}\n`;
        }
        if (result?.common_focus_areas && Array.isArray(result.common_focus_areas)) {
          const areas = result.common_focus_areas.map((a: any) => a.area || a).slice(0, 5);
          benchmarkContext += `- Fokusområden: ${areas.join(', ')}\n`;
        }
        benchmarkContext += '\n';
      }
      benchmarkContext += `Identifiera signifikanta förändringar jämfört med tidigare analyser. Beskriv vad som har förändrats, nya trender, och om tidigare gap har adresserats.\n`;
    }

    console.log(`📊 Benchmarking: ${previousSessions?.length || 0} previous sessions found`);

    // Fetch evidence for all documents in this session
    const { data: evidencePosts } = await supabase
      .from('evidence_posts')
      .select('*')
      .in('document_id', session.document_ids);

    // === TEMPORAL TREND ANALYSIS ===
    // Group evidence by year to detect temporal patterns
    const yearBuckets = new Map<number, { evidenceIds: string[]; docIds: Set<string>; values: Array<{ label: string; value: number; unit: string }> }>();
    
    for (const ep of (evidencePosts || [])) {
      if (ep.type !== 'table' || !ep.rows) continue;
      const rows = ep.rows as any[];
      for (const row of rows) {
        if (!Array.isArray(row)) continue;
        for (const cell of row) {
          const yearMatch = String(cell ?? '').match(/\b(19|20)\d{2}\b/);
          if (yearMatch) {
            const year = parseInt(yearMatch[0], 10);
            if (!yearBuckets.has(year)) {
              yearBuckets.set(year, { evidenceIds: [], docIds: new Set(), values: [] });
            }
            const bucket = yearBuckets.get(year)!;
            bucket.evidenceIds.push(ep.evidence_id);
            bucket.docIds.add(ep.document_id);
            break; // one year per row
          }
        }
      }
    }

    const temporalSummary = Array.from(yearBuckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([year, data]) => `${year}: ${data.evidenceIds.length} datapunkter från ${data.docIds.size} dokument (${[...data.docIds].map(id => documents.find(d => d.id === id)?.title || id).join(', ')})`)
      .join('\n');

    console.log(`📅 Temporal analysis: ${yearBuckets.size} distinct years found`);

    // === KPI CONFLICT DETECTION (auto-resolution) ===
    const tableEvidence: EvidenceTable[] = (evidencePosts || [])
      .filter(e => e.type === 'table' && e.headers && e.rows)
      .map(e => ({
        evidenceId: e.evidence_id,
        docId: e.document_id,
        page: e.page,
        table_ref: e.table_ref,
        headers: (e.headers as string[]) || [],
        rows: (e.rows as any[]) || [],
        source_loc: e.source_loc,
        notes: e.notes
      }));

    const kpiPoints = tablesToKpiPoints(tableEvidence);
    const kpiConflicts = detectConflicts(kpiPoints);
    
    console.log(`⚠️ KPI conflict scan: ${kpiPoints.length} KPI points, ${kpiConflicts.length} conflicts detected`);

    // Auto-resolution: for each conflict, determine most reliable value
    const resolvedConflicts = kpiConflicts.map(conflict => {
      // Resolution strategy: prefer value from document with more evidence, or most recent document
      const pointsByDoc = new Map<string, typeof conflict.points[0][]>();
      for (const p of conflict.points) {
        if (!pointsByDoc.has(p.docId)) pointsByDoc.set(p.docId, []);
        pointsByDoc.get(p.docId)!.push(p);
      }

      // Find doc with most evidence overall
      const docEvidenceCounts = new Map<string, number>();
      for (const ep of (evidencePosts || [])) {
        docEvidenceCounts.set(ep.document_id, (docEvidenceCounts.get(ep.document_id) || 0) + 1);
      }

      let bestDocId = conflict.points[0].docId;
      let bestCount = 0;
      for (const [docId] of pointsByDoc) {
        const count = docEvidenceCounts.get(docId) || 0;
        if (count > bestCount) {
          bestCount = count;
          bestDocId = docId;
        }
      }

      const resolvedValue = pointsByDoc.get(bestDocId)?.[0]?.value ?? conflict.points[0].value;
      const resolvedDoc = documents.find(d => d.id === bestDocId);

      return {
        ...conflict,
        resolution: {
          resolved_value: resolvedValue,
          resolved_from_doc: resolvedDoc?.title || bestDocId,
          strategy: 'most_evidence',
          confidence: bestCount > 5 ? 'high' : 'medium'
        }
      };
    });

    console.log(`Found ${individualResults.length} individual analyses for ${documents.length} documents, ${claimsPosts?.length || 0} claims (${contradictionClaims.length} contradictions), ${evidencePosts?.length || 0} evidence posts`);


    // Prepare the comprehensive prompt for strategic aggregation
    let strategicPromptTemplate = `
Du är en expert på strategisk policyanalys och ska skapa en omfattande strategisk jämförelseanalys.

ANALYSTYP: Strategisk Jämförelseanalys
`;

    // Add context from session if available
    if (session.merged_context && Object.keys(session.merged_context).length > 0) {
      const context = session.merged_context as any;
      
      if (context.organization_context?.name || context.organization_context?.vision) {
        strategicPromptTemplate += '\n\nORGANISATIONSKONTEXT:\n';
        if (context.organization_context.name) {
          strategicPromptTemplate += `Organisation: ${context.organization_context.name}\n`;
        }
        if (context.organization_context.vision) {
          strategicPromptTemplate += `Vision: ${context.organization_context.vision}\n`;
        }
      }
      
      if (context.analysis_guidelines?.focus_areas?.length > 0) {
        strategicPromptTemplate += '\nFOKUSOMRÅDEN:\n';
        strategicPromptTemplate += context.analysis_guidelines.focus_areas.map((f: string) => `- ${f}`).join('\n');
        strategicPromptTemplate += '\n';
      }
      
      if (context.custom_instructions?.length > 0) {
        strategicPromptTemplate += '\nANPASSADE INSTRUKTIONER:\n';
        strategicPromptTemplate += context.custom_instructions.join('\n\n') + '\n';
      }
    }

    strategicPromptTemplate += `

📚 EXEMPEL PÅ HÖGKVALITATIV GAP-ANALYS:

| Område | Lokal kommunnivå | Regional/Nationell/EU-nivå | Identifierat gap |
|--------|------------------|----------------------------|------------------|
| Klimat & energi | **Göteborg**: -45% utsläpp sedan 1990, mål -63% till 2030 (📄 RUS 2024, s.23) | **EU**: -55% till 2030, klimatneutralitet 2050 (📄 Green Deal) | **Genomförandegap**: Saknar konkret åtgärdsplan för sista 18% utsläppsminskning. **Finansieringsgap**: Estimerat 2-3 mdr SEK behövs för elektrifiering av kollektivtrafik (📄 Klimatplan 2023, s.45). **Kompetensgap**: Brist på klimatrådgivare i 6 av 13 kommuner. |
| Digitalisering | **Mölndal**: 67% e-tjänster tillgängliga, användarsnitt 6.2/10 (📄 IT-strategi 2023-2026, Bilaga 2) | **Nationellt mål (SKR)**: 85% e-tjänster, användarsnitt 8/10 till 2025 | **Tekniskt gap**: Äldre plattformar (pre-2015) i 45% av systemen kräver modernisering. **Kompetensgap**: Brist på 12 UX-designers och 8 tjänsteutvecklare enligt behovsanalys. **Procesgap**: Saknas standardiserade processer för användardriven utveckling. |

OBS: Varje gap MÅSTE vara:
1. Specifik och mätbar (inte "behöver förbättras" utan "behöver 2-3 mdr SEK")  
2. Baserad på faktisk data från dokumenten (med 📄 referenser)
3. Kategoriserad (genomförande/finansiering/kompetens/process/tekniskt)

📚 EXEMPEL PÅ EVIDENSBASERADE REKOMMENDATIONER:

**1. Accelerera elektrifieringen av kollektivtrafiken genom regional samordning** – Prioriterad satsning för att nå klimatmålen

Göteborg och omkringliggande kommuner har åtagit sig att minska utsläppen med 63% till 2030 (📄 RUS 2024, s.23), men kollektivtrafikens elektrifiering ligger efter schema. Endast 23% av bussflottan är elektrisk idag (📄 Västtrafik Årsrapport 2023, s.67), jämfört med det nationella målet om 50% till 2025.

**Konkreta åtgärder:**
- Etablera ett regionalt inköpssamarbete för att sänka kostnader per elbuss från 6,5 MSEK till ~5 MSEK (📄 Kostnadsanalys, s.12)
- Bygga ut laddinfrastruktur vid 8 strategiska depåer (Göteborg 3, Mölndal 2, Partille 1, Kungälv 1, Lerum 1)
- Investera 2,1 mdr SEK över 5 år (beräkning: 350 elbussar × 5 MSEK + 200 MSEK infrastruktur)

**Förväntade effekter:**
- Minskning av CO2-utsläpp med 45 000 ton/år (📄 Klimatanalys, s.34)
- Lägre driftkostnader: -30% per km jämfört med dieselbussar efter 7 år (📄 Total Cost of Ownership-analys, Bilaga 5)
- Förbättrad luftkvalitet i stadskärnor (NOx -60%, partiklar -75%)

**Aktörer:**
- GR som koordinator och finansieringspart
- Västtrafik som operatör
- Kommunerna som ägare av depåer
- Trafikverket för laddinfrastruktur längs större vägar

OBS: Varje rekommendation MÅSTE innehålla:
1. Konkreta åtgärdsförslag med siffror (inte "förbättra" utan "investera X MSEK i Y")
2. Dokumentreferenser (📄 emoji) för varje påstående
3. Kvantifierade effekter där möjligt
4. Identifierade aktörer och ansvarsfördelning
5. Minst 150 ord per rekommendation

MÅL: 
Identifiera långsiktiga mål och strategiska prioriteringar genom att analysera ALLA dokument tillsammans.
Skapa en samlad strategisk översikt som visar mönster, synergier och gap mellan dokumenten.

INSTRUKTIONER:
1. **Strategisk Översikt**: Ge en omfattande sammanfattning (minst 200 ord) som visar:
   - Den samlade riktningen i alla dokument
   - Hur dokumenten kompletterar och förstärker varandra
   - Övergripande målbilder och visioner
   - Kopplingar till nationella strategier, EU-agendor och Agenda 2030

2. **Gemensamma Fokusområden**: Identifiera 5-7 huvudsakliga tematiska områden som går igen:
   - För varje område: ge en detaljerad beskrivning (minst 50 ord)
   - Lista vilka specifika dokument som tar upp området (med dokumentnamn)
   - Beskriv hur olika dokument belyser området ur olika perspektiv
   Exempel på områden: grön omställning, digitalisering, kompetensförsörjning, inkludering, samverkan, resiliens

3. **Strategisk Målkarta**: Skapa en strukturerad lista med format:
   **Tema** → Konkreta mål → Mätbara indikatorer
   
   För varje tema:
   - Lista 2-4 konkreta mål
   - Ge 2-3 föreslagna indikatorer för uppföljning
   - Ange vilka dokument målen kommer ifrån
   
   Exempel:
   **Grön omställning** → Klimatneutralitet/utsläppsminskning → utsläpp per capita, andel förnybar energi (📄 RUS, 📄 Nationell strategi)

4. **Gap-Analys**: Skapa en FAKTISK TABELL i markdown-format:
   
   | Område | Lokal kommunnivå | Regional/Nationell/EU-nivå | Identifierat gap |
   |--------|------------------|----------------------------|------------------|
   | [exempel: Klimat & energi] | [beskriv lokal nivå från dokumenten] | [beskriv regional/nationell nivå från dokumenten] | [beskriv konkreta gap: kapacitet, finansiering, kompetens, etc.] |
   
   Skapa minst 5-7 rader med konkreta gap baserade på dokumentens innehåll.
   Var specifik om vilka typer av gap det är (genomförandegap, resursgap, kompetensgap, etc.)

5. **Rekommenderade Fokusområden för GR**: Lista 3-5 prioriterade fokusområden med följande struktur för varje:
   
   **[Nummer]. [Tydlig rubrik]** – [kort beskrivning av vad det handlar om]
   
   [Längre förklaring (minst 100 ord per rekommendation) som inkluderar:]
   - Varför detta är viktigt (med dokumentreferens, t.ex. 📄 Dokumentnamn)
   - Konkreta förslag på åtgärder och initiativ
   - Vilka aktörer som bör involveras
   - Koppling till identifierade gap
   - Förväntade resultat/effekter

OUTPUTFORMAT:
Din analys MÅSTE följa denna markdown-struktur:

## Strategisk Översikt
[Omfattande översiktstext på minst 200 ord]

## Gemensamma Fokusområden
**[Område 1]** – [Detaljerad beskrivning med dokumentreferenser]
📄 [Dokumentnamn], 📄 [Dokumentnamn]

**[Område 2]** – [Detaljerad beskrivning med dokumentreferenser]
...

## Strategisk Målkarta (teman → mål → indikatorer)
**[Tema 1]** → [Mål] → [Indikatorer]
📄 [Dokumentreferens]

**[Tema 2]** → [Mål] → [Indikatorer]
...

## Gap-Analys
| Område | Lokal kommunnivå | Regional/Nationell/EU-nivå | Identifierat gap |
|--------|------------------|----------------------------|------------------|
| [Område 1] | [Beskrivning] | [Beskrivning] | [Konkret gap] |
| [Område 2] | [Beskrivning] | [Beskrivning] | [Konkret gap] |
...

## Rekommenderade Fokusområden för GR (3–5)
**1. [Rubrik]** – [Kort beskrivning]

[Längre förklaring med varför, vad, hur, vilka, och dokumentreferenser]
📄 [Dokumentnamn], 📄 [Dokumentnamn]

**2. [Rubrik]** – [Kort beskrivning]
...

---

KRITISKA KVALITETSKRAV:
✅ Varje sektion ska vara omfattande och detaljerad (inte korta punktlistor)
✅ Gap-analysen MÅSTE vara en faktisk markdown-tabell med |
✅ Alla påståenden ska referera till specifika dokument med 📄 emoji
✅ Rekommendationerna ska vara handlingsbara med konkreta åtgärdsförslag
✅ Texten ska vara professionell, tvärsektoriell och strategiskt tänkande
✅ Totalt minst 1500 ord för hela analysen
✅ Använd dokumentens faktiska innehåll, inte generiska formuleringar
✅ Inkludera temporala trender om tidsdata finns tillgänglig
✅ Adressera KPI-konflikter och använd resolverade värden
✅ Inkludera en ## Temporal Trendanalys sektion om data finns för fler än 2 år
`;

    // Build the comprehensive context from all individual analyses
    let analysisContext = "INDIVIDUELLA DOKUMENTANALYSER:\n\n";
    
    for (const result of individualResults) {
      const doc = documents.find(d => d.id === result.document_id);
      analysisContext += `### Dokument: ${doc?.title || doc?.file_name}\n\n`;
      
      if (result.summary) {
        analysisContext += `**Sammanfattning:**\n${result.summary}\n\n`;
      }
      
      if (result.extracted_data?.markdown_output) {
        analysisContext += `**Fullständig analys:**\n${result.extracted_data.markdown_output}\n\n`;
      }
      
      if (result.keywords && result.keywords.length > 0) {
        analysisContext += `**Nyckelord:** ${result.keywords.join(', ')}\n\n`;
      }
      
      analysisContext += "---\n\n";
    }

    // Add structured claims with evidence references
    if (claimsPosts && claimsPosts.length > 0) {
      analysisContext += `\n\n## STRUKTURERADE PÅSTÅENDEN (CLAIMS)\n`;
      analysisContext += `Dessa påståenden är baserade på verifierad evidens:\n\n`;
      for (const claim of claimsPosts) {
        analysisContext += `**${claim.claim_id}** (${claim.claim_type}, styrka: ${claim.strength}`;
        if ((claim as any).confidence_score != null) {
          analysisContext += `, konfidens: ${(claim as any).confidence_score}/100`;
        }
        analysisContext += `):\n`;
        analysisContext += `${claim.text}\n`;
        if ((claim as any).explanation) {
          analysisContext += `💡 Förklaring: ${(claim as any).explanation}\n`;
        }
        analysisContext += `📊 Evidens: ${claim.evidence_ids?.join(', ') || 'Ingen evidens angiven'}\n`;
        if (claim.assumptions && claim.assumptions.length > 0) {
          analysisContext += `⚠️ Antaganden: ${claim.assumptions.join('; ')}\n`;
        }
        if (claim.actors && claim.actors.length > 0) {
          analysisContext += `👥 Aktörer: ${claim.actors.join(', ')}\n`;
        }
        if (claim.kpi_tags && claim.kpi_tags.length > 0) {
          analysisContext += `📈 KPI-taggar: ${claim.kpi_tags.join(', ')}\n`;
        }
        analysisContext += `\n`;
      }
    }

    // Add raw evidence (prioritize tables and numbers)
    if (evidencePosts && evidencePosts.length > 0) {
      analysisContext += `\n\n## RAW EVIDENS\n`;
      analysisContext += `Använd denna evidens för att stödja dina påståenden:\n\n`;
      
      // Prioritize tables and numbers
      const tables = evidencePosts.filter(e => e.type === 'table').slice(0, 20);
      const numbers = evidencePosts.filter(e => e.type === 'number').slice(0, 30);
      
      for (const evidence of tables) {
        analysisContext += `📊 **${evidence.evidence_id}** (${evidence.source_loc}):\n`;
        analysisContext += `Tabell: ${evidence.table_ref || 'Utan namn'}\n`;
        if (evidence.headers && evidence.headers.length > 0) {
          analysisContext += `Kolumner: ${(evidence.headers as string[]).join(' | ')}\n`;
        }
        if (evidence.rows && evidence.rows.length > 0) {
          const rows = evidence.rows as any[];
          const rowsToShow = rows.slice(0, 5);
          rowsToShow.forEach((row: any) => {
            analysisContext += `  ${Array.isArray(row) ? row.join(' | ') : JSON.stringify(row)}\n`;
          });
          if (rows.length > 5) {
            analysisContext += `  ... (${rows.length - 5} fler rader)\n`;
          }
        }
        analysisContext += `\n`;
      }
      
      for (const evidence of numbers) {
        analysisContext += `🔢 **${evidence.evidence_id}** (${evidence.source_loc}):\n`;
        analysisContext += `${evidence.quote || evidence.notes}\n`;
        if (evidence.unit_notes) {
          analysisContext += `Enhet: ${evidence.unit_notes}\n`;
        }
        analysisContext += `\n`;
      }
    }

    // Add contradictions section if any exist
    if (contradictionClaims.length > 0) {
      analysisContext += `\n\n## IDENTIFIERADE MOTSÄGELSER\n`;
      analysisContext += `Följande motsägelser har identifierats mellan dokument. Adressera dessa i gap-analysen:\n\n`;
      for (const claim of contradictionClaims) {
        analysisContext += `⚠️ **${claim.claim_id}** (styrka: ${claim.strength}):\n`;
        analysisContext += `${claim.text}\n`;
        analysisContext += `📊 Evidens: ${claim.evidence_ids?.join(', ') || 'Ingen evidens angiven'}\n`;
        if (claim.notes?.startsWith('contradicts:')) {
          analysisContext += `🔗 Motsäger: ${claim.notes.replace('contradicts:', '')}\n`;
        }
        analysisContext += `\n`;
      }
    }

    // Add temporal trend analysis
    if (temporalSummary) {
      analysisContext += `\n\n## TEMPORAL TRENDANALYS\n`;
      analysisContext += `Data har identifierats för följande tidsperioder:\n${temporalSummary}\n`;
      analysisContext += `\nAnvänd denna tidsdata för att identifiera trender, förändringar över tid och prognoser.\n`;
    }

    // Add KPI conflict detection with auto-resolution
    if (resolvedConflicts.length > 0) {
      analysisContext += `\n\n## KPI-KONFLIKTER (automatiskt detekterade)\n`;
      analysisContext += `Följande KPI-konflikter har identifierats mellan dokument med automatisk resolution:\n\n`;
      for (const conflict of resolvedConflicts) {
        analysisContext += `🔴 **${conflict.label}** (${conflict.unit}, ${conflict.severity}):\n`;
        analysisContext += `  Värden: ${conflict.points.map(p => `${p.value} (${documents.find(d => d.id === p.docId)?.title || p.docId})`).join(' vs ')}\n`;
        analysisContext += `  Δ = ${conflict.deltaAbs.toFixed(2)}${conflict.deltaRelPct ? ` (${conflict.deltaRelPct.toFixed(1)}%)` : ''}\n`;
        analysisContext += `  ✅ Resolution: Använd ${conflict.resolution.resolved_value} från "${conflict.resolution.resolved_from_doc}" (strategi: ${conflict.resolution.strategy}, konfidens: ${conflict.resolution.confidence})\n`;
        analysisContext += `  ${conflict.message}\n\n`;
      }
      analysisContext += `Adressera dessa konflikter i gap-analysen och använd de resolverade värdena som primära referenspunkter.\n`;
    }

    // Add benchmarking context from previous analyses
    if (benchmarkContext) {
      analysisContext += benchmarkContext;
    }

    // Add custom prompt if provided
    if (session.custom_prompt) {
      analysisContext += `\n\nANVÄNDAR-SPECIFIKA INSTRUKTIONER:\n${session.custom_prompt}\n\n`;
    }

    // Call Lovable AI with tool calling for structured output
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Calling Lovable AI for strategic aggregation...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        temperature: 0.5,
        messages: [
          {
            role: 'system',
            content: strategicPromptTemplate
          },
          {
            role: 'user',
            content: `Analysera följande dokument och skapa en strategisk jämförelseanalys:\n\n${analysisContext}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'create_strategic_analysis',
              description: 'Skapa en omfattande strategisk jämförelseanalys med alla obligatoriska sektioner',
              parameters: {
                type: 'object',
                properties: {
                  reasoning_steps: {
                    type: 'array',
                    description: 'INNAN du skapar analysen, dokumentera dina resonemangssteg här. För varje viktigt påstående du planerar att göra, förklara: (1) Vilken evidens du baserar det på, (2) Vilket mönster eller insikt du ser, (3) Vilken slutsats du drar',
                    items: {
                      type: 'object',
                      properties: {
                        step_number: { 
                          type: 'integer',
                          description: 'Stegets nummer i ordning'
                        },
                        observation: { 
                          type: 'string',
                          description: 'Vad ser du i data/evidens/claims? Beskriv konkreta observationer.'
                        },
                        evidence_refs: {
                          type: 'array',
                          items: { type: 'string' },
                          description: 'Vilka evidens-ID (E-XXX) eller claim-ID (C-XXX) stödjer denna observation? Lista alla relevanta ID:n.'
                        },
                        insight: {
                          type: 'string', 
                          description: 'Vilken insikt eller mönster följer av observationen? Vad betyder detta i ett större sammanhang?'
                        },
                        conclusion: {
                          type: 'string',
                          description: 'Vilken slutsats drar du för rapporten? Hur kommer detta påverka din analys?'
                        }
                      },
                      required: ['step_number', 'observation', 'evidence_refs', 'insight', 'conclusion']
                    }
                  },
                  strategic_overview: {
                    type: 'string',
                    description: 'OMFATTANDE strategisk översikt (minst 200 ord) som beskriver den samlade riktningen i alla dokument, hur de kompletterar varandra, övergripande målbilder och kopplingar till nationella/EU-strategier'
                  },
                  common_focus_areas: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        area: { 
                          type: 'string',
                          description: 'Namnet på fokusområdet (t.ex. "Grön omställning & elektrifiering")'
                        },
                        description: { 
                          type: 'string',
                          description: 'DETALJERAD beskrivning av området (minst 50 ord) som förklarar hur olika dokument belyser det'
                        },
                        documents: { 
                          type: 'array', 
                          items: { type: 'string' },
                          description: 'Lista med dokumentnamn som tar upp detta område'
                        }
                      },
                      required: ['area', 'description', 'documents']
                    },
                    description: '5-7 huvudsakliga gemensamma fokusområden med detaljerade beskrivningar'
                  },
                  strategic_goals_map: {
                    type: 'string',
                    description: 'Strategisk målkarta i markdown-format med struktur: **Tema** → Mål → Indikatorer. Inkludera dokumentreferenser med 📄 emoji. Minst 5-7 olika teman.'
                  },
                  gap_analysis: {
                    type: 'string',
                    description: 'FAKTISK markdown-tabell med | som avgränsare. Format: | Område | Lokal kommunnivå | Regional/Nationell/EU-nivå | Identifierat gap |. Minst 5-7 rader med konkreta, detaljerade gap baserade på dokumentens faktiska innehåll. Var specifik om gap-typer (genomförandegap, resursgap, kompetensgap, etc.)'
                  },
                  recommended_focus_areas: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { 
                          type: 'string',
                          description: 'Tydlig, handlingsbar rubrik för rekommendationen'
                        },
                        description: { 
                          type: 'string',
                          description: 'OMFATTANDE beskrivning (minst 100 ord) som inkluderar: varför det är viktigt, konkreta åtgärdsförslag, vilka aktörer som bör involveras, koppling till identifierade gap, förväntade resultat'
                        },
                        motivation: { 
                          type: 'string',
                          description: 'Dokumentreferenser som stödjer denna rekommendation (med 📄 emoji)'
                        }
                      },
                      required: ['title', 'description', 'motivation']
                    },
                    description: '3-5 prioriterade, detaljerade och handlingsbara fokusområden för Göteborgsregionen'
                  },
                  evidence_based_statements: {
                    type: 'array',
                    description: 'Lista av viktiga påståenden med direkta evidenshänvisningar. Använd format: "påstående [E-001, E-023]" eller "påstående [C-005]" för att referera till evidens eller claims.',
                    items: { type: 'string' }
                  },
                  full_markdown_output: {
                    type: 'string',
                    description: 'KOMPLETT, PROFESSIONELL analys i markdown-format enligt exakt den mall som specificerats. MÅSTE innehålla ALLA sektioner: ## Strategisk Översikt, ## Gemensamma Fokusområden, ## Strategisk Målkarta, ## Gap-Analys (med faktisk tabell), ## Rekommenderade Fokusområden. Totalt minst 1500 ord. Använd 📄 emoji för dokumentreferenser genomgående.'
                  }
                },
                required: ['reasoning_steps', 'strategic_overview', 'common_focus_areas', 'strategic_goals_map', 'gap_analysis', 'recommended_focus_areas', 'evidence_based_statements', 'full_markdown_output'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: {
          type: 'function',
          function: { name: 'create_strategic_analysis' }
        }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    // Extract structured output from tool call (Pass 1)
    let aggregatedAnalysis;
    if (aiData.choices?.[0]?.message?.tool_calls?.[0]) {
      const toolCall = aiData.choices[0].message.tool_calls[0];
      aggregatedAnalysis = JSON.parse(toolCall.function.arguments);
    } else {
      throw new Error('No structured output from AI');
    }

    console.log('✅ Pass 1 complete. Starting Pass 2 self-critique...');

    // === PASS 2: Self-critique ===
    let critiqueResult = { passed: true, score: 5, issues: [] as string[], used_improved: false };

    try {
      const critiqueResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          temperature: 0.1,
          messages: [
            {
              role: 'system',
              content: 'Du är en kvalitetsgranskare för strategiska analyser. Var strikt och objektiv.'
            },
            {
              role: 'user',
              content: `Granska följande strategiska analys mot dessa kvalitetskriterier:

1. Har gap-analysen minst 5 rader med faktiska siffror? (JA/NEJ)
2. Har varje rekommendation minst 150 ord? (JA/NEJ)
3. Finns minst 10 dokumentreferenser med 📄 emoji? (JA/NEJ)
4. Är total längd minst 1500 ord? (JA/NEJ)
5. Refererar analysen till evidence-ID:n [E-XXX]? (JA/NEJ)

Om något kriterium är NEJ: förbättra analysen och returnera en uppdaterad version.
Om alla är JA: returnera analysen oförändrad med passed=true.

ANALYS ATT GRANSKA:
${aggregatedAnalysis.full_markdown_output}`
            }
          ],
          tools: [{
            type: 'function',
            function: {
              name: 'critique_analysis',
              description: 'Return critique results with optional improved markdown',
              parameters: {
                type: 'object',
                required: ['passed', 'score', 'issues'],
                properties: {
                  passed: { type: 'boolean', description: 'True if all 5 criteria are met' },
                  score: { type: 'integer', description: 'Number of criteria met (0-5)', minimum: 0, maximum: 5 },
                  issues: { type: 'array', items: { type: 'string' }, description: 'List of issues found' },
                  improved_markdown: { type: 'string', description: 'Improved full markdown if passed=false. Must be complete replacement.' }
                }
              }
            }
          }],
          tool_choice: { type: 'function', function: { name: 'critique_analysis' } }
        }),
      });

      if (critiqueResponse.ok) {
        const critiqueData = await critiqueResponse.json();
        const critiqueToolCall = critiqueData.choices?.[0]?.message?.tool_calls?.[0];
        
        if (critiqueToolCall) {
          const critique = JSON.parse(critiqueToolCall.function.arguments);
          critiqueResult = {
            passed: critique.passed,
            score: critique.score,
            issues: critique.issues || [],
            used_improved: false
          };

          console.log(`📝 Pass 2 critique: score=${critique.score}/5, passed=${critique.passed}, issues=${critique.issues?.length || 0}`);

          // Use improved version if critique failed and improvement exists
          if (!critique.passed && critique.improved_markdown) {
            aggregatedAnalysis.full_markdown_output = critique.improved_markdown;
            critiqueResult.used_improved = true;
            console.log('🔄 Using improved markdown from Pass 2');
          }
        }
      } else {
        console.warn('⚠️ Pass 2 critique failed, using Pass 1 output (graceful degradation)');
      }
    } catch (critiqueError) {
      console.warn('⚠️ Pass 2 critique error, using Pass 1 output:', critiqueError);
    }

    // Create the final result structure
    const finalResult = {
      type: 'strategic_aggregation',
      analysis_type: session.analysis_type,
      document_count: documents.length,
      documents: documents.map(d => ({
        id: d.id,
        title: d.title,
        file_name: d.file_name
      })),
      reasoning_steps: aggregatedAnalysis.reasoning_steps,
      strategic_overview: aggregatedAnalysis.strategic_overview,
      common_focus_areas: aggregatedAnalysis.common_focus_areas,
      strategic_goals_map: aggregatedAnalysis.strategic_goals_map,
      gap_analysis: aggregatedAnalysis.gap_analysis,
      recommended_focus_areas: aggregatedAnalysis.recommended_focus_areas,
      evidence_based_statements: aggregatedAnalysis.evidence_based_statements,
      full_markdown_output: aggregatedAnalysis.full_markdown_output,
      individual_results: individualResults.map(r => ({
        document_id: r.document_id,
        summary: r.summary,
        keywords: r.keywords
      })),
      critique_pass2: critiqueResult,
      contradictions_count: contradictionClaims.length,
      temporal_years: Array.from(yearBuckets.keys()).sort(),
      temporal_year_count: yearBuckets.size,
      kpi_conflicts: resolvedConflicts.map(c => ({
        label: c.label,
        unit: c.unit,
        severity: c.severity,
        deltaAbs: c.deltaAbs,
        deltaRelPct: c.deltaRelPct,
        points: c.points.map(p => ({
          value: p.value,
          doc: documents.find(d => d.id === p.docId)?.title || p.docId
        })),
        resolution: c.resolution
      })),
      kpi_conflicts_count: resolvedConflicts.length,
      benchmarking: {
        previous_sessions_count: previousSessions?.length || 0,
        previous_sessions: (previousSessions || []).map(s => ({
          id: s.id,
          title: s.title,
          completed_at: s.completed_at,
          claims_count: s.claims_count,
          critique_passed: s.critique_passed
        }))
      },
      claim_confidence_stats: {
        total_claims: (claimsPosts || []).length,
        avg_confidence: (claimsPosts || []).reduce((sum, c) => sum + ((c as any).confidence_score || 0), 0) / Math.max((claimsPosts || []).length, 1),
        high_confidence: (claimsPosts || []).filter(c => ((c as any).confidence_score || 0) >= 70).length,
        low_confidence: (claimsPosts || []).filter(c => ((c as any).confidence_score || 0) < 50 && ((c as any).confidence_score || 0) > 0).length,
      },
      completed_at: new Date().toISOString()
    };

    // Update the session with the aggregated result + critique
    const { error: updateError } = await supabase
      .from('analysis_sessions')
      .update({
        analysis_result: finalResult,
        status: 'completed',
        critique_passed: critiqueResult.passed,
        critique_results: {
          pass2_score: critiqueResult.score,
          pass2_passed: critiqueResult.passed,
          pass2_issues: critiqueResult.issues,
          pass2_used_improved: critiqueResult.used_improved,
          contradictions_count: contradictionClaims.length,
          kpi_conflicts_count: resolvedConflicts.length,
          kpi_conflicts: resolvedConflicts.map(c => ({ label: c.label, severity: c.severity, resolution: c.resolution })),
          temporal_years: Array.from(yearBuckets.keys()).sort()
        },
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (updateError) {
      throw new Error('Failed to update session: ' + updateError.message);
    }

    console.log(`Strategic aggregation completed for session: ${sessionId}`);

    return new Response(
      JSON.stringify({
        success: true,
        sessionId,
        result: finalResult
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in aggregate-strategic-analysis:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
