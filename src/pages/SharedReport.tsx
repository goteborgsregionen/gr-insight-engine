import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ShieldCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import logoBlack from "@/assets/logo-horizontal-black.png";

export default function SharedReport() {
  const { token } = useParams<{ token: string }>();

  // Fetch shared report by token
  const { data: sharedData, isLoading, error } = useQuery({
    queryKey: ["shared-report", token],
    enabled: !!token,
    queryFn: async () => {
      // Look up share
      const { data: share, error: shareErr } = await supabase
        .from("shared_reports" as any)
        .select("*")
        .eq("share_token", token)
        .eq("is_active", true)
        .single();

      if (shareErr || !share) throw new Error("Delningslänk hittades inte eller har upphört.");

      // Increment view count (best-effort)
      await supabase
        .from("shared_reports" as any)
        .update({ view_count: ((share as any).view_count || 0) + 1 })
        .eq("id", (share as any).id);

      // Fetch session (using service role via the share's session_id)
      const { data: session, error: sessionErr } = await supabase
        .from("analysis_sessions")
        .select("title, analysis_result, analysis_type, created_at, document_ids, completed_at")
        .eq("id", (share as any).session_id)
        .single();

      if (sessionErr) throw new Error("Kunde inte ladda rapporten.");
      return { share, session };
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !sharedData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Rapport ej tillgänglig</h2>
            <p className="text-sm text-muted-foreground">
              {(error as any)?.message || "Delningslänken är ogiltig eller har upphört."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { session } = sharedData;
  const result = session.analysis_result as any;
  const fullMarkdown = result?.full_markdown_output || "";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <img src={logoBlack} alt="Logo" className="h-8" />
          <Badge variant="secondary" className="text-xs">
            Delad rapport
          </Badge>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">{session.title}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{session.document_ids?.length || 0} dokument</span>
              <span>•</span>
              <span>{session.completed_at ? new Date(session.completed_at).toLocaleDateString("sv-SE") : ""}</span>
            </div>
          </div>

          <div className="prose prose-slate dark:prose-invert max-w-none">
            <ReactMarkdown>{fullMarkdown || "Inget innehåll tillgängligt"}</ReactMarkdown>
          </div>

          <div className="border-t pt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Denna rapport delades via en säker länk</span>
          </div>
        </div>
      </main>
    </div>
  );
}
