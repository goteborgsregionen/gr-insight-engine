// kpiConflictScanner.ts
// KPI conflict detection across documents: identifies same KPI with different values

export type KpiPoint = {
  label: string;
  unit: string;
  value: number;
  year?: number;
  actor?: string;
  evidenceId: string;
  docId: string;
  source_loc?: string;
};

export type ConflictIssue = {
  kpiKey: string;
  label: string;
  actor?: string;
  year?: number;
  unit: string;
  points: Array<{ value: number; evidenceId: string; docId: string; source_loc?: string }>;
  deltaAbs: number;
  deltaRelPct?: number;
  severity: "warning" | "error";
  message: string;
};

export type EvidenceTable = {
  evidenceId: string;
  docId: string;
  page?: number;
  table_ref?: string;
  headers: string[];
  rows: Array<Array<string | number | null>>;
  source_loc?: string;
  notes?: string;
};

export type ConflictConfig = {
  percentAbsTolerance?: number;
  currencyRelTolerance?: number;
  generalRelTolerance?: number;
  minDistinctDocs?: number;
  unitAliases?: Record<string, string>;
  currencyScales?: Record<string, number>;
  yearHeaderRegex?: RegExp;
  actorFromContext?: string;
  preferColumnLabels?: boolean;
};

const DEFAULT_CONFIG: ConflictConfig = {
  percentAbsTolerance: 1.5,
  currencyRelTolerance: 0.05,
  generalRelTolerance: 0.05,
  minDistinctDocs: 2,
  unitAliases: {
    "%": "%",
    "percent": "%",
    "procent": "%",
    "sek": "SEK",
    "kr": "SEK",
    "kronor": "SEK",
    "tkr": "tkr",
    "Tkr": "tkr",
    "msek": "MSEK",
    "MSEK": "MSEK",
    "mnkr": "MSEK",
    "MNKR": "MSEK",
    "mkr": "MSEK",
    "Mkr": "MSEK",
    "Mnkr": "MSEK"
  },
  currencyScales: {
    "SEK": 1,
    "tkr": 1_000,
    "MSEK": 1_000_000
  },
  yearHeaderRegex: /(år|year)/i,
  preferColumnLabels: false
};

function slugifyLabel(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_%]/g, "");
}

function normalizeUnit(unit: string, cfg: ConflictConfig): string {
  const map = cfg.unitAliases || {};
  const key = (unit || "").trim();
  return map[key] || map[key.toLowerCase()] || unit || "";
}

function classifyUnit(unit: string): "percent" | "currency" | "other" {
  if (unit === "%") return "percent";
  if (["SEK", "tkr", "MSEK"].includes(unit)) return "currency";
  return "other";
}

function toBaseCurrency(value: number, unit: string, cfg: ConflictConfig): number {
  const scales = cfg.currencyScales || {};
  const scale = scales[unit];
  return typeof scale === "number" ? value * scale : value;
}

function buildKpiKey(point: KpiPoint, canonicalUnit: string): string {
  const parts = [
    slugifyLabel(point.label),
    point.actor ? slugifyLabel(point.actor) : "",
    point.year != null ? String(point.year) : "",
    canonicalUnit
  ];
  return parts.join(":");
}

export function detectConflicts(inputPoints: KpiPoint[], config?: ConflictConfig): ConflictIssue[] {
  const cfg = { ...DEFAULT_CONFIG, ...(config || {}) };

  const groups = new Map<string, {
    meta: { label: string; actor?: string; year?: number; unit: string; unitClass: "percent" | "currency" | "other" };
    points: Array<{ value: number; evidenceId: string; docId: string; source_loc?: string }>;
  }>();

  for (const p of inputPoints) {
    const canonicalUnit = normalizeUnit(p.unit, cfg);
    const unitClass = classifyUnit(canonicalUnit);
    const valueForCompare =
      unitClass === "currency" ? toBaseCurrency(p.value, canonicalUnit, cfg) : p.value;

    const key = buildKpiKey(p, unitClass === "currency" ? "SEK(base)" : canonicalUnit);
    if (!groups.has(key)) {
      groups.set(key, {
        meta: { label: p.label, actor: p.actor, year: p.year, unit: unitClass === "currency" ? "SEK(base)" : canonicalUnit, unitClass },
        points: []
      });
    }
    groups.get(key)!.points.push({
      value: valueForCompare,
      evidenceId: p.evidenceId,
      docId: p.docId,
      source_loc: p.source_loc
    });
  }

  const issues: ConflictIssue[] = [];
  for (const [kpiKey, group] of groups.entries()) {
    const { points, meta } = group;
    if (points.length < 2) continue;

    const distinctDocs = new Set(points.map(p => p.docId)).size;
    if ((cfg.minDistinctDocs || 2) > distinctDocs) continue;

    const values = points.map(p => p.value).sort((a, b) => a - b);
    const minV = values[0];
    const maxV = values[values.length - 1];
    const deltaAbs = maxV - minV;

    let severity: "warning" | "error" | null = null;
    let message = "";
    let deltaRelPct: number | undefined;

    if (meta.unitClass === "percent") {
      const tol = cfg.percentAbsTolerance ?? 1.5;
      if (deltaAbs > tol) {
        severity = deltaAbs > tol * 2 ? "error" : "warning";
        message = `Skillnad i procent över tolerans: Δ=${deltaAbs.toFixed(2)} pp (tolerans ${tol} pp)`;
      }
    } else if (meta.unitClass === "currency") {
      const tol = cfg.currencyRelTolerance ?? 0.05;
      const mean = (minV + maxV) / 2 || 1;
      deltaRelPct = Math.abs(deltaAbs / mean) * 100;
      if (deltaRelPct > tol * 100) {
        severity = deltaRelPct > tol * 200 ? "error" : "warning";
        message = `Relativ skillnad i valuta över tolerans: Δ=${deltaRelPct.toFixed(2)}% (tolerans ${(tol*100).toFixed(1)}%)`;
      }
    } else {
      const tol = cfg.generalRelTolerance ?? 0.05;
      const mean = (minV + maxV) / 2 || 1;
      deltaRelPct = Math.abs(deltaAbs / mean) * 100;
      if (deltaRelPct > tol * 100) {
        severity = deltaRelPct > tol * 200 ? "error" : "warning";
        message = `Relativ skillnad över tolerans: Δ=${deltaRelPct.toFixed(2)}% (tolerans ${(tol*100).toFixed(1)}%)`;
      }
    }

    if (severity) {
      const pointSources = points.map(p => ({
        value: p.value,
        evidenceId: p.evidenceId,
        docId: p.docId,
        source_loc: p.source_loc
      }));
      issues.push({
        kpiKey,
        label: group.meta.label,
        actor: group.meta.actor,
        year: group.meta.year,
        unit: group.meta.unit,
        points: pointSources,
        deltaAbs,
        deltaRelPct,
        severity,
        message
      });
    }
  }

  return issues;
}

export function tablesToKpiPoints(
  tables: EvidenceTable[],
  config?: ConflictConfig
): KpiPoint[] {
  const cfg = { ...DEFAULT_CONFIG, ...(config || {}) };
  const out: KpiPoint[] = [];

  for (const t of tables) {
    if (!t.headers || !t.rows) continue;
    const headers = (t.headers || []).map(h => h ?? "").map(String);
    const yearColIdx = headers.findIndex(h => cfg.yearHeaderRegex!.test(h));
    const canonicalActor = cfg.actorFromContext;

    const candidateValueCols: number[] = [];
    headers.forEach((h, idx) => {
      const hLow = h.toLowerCase();
      const looksPercent = hLow.includes("%") || hLow.includes("andel");
      const looksCurrency = /(msek|mnkr|mkr|kr|sek|tkr)/i.test(h);
      if (looksPercent || looksCurrency) candidateValueCols.push(idx);
    });

    if (candidateValueCols.length === 0) {
      const nRows = Math.min(t.rows.length, 10);
      for (let c = 0; c < headers.length; c++) {
        let numericCount = 0;
        for (let r = 0; r < nRows; r++) {
          const cell = t.rows[r]?.[c];
          if (cell == null) continue;
          const s = String(cell);
          if (/\d/.test(s)) numericCount++;
        }
        if (numericCount >= Math.ceil(nRows * 0.6)) candidateValueCols.push(c);
      }
    }

    for (const row of t.rows) {
      if (!row) continue;
      let year: number | undefined;
      if (yearColIdx >= 0) {
        const yCell = row[yearColIdx];
        if (yCell != null) {
          const m = String(yCell).match(/\b(19|20)\d{2}\b/);
          if (m) year = parseInt(m[0], 10);
        }
      } else {
        for (const cell of row) {
          if (cell == null) continue;
          const m = String(cell).match(/\b(19|20)\d{2}\b/);
          if (m) { year = parseInt(m[0], 10); break; }
        }
      }

      let rowLabel = "";
      if (!cfg.preferColumnLabels) {
        for (let c = 0; c < headers.length; c++) {
          if (c === yearColIdx) continue;
          const cell = row[c];
          if (cell != null) {
            const s = String(cell).trim();
            if (s && !/^\d+([.,]\d+)?\s*%?$/.test(s)) { rowLabel = s; break; }
          }
        }
      }

      for (const cIdx of candidateValueCols) {
        const cell = row[cIdx];
        if (cell == null) continue;
        const valStr = String(cell);
        let unit = "%";
        let value: number | null = null;
        const perc = valStr.match(/([+-]?\d+(?:[.,]\d+)?)\s*%/);
        if (perc) {
          value = parseFloat(perc[1].replace(",", "."));
          unit = "%";
        } else {
          const num = valStr.match(/([+-]?\d+(?:[.,]\d+)?)/);
          if (!num) continue;
          value = parseFloat(num[1].replace(",", "."));
          const h = headers[cIdx] || "";
          const unitFromHeader = (h.match(/\b(MSEK|mnkr|mkr|tkr|SEK|kr)\b/i)?.[0]) || "";
          const unitFromCell = (valStr.match(/\b(MSEK|mnkr|mkr|tkr|SEK|kr)\b/i)?.[0]) || "";
          unit = normalizeUnit(unitFromHeader || unitFromCell || "", cfg) || "value";
        }

        const label = cfg.preferColumnLabels
          ? headers[cIdx] || cfg.actorFromContext || "KPI"
          : (rowLabel || headers[cIdx] || "KPI");

        if (value == null || Number.isNaN(value)) continue;

        out.push({
          label,
          unit,
          value,
          year,
          actor: canonicalActor,
          evidenceId: t.evidenceId,
          docId: t.docId,
          source_loc: t.source_loc
        });
      }
    }
  }

  return out;
}
