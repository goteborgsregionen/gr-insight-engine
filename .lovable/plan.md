
# Fas 2: Evidensbasering i frontend

## Oversikt
Gor rapporternas pastaenden verifierbara genom att lagga till klickbara evidence badges, en evidence popup-viewer, konfidenspoang och en kallhanvisningssektion direkt i den interaktiva rapportvyn.

## Nya komponenter

### 1. `src/components/reports/EvidenceBadge.tsx`
En liten klickbar badge-komponent som renderas inline i rapporttext. Matchar monstret `[E-001]` i markdown-outputen.
- Visar evidence-ID som en fargkodad badge (bla for tabell, gron for citat, orange for siffra)
- onClick oppnar EvidencePopover med detaljerad information
- Hover-effekt visar kort forhandsvisning (typ + sidnummer)

### 2. `src/components/reports/EvidencePopover.tsx`
En popover/dialog som visar full evidens nar anvandaren klickar pa en badge.
- Visar evidenstyp med ikon (tabell, citat, siffra)
- For tabeller: renderar hela tabellen med headers och rader
- For citat: visar citatet i blockquote-format
- For siffror: visar vardet med enhet
- Visar sidnummer, sektion och eventuella anteckningar
- "Stang"-knapp

### 3. `src/components/reports/ConfidenceBadge.tsx`
Visuell indikator for konfidenspoang pa pastaenden i rapporten.
- Gron cirkel for hog konfidens (3+ kallor)
- Gul cirkel for medel (1-2 kallor)
- Rod/gra for inga kallor
- Hover visar antal kallor

### 4. `src/components/reports/SourceReferences.tsx`
En sektion langst ner i rapporten som listar alla anvanda kallor.
- Grupperar evidens per dokument
- Visar dokument-titel, antal evidenspunkter, och klickbar lista
- Varje evidenspost ar klickbar och oppnar samma EvidencePopover

## Andringar i befintliga filer

### 5. `src/pages/InteractiveReportViewer.tsx`
- Hamta `evidence_posts` och `claims_posts` fran databasen (via session.document_ids)
- Skapa en evidence-map (evidence_id -> evidence object) for snabb uppslagning
- Lagga till en custom ReactMarkdown-komponent for `code` som fangar `[E-001]` monster och renderar EvidenceBadge istallet
- Alternativt: preprocessa markdown-texten och ersatt `[E-001]` med en specialmarkering som ReactMarkdown kan rendera
- Lagga till SourceReferences-sektionen under rapportinnehallet
- Lagga till en "Evidenssammanfattning" i sidopanelen (under TOC) som visar antal evidence och claims

### 6. `src/components/reports/ExecutiveSummaryCard.tsx`
- Lagga till evidence_count (antal unika evidenspunkter) som ny metric
- Visa konfidensindikator baserat pa om claims och evidence finns

## Teknisk design

### Evidence-matching i markdown
Rapportens markdown innehaller redan `[E-001]` referenser (fran aggregate-strategic-analysis Sprint 1). Strategin:

1. Preprocessa markdown-strangen: ersatt `[E-XXX]` med en HTML-markering `<evidence-ref id="E-XXX" />`
2. Anvand ReactMarkdown med `rehypeRaw` for att rendera raw HTML, ELLER
3. Enklare: anvand en custom text-renderer som splittar text pa `[E-XXX]` och injicerar React-komponenter

Vald approach: **Option 3** - custom text renderer i ReactMarkdown's `text`-komponent som splittar pa regex `/\[E-\d+\]/g` och renderar EvidenceBadge-komponenter inline.

### Dataflode

```text
InteractiveReportViewer
  |-- Hamtar session (redan implementerat)
  |-- Hamtar evidence_posts WHERE document_id IN session.document_ids
  |-- Hamtar claims_posts WHERE analysis_session_id = session.id
  |-- Bygger evidenceMap: { "E-001": evidenceObject, ... }
  |-- Skickar evidenceMap till markdown-renderaren
  |-- EvidenceBadge onClick -> oppnar EvidencePopover med data fran evidenceMap
```

### Databas
Inga nya tabeller eller migrationer behovs. Anvander befintliga `evidence_posts` och `claims_posts`.

## Sammanfattning av filer

| Fil | Aktion |
|-----|--------|
| `src/components/reports/EvidenceBadge.tsx` | Ny |
| `src/components/reports/EvidencePopover.tsx` | Ny |
| `src/components/reports/ConfidenceBadge.tsx` | Ny |
| `src/components/reports/SourceReferences.tsx` | Ny |
| `src/pages/InteractiveReportViewer.tsx` | Redigera |
| `src/components/reports/ExecutiveSummaryCard.tsx` | Redigera |
