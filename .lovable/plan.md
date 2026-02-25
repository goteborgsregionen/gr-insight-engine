
# Plan: Koppla ihop hela ERCW-pipelinen

## Problem
`process-analysis-queue` kör bara `analyze-document` per dokument. De tre andra ERCW-stegen (`extract-evidence`, `reason-claims`, `critique-pre-write`) anropas aldrig, vilket innebär att claims och evidence aldrig genereras -- och Sprint 1-förbättringarna i `aggregate-strategic-analysis` inte har data att arbeta med.

## Losning
Omskriv `process-analysis-queue/index.ts` sa att varje dokument kor hela ERCW-pipelinen sekventiellt:

```text
Per dokument:
  1. analyze-document     (grundanalys, sparar i analysis_results)
  2. extract-evidence     (extrahera tabeller, citat, nyckeltal)

Nar alla dokument ar klara:
  3. reason-claims        (skapa claims fran all evidence, per session)
  4. critique-pre-write   (validera data innan rapportskrivning)
  5. aggregate-strategic-analysis  (slutlig aggregering, om strategic)
     ELLER enkel aggregering (om standard)
```

## Detaljerade andringar

### 1. `supabase/functions/process-analysis-queue/index.ts` (huvudandring)

Ersatt nuvarande logik som bara kor `analyze-document` med en fullstandig ERCW-pipeline:

**Per dokument (steg 1-2):**
- Kor `analyze-document` som idag
- Kor `extract-evidence` med `{ documentId }` -- hoppar over om evidens redan finns
- Uppdatera kostatusen for varje steg (`analyzing` -> `extracting` -> `extracted`)

**Per session (steg 3-5), nar alla dokument ar klara:**
- Kor `reason-claims` med `{ sessionId, documentIds }` -- skapar claims fran all evidence
- Kor `critique-pre-write` med `{ sessionId, documentIds }` -- validerar data
- Spara critique-resultat pa sessionen (`critique_passed`, `critique_results`)
- Kor `aggregate-strategic-analysis` (for strategic) eller enkel aggregering (for standard)

**Timeout och felhantering:**
- Oka timeout fran 120s till 300s (extract-evidence behovs mer tid for stora PDF:er)
- Om `extract-evidence` misslyckas: logga varning men fortsatt (graceful degradation)
- Om `reason-claims` misslyckas: fortsatt till aggregering men utan claims
- Om `critique-pre-write` misslyckas: logga varning, fortsatt anda

### 2. Sessionstatusuppdateringar

Lagg till statusuppdateringar under pipelinen sa UI:t kan visa progress:

- `processing` (start)
- `extracting_evidence` (nar extract-evidence borsjar)
- `reasoning_claims` (nar reason-claims borsjar)
- `critiquing` (nar critique-pre-write borsjar)
- `aggregating` (nar aggregation borsjar)
- `completed` / `failed` (slutstatus)

### 3. Undvik dubbelkorning

Lagg till check i extract-evidence-anropet: om dokumentet redan har `evidence_extracted = true`, hoppa over. Detta gor det sakert att kora om en session.

## Tekniska detaljer

- Inga databasmigrationer behovs -- alla tabeller och kolumner finns redan
- Inga nya edge functions -- bara andring av `process-analysis-queue/index.ts`
- `reason-claims` och `critique-pre-write` anvander redan `SUPABASE_SERVICE_ROLE_KEY` sa RLS ar inget problem for service-to-service-anrop
- `claims_posts` saknar INSERT-policy for vanliga anvandare, men edge functions kor med service role key, sa det fungerar

## Risker
- **Langre exekveringstid**: Hela pipelinen kan ta 3-5 minuter. Edge functions har en maxgrans pa ~400s. Vi kor stegen sekventiellt och begrAnsar timeout per steg.
- **Graceful degradation**: Om nagot steg misslyckas gar vi vidare med det vi har, istallet for att falla helt.
