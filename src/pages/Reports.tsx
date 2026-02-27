import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportListItem } from "@/components/reports/ReportListItem";
import { useToast } from "@/hooks/use-toast";
import { Search, Filter, FileText, LayoutGrid, List, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const ITEMS_PER_PAGE = 20;

export default function Reports() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<"title" | "status" | "created_at">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "created_at" ? "desc" : "asc");
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ col }: { col: typeof sortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

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
      toast({ title: "Rapport nedladdad", description: "Rapporten har laddats ner som HTML-fil" });
    },
    onError: (error: any) => {
      toast({ title: "Fel", description: error.message || "Kunde inte ladda ner rapporten", variant: "destructive" });
    },
  });

  const filteredSessions = sessions?.filter((session) => {
    const matchesSearch = session.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
    const matchesType = typeFilter === 'all' || session.analysis_type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const totalPages = Math.max(1, Math.ceil((filteredSessions?.length || 0) / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSessions = filteredSessions?.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setCurrentPage(1);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Rapporter</h1>
          <p className="text-muted-foreground">Utforska och hantera dina analysrapporter</p>
        </div>

        {/* Filters + View toggle */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Sök rapporter..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="pl-9"
                />
              </div>

              <div className="flex gap-2 items-center">
                <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
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

                <Select value={typeFilter} onValueChange={handleFilterChange(setTypeFilter)}>
                  <SelectTrigger className="w-[160px]">
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

                <div className="flex border border-border rounded-md">
                  <Button
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    aria-label="Gridvy"
                    className="rounded-r-none"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    aria-label="Listvy"
                    className="rounded-l-none"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : paginatedSessions && paginatedSessions.length > 0 ? (
          <>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedSessions.map((session) => (
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titel</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Dok</TableHead>
                      <TableHead>Skapad</TableHead>
                      <TableHead className="text-right">Åtgärder</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSessions.map((session) => (
                      <ReportListItem
                        key={session.id}
                        session={session}
                        onDownload={() => downloadMutation.mutate(session.id)}
                        isDownloading={downloadMutation.isPending}
                      />
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className={safePage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        isActive={page === safePage}
                        onClick={() => setCurrentPage(page)}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className={safePage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
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
                <Button variant="outline" className="mt-4" onClick={() => { setSearchQuery(""); setStatusFilter("all"); setTypeFilter("all"); }}>
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
