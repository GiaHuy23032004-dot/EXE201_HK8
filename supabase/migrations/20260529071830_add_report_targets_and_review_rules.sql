ALTER TABLE public.reports
ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES public.reviews(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reviewed_target_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_reports_booking_id
ON public.reports(booking_id);

CREATE INDEX IF NOT EXISTS idx_reports_transaction_id
ON public.reports(transaction_id);

CREATE INDEX IF NOT EXISTS idx_reports_comment_id
ON public.reports(comment_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_course_report_target
ON public.reports(reporter_id, course_id)
WHERE status = 'pending' AND type = 'course' AND course_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_mentor_report_target
ON public.reports(reporter_id, reported_user_id)
WHERE status = 'pending' AND type = 'mentor' AND reported_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_booking_report_target
ON public.reports(reporter_id, booking_id)
WHERE status = 'pending' AND type = 'payment' AND booking_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_transaction_report_target
ON public.reports(reporter_id, transaction_id)
WHERE status = 'pending' AND type = 'payment' AND transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_comment_report_target
ON public.reports(reporter_id, comment_id)
WHERE status = 'pending' AND type = 'comment' AND comment_id IS NOT NULL;

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

DROP POLICY IF EXISTS "reviews_learner_insert" ON public.reviews;
CREATE POLICY "reviews_learner_insert"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
  learner_id = (SELECT auth.uid())
  AND booking_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_id
      AND b.course_id = course_id
      AND b.learner_id = (SELECT auth.uid())
      AND b.status = 'completed'
  )
);

CREATE OR REPLACE FUNCTION public.enforce_report_attachment_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  attachment_count INTEGER;
BEGIN
  IF NEW.file_type IS NOT NULL
    AND NEW.file_type NOT IN ('image/png', 'image/jpeg', 'image/webp', 'application/pdf') THEN
    RAISE EXCEPTION 'Unsupported report attachment type';
  END IF;

  SELECT COUNT(*)
  INTO attachment_count
  FROM public.report_attachments
  WHERE report_id = NEW.report_id;

  IF attachment_count >= 5 THEN
    RAISE EXCEPTION 'A report can have at most 5 attachments';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_attachment_limit ON public.report_attachments;
CREATE TRIGGER trg_report_attachment_limit
BEFORE INSERT ON public.report_attachments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_report_attachment_limit();
