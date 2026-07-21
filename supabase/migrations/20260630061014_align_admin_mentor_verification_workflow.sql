ALTER TABLE public.mentor_verifications
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS experience_years integer,
ADD COLUMN IF NOT EXISTS expertise_categories text[];

ALTER TABLE public.mentor_trust_badges
ADD COLUMN IF NOT EXISTS public_label text,
ADD COLUMN IF NOT EXISTS public_description text;

UPDATE public.mentor_trust_badges
SET
  public_label = CASE badge_type
    WHEN 'vet_verified' THEN 'Đã xác minh bởi VET'
    WHEN 'certificate_verified' THEN 'Chứng chỉ đã đối chiếu'
    WHEN 'portfolio_verified' THEN 'Portfolio đã kiểm tra'
    WHEN 'trusted_mentor' THEN 'Mentor uy tín'
    ELSE badge_type
  END,
  public_description = CASE badge_type
    WHEN 'vet_verified' THEN 'Hồ sơ mentor đã được VET kiểm tra.'
    WHEN 'certificate_verified' THEN 'Chứng chỉ hoặc bằng cấp đã được Admin đối chiếu.'
    WHEN 'portfolio_verified' THEN 'Portfolio hoặc sản phẩm cá nhân đã được Admin kiểm tra.'
    WHEN 'trusted_mentor' THEN 'Mentor có lịch sử hoạt động đáng tin cậy trên VET.'
    ELSE public_description
  END
WHERE public_label IS NULL
   OR public_description IS NULL;

ALTER TABLE public.mentor_trust_badges
ALTER COLUMN public_label SET DEFAULT 'Trust badge';

ALTER TABLE public.mentor_badge_events
ADD COLUMN IF NOT EXISTS badge_id uuid REFERENCES public.mentor_trust_badges(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS strike_id uuid REFERENCES public.mentor_strikes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mentor_badge_events_badge_id
ON public.mentor_badge_events(badge_id);

CREATE INDEX IF NOT EXISTS idx_mentor_badge_events_strike_id
ON public.mentor_badge_events(strike_id);

INSERT INTO public.mentor_trust_badges (
  mentor_id,
  badge_type,
  status,
  public_visible,
  public_label,
  public_description,
  reason,
  granted_at,
  updated_at
)
SELECT
  v.mentor_id,
  'vet_verified',
  'active',
  true,
  'Đã xác minh bởi VET',
  'Hồ sơ mentor đã được VET kiểm tra.',
  'Verification approved',
  COALESCE(v.reviewed_at, v.submitted_at, v.created_at, now()),
  now()
FROM public.mentor_verifications v
WHERE v.status::text = 'approved'
ON CONFLICT (mentor_id, badge_type) DO UPDATE
SET
  status = 'active',
  public_visible = true,
  public_label = 'Đã xác minh bởi VET',
  public_description = 'Hồ sơ mentor đã được VET kiểm tra.',
  reason = COALESCE(public.mentor_trust_badges.reason, 'Verification approved'),
  updated_at = now()
WHERE public.mentor_trust_badges.status IS DISTINCT FROM 'active'
   OR public.mentor_trust_badges.public_visible IS DISTINCT FROM true
   OR public.mentor_trust_badges.public_label IS DISTINCT FROM 'Đã xác minh bởi VET';

INSERT INTO public.mentor_badge_events (
  mentor_id,
  badge_id,
  badge_type,
  event_type,
  reason,
  created_at
)
SELECT
  b.mentor_id,
  b.id,
  'vet_verified',
  'granted',
  'Verification approved',
  COALESCE(b.granted_at, now())
FROM public.mentor_trust_badges b
JOIN public.mentor_verifications v
  ON v.mentor_id = b.mentor_id
 AND v.status::text = 'approved'
WHERE b.badge_type = 'vet_verified'
  AND NOT EXISTS (
    SELECT 1
    FROM public.mentor_badge_events e
    WHERE e.mentor_id = b.mentor_id
      AND e.badge_type = 'vet_verified'
      AND e.event_type = 'granted'
  );
