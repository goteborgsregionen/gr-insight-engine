import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

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

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-center max-w-md">
              <h3 className="text-lg font-semibold mb-2">Inga dokument ännu</h3>
              <p className="text-muted-foreground mb-6">
                Börja med att ladda upp ditt första dokument för att komma igång med AI-analysen
              </p>
              <Button onClick={() => navigate("/documents/upload")}>
                <Plus className="h-4 w-4 mr-2" />
                Ladda upp dokument
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
