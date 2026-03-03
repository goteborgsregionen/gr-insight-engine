

# Fix: Tom "Detaljer"-flik, trasig evidensextraktion, och dold djupanalys

## Problemanalys

Tre samverkande buggar ger dålig output:

### 1. "Detaljer"-fliken är tom
`AnalysisWorkspace.tsx` rad 746-783: För icke-strategiska analyser visas bara `similarities` och `differences` — fält som aldrig sätts för enkeldokument-analyser. Fliken behöver fyllas med verklig data.

### 2. `extract-evidence` kraschar (500 Internal Server Error)
Funktionen skickar PDF med `image_url`-format (rad 126-133) men borde använda `inline_data`-format som `analyze-document` gör. AI-gatewayen returnerar 500 → 0 evidensposter → reason-claims hittar 0 evidens → deep-analyze-single körs utan data.

### 3. Djupanalysen visas inte
`deep-analyze-single` sparar `full_markdown_output` på sessionen, men Sammanfattnings-fliken kollar `result.extracted_data?.markdown_output` först (rad 645) — dvs den ytliga analysen från `analyze-document`. Djupanalysen döljs.

### 4. Cachad gammal analys
`analyze-document` hittar befintlig `analysis_results` med matchande hash och returnerar direkt ("Using cached analysis"). De uppgraderade prompterna används aldrig.

---

## Åtgärder

### Steg 1: Fixa `extract-evidence` — rätt PDF-format
Byt från `image_url` till `inline_data`-format (samma som analyze-document). Detta fixar 500-felet.

**Fil:** `supabase/functions/extract-evidence/index.ts`

### Steg 2: Visa djupanalysen i Sammanfattning
Ändra prioritetsordningen i `AnalysisWorkspace.tsx`:
1. `result.full_markdown_output` (djupanalys) — visa om den finns
2. `result.extracted_data?.markdown_output` (standardanalys) — fallback

**Fil:** `src/pages/AnalysisWorkspace.tsx`

### Steg 3: Fyll "Detaljer"-fliken med riktig data
Visa fyra sektioner med data som redan finns i databasen:

1. **Evidens** — hämtas från `evidence_posts`-tabellen (tabeller, citat, nyckeltal)
2. **Påståenden** — hämtas från `claims_posts`-tabellen
3. **Nyckeltal & KPI:er** — från `analysis_results.extracted_data` (amounts, dates, organizations)
4. **Teman** — från `analysis_results.extracted_data` (themes, strengths, challenges)

Skapar inga nya queries — använder redan hämtad `individualResults`, `evidenceData`, `claimsData`.

**Fil:** `src/pages/AnalysisWorkspace.tsx`

### Steg 4: Cache-invalidering
Lägg till en "Kör om analys"-knapp som invaliderar befintliga `analysis_results` (sätter `is_valid = false`) och triggar om pipelinen. Så att uppgraderade prompter faktiskt används.

**Fil:** `src/pages/AnalysisWorkspace.tsx`

---

## Påverkade filer

| Fil | Ändring |
|-----|---------|
| `supabase/functions/extract-evidence/index.ts` | Byt `image_url` → `inline_data` format |
| `src/pages/AnalysisWorkspace.tsx` | Visa djupanalys, fyll Detaljer-flik, lägg till "Kör om"-knapp |

