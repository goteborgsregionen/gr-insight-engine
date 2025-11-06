import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";

interface ExecutiveSummaryCardProps {
  session: {
    title: string;
    created_at: string;
    completed_at?: string;
    analysis_type: string;
    document_ids: string[];
    claims_count?: number;
  };
  summary?: string;
}

export function ExecutiveSummaryCard({ session, summary }: ExecutiveSummaryCardProps) {
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

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-2xl mb-2">{session.title}</CardTitle>
            <Badge variant="default">{getAnalysisTypeLabel()}</Badge>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDistanceToNow(new Date(session.created_at), { addSuffix: true, locale: sv })}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-primary" />
            <div>
              <p className="font-semibold">{session.document_ids.length}</p>
              <p className="text-xs text-muted-foreground">Dokument</p>
            </div>
          </div>
          {session.claims_count && session.claims_count > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-accent" />
              <div>
                <p className="font-semibold">{session.claims_count}</p>
                <p className="text-xs text-muted-foreground">Påståenden</p>
              </div>
            </div>
          )}
          {session.completed_at && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-secondary" />
              <div>
                <p className="text-xs text-muted-foreground">Slutförd</p>
                <p className="text-xs font-medium">
                  {formatDistanceToNow(new Date(session.completed_at), { locale: sv })}
                </p>
              </div>
            </div>
          )}
        </div>

        {summary && (
          <div className="pt-4 border-t">
            <p className="text-sm leading-relaxed">{summary}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}