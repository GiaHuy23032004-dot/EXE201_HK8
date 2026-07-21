ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS hidden_reason text,
ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
ADD COLUMN IF NOT EXISTS hidden_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS admin_note text;

CREATE INDEX IF NOT EXISTS idx_courses_admin_status_created
ON public.courses(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_courses_admin_hidden
ON public.courses(is_hidden, hidden_at DESC);
