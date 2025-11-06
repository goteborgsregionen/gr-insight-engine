import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportCard } from "@/components/reports/ReportCard";
import { useToast } from "@/hooks/use-toast";
import { Search, Filter, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Reports() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Fetch all completed analysis sessions
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['report-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analysis_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Download report mutation
  const downloadMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: { sessionId, format: 'html' },
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

  // Filter sessions
  const filteredSessions = sessions?.filter((session) => {
    const matchesSearch = session.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
    const matchesType = typeFilter === 'all' || session.analysis_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Rapporter</h1>
          <p className="text-muted-foreground">
            Utforska och hantera dina analysrapporter
          </p>
        </div>

        {/* Search and filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Sök rapporter..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla status</SelectItem>
                    <SelectItem value="completed">Slutförd</SelectItem>
                    <SelectItem value="processing">Bearbetas</SelectItem>
                    <SelectItem value="draft">Utkast</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[180px]">
                    <FileText className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Analystyp" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla typer</SelectItem>
                    <SelectItem value="strategic">Strategisk</SelectItem>
                    <SelectItem value="financial">Finansiell</SelectItem>
                    <SelectItem value="gap">Gap-analys</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report list */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredSessions && filteredSessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSessions.map((session) => (
              <ReportCard
                key={session.id}
                session={session}
                onDownload={() => downloadMutation.mutate(session.id)}
                isDownloading={downloadMutation.isPending}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Inga rapporter hittades</h3>
              <p className="text-muted-foreground text-center max-w-md">
                {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                  ? "Prova att ändra dina filter eller sökkriterier"
                  : "Skapa din första analysrapport genom att analysera dokument"}
              </p>
              {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all') && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setTypeFilter("all");
                  }}
                >
                  Rensa filter
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
