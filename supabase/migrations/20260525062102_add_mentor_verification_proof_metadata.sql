ALTER TABLE public.mentor_verification_proofs
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_mentor_verification_proofs_metadata
ON public.mentor_verification_proofs USING GIN (metadata);
