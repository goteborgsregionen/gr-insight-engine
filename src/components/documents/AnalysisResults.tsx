import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";
import { Calendar, Tag, Database } from "lucide-react";
import { ANALYSIS_TEMPLATES } from "@/lib/analysisTemplates";
import * as LucideIcons from "lucide-react";

interface AnalysisResultsProps {
  summary: string | null;
  keywords: string[] | null;
  extracted_data: any;
  analyzed_at: string;
  analysis_type?: string;
  custom_prompt?: string;
  analysis_focus?: any;
}

export function AnalysisResults({ 
  summary, 
  keywords, 
  extracted_data, 
  analyzed_at,
  analysis_type = 'standard',
  custom_prompt,
  analysis_focus
}: AnalysisResultsProps) {
  const template = ANALYSIS_TEMPLATES.find(t => t.id === analysis_type);
  const IconComponent = template ? (LucideIcons as any)[template.icon] : null;

  return (
    <div className="space-y-4 mt-4 pl-4 border-l-2 border-primary/20">
      {/* Analysis Type Badge */}
      {template && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {IconComponent && <IconComponent className="h-3 w-3 mr-1" />}
            {template.name}
          </Badge>
          {analysis_focus?.focus_areas && (
            <span className="text-xs text-muted-foreground">
              Fokusområden: {analysis_focus.focus_areas.join(', ')}
            </span>
          )}
        </div>
      )}

      {analysis_type === 'custom' && custom_prompt && (
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">Custom Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground italic">{custom_prompt}</p>
          </CardContent>
        </Card>
      )}

      {/* Timestamp */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span>
          Analyserad {formatDistanceToNow(new Date(analyzed_at), { 
            addSuffix: true, 
            locale: sv 
          })}
        </span>
      </div>

      {/* Summary */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sammanfattning</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Keywords */}
      {keywords && keywords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Nyckelord
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword, index) => (
                <Badge key={index} variant="secondary">
                  {keyword}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extracted Data */}
      {extracted_data && Object.keys(extracted_data).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-4 w-4" />
              Extraherad Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(extracted_data).map(([key, value]) => {
                if (!value) return null;
                
                const displayKey = key.charAt(0).toUpperCase() + key.slice(1);
                
                return (
                  <div key={key}>
                    <div className="font-medium text-sm mb-2">{displayKey}</div>
                    {Array.isArray(value) ? (
                      value.length > 0 ? (
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                          {value.map((item, index) => (
                            <li key={index}>{String(item)}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">Ingen data</p>
                      )
                    ) : typeof value === 'object' ? (
                      <div className="text-sm text-muted-foreground">
                        <pre className="bg-muted p-2 rounded-md overflow-auto">
                          {JSON.stringify(value, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{String(value)}</p>
                    )}
                    <Separator className="mt-3" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
