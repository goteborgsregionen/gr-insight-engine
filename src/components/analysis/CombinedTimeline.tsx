import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitCompare, Lightbulb } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";

interface CombinedTimelineProps {
  comparisons: any[] | undefined;
  insights: any[] | undefined;
}

export function CombinedTimeline({ comparisons, insights }: CombinedTimelineProps) {
  // Kombinera och sortera efter created_at
  const events = [
    ...(comparisons || []).map(c => ({ type: 'comparison', data: c, created_at: c.created_at })),
    ...(insights || []).map(i => ({ type: 'insight', data: i, created_at: i.created_at }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (events.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tidslinje</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event, idx) => (
            <div key={idx} className="flex gap-3 items-start">
              <div className="mt-1">
                {event.type === 'comparison' ? (
                  <GitCompare className="h-4 w-4 text-primary" />
                ) : (
                  <Lightbulb className="h-4 w-4 text-yellow-600" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={event.type === 'comparison' ? 'default' : 'secondary'}>
                    {event.type === 'comparison' ? 'Jämförelse' : 'Insikter'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(event.created_at), { 
                      addSuffix: true, 
                      locale: sv 
                    })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {event.type === 'comparison' 
                    ? `${event.data.document_ids.length} dokument jämförda`
                    : `${event.data.analyzed_document_count} dokument analyserade`
                  }
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
