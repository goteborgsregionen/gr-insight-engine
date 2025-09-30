-- Add version management columns to documents table
ALTER TABLE documents 
  ADD COLUMN version_number INTEGER DEFAULT 1 NOT NULL,
  ADD COLUMN parent_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  ADD COLUMN is_latest_version BOOLEAN DEFAULT true NOT NULL,
  ADD COLUMN version_notes TEXT;

-- Create indexes for better performance
CREATE INDEX idx_documents_parent ON documents(parent_document_id);
CREATE INDEX idx_documents_latest_version ON documents(is_latest_version) WHERE is_latest_version = true;

-- Add comment for documentation
COMMENT ON COLUMN documents.version_number IS 'Version number starting from 1';
COMMENT ON COLUMN documents.parent_document_id IS 'References the original document (first version)';
COMMENT ON COLUMN documents.is_latest_version IS 'True only for the most recent version';
COMMENT ON COLUMN documents.version_notes IS 'Optional notes describing changes in this version';