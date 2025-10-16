// tableNumericLinter.ts
// Pre-WRITE numeric linting for table evidence: validates percentages, currencies, and row sums

export type EvidenceTable = {
  evidenceId: string;
  page?: number;
  table_ref?: string;
  headers: string[];
  rows: Array<Array<string | number | null>>;
  source_loc?: string;
  notes?: string;
};

export type LintIssue = {
  evidenceId: string;
  table_ref?: string;
  page?: number;
  rowIndex: number;
  colIndex: number | null;
  value?: string | number | null;
  type: "percent_out_of_range" | "currency_negative" | "row_percent_sum_mismatch";
  severity: "error" | "warning";
  message: string;
  source_loc?: string;
};

export type LintConfig = {
  percentTolerance?: number;
  currencyRegex?: RegExp;
  percentRegex?: RegExp;
  allowNegativeIfRowContains?: string[];
  headerHeuristicsForPercentSum?: string[];
};

const DEFAULT_CONFIG: LintConfig = {
  percentTolerance: 2,
  percentRegex: /^\s*([+-]?\d+(?:[.,]\d+)?)\s*%$/,
  currencyRegex: /\b(?:MSEK|mnkr|mkr|kr|SEK)\b/i,
  allowNegativeIfRowContains: ["underskott", "förlust", "minus"],
  headerHeuristicsForPercentSum: ["andel", "%", "fördelning", "share", "distribution"]
};

function toFloat(strOrNum: string | number): number | null {
  if (typeof strOrNum === "number") return Number.isFinite(strOrNum) ? strOrNum : null;
  if (typeof strOrNum !== "string") return null;
  const s = strOrNum.trim();
  const normalized = s.replace(',', '.');
  const m = normalized.match(/^([+-]?\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function isCurrencyCell(cell: string | number | null, currencyRe: RegExp): boolean {
  if (cell == null) return false;
  const s = String(cell);
  return currencyRe.test(s);
}

function isPercentCell(cell: string | number | null, percentRe: RegExp): { ok: boolean; value?: number } {
  if (cell == null) return { ok: false };
  if (typeof cell === "number") return { ok: false };
  const m = String(cell).match(percentRe);
  if (!m) return { ok: false };
  const v = toFloat(m[1]);
  return (v === null) ? { ok: false } : { ok: true, value: v };
}

function rowLikelyHasPercentSum(headers: string[], cfg: LintConfig): boolean {
  const h = headers.join(" || ").toLowerCase();
  return (cfg.headerHeuristicsForPercentSum || []).some(token => h.includes(token.toLowerCase()));
}

export function lintTables(tables: EvidenceTable[], cfg?: LintConfig): LintIssue[] {
  const C = { ...DEFAULT_CONFIG, ...(cfg || {}) };
  const issues: LintIssue[] = [];

  for (const t of tables) {
    const { headers, rows } = t;
    const percentSumCheck = rowLikelyHasPercentSum(headers, C);

    rows.forEach((row, rIdx) => {
      let rowPercValues: number[] = [];
      const rowText = row.map(x => (x == null ? "" : String(x))).join(" ").toLowerCase();

      row.forEach((cell, cIdx) => {
        const perc = isPercentCell(cell, C.percentRegex!);
        if (perc.ok) {
          if (perc.value! < 0 || perc.value! > 100) {
            issues.push({
              evidenceId: t.evidenceId,
              table_ref: t.table_ref,
              page: t.page,
              rowIndex: rIdx,
              colIndex: cIdx,
              value: cell ?? null,
              type: "percent_out_of_range",
              severity: "error",
              message: `Procent utanför 0–100: ${String(cell)}`,
              source_loc: t.source_loc
            });
          } else {
            rowPercValues.push(perc.value!);
          }
        }

        if (isCurrencyCell(cell, C.currencyRegex!)) {
          const v = toFloat(cell as any);
          if (v !== null && v < 0) {
            const soften = (C.allowNegativeIfRowContains || []).some(token => rowText.includes(token.toLowerCase()));
            issues.push({
              evidenceId: t.evidenceId,
              table_ref: t.table_ref,
              page: t.page,
              rowIndex: rIdx,
              colIndex: cIdx,
              value: cell ?? null,
              type: "currency_negative",
              severity: soften ? "warning" : "error",
              message: soften
                ? `Negativ valuta (tillåts som varning p.g.a. radens kontext): ${String(cell)}`
                : `Negativ valuta hittad: ${String(cell)}`,
              source_loc: t.source_loc
            });
          }
        }
      });

      if (percentSumCheck && rowPercValues.length >= 2) {
        const sum = rowPercValues.reduce((a, b) => a + b, 0);
        const diff = Math.abs(100 - sum);
        if (diff > (C.percentTolerance ?? 2)) {
          issues.push({
            evidenceId: t.evidenceId,
            table_ref: t.table_ref,
            page: t.page,
            rowIndex: rIdx,
            colIndex: null,
            value: `${sum.toFixed(2)}%`,
            type: "row_percent_sum_mismatch",
            severity: "warning",
            message: `Radens procent summerar till ${sum.toFixed(2)}% (tolerans ±${C.percentTolerance} pp)`,
            source_loc: t.source_loc
          });
        }
      }
    });
  }

  return issues;
}
