-- Fas 1 & 2: Database migrations för skalbar dokumentanalys

-- 1. Lägg till content_hash för smart caching
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- 2. Förbättra analysis_results med validering och timing
ALTER TABLE public.analysis_results
ADD COLUMN IF NOT EXISTS is_valid BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS processing_time INTEGER;

-- 3. Skapa analysis_queue tabell för batch-processing
CREATE TABLE IF NOT EXISTS public.analysis_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 5,
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL
);

-- Enable RLS on analysis_queue
ALTER TABLE public.analysis_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for analysis_queue
CREATE POLICY "Users can view their own queue items"
ON public.analysis_queue
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own queue items"
ON public.analysis_queue
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own queue items"
ON public.analysis_queue
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own queue items"
ON public.analysis_queue
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queue processing
CREATE INDEX IF NOT EXISTS idx_analysis_queue_status ON public.analysis_queue(status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_analysis_queue_user ON public.analysis_queue(user_id);

-- Enable Realtime for documents and analysis_results
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.analysis_results;
ALTER PUBLICATION supabase_realtime ADD TABLE public.analysis_queue;