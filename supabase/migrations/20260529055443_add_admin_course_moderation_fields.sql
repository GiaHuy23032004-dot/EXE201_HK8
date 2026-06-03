ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS admin_note TEXT,
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS hidden_reason TEXT,
ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_courses_status_hidden
ON public.courses(status, is_hidden);

CREATE INDEX IF NOT EXISTS idx_courses_reviewed_by
ON public.courses(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_courses_hidden_by
ON public.courses(hidden_by);
