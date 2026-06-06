export const COURSE_CATEGORIES = [
  {
    slug: "mind-sports",
    label: "Cờ & Tư duy chiến thuật",
    shortLabel: "Cờ & Tư duy",
    gradient: "from-indigo-500 to-sky-600",
  },
  {
    slug: "career-english",
    label: "Tiếng Anh công việc & học tập",
    shortLabel: "Tiếng Anh",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    slug: "modern-sports",
    label: "Thể thao hiện đại",
    shortLabel: "Thể thao",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    slug: "barista-beverage",
    label: "Barista & Đồ uống",
    shortLabel: "Barista",
    gradient: "from-amber-500 to-orange-600",
  },
  {
    slug: "content-speaking",
    label: "Nội dung, MC & Thuyết trình",
    shortLabel: "Nội dung & MC",
    gradient: "from-fuchsia-500 to-rose-600",
  },
  {
    slug: "ai-productivity",
    label: "AI & Công cụ làm việc",
    shortLabel: "AI & Công cụ",
    gradient: "from-violet-500 to-purple-700",
  },
] as const;

export type CourseCategorySlug = (typeof COURSE_CATEGORIES)[number]["slug"];

export const DEFAULT_COURSE_CATEGORY: CourseCategorySlug = "ai-productivity";

export const COURSE_CATEGORY_SLUGS = COURSE_CATEGORIES.map((category) => category.slug) as CourseCategorySlug[];

export const COURSE_CATEGORY_SELECT_OPTIONS = COURSE_CATEGORIES.map((category) => ({
  value: category.slug,
  label: category.label,
}));

export const LEGACY_CATEGORY_ALIASES: Record<CourseCategorySlug, string[]> = {
  "mind-sports": ["chess", "mind-sports", "board-game"],
  "career-english": ["language", "english", "foreign-language"],
  "modern-sports": ["fitness", "sport", "sports", "yoga", "swimming", "tennis", "pickleball"],
  "barista-beverage": ["cooking", "barista", "bartender", "beverage", "food"],
  "content-speaking": ["music", "art", "design", "creative"],
  "ai-productivity": ["coding", "programming", "business", "ai", "automation", "technology"],
};

const COURSE_CATEGORY_BY_SLUG = Object.fromEntries(
  COURSE_CATEGORIES.map((category) => [category.slug, category]),
) as Record<CourseCategorySlug, (typeof COURSE_CATEGORIES)[number]>;

const LEGACY_CATEGORY_MAP: Record<string, CourseCategorySlug> = {
  "am-nhac": "content-speaking",
  "nghe-thuat": "content-speaking",
  "thiet-ke": "content-speaking",
  "ngoai-ngu": "career-english",
  "lap-trinh": "ai-productivity",
  "the-duc": "modern-sports",
  "nau-an": "barista-beverage",
  "kinh-doanh": "ai-productivity",
  ...Object.fromEntries(
    Object.entries(LEGACY_CATEGORY_ALIASES).flatMap(([slug, aliases]) =>
      aliases.map((alias) => [alias, slug as CourseCategorySlug]),
    ),
  ),
};

function normalizeCategoryKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[_\s]+/g, "-");
}

export function isValidCourseCategorySlug(value: string | null | undefined): value is CourseCategorySlug {
  return !!value && COURSE_CATEGORY_SLUGS.includes(value as CourseCategorySlug);
}

export function normalizeCourseCategory(value: string | null | undefined): CourseCategorySlug {
  if (!value) return DEFAULT_COURSE_CATEGORY;
  const key = normalizeCategoryKey(value);
  if (isValidCourseCategorySlug(key)) return key;
  return LEGACY_CATEGORY_MAP[key] ?? DEFAULT_COURSE_CATEGORY;
}

export function getCourseCategory(value: string | null | undefined) {
  return COURSE_CATEGORY_BY_SLUG[normalizeCourseCategory(value)];
}

export function getCourseCategoryLabel(value: string | null | undefined) {
  return getCourseCategory(value).label;
}

export function getCourseCategoryShortLabel(value: string | null | undefined) {
  return getCourseCategory(value).shortLabel;
}

export function getCourseCategoryGradient(value: string | null | undefined) {
  return getCourseCategory(value).gradient;
}

export function getCourseCategoryFilterValues(value: string | null | undefined) {
  const slug = normalizeCourseCategory(value);
  return Array.from(new Set([slug, ...LEGACY_CATEGORY_ALIASES[slug]]));
}
