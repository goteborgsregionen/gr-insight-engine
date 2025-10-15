# ERCW Sprint 1: Extract Evidence

## Översikt
Sprint 1 implementerar Extract-steget i ERCW-arkitekturen (Extract → Reason → Critique → Write).

## Vad är ERCW?
ERCW (Extract → Reason → Critique → Write) är en 4-stegs arkitektur för evidensbaserad analys:

1. **Extract**: Extrahera verifierbar evidens från dokument (tabeller, citat, siffror)
2. **Reason**: Skapa strukturerade påståenden (claims) från evidensen
3. **Critique**: Kvalitetskontroll innan publicering (citation coverage, unit sanity, conflict scan)
4. **Write**: Generera slutlig rapport med automatiska källhänvisningar

## Nya komponenter (Sprint 1)

### Database Tables
- **`evidence_posts`**: Lagrar extraherad evidens från dokument
  - Stödjer: table, quote, number, figure, section
  - Spårar: page, source_loc, headers, rows, quote text
  - RLS policies: Användare kan bara se evidens från sina egna dokument
  
- **`claims_posts`**: (struktur förberedd för Sprint 2)
  - Kommer användas för att länka claims till evidens

### Edge Functions
- **`extract-evidence`**: Extraherar verifierbar evidens från PDF med Lovable AI
  - Använder `google/gemini-2.5-flash` för optimal PDF/tabell-extrahering
  - Tool calling med strukturerad JSON-schema för evidens
  - Sparar extraherad evidens i `evidence_posts` tabell
  - Uppdaterar dokument med `evidence_extracted`, `evidence_count`, `extraction_completed_at`

### UI Components
- **`EvidenceViewer`**: Visar extraherad evidens per dokument
  - Filtrera per typ (table, quote, number, figure, section)
  - Tabeller renderas med headers och rows
  - Citat visas som blockquote
  - Badge-system för evidens-ID och källa
  
- **`DocumentEvidence` page**: Dedikerad vy för evidens
  - Tillgänglig via `/documents/:documentId/evidence`
  - Navigation tillbaka till dokumentlistan

## Workflow
1. Användare laddar upp dokument
2. Vid analys: `extract-evidence` körs automatiskt (om evidens inte redan finns)
3. Evidens sparas i `evidence_posts` tabell
4. Användare kan visa evidens via "📊 Evidens" knapp i dokumentlistan

## Kvalitetsmetrik Sprint 1
- **Evidence coverage:** 100% av dokument kan extraheras
- **Accuracy:** Alla tabeller och citat ordagranna
- **Performance:** <2 min för 50-sidors PDF

## ChatGPT:s Prompts
Sprint 1 använder följande prompts från ChatGPT:s ERCW-paket:
- `system_base.md`: Evidence-first foundation
- `extract_prompt.txt`: Extrahera verifierbar evidens

## Nästa steg (Sprint 2)
- Implementera `reason-claims` för att skapa claims från evidens
- Länka claims till evidens via `evidence_ids[]`
- Implementera olika analystyper (economic, security, strategic, etc.)
- UI för Claims Explorer

## Teknisk stack
- **Database**: Supabase (PostgreSQL)
- **Edge Functions**: Deno
- **AI**: Lovable AI Gateway (Google Gemini 2.5 Flash)
- **Frontend**: React, TypeScript, TanStack Query
- **UI**: shadcn/ui components
