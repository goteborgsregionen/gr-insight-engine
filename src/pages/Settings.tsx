import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Settings() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Utloggad");
    navigate("/");
  };

  return (
    <MainLayout>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Inställningar</h1>
          <p className="text-muted-foreground">
            Hantera ditt konto och appinställningar
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Konto</CardTitle>
            <CardDescription>
              Hantera dina kontoinställningar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleLogout}>
              Logga ut
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
