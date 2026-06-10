import {
  type CourseCategorySlug,
  getCourseCategoryLabel,
  getCourseCategoryShortLabel,
  normalizeCourseCategory,
} from "@/constants/courseCategories";

export type CourseIntentResult = {
  category: CourseCategorySlug | null;
  keyword: string;
  normalizedKeyword: string;
  matchedTerm: string | null;
  expandedTerms: string[];
};

const INTENT_SYNONYMS: Record<CourseCategorySlug, string[]> = {
  "mind-sports": [
    "co",
    "co vua",
    "co tuong",
    "chess",
    "mind sport",
    "chien thuat",
    "tu duy chien thuat",
  ],
  "career-english": [
    "tieng anh",
    "giao tiep",
    "english",
    "ielts",
    "toeic",
    "anh van",
    "tieng anh giao tiep",
    "tieng anh cong viec",
  ],
  "modern-sports": [
    "the thao",
    "sport",
    "sports",
    "pickleball",
    "tennis",
    "boi",
    "swimming",
    "yoga",
    "fitness",
  ],
  "barista-beverage": [
    "barista",
    "bartender",
    "pha che",
    "ca phe",
    "coffee",
    "cocktail",
    "do uong",
    "beverage",
  ],
  "content-speaking": [
    "mc",
    "lam mc",
    "dan chuong trinh",
    "thuyet trinh",
    "noi truoc dam dong",
    "public speaking",
    "content",
    "tao noi dung",
    "sang tao noi dung",
  ],
  "ai-productivity": [
    "ai",
    "cong cu lam viec",
    "automation",
    "tu dong hoa",
    "nang suat",
    "productivity",
    "chatgpt",
  ],
};

const PREFERRED_KEYWORD: Record<CourseCategorySlug, string> = {
  "mind-sports": "cờ",
  "career-english": "tiếng anh",
  "modern-sports": "thể thao",
  "barista-beverage": "pha chế",
  "content-speaking": "mc",
  "ai-productivity": "ai",
};

export function normalizeIntentText(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getCategoryTerms(category: CourseCategorySlug) {
  return [
    category,
    getCourseCategoryLabel(category),
    getCourseCategoryShortLabel(category),
    ...INTENT_SYNONYMS[category],
  ];
}

export function getCourseIntentTerms(category: CourseCategorySlug | string | null | undefined) {
  const normalizedCategory = normalizeCourseCategory(category);
  return Array.from(new Set(getCategoryTerms(normalizedCategory).map(normalizeIntentText).filter(Boolean)));
}

export function detectCourseIntent(input: string): CourseIntentResult {
  const normalizedInput = normalizeIntentText(input);

  if (!normalizedInput) {
    return {
      category: null,
      keyword: "",
      normalizedKeyword: "",
      matchedTerm: null,
      expandedTerms: [],
    };
  }

  let detectedCategory: CourseCategorySlug | null = null;
  let matchedTerm: string | null = null;

  for (const [category, terms] of Object.entries(INTENT_SYNONYMS) as Array<[CourseCategorySlug, string[]]>) {
    const foundTerm = terms.find((term) => normalizedInput.includes(normalizeIntentText(term)));
    if (foundTerm) {
      detectedCategory = category;
      matchedTerm = foundTerm;
      break;
    }
  }

  const keyword = detectedCategory ? PREFERRED_KEYWORD[detectedCategory] : input.trim();
  const expandedTerms = detectedCategory
    ? getCourseIntentTerms(detectedCategory)
    : [normalizedInput];

  return {
    category: detectedCategory,
    keyword,
    normalizedKeyword: normalizeIntentText(keyword),
    matchedTerm,
    expandedTerms,
  };
}

