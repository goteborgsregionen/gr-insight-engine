-- Create comparative_analysis table for comparing multiple documents
CREATE TABLE IF NOT EXISTS public.comparative_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_ids UUID[] NOT NULL,
  comparison_result JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.comparative_analysis ENABLE ROW LEVEL SECURITY;

-- Create policies for comparative_analysis
CREATE POLICY "Users can view their own comparative analyses"
ON public.comparative_analysis
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own comparative analyses"
ON public.comparative_analysis
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comparative analyses"
ON public.comparative_analysis
FOR DELETE
USING (auth.uid() = user_id);

-- Create aggregate_insights table for overall insights across all documents
CREATE TABLE IF NOT EXISTS public.aggregate_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  insights JSONB DEFAULT '{}'::jsonb,
  trend_data JSONB DEFAULT '{}'::jsonb,
  recommendations TEXT[],
  analyzed_document_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.aggregate_insights ENABLE ROW LEVEL SECURITY;

-- Create policies for aggregate_insights
CREATE POLICY "Users can view their own insights"
ON public.aggregate_insights
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own insights"
ON public.aggregate_insights
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own insights"
ON public.aggregate_insights
FOR DELETE
USING (auth.uid() = user_id);