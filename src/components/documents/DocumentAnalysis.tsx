import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AnalysisResults } from "./AnalysisResults";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface DocumentAnalysisProps {
  documentId: string;
}

export function DocumentAnalysis({ documentId }: DocumentAnalysisProps) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch existing analysis
  const { data: analysis, isLoading: isLoadingAnalysis } = useQuery({
    queryKey: ['analysis', documentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analysis_results')
        .select('*')
        .eq('document_id', documentId)
        .order('analyzed_at', { ascending: false })
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Analyze document mutation
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('analyze-document', {
        body: { documentId },
      });

      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysis', documentId] });
      toast({
        title: "Analys klar",
        description: "Dokumentet har analyserats framgångsrikt.",
      });
      setIsExpanded(true);
    },
    onError: (error: Error) => {
      console.error('Analysis error:', error);
      
      let errorMessage = "Kunde inte analysera dokumentet.";
      
      if (error.message.includes('Rate limit')) {
        errorMessage = "För många förfrågningar. Försök igen senare.";
      } else if (error.message.includes('credits')) {
        errorMessage = "AI-krediter slut. Lägg till krediter för att fortsätta.";
      }
      
      toast({
        title: "Fel vid analys",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  if (isLoadingAnalysis) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Kontrollerar analysstatus...</span>
      </div>
    );
  }

  if (!analysis) {
    return (
      <Button
        onClick={() => analyzeMutation.mutate()}
        disabled={analyzeMutation.isPending}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        {analyzeMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyserar...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Analysera dokument
          </>
        )}
      </Button>
    );
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          <span className="font-medium">Analyserad</span>
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            {isExpanded ? "Dölj" : "Visa"} analys
            <ChevronDown 
              className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} 
            />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <AnalysisResults
          summary={analysis.summary}
          keywords={analysis.keywords}
          extracted_data={analysis.extracted_data}
          analyzed_at={analysis.analyzed_at}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
