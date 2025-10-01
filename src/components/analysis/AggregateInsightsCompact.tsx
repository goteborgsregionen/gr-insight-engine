import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";
import { Lightbulb, TrendingUp } from "lucide-react";

interface AggregateInsightsCompactProps {
  insight: {
    id: string;
    insights: any;
    trend_data: any;
    recommendations: string[];
    analyzed_document_count: number;
    created_at: string;
  };
}

export function AggregateInsightsCompact({ insight }: AggregateInsightsCompactProps) {
  const insightsData = insight.insights as any;
  const trendData = insight.trend_data as any;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Aggregerade Insikter
            </CardTitle>
            <CardDescription>
              {formatDistanceToNow(new Date(insight.created_at), { 
                addSuffix: true, 
                locale: sv 
              })} • {insight.analyzed_document_count} dokument
            </CardDescription>
          </div>
          <Badge variant="outline">
            {insightsData?.key_insights?.length || 0} insikter
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible>
          {insightsData?.executive_summary && (
            <AccordionItem value="summary">
              <AccordionTrigger>Sammanfattning</AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground">
                  {insightsData.executive_summary}
                </p>
              </AccordionContent>
            </AccordionItem>
          )}

          {insightsData?.key_insights?.length > 0 && (
            <AccordionItem value="insights">
              <AccordionTrigger>
                Viktiga Insikter ({insightsData.key_insights.length})
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2">
                  {insightsData.key_insights.slice(0, 3).map((insight: string, idx: number) => (
                    <li key={idx} className="text-sm text-muted-foreground">
                      {idx + 1}. {insight}
                    </li>
                  ))}
                  {insightsData.key_insights.length > 3 && (
                    <li className="text-xs text-muted-foreground italic">
                      ... och {insightsData.key_insights.length - 3} fler
                    </li>
                  )}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}

          {trendData && (
            <AccordionItem value="trends">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Trender
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {trendData.emerging_trends?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium mb-1 text-green-600">Växande</h4>
                      <div className="flex flex-wrap gap-1">
                        {trendData.emerging_trends.slice(0, 5).map((trend: string, idx: number) => (
                          <Badge key={idx} variant="default" className="text-xs">{trend}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {trendData.declining_trends?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium mb-1 text-red-600">Minskande</h4>
                      <div className="flex flex-wrap gap-1">
                        {trendData.declining_trends.slice(0, 5).map((trend: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">{trend}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {insight.recommendations?.length > 0 && (
            <AccordionItem value="recommendations">
              <AccordionTrigger>
                Rekommendationer ({insight.recommendations.length})
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-1">
                  {insight.recommendations.slice(0, 3).map((rec: string, idx: number) => (
                    <li key={idx} className="text-sm text-muted-foreground">
                      {idx + 1}. {rec}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
}
