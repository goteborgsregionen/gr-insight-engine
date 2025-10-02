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
    promptModifier: '',
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
EKONOMISKT FOKUS - KRITISKT VIKTIGT:
- Extrahera ALLA budgetsiffror, kostnader och ekonomiska värden
- Hitta ALLA KPI:er relaterade till ekonomi och finans
- Identifiera ROI, cost-benefit, och ekonomiska prognoser
- Notera år, jämförelsevärden och trender
- Markera finansiella risker och möjligheter
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
SÄKERHETSFOKUS - KRITISKT VIKTIGT:
- Identifiera ALLA säkerhetsåtgärder och kontroller
- Hitta hot-scenarier, risker och sårbarheter
- Extrahera compliance-krav (GDPR, ISO27001, etc.)
- Notera säkerhetsincidenter och lärdomar
- Hitta säkerhetsbudget och resurser
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
TEKNISKT FOKUS - KRITISKT VIKTIGT:
- Extrahera tekniska specifikationer och arkitektur
- Identifiera teknologier, plattformar och verktyg
- Hitta tekniska krav och beroenden
- Notera integrationer och API:er
- Identifiera tekniska risker och teknisk skuld
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
KPI-FOKUS - KRITISKT VIKTIGT:
- Extrahera ALLA mätetal och KPI:er
- Hitta målvärden, baseline och actual values
- Identifiera framgångsfaktorer och success criteria
- Notera mätfrekvens och ansvarsfördelning
- Hitta dashboards och rapporteringsstrukturer
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
