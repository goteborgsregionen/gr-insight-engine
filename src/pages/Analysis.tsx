import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Loader2, 
  ArrowRight, 
  ArrowLeft, 
  FileSearch,
  DollarSign,
  Shield,
  Target,
  Code,
  BarChart,
  Edit,
  Check,
  Info,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DocumentUploadZone } from "@/components/documents/DocumentUploadZone";
import { ANALYSIS_TEMPLATES, getTemplateById, combinePromptModifiers } from "@/lib/analysisTemplates";
import { cn } from "@/lib/utils";
import { ContextSelector } from "@/components/analysis/ContextSelector";

type AnalysisStep = 1 | 2 | 3;

export default function Analysis() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState<AnalysisStep>(1);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [documentPriorities, setDocumentPriorities] = useState<Record<string, number>>({});
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [editingPromptFor, setEditingPromptFor] = useState<string | null>(null);
  const [showInfoFor, setShowInfoFor] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [selectedContextTemplateIds, setSelectedContextTemplateIds] = useState<string[]>([]);

  // Fetch documents
  const { data: documents, isLoading: isLoadingDocs } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('uploaded_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch recent sessions
  const { data: recentSessions } = useQuery({
    queryKey: ['recent-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analysis_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
  });

  // Start analysis mutation
  const startAnalysisMutation = useMutation({
    mutationFn: async () => {
      const combinedPrompt = combinePromptModifiers(selectedTemplates, customPrompts);
      
      const { data, error } = await supabase.functions.invoke('start-analysis-session', {
        body: {
          documentIds: selectedDocs,
          analysisType: selectedTemplates.join(','),
          customPrompt: combinedPrompt,
          title: `Analys ${new Date().toLocaleDateString('sv-SE')}`,
          analysisTemplates: ANALYSIS_TEMPLATES,
          contextTemplateIds: selectedContextTemplateIds
        },
      });

      if (error) throw error;
      return data;
    },
    onMutate: () => {
      setStep(3);
      setAnalysisProgress(0);
      const interval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);
    },
    onSuccess: (data) => {
      setAnalysisProgress(100);
      toast({
        title: "Analys skapad!",
        description: "Du omdirigeras till analysarbetsytan",
      });
      setTimeout(() => {
        navigate(`/analysis/${data.sessionId}`);
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Fel vid analys",
        description: error.message || "Kunde inte starta analysen",
        variant: "destructive",
      });
      setStep(2);
    },
  });

  const toggleDocSelection = (docId: string) => {
    setSelectedDocs(prev => {
      const newDocs = prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [...prev, docId];
      
      // Set default priority for newly added documents
      if (!prev.includes(docId)) {
        setDocumentPriorities(priorities => ({
          ...priorities,
          [docId]: 3 // Default: Normal priority
        }));
      }
      
      return newDocs;
    });
  };

  const moveDocumentUp = (docId: string) => {
    setSelectedDocs(prev => {
      const index = prev.indexOf(docId);
      if (index > 0) {
        const newDocs = [...prev];
        [newDocs[index - 1], newDocs[index]] = [newDocs[index], newDocs[index - 1]];
        return newDocs;
      }
      return prev;
    });
  };

  const moveDocumentDown = (docId: string) => {
    setSelectedDocs(prev => {
      const index = prev.indexOf(docId);
      if (index < prev.length - 1) {
        const newDocs = [...prev];
        [newDocs[index], newDocs[index + 1]] = [newDocs[index + 1], newDocs[index]];
        return newDocs;
      }
      return prev;
    });
  };

  const setPriority = (docId: string, priority: number) => {
    setDocumentPriorities(prev => ({
      ...prev,
      [docId]: priority
    }));
  };

  const getPriorityLabel = (priority: number): { label: string; variant: "default" | "secondary" | "outline" } => {
    switch(priority) {
      case 1: return { label: "Primär", variant: "default" };
      case 2: return { label: "Hög", variant: "default" };
      case 3: return { label: "Normal", variant: "secondary" };
      case 4: return { label: "Låg", variant: "secondary" };
      case 5: return { label: "Referens", variant: "outline" };
      default: return { label: "Normal", variant: "secondary" };
    }
  };

  const toggleTemplateSelection = (templateId: string) => {
    setSelectedTemplates(prev => {
      if (prev.includes(templateId)) {
        return prev.filter(id => id !== templateId);
      } else if (prev.length < 4) {
        return [...prev, templateId];
      } else {
        toast({
          title: "Max 4 perspektiv",
          description: "Du kan välja max 4 analysperspektiv samtidigt.",
          variant: "destructive",
        });
        return prev;
      }
    });
  };

  const editingTemplate = editingPromptFor ? getTemplateById(editingPromptFor) : null;
  const infoTemplate = showInfoFor ? getTemplateById(showInfoFor) : null;

  const handleStartAnalysis = () => {
    startAnalysisMutation.mutate();
  };

  if (isLoadingDocs) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dokumentanalys</h1>
          <p className="text-muted-foreground mt-2">
            Skapa en ny analys eller fortsätt på en befintlig
          </p>
        </div>

        {/* Recent Sessions */}
        {recentSessions && recentSessions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Senaste analyser</CardTitle>
              <CardDescription>Fortsätt där du slutade</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentSessions.slice(0, 3).map((session: any) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/analysis/${session.id}`)}
                  >
                    <div>
                      <p className="font-medium">{session.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(session.created_at).toLocaleDateString('sv-SE')} • {session.document_ids.length} dokument
                      </p>
                    </div>
                    <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                      {session.status === 'completed' ? 'Slutförd' : 'Utkast'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Wizard Steps */}
        <div className="flex items-center justify-center gap-4 py-6">
          <div className={cn(
            "flex items-center gap-2",
            step >= 1 && "text-primary font-semibold"
          )}>
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center border-2",
              step >= 1 ? "border-primary bg-primary text-primary-foreground" : "border-muted"
            )}>
              1
            </div>
            <span>Välj dokument</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className={cn(
            "flex items-center gap-2",
            step >= 2 && "text-primary font-semibold"
          )}>
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center border-2",
              step >= 2 ? "border-primary bg-primary text-primary-foreground" : "border-muted"
            )}>
              2
            </div>
            <span>Välj perspektiv</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className={cn(
            "flex items-center gap-2",
            step >= 3 && "text-primary font-semibold"
          )}>
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center border-2",
              step >= 3 ? "border-primary bg-primary text-primary-foreground" : "border-muted"
            )}>
              3
            </div>
            <span>Analys</span>
          </div>
        </div>

        {/* Step 1: Select Documents */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Steg 1: Välj dokument</CardTitle>
              <CardDescription>
                Välj ett eller flera dokument att analysera
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!documents || documents.length === 0 ? (
                <div className="text-center py-12">
                  <FileSearch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Inga dokument uppladdade än
                  </p>
                  <Button onClick={() => navigate('/documents/upload')}>
                    Ladda upp dokument
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDocs.length > 0 && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
                      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        Valda dokument ({selectedDocs.length})
                      </h4>
                      <div className="space-y-2">
                        {selectedDocs.map((docId, index) => {
                          const doc = documents.find(d => d.id === docId);
                          if (!doc) return null;
                          const priority = documentPriorities[docId] || 3;
                          const priorityInfo = getPriorityLabel(priority);
                          
                          return (
                            <div
                              key={doc.id}
                              className="flex items-center gap-3 p-3 bg-background border rounded-lg"
                            >
                              <div className="flex flex-col gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => moveDocumentUp(docId)}
                                  disabled={index === 0}
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => moveDocumentDown(docId)}
                                  disabled={index === selectedDocs.length - 1}
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </div>
                              
                              <div className="flex items-center gap-2 min-w-[3rem]">
                                <Badge variant={priorityInfo.variant}>
                                  {priorityInfo.label}
                                </Badge>
                                <span className="text-xs text-muted-foreground font-mono">
                                  #{index + 1}
                                </span>
                              </div>
                              
                              <div className="flex-1">
                                <p className="font-medium text-sm">{doc.title}</p>
                                <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                              </div>
                              
                              <Select
                                value={priority.toString()}
                                onValueChange={(value) => setPriority(docId, parseInt(value))}
                              >
                                <SelectTrigger className="w-[140px] h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">Högst prioritet</SelectItem>
                                  <SelectItem value="2">Hög</SelectItem>
                                  <SelectItem value="3">Normal</SelectItem>
                                  <SelectItem value="4">Låg</SelectItem>
                                  <SelectItem value="5">Referens</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleDocSelection(docId)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                ×
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        💡 <strong>Tips:</strong> Dokument högre upp i listan prioriteras vid motstridiga uppgifter. 
                        Använd pilknapparna för att ändra ordning eller välj prioritetsnivå.
                      </p>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Tillgängliga dokument</h4>
                    {documents.map((doc: any) => {
                      const isSelected = selectedDocs.includes(doc.id);
                      return (
                        <div
                          key={doc.id}
                          className={cn(
                            "flex items-center gap-3 p-3 border rounded-lg transition-colors",
                            isSelected 
                              ? "opacity-50 bg-muted/30" 
                              : "hover:bg-muted/50 cursor-pointer"
                          )}
                          onClick={() => !isSelected && toggleDocSelection(doc.id)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleDocSelection(doc.id)}
                          />
                          <div className="flex-1">
                            <p className="font-medium">{doc.title}</p>
                            <p className="text-sm text-muted-foreground">{doc.file_name}</p>
                          </div>
                          <Badge variant="outline">{doc.file_type}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedDocs.length} dokument valda
              </p>
              <Button
                onClick={() => setStep(2)}
                disabled={selectedDocs.length === 0}
              >
                Nästa: Välj perspektiv
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 2: Select Analysis Perspective */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Steg 2: Välj analysperspektiv</CardTitle>
              <CardDescription>
                Vad vill du fokusera på i analysen?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ContextSelector
                selectedTemplateIds={selectedContextTemplateIds}
                onSelectionChange={setSelectedContextTemplateIds}
                documentIds={selectedDocs}
                analysisType={selectedTemplates.join(',')}
              />
              {selectedTemplates.length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    {selectedTemplates.length} perspektiv valda
                  </span>
                  <div className="flex flex-wrap gap-1 ml-2">
                    {selectedTemplates.map(id => {
                      const template = getTemplateById(id);
                      return template ? (
                        <Badge key={id} variant="secondary" className="text-xs">
                          {template.name}
                          {customPrompts[id] && <span className="ml-1">✏️</span>}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ANALYSIS_TEMPLATES.map((template) => {
                  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
                    'FileSearch': FileSearch,
                    'DollarSign': DollarSign,
                    'Shield': Shield,
                    'Target': Target,
                    'Code': Code,
                    'BarChart': BarChart,
                  };
                  const Icon = iconMap[template.icon] || FileSearch;
                  const isSelected = selectedTemplates.includes(template.id);
                  const hasCustomPrompt = !!customPrompts[template.id];
                  
                  return (
                    <Card
                      key={template.id}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-lg relative",
                        isSelected && "ring-2 ring-primary"
                      )}
                      onClick={() => toggleTemplateSelection(template.id)}
                    >
                      <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleTemplateSelection(template.id)}
                        />
                      </div>
                      {isSelected && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2 h-8 w-8 p-0 z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPromptFor(template.id);
                          }}
                        >
                          <Edit className={cn(
                            "h-4 w-4",
                            hasCustomPrompt && "text-amber-500"
                          )} />
                        </Button>
                      )}
                      <CardContent className="p-6 space-y-3 text-center pt-10">
                        <div className={cn(
                          "w-12 h-12 rounded-full mx-auto flex items-center justify-center",
                          template.color
                        )}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <h4 className="font-semibold">{template.name}</h4>
                          {hasCustomPrompt && (
                            <Badge variant="secondary" className="text-xs">
                              Anpassad
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {template.description}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute bottom-2 right-2 h-8 w-8 p-0 opacity-60 hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowInfoFor(template.id);
                          }}
                        >
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Tillbaka
              </Button>
              <Button
                onClick={handleStartAnalysis}
                disabled={selectedTemplates.length === 0}
              >
                Starta analys
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 3: Analyzing... */}
        {step === 3 && (
          <Card>
            <CardContent className="py-12 text-center space-y-6">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  Analyserar {selectedDocs.length} dokument...
                </h3>
                <p className="text-sm text-muted-foreground">
                  Detta kan ta 30-60 sekunder
                </p>
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <Progress value={analysisProgress} />
                <p className="text-xs text-muted-foreground">
                  {analysisProgress}% färdigt
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Info Dialog */}
      <Dialog open={showInfoFor !== null} onOpenChange={(open) => !open && setShowInfoFor(null)}>
        <DialogContent className="max-w-2xl">
          {infoTemplate && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(() => {
                    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
                      'FileSearch': FileSearch,
                      'DollarSign': DollarSign,
                      'Shield': Shield,
                      'Target': Target,
                      'Code': Code,
                      'BarChart': BarChart,
                    };
                    const Icon = iconMap[infoTemplate.icon] || FileSearch;
                    return <Icon className="h-5 w-5" />;
                  })()}
                  {infoTemplate.name}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Bakgrund och syfte</h4>
                  <p className="text-sm text-muted-foreground">
                    {infoTemplate.fullDescription}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Mervärde</h4>
                  <p className="text-sm text-muted-foreground">
                    {infoTemplate.benefits}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Fokusområden</h4>
                  <div className="flex flex-wrap gap-2">
                    {infoTemplate.keywords.map((keyword) => (
                      <Badge key={keyword} variant="outline">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Prompt Editor Dialog */}
      <Dialog open={editingPromptFor !== null} onOpenChange={(open) => !open && setEditingPromptFor(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Redigera Prompt: {editingTemplate?.name}</DialogTitle>
            <DialogDescription>
              Detta är standardprompten som AI:n använder. Du kan anpassa den för denna analys.
            </DialogDescription>
          </DialogHeader>
          
          {editingTemplate && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">📋 Standardprompt:</p>
                <pre className="text-xs whitespace-pre-wrap font-mono">
                  {editingTemplate.promptModifier}
                </pre>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="custom-prompt">Din anpassade prompt</Label>
                <Textarea
                  id="custom-prompt"
                  value={customPrompts[editingPromptFor!] || editingTemplate.promptModifier}
                  onChange={(e) => setCustomPrompts(prev => ({
                    ...prev,
                    [editingPromptFor!]: e.target.value
                  }))}
                  rows={12}
                  placeholder="Redigera prompten här..."
                  className="font-mono text-sm"
                />
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button
                  onClick={() => {
                    setCustomPrompts(prev => {
                      const newPrompts = {...prev};
                      delete newPrompts[editingPromptFor!];
                      return newPrompts;
                    });
                    toast({
                      title: "Återställd",
                      description: "Prompten har återställts till standard.",
                    });
                  }}
                  variant="outline"
                >
                  Återställ till standard
                </Button>
                <Button onClick={() => {
                  setEditingPromptFor(null);
                  toast({
                    title: "Sparat",
                    description: "Din anpassade prompt har sparats.",
                  });
                }}>
                  Spara ändringar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}