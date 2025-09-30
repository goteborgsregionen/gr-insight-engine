import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

interface AnalysisProgressProps {
  documentIds?: string[];
}

export function AnalysisProgress({ documentIds }: AnalysisProgressProps) {
  const { data: documents, refetch } = useQuery({
    queryKey: ["document-status", documentIds],
    queryFn: async () => {
      if (!documentIds || documentIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("documents")
        .select("id, file_name, status")
        .in("id", documentIds);

      if (error) throw error;
      return data;
    },
    enabled: !!documentIds && documentIds.length > 0,
    refetchInterval: 2000, // Refetch every 2 seconds
  });

  useEffect(() => {
    if (!documentIds || documentIds.length === 0) return;

    // Subscribe to realtime updates
    const channel = supabase
      .channel('document-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `id=in.(${documentIds.join(',')})`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [documentIds, refetch]);

  if (!documents || documents.length === 0) return null;

  const statusCounts = {
    uploaded: documents.filter(d => d.status === 'uploaded').length,
    analyzing: documents.filter(d => d.status === 'analyzing').length,
    analyzed: documents.filter(d => d.status === 'analyzed').length,
    error: documents.filter(d => d.status === 'error').length,
  };

  const totalDocs = documents.length;
  const completedDocs = statusCounts.analyzed + statusCounts.error;
  const progress = (completedDocs / totalDocs) * 100;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'analyzed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'analyzing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'analyzed':
        return <Badge variant="default" className="bg-green-500">Klar</Badge>;
      case 'analyzing':
        return <Badge variant="secondary">Analyserar...</Badge>;
      case 'error':
        return <Badge variant="destructive">Fel</Badge>;
      default:
        return <Badge variant="outline">Väntar</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Analysstatus</span>
          <span className="text-sm font-normal text-muted-foreground">
            {completedDocs} / {totalDocs} dokument
          </span>
        </CardTitle>
        <CardDescription>
          Realtidsöversikt av dokumentanalys
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total framsteg</span>
            <span className="font-medium">{progress.toFixed(0)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Analyserade: {statusCounts.analyzed}</span>
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 text-blue-500" />
            <span>Pågår: {statusCounts.analyzing}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Väntar: {statusCounts.uploaded}</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            <span>Fel: {statusCounts.error}</span>
          </div>
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          <p className="text-sm font-medium">Dokument:</p>
          {documents.map((doc: any) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-2 rounded-md bg-muted/50"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getStatusIcon(doc.status)}
                <span className="text-sm truncate">{doc.file_name}</span>
              </div>
              {getStatusBadge(doc.status)}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}