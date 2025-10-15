import { supabase } from "@/integrations/supabase/client";

export interface Document {
  id: string;
  title: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
  uploaded_by: string;
  status: string;
  metadata: any;
  version_number: number;
  parent_document_id: string | null;
  is_latest_version: boolean;
  version_notes: string | null;
  evidence_extracted?: boolean;
  evidence_count?: number;
  extraction_completed_at?: string | null;
}

export interface DocumentGroup {
  latestVersion: Document;
  olderVersions: Document[];
  totalVersions: number;
}

export const groupByDocumentFamily = (documents: Document[]): DocumentGroup[] => {
  const groups = new Map<string, Document[]>();

  // Group documents by their parent_document_id or their own id if they're the parent
  documents.forEach((doc) => {
    const groupId = doc.parent_document_id || doc.id;
    if (!groups.has(groupId)) {
      groups.set(groupId, []);
    }
    groups.get(groupId)!.push(doc);
  });

  // Convert to DocumentGroup array
  return Array.from(groups.values()).map((versions) => {
    // Sort by version_number descending
    versions.sort((a, b) => b.version_number - a.version_number);
    
    return {
      latestVersion: versions[0],
      olderVersions: versions.slice(1),
      totalVersions: versions.length,
    };
  });
};

export const createNewVersion = async (
  existingDocId: string,
  newFile: File,
  filePath: string,
  versionNotes?: string
) => {
  // 1. Fetch existing document
  const { data: existingDoc, error: fetchError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", existingDocId)
    .single();

  if (fetchError || !existingDoc) {
    throw new Error("Could not fetch existing document");
  }

  // 2. Mark old version as not latest
  const { error: updateError } = await supabase
    .from("documents")
    .update({ is_latest_version: false })
    .eq("id", existingDocId);

  if (updateError) {
    throw new Error("Could not update existing document");
  }

  // 3. Create new version entry
  const parentId = existingDoc.parent_document_id || existingDoc.id;
  const newVersionNumber = existingDoc.version_number + 1;

  const { data: newVersion, error: insertError } = await supabase
    .from("documents")
    .insert({
      title: existingDoc.title,
      file_name: existingDoc.file_name,
      file_path: filePath,
      file_type: existingDoc.file_type,
      file_size: newFile.size,
      uploaded_by: existingDoc.uploaded_by,
      version_number: newVersionNumber,
      parent_document_id: parentId,
      is_latest_version: true,
      version_notes: versionNotes || null,
      status: "uploaded",
      metadata: existingDoc.metadata,
    })
    .select()
    .single();

  if (insertError || !newVersion) {
    throw new Error("Could not create new version");
  }

  return newVersion;
};

export const checkForDuplicate = async (
  fileName: string,
  fileSize: number,
  userId: string
) => {
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, version_number, file_name")
    .eq("uploaded_by", userId)
    .eq("file_name", fileName)
    .eq("file_size", fileSize)
    .eq("is_latest_version", true)
    .maybeSingle();

  if (error) {
    console.error("Error checking for duplicate:", error);
    return null;
  }

  return data;
};
