
# UI/UX-analys och forbattringsforslag

## Sammanfattning
Efter en grundlig genomgang av alla sidor (Dashboard, Dokument, Analys, Rapporter, Chat, Installningar) och bade desktop- och mobilvy har jag identifierat foljande forbattringspunkter, grupperade efter prioritet.

---

## A. Hog prioritet -- Funktionella problem

### 1. Brutna lankar pa Dashboard
"Ladda upp fler"-knappen och Quick Action-korten pekar till `/upload` men den korrekta routen ar `/documents/upload`. Anvandarnas klick leder till 404.

**Atgard:** Uppdatera alla `Link to="/upload"` till `to="/documents/upload"` i `Dashboard.tsx`.

### 2. Redundant menypost "Ladda upp"
Sidomenyn har bade "Dokument" och "Ladda upp" som separata toppnivaposter. Uppladdning ar en aktion inom dokument-flodet, inte en egen sektion. Det skapar forvirring och tar plats.

**Atgard:** Ta bort "Ladda upp" fran sidebar-navigeringen. Behall CTA-knappen "Ladda upp" pa Dokument-sidan.

### 3. AI-chatt ar en tom sida
Chat-sidan visar bara "kommer snart". En tom sida i navigeringen minskar fortroendet.

**Atgard:** Antingen implementera grundlaggande chatt-funktion (edge function finns redan: `analysis-chat`) eller doljd fran navigeringen tills den ar klar.

### 4. Dashboard-statistik visar "hardkodat" varde
"Genererade rapporter" visar alltid "0" -- det ar hardkodat och hamtar inte faktisk data fran `analysis_sessions`.

**Atgard:** Hamta count fran `analysis_sessions` med `status = 'completed'`.

---

## B. Medel prioritet -- Layoutforbattringar

### 5. Dashboard hero-kort pa mobil -- layout bryts
Pa 390px bredd trycks "Ladda upp fler"-knappen ner och text wrappas ojamnt. Texten "48 analyserade * Senaste aktivitet: fyra manader sedan" ar for lang.

**Atgard:** Pa mobil, stacka knappen under texten med `flex-col` pa sma skarmar.

### 6. Rapportkorten saknar tydligt innehall
Rapportkorten visar "Analys 2025-..." med avklippt titel, "0" vyer, och ingen sammanfattning. Det ar svart att skilja rapporter at.

**Atgard:**
- Visa hela titeln (eller la-ngre truncation).
- Visa antal dokument och kort sammanfattning om den finns.
- Visa ikon for analystyp istallet for bara badge-text.

### 7. Dokumentlistan saknar pagination
"Visar 37 av 39 dokument" listar alla pa en gang. Vid 100+ dokument blir det ohantbart.

**Atgard:** Lagg till enkel pagination (t.ex. 20 per sida) eller virtual scrolling.

### 8. Rapportvyn (InteractiveReportViewer) -- sidebar dold pa mobil
Pa mobil syns inte TOC, TrendChart eller GapAnalysis. De hamnar under main content och scrollas forbi.

**Atgard:** Lagg till en "hopfallbar" sidebar/drawer pa mobil, eller visa som accordion overst.

---

## C. Lagre prioritet -- Polish och UX-forbattringar

### 9. Tomma platshallarsektioner pa Dashboard
Under "Statistik"-tabben finns tva tomma kort ("Dokumenttyper" och "Analys-trender") med texten "kommer har". Visar inkomplett funktionalitet.

**Atgard:** Antingen fyll med riktig data (t.ex. filtyper fran documents, analyser over tid med Recharts) eller dolj tills data finns.

### 10. Sidebar saknar aktiv-indikator i loggan
Det finns ingen visuell koppling mellan logotypen i header och sidebar-branding. Headern och sidebar har separata visuella identiteter.

**Atgard:** Flytta logotypen till sidebaren (overst) och anvand headern for sak-titel/breadcrumbs istallet.

### 11. Dark mode-stod saknar toggle
CSS-variabler for dark mode finns definierade, men det finns ingen toggle i UI:t for att byta. Anvandare kan inte aktivera det.

**Atgard:** Lagg till en dark/light mode toggle i Settings eller i headern.

### 12. Wizard-stegen i Analysis ar svara att oversatta visuellt
Stegindikatorn (1 -> 2 -> 3) forsvinner pa mobil pga utrymmesbrist. Inget progressbar-alternativ.

**Atgard:** Pa sma skarmar, visa bara aktuellt steg med "Steg 1 av 3" text istallet for full horisontell stepper.

---

## D. Tillganglighetsaspekter

### 13. Knappar saknar aria-labels
Flera knappar (t.ex. ta-bort-knapp med "x" i analyswizarden, nedladdnings-ikoner i dokumentlistan) saknar beskrivande text for skarmlasar.

### 14. Fokusindikatorer
Tab-navigering genom sidomenyn och rapportkort saknar tydliga fokusringar pa nagra stallen.

---

## Rekommenderad implementeringsordning

| Steg | Punkt | Uppskattad insats |
|------|-------|------------------|
| 1 | Fix brutna lankar (#1) | 5 min |
| 2 | Ta bort redundant "Ladda upp" (#2) | 5 min |
| 3 | Fix hardkodad statistik (#4) | 10 min |
| 4 | Dolj/implementera AI-chatt (#3) | 10 min |
| 5 | Mobil hero-layout (#5) | 15 min |
| 6 | Forbattra rapportkort (#6) | 30 min |
| 7 | Mobil sidebar i rapportvy (#8) | 30 min |
| 8 | Ta bort tomma platshallare (#9) | 15 min |
| 9 | Dark mode toggle (#11) | 20 min |
| 10 | Mobil stepper (#12) | 15 min |
| 11 | Pagination (#7) | 30 min |
| 12 | Tillganglighet (#13, #14) | 20 min |

---

## Tekniska detaljer

**Filer som paverkas:**
- `src/pages/Dashboard.tsx` -- fix lankar, statistik, platshallare
- `src/components/layout/Sidebar.tsx` -- ta bort "Ladda upp"
- `src/pages/Reports.tsx` / `src/components/reports/ReportCard.tsx` -- forbattra kortvisning
- `src/pages/InteractiveReportViewer.tsx` -- mobil sidebar
- `src/pages/Analysis.tsx` -- mobil stepper
- `src/components/layout/Header.tsx` -- optional dark mode toggle
- `src/components/documents/DocumentList.tsx` -- pagination
- `src/pages/Chat.tsx` -- dolj eller implementera

Alla andringar ar frontend-only och kraver inga databasandringar.
