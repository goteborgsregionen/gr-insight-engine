import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, Loader2, ShieldCheck, FileText, Printer, PanelRightOpen, PanelRightClose } from "lucide-react";
import { ExecutiveSummaryCard } from "@/components/reports/ExecutiveSummaryCard";
import { InteractiveTOC } from "@/components/reports/InteractiveTOC";
import { EvidenceBadge, type EvidencePost } from "@/components/reports/EvidenceBadge";
import { EvidencePopover } from "@/components/reports/EvidencePopover";
import { SourceReferences } from "@/components/reports/SourceReferences";
import { ConfidenceBadge } from "@/components/reports/ConfidenceBadge";
import { GapAnalysisProgress } from "@/components/reports/GapAnalysisProgress";
import { TrendChart } from "@/components/reports/TrendChart";
import { ShareReportDialog } from "@/components/reports/ShareReportDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import ReactMarkdown from "react-markdown";
import { Skeleton } from "@/components/ui/skeleton";
import type { Components } from "react-markdown";
import React from "react";

// Regex to match [E-001] style references
const EVIDENCE_REGEX = /\[E-\d+\]/g;

function renderTextWithEvidence(
  text: string,
  evidenceMap: Map<string, EvidencePost>,
  onBadgeClick: (ev: EvidencePost) => void
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(EVIDENCE_REGEX);

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const evidenceId = match[0].slice(1, -1); // strip brackets
    const evidence = evidenceMap.get(evidenceId) || null;
    parts.push(
      <EvidenceBadge
        key={`${evidenceId}-${match.index}`}
        evidenceId={evidenceId}
        evidence={evidence}
        onClick={evidence ? () => onBadgeClick(evidence) : undefined}
      />
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

export default function InteractiveReportViewer() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [startTime] = useState(Date.now());
  const [selectedEvidence, setSelectedEvidence] = useState<EvidencePost | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Fetch evidence posts
  const { data: evidencePosts = [] } = useQuery({
    queryKey: ['evidence-posts', session?.document_ids],
    enabled: !!session?.document_ids?.length,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evidence_posts')
        .select('*')
        .in('document_id', session!.document_ids);
      if (error) throw error;
      return (data || []) as EvidencePost[];
    },
  });

  // Fetch claims posts
  const { data: claimsPosts = [] } = useQuery({
    queryKey: ['claims-posts', reportId],
    enabled: !!reportId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claims_posts')
        .select('*')
        .eq('analysis_session_id', reportId);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch document titles for source references
  const { data: documents = [] } = useQuery({
    queryKey: ['doc-titles', session?.document_ids],
    enabled: !!session?.document_ids?.length,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title')
        .in('id', session!.document_ids);
      if (error) throw error;
      return data || [];
    },
  });

  // Build evidence map
  const evidenceMap = useMemo(() => {
    const map = new Map<string, EvidencePost>();
    for (const ep of evidencePosts) {
      map.set(ep.evidence_id, ep);
    }
    return map;
  }, [evidencePosts]);

  const handleBadgeClick = useCallback((ev: EvidencePost) => {
    setSelectedEvidence(ev);
    setPopoverOpen(true);
  }, []);

  // Track view
  useEffect(() => {
    if (!session) return;
    const trackView = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('report_views').insert({
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
        const { data: views } = await supabase
          .from('report_views')
          .select('id')
          .eq('session_id', reportId)
          .eq('user_id', user.id)
          .order('viewed_at', { ascending: false })
          .limit(1);
        if (views && views[0]) {
          await supabase.from('report_views').update({ reading_time_seconds: readingTimeSeconds }).eq('id', views[0].id);
        }
      };
      updateReadingTime();
    };
  }, [reportId, session, startTime]);

  // Download
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
      toast({ title: "Rapport nedladdad", description: "Rapporten har laddats ner som HTML-fil" });
    },
    onError: (error: any) => {
      toast({ title: "Fel", description: error.message || "Kunde inte ladda ner rapporten", variant: "destructive" });
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
          <Button onClick={() => navigate('/reports')}>Tillbaka till rapporter</Button>
        </div>
      </MainLayout>
    );
  }

  const result = session.analysis_result as any;
  const fullMarkdown = result?.full_markdown_output || result?.extracted_data?.markdown_output || '';
  const summary = result?.summary || '';

  // Custom markdown components with evidence injection
  const createTextRenderer = () => {
    const TextRenderer: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
      if (typeof children !== 'string') return <>{children}</>;
      if (!EVIDENCE_REGEX.test(children)) return <>{children}</>;
      return <>{renderTextWithEvidence(children, evidenceMap, handleBadgeClick)}</>;
    };
    return TextRenderer;
  };

  const markdownComponents: Components = {
    h1: ({ children, ...props }) => (
      <h1 id={`section-${String(children).toLowerCase().replace(/\s+/g, '-')}`} {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 id={`section-${String(children).toLowerCase().replace(/\s+/g, '-')}`} {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 id={`section-${String(children).toLowerCase().replace(/\s+/g, '-')}`} {...props}>{children}</h3>
    ),
    table: ({ children, ...props }) => (
      <div className="overflow-x-auto my-6">
        <table className="min-w-full divide-y divide-border" {...props}>{children}</table>
      </div>
    ),
    p: ({ children, ...props }) => {
      // Process children to inject evidence badges
      const processed = React.Children.map(children, (child) => {
        if (typeof child === 'string' && EVIDENCE_REGEX.test(child)) {
          return <>{renderTextWithEvidence(child, evidenceMap, handleBadgeClick)}</>;
        }
        return child;
      });
      return <p {...props}>{processed}</p>;
    },
    li: ({ children, ...props }) => {
      const processed = React.Children.map(children, (child) => {
        if (typeof child === 'string' && EVIDENCE_REGEX.test(child)) {
          return <>{renderTextWithEvidence(child, evidenceMap, handleBadgeClick)}</>;
        }
        return child;
      });
      return <li {...props}>{processed}</li>;
    },
    td: ({ children, ...props }) => {
      const processed = React.Children.map(children, (child) => {
        if (typeof child === 'string' && EVIDENCE_REGEX.test(child)) {
          return <>{renderTextWithEvidence(child, evidenceMap, handleBadgeClick)}</>;
        }
        return child;
      });
      return <td {...props}>{processed}</td>;
    },
  };

  return (
    <TooltipProvider>
      <MainLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate('/reports')} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Tillbaka till rapporter
            </Button>
            <div className="flex gap-2">
              {/* Mobile sidebar toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden gap-2"
                aria-label="Visa sidopanel"
              >
                {sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </Button>
              <ShareReportDialog sessionId={reportId!} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="gap-2"
              >
                <Printer className="h-4 w-4" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadMutation.mutate()}
                disabled={downloadMutation.isPending}
                className="gap-2"
              >
                {downloadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                HTML
              </Button>
            </div>
          </div>

          {/* Executive Summary */}
          <ExecutiveSummaryCard
            session={session}
            summary={summary}
            evidenceCount={evidencePosts.length}
            claimsCount={claimsPosts.length}
          />

          {/* Content with TOC */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-6">
            {/* Main content */}
            <div>
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <ReactMarkdown components={markdownComponents}>
                  {fullMarkdown || 'Inget innehåll tillgängligt'}
                </ReactMarkdown>
              </div>

              {/* Source References */}
              <SourceReferences
                evidencePosts={evidencePosts}
                documents={documents}
                onEvidenceClick={handleBadgeClick}
              />
            </div>

            {/* Sidebar: TOC + Trend Chart + Gap Progress + Evidence summary */}
            <div className={`space-y-4 ${sidebarOpen ? 'block' : 'hidden lg:block'}`}>
              <InteractiveTOC content={fullMarkdown} />

              {/* Trend Chart */}
              {result?.temporal_years && (
                <TrendChart
                  temporalYears={result.temporal_years}
                  claimsPosts={claimsPosts as any[]}
                  kpiConflictsCount={result.kpi_conflicts_count}
                />
              )}

              {/* Gap Analysis Progress */}
              {result?.gap_analysis && (
                <GapAnalysisProgress gapAnalysisMarkdown={result.gap_analysis} />
              )}

              {/* Evidence summary card */}
              {(evidencePosts.length > 0 || claimsPosts.length > 0) && (
                <div className="rounded-lg border p-4 space-y-3 text-sm">
                  <h4 className="font-semibold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Evidenssammanfattning
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{evidencePosts.length}</p>
                        <p className="text-xs text-muted-foreground">Evidenspunkter</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{claimsPosts.length}</p>
                        <p className="text-xs text-muted-foreground">Påståenden</p>
                      </div>
                    </div>
                  </div>
                  {/* Confidence stats */}
                  {result?.claim_confidence_stats && (
                    <div className="text-xs border-t pt-2 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Snitt konfidens</span>
                        <span className="font-medium">{Math.round(result.claim_confidence_stats.avg_confidence)}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Hög konfidens (≥70)</span>
                        <span className="font-medium">{result.claim_confidence_stats.high_confidence}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1 border-t text-xs text-muted-foreground">
                    <ConfidenceBadge sourceCount={evidencePosts.length} />
                    {evidencePosts.length >= 3
                      ? "Hög evidensbasering"
                      : evidencePosts.length >= 1
                      ? "Medel evidensbasering"
                      : "Ingen evidens tillgänglig"}
                  </div>
                </div>
              )}

              {/* Benchmarking info */}
              {result?.benchmarking?.previous_sessions_count > 0 && (
                <div className="rounded-lg border p-4 space-y-2 text-sm">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Benchmarking
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Jämförd mot {result.benchmarking.previous_sessions_count} tidigare {result.benchmarking.previous_sessions_count === 1 ? 'analys' : 'analyser'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Evidence Popover */}
        <EvidencePopover
          evidence={selectedEvidence}
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
        />
      </MainLayout>
    </TooltipProvider>
  );
}
