import { MainLayout } from "@/components/layout/MainLayout";
import { DocumentUploadZone } from "@/components/documents/DocumentUploadZone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

export default function DocumentUpload() {
  const navigate = useNavigate();

  const handleUploadComplete = () => {
    // Navigate back to documents list after upload
    setTimeout(() => {
      navigate("/documents");
    }, 1500);
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Ladda upp dokument</h1>
          <p className="text-muted-foreground">
            Ladda upp PDF, Word eller Excel-filer för AI-analys
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Välj filer</CardTitle>
            <CardDescription>
              Dra och släpp filer eller klicka för att välja. Max 20MB per fil.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DocumentUploadZone onUploadComplete={handleUploadComplete} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Filtyper som stöds</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <span className="text-sm font-bold text-destructive">PDF</span>
              </div>
              <div>
                <p className="font-medium">PDF-dokument</p>
                <p className="text-sm text-muted-foreground">Rapporter, protokoll, planer</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">DOC</span>
              </div>
              <div>
                <p className="font-medium">Word-dokument</p>
                <p className="text-sm text-muted-foreground">Text och formaterade dokument</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <span className="text-sm font-bold text-accent">XLS</span>
              </div>
              <div>
                <p className="font-medium">Excel-filer</p>
                <p className="text-sm text-muted-foreground">Budgetar, ekonomiska rapporter</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
