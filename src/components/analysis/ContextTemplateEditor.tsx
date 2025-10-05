import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContextTemplateEditorProps {
  open: boolean;
  onClose: (created: boolean) => void;
  templateId?: string;
}

interface ContextData {
  organization_context?: {
    name?: string;
    vision?: string;
    strategic_priorities?: string[];
    geographical_scope?: string;
  };
  analysis_guidelines?: {
    focus_areas?: string[];
    quality_criteria?: string[];
    perspective?: string;
  };
  reference_framework?: {
    key_documents?: string[];
    relevant_policies?: string[];
  };
  custom_instructions?: string;
}

export function ContextTemplateEditor({ open, onClose, templateId }: ContextTemplateEditorProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [orgName, setOrgName] = useState("");
  const [vision, setVision] = useState("");
  const [focusAreas, setFocusAreas] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEditMode = !!templateId;

  // Load existing template data when editing
  useEffect(() => {
    const loadTemplate = async () => {
      if (templateId && open) {
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('context_templates')
            .select('*')
            .eq('id', templateId)
            .single();
          
          if (error) {
            toast.error("Kunde inte ladda mall");
            return;
          }
          if (data) {
            setTitle(data.title);
            setDescription(data.description || "");
            const contextData = data.context_data as ContextData;
            setOrgName(contextData.organization_context?.name || "");
            setVision(contextData.organization_context?.vision || "");
            setFocusAreas(contextData.analysis_guidelines?.focus_areas?.join('\n') || "");
            setCustomInstructions(contextData.custom_instructions || "");
          }
        } finally {
          setLoading(false);
        }
      } else if (!open) {
        // Reset form when dialog closes
        setTitle("");
        setDescription("");
        setOrgName("");
        setVision("");
        setFocusAreas("");
        setCustomInstructions("");
      }
    };
    
    loadTemplate();
  }, [templateId, open]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Titel måste fyllas i");
      return;
    }

    setSaving(true);
    try {
      const contextData: ContextData = {};

      if (orgName || vision) {
        contextData.organization_context = {
          name: orgName || undefined,
          vision: vision || undefined,
        };
      }

      if (focusAreas) {
        contextData.analysis_guidelines = {
          focus_areas: focusAreas.split('\n').filter(f => f.trim()),
        };
      }

      if (customInstructions) {
        contextData.custom_instructions = customInstructions;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Inte inloggad");

      if (isEditMode) {
        // Update existing template
        const { error } = await supabase
          .from('context_templates')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            context_data: contextData as any,
            updated_at: new Date().toISOString(),
          })
          .eq('id', templateId);

        if (error) throw error;
        toast.success("Kontext-mall uppdaterad");
      } else {
        // Create new template
        const { error } = await supabase
          .from('context_templates')
          .insert([{
            title: title.trim(),
            description: description.trim() || null,
            context_data: contextData as any,
            created_by: user.id,
            is_system_default: false,
          }]);

        if (error) throw error;
        toast.success("Kontext-mall skapad");
      }

      onClose(true);
    } catch (error) {
      console.error('Error saving context template:', error);
      toast.error(isEditMode ? "Kunde inte uppdatera kontext-mallen" : "Kunde inte spara kontext-mallen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose(false)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Redigera kontext-mall" : "Skapa kontext-mall"}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Uppdatera bakgrundsinformation som AI:n ska använda vid analyser"
              : "Fyll i bakgrundsinformation som AI:n ska använda vid analyser"
            }
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            Laddar mall...
          </div>
        ) : (
          <>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titel *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="T.ex. Klimatomställning 2030"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beskrivning</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kort beskrivning av kontext-mallen"
              rows={2}
            />
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium">Organisationskontext</h3>
            
            <div className="space-y-2">
              <Label htmlFor="orgName">Organisations-/projektnamn</Label>
              <Input
                id="orgName"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="T.ex. Klimatprojekt Väst"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vision">Vision & strategi</Label>
              <Textarea
                id="vision"
                value={vision}
                onChange={(e) => setVision(e.target.value)}
                placeholder="Beskriv vision, mål och strategiska prioriteringar..."
                rows={3}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium">Analysriktlinjer</h3>
            
            <div className="space-y-2">
              <Label htmlFor="focusAreas">Fokusområden (ett per rad)</Label>
              <Textarea
                id="focusAreas"
                value={focusAreas}
                onChange={(e) => setFocusAreas(e.target.value)}
                placeholder="Hållbarhet&#10;Innovation&#10;Samverkan"
                rows={4}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium">Anpassade instruktioner</h3>
            
            <div className="space-y-2">
              <Label htmlFor="customInstructions">Övriga instruktioner till AI:n</Label>
              <Textarea
                id="customInstructions"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="T.ex. 'Fokusera extra på ekonomiska aspekter' eller 'Använd en pedagogisk ton'"
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onClose(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Sparar..." : isEditMode ? "Uppdatera mall" : "Skapa mall"}
          </Button>
        </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
