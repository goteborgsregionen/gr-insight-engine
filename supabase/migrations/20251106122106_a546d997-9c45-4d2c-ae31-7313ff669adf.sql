-- Create report_views table for tracking report analytics
CREATE TABLE IF NOT EXISTS public.report_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  viewed_at timestamp with time zone NOT NULL DEFAULT now(),
  reading_time_seconds integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.report_views ENABLE ROW LEVEL SECURITY;

-- Users can view their own report views
CREATE POLICY "Users can view their own report views"
ON public.report_views
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own report views
CREATE POLICY "Users can create their own report views"
ON public.report_views
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own report views
CREATE POLICY "Users can update their own report views"
ON public.report_views
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_report_views_session_id ON public.report_views(session_id);
CREATE INDEX IF NOT EXISTS idx_report_views_user_id ON public.report_views(user_id);