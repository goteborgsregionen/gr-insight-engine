import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, FileText, Edit2, ArrowLeft, Download, AlertCircle, RefreshCw, RotateCcw, Table2, Quote, Hash, Tag, TrendingUp, ShieldAlert, Target } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { ANALYSIS_TEMPLATES } from "@/lib/analysisTemplates";
import ReactMarkdown from "react-markdown";
import { Sprint1TestGuide } from "@/components/analysis/Sprint1TestGuide";

export default function AnalysisWorkspace() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [chatInput, setChatInput] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");

  // Fetch session with polling for processing status
  const { data: session, isLoading } = useQuery({
    queryKey: ['analysis-session', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analysis_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      return data;
    },
    refetchInterval: (query) => {
      // Poll every 3 seconds if status is 'processing'
      return query.state.data?.status === 'processing' ? 3000 : false;
    },
  });

  // Fetch individual analysis results for partial display
  const { data: individualResults } = useQuery({
    queryKey: ['analysis-results', session?.document_ids],
    queryFn: async () => {
      if (!session?.document_ids) return [];
      const { data } = await supabase
        .from('analysis_results')
        .select('*')
        .in('document_id', session.document_ids);
      return data || [];
    },
    enabled: !!session?.document_ids,
  });

  // Fetch queue status for retry functionality
  const { data: queueItems } = useQuery({
    queryKey: ['analysis-queue', session?.document_ids],
    queryFn: async () => {
      if (!session?.document_ids) return [];
      const { data } = await supabase
        .from('analysis_queue')
        .select('*')
        .in('document_id', session.document_ids);
      return data || [];
    },
    enabled: !!session?.document_ids && session?.status === 'processing',
    refetchInterval: session?.status === 'processing' ? 3000 : false,
  });

  // Fetch Sprint 1 test data: claims and evidence
  const { data: claimsData } = useQuery({
    queryKey: ['claims-posts', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claims_posts')
        .select('*')
        .eq('analysis_session_id', sessionId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!sessionId,
  });

  const { data: evidenceData } = useQuery({
    queryKey: ['evidence-posts', session?.document_ids],
    queryFn: async () => {
      if (!session?.document_ids) return [];
      const { data, error } = await supabase
        .from('evidence_posts')
        .select('*')
        .in('document_id', session.document_ids);
      if (error) throw error;
      return data || [];
    },
    enabled: !!session?.document_ids,
  });

  // Calculate Sprint 1 test results
  const sprint1TestResults = session && session.status === 'completed' ? {
    hasClaims: (claimsData?.length || 0) > 0,
    hasEvidence: (evidenceData?.length || 0) > 0,
    hasReasoningSteps: !!(session.analysis_result as any)?.reasoning_steps?.length,
    hasEvidenceStatements: !!(session.analysis_result as any)?.evidence_based_statements?.length,
    claimsCount: claimsData?.length || 0,
    evidenceCount: evidenceData?.length || 0,
    reasoningStepsCount: (session.analysis_result as any)?.reasoning_steps?.length || 0,
    evidenceStatementsCount: (session.analysis_result as any)?.evidence_based_statements?.length || 0,
  } : null;

  useEffect(() => {
    if (session) {
      setEditedTitle(session.title);
    }
  }, [session]);

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const { data, error } = await supabase.functions.invoke('analysis-chat', {
        body: { sessionId, message },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysis-session', sessionId] });
      setChatInput("");
    },
    onError: (error: any) => {
      toast({
        title: "Fel",
        description: error.message || "Kunde inte skicka meddelandet",
        variant: "destructive",
      });
    },
  });

  // Update title mutation
  const updateTitleMutation = useMutation({
    mutationFn: async (newTitle: string) => {
      const { error } = await supabase
        .from('analysis_sessions')
        .update({ title: newTitle })
        .eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysis-session', sessionId] });
      setIsEditingTitle(false);
      toast({
        title: "Sparat",
        description: "Titeln har uppdaterats",
      });
    },
  });

  // Generate report mutation
  const reportMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: { sessionId, format: 'html' },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Create blob and download
      const blob = new Blob([data.html], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.title}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Rapport genererad",
        description: "Rapporten har laddats ner",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fel",
        description: error.message || "Kunde inte generera rapport",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    chatMutation.mutate(chatInput);
  };

  const handleSaveTitle = () => {
    if (!editedTitle.trim()) return;
    updateTitleMutation.mutate(editedTitle);
  };

  // Retry failed document analysis
  const retryMutation = useMutation({
    mutationFn: async (documentId: string) => {
      // Reset queue item status to pending
      const { error: updateError } = await supabase
        .from('analysis_queue')
        .update({ status: 'pending', attempts: 0, error_message: null })
        .eq('document_id', documentId);

      if (updateError) throw updateError;

      // Trigger queue processing
      const { error: invokeError } = await supabase.functions.invoke('process-analysis-queue');
      if (invokeError) throw invokeError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysis-queue', session?.document_ids] });
      queryClient.invalidateQueries({ queryKey: ['analysis-session', sessionId] });
      toast({
        title: "Analys startas om",
        description: "Dokumentet analyseras nu på nytt",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fel",
        description: error.message || "Kunde inte starta om analysen",
        variant: "destructive",
      });
    },
  });

  // Force complete stuck sessions
  const forceCompleteMutation = useMutation({
    mutationFn: async () => {
      if (!session || !individualResults) return;

      const allResults = individualResults;
      const aggregatedResult = {
        type: session.document_ids.length > 1 ? 'comparison' : 'single',
        documents: session.document_ids,
        results: allResults,
        summary: allResults?.[0]?.summary || '',
        keywords: [...new Set(allResults?.flatMap((r: any) => r.keywords || []))],
        extracted_data: {
          markdown_output: allResults.map((r: any) => (r.extracted_data as any)?.markdown_output || r.summary).join('\n\n---\n\n')
        },
        completed_at: new Date().toISOString(),
        partial: allResults.length < session.document_ids.length,
        failed_documents: session.document_ids.filter(
          (id: string) => !allResults?.find((r: any) => r.document_id === id)
        ),
        completed_count: allResults.length,
        total_count: session.document_ids.length,
      };

      const { error } = await supabase
        .from('analysis_sessions')
        .update({
          status: 'completed',
          analysis_result: aggregatedResult,
          completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysis-session', sessionId] });
      toast({
        title: "Session slutförd",
        description: "Sessionen har markerats som slutförd",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fel",
        description: error.message || "Kunde inte slutföra sessionen",
        variant: "destructive",
      });
    },
  });

  // Manual strategic aggregation trigger
  const triggerAggregationMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('aggregate-strategic-analysis', {
        body: { sessionId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysis-session', sessionId] });
      toast({
        title: "Strategisk analys skapad",
        description: "Den omfattande strategiska sammanställningen har genererats",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fel",
        description: error.message || "Kunde inte skapa strategisk sammanställning",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  // Show loading or partial results while processing
  const isProcessing = session?.status === 'processing';
  const hasPartialResults = isProcessing && individualResults && individualResults.length > 0;
  const pendingCount = session?.document_ids.length - (individualResults?.length || 0);
  const failedItems = queueItems?.filter(q => q.status === 'failed') || [];

  if (isProcessing && !hasPartialResults) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/analysis')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Tillbaka till analys
            </Button>
          </div>
          
          <Card>
            <CardContent className="py-16">
              <div className="flex flex-col items-center justify-center space-y-6">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-semibold">Analyserar dokument...</h2>
                  <p className="text-muted-foreground max-w-md">
                    AI:n arbetar med dina {session.document_ids.length} dokument. 
                    Detta kan ta några minuter beroende på dokumentens storlek och komplexitet.
                  </p>
                </div>
                <div className="w-full max-w-md">
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary animate-pulse" style={{ width: '60%' }} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    Sidan uppdateras automatiskt när analysen är klar
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (!session) {
    return (
      <MainLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Session hittades inte</p>
            <Button onClick={() => navigate('/analysis')} className="mt-4">
              Tillbaka till analys
            </Button>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  const result = session.analysis_result as any;
  const template = ANALYSIS_TEMPLATES.find(t => t.id === session.analysis_type);

  return (
    <MainLayout>
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/analysis')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka till analys
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-6">
        {/* Left: Results */}
        <div className="space-y-6">
          {/* Processing Banner */}
          {isProcessing && hasPartialResults && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>
                    Analys pågår för {pendingCount} av {session.document_ids.length} dokument.
                    {failedItems.length > 0 && ` ${failedItems.length} dokument misslyckades.`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Failed Documents Retry */}
          {failedItems.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">{failedItems.length} dokument misslyckades:</p>
                  {failedItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-xs">{item.error_message || 'Okänt fel'}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => retryMutation.mutate(item.document_id)}
                        disabled={retryMutation.isPending}
                      >
                        {retryMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Försök igen
                      </Button>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Strategic Aggregation Trigger */}
          {isProcessing && 
           session.analysis_type === 'strategic' && 
           individualResults && 
           individualResults.length === session.document_ids.length && 
           !result?.strategic_overview && (
            <Alert className="border-primary">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>
                    Alla dokument är analyserade. Skapa nu den strategiska sammanställningen.
                  </span>
                  <Button
                    size="sm"
                    onClick={() => triggerAggregationMutation.mutate()}
                    disabled={triggerAggregationMutation.isPending}
                  >
                    {triggerAggregationMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Skapa Strategisk Sammanställning
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Stuck Session Fix */}
          {isProcessing && 
           session.analysis_type !== 'strategic' && 
           individualResults && 
           individualResults.length === session.document_ids.length && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>
                    Alla dokument är analyserade men sessionen har fastnat. Klicka för att slutföra manuellt.
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => forceCompleteMutation.mutate()}
                    disabled={forceCompleteMutation.isPending}
                  >
                    {forceCompleteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Slutför Manuellt
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Sprint 1 Test Guide - Show for strategic analyses with 2+ documents */}
          {session.analysis_type === 'strategic' && session.document_ids.length >= 2 && (
            <Sprint1TestGuide testResults={sprint1TestResults} />
          )}

          {/* Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {isEditingTitle ? (
                    <div className="flex gap-2">
                      <Input
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSaveTitle()}
                        className="text-2xl font-semibold"
                      />
                      <Button onClick={handleSaveTitle} size="sm">
                        Spara
                      </Button>
                      <Button 
                        onClick={() => {
                          setIsEditingTitle(false);
                          setEditedTitle(session.title);
                        }} 
                        size="sm" 
                        variant="outline"
                      >
                        Avbryt
                      </Button>
                    </div>
                  ) : (
                    <CardTitle className="text-2xl">{session.title}</CardTitle>
                  )}
                  <CardDescription className="mt-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">
                        {session.document_ids.length} dokument
                      </Badge>
                      {template && (
                        <Badge variant="outline" className={template.color}>
                          {template.name}
                        </Badge>
                      )}
                      <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                        {session.status === 'completed' ? 'Slutförd' : 'Utkast'}
                      </Badge>
                      {session.analysis_type === 'strategic' && (
                        <Badge variant="default" className="bg-purple-600">
                          Strategic
                        </Badge>
                      )}
                    </div>
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {!isEditingTitle && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setIsEditingTitle(true)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    onClick={() => reportMutation.mutate()}
                    disabled={reportMutation.isPending}
                  >
                    {reportMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Ladda ner rapport
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="summary">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="summary">Sammanfattning</TabsTrigger>
              <TabsTrigger value="details">Detaljer</TabsTrigger>
              <TabsTrigger value="documents">Dokument</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4">
              {/* Strategic Aggregated Analysis */}
              {result?.type === 'strategic_aggregation' && result.full_markdown_output && !isProcessing ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Strategisk Jämförelseanalys</CardTitle>
                    <CardDescription>
                      Aggregerad analys av {result.document_count} dokument
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{result.full_markdown_output}</ReactMarkdown>
                  </CardContent>
                </Card>
              ) : isProcessing && hasPartialResults ? (
                <>
                  {individualResults.map((result) => (
                    <Card key={result.id}>
                      <CardHeader>
                        <CardTitle>Analysresultat (Delvis)</CardTitle>
                        <CardDescription>
                          Resultat från {individualResults.length} av {session.document_ids.length} dokument
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>
                          {(result.extracted_data as any)?.markdown_output || result.summary}
                        </ReactMarkdown>
                      </CardContent>
                    </Card>
                  ))}
                </>
              ) : !isProcessing && (result?.full_markdown_output || result?.extracted_data?.markdown_output) ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Analysresultat</CardTitle>
                    {result?.full_markdown_output && (
                      <CardDescription>Fördjupad analys</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>
                      {result.full_markdown_output || result.extracted_data.markdown_output}
                    </ReactMarkdown>
                  </CardContent>
                </Card>
              ) : !isProcessing ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Översikt</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground leading-relaxed">
                        {result.summary || 'Ingen sammanfattning tillgänglig'}
                      </p>
                    </CardContent>
                  </Card>

                  {result.key_themes && result.key_themes.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Huvudteman</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {result.key_themes.map((theme: string, idx: number) => (
                            <Badge key={idx} variant="secondary">
                              {theme}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {result.keywords && result.keywords.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Nyckelord</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {result.keywords.map((kw: string, idx: number) => (
                            <Badge key={idx} variant="outline">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                   )}
                </>
              ) : null}
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              {/* Strategic aggregated details */}
              {result?.type === 'strategic_aggregation' && individualResults && individualResults.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Detaljer per dokument</h3>
                  <div className="space-y-4">
                    {individualResults.map((indResult: any) => {
                      const doc = result.documents?.find((d: any) => d.id === indResult.document_id);
                      return (
                        <Card key={indResult.id}>
                          <CardHeader>
                            <CardTitle className="text-base">{doc?.title || doc?.file_name}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {indResult.summary && (
                              <div>
                                <h4 className="font-semibold text-sm mb-1">Sammanfattning</h4>
                                <p className="text-sm text-muted-foreground">{indResult.summary}</p>
                              </div>
                            )}
                            {indResult.keywords && indResult.keywords.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-sm mb-1">Nyckelord</h4>
                                <div className="flex flex-wrap gap-1">
                                  {indResult.keywords.map((keyword: string, idx: number) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {keyword}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Standard details for non-strategic */}
              {(!result?.type || result?.type !== 'strategic_aggregation') && (
                <div className="space-y-4">
                  {/* Re-run analysis button */}
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          // Invalidate cached analysis results
                          for (const docId of session.document_ids) {
                            await supabase
                              .from('analysis_results')
                              .update({ is_valid: false } as any)
                              .eq('document_id', docId);
                          }
                          // Reset session
                          await supabase
                            .from('analysis_sessions')
                            .update({ status: 'processing', analysis_result: {} })
                            .eq('id', sessionId);
                          // Re-trigger pipeline
                          await supabase.functions.invoke('process-analysis-queue');
                          queryClient.invalidateQueries({ queryKey: ['analysis-session', sessionId] });
                          queryClient.invalidateQueries({ queryKey: ['analysis-results', session.document_ids] });
                          toast({ title: "Analys startas om", description: "Analysen körs om med senaste inställningarna" });
                        } catch (e: any) {
                          toast({ title: "Fel", description: e.message, variant: "destructive" });
                        }
                      }}
                      className="gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Kör om analys
                    </Button>
                  </div>

                  {/* Evidence section */}
                  {evidenceData && evidenceData.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Table2 className="h-5 w-5" />
                          Extraherad Evidens
                        </CardTitle>
                        <CardDescription>{evidenceData.length} evidensposter från dokumenten</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {evidenceData.map((ev: any) => (
                          <div key={ev.id} className="p-3 border rounded-lg bg-muted/30 space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{ev.evidence_id}</Badge>
                              <Badge variant="secondary" className="text-xs">{ev.type}</Badge>
                              <span className="text-xs text-muted-foreground">s. {ev.page}</span>
                              {ev.section && <span className="text-xs text-muted-foreground">· {ev.section}</span>}
                            </div>
                            {ev.quote && (
                              <p className="text-sm italic text-muted-foreground flex items-start gap-1">
                                <Quote className="h-3 w-3 mt-1 shrink-0" />
                                {ev.quote}
                              </p>
                            )}
                            {ev.table_ref && (
                              <p className="text-xs text-muted-foreground">{ev.table_ref}</p>
                            )}
                            {ev.headers && Array.isArray(ev.headers) && (
                              <div className="overflow-x-auto">
                                <table className="text-xs border-collapse w-full">
                                  <thead>
                                    <tr>
                                      {(ev.headers as string[]).map((h: string, i: number) => (
                                        <th key={i} className="border px-2 py-1 bg-muted text-left font-medium">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ev.rows && Array.isArray(ev.rows) && (ev.rows as string[][]).slice(0, 5).map((row: string[], ri: number) => (
                                      <tr key={ri}>
                                        {Array.isArray(row) && row.map((cell: string, ci: number) => (
                                          <td key={ci} className="border px-2 py-1">{cell}</td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {ev.rows && Array.isArray(ev.rows) && (ev.rows as string[][]).length > 5 && (
                                  <p className="text-xs text-muted-foreground mt-1">... och {(ev.rows as string[][]).length - 5} fler rader</p>
                                )}
                              </div>
                            )}
                            {ev.notes && <p className="text-xs text-muted-foreground">{ev.notes}</p>}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Claims section */}
                  {claimsData && claimsData.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Target className="h-5 w-5" />
                          Analytiska Påståenden
                        </CardTitle>
                        <CardDescription>{claimsData.length} verifierade påståenden</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {claimsData.map((claim: any) => (
                          <div key={claim.id} className="p-3 border rounded-lg space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">{claim.claim_id}</Badge>
                              <Badge variant="secondary" className="text-xs">{claim.claim_type}</Badge>
                              <Badge 
                                variant={claim.strength === 'strong' ? 'default' : 'outline'} 
                                className="text-xs"
                              >
                                {claim.strength}
                              </Badge>
                              {claim.confidence_score && (
                                <span className="text-xs text-muted-foreground">{Math.round(Number(claim.confidence_score) * 100)}% säkerhet</span>
                              )}
                            </div>
                            <p className="text-sm">{claim.text}</p>
                            {claim.explanation && (
                              <p className="text-xs text-muted-foreground">{claim.explanation}</p>
                            )}
                            {claim.evidence_ids && claim.evidence_ids.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {claim.evidence_ids.map((eid: string, i: number) => (
                                  <Badge key={i} variant="outline" className="text-xs bg-primary/5">{eid}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* KPIs & Business Intelligence from individual results */}
                  {individualResults && individualResults.length > 0 && (() => {
                    const allKpis = individualResults.flatMap((r: any) => 
                      (r.extracted_data as any)?.business_intelligence?.economic_kpis || []
                    );
                    const allRisks = individualResults.flatMap((r: any) => 
                      (r.extracted_data as any)?.business_intelligence?.risks || []
                    );
                    const allGoals = individualResults.flatMap((r: any) => 
                      (r.extracted_data as any)?.business_intelligence?.goals || []
                    );
                    if (allKpis.length === 0 && allRisks.length === 0 && allGoals.length === 0) return null;
                    return (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Nyckeltal & Affärsintelligens
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {allKpis.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                                <Hash className="h-4 w-4" /> Ekonomiska Nyckeltal
                              </h4>
                              <div className="grid gap-2">
                                {allKpis.map((kpi: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between p-2 border rounded bg-muted/30">
                                    <span className="text-sm font-medium">{kpi.metric}</span>
                                    <div className="text-right">
                                      <span className="text-sm font-semibold">{kpi.value}</span>
                                      {kpi.context && <p className="text-xs text-muted-foreground">{kpi.context}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {allGoals.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-sm mb-2">Mål</h4>
                              <ul className="space-y-1">
                                {allGoals.map((g: string, i: number) => (
                                  <li key={i} className="text-sm text-muted-foreground">• {typeof g === 'string' ? g : JSON.stringify(g)}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {allRisks.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                                <ShieldAlert className="h-4 w-4" /> Risker
                              </h4>
                              <ul className="space-y-1">
                                {allRisks.map((r: string, i: number) => (
                                  <li key={i} className="text-sm text-muted-foreground">• {typeof r === 'string' ? r : JSON.stringify(r)}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Themes from individual results */}
                  {individualResults && individualResults.length > 0 && (() => {
                    const allThemes = individualResults.flatMap((r: any) => 
                      (r.extracted_data as any)?.themes?.main_themes || []
                    );
                    const allStrengths = individualResults.flatMap((r: any) => 
                      (r.extracted_data as any)?.themes?.strengths || []
                    );
                    const allChallenges = individualResults.flatMap((r: any) => 
                      (r.extracted_data as any)?.themes?.challenges || []
                    );
                    if (allThemes.length === 0 && allStrengths.length === 0 && allChallenges.length === 0) return null;
                    return (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Tag className="h-5 w-5" />
                            Teman & Insikter
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {allThemes.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-sm mb-2">Huvudteman</h4>
                              <div className="flex flex-wrap gap-2">
                                {allThemes.map((t: string, i: number) => (
                                  <Badge key={i} variant="secondary">{typeof t === 'string' ? t : JSON.stringify(t)}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {allStrengths.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-sm mb-2 text-green-600">Styrkor</h4>
                              <ul className="space-y-1">
                                {allStrengths.map((s: string, i: number) => (
                                  <li key={i} className="text-sm text-muted-foreground">✓ {typeof s === 'string' ? s : JSON.stringify(s)}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {allChallenges.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-sm mb-2 text-amber-600">Utmaningar</h4>
                              <ul className="space-y-1">
                                {allChallenges.map((c: string, i: number) => (
                                  <li key={i} className="text-sm text-muted-foreground">⚠ {typeof c === 'string' ? c : JSON.stringify(c)}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Fallback: old similarities/differences if they exist */}
                  {result?.similarities && result.similarities.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle>Likheter</CardTitle></CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {result.similarities.map((item: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground">• {item}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                  {result?.differences && result.differences.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle>Skillnader</CardTitle></CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {result.differences.map((item: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground">• {item}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Empty state */}
                  {(!evidenceData || evidenceData.length === 0) && 
                   (!claimsData || claimsData.length === 0) && 
                   (!result?.similarities || result.similarities.length === 0) && (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground">Inga detaljer tillgängliga ännu. Kör om analysen för att generera evidens och påståenden.</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Dokument i analysen</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {result.type === 'comparison' && result.documents?.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="p-4 border rounded-lg bg-muted/50"
                      >
                        <h4 className="font-semibold">{doc.title}</h4>
                        <p className="text-sm text-muted-foreground">{doc.file_name}</p>
                      </div>
                    ))}
                    {result.type === 'single' && result.document && (
                      <div className="p-4 border rounded-lg bg-muted/50">
                        <h4 className="font-semibold">{result.document.title}</h4>
                        <p className="text-sm text-muted-foreground">{result.document.file_name}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: AI Chat */}
        <Card className="sticky top-6 h-[calc(100vh-8rem)] flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Djupanalys med AI
            </CardTitle>
            <CardDescription>
              Ställ frågor om analysen för att få djupare insikter
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 min-h-0">
            {/* Chat messages */}
            <ScrollArea className="flex-1 pr-4 mb-4">
              {session.chat_history && session.chat_history.length > 0 ? (
                <div className="space-y-4">
                  {session.chat_history.map((msg: any, idx: number) => (
                    <div
                      key={idx}
                      className={cn(
                        "p-3 rounded-lg",
                        msg.role === 'user'
                          ? "bg-primary/10 ml-8"
                          : "bg-muted mr-8"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))}
                  {chatMutation.isPending && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">AI tänker...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-center">
                  <div>
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">
                      Ställ en fråga för att börja analysera
                    </p>
                  </div>
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Fråga om analysen..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                disabled={chatMutation.isPending}
              />
              <Button
                size="icon"
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || chatMutation.isPending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}