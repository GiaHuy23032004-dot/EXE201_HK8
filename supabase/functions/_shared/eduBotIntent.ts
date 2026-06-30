export type EduBotIntent =
  | "course_search"
  | "course_detail"
  | "learning_guidance"
  | "platform_help"
  | "payment_help"
  | "account_help"
  | "voucher_help"
  | "vet_plus_help"
  | "mentor_help"
  | "spam"
  | "prompt_injection"
  | "unsafe"
  | "out_of_scope"
  | "unclear";

export type EduBotIntentClassification = {
  intent: EduBotIntent;
  shouldCallAI: boolean;
  shouldChargeCredit: boolean;
  templateKey?: string;
  detectedCategory?: string | null;
  reason: string;
};

type ClassifierContext = {
  pageContext?: string | null;
  courseDetailIntent?: boolean;
};

type CategoryRule = {
  category: string;
  terms: string[];
};

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "mind-sports",
    terms: [
      "co vua",
      "co tuong",
      "co vay",
      "chess",
      "khai cuoc",
      "the co",
      "chien thuat co",
      "tu duy chien thuat",
    ],
  },
  {
    category: "career-english",
    terms: [
      "tieng anh",
      "english",
      "ielts",
      "toeic",
      "phong van",
      "email",
      "thuyet trinh tieng anh",
      "giao tiep tieng anh",
      "tieng anh cong viec",
    ],
  },
  {
    category: "modern-sports",
    terms: [
      "pickleball",
      "tennis",
      "boi",
      "swimming",
      "cau long",
      "badminton",
      "the thao",
      "ky thuat the thao",
      "an toan khi tap",
    ],
  },
  {
    category: "barista-beverage",
    terms: [
      "barista",
      "pha che",
      "ca phe",
      "coffee",
      "latte art",
      "do uong",
      "mocktail",
      "setup menu",
    ],
  },
  {
    category: "content-speaking",
    terms: [
      "mc",
      "thuyet trinh",
      "noi truoc dam dong",
      "public speaking",
      "livestream",
      "tao noi dung",
      "content",
      "kich ban",
      "dan chuong trinh",
    ],
  },
  {
    category: "ai-productivity",
    terms: [
      "ai",
      "chatgpt",
      "gemini",
      "prompt",
      "tu dong hoa",
      "automation",
      "cong cu lam viec",
      "hoc hieu qua",
      "nang suat",
    ],
  },
];

const COURSE_SEARCH_TERMS = [
  "tim khoa",
  "tim lop",
  "tim mentor",
  "co khoa",
  "co lop",
  "co mentor",
  "dang ky",
  "dang ki",
  "gan toi",
  "gan day",
  "gan quan",
  "hoc o dau",
  "hoc dau",
  "bao nhieu tien",
  "hoc phi",
  "gia ",
  "gia tien",
  "muc gia",
  "gia bao nhieu",
  "duoi ",
  "ngan sach",
  "khoa nao",
  "lop nao",
  "mentor nao",
];

const LEARNING_GUIDANCE_TERMS = [
  "ky thuat",
  "cach",
  "lam sao",
  "nhu the nao",
  "nen bat dau",
  "bat dau tu dau",
  "can hoc gi",
  "hoc gi dau tien",
  "hoc gi truoc",
  "luyen",
  "luyen tap",
  "luyen noi",
  "bai tap",
  "drill",
  "loi thuong gap",
  "phuong phap",
  "lo trinh",
  "khai cuoc",
  "ky nang nao",
];

const PLATFORM_TERMS = [
  "huong dan",
  "su dung",
  "dat lich",
  "booking",
  "ho so hoc tap",
  "learning profile",
  "lich su ai",
  "bao cao",
  "support",
  "loc",
  "filter",
];

const PAYMENT_TERMS = [
  "thanh toan",
  "chuyen khoan",
  "reference",
  "ma chuyen khoan",
  "vietqr",
  "webhook",
  "active vet plus",
  "chua active",
  "da tra tien",
  "da chuyen tien",
  "checkout",
];

const ACCOUNT_TERMS = [
  "mat khau",
  "password",
  "quen mat khau",
  "doi mat khau",
  "otp",
  "ma bao mat",
  "tai khoan",
  "dang nhap",
  "setting",
  "cai dat",
];

const VOUCHER_TERMS = ["voucher", "ma giam", "giam gia", "ap dung voucher"];

const VET_PLUS_TERMS = [
  "vet plus",
  "plus",
  "subscription",
  "goi cua toi",
  "goi plus",
  "ai credit",
  "credits",
  "99",
];

const MENTOR_TERMS = [
  "mentor dashboard",
  "rut tien",
  "vi mentor",
  "lich day",
  "hoc vien",
  "quan ly khoa",
  "tao khoa",
  "day hoc",
];

const PROMPT_INJECTION_TERMS = [
  "ignore previous instructions",
  "bo qua quy tac",
  "bo qua huong dan",
  "show system prompt",
  "system prompt",
  "tiet lo api key",
  "api key",
  "service role",
  "gia vo la admin",
  "bypass credit",
  "khong can kiem tra database",
  "developer message",
  "hidden instructions",
];

const UNSAFE_TERMS = [
  "hack",
  "danh cap tai khoan",
  "lay mat khau",
  "lo mat khau",
  "bypass payment",
  "mien phi trai phep",
  "gian lan",
  "spam he thong",
  "ddos",
  "sql injection",
  "xss",
  "phishing",
];

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(normalizedText: string, terms: string[]) {
  return terms.some((term) => normalizedText.includes(term));
}

function detectCategory(normalized: string) {
  return CATEGORY_RULES.find((rule) => containsAny(normalized, rule.terms))?.category ?? null;
}

function looksLikeSpam(normalized: string) {
  if (!normalized) return true;
  if (normalized.length <= 2) return true;
  if (/^[?!.0-9\s]+$/.test(normalized)) return true;
  if (/^(asdf|agaeg|qwer|test|abc|xyz|haha|hehe|hihi)[a-z0-9\s?!.]*$/.test(normalized) && normalized.length < 24) return true;
  if (/(.)\1{7,}/.test(normalized.replace(/\s/g, ""))) return true;
  const compact = normalized.replace(/\s/g, "");
  if (compact.length >= 8 && /^(.{1,4})\1{2,}$/.test(compact)) return true;
  return false;
}

function hasCourseSearchIntent(normalized: string) {
  return containsAny(normalized, COURSE_SEARCH_TERMS);
}

function hasLearningGuidanceIntent(normalized: string) {
  return containsAny(normalized, LEARNING_GUIDANCE_TERMS);
}

function isMaybeLearningQuestion(normalized: string) {
  return hasLearningGuidanceIntent(normalized) || containsAny(normalized, ["hoc", "ky nang", "kien thuc"]);
}

function result(
  intent: EduBotIntent,
  reason: string,
  overrides: Partial<Omit<EduBotIntentClassification, "intent" | "reason">> = {},
): EduBotIntentClassification {
  const shouldCallAI = !["spam", "prompt_injection", "unsafe", "out_of_scope", "unclear"].includes(intent);
  const shouldChargeCredit = shouldCallAI;
  return {
    intent,
    shouldCallAI,
    shouldChargeCredit,
    detectedCategory: null,
    reason,
    ...overrides,
  };
}

export function classifyEduBotIntent(
  message: string,
  context: ClassifierContext = {},
): EduBotIntentClassification {
  const normalized = normalizeText(message);

  if (context.courseDetailIntent) {
    return result("course_detail", "User is on a course detail context.", {
      detectedCategory: detectCategory(normalized),
    });
  }

  if (containsAny(normalized, PROMPT_INJECTION_TERMS)) {
    return result("prompt_injection", "Message attempts to override system or reveal internal instructions.", {
      shouldCallAI: false,
      shouldChargeCredit: false,
      templateKey: "prompt_injection",
    });
  }

  if (containsAny(normalized, UNSAFE_TERMS)) {
    return result("unsafe", "Message asks for harmful, abusive, or system-bypass behavior.", {
      shouldCallAI: false,
      shouldChargeCredit: false,
      templateKey: "unsafe",
    });
  }

  if (looksLikeSpam(normalized)) {
    return result("spam", "Message is too short, repetitive, or meaningless.", {
      shouldCallAI: false,
      shouldChargeCredit: false,
      templateKey: "spam",
    });
  }

  if (containsAny(normalized, PAYMENT_TERMS) || context.pageContext === "booking") {
    return result("payment_help", "Payment or checkout help request.", {
      detectedCategory: detectCategory(normalized),
    });
  }

  if (containsAny(normalized, ACCOUNT_TERMS)) {
    return result("account_help", "Account or password help request.", {
      detectedCategory: detectCategory(normalized),
    });
  }

  if (containsAny(normalized, VOUCHER_TERMS)) {
    return result("voucher_help", "Voucher help request.", {
      detectedCategory: detectCategory(normalized),
    });
  }

  if (containsAny(normalized, VET_PLUS_TERMS) || context.pageContext === "pricing") {
    return result("vet_plus_help", "VET Plus or AI credits help request.", {
      detectedCategory: detectCategory(normalized),
    });
  }

  if (containsAny(normalized, MENTOR_TERMS) || context.pageContext === "mentor_dashboard") {
    return result("mentor_help", "Mentor workflow help request.", {
      detectedCategory: detectCategory(normalized),
    });
  }

  if (hasCourseSearchIntent(normalized)) {
    return result("course_search", "User is explicitly asking to find courses, mentors, prices, or locations.", {
      detectedCategory: detectCategory(normalized),
    });
  }

  const category = detectCategory(normalized);
  if (category && context.pageContext === "search" && !hasLearningGuidanceIntent(normalized)) {
    return result("course_search", "Search page message with a supported VET category.", {
      detectedCategory: category,
    });
  }
  if (category && containsAny(normalized, ["toi muon hoc", "muon hoc"]) && !hasLearningGuidanceIntent(normalized)) {
    return result("course_search", "User wants to learn a supported VET category and likely needs course recommendations.", {
      detectedCategory: category,
    });
  }
  if (category && hasLearningGuidanceIntent(normalized)) {
    return result("learning_guidance", "Learning guidance request in a supported VET skill category.", {
      detectedCategory: category,
    });
  }

  if (isMaybeLearningQuestion(normalized) && !category) {
    return result("out_of_scope", "Learning question is outside the six supported VET skill categories.", {
      shouldCallAI: false,
      shouldChargeCredit: false,
      templateKey: "out_of_scope",
    });
  }

  const asksHowTo = containsAny(normalized, ["lam sao", "cach", "huong dan", "su dung", "nhu the nao"]);
  const asksSearchHowTo = asksHowTo && containsAny(normalized, ["tim khoa", "tim lop", "tim mentor", "khoa hoc phu hop", "loc", "filter"]);
  if (asksSearchHowTo || containsAny(normalized, PLATFORM_TERMS) || context.pageContext === "learner_dashboard" || context.pageContext === "learning_profile" || context.pageContext === "admin") {
    return result("platform_help", "Platform help request.", {
      detectedCategory: category,
    });
  }

  return result("unclear", "Message is not clearly related to VET platform help or supported learning topics.", {
    shouldCallAI: false,
    shouldChargeCredit: false,
    templateKey: "unclear",
    detectedCategory: category,
  });
}
