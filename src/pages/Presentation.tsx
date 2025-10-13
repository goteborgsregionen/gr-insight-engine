import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Maximize2, ExternalLink, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Presentation() {
  const { toast } = useToast();

  const handleFullscreen = () => {
    window.open("/gr-dokumentanalys-presentation.html", "_blank");
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/gr-dokumentanalys-presentation.html`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Länk kopierad",
      description: "Presentationslänken har kopierats till urklipp",
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6 h-full flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Teknisk Presentation</h1>
            <p className="text-muted-foreground">
              GR Dokumentanalysverktyg - Teknisk översikt
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              <Copy className="h-4 w-4 mr-2" />
              Kopiera länk
            </Button>
            <Button variant="outline" size="sm" onClick={handleFullscreen}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Öppna i ny flik
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <iframe
            src="/gr-dokumentanalys-presentation.html"
            className="w-full h-full border-0 rounded-lg shadow-sm bg-background"
            title="Teknisk Presentation"
          />
        </div>
      </div>
    </MainLayout>
  );
}
