import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { ExecutiveSummaryCard } from "@/components/reports/ExecutiveSummaryCard";
import { InteractiveTOC } from "@/components/reports/InteractiveTOC";
import ReactMarkdown from "react-markdown";
import { Skeleton } from "@/components/ui/skeleton";

export default function InteractiveReportViewer() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [startTime] = useState(Date.now());

  // Fetch session
  const { data: session, isLoading } = useQuery({
    queryKey: ['report-session', reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analysis_sessions')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Track view on mount and reading time on unmount
  useEffect(() => {
    if (!session) return;

    const trackView = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('report_views')
        .insert({
          session_id: reportId,
          user_id: user.id,
          viewed_at: new Date().toISOString(),
        });
    };

    trackView();

    return () => {
      const updateReadingTime = async () => {
        const readingTimeSeconds = Math.floor((Date.now() - startTime) / 1000);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get the latest view for this session
        const { data: views } = await supabase
          .from('report_views')
          .select('id')
          .eq('session_id', reportId)
          .eq('user_id', user.id)
          .order('viewed_at', { ascending: false })
          .limit(1);

        if (views && views[0]) {
          await supabase
            .from('report_views')
            .update({ reading_time_seconds: readingTimeSeconds })
            .eq('id', views[0].id);
        }
      };

      updateReadingTime();
    };
  }, [reportId, session, startTime]);

  // Download report mutation
  const downloadMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: { sessionId: reportId, format: 'html' },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
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
        title: "Rapport nedladdad",
        description: "Rapporten har laddats ner som HTML-fil",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fel",
        description: error.message || "Kunde inte ladda ner rapporten",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-64 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-6">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!session) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Rapport hittades inte</p>
          <Button onClick={() => navigate('/reports')}>
            Tillbaka till rapporter
          </Button>
        </div>
      </MainLayout>
    );
  }

  const result = session.analysis_result as any;
  const fullMarkdown = result?.full_markdown_output || result?.extracted_data?.markdown_output || '';
  const summary = result?.summary || '';

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/reports')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka till rapporter
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadMutation.mutate()}
            disabled={downloadMutation.isPending}
            className="gap-2"
          >
            {downloadMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Ladda ner HTML
          </Button>
        </div>

        {/* Executive Summary */}
        <ExecutiveSummaryCard session={session} summary={summary} />

        {/* Content with TOC */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-6">
          {/* Main content */}
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children, ...props }) => (
                  <h1 id={`section-${String(children).toLowerCase().replace(/\s+/g, '-')}`} {...props}>
                    {children}
                  </h1>
                ),
                h2: ({ children, ...props }) => (
                  <h2 id={`section-${String(children).toLowerCase().replace(/\s+/g, '-')}`} {...props}>
                    {children}
                  </h2>
                ),
                h3: ({ children, ...props }) => (
                  <h3 id={`section-${String(children).toLowerCase().replace(/\s+/g, '-')}`} {...props}>
                    {children}
                  </h3>
                ),
                table: ({ children, ...props }) => (
                  <div className="overflow-x-auto my-6">
                    <table className="min-w-full divide-y divide-border" {...props}>
                      {children}
                    </table>
                  </div>
                ),
              }}
            >
              {fullMarkdown || 'Inget innehåll tillgängligt'}
            </ReactMarkdown>
          </div>

          {/* Table of Contents */}
          <InteractiveTOC content={fullMarkdown} />
        </div>
      </div>
    </MainLayout>
  );
}