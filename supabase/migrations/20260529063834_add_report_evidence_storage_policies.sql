INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-evidence',
  'report-evidence',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

DROP POLICY IF EXISTS "reports_reporter_own" ON public.reports;
CREATE POLICY "reports_reporter_own"
ON public.reports
FOR INSERT
TO authenticated
WITH CHECK (
  reporter_id = (SELECT auth.uid())
  AND status = 'pending'
  AND admin_verdict IS NULL
  AND admin_email IS NULL
  AND resolved_at IS NULL
);

DROP POLICY IF EXISTS "Reporter can insert report evidence files" ON storage.objects;
CREATE POLICY "Reporter can insert report evidence files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'report-evidence'
  AND (storage.foldername(name))[1] = 'reports'
  AND EXISTS (
    SELECT 1
    FROM public.reports r
    WHERE r.id::text = (storage.foldername(name))[2]
      AND r.reporter_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Reporter can read own report evidence files" ON storage.objects;
CREATE POLICY "Reporter can read own report evidence files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'report-evidence'
  AND EXISTS (
    SELECT 1
    FROM public.reports r
    WHERE r.id::text = (storage.foldername(name))[2]
      AND r.reporter_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can manage report evidence files" ON storage.objects;
CREATE POLICY "Admins can manage report evidence files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'report-evidence'
  AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'report-evidence'
  AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins can manage all report attachments" ON public.report_attachments;
CREATE POLICY "Admins can manage all report attachments"
ON public.report_attachments
FOR ALL
TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
