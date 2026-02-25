import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, TrendingUp, ShieldCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { TooltipProvider } from "@/components/ui/tooltip";

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
  evidenceCount?: number;
  claimsCount?: number;
}

export function ExecutiveSummaryCard({ session, summary, evidenceCount = 0, claimsCount = 0 }: ExecutiveSummaryCardProps) {
  const getAnalysisTypeLabel = () => {
    switch (session.analysis_type) {
      case 'strategic': return 'Strategisk analys';
      case 'financial': return 'Finansiell analys';
      case 'gap': return 'Gap-analys';
      default: return 'Standard analys';
    }
  };

  return (
    <TooltipProvider>
      <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-2xl mb-2">{session.title}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="default">{getAnalysisTypeLabel()}</Badge>
                {evidenceCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <ConfidenceBadge sourceCount={evidenceCount} />
                    <span className="text-xs text-muted-foreground">
                      {evidenceCount} evidens
                    </span>
                  </div>
                )}
              </div>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <div>
                <p className="font-semibold">{session.document_ids.length}</p>
                <p className="text-xs text-muted-foreground">Dokument</p>
              </div>
            </div>
            {evidenceCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <div>
                  <p className="font-semibold">{evidenceCount}</p>
                  <p className="text-xs text-muted-foreground">Evidenspunkter</p>
                </div>
              </div>
            )}
            {claimsCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-accent" />
                <div>
                  <p className="font-semibold">{claimsCount}</p>
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
    </TooltipProvider>
  );
}
