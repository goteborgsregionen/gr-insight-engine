import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, TrendingUp, CheckCircle, Clock, Upload, GitCompare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { AggregateInsights } from "@/components/analysis/AggregateInsights";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [docsResult, analyzedResult, lastDoc] = await Promise.all([
        supabase.from("documents").select("id", { count: "exact", head: true }),
        supabase.from("analysis_results").select("id", { count: "exact", head: true }),
        supabase
          .from("documents")
          .select("uploaded_at")
          .order("uploaded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      return {
        docsCount: docsResult.count || 0,
        analyzedCount: analyzedResult.count || 0,
        lastActivity: lastDoc?.data?.uploaded_at
          ? formatDate(lastDoc.data.uploaded_at)
          : "Ingen aktivitet",
      };
    },
  });

  // Fetch latest aggregate insights for dashboard
  const { data: latestInsight } = useQuery({
    queryKey: ["latest-insight"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aggregate_insights")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Fetch recent documents
  const { data: recentDocuments } = useQuery({
    queryKey: ["recent-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, file_name, uploaded_at, status")
        .order("uploaded_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  // Fetch recent analyses
  const { data: recentAnalyses } = useQuery({
    queryKey: ["recent-analyses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analysis_results")
        .select("id, analyzed_at, document_id, documents(title)")
        .order("analyzed_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  // Fetch recent comparisons
  const { data: recentComparisons } = useQuery({
    queryKey: ["recent-comparisons-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comparative_analysis")
        .select("id, created_at, document_ids")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const statsCards = [
    {
      title: "Uppladdade dokument",
      value: stats?.docsCount.toString() || "0",
      icon: FileText,
      description: "Totalt antal dokument",
      color: "text-primary",
    },
    {
      title: "Analyserade dokument",
      value: stats?.analyzedCount.toString() || "0",
      icon: CheckCircle,
      description: "AI-analyserade",
      color: "text-accent",
    },
    {
      title: "Genererade rapporter",
      value: "0",
      icon: TrendingUp,
      description: "Totalt antal rapporter",
      color: "text-secondary",
    },
    {
      title: "Senaste aktivitet",
      value: stats?.lastActivity || "Ingen aktivitet",
      icon: Clock,
      description: stats?.lastActivity && stats.lastActivity !== "Ingen aktivitet" ? "" : "Ingen aktivitet än",
      color: "text-muted-foreground",
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Välkommen till AI-baserad dokumentanalys för Göteborgsregionen
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Översikt</TabsTrigger>
            <TabsTrigger value="activity">Aktivitet</TabsTrigger>
            <TabsTrigger value="stats">Statistik</TabsTrigger>
          </TabsList>

          {/* Tab 1: Översikt */}
          <TabsContent value="overview" className="space-y-6">
            {/* Hero-sektion baserad på progress */}
            {isLoading ? (
              <Card className="border-2 border-dashed">
                <CardContent className="pt-12 pb-12 text-center">
                  <Skeleton className="h-16 w-16 mx-auto mb-4" />
                  <Skeleton className="h-8 w-64 mx-auto mb-2" />
                  <Skeleton className="h-4 w-96 mx-auto mb-6" />
                  <Skeleton className="h-10 w-48 mx-auto" />
                </CardContent>
              </Card>
            ) : stats?.docsCount === 0 ? (
              <Card className="border-2 border-dashed">
                <CardContent className="pt-12 pb-12 text-center">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h2 className="text-2xl font-bold mb-2">Välkommen till dokumentanalys</h2>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Börja med att ladda upp dina första dokument för AI-driven analys
                  </p>
                  <Button size="lg" asChild>
                    <Link to="/upload">
                      <Upload className="mr-2 h-5 w-5" />
                      Ladda upp dokument
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold mb-1">
                        Du har {stats?.docsCount} dokument uppladdade
                      </h2>
                      <p className="text-muted-foreground">
                        {stats?.analyzedCount} analyserade • Senaste aktivitet: {stats?.lastActivity}
                      </p>
                    </div>
                    <Button asChild>
                      <Link to="/upload">
                        <Upload className="mr-2 h-4 w-4" />
                        Ladda upp fler
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-3">
              <Link to="/upload">
                <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                  <CardHeader>
                    <FileText className="h-8 w-8 mb-2 text-primary" />
                    <CardTitle className="text-lg">Ladda upp dokument</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Börja med att ladda upp PDF, Word eller Excel-filer
                    </p>
                  </CardContent>
                </Card>
              </Link>

              <Link to="/analysis">
                <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                  <CardHeader>
                    <GitCompare className="h-8 w-8 mb-2 text-primary" />
                    <CardTitle className="text-lg">Jämför dokument</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Hitta mönster och skillnader mellan dokument
                    </p>
                  </CardContent>
                </Card>
              </Link>

              <Link to="/reports">
                <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                  <CardHeader>
                    <TrendingUp className="h-8 w-8 mb-2 text-primary" />
                    <CardTitle className="text-lg">Generera rapport</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Skapa professionella rapporter med GR:s profil
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </div>

            {/* Kom igång-guide (bara för nya användare) */}
            {stats?.docsCount === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Kom igång</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      1
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Ladda upp dokument</h3>
                      <p className="text-sm text-muted-foreground">
                        Börja med att ladda upp dina första dokument (PDF, Word, Excel)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      2
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">AI-analys</h3>
                      <p className="text-sm text-muted-foreground">
                        Låt AI:n analysera dokumenten och extrahera viktig information
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      3
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Generera rapporter</h3>
                      <p className="text-sm text-muted-foreground">
                        Skapa professionella rapporter med GR:s grafiska profil
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab 2: Aktivitet */}
          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Senaste aktivitet</CardTitle>
                <CardDescription>Dina senaste dokument, analyser och jämförelser</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    ...(recentDocuments || []).map((doc) => ({
                      type: "document" as const,
                      timestamp: doc.uploaded_at,
                      data: doc,
                    })),
                    ...(recentAnalyses || []).map((analysis) => ({
                      type: "analysis" as const,
                      timestamp: analysis.analyzed_at,
                      data: analysis,
                    })),
                    ...(recentComparisons || []).map((comp) => ({
                      type: "comparison" as const,
                      timestamp: comp.created_at,
                      data: comp,
                    })),
                  ]
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .slice(0, 10)
                    .map((item, idx) => (
                      <div key={idx} className="flex gap-3 items-start pb-4 border-b last:border-0">
                        <div className="mt-1">
                          {item.type === "document" && <FileText className="h-4 w-4 text-blue-600" />}
                          {item.type === "analysis" && <CheckCircle className="h-4 w-4 text-green-600" />}
                          {item.type === "comparison" && <GitCompare className="h-4 w-4 text-purple-600" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant={
                                item.type === "document"
                                  ? "default"
                                  : item.type === "analysis"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {item.type === "document"
                                ? "Dokument"
                                : item.type === "analysis"
                                ? "Analys"
                                : "Jämförelse"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(item.timestamp), {
                                addSuffix: true,
                                locale: sv,
                              })}
                            </span>
                          </div>
                          <p className="text-sm">
                            {item.type === "document" && item.data.title}
                            {item.type === "analysis" &&
                              `Analys av ${(item.data as any).documents?.title || "dokument"}`}
                            {item.type === "comparison" &&
                              `${(item.data as any).document_ids.length} dokument jämförda`}
                          </p>
                        </div>
                      </div>
                    ))}

                  {!recentDocuments?.length &&
                    !recentAnalyses?.length &&
                    !recentComparisons?.length && (
                      <p className="text-center text-muted-foreground py-8">Ingen aktivitet ännu</p>
                    )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Statistik */}
          <TabsContent value="stats" className="space-y-6">
            {/* Statistikkort */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {isLoading
                ? [1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-4" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-8 w-16 mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </CardContent>
                    </Card>
                  ))
                : statsCards.map((stat) => (
                    <Card key={stat.title}>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                        <stat.icon className={`h-4 w-4 ${stat.color}`} />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{stat.value}</div>
                        {stat.description && (
                          <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
            </div>

            {/* Senaste aggregerade insikter */}
            {latestInsight && <AggregateInsights insight={latestInsight} />}

            {/* Extra statistik */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Dokumenttyper</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Statistik om olika dokumenttyper kommer här
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Analys-trender</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Graf över analyser över tid kommer här
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
