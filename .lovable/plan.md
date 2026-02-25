
# Sprint 2: Multi-pass analys, modelluppgradering och contradiction detection

## Oversikt
Sprint 2 forbattrar analysernas kvalitet genom fyra andringar:
1. Uppgradera `reason-claims` och `aggregate-strategic-analysis` till `google/gemini-2.5-pro` for djupare reasoning
2. Lagga till temperature controls per edge function
3. Implementera multi-pass analys med self-critique i `aggregate-strategic-analysis`
4. Lagga till contradiction detection i `reason-claims`

## Detaljerade andringar

### 1. `supabase/functions/reason-claims/index.ts` -- Modelluppgradering + contradiction detection + temperature

**Andringar:**
- Byt modell fran `google/gemini-2.5-flash` till `google/gemini-2.5-pro` (rad 99)
- Lagg till `temperature: 0.3` (konservativt for fakta-baserad reasoning)
- Utoka claim-typer med `contradiction` som ny typ
- Lagg till ett dedikerat steg i prompten som explicit instruerar AI:n att jamfora siffror mellan dokument och flagga motstridiga uppgifter
- Utoka tool-schemat med `contradicts_claim_id` (optional) for att lank motstridiga claims till varandra
- Spara contradictions-sammanfattning pa sessionen (i `critique_results` JSON)

**Ny prompt-sektion (laggs till i REASON_PROMPT):**
```
CONTRADICTION DETECTION:
- Jamfor siffror, procent och artal mellan olika dokument
- Om samma KPI har olika varden i olika dokument, skapa en "contradiction" claim
- Ange contradicts_claim_id for att referera till det motstridiga paastaendet
- Exempel: Om Dokument A sager "budget 50 MSEK" och Dokument B sager "budget 42 MSEK", skapa tva claims som pekar pa varandra
```

### 2. `supabase/functions/aggregate-strategic-analysis/index.ts` -- Multi-pass + modell + temperature

**Andringar:**

**A. Modelluppgradering:**
- Byt modell fran `google/gemini-2.5-flash` till `google/gemini-2.5-pro` (rad 373)
- Lagg till `temperature: 0.5` (balanserat for kreativ strategisk analys)

**B. Multi-pass self-critique (huvudforbattring):**
Efter att den forsta analysen genererats (Pass 1), lagg till ett Pass 2 dar AI:n kritiserar sin egen output:

```text
Pass 1: Generera analys (som idag, med gemini-2.5-pro)
         |
         v
Pass 2: Self-critique -- ny AI-anrop med prompten:
         "Granska foljande analys mot dessa kvalitetskriterier:
          1. Har gap-analysen minst 5 rader med faktiska siffror? (JA/NEJ)
          2. Har varje rekommendation minst 150 ord? (JA/NEJ)
          3. Finns minst 10 dokumentreferenser med emoji? (JA/NEJ)
          4. Ar total langd minst 1500 ord? (JA/NEJ)
          5. Refererar analysen till evidence-ID:n [E-XXX]? (JA/NEJ)
          
          Om nagot kriterium ar NEJ: forbattra analysen och returnera en uppdaterad version.
          Om alla ar JA: returnera analysen oforandrad."
         |
         v
Anvand forbattrad version om score < threshold
```

**Implementering:**
- Forsta AI-anropet (Pass 1) ar oforandrat -- producerar `draftAnalysis`
- Andra AI-anropet (Pass 2) tar `draftAnalysis.full_markdown_output` som input
- Pass 2 anvander `google/gemini-2.5-flash` (snabbare, billigare for granskning) med `temperature: 0.1`
- Pass 2 returnerar via tool call: `{ passed: boolean, score: number, issues: string[], improved_markdown: string | null }`
- Om `passed === false` och `improved_markdown` finns: ersatt `full_markdown_output` med forbattrad version
- Om Pass 2 misslyckas (timeout, fel): anvand Pass 1 oforandrad (graceful degradation)
- Logga critique-resultat i `analysis_sessions.critique_results`

**C. Inkludera contradictions fran claims:**
- Hamta claims med `claim_type = 'contradiction'` separat
- Lagg till en dedikerad sektion i prompten: "IDENTIFIERADE MOTSAGELSER" med motstridiga varden
- Instruera AI:n att adressera dessa i gap-analysen

### 3. Temperature-oversikt (alla funktioner)

| Edge function | Modell | Temperature | Motivering |
|---|---|---|---|
| extract-evidence | gemini-2.5-flash | 0.1 | Fakta-utvinning, minimal kreativitet |
| reason-claims | gemini-2.5-pro | 0.3 | Kräver reasoning men maste vara precis |
| critique-pre-write | -- (ej AI) | -- | Programmatisk, ingen AI |
| aggregate-strategic-analysis Pass 1 | gemini-2.5-pro | 0.5 | Strategisk analys, kreativt tankande |
| aggregate-strategic-analysis Pass 2 | gemini-2.5-flash | 0.1 | Granskning, strikt bedomning |
| analyze-document | gemini-2.5-flash | 0.2 (redan satt for text) | Fakta-fokuserat |

### 4. Inga databasandringar
Alla andringar ar i edge functions. Befintliga kolumner (`critique_results` jsonb, `claims_posts.claim_type` text) stodjer redan de nya vaerdena.

## Filer som andras

| Fil | Aktion | Sammanfattning |
|---|---|---|
| `supabase/functions/reason-claims/index.ts` | Redigera | Pro-modell, temp 0.3, contradiction detection |
| `supabase/functions/aggregate-strategic-analysis/index.ts` | Redigera | Pro-modell, temp 0.5, multi-pass self-critique |
| `supabase/functions/extract-evidence/index.ts` | Redigera | Lagg till temperature: 0.1 (en rad) |

## Risker och mitigering
- **Langre exekveringstid**: Multi-pass lagger till ~30-60s extra. Mitigeras genom att anvanda flash for Pass 2 och att hela Pass 2 ar optional (graceful degradation).
- **Hogre kostnad**: gemini-2.5-pro kostar mer an flash. Mitigeras genom att bara anvanda pro for de tva viktigaste stegen (reason + aggregate) och flash for allt annat.
- **Pass 2 timeout**: Om Pass 2 tar for lang tid anvands Pass 1 oforandrad -- anvandarupplevelsen forsämras aldrig.
