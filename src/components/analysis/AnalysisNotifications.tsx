import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export function AnalysisNotifications() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to analysis_results changes
    const analysisChannel = supabase
      .channel('analysis-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'analysis_results',
        },
        (payload) => {
          toast({
            title: "Analys klar",
            description: "Ett dokument har analyserats framgångsrikt",
          });
          queryClient.invalidateQueries({ queryKey: ["all-documents"] });
          queryClient.invalidateQueries({ queryKey: ["document-status"] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
        },
        (payload) => {
          const newStatus = payload.new.status;
          const fileName = payload.new.file_name;

          if (newStatus === 'analyzed') {
            toast({
              title: "Dokument analyserat",
              description: `${fileName} har analyserats`,
            });
          } else if (newStatus === 'error') {
            toast({
              title: "Analysfel",
              description: `${fileName} kunde inte analyseras`,
              variant: "destructive",
            });
          }

          queryClient.invalidateQueries({ queryKey: ["all-documents"] });
          queryClient.invalidateQueries({ queryKey: ["document-status"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(analysisChannel);
    };
  }, [queryClient]);

  return null; // This component only handles notifications
}