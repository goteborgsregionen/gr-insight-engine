

# Rapporter-sidan: Redesign + Listvy

## Problem (synligt i skarmbilden)
- Titlar klipps av ("Analys 2025-...")  och saknar meningsfull info
- Datum wrappas over 4 rader ("Skapad fem manader sedan")
- Korten har ojamn hojd och inkonsekvent layout
- Ingen mojlighet att vaxla till listvy for battre oversikt vid manga rapporter
- "0" visas for claims utan forklaring

---

## Losning

### 1. Ny vy-vaxlare (Grid / List)
Lagg till toggle-knappar (Grid-ikon + List-ikon) bredvid filtren. State `viewMode: 'grid' | 'list'`.

### 2. Redesignat ReportCard (grid-vy)
- **Titel**: Visa hela titeln (ta bort `line-clamp-2`, anvand max 2 rader med `line-clamp-3` istallet)
- **Datum**: Kompakt format med `format(date, 'd MMM yyyy')` istallet for `formatDistanceToNow` (t.ex. "26 feb 2025" istallet for "fem manader sedan")
- **Badges**: Statusbadge + typbadge pa en rad, inte stackade vertikalt
- **Metadata**: En rad: "3 dok | 12 pastaenden | Slutford 26 feb"
- **Knappar**: Behall men flytta ner med tydligare separator

### 3. Ny ReportListItem-komponent (list-vy)
En kompakt tabellrad per rapport:

```text
| Titel (full)         | Typ            | Status   | Dokument | Skapad     | Atgarder      |
| Analys 2025-08-15... | Strategisk     | Slutford | 3        | 26 feb '25 | [Visa] [DL]   |
```

Anvander `Table`-komponenterna som redan finns i projektet.

### 4. Pagination
Lagg till pagination (20 per sida) langst ner, anvander befintliga `Pagination`-komponenter.

---

## Tekniska detaljer

**Filer som andras:**

1. **`src/pages/Reports.tsx`**
   - Lagg till `viewMode` state och toggle-knappar (`LayoutGrid`, `List` fran lucide)
   - Rendera antingen grid (`ReportCard`) eller tabell (`ReportListItem`) baserat pa viewMode
   - Lagg till pagination-logik (20 per sida)

2. **`src/components/reports/ReportCard.tsx`**
   - Byt `formatDistanceToNow` till `format(date, 'd MMM yyyy', { locale: sv })`
   - Omstrukturera layouten: badges i en rad, metadata pa en rad, battre spacing
   - Ta bort emoji-ikoner, anvand Lucide-ikoner for analystyp (BarChart3, DollarSign, Search, ClipboardList)

3. **`src/components/reports/ReportListItem.tsx`** (ny fil)
   - Kompakt tabellrad med samma data och atgarder
   - Samma `session`-prop-interface som ReportCard

