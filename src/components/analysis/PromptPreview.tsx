import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PromptPreviewProps {
  open: boolean;
  onClose: () => void;
  templateIds: string[];
  documentIds: string[];
  analysisType: string;
}

export function PromptPreview({ open, onClose, templateIds, documentIds, analysisType }: PromptPreviewProps) {
  const { data: preview, isLoading } = useQuery({
    queryKey: ['prompt-preview', templateIds, documentIds, analysisType],
    queryFn: async () => {
      // Fetch templates
      const { data: templates, error: templatesError } = await supabase
        .from('context_templates')
        .select('*')
        .in('id', templateIds);
      
      if (templatesError) throw templatesError;

      // Fetch documents
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('title, file_name')
        .in('id', documentIds);
      
      if (docsError) throw docsError;

      // Merge context from templates
      const mergedContext: any = {
        organization_context: {},
        analysis_guidelines: {
          focus_areas: [],
          quality_criteria: [],
        },
        reference_framework: {
          key_documents: [],
          relevant_policies: [],
        },
        custom_instructions: [],
      };

      templates?.forEach(template => {
        const data = template.context_data as any;
        
        if (data.organization_context) {
          Object.assign(mergedContext.organization_context, data.organization_context);
        }
        
        if (data.analysis_guidelines?.focus_areas) {
          mergedContext.analysis_guidelines.focus_areas.push(...data.analysis_guidelines.focus_areas);
        }
        
        if (data.analysis_guidelines?.quality_criteria) {
          mergedContext.analysis_guidelines.quality_criteria.push(...data.analysis_guidelines.quality_criteria);
        }
        
        if (data.reference_framework?.key_documents) {
          mergedContext.reference_framework.key_documents.push(...data.reference_framework.key_documents);
        }
        
        if (data.custom_instructions) {
          mergedContext.custom_instructions.push(data.custom_instructions);
        }
      });

      return {
        context: mergedContext,
        documents: documents || [],
        analysisType,
      };
    },
    enabled: open && templateIds.length > 0,
  });

  const renderContext = () => {
    if (!preview) return null;

    const { context } = preview;
    const sections: { title: string; content: string }[] = [];

    if (context.organization_context?.name || context.organization_context?.vision) {
      sections.push({
        title: "Organisationskontext",
        content: `${context.organization_context.name ? `Organisation: ${context.organization_context.name}\n` : ''}${context.organization_context.vision ? `Vision: ${context.organization_context.vision}` : ''}`,
      });
    }

    if (context.analysis_guidelines?.focus_areas?.length > 0) {
      sections.push({
        title: "Fokusområden",
        content: context.analysis_guidelines.focus_areas.map((f: string) => `• ${f}`).join('\n'),
      });
    }

    if (context.custom_instructions?.length > 0) {
      sections.push({
        title: "Anpassade instruktioner",
        content: context.custom_instructions.join('\n\n'),
      });
    }

    return sections;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Förhandsvisning av prompt</DialogTitle>
          <DialogDescription>
            Detta är den information AI:n kommer att få för att utföra analysen
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2 text-primary">ANALYSTYP</h3>
                <p className="text-sm bg-muted p-3 rounded">
                  {preview?.analysisType === 'strategic' ? 'Strategisk analys' : 'Standard analys'}
                </p>
              </div>

              {renderContext()?.map((section, idx) => (
                <div key={idx}>
                  <h3 className="font-semibold mb-2 text-primary">{section.title.toUpperCase()}</h3>
                  <p className="text-sm bg-muted p-3 rounded whitespace-pre-wrap">
                    {section.content}
                  </p>
                </div>
              ))}

              <div>
                <h3 className="font-semibold mb-2 text-primary">DOKUMENT</h3>
                <div className="text-sm bg-muted p-3 rounded space-y-1">
                  {preview?.documents.map((doc: any, idx: number) => (
                    <div key={idx}>• {doc.title || doc.file_name}</div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-primary">INSTRUKTIONER</h3>
                <p className="text-sm bg-muted p-3 rounded">
                  Analysera dokumenten enligt den valda analystypen med hänsyn till den angivna kontexten.
                </p>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
