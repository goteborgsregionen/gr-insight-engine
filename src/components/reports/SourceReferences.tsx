import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Table2, Quote, Hash } from "lucide-react";
import type { EvidencePost } from "./EvidenceBadge";

interface SourceReferencesProps {
  evidencePosts: EvidencePost[];
  documents: { id: string; title: string }[];
  onEvidenceClick: (evidence: EvidencePost) => void;
}

const typeIcons: Record<string, typeof Table2> = {
  table: Table2,
  quote: Quote,
  metric: Hash,
};

export function SourceReferences({ evidencePosts, documents, onEvidenceClick }: SourceReferencesProps) {
  if (evidencePosts.length === 0) return null;

  // Group by document
  const grouped = new Map<string, EvidencePost[]>();
  for (const ep of evidencePosts) {
    const list = grouped.get(ep.document_id) || [];
    list.push(ep);
    grouped.set(ep.document_id, list);
  }

  const docMap = new Map(documents.map((d) => [d.id, d.title]));

  return (
    <Card className="mt-8">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Källhänvisningar ({evidencePosts.length} evidenspunkter)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from(grouped.entries()).map(([docId, posts]) => {
          const title = docMap.get(docId) || docId;
          return (
            <div key={docId}>
              <p className="font-medium text-sm mb-1.5">
                📄 {title} ({posts.length} evidenspunkter)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {posts.map((ep) => {
                  const Icon = typeIcons[ep.type] || Hash;
                  return (
                    <button
                      key={ep.id}
                      onClick={() => onEvidenceClick(ep)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    >
                      <Icon className="h-3 w-3" />
                      {ep.evidence_id} — s. {ep.page}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
