import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { Loader2, TrendingUp, GitCompare, FileSearch } from "lucide-react";
import { ComparisonResults } from "@/components/analysis/ComparisonResults";
import { DocumentUploadZone } from "@/components/documents/DocumentUploadZone";
import { AggregateInsights } from "@/components/analysis/AggregateInsights";

export default function Analysis() {
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Fetch all documents
  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ["all-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select(`
          id,
          file_name,
          file_type,
          uploaded_at,
          analysis_results(id, analyzed_at, summary)
        `)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch latest comparison
  const { data: latestComparison } = useQuery({
    queryKey: ["latest-comparison"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comparative_analysis")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Compare documents mutation
  const compareMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      const { data, error } = await supabase.functions.invoke("compare-documents", {
        body: { documentIds },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Jämförelse klar",
        description: "Dokumenten har analyserats och jämförts",
      });
      queryClient.invalidateQueries({ queryKey: ["latest-comparison"] });
      queryClient.invalidateQueries({ queryKey: ["all-documents"] });
      setSelectedDocs([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Jämförelse misslyckades",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Generate insights mutation
  const insightsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-insights", {
        body: {},
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Insikter genererade",
        description: "Aggregerade insikter har skapats från alla dokument",
      });
      queryClient.invalidateQueries({ queryKey: ["aggregate-insights"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Insikter misslyckades",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleDocSelection = (docId: string) => {
    setSelectedDocs((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleCompare = () => {
    if (selectedDocs.length < 2) {
      toast({
        title: "Välj minst 2 dokument",
        description: "Du måste välja minst 2 dokument för att göra en jämförelse",
        variant: "destructive",
      });
      return;
    }
    compareMutation.mutate(selectedDocs);
  };

  if (docsLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Analys</h1>
          <p className="text-muted-foreground">
            Ladda upp och analysera dokument, jämför och hitta trender och insikter
          </p>
        </div>

        <DocumentUploadZone 
          onUploadComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["all-documents"] });
          }}
        />

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5" />
                Jämför Dokument
              </CardTitle>
              <CardDescription>
                Välj 2 eller fler dokument för att göra en djupgående jämförelse
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {!documents || documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Inga dokument finns ännu. Ladda upp dokument först.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {documents.map((doc: any) => (
                        <div
                          key={doc.id}
                          className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50"
                        >
                          <Checkbox
                            id={doc.id}
                            checked={selectedDocs.includes(doc.id)}
                            onCheckedChange={() => toggleDocSelection(doc.id)}
                          />
                          <label
                            htmlFor={doc.id}
                            className="flex-1 text-sm cursor-pointer"
                          >
                            <div className="font-medium">{doc.file_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(doc.uploaded_at).toLocaleDateString("sv-SE")}
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>

                    <Button
                      onClick={handleCompare}
                      disabled={selectedDocs.length < 2 || compareMutation.isPending}
                      className="w-full"
                    >
                      {compareMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Jämför dokument...
                        </>
                      ) : (
                        <>
                          <GitCompare className="mr-2 h-4 w-4" />
                          Jämför {selectedDocs.length} dokument
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Generera Aggregerade Insikter
              </CardTitle>
              <CardDescription>
                Analysera alla dokument tillsammans för att hitta trender och mönster
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Denna funktion analyserar alla dina {documents?.length || 0} dokument
                  tillsammans och identifierar övergripande trender, återkommande teman
                  och strategiska insikter.
                </p>
                <Button
                  onClick={() => insightsMutation.mutate()}
                  disabled={
                    !documents ||
                    documents.length === 0 ||
                    insightsMutation.isPending
                  }
                  className="w-full"
                >
                  {insightsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Genererar insikter...
                    </>
                  ) : (
                    <>
                      <FileSearch className="mr-2 h-4 w-4" />
                      Generera Insikter
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <AggregateInsights />

        {latestComparison && (
          <ComparisonResults comparison={latestComparison} />
        )}
      </div>
    </MainLayout>
  );
}
