// critiquePostWrite.ts
// Post-WRITE critique module: validates citation coverage and evidence IDs in generated reports

export type Claim = {
  id: string;
  strength: "high" | "medium" | "low";
  evidence_ids: string[];
};

export type CritiquePostWriteOptions = {
  reportMarkdown: string;
  evidenceIds: string[] | Set<string>;
  claims?: Claim[];
  requiredCoveragePct?: number;
  execSummaryHeadings?: string[];
};

export type SentenceAudit = {
  index: number;
  text: string;
  citations: string[];
  validCitations: string[];
  invalidCitations: string[];
};

export type CritiquePostWriteResult = {
  passed: boolean;
  coveragePct: number;
  totalSentences: number;
  citedSentences: number;
  sentencesMissingCitations: SentenceAudit[];
  sentencesWithInvalidCitations: SentenceAudit[];
  unknownEvidenceIds: string[];
  execSummary: {
    text: string;
    sentences: SentenceAudit[];
    lowStrengthEvidenceIds?: string[];
  };
};

function splitIntoSentences(md: string): string[] {
  const stripped = md
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/^\|.*$/gm, "")
    .replace(/^>.*$/gm, "");
  
  const raw = stripped.split(/(?<=[\.\!\?])\s+/);
  return raw
    .map(s => s.trim())
    .filter(s =>
      s.length > 0 &&
      !s.startsWith("#") &&
      !s.startsWith("* ") &&
      !s.startsWith("- ") &&
      !s.startsWith("_") &&
      !s.startsWith("—")
    );
}

function extractSection(md: string, headings: string[]): string {
  const idx = headings
    .map(h => md.search(new RegExp(`^##\\s+${escapeRegExp(h)}\\b`, "mi")))
    .filter(i => i >= 0)
    .sort((a,b)=>a-b)[0];

  if (idx === undefined || idx < 0) return "";
  const after = md.slice(idx);
  const nextH2 = after.search(/^##\s+/m);
  return nextH2 > 0 ? after.slice(0, nextH2).trim() : after.trim();
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findEvidenceIds(text: string): string[] {
  const ids: string[] = [];
  const re = /\[E-(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    ids.push(`E-${m[1]}`);
  }
  return ids;
}

function auditSentences(
  sentences: string[],
  validEvidence: Set<string>
): SentenceAudit[] {
  return sentences.map((s, i) => {
    const citations = findEvidenceIds(s);
    const validCitations = citations.filter(id => validEvidence.has(id));
    const invalidCitations = citations.filter(id => !validEvidence.has(id));
    return { index: i + 1, text: s, citations, validCitations, invalidCitations };
  });
}

function buildEvidenceStrengthIndex(claims?: Claim[]): Map<string, "high" | "medium" | "low"> {
  const rank = { high: 3, medium: 2, low: 1 } as const;
  const out = new Map<string, "high" | "medium" | "low">();
  if (!claims) return out;

  for (const c of claims) {
    for (const eid of c.evidence_ids || []) {
      const prev = out.get(eid);
      if (!prev || rank[c.strength] > rank[prev]) {
        out.set(eid, c.strength);
      }
    }
  }
  return out;
}

export function critiquePostWrite(opts: CritiquePostWriteOptions): CritiquePostWriteResult {
  const {
    reportMarkdown,
    evidenceIds,
    claims,
    requiredCoveragePct = 95,
    execSummaryHeadings = ["Executive Summary", "Sammanfattning"]
  } = opts;

  const validEvidence = new Set<string>(Array.isArray(evidenceIds) ? evidenceIds : Array.from(evidenceIds));

  const sentences = splitIntoSentences(reportMarkdown);
  const audits = auditSentences(sentences, validEvidence);

  const nonHeadingSentences = audits;
  const cited = nonHeadingSentences.filter(a => a.validCitations.length > 0);
  const sentencesMissing = nonHeadingSentences.filter(a => a.citations.length === 0);
  const sentencesWithInvalid = nonHeadingSentences.filter(a => a.invalidCitations.length > 0);

  const allCitedIds = new Set<string>(nonHeadingSentences.flatMap(a => a.citations));
  const unknownEvidenceIds = Array.from(allCitedIds).filter(id => !validEvidence.has(id));

  const coveragePct = nonHeadingSentences.length === 0
    ? 100
    : Math.round((cited.length / nonHeadingSentences.length) * 1000) / 10;

  const execText = extractSection(reportMarkdown, execSummaryHeadings);
  const execSentences = splitIntoSentences(execText);
  const execAudits = auditSentences(execSentences, validEvidence);

  let lowStrengthInExec: string[] | undefined;
  if (claims && execAudits.length > 0) {
    const idx = buildEvidenceStrengthIndex(claims);
    const execEids = new Set<string>(execAudits.flatMap(a => a.validCitations));
    const lows = Array.from(execEids).filter(eid => idx.get(eid) === "low");
    if (lows.length > 0) lowStrengthInExec = lows;
  }

  const passed =
    coveragePct >= requiredCoveragePct &&
    unknownEvidenceIds.length === 0 &&
    !(lowStrengthInExec && lowStrengthInExec.length > 0);

  return {
    passed,
    coveragePct,
    totalSentences: nonHeadingSentences.length,
    citedSentences: cited.length,
    sentencesMissingCitations: sentencesMissing,
    sentencesWithInvalidCitations: sentencesWithInvalid,
    unknownEvidenceIds,
    execSummary: {
      text: execText,
      sentences: execAudits,
      lowStrengthEvidenceIds: lowStrengthInExec
    }
  };
}
