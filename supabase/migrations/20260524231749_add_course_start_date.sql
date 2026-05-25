ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS start_date DATE;

CREATE INDEX IF NOT EXISTS idx_courses_start_date
ON public.courses(start_date);

NOTIFY pgrst, 'reload schema';
