import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Download, FileText, BarChart3, DollarSign, Search, ClipboardList, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface ReportCardProps {
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

const analysisTypeConfig: Record<string, { label: string; icon: React.ElementType }> = {
  strategic: { label: "Strategisk", icon: BarChart3 },
  financial: { label: "Finansiell", icon: DollarSign },
  gap: { label: "Gap-analys", icon: Search },
  standard: { label: "Standard", icon: ClipboardList },
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  completed: { label: "Slutförd", variant: "default" },
  processing: { label: "Bearbetas", variant: "secondary" },
  draft: { label: "Utkast", variant: "outline" },
};

export function ReportCard({ session, onDownload, isDownloading }: ReportCardProps) {
  const navigate = useNavigate();
  const typeConf = analysisTypeConfig[session.analysis_type] || analysisTypeConfig.standard;
  const statusConf = statusConfig[session.status] || { label: session.status, variant: "outline" as const };
  const TypeIcon = typeConf.icon;

  const createdDate = format(new Date(session.created_at), "d MMM yyyy", { locale: sv });
  const completedDate = session.completed_at
    ? format(new Date(session.completed_at), "d MMM yyyy", { locale: sv })
    : null;

  // Build metadata string
  const metaParts: string[] = [
    `${session.document_ids.length} dok`,
  ];
  if (session.claims_count && session.claims_count > 0) {
    metaParts.push(`${session.claims_count} påståenden`);
  }
  if (completedDate) {
    metaParts.push(`Slutförd ${completedDate}`);
  }

  return (
    <Card className="hover:shadow-lg transition-shadow flex flex-col">
      <CardContent className="pt-5 pb-4 flex flex-col flex-1 gap-3">
        {/* Badges row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={statusConf.variant}>{statusConf.label}</Badge>
          <Badge variant="secondary" className="text-xs flex items-center gap-1">
            <TypeIcon className="h-3 w-3" />
            {typeConf.label}
          </Badge>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold leading-snug line-clamp-3 flex-1">
          {session.title}
        </h3>

        {/* Metadata row */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
          <FileText className="h-3 w-3 shrink-0" />
          <span>{metaParts.join(" · ")}</span>
        </div>

        {/* Date */}
        <p className="text-xs text-muted-foreground">Skapad {createdDate}</p>

        {/* Actions */}
        <div className="flex gap-2 pt-1 border-t border-border mt-auto">
          <Button
            variant="default"
            size="sm"
            onClick={() => navigate(`/reports/${session.id}`)}
            className="flex-1"
            disabled={session.status !== "completed"}
          >
            <Eye className="h-4 w-4 mr-1.5" />
            Visa
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDownload}
            disabled={isDownloading || session.status !== "completed"}
            aria-label="Ladda ner rapport"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
