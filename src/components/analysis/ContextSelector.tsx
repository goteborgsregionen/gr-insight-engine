import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Eye, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContextTemplateEditor } from "./ContextTemplateEditor";
import { PromptPreview } from "./PromptPreview";
import { toast } from "sonner";

interface ContextSelectorProps {
  selectedTemplateIds: string[];
  onSelectionChange: (templateIds: string[]) => void;
  documentIds: string[];
  analysisType: string;
}

export function ContextSelector({ 
  selectedTemplateIds, 
  onSelectionChange,
  documentIds,
  analysisType 
}: ContextSelectorProps) {
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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

  const systemDefault = templates?.find(t => t.is_system_default);
  const userTemplates = templates?.filter(t => !t.is_system_default) || [];

  const toggleTemplate = (templateId: string) => {
    if (selectedTemplateIds.includes(templateId)) {
      onSelectionChange(selectedTemplateIds.filter(id => id !== templateId));
    } else {
      onSelectionChange([...selectedTemplateIds, templateId]);
    }
  };

  const handleEditorClose = (created: boolean) => {
    setShowEditor(false);
    if (created) {
      refetch();
      toast.success("Kontext-mall skapad");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Välj kontext för analysen</CardTitle>
          <CardDescription>
            Välj vilka kontext-mallar som ska användas för att ge AI:n bakgrundsinformation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {systemDefault && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm">System-standard</h3>
              <div className="flex items-start space-x-3 p-3 border rounded-lg bg-muted/50">
                <Checkbox
                  id={systemDefault.id}
                  checked={selectedTemplateIds.includes(systemDefault.id)}
                  onCheckedChange={() => toggleTemplate(systemDefault.id)}
                />
                <div className="flex-1">
                  <label
                    htmlFor={systemDefault.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {systemDefault.title}
                  </label>
                  {systemDefault.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {systemDefault.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {userTemplates.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm">Mina mallar</h3>
              <div className="space-y-2">
                {userTemplates.map((template) => (
                  <div key={template.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      id={template.id}
                      checked={selectedTemplateIds.includes(template.id)}
                      onCheckedChange={() => toggleTemplate(template.id)}
                    />
                    <div className="flex-1">
                      <label
                        htmlFor={template.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {template.title}
                      </label>
                      {template.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {template.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditor(true)}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-2" />
              Skapa ny mall
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(true)}
              disabled={selectedTemplateIds.length === 0}
            >
              <Eye className="h-4 w-4 mr-2" />
              Förhandsvisning
            </Button>
          </div>
        </CardContent>
      </Card>

      <ContextTemplateEditor
        open={showEditor}
        onClose={handleEditorClose}
      />

      <PromptPreview
        open={showPreview}
        onClose={() => setShowPreview(false)}
        templateIds={selectedTemplateIds}
        documentIds={documentIds}
        analysisType={analysisType}
      />
    </>
  );
}
