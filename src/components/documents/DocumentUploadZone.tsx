import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, File, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { checkForDuplicate, createNewVersion } from "@/lib/documents";
import { ReplaceFileDialog } from "./ReplaceFileDialog";

// Sanitize filename for storage (remove special characters, Swedish chars)
const sanitizeFilename = (filename: string): string => {
  const parts = filename.split(".");
  const extension = parts.pop() || "";
  const name = parts.join(".");
  
  const sanitized = name
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/Å/g, "A")
    .replace(/Ä/g, "A")
    .replace(/Ö/g, "O")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "");
  
  return `${sanitized}.${extension}`;
};

interface UploadFile {
  file: File;
  progress: number;
  id: string;
}

const ACCEPTED_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
};

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

interface DocumentUploadZoneProps {
  onUploadComplete: () => void;
}

export function DocumentUploadZone({ onUploadComplete }: DocumentUploadZoneProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadFile[]>([]);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [replaceDialog, setReplaceDialog] = useState<{
    open: boolean;
    file: File;
    existingDoc: any;
  } | null>(null);

  const handleReplaceConfirm = async (versionNotes: string) => {
    if (!replaceDialog || !user) return;

    const { file, existingDoc } = replaceDialog;
    
    try {
      const timestamp = Date.now();
      const sanitizedName = sanitizeFilename(file.name);
      const filePath = `${user.id}/${timestamp}_${sanitizedName}`;

      // Upload new file to storage
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create new version in database
      await createNewVersion(existingDoc.id, file, filePath, versionNotes);

      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });

      toast.success(`${file.name} ersatt med ny version!`);
      setReplaceDialog(null);
      onUploadComplete();
    } catch (error: any) {
      console.error("Replace error:", error);
      toast.error(`Kunde inte ersätta fil: ${error?.message || "Okänt fel"}`);
      setReplaceDialog(null);
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!user) {
        toast.error("Du måste vara inloggad för att ladda upp filer");
        return;
      }

      // Check for duplicates first
      const fileChecks = await Promise.all(
        acceptedFiles.map(async (file) => {
          const existingDoc = await checkForDuplicate(file.name, file.size, user.id);
          return { file, existingDoc };
        })
      );

      // Handle duplicates - show dialog for first duplicate
      const duplicate = fileChecks.find((check) => check.existingDoc);
      if (duplicate) {
        setReplaceDialog({
          open: true,
          file: duplicate.file,
          existingDoc: duplicate.existingDoc,
        });
        
        // Show warnings for other duplicates
        fileChecks
          .filter((check) => check.existingDoc && check !== duplicate)
          .forEach(({ file }) => {
            toast.warning(`${file.name} finns redan uppladdad`);
          });
        
        return;
      }

      // No duplicates - proceed with upload
      const newFiles = acceptedFiles.map((file) => ({
        id: Math.random().toString(),
        file,
        progress: 0,
      }));

      setUploadingFiles((prev) => [...prev, ...newFiles]);

      for (const uploadFile of newFiles) {
        try {
          // Generate unique file path with sanitized filename
          const timestamp = Date.now();
          const sanitizedName = sanitizeFilename(uploadFile.file.name);
          const filePath = `${user.id}/${timestamp}_${sanitizedName}`;

          // Update progress to show upload started
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id ? { ...f, progress: 50 } : f
            )
          );

          // Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from("documents")
            .upload(filePath, uploadFile.file);

          if (uploadError) throw uploadError;

          // Save metadata to database
          const { error: dbError } = await supabase.from("documents").insert({
            title: uploadFile.file.name.replace(/\.[^/.]+$/, ""), // Remove extension
            file_name: uploadFile.file.name,
            file_type: uploadFile.file.type,
            file_size: uploadFile.file.size,
            file_path: filePath,
            uploaded_by: user.id,
            status: "uploaded",
            version_number: 1,
            is_latest_version: true,
          });

          if (dbError) throw dbError;

          // Update progress to completed
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id ? { ...f, progress: 100 } : f
            )
          );

          toast.success(`${uploadFile.file.name} uppladdad!`);
        } catch (error: any) {
          console.error("Upload error:", error);
          const errorMessage = error?.message || "Okänt fel";
          toast.error(`Kunde inte ladda upp ${uploadFile.file.name}: ${errorMessage}`);
          setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadFile.id));
        }
      }

      // Clear completed uploads and refresh list
      setTimeout(() => {
        setUploadingFiles([]);
        queryClient.invalidateQueries({ queryKey: ["documents"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        onUploadComplete();
      }, 1000);
    },
    [user, queryClient, onUploadComplete],
  );

  const onDropRejected = useCallback((rejections: any[]) => {
    rejections.forEach((rejection) => {
      if (rejection.file.size > MAX_SIZE) {
        toast.error(`${rejection.file.name} är för stor. Max 20MB.`);
      } else {
        toast.error(`${rejection.file.name} har fel filtyp. Endast PDF, DOCX, XLSX.`);
      }
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    onDropRejected,
  });

  const removeFile = (id: string) => {
    setUploadingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-accent/50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-medium mb-2">
          {isDragActive ? "Släpp filerna här" : "Dra och släpp filer här"}
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          eller klicka för att välja filer
        </p>
        <p className="text-xs text-muted-foreground">
          PDF, DOCX, XLSX • Max 20MB per fil
        </p>
      </div>

      {uploadingFiles.length > 0 && (
        <div className="space-y-3">
          {uploadingFiles.map((uploadFile) => (
            <div
              key={uploadFile.id}
              className="border border-border rounded-lg p-4 bg-card"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <File className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium truncate">
                    {uploadFile.file.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                {uploadFile.progress < 100 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(uploadFile.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Progress value={uploadFile.progress} className="h-2" />
            </div>
          ))}
        </div>
      )}

      {replaceDialog && (
        <ReplaceFileDialog
          open={replaceDialog.open}
          onOpenChange={(open) => !open && setReplaceDialog(null)}
          fileName={replaceDialog.file.name}
          existingVersion={replaceDialog.existingDoc.version_number}
          onConfirm={handleReplaceConfirm}
        />
      )}
    </div>
  );
}