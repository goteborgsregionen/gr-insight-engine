-- Create analysis_sessions table for storing analysis work-in-progress
CREATE TABLE IF NOT EXISTS public.analysis_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Session metadata
  title TEXT NOT NULL DEFAULT 'Namnlös analys',
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'completed', 'archived'
  
  -- Analysis configuration
  document_ids UUID[] NOT NULL,
  analysis_type TEXT NOT NULL DEFAULT 'standard',
  custom_prompt TEXT,
  
  -- Results
  analysis_result JSONB DEFAULT '{}',
  
  -- AI Chat history
  chat_history JSONB[] DEFAULT ARRAY[]::JSONB[],
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.analysis_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own sessions" ON public.analysis_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions" ON public.analysis_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON public.analysis_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON public.analysis_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_user_id ON public.analysis_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_status ON public.analysis_sessions(status);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_created_at ON public.analysis_sessions(created_at DESC);