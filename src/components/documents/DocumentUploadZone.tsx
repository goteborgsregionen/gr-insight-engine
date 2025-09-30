import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, File, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

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

export const DocumentUploadZone = ({ onUploadComplete }: DocumentUploadZoneProps) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadFile[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map((file) => ({
      file,
      progress: 0,
      id: Math.random().toString(36),
    }));

    setUploadingFiles((prev) => [...prev, ...newFiles]);

    // Simulate upload for now (will be replaced with actual Supabase upload)
    for (const uploadFile of newFiles) {
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, progress } : f
          )
        );
      }
      
      toast.success(`${uploadFile.file.name} uppladdad!`);
    }

    // Clear completed uploads after a delay
    setTimeout(() => {
      setUploadingFiles([]);
      onUploadComplete();
    }, 1000);
  }, [onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    onDropRejected: (rejections) => {
      rejections.forEach((rejection) => {
        if (rejection.file.size > MAX_SIZE) {
          toast.error(`${rejection.file.name} är för stor. Max 20MB.`);
        } else {
          toast.error(`${rejection.file.name} har fel filtyp. Endast PDF, DOCX, XLSX.`);
        }
      });
    },
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
    </div>
  );
};
