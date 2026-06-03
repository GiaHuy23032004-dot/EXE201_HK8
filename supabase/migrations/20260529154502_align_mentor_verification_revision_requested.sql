UPDATE public.mentor_verifications
SET status = 'revision_requested'
WHERE status = 'revision_required';

ALTER TABLE public.mentor_verifications
DROP CONSTRAINT IF EXISTS mentor_verifications_status_check;

ALTER TABLE public.mentor_verifications
ADD CONSTRAINT mentor_verifications_status_check
CHECK (status IN ('unverified', 'draft', 'pending', 'approved', 'revision_requested', 'rejected', 'revoked'));

UPDATE public.mentor_verification_proofs
SET review_status = 'revision_requested'
WHERE review_status = 'revision_required';

UPDATE public.mentor_verification_proofs
SET status = review_status
WHERE status IS DISTINCT FROM review_status
  AND review_status IN ('pending', 'approved', 'revision_requested', 'rejected');

ALTER TABLE public.mentor_verification_proofs
DROP CONSTRAINT IF EXISTS mentor_verification_proofs_review_status_check;

ALTER TABLE public.mentor_verification_proofs
ADD CONSTRAINT mentor_verification_proofs_review_status_check
CHECK (review_status IN ('pending', 'approved', 'revision_requested', 'rejected'));
