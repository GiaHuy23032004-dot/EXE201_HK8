ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS hidden_reason text,
ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
ADD COLUMN IF NOT EXISTS hidden_by uuid REFERENCES auth.users(id);

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "courses_public_read" ON public.courses;
CREATE POLICY "courses_public_read" ON public.courses
FOR SELECT
USING (status = 'approved' AND is_hidden = false);

DROP POLICY IF EXISTS "schedules_public_read" ON public.course_schedules;
CREATE POLICY "schedules_public_read" ON public.course_schedules
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.courses
    WHERE courses.id = course_schedules.course_id
      AND courses.status = 'approved'
      AND courses.is_hidden = false
  )
);

CREATE TABLE IF NOT EXISTS public.mentor_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  restriction_type text NOT NULL CHECK (restriction_type IN ('posting_suspended', 'account_locked', 'course_hidden')),
  reason text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mentor_restrictions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_mentor_restrictions_mentor_id
ON public.mentor_restrictions(mentor_id);

CREATE INDEX IF NOT EXISTS idx_mentor_restrictions_report_id
ON public.mentor_restrictions(report_id);

CREATE INDEX IF NOT EXISTS idx_mentor_restrictions_expires_at
ON public.mentor_restrictions(expires_at);

DROP POLICY IF EXISTS "Mentors can read own restrictions" ON public.mentor_restrictions;
CREATE POLICY "Mentors can read own restrictions"
ON public.mentor_restrictions
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = mentor_id);

DROP POLICY IF EXISTS "Admins can manage mentor restrictions" ON public.mentor_restrictions;
CREATE POLICY "Admins can manage mentor restrictions"
ON public.mentor_restrictions
FOR ALL
TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Restricted mentors cannot create courses" ON public.courses;
CREATE POLICY "Restricted mentors cannot create courses"
ON public.courses
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  mentor_id = (SELECT auth.uid())
  AND NOT EXISTS (
    SELECT 1
    FROM public.mentor_restrictions mr
    WHERE mr.mentor_id = (SELECT auth.uid())
      AND mr.restriction_type IN ('posting_suspended', 'account_locked')
      AND (mr.expires_at IS NULL OR mr.expires_at > now())
  )
);

DROP POLICY IF EXISTS "Restricted mentors cannot update courses" ON public.courses;
CREATE POLICY "Restricted mentors cannot update courses"
ON public.courses
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  mentor_id = (SELECT auth.uid())
  AND NOT EXISTS (
    SELECT 1
    FROM public.mentor_restrictions mr
    WHERE mr.mentor_id = (SELECT auth.uid())
      AND mr.restriction_type IN ('posting_suspended', 'account_locked')
      AND (mr.expires_at IS NULL OR mr.expires_at > now())
  )
)
WITH CHECK (
  mentor_id = (SELECT auth.uid())
  AND NOT EXISTS (
    SELECT 1
    FROM public.mentor_restrictions mr
    WHERE mr.mentor_id = (SELECT auth.uid())
      AND mr.restriction_type IN ('posting_suspended', 'account_locked')
      AND (mr.expires_at IS NULL OR mr.expires_at > now())
  )
);
