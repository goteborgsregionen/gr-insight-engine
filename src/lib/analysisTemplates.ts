import { LucideIcon } from "lucide-react";

export interface AnalysisTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  promptModifier: string;
  focusAreas: string[];
}

export const ANALYSIS_TEMPLATES: AnalysisTemplate[] = [
  {
    id: 'standard',
    name: 'Standard Analys',
    icon: 'FileSearch',
    description: 'Grundläggande analys av dokument',
    color: 'blue',
    promptModifier: '',
    focusAreas: ['summary', 'keywords', 'key_points']
  },
  {
    id: 'economic',
    name: 'Ekonomisk Analys',
    icon: 'DollarSign',
    description: 'Fokus på budgetar, kostnader och ekonomiska KPI:er',
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
