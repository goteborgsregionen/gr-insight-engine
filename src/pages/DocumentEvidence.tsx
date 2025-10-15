import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { EvidenceViewer } from "@/components/analysis/EvidenceViewer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function DocumentEvidence() {
  const { documentId } = useParams();
  const navigate = useNavigate();

  if (!documentId) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Inget dokument valt</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/documents')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Tillbaka
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Extraherad Evidens</h1>
            <p className="text-muted-foreground">
              Verifierbara fakta från dokumentet
            </p>
          </div>
        </div>

        <EvidenceViewer documentId={documentId} />
      </div>
    </MainLayout>
  );
}
