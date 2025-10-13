-- Add metadata columns to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS internal_title text,
ADD COLUMN IF NOT EXISTS document_category text,
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS time_period text,
ADD COLUMN IF NOT EXISTS organization text,
ADD COLUMN IF NOT EXISTS auto_tagged_at timestamptz;