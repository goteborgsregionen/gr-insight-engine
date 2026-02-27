

# Kraftfullare analyser och sammanfattningar

## Rotorsaksanalys

Analyskvaliteten begransas av flera samverkande problem:

### 1. Svag modell for dokumentanalys
`analyze-document` anvander `gemini-2.5-flash` -- en snabb men ytlig modell. For en arsredovisning pa 4.5 MB behover vi djupare resoneringsformaga.

### 2. Ytliga promptinstruktioner
- Summary-prompten sager "max 300 ord" for PDF och "max 200 ord" for text -- det tvingar AI:n att vara generisk
- Standard-mallen saknar krav pa specifika siffror, jamforelser och kritisk analys
- Ingen instruktion att vara analytisk snarare an beskrivande

### 3. Trasig evidensextraktion
`extract-evidence` kraschar (`Cannot read properties of undefined (reading '0')`) -- AI-svaret saknar `choices[0]`, troligen pga att response-formatet ar ovantad. Utan evidens blir hela ERCW-pipelinen tandlos.

### 4. Ingen "deep analysis"-pass for enskilda dokument
For ett enskilt dokument (som i detta fall) kor systemet bara `analyze-document` + `extract-evidence`. Det finns ingen aggregering eller fordjupning -- radata blir slutresultatet.

---

## Atgardsplan

### Steg 1: Fixa `extract-evidence` (kritiskt)
- Lagg till null-check for `aiData.choices` och `aiData.choices[0]`
- Klona request body fore forsta laseoperationen (fixar "Body already consumed")
- Lagg till fallback-parsning av `aiData.message?.content` om tool_calls saknas
- Logga hela AI-response-strukturen for framtida debugging

### Steg 2: Uppgradera `analyze-document`
- **Byt modell** fran `gemini-2.5-flash` till `gemini-2.5-pro` for PDF-dokument (mer djup, bild+text)
- **Forbattra summary-kravet**: "minst 500 ord, inkludera specifika siffror, jamforelser och kritisk bedomning"
- **Uppdatera standard-mallen** med krav pa:
  - Kvantitativa pastaenden (inte "okade intakter" utan "intakter okade med X% till Y MSEK")
  - Kritisk analys: vad ar bra, vad ar oroande, vad saknas?
  - Jamforelse med foregaende ar dar data finns
  - Konkreta slutsatser och rekommendationer
- **Uppdatera tool schema**: ge `summary`-faltet en mer detaljerad description som kraver djup

### Steg 3: Lagg till "fordjupad analys"-pass for enskilda dokument
- Skapa ny edge function `deep-analyze-single` som tar resultatet fran steg 1 (analyze-document + evidence) och kor en andra AI-omgang med `gemini-2.5-pro`
- Prompt: "Du har fatt en initial analys och rav evidens. Skriv nu en fordjupad, kritisk analys som: (1) kopplar siffror till trender, (2) identifierar risker och mojligheter, (3) jamfor mot branschstandarder, (4) ger handlingsbara rekommendationer"
- Uppdatera `process-analysis-queue` att inkludera detta steg for enkeldokument-analyser

### Steg 4: Uppdatera pipelinen i `process-analysis-queue`
- Lagg till `deep-analyze-single` som steg 5 i pipelinen (efter critique-pre-write) for icke-strategiska analyser med 1 dokument
- Spara den fordjupade analysen som `analysis_result.full_markdown_output` pa sessionen

---

## Tekniska detaljer

### Filer som andras

1. **`supabase/functions/extract-evidence/index.ts`**
   - Null-check for `aiData.choices`
   - Klona body fore parsning
   - Fallback-logik for svar utan tool_calls

2. **`supabase/functions/analyze-document/index.ts`**
   - Byt modell till `gemini-2.5-pro` for PDF:er
   - Uppdatera summary-krav fran "max 300 ord" till "minst 500 ord, analytisk och specifik"
   - Forbattra standard-mallen med djupare instruktioner

3. **`supabase/functions/deep-analyze-single/index.ts`** (ny)
   - Tar session_id, laser individual results + evidence
   - Anropar gemini-2.5-pro med fordjupad analytisk prompt
   - Sparar resultat som full_markdown_output pa sessionen

4. **`supabase/functions/process-analysis-queue/index.ts`**
   - Lagg till steg 5: `deep-analyze-single` for enkelddokument-sessioner

5. **`supabase/config.toml`** -- inte direkt, men config uppdateras automatiskt vid deploy av ny funktion

### Forvantat resultat
Istallet for en generisk sammanfattning pa 100 ord far anvandaren:
- En analytisk sammanfattning pa 500+ ord med specifika siffror
- Koppling mellan data och slutsatser (evidensbaserat)
- Trender och jamforelser med foregaende ar
- Riskbedomning och konkreta rekommendationer
- Alla pastaenden forankrade i dokumentdata

