import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";

export default function Chat() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">AI-chatt</h1>
          <p className="text-muted-foreground">
            Ställ frågor om dina dokument och få AI-drivna svar
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-center max-w-md">
              <h3 className="text-lg font-semibold mb-2">AI-chatt kommer snart</h3>
              <p className="text-muted-foreground">
                Denna funktion kommer att låta dig ställa frågor om dina dokument och få intelligenta svar
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
