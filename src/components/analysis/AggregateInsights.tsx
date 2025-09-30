import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Lightbulb, TrendingUp, AlertCircle, Target } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";

export function AggregateInsights() {
  const { data: insights, isLoading } = useQuery({
    queryKey: ["aggregate-insights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aggregate_insights")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  if (isLoading || !insights) {
    return null;
  }

  const insightsData = insights.insights as any;
  const trendData = insights.trend_data as any;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Aggregerade Insikter
        </CardTitle>
        <CardDescription>
          Genererade {formatDistanceToNow(new Date(insights.created_at), { 
            addSuffix: true, 
            locale: sv 
          })} • Baserat på {insights.analyzed_document_count} dokument
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
            <div className="space-y-2">
              {insightsData.improvement_areas.map((area: string, idx: number) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <Badge variant="secondary" className="mt-0.5">{idx + 1}</Badge>
                  <p className="text-muted-foreground">{area}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Recommendations */}
        {insights.recommendations && insights.recommendations.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Rekommendationer
            </h3>
            <div className="space-y-2">
              {insights.recommendations.map((rec: string, idx: number) => (
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
              <div className="space-y-2">
                {insightsData.anomalies.map((anomaly: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <Badge variant="destructive" className="mt-0.5">!</Badge>
                    <p className="text-muted-foreground">{anomaly}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
