

# Fix: Analys genererar inget användbart resultat

## Problemanalys

Från loggarna ser jag tre samverkande buggar:

### 1. Cachad gammal analys
`analyze-document` loggar "Using cached analysis" — den returnerar den gamla ytliga sammanfattningen istället för att köra med de nya förbättrade prompterna. Trots att vi lade till en "Kör om analys"-knapp har den inte triggats för detta dokument.

### 2. `reason-claims` kraschar med constraint-fel
Prompten berättar för AI:n att använda claim-typer `trend|gap|recommendation|insight|contradiction`, men databasens check constraint tillåter BARA `trend|gap|risk|goal|action|kpi`. AI:n genererar "recommendation"-claims som avvisas av databasen → 0 claims sparas → Detaljer-fliken visar inga påståenden.

### 3. Djupanalysen finns men visas kanske inte korrekt
`deep-analyze-single` kördes och sparade `full_markdown_output` på sessionen. Datan finns i databasen. Men Sammanfattnings-fliken kanske inte renderar den korrekt beroende på hur `result` byggs.

## Åtgärder

### Steg 1: Fixa claim_type-mismatch i `reason-claims`
Uppdatera prompten i `supabase/functions/reason-claims/index.ts` så att den BARA använder de claim-typer som databasens constraint tillåter: `trend|gap|risk|goal|action|kpi`. Ta bort `recommendation`, `insight` och `contradiction` från prompten.

### Steg 2: Uppdatera DB-constraint för att vara mer flexibel
Alternativt (och bättre): utöka check constrainten till att även inkludera `recommendation`, `insight`, `contradiction` — dessa är värdefulla analytiska kategorier. Migration med `ALTER TABLE claims_posts DROP CONSTRAINT ... ADD CONSTRAINT ...`.

### Steg 3: Invalidera cache automatiskt vid ny funktionsversion
I `analyze-document`, lägg till en `analysis_version`-parameter. Om versionen ändras, ignorera cachen. Detta säkerställer att uppgraderade prompter alltid används.

## Plan

Jag rekommenderar **Steg 2** (utöka constrainten) + fixa prompten för att matcha — det ger mest flexibilitet.

### Filer som ändras

| Fil | Ändring |
|-----|---------|
| `supabase/functions/reason-claims/index.ts` | Synka claim-typer med DB |
| DB-migration | Utöka `claims_posts_claim_type_check` att inkludera `recommendation`, `insight`, `contradiction` |
| `supabase/functions/analyze-document/index.ts` | Lägg till versionsbaserad cache-invalidering |

