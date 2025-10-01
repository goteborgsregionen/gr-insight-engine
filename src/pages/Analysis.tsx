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
import { 
  Loader2, 
  ArrowRight, 
  ArrowLeft, 
  FileSearch,
  DollarSign,
  Shield,
  Target,
  Code,
  BarChart
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DocumentUploadZone } from "@/components/documents/DocumentUploadZone";
import { ANALYSIS_TEMPLATES, getTemplateById } from "@/lib/analysisTemplates";
import { cn } from "@/lib/utils";

type AnalysisStep = 1 | 2 | 3;

export default function Analysis() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState<AnalysisStep>(1);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('standard');
  const [customPrompt, setCustomPrompt] = useState("");
  const [analysisProgress, setAnalysisProgress] = useState(0);

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
      const template = getTemplateById(selectedTemplate);
      const { data, error } = await supabase.functions.invoke('start-analysis-session', {
        body: {
          documentIds: selectedDocs,
          analysisType: selectedTemplate,
          customPrompt: selectedTemplate === 'custom' ? customPrompt : template?.promptModifier,
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
    setSelectedDocs(prev =>
      prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

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
                <div className="space-y-2">
                  {documents.map((doc: any) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedDocs.includes(doc.id)}
                        onCheckedChange={() => toggleDocSelection(doc.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{doc.title}</p>
                        <p className="text-sm text-muted-foreground">{doc.file_name}</p>
                      </div>
                      <Badge variant="outline">{doc.file_type}</Badge>
                    </div>
                  ))}
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ANALYSIS_TEMPLATES.map((template) => {
                  // Map icon string names to actual Lucide components
                  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
                    'FileSearch': FileSearch,
                    'DollarSign': DollarSign,
                    'Shield': Shield,
                    'Target': Target,
                    'Code': Code,
                    'BarChart': BarChart,
                  };
                  const Icon = iconMap[template.icon] || FileSearch;
                  
                  return (
                    <Card
                      key={template.id}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-md",
                        selectedTemplate === template.id && "border-primary bg-primary/5 ring-2 ring-primary"
                      )}
                      onClick={() => setSelectedTemplate(template.id)}
                    >
                      <CardContent className="pt-6 text-center space-y-3">
                        <div className={cn(
                          "w-12 h-12 rounded-full mx-auto flex items-center justify-center",
                          template.color
                        )}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <h4 className="font-semibold">{template.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {template.description}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {selectedTemplate === 'custom' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Beskriv din analys</label>
                  <Textarea
                    placeholder="Vad vill du fokusera på i analysen? Beskriv specifika aspekter eller frågeställningar..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={4}
                  />
                </div>
              )}
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
                disabled={selectedTemplate === 'custom' && !customPrompt.trim()}
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
    </MainLayout>
  );
}