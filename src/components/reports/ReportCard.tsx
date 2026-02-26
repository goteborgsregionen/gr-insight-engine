import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Eye, Download, Calendar, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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

export function ReportCard({ session, onDownload, isDownloading }: ReportCardProps) {
  const navigate = useNavigate();

  const getStatusBadge = () => {
    switch (session.status) {
      case 'completed':
        return <Badge variant="default">Slutförd</Badge>;
      case 'processing':
        return <Badge variant="secondary">Bearbetas</Badge>;
      case 'draft':
        return <Badge variant="outline">Utkast</Badge>;
      default:
        return <Badge variant="outline">{session.status}</Badge>;
    }
  };

  const getAnalysisTypeLabel = () => {
    switch (session.analysis_type) {
      case 'strategic':
        return 'Strategisk analys';
      case 'financial':
        return 'Finansiell analys';
      case 'gap':
        return 'Gap-analys';
      default:
        return 'Standard analys';
    }
  };

  const getAnalysisIcon = () => {
    switch (session.analysis_type) {
      case 'strategic': return '📊';
      case 'financial': return '💰';
      case 'gap': return '🔍';
      default: return '📋';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg leading-snug line-clamp-2">{session.title}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-2">
              <Calendar className="h-3 w-3 shrink-0" />
              Skapad {formatDistanceToNow(new Date(session.created_at), { addSuffix: true, locale: sv })}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            {getStatusBadge()}
            <Badge variant="secondary" className="text-xs">
              {getAnalysisIcon()} {getAnalysisTypeLabel()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span>{session.document_ids.length} dokument</span>
            </div>
            {session.claims_count && session.claims_count > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{session.claims_count} påståenden</span>
              </div>
            )}
          </div>

          {session.completed_at && (
            <p className="text-xs text-muted-foreground">
              Slutförd {formatDistanceToNow(new Date(session.completed_at), { addSuffix: true, locale: sv })}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate(`/reports/${session.id}`)}
              className="flex-1"
              disabled={session.status !== 'completed'}
            >
              <Eye className="h-4 w-4 mr-2" />
              Visa rapport
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              disabled={isDownloading || session.status !== 'completed'}
              aria-label="Ladda ner rapport"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}