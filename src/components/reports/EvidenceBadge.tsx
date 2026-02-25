import { Badge } from "@/components/ui/badge";
import { Table2, Quote, Hash } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface EvidencePost {
  id: string;
  evidence_id: string;
  document_id: string;
  type: string;
  page: number;
  section?: string | null;
  table_ref?: string | null;
  quote?: string | null;
  headers?: any | null;
  rows?: any | null;
  unit_notes?: string | null;
  notes?: string | null;
  source_loc: string;
}

interface EvidenceBadgeProps {
  evidenceId: string;
  evidence?: EvidencePost | null;
  onClick?: () => void;
}

const typeConfig: Record<string, { icon: typeof Table2; className: string; label: string }> = {
  table: { icon: Table2, className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 hover:bg-blue-500/25", label: "Tabell" },
  quote: { icon: Quote, className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25", label: "Citat" },
  metric: { icon: Hash, className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/25", label: "Nyckeltal" },
};

export function EvidenceBadge({ evidenceId, evidence, onClick }: EvidenceBadgeProps) {
  const type = evidence?.type || "metric";
  const config = typeConfig[type] || typeConfig.metric;
  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold border cursor-pointer transition-colors ${config.className}`}
        >
          <Icon className="h-3 w-3" />
          {evidenceId}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-[200px]">
        {evidence ? (
          <div>
            <p className="font-semibold">{config.label} — s. {evidence.page}</p>
            {evidence.section && <p className="text-muted-foreground truncate">{evidence.section}</p>}
          </div>
        ) : (
          <p>{evidenceId} (ej hittad)</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
