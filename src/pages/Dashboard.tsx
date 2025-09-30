import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, TrendingUp, CheckCircle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { AggregateInsights } from "@/components/analysis/AggregateInsights";

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
                    <CardTitle className="text-sm font-medium">
                      {stat.title}
                    </CardTitle>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    {stat.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {stat.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
        </div>

        <AggregateInsights />

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
      </div>
    </MainLayout>
  );
}
