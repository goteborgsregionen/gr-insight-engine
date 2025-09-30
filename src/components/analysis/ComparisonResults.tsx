import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ComparisonResultsProps {
  comparison: {
    id: string;
    comparison_result: any;
    created_at: string;
  };
}

export function ComparisonResults({ comparison }: ComparisonResultsProps) {
  const result = comparison.comparison_result;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Jämförelseresultat</CardTitle>
          <CardDescription>
            Skapad {formatDistanceToNow(new Date(comparison.created_at), { 
              addSuffix: true, 
              locale: sv 
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {result.comparison_summary && (
            <div>
              <h3 className="font-semibold mb-2">Sammanfattning</h3>
              <p className="text-sm text-muted-foreground">{result.comparison_summary}</p>
            </div>
          )}

          {result.commonalities && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3">Gemensamma Drag</h3>
                <div className="space-y-4">
                  {result.commonalities.shared_themes?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Delade Teman</h4>
                      <div className="flex flex-wrap gap-2">
                        {result.commonalities.shared_themes.map((theme: string, idx: number) => (
                          <Badge key={idx} variant="secondary">{theme}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.commonalities.shared_keywords?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Gemensamma Nyckelord</h4>
                      <div className="flex flex-wrap gap-2">
                        {result.commonalities.shared_keywords.map((keyword: string, idx: number) => (
                          <Badge key={idx} variant="outline">{keyword}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.commonalities.consistent_priorities?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Konsekventa Prioriteringar</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {result.commonalities.consistent_priorities.map((priority: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground">{priority}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {result.differences && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3">Skillnader</h3>
                <div className="space-y-4">
                  {result.differences.unique_themes?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Unika Teman</h4>
                      {result.differences.unique_themes.map((item: any, idx: number) => (
                        <div key={idx} className="mb-2">
                          <p className="text-sm font-medium">{item.document}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {item.themes?.map((theme: string, themeIdx: number) => (
                              <Badge key={themeIdx} variant="secondary">{theme}</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.differences.diverging_priorities?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Olika Prioriteringar</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {result.differences.diverging_priorities.map((priority: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground">{priority}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {result.similarity_matrix?.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3">Likhetsmatris</h3>
                <div className="space-y-3">
                  {result.similarity_matrix.map((item: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">{item.document_pair}</p>
                        <Badge variant="outline">
                          {(item.similarity_score * 100).toFixed(0)}% likhet
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.similarity_reasoning}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {result.thematic_trends && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3">Tematiska Trender</h3>
                <div className="space-y-4">
                  {result.thematic_trends.emerging_themes?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        Växande Teman
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {result.thematic_trends.emerging_themes.map((theme: string, idx: number) => (
                          <Badge key={idx} className="bg-green-100 text-green-800 hover:bg-green-200">
                            {theme}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.thematic_trends.declining_themes?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-red-600" />
                        Minskande Teman
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {result.thematic_trends.declining_themes.map((theme: string, idx: number) => (
                          <Badge key={idx} className="bg-red-100 text-red-800 hover:bg-red-200">
                            {theme}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.thematic_trends.consistent_themes?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Minus className="h-4 w-4 text-blue-600" />
                        Stabila Teman
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {result.thematic_trends.consistent_themes.map((theme: string, idx: number) => (
                          <Badge key={idx} variant="secondary">{theme}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {result.key_insights?.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3">Nyckelinsikter</h3>
                <ul className="space-y-2">
                  {result.key_insights.map((insight: string, idx: number) => (
                    <li key={idx} className="text-sm p-3 bg-muted/50 rounded-lg">
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {result.recommendations?.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3">Rekommendationer</h3>
                <ul className="space-y-2">
                  {result.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} className="text-sm p-3 bg-primary/5 rounded-lg border border-primary/20">
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
