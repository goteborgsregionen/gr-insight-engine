import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table2, Quote, Hash, FileText, MapPin } from "lucide-react";
import type { EvidencePost } from "./EvidenceBadge";

interface EvidencePopoverProps {
  evidence: EvidencePost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EvidencePopover({ evidence, open, onOpenChange }: EvidencePopoverProps) {
  if (!evidence) return null;

  const typeIcons: Record<string, typeof Table2> = {
    table: Table2,
    quote: Quote,
    metric: Hash,
  };
  const typeLabels: Record<string, string> = {
    table: "Tabell",
    quote: "Citat",
    metric: "Nyckeltal",
  };

  const Icon = typeIcons[evidence.type] || Hash;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4" />
            {evidence.evidence_id}
            <Badge variant="outline" className="text-xs font-normal">
              {typeLabels[evidence.type] || evidence.type}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Location */}
          <div className="flex items-center gap-4 text-muted-foreground text-xs">
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" /> Sida {evidence.page}
            </span>
            {evidence.section && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {evidence.section}
              </span>
            )}
          </div>

          {/* Quote */}
          {evidence.quote && (
            <blockquote className="border-l-4 border-primary/40 pl-4 italic text-muted-foreground leading-relaxed">
              "{evidence.quote}"
            </blockquote>
          )}

          {/* Table */}
          {evidence.type === "table" && evidence.headers && (
            <div className="overflow-x-auto rounded border">
              <table className="min-w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    {(evidence.headers as string[]).map((h: string, i: number) => (
                      <th key={i} className="px-3 py-2 text-left font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(evidence.rows as string[][])?.map((row: string[], ri: number) => (
                    <tr key={ri} className="border-t">
                      {row.map((cell: string, ci: number) => (
                        <td key={ci} className="px-3 py-1.5">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Table ref */}
          {evidence.table_ref && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Tabellreferens:</span> {evidence.table_ref}
            </p>
          )}

          {/* Unit notes */}
          {evidence.unit_notes && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Enhet:</span> {evidence.unit_notes}
            </p>
          )}

          {/* Notes */}
          {evidence.notes && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Anteckningar:</span> {evidence.notes}
            </p>
          )}

          {/* Source location */}
          <p className="text-[11px] text-muted-foreground/70 pt-2 border-t">
            Källa: {evidence.source_loc}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
