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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface ReplaceFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  existingVersion: number;
  onConfirm: (versionNotes: string) => void;
}

export function ReplaceFileDialog({
  open,
  onOpenChange,
  fileName,
  existingVersion,
  onConfirm,
}: ReplaceFileDialogProps) {
  const [versionNotes, setVersionNotes] = useState("");

  const handleConfirm = () => {
    onConfirm(versionNotes);
    setVersionNotes("");
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            Filen finns redan
            <Badge variant="secondary">v{existingVersion}</Badge>
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              <strong>{fileName}</strong> finns redan uppladdad. Vill du ersätta den med en ny version?
            </p>
            <div className="space-y-2">
              <Label htmlFor="version-notes">
                Versionsanteckningar (valfritt)
              </Label>
              <Textarea
                id="version-notes"
                placeholder="Beskriv vad som ändrats i denna version..."
                value={versionNotes}
                onChange={(e) => setVersionNotes(e.target.value)}
                rows={3}
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Avbryt</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            Ersätt och skapa ny version
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
