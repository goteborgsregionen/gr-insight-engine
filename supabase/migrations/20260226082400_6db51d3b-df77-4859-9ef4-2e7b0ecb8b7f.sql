-- Create shared_reports table for secure sharing links
CREATE TABLE public.shared_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,
  share_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;

-- Owner can manage their shares
CREATE POLICY "Users can create shares for their sessions"
  ON public.shared_reports FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (SELECT 1 FROM analysis_sessions WHERE id = session_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can view their own shares"
  ON public.shared_reports FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own shares"
  ON public.shared_reports FOR DELETE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can update their own shares"
  ON public.shared_reports FOR UPDATE
  USING (auth.uid() = created_by);

-- Public read access via share_token (for anonymous viewers)
CREATE POLICY "Anyone can view active shares by token"
  ON public.shared_reports FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Index for fast token lookups
CREATE INDEX idx_shared_reports_token ON public.shared_reports (share_token) WHERE is_active = true;