import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Table as TableIcon, Quote, Hash, Image } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface EvidenceViewerProps {
  documentId: string;
}

export function EvidenceViewer({ documentId }: EvidenceViewerProps) {
  const { data: evidence, isLoading } = useQuery({
    queryKey: ['evidence', documentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evidence_posts')
        .select('*')
        .eq('document_id', documentId)
        .order('page', { ascending: true });

      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!evidence || evidence.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">
            Ingen evidens extraherad ännu. Kör analys för att extrahera evidens.
          </p>
        </CardContent>
      </Card>
    );
  }

  const typeIcons: Record<string, any> = {
    table: TableIcon,
    quote: Quote,
    number: Hash,
    figure: Image,
    section: FileText
  };

  const evidenceByType = {
    table: evidence.filter(e => e.type === 'table'),
    quote: evidence.filter(e => e.type === 'quote'),
    number: evidence.filter(e => e.type === 'number'),
    figure: evidence.filter(e => e.type === 'figure'),
    section: evidence.filter(e => e.type === 'section')
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📊 Extraherad Evidens
          <Badge variant="outline">{evidence.length} posts</Badge>
        </CardTitle>
        <CardDescription>
          Verifierbara fakta extraherade från dokumentet
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">
              Alla ({evidence.length})
            </TabsTrigger>
            {Object.entries(evidenceByType).map(([type, items]) => {
              if (items.length === 0) return null;
              const Icon = typeIcons[type];
              return (
                <TabsTrigger key={type} value={type}>
                  <Icon className="h-4 w-4 mr-2" />
                  {type} ({items.length})
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="all" className="space-y-4 mt-4">
            {evidence.map((item) => (
              <EvidenceCard key={item.id} evidence={item} />
            ))}
          </TabsContent>

          {Object.entries(evidenceByType).map(([type, items]) => (
            <TabsContent key={type} value={type} className="space-y-4 mt-4">
              {items.map((item) => (
                <EvidenceCard key={item.id} evidence={item} />
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function EvidenceCard({ evidence }: { evidence: any }) {
  const Icon = {
    table: TableIcon,
    quote: Quote,
    number: Hash,
    figure: Image,
    section: FileText
  }[evidence.type];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            <Badge variant="outline">{evidence.evidence_id}</Badge>
            <Badge variant="secondary">📄 {evidence.source_loc}</Badge>
          </div>
          <Badge>{evidence.type}</Badge>
        </div>
        {evidence.section && (
          <CardDescription>{evidence.section}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {evidence.type === 'table' && evidence.headers && evidence.rows && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {evidence.headers.map((header: string, i: number) => (
                    <TableHead key={i}>{header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {evidence.rows.map((row: any[], i: number) => (
                  <TableRow key={i}>
                    {row.map((cell, j) => (
                      <TableCell key={j}>{cell}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {evidence.unit_notes && (
              <p className="text-sm text-muted-foreground mt-2">
                Enheter: {evidence.unit_notes}
              </p>
            )}
          </div>
        )}

        {evidence.type === 'quote' && evidence.quote && (
          <blockquote className="border-l-4 border-primary pl-4 italic">
            "{evidence.quote}"
          </blockquote>
        )}

        {evidence.notes && (
          <p className="text-sm text-muted-foreground mt-2">
            📝 {evidence.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
