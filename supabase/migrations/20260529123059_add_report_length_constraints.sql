DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reports_title_length_check'
      AND conrelid = 'public.reports'::regclass
  ) THEN
    ALTER TABLE public.reports
    ADD CONSTRAINT reports_title_length_check
    CHECK (char_length(title) <= 120) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reports_reason_length_check'
      AND conrelid = 'public.reports'::regclass
  ) THEN
    ALTER TABLE public.reports
    ADD CONSTRAINT reports_reason_length_check
    CHECK (char_length(reason) <= 160) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reports_detail_length_check'
      AND conrelid = 'public.reports'::regclass
  ) THEN
    ALTER TABLE public.reports
    ADD CONSTRAINT reports_detail_length_check
    CHECK (detail IS NULL OR char_length(detail) BETWEEN 20 AND 1200) NOT VALID;
  END IF;
END $$;
