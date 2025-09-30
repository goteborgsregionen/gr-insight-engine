import { File, FileText, FileSpreadsheet } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const formatDate = (date: string): string => {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: sv });
};

export const getFileIcon = (fileType: string) => {
  if (fileType.includes("pdf")) return File;
  if (fileType.includes("word") || fileType.includes("document")) return FileText;
  if (fileType.includes("sheet") || fileType.includes("excel")) return FileSpreadsheet;
  return File;
};

export const getFileTypeLabel = (fileType: string): string => {
  if (fileType.includes("pdf")) return "PDF";
  if (fileType.includes("word") || fileType.includes("document")) return "Word";
  if (fileType.includes("sheet") || fileType.includes("excel")) return "Excel";
  return "Dokument";
};
