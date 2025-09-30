-- Invalidate all analyses before the PDF multimodal fix was implemented
-- This ensures all documents will be re-analyzed with correct PDF support
UPDATE analysis_results 
SET is_valid = false 
WHERE analyzed_at < '2025-09-30 14:00:00';

-- Add index for better performance on future queries
CREATE INDEX IF NOT EXISTS idx_analysis_results_valid_date 
ON analysis_results(is_valid, analyzed_at);