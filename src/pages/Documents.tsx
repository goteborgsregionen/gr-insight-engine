import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DocumentList } from "@/components/documents/DocumentList";

export default function Documents() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Dokument</h1>
            <p className="text-muted-foreground">
              Hantera och analysera dina uppladdade dokument
            </p>
          </div>
          <Button onClick={() => navigate("/documents/upload")}>
            <Plus className="h-4 w-4 mr-2" />
            Ladda upp
          </Button>
        </div>

        <DocumentList />
      </div>
    </MainLayout>
  );
}
