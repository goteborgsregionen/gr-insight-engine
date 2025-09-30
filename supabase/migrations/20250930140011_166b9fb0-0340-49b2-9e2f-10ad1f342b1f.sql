-- Add new columns to analysis_results for flexible analysis types
ALTER TABLE analysis_results
ADD COLUMN IF NOT EXISTS analysis_type TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS custom_prompt TEXT,
ADD COLUMN IF NOT EXISTS analysis_focus JSONB DEFAULT '{}'::jsonb;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_analysis_results_type ON analysis_results(document_id, analysis_type);

-- Add check constraint for valid analysis types
ALTER TABLE analysis_results
DROP CONSTRAINT IF EXISTS valid_analysis_type;

ALTER TABLE analysis_results
ADD CONSTRAINT valid_analysis_type CHECK (
  analysis_type IN (
    'standard',
    'economic',
    'security', 
    'strategic',
    'technical',
    'kpi_metrics',
    'hr_competence',
    'sustainability',
    'legal_compliance',
    'custom'
  )
);