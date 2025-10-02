import { LucideIcon } from "lucide-react";

export interface AnalysisTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  fullDescription: string;
  benefits: string;
  keywords: string[];
  color: string;
  promptModifier: string;
  focusAreas: string[];
}

export const ANALYSIS_TEMPLATES: AnalysisTemplate[] = [
  {
    id: 'standard',
    name: 'Standardanalys',
    icon: 'FileSearch',
    description: 'Grundläggande analys av dokument',
    fullDescription: 'Standardanalysen är grunden för all vidare analys. Den ger en övergripande sammanställning och orientering av det material som laddats upp. Syftet är att snabbt förstå innehållet, hitta de mest relevanta delarna och skapa en gemensam kunskapsbas som beslutsfattare kan utgå från.',
    benefits: 'En tidsbesparande sammanfattning, så att GR och kommunerna slipper manuellt läsa och tolka stora datamängder.',
    keywords: ['Sammanfattning', 'Nyckelord', 'Nyckelpunkter'],
    color: 'blue',
    promptModifier: `
ANALYSTYP: Standard
MÅL: Ge en sammanhängande översikt av de markerade dokumenten.

INSTRUKTIONER:
1. Läs och extrahera huvudsyftet med varje dokument.
2. Identifiera:
   - Viktiga aktörer (kommuner, avdelningar, projekt).
   - Centrala mål och prioriteringar.
   - Viktiga beslut, tidslinjer och resultat.
3. Sammanfatta centrala budskap och teman.
4. Sammanfatta om det finns viktiga likheter kontra skillnader kommuner emellan

PRESENTATION:
- Executive Summary (max 1 A4) för beslutsfattare.
- Punktlista med de 5–7 viktigaste temana.
- Tabell med dokument → tema → ansvarig aktör.
- Kort ordlista över återkommande termer.

OUTPUTFORMAT:
Strukturera i markdown med följande sektioner:
## Executive Summary
## Huvudteman
## Viktiga Aktörer
## Dokument-Tema-Karta
## Nyckeltermer
`,
    focusAreas: ['summary', 'keywords', 'key_points']
  },
  {
    id: 'economic',
    name: 'Ekonomisk Analys',
    icon: 'DollarSign',
    description: 'Fokus på budgetar, kostnader och ekonomiska KPI:er',
    fullDescription: 'Ekonomisk analys visar hur resurser fördelas, trender över tid och jämförelser mellan kommuner och nationella nivåer. Analysen fokuserar på att identifiera alla budgetsiffror, kostnader och ekonomiska värden i dokumenten.',
    benefits: 'Ger GR och kommunerna ett datadrivet beslutsunderlag för budgetprioriteringar, effektiv resursanvändning och tidig upptäckt av risker eller avvikelser.',
    keywords: ['Budgetar', 'Kostnader', 'Ekonomiska nyckeltal', 'Avkastning', 'Finansiella trender'],
    color: 'green',
    promptModifier: `
ANALYSTYP: Ekonomisk
MÅL: Analysera budget, kostnader, investeringar och ekonomiska trender.

INSTRUKTIONER:
1. Extrahera relevanta nyckeltal (kostnad/intäkt per invånare, investeringar, driftkostnader).
2. Identifiera trender över tid (5–10 år där möjligt).
3. Jämför mellan kommunerna samt med nationella referenser.
4. Lyft fram riskområden eller avvikelser.
5. Koppla ekonomiska insikter till strategiska prioriteringar.

PRESENTATION:
- Dashboard med KPI:er (använd tabell med indikator, kommun, GR-snitt, trend).
- Top-5 och Botten-5 kommuner inom centrala indikatorer.
- Kortfattade rekommendationer (3–5 punkter) för resursprioritering.

OUTPUTFORMAT:
Strukturera i markdown med följande sektioner:
## Ekonomisk Översikt
## KPI-Dashboard
## Trender och Jämförelser
## Rekommenderade Åtgärder
`,
    focusAreas: ['budgets', 'costs', 'economic_kpis', 'roi', 'financial_trends']
  },
  {
    id: 'security',
    name: 'Säkerhetsanalys',
    icon: 'Shield',
    description: 'Cybersäkerhet, risker och compliance',
    fullDescription: 'Säkerhetsanalysen hjälper GR och kommunerna att förstå risker och sårbarheter, både fysiska och digitala. Den identifierar alla säkerhetsåtgärder, hot-scenarier och compliance-krav i dokumenten.',
    benefits: 'Skapar en förebyggande riskhantering och stärker kommunernas motståndskraft mot hot som kan påverka drift, data och invånarnas trygghet.',
    keywords: ['Säkerhetsåtgärder', 'Risker', 'Compliance', 'Incidenter', 'Säkerhetskontroller'],
    color: 'red',
    promptModifier: `
ANALYSTYP: Säkerhet
MÅL: Identifiera risker och sårbarheter i dokumenten.

INSTRUKTIONER:
1. Identifiera risker inom:
   - IT- och dataskydd.
   - Drift och fysisk infrastruktur.
   - Lag- och standardefterlevnad (GDPR, NIS2).
2. Lista tidigare incidenter eller svagheter.
3. Föreslå riskminskande åtgärder och prioriteringar.

PRESENTATION:
- Riskmatris: sannolikhet × konsekvens.
- Prioriteringslista med risker och föreslagna åtgärder.
- Statusöversikt över kommunernas efterlevnad av standarder.

OUTPUTFORMAT:
Strukturera i markdown med följande sektioner:
## Risköversikt
## Riskmatris
## Prioriterade Åtgärder
## Efterlevnadsstatus
`,
    focusAreas: ['security_measures', 'risks', 'compliance', 'incidents', 'controls']
  },
  {
    id: 'strategic',
    name: 'Strategisk Analys',
    icon: 'Target',
    description: 'Mål, vision och långsiktig planering',
    fullDescription: 'Strategisk analys fokuserar på de långsiktiga prioriteringarna i dokumenten: vilka mål, fokusområden och förändringsbehov som framträder. Analysen identifierar vision, mission och övergripande mål.',
    benefits: 'Hjälper GR att sätta regionala prioriteringar, identifiera gap mellan lokala och regionala ambitioner samt skapa underlag för policyutveckling och samverkansprojekt.',
    keywords: ['Vision', 'Mål', 'Strategiska initiativ', 'Milstolpar', 'Konkurrensfördelar'],
    color: 'purple',
    promptModifier: `
STRATEGISKT FOKUS - KRITISKT VIKTIGT:
- Identifiera vision, mission och övergripande mål
- Extrahera långsiktiga planer och milstones
- Hitta strategiska prioriteringar och initiativ
- Notera konkurrensfördelar och differentiering
- Identifiera strategiska risker och beroenden
`,
    focusAreas: ['vision', 'goals', 'strategic_initiatives', 'milestones', 'competitive_advantages']
  },
  {
    id: 'technical',
    name: 'Teknisk Analys',
    icon: 'Code',
    description: 'Tekniska specifikationer, arkitektur och implementation',
    fullDescription: 'Teknisk analys fokuserar på system, infrastruktur och processer som dokumenten beskriver. Den extraherar tekniska specifikationer, arkitektur och identifierar teknologier, plattformar och verktyg.',
    benefits: 'Upptäcker ineffektivitet, tekniska brister och digitaliseringsmöjligheter, vilket kan bidra till en modernare och mer kostnadseffektiv förvaltning.',
    keywords: ['Tekniska specifikationer', 'Arkitektur', 'Teknologier', 'Integrationer', 'Teknisk skuld'],
    color: 'blue',
    promptModifier: `
ANALYSTYP: Teknisk
MÅL: Kartlägga tekniska system och processer för att hitta förbättringspotential.

INSTRUKTIONER:
1. Identifiera nämnda IT-system och plattformar.
2. Lista processer som idag hanteras manuellt eller ineffektivt.
3. Identifiera bristande interoperabilitet och standarder.
4. Bedöm tekniska risker (föråldrade system, beroenden).

PRESENTATION:
- Systemlandskap med befintliga system och integrationsbehov.
- Processkarta med möjligheter för digitalisering/automatisering.
- Rekommendationslista med prioriterade åtgärder.

OUTPUTFORMAT:
Strukturera i markdown med följande sektioner:
## Teknisk Översikt
## Systemlandskap
## Processkarta
## Rekommenderade Åtgärder
`,
    focusAreas: ['technical_specs', 'architecture', 'technologies', 'integrations', 'technical_debt']
  },
  {
    id: 'kpi_metrics',
    name: 'KPI & Metrics',
    icon: 'BarChart',
    description: 'Mätetal, framgångsfaktorer och performance indicators',
    fullDescription: 'KPI- och metricsanalysen mäter måluppfyllelse och resultat i relation till strategiska och operativa mål. Den extraherar alla mätetal, KPI:er och identifierar framgångsfaktorer.',
    benefits: 'Skapar en mätbar och jämförbar bild av framsteg, vilket stödjer evidensbaserade beslut och prioriteringar.',
    keywords: ['KPI:er', 'Mätetal', 'Målvärden', 'Framgångskriterier', 'Mätfrekvens'],
    color: 'orange',
    promptModifier: `
ANALYSTYP: KPI & Metrics
MÅL: Utvärdera prestationer och måluppfyllelse utifrån befintliga data.

INSTRUKTIONER:
1. Identifiera befintliga KPI:er som rapporteras i dokumenten.
2. Bedöm måluppfyllelse utifrån tillgängliga data.
3. Jämför prestationer mellan kommunerna och mot nationella mål.
4. Föreslå nya KPI:er där mätning saknas.

PRESENTATION:
- KPI-Dashboard med trafikljusmodell (grön/gul/röd) för måluppfyllelse.
- Gap-analys som visar saknade indikatorer eller data.
- Rekommendationer för förbättrad uppföljning.

OUTPUTFORMAT:
Strukturera i markdown med följande sektioner:
## KPI-Översikt
## KPI-Dashboard
## Gap-Analys
## Rekommenderade KPI:er
`,
    focusAreas: ['kpis', 'metrics', 'targets', 'success_criteria', 'measurement_frequency']
  }
];

export function getTemplateById(id: string): AnalysisTemplate | undefined {
  return ANALYSIS_TEMPLATES.find(t => t.id === id);
}

export function getTemplatePromptModifier(type: string, customPrompt?: string): string {
  if (type === 'custom' && customPrompt) {
    return `\n\nANVÄNDAR-SPECIFIKT FOKUS:\n${customPrompt}\n`;
  }
  
  const template = getTemplateById(type);
  return template?.promptModifier || '';
}

export function combinePromptModifiers(
  templateIds: string[], 
  customPrompts: Record<string, string>
): string {
  const prompts = templateIds.map(id => {
    // Use custom prompt if it exists, otherwise use standard
    if (customPrompts[id]) {
      return customPrompts[id];
    }
    const template = getTemplateById(id);
    return template?.promptModifier || '';
  }).filter(Boolean);
  
  return prompts.join('\n\n---\n\n');
}
