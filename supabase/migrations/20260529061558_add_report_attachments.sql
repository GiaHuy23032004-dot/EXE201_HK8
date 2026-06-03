CREATE TABLE IF NOT EXISTS public.report_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_path TEXT,
  file_type TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.report_attachments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_report_attachments_report_id
ON public.report_attachments(report_id);

DROP POLICY IF EXISTS "Reporters can insert attachments for own reports" ON public.report_attachments;
CREATE POLICY "Reporters can insert attachments for own reports"
ON public.report_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.reports r
    WHERE r.id = report_id
      AND r.reporter_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Reporters can read own report attachments" ON public.report_attachments;
CREATE POLICY "Reporters can read own report attachments"
ON public.report_attachments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.reports r
    WHERE r.id = report_id
      AND r.reporter_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can read all report attachments" ON public.report_attachments;
CREATE POLICY "Admins can read all report attachments"
ON public.report_attachments
FOR SELECT
TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
