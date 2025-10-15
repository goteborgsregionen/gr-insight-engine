import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Trash2, FileText, File as FileIcon, Table, ChevronDown, ChevronRight, Search, Filter, BarChart3, Sparkles, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { sv } from "date-fns/locale";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ANALYSIS_TEMPLATES } from "@/lib/analysisTemplates";
import * as LucideIcons from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useMemo } from "react";
import { formatFileSize } from "@/lib/format";
import { groupByDocumentFamily, Document } from "@/lib/documents";
import { VersionBadge } from "./VersionBadge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DocumentList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState<string>("all");
  const [analysisTypeFilter, setAnalysisTypeFilter] = useState<string>("all");

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select(`
          *,
          analysis_results (
            analysis_type,
            custom_prompt
          )
        `)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return data as (Document & {
        internal_title?: string | null;
        document_category?: string | null;
        tags?: string[] | null;
        time_period?: string | null;
        organization?: string | null;
        auto_tagged_at?: string | null;
      })[];
    },
  });

  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    
    return documents.filter((doc) => {
      // Search filter - now includes internal_title, tags, category, organization
      const matchesSearch = searchQuery === "" || 
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.internal_title && doc.internal_title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (doc.document_category && doc.document_category.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (doc.organization && doc.organization.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (doc.tags && doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
      
      // File type filter
      const matchesFileType = fileTypeFilter === "all" || doc.file_type.includes(fileTypeFilter);
      
      // Analysis type filter
      const docAnalysisType = (doc as any).analysis_results?.[0]?.analysis_type;
      const matchesAnalysisType = analysisTypeFilter === "all" || 
        (analysisTypeFilter === "none" && !docAnalysisType) ||
        docAnalysisType === analysisTypeFilter;
      
      return matchesSearch && matchesFileType && matchesAnalysisType;
    });
  }, [documents, searchQuery, fileTypeFilter, analysisTypeFilter]);

  const documentGroups = filteredDocuments ? groupByDocumentFamily(filteredDocuments) : [];

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const downloadDocument = useMutation({
    mutationFn: async (documentId: string) => {
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .select("file_path, file_name")
        .eq("id", documentId)
        .single();

      if (docError || !doc) throw new Error("Dokumentet hittades inte");

      const { data, error } = await supabase.storage
        .from("documents")
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast.success("Dokument nedladdat!");
    },
    onError: (error: any) => {
      toast.error(`Kunde inte ladda ner dokument: ${error?.message || "Okänt fel"}`);
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (documentId: string) => {
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .select("file_path")
        .eq("id", documentId)
        .single();

      if (docError || !doc) throw new Error("Dokumentet hittades inte");

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("documents")
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("documents")
        .delete()
        .eq("id", documentId);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Dokument raderat!");
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    },
    onError: (error: any) => {
      toast.error(`Kunde inte radera dokument: ${error?.message || "Okänt fel"}`);
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    },
  });

  const extractEvidence = useMutation({
    mutationFn: async (documentId: string) => {
      const { data, error } = await supabase.functions.invoke('extract-evidence', {
        body: { documentId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success(`Evidens extraherad! ${data.evidenceCount} poster skapade.`);
    },
    onError: (error: any) => {
      toast.error(`Kunde inte extrahera evidens: ${error?.message || "Okänt fel"}`);
    },
  });

  const getFileIcon = (fileType: string) => {
    if (fileType.includes("pdf")) return FileText;
    if (fileType.includes("spreadsheet") || fileType.includes("excel")) return Table;
    return FileIcon;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Inga dokument uppladdade än</p>
        </CardContent>
      </Card>
    );
  }

  const renderDocument = (doc: Document & {
    internal_title?: string | null;
    document_category?: string | null;
    tags?: string[] | null;
    time_period?: string | null;
    organization?: string | null;
  }, isLatest: boolean = true) => {
    const Icon = getFileIcon(doc.file_type);
    const analysisType = (doc as any).analysis_results?.[0]?.analysis_type;
    const template = ANALYSIS_TEMPLATES.find(t => t.id === analysisType);
    
    const displayTitle = doc.internal_title || doc.title;
    
    return (
      <Card key={doc.id} className={!isLatest ? "ml-8" : ""}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-lg">{displayTitle}</CardTitle>
                  <VersionBadge version={doc.version_number} isLatest={doc.is_latest_version} />
                  
                  {/* Document Category Badge */}
                  {doc.document_category && (
                    <Badge variant="secondary" className="text-xs">
                      {doc.document_category}
                    </Badge>
                  )}
                  
                  {/* Analysis Type Badge */}
                  {analysisType && template && (
                    <Badge variant="outline" className={`text-${template.color}-600 border-${template.color}-600`}>
                      {(() => {
                        const IconComponent = (LucideIcons as any)[template.icon];
                        return IconComponent ? <IconComponent className="h-3 w-3 mr-1" /> : null;
                      })()}
                      {template.name}
                    </Badge>
                  )}
                  {analysisType === 'custom' && (
                    <Badge variant="outline">
                      ✍️ Custom
                    </Badge>
                  )}
                </div>
                
                <CardDescription className="mt-1">
                  {doc.file_name} • {doc.file_type.split("/")[1]?.toUpperCase() || "UNKNOWN"} •{" "}
                  {formatFileSize(doc.file_size)} •{" "}
                  {formatDistanceToNow(new Date(doc.uploaded_at), {
                    addSuffix: true,
                    locale: sv,
                  })}
                </CardDescription>
                
                {/* Tags */}
                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {doc.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
                
                {/* Additional metadata */}
                {(doc.time_period || doc.organization) && (
                  <div className="text-xs text-muted-foreground mt-2">
                    {doc.time_period && <span>📅 {doc.time_period}</span>}
                    {doc.time_period && doc.organization && <span> • </span>}
                    {doc.organization && <span>🏢 {doc.organization}</span>}
                  </div>
                )}
                
                {doc.version_notes && (
                  <p className="text-sm text-muted-foreground mt-2 italic">
                    {doc.version_notes}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {doc.evidence_extracted && doc.evidence_count > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/documents/${doc.id}/evidence`)}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Evidens ({doc.evidence_count})
                </Button>
              )}
              {!doc.evidence_extracted && doc.status === 'analyzed' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => extractEvidence.mutate(doc.id)}
                  disabled={extractEvidence.isPending}
                >
                  {extractEvidence.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Extrahera Evidens
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadDocument.mutate(doc.id)}
                disabled={downloadDocument.isPending}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDocumentToDelete(doc.id);
                  setDeleteDialogOpen(true);
                }}
                disabled={deleteDocument.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Sök dokument..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtyp" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla filtyper</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="spreadsheet">Excel</SelectItem>
              <SelectItem value="document">Dokument</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={analysisTypeFilter} onValueChange={setAnalysisTypeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Analys" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla analyser</SelectItem>
              <SelectItem value="none">Ej analyserade</SelectItem>
              {ANALYSIS_TEMPLATES.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          Visar {documentGroups.length} av {documents?.length || 0} dokument
        </div>

        {/* Document List */}
        <div className="grid gap-4">
          {documentGroups.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Inga dokument hittades</p>
              </CardContent>
            </Card>
          )}
          
          {documentGroups.map((group) => {
          const groupId = group.latestVersion.parent_document_id || group.latestVersion.id;
          const isExpanded = expandedGroups.has(groupId);
          const hasOlderVersions = group.olderVersions.length > 0;

          return (
            <div key={groupId} className="space-y-2">
              <Collapsible open={isExpanded} onOpenChange={() => toggleGroup(groupId)}>
                <div className="relative">
                  {renderDocument(group.latestVersion, true)}
                  {hasOlderVersions && (
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute bottom-4 right-4"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 mr-2" />
                        ) : (
                          <ChevronRight className="h-4 w-4 mr-2" />
                        )}
                        {group.totalVersions} {group.totalVersions === 1 ? "version" : "versioner"}
                      </Button>
                    </CollapsibleTrigger>
                  )}
                </div>
                <CollapsibleContent className="space-y-2">
                  {group.olderVersions.map((olderDoc) => renderDocument(olderDoc, false))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          );
        })}
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Radera dokument?</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill radera detta dokument? Detta går inte att ångra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (documentToDelete) {
                  deleteDocument.mutate(documentToDelete);
                }
              }}
            >
              Radera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}