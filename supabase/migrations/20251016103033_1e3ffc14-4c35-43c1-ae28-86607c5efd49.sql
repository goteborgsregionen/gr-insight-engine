-- Create critique_results table for Pre-WRITE and Post-WRITE critique
CREATE TABLE critique_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('pre_write', 'post_write')),
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  citation_coverage DECIMAL(5,2),
  numeric_issues JSONB DEFAULT '[]'::jsonb,
  conflicts JSONB DEFAULT '[]'::jsonb,
  unknown_evidence_ids TEXT[] DEFAULT '{}',
  warnings TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE critique_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view critique for their sessions"
  ON critique_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM analysis_sessions
      WHERE analysis_sessions.id = critique_results.session_id
      AND analysis_sessions.user_id = auth.uid()
    )
  );

-- Create extraction_metrics table for cost tracking
CREATE TABLE extraction_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  duration_ms INTEGER,
  evidence_count INTEGER,
  file_size_bytes INTEGER,
  page_count INTEGER,
  tokens_used INTEGER,
  estimated_cost_usd DECIMAL(10,6),
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE extraction_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view metrics for their documents"
  ON extraction_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = extraction_metrics.document_id
      AND documents.uploaded_by = auth.uid()
    )
  );