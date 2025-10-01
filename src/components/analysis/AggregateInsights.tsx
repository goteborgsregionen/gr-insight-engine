import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Lightbulb, TrendingUp, AlertCircle, Target } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";

interface AggregateInsightsProps {
  insight: {
    id: string;
    insights: any;
    trend_data: any;
    recommendations: string[];
    analyzed_document_count: number;
    created_at: string;
  };
}

export function AggregateInsights({ insight }: AggregateInsightsProps) {
  const insightsData = insight.insights as any;
  const trendData = insight.trend_data as any;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Aggregerade Insikter
        </CardTitle>
        <CardDescription>
          Genererade {formatDistanceToNow(new Date(insight.created_at), { 
            addSuffix: true, 
            locale: sv 
          })} • Baserat på {insight.analyzed_document_count} dokument
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Executive Summary */}
        {insightsData?.executive_summary && (
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Sammanfattning
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {insightsData.executive_summary}
            </p>
          </div>
        )}

        <Separator />

        {/* Key Insights */}
        {insightsData?.key_insights && insightsData.key_insights.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Viktiga Insikter
            </h3>
            <div className="space-y-2">
              {insightsData.key_insights.map((insight: string, idx: number) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <Badge variant="outline" className="mt-0.5">{idx + 1}</Badge>
                  <p className="text-muted-foreground">{insight}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Improvement Areas */}
        {insightsData?.improvement_areas && insightsData.improvement_areas.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Förbättringsområden
            </h3>
            <div className="space-y-3">
              {insightsData.improvement_areas.map((item: any, idx: number) => {
                if (typeof item === 'string') {
                  return (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <Badge variant="secondary" className="mt-0.5">{idx + 1}</Badge>
                      <p className="text-muted-foreground">{item}</p>
                    </div>
                  );
                }
                return (
                  <div key={idx} className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{idx + 1}</Badge>
                      {item.area && <span className="font-medium text-sm">{item.area}</span>}
                    </div>
                    {item.current_state && (
                      <p className="text-xs text-muted-foreground">Nuläge: {item.current_state}</p>
                    )}
                    {item.gaps && (
                      <p className="text-xs text-muted-foreground">Luckor: {item.gaps}</p>
                    )}
                    {item.impact && (
                      <p className="text-xs text-muted-foreground">Påverkan: {item.impact}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Separator />

        {/* Recommendations */}
        {insight.recommendations && insight.recommendations.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Rekommendationer
            </h3>
            <div className="space-y-2">
              {insight.recommendations.map((rec: string, idx: number) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <Badge className="mt-0.5">{idx + 1}</Badge>
                  <p className="text-muted-foreground">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trend Data */}
        {trendData && (
          <>
            <Separator />
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Trender
              </h3>
              
              {trendData.emerging_trends && trendData.emerging_trends.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2 text-muted-foreground">Växande trender</h4>
                  <div className="flex flex-wrap gap-2">
                    {trendData.emerging_trends.map((trend: string, idx: number) => (
                      <Badge key={idx} variant="default">{trend}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {trendData.declining_trends && trendData.declining_trends.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2 text-muted-foreground">Avtagande trender</h4>
                  <div className="flex flex-wrap gap-2">
                    {trendData.declining_trends.map((trend: string, idx: number) => (
                      <Badge key={idx} variant="outline">{trend}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {trendData.stable_themes && trendData.stable_themes.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-muted-foreground">Stabila teman</h4>
                  <div className="flex flex-wrap gap-2">
                    {trendData.stable_themes.map((theme: string, idx: number) => (
                      <Badge key={idx} variant="secondary">{theme}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Anomalies */}
        {insightsData?.anomalies && insightsData.anomalies.length > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                Avvikelser
              </h3>
              <div className="space-y-3">
                {insightsData.anomalies.map((item: any, idx: number) => {
                  if (typeof item === 'string') {
                    return (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <Badge variant="destructive" className="mt-0.5">!</Badge>
                        <p className="text-muted-foreground">{item}</p>
                      </div>
                    );
                  }
                  return (
                    <div key={idx} className="p-3 rounded-lg bg-destructive/10 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">!</Badge>
                        {item.anomaly && <span className="font-medium text-sm">{item.anomaly}</span>}
                      </div>
                      {item.location && (
                        <p className="text-xs text-muted-foreground">Plats: {item.location}</p>
                      )}
                      {item.significance && (
                        <p className="text-xs text-muted-foreground">Betydelse: {item.significance}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
