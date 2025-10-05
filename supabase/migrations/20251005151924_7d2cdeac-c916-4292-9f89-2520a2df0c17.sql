-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create context_templates table
CREATE TABLE public.context_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  context_data JSONB DEFAULT '{}'::jsonb,
  is_system_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on context_templates
ALTER TABLE public.context_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for context_templates
CREATE POLICY "Anyone can view active system defaults"
  ON public.context_templates
  FOR SELECT
  USING (is_system_default = true AND is_active = true);

CREATE POLICY "Users can view their own templates"
  ON public.context_templates
  FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own templates"
  ON public.context_templates
  FOR INSERT
  WITH CHECK (auth.uid() = created_by AND is_system_default = false);

CREATE POLICY "Users can update their own templates"
  ON public.context_templates
  FOR UPDATE
  USING (auth.uid() = created_by AND is_system_default = false);

CREATE POLICY "Users can delete their own templates"
  ON public.context_templates
  FOR DELETE
  USING (auth.uid() = created_by AND is_system_default = false);

CREATE POLICY "Admins can create system defaults"
  ON public.context_templates
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND is_system_default = true);

CREATE POLICY "Admins can update system defaults"
  ON public.context_templates
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') AND is_system_default = true);

CREATE POLICY "Admins can delete system defaults"
  ON public.context_templates
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin') AND is_system_default = true);

-- Update analysis_sessions table
ALTER TABLE public.analysis_sessions
  ADD COLUMN context_template_ids UUID[] DEFAULT ARRAY[]::UUID[],
  ADD COLUMN merged_context JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN full_prompt_preview TEXT;

-- Create trigger for updated_at on context_templates
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_context_templates_updated_at
  BEFORE UPDATE ON public.context_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();