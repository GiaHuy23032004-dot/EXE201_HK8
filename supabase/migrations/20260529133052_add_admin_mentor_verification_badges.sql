DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'mentor_verification_status'
  ) THEN
    ALTER TYPE public.mentor_verification_status ADD VALUE IF NOT EXISTS 'revision_required';
    ALTER TYPE public.mentor_verification_status ADD VALUE IF NOT EXISTS 'revoked';
  END IF;
END $$;

ALTER TABLE public.mentor_verifications
DROP CONSTRAINT IF EXISTS mentor_verifications_status_check;

ALTER TABLE public.mentor_verifications
ADD CONSTRAINT mentor_verifications_status_check
CHECK (status::text IN ('unverified', 'draft', 'pending', 'approved', 'rejected', 'revision_required', 'revoked')) NOT VALID;

ALTER TABLE public.mentor_verification_proofs
ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending'
  CHECK (review_status IN ('pending', 'approved', 'rejected', 'revision_required')),
ADD COLUMN IF NOT EXISTS admin_note text,
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_mentor_verification_proofs_review_status
ON public.mentor_verification_proofs(review_status);

CREATE TABLE IF NOT EXISTS public.mentor_verification_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  proof_id uuid REFERENCES public.mentor_verification_proofs(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected', 'revision_required')),
  admin_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mentor_verification_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_mentor_verification_items_mentor_id
ON public.mentor_verification_items(mentor_id);

CREATE INDEX IF NOT EXISTS idx_mentor_verification_items_proof_id
ON public.mentor_verification_items(proof_id);

DROP POLICY IF EXISTS "Mentors can read own verification items" ON public.mentor_verification_items;
CREATE POLICY "Mentors can read own verification items"
ON public.mentor_verification_items
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = mentor_id);

DROP POLICY IF EXISTS "Admins can manage verification items" ON public.mentor_verification_items;
CREATE POLICY "Admins can manage verification items"
ON public.mentor_verification_items
FOR ALL
TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mentor_trust_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  badge_type text NOT NULL CHECK (
    badge_type IN ('vet_verified', 'certificate_verified', 'portfolio_verified', 'trusted_mentor')
  ),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  public_visible boolean NOT NULL DEFAULT true,
  reason text,
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  suspended_until timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mentor_id, badge_type)
);

ALTER TABLE public.mentor_trust_badges ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_mentor_trust_badges_mentor_id
ON public.mentor_trust_badges(mentor_id);

CREATE INDEX IF NOT EXISTS idx_mentor_trust_badges_public
ON public.mentor_trust_badges(mentor_id, status, public_visible);

DROP POLICY IF EXISTS "Public can read active mentor trust badges" ON public.mentor_trust_badges;
CREATE POLICY "Public can read active mentor trust badges"
ON public.mentor_trust_badges
FOR SELECT
USING (status = 'active' AND public_visible = true);

DROP POLICY IF EXISTS "Mentors can read own trust badges" ON public.mentor_trust_badges;
CREATE POLICY "Mentors can read own trust badges"
ON public.mentor_trust_badges
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = mentor_id);

DROP POLICY IF EXISTS "Admins can manage trust badges" ON public.mentor_trust_badges;
CREATE POLICY "Admins can manage trust badges"
ON public.mentor_trust_badges
FOR ALL
TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.mentor_badge_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  badge_type text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('granted', 'suspended', 'revoked', 'restored')),
  reason text,
  created_by uuid REFERENCES auth.users(id),
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mentor_badge_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_mentor_badge_events_mentor_id
ON public.mentor_badge_events(mentor_id);

DROP POLICY IF EXISTS "Mentors can read own badge events" ON public.mentor_badge_events;
CREATE POLICY "Mentors can read own badge events"
ON public.mentor_badge_events
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = mentor_id);

DROP POLICY IF EXISTS "Admins can manage badge events" ON public.mentor_badge_events;
CREATE POLICY "Admins can manage badge events"
ON public.mentor_badge_events
FOR ALL
TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
