-- Add confidence_score and explanation columns to claims_posts for Sprint 4
ALTER TABLE public.claims_posts 
  ADD COLUMN confidence_score numeric DEFAULT NULL,
  ADD COLUMN explanation text DEFAULT NULL;

-- Add index for efficient confidence-based queries
CREATE INDEX idx_claims_posts_confidence ON public.claims_posts (confidence_score DESC NULLS LAST);