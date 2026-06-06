-- Normalize VET course categories to the 6 supported marketplace slugs.

UPDATE public.courses
SET category = CASE
  WHEN category IS NULL THEN 'ai-productivity'
  WHEN lower(category) IN ('mind-sports', 'chess', 'board-game') THEN 'mind-sports'
  WHEN lower(category) IN ('career-english', 'language', 'english', 'foreign-language') THEN 'career-english'
  WHEN lower(category) IN ('modern-sports', 'fitness', 'sport', 'sports', 'yoga', 'swimming', 'tennis', 'pickleball') THEN 'modern-sports'
  WHEN lower(category) IN ('barista-beverage', 'cooking', 'barista', 'bartender', 'beverage', 'food') THEN 'barista-beverage'
  WHEN lower(category) IN ('content-speaking', 'music', 'art', 'design', 'creative') THEN 'content-speaking'
  WHEN lower(category) IN ('ai-productivity', 'coding', 'programming', 'business', 'ai', 'automation', 'technology') THEN 'ai-productivity'
  ELSE 'ai-productivity'
END
WHERE category IS NULL
   OR category NOT IN (
    'mind-sports',
    'career-english',
    'modern-sports',
    'barista-beverage',
    'content-speaking',
    'ai-productivity'
   );

ALTER TABLE public.courses
DROP CONSTRAINT IF EXISTS courses_category_valid_slug_check;

ALTER TABLE public.courses
ADD CONSTRAINT courses_category_valid_slug_check
CHECK (
  category IN (
    'mind-sports',
    'career-english',
    'modern-sports',
    'barista-beverage',
    'content-speaking',
    'ai-productivity'
  )
) NOT VALID;
