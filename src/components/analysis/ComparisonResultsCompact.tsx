import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";
import { GitCompare, Play } from "lucide-react";

interface ComparisonResultsCompactProps {
  comparison: {
    id: string;
    document_ids: string[];
    comparison_result: any;
    created_at: string;
  };
  onContinue: (documentIds: string[]) => void;
}

export function ComparisonResultsCompact({ comparison, onContinue }: ComparisonResultsCompactProps) {
  const result = comparison.comparison_result;
  const avgSimilarity = result.similarity_matrix?.reduce(
    (acc: number, item: any) => acc + (item.similarity_score || 0), 0
  ) / (result.similarity_matrix?.length || 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <GitCompare className="h-4 w-4" />
              {comparison.document_ids.length} dokument jämförda
            </CardTitle>
            <CardDescription>
              {formatDistanceToNow(new Date(comparison.created_at), { 
                addSuffix: true, 
                locale: sv 
              })}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline">
              {(avgSimilarity * 100).toFixed(0)}% likhet
            </Badge>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => onContinue(comparison.document_ids)}
            >
              <Play className="h-3 w-3 mr-1" />
              Fortsätt analysera
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible>
          <AccordionItem value="summary">
            <AccordionTrigger>Sammanfattning</AccordionTrigger>
            <AccordionContent>
              <p className="text-sm text-muted-foreground">
                {result.comparison_summary}
              </p>
            </AccordionContent>
          </AccordionItem>

          {result.key_insights?.length > 0 && (
            <AccordionItem value="insights">
              <AccordionTrigger>
                Nyckelinsikter ({result.key_insights.length})
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2">
                  {result.key_insights.slice(0, 3).map((insight: string, idx: number) => (
                    <li key={idx} className="text-sm text-muted-foreground">
                      • {insight}
                    </li>
                  ))}
                  {result.key_insights.length > 3 && (
                    <li className="text-xs text-muted-foreground italic">
                      ... och {result.key_insights.length - 3} fler
                    </li>
                  )}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value="details">
            <AccordionTrigger>Alla detaljer</AccordionTrigger>
            <AccordionContent>
              {/* Gemensamma drag */}
              {result.commonalities?.shared_themes?.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">Delade Teman</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.commonalities.shared_themes.map((theme: string, idx: number) => (
                      <Badge key={idx} variant="secondary">{theme}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Skillnader */}
              {result.differences?.unique_themes?.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">Unika Teman</h4>
                  {result.differences.unique_themes.map((item: any, idx: number) => (
                    <div key={idx} className="text-xs text-muted-foreground mb-1">
                      {item.document}: {item.themes?.join(", ")}
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Rekommendationer</h4>
                  <ul className="space-y-1">
                    {result.recommendations.slice(0, 3).map((rec: string, idx: number) => (
                      <li key={idx} className="text-xs text-muted-foreground">
                        {idx + 1}. {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
