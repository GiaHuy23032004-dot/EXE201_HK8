// ── Category groups ───────────────────────────────────────────────────────────
// Khóa học phổ thông: kỹ năng mềm, sở thích, nghệ thuật, thể thao cá nhân
// Khóa học dạy nghề: kỹ năng nghề nghiệp, kiếm thu nhập, chuyên môn

export const COURSE_CATEGORIES = [
  // ── KHÓA HỌC PHỔ THÔNG ──────────────────────────────────────────────────
  {
    slug: "music-arts",
    label: "Âm nhạc & Nghệ thuật",
    shortLabel: "Âm nhạc & NT",
    gradient: "from-rose-500 to-pink-600",
    group: "general" as const,
    groupLabel: "Khóa học phổ thông",
  },
  {
    slug: "mind-sports",
    label: "Cờ & Tư duy chiến thuật",
    shortLabel: "Cờ & Tư duy",
    gradient: "from-indigo-500 to-sky-600",
    group: "general" as const,
    groupLabel: "Khóa học phổ thông",
  },
  {
    slug: "modern-sports",
    label: "Thể thao & Sức khỏe",
    shortLabel: "Thể thao",
    gradient: "from-emerald-500 to-teal-600",
    group: "general" as const,
    groupLabel: "Khóa học phổ thông",
  },
  {
    slug: "lifestyle",
    label: "Nấu ăn & Phong cách sống",
    shortLabel: "Nấu ăn & Lifestyle",
    gradient: "from-orange-400 to-amber-500",
    group: "general" as const,
    groupLabel: "Khóa học phổ thông",
  },
  // ── KHÓA HỌC DẠY NGHỀ ───────────────────────────────────────────────────
  {
    slug: "career-english",
    label: "Tiếng Anh công việc & học tập",
    shortLabel: "Tiếng Anh",
    gradient: "from-blue-500 to-cyan-500",
    group: "vocational" as const,
    groupLabel: "Khóa học dạy nghề",
  },
  {
    slug: "barista-beverage",
    label: "Barista & Pha chế",
    shortLabel: "Barista",
    gradient: "from-amber-500 to-orange-600",
    group: "vocational" as const,
    groupLabel: "Khóa học dạy nghề",
  },
  {
    slug: "content-speaking",
    label: "Nội dung, MC & Thuyết trình",
    shortLabel: "Nội dung & MC",
    gradient: "from-fuchsia-500 to-rose-600",
    group: "vocational" as const,
    groupLabel: "Khóa học dạy nghề",
  },
  {
    slug: "ai-productivity",
    label: "AI & Công cụ làm việc",
    shortLabel: "AI & Công cụ",
    gradient: "from-violet-500 to-purple-700",
    group: "vocational" as const,
    groupLabel: "Khóa học dạy nghề",
  },
] as const;

export type CourseCategorySlug = (typeof COURSE_CATEGORIES)[number]["slug"];
export type CourseCategoryGroup = "general" | "vocational";

export const GENERAL_CATEGORIES = COURSE_CATEGORIES.filter((c) => c.group === "general");
export const VOCATIONAL_CATEGORIES = COURSE_CATEGORIES.filter((c) => c.group === "vocational");

export const DEFAULT_COURSE_CATEGORY: CourseCategorySlug = "ai-productivity";

export const COURSE_CATEGORY_SLUGS = COURSE_CATEGORIES.map((category) => category.slug) as CourseCategorySlug[];

export const COURSE_CATEGORY_SELECT_OPTIONS = COURSE_CATEGORIES.map((category) => ({
  value: category.slug,
  label: category.label,
}));

export const LEGACY_CATEGORY_ALIASES: Record<CourseCategorySlug, string[]> = {
  "music-arts":       ["music", "guitar", "piano", "violin", "am-nhac", "nghe-thuat", "art", "drawing", "painting"],
  "mind-sports":      ["chess", "mind-sports", "board-game", "co-vua"],
  "career-english":   ["language", "english", "foreign-language", "ielts", "toeic"],
  "modern-sports":    ["fitness", "sport", "sports", "yoga", "swimming", "tennis", "pickleball", "gym"],
  "barista-beverage": ["cooking", "barista", "bartender", "beverage", "food", "pha-che", "do-uong"],
  "content-speaking": ["mc", "speaking", "presentation", "thuyet-trinh"],
  "ai-productivity":  ["coding", "programming", "business", "ai", "automation", "technology", "lap-trinh"],
  "lifestyle":        ["lifestyle", "cooking", "nau-an", "nutrition", "wellness", "home"],
};

const COURSE_CATEGORY_BY_SLUG = Object.fromEntries(
  COURSE_CATEGORIES.map((category) => [category.slug, category]),
) as Record<CourseCategorySlug, (typeof COURSE_CATEGORIES)[number]>;

const LEGACY_CATEGORY_MAP: Record<string, CourseCategorySlug> = {
  "am-nhac":    "music-arts",
  "nghe-thuat": "music-arts",
  "thiet-ke":   "content-speaking",
  "ngoai-ngu":  "career-english",
  "lap-trinh":  "ai-productivity",
  "the-duc":    "modern-sports",
  "nau-an":     "lifestyle",
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
