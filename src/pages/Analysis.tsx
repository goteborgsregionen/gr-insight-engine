import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { Loader2, TrendingUp, GitCompare, FileSearch, Lightbulb } from "lucide-react";
import { ComparisonResults } from "@/components/analysis/ComparisonResults";
import { DocumentUploadZone } from "@/components/documents/DocumentUploadZone";
import { AggregateInsights } from "@/components/analysis/AggregateInsights";
import { ComparisonResultsCompact } from "@/components/analysis/ComparisonResultsCompact";
import { AggregateInsightsCompact } from "@/components/analysis/AggregateInsightsCompact";
import { CombinedTimeline } from "@/components/analysis/CombinedTimeline";
import { AnalysisProgress } from "@/components/analysis/AnalysisProgress";
import { AnalysisNotifications } from "@/components/analysis/AnalysisNotifications";

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

  // Fetch comparison history (5 latest, expandable to 20)
  const [showAllComparisons, setShowAllComparisons] = useState(false);
  const { data: comparisonHistory } = useQuery({
    queryKey: ["comparison-history", showAllComparisons],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comparative_analysis")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(showAllComparisons ? 20 : 5);

      if (error) throw error;
      return data;
    },
  });

  // Fetch insights history (5 latest, expandable to 20)
  const [showAllInsights, setShowAllInsights] = useState(false);
  const { data: insightsHistory } = useQuery({
    queryKey: ["insights-history", showAllInsights],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aggregate_insights")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(showAllInsights ? 20 : 5);

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
      queryClient.invalidateQueries({ queryKey: ["comparison-history"] });
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
      queryClient.invalidateQueries({ queryKey: ["insights-history"] });
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

  // Pre-select documents from a previous comparison
  const handleContinueFromComparison = (documentIds: string[]) => {
    setSelectedDocs(documentIds);
    toast({
      title: "Dokument valda",
      description: `${documentIds.length} dokument från tidigare jämförelse har valts`,
    });
    // Scroll to top where document selection is
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      <AnalysisNotifications />
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

        {selectedDocs.length > 0 && (
          <AnalysisProgress documentIds={selectedDocs} />
        )}

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

        <Tabs defaultValue="work" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="work">
              Arbeta Nu
            </TabsTrigger>
            <TabsTrigger value="history">
              Historik ({(comparisonHistory?.length || 0) + (insightsHistory?.length || 0)})
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Arbeta Nu (nuvarande senaste resultat) */}
          <TabsContent value="work" className="space-y-6">
            {insightsHistory && insightsHistory.length > 0 && (
              <AggregateInsights insight={insightsHistory[0]} />
            )}
            
            {comparisonHistory && comparisonHistory.length > 0 && (
              <ComparisonResults comparison={comparisonHistory[0]} />
            )}

            {!insightsHistory?.length && !comparisonHistory?.length && (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileSearch className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Inga analyser ännu. Jämför dokument eller generera insikter för att komma igång.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab 2: Historik med kompakta komponenter */}
          <TabsContent value="history" className="space-y-6">
            {/* Jämförelser historik */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitCompare className="h-5 w-5" />
                  Tidigare Jämförelser
                </CardTitle>
                <CardDescription>
                  {comparisonHistory?.length || 0} jämförelser
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {comparisonHistory && comparisonHistory.length > 0 ? (
                  <>
                    {comparisonHistory.map((comp) => (
                      <ComparisonResultsCompact 
                        key={comp.id} 
                        comparison={comp}
                        onContinue={handleContinueFromComparison}
                      />
                    ))}
                    
                    {!showAllComparisons && comparisonHistory.length >= 5 && (
                      <Button 
                        variant="outline" 
                        onClick={() => setShowAllComparisons(true)}
                        className="w-full"
                      >
                        Ladda fler jämförelser
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Inga jämförelser ännu
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Insikter historik */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Tidigare Insikter
                </CardTitle>
                <CardDescription>
                  {insightsHistory?.length || 0} insikter
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {insightsHistory && insightsHistory.length > 0 ? (
                  <>
                    {insightsHistory.map((insight) => (
                      <AggregateInsightsCompact key={insight.id} insight={insight} />
                    ))}
                    
                    {!showAllInsights && insightsHistory.length >= 5 && (
                      <Button 
                        variant="outline" 
                        onClick={() => setShowAllInsights(true)}
                        className="w-full"
                      >
                        Ladda fler insikter
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Inga insikter ännu
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Kombinerad tidslinje */}
            <CombinedTimeline 
              comparisons={comparisonHistory} 
              insights={insightsHistory} 
            />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
