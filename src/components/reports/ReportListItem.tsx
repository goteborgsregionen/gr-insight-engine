import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { Eye, Download, BarChart3, DollarSign, Search, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface ReportListItemProps {
  session: {
    id: string;
    title: string;
    created_at: string;
    completed_at?: string;
    status: string;
    analysis_type: string;
    document_ids: string[];
    claims_count?: number;
  };
  onDownload: () => void;
  isDownloading?: boolean;
}

const typeMap: Record<string, { label: string; icon: React.ElementType }> = {
  strategic: { label: "Strategisk", icon: BarChart3 },
  financial: { label: "Finansiell", icon: DollarSign },
  gap: { label: "Gap-analys", icon: Search },
  standard: { label: "Standard", icon: ClipboardList },
};

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  completed: { label: "Slutförd", variant: "default" },
  processing: { label: "Bearbetas", variant: "secondary" },
  draft: { label: "Utkast", variant: "outline" },
};

export function ReportListItem({ session, onDownload, isDownloading }: ReportListItemProps) {
  const navigate = useNavigate();
  const type = typeMap[session.analysis_type] || typeMap.standard;
  const status = statusMap[session.status] || { label: session.status, variant: "outline" as const };
  const TypeIcon = type.icon;

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="font-medium max-w-[300px]">
        <span className="line-clamp-1">{session.title}</span>
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <TypeIcon className="h-3.5 w-3.5" />
          {type.label}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
      </TableCell>
      <TableCell className="text-center">{session.document_ids.length}</TableCell>
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
        {format(new Date(session.created_at), "d MMM yyyy", { locale: sv })}
      </TableCell>
      <TableCell>
        <div className="flex gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/reports/${session.id}`)}
            disabled={session.status !== "completed"}
            aria-label="Visa rapport"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDownload}
            disabled={isDownloading || session.status !== "completed"}
            aria-label="Ladda ner rapport"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
