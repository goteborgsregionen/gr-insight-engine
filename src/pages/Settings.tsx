import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2, Edit, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ContextTemplateEditor } from "@/components/analysis/ContextTemplateEditor";
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

export default function Settings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Utloggad");
    navigate("/");
  };

  // Check if user is admin
  const { data: userRole } = useQuery({
    queryKey: ['user-role'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data?.role || 'user';
    },
  });

  // Fetch all context templates
  const { data: templates, refetch } = useQuery({
    queryKey: ['context-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('context_templates')
        .select('*')
        .eq('is_active', true)
        .order('is_system_default', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('context_templates')
        .delete()
        .eq('id', templateId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kontext-mall raderad");
      refetch();
      setDeleteTemplateId(null);
    },
    onError: (error: any) => {
      toast.error("Kunde inte radera mall: " + error.message);
    },
  });

  const systemTemplates = templates?.filter(t => t.is_system_default) || [];
  const userTemplates = templates?.filter(t => !t.is_system_default) || [];

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

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Kontext-mallar</CardTitle>
                <CardDescription>
                  Hantera kontext-mallar för AI-analyser
                </CardDescription>
              </div>
              <Button onClick={() => setShowEditor(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Ny mall
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* System templates */}
            {systemTemplates.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  System-standard
                  <Badge variant="secondary" className="text-xs">
                    {userRole === 'admin' ? 'Admin' : 'Endast läsning'}
                  </Badge>
                </h3>
                <div className="space-y-2">
                  {systemTemplates.map((template) => (
                    <div key={template.id} className="flex items-start justify-between p-4 border rounded-lg bg-muted/50">
                      <div className="flex-1">
                        <h4 className="font-medium">{template.title}</h4>
                        {template.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {template.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Skapad {new Date(template.created_at).toLocaleDateString('sv-SE')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* User templates */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Mina mallar</h3>
              {userTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Du har inga egna mallar än. Skapa en för att spara anpassade kontext-inställningar.
                </p>
              ) : (
                <div className="space-y-2">
                  {userTemplates.map((template) => (
                    <div key={template.id} className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{template.title}</h4>
                        {template.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {template.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Skapad {new Date(template.created_at).toLocaleDateString('sv-SE')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTemplateId(template.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <ContextTemplateEditor
        open={showEditor}
        onClose={(created) => {
          setShowEditor(false);
          if (created) refetch();
        }}
      />

      <AlertDialog open={deleteTemplateId !== null} onOpenChange={() => setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Radera kontext-mall?</AlertDialogTitle>
            <AlertDialogDescription>
              Detta kan inte ångras. Befintliga analyser som använder denna mall påverkas inte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTemplateId && deleteMutation.mutate(deleteTemplateId)}
            >
              Radera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
