-- Sprint 1: ERCW Foundation - Evidence & Claims Tables

-- ============================================
-- 1. EVIDENCE POSTS TABLE
-- ============================================
CREATE TABLE evidence_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  evidence_id text NOT NULL,
  type text NOT NULL CHECK (type IN ('table', 'quote', 'number', 'figure', 'section')),
  page integer NOT NULL CHECK (page > 0),
  section text,
  table_ref text,
  headers jsonb,
  rows jsonb,
  quote text,
  unit_notes text,
  notes text,
  source_loc text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_evidence_document_id ON evidence_posts(document_id);
CREATE INDEX idx_evidence_evidence_id ON evidence_posts(evidence_id);
CREATE INDEX idx_evidence_type ON evidence_posts(type);

-- Enable RLS
ALTER TABLE evidence_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view evidence for their documents"
  ON evidence_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = evidence_posts.document_id
      AND documents.uploaded_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert evidence for their documents"
  ON evidence_posts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = evidence_posts.document_id
      AND documents.uploaded_by = auth.uid()
    )
  );

CREATE POLICY "Users can update evidence for their documents"
  ON evidence_posts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = evidence_posts.document_id
      AND documents.uploaded_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete evidence for their documents"
  ON evidence_posts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = evidence_posts.document_id
      AND documents.uploaded_by = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_evidence_posts_updated_at
  BEFORE UPDATE ON evidence_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. CLAIMS POSTS TABLE (Structure for Sprint 2)
-- ============================================
CREATE TABLE claims_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_session_id uuid REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  claim_id text NOT NULL,
  claim_type text NOT NULL CHECK (claim_type IN ('trend', 'gap', 'risk', 'goal', 'action', 'kpi')),
  text text NOT NULL,
  evidence_ids text[] NOT NULL DEFAULT '{}',
  strength text NOT NULL CHECK (strength IN ('high', 'medium', 'low')),
  assumptions text[],
  notes text,
  actors text[],
  kpi_tags text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT claims_must_have_evidence CHECK (array_length(evidence_ids, 1) > 0)
);

-- Indexes
CREATE INDEX idx_claims_session_id ON claims_posts(analysis_session_id);
CREATE INDEX idx_claims_document_id ON claims_posts(document_id);
CREATE INDEX idx_claims_claim_id ON claims_posts(claim_id);
CREATE INDEX idx_claims_strength ON claims_posts(strength);

-- Enable RLS
ALTER TABLE claims_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users can view claims for their sessions"
  ON claims_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM analysis_sessions
      WHERE analysis_sessions.id = claims_posts.analysis_session_id
      AND analysis_sessions.user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_claims_posts_updated_at
  BEFORE UPDATE ON claims_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. UPDATE DOCUMENTS TABLE
-- ============================================
ALTER TABLE documents
ADD COLUMN evidence_extracted boolean DEFAULT false,
ADD COLUMN evidence_count integer DEFAULT 0,
ADD COLUMN extraction_completed_at timestamptz;

-- ============================================
-- 4. UPDATE ANALYSIS_SESSIONS TABLE
-- ============================================
ALTER TABLE analysis_sessions
ADD COLUMN claims_count integer DEFAULT 0,
ADD COLUMN critique_passed boolean DEFAULT false,
ADD COLUMN critique_results jsonb DEFAULT '{}',
ADD COLUMN ercw_version text DEFAULT '1.0';