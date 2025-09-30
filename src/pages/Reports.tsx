import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";

export default function Reports() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Rapporter</h1>
          <p className="text-muted-foreground">
            Generera rapporter med GR:s grafiska profil
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-center max-w-md">
              <h3 className="text-lg font-semibold mb-2">Rapportgenerering kommer snart</h3>
              <p className="text-muted-foreground">
                Denna funktion kommer att låta dig skapa professionella rapporter baserade på dina analyserade dokument
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
