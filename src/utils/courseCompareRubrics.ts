export type CompareGoalOption = {
  value: string;
  label: string;
  description: string;
};

export const COURSE_COMPARE_GOALS: CompareGoalOption[] = [
  {
    value: "career",
    label: "Học để đi làm",
    description: "Ưu tiên giá trị nghề nghiệp, dự án thực tế và khả năng áp dụng vào công việc.",
  },
  {
    value: "beginner_zero",
    label: "Học từ số 0",
    description: "Ưu tiên khóa thân thiện với người mới và ít yêu cầu kiến thức nền.",
  },
  {
    value: "communication_confidence",
    label: "Giao tiếp/tự tin hơn",
    description: "Ưu tiên luyện tập, phản hồi cá nhân và sự tự tin khi thể hiện.",
  },
  {
    value: "hobby_health",
    label: "Giải trí/sức khỏe",
    description: "Ưu tiên trải nghiệm dễ bắt đầu, duy trì thói quen và mục tiêu cá nhân.",
  },
  {
    value: "lower_cost",
    label: "Giá rẻ hơn",
    description: "Ưu tiên học phí thấp và tổng chi phí tiếp tục học hợp lý.",
  },
  {
    value: "trusted_mentor",
    label: "Mentor uy tín hơn",
    description: "Ưu tiên đánh giá, hồ sơ mentor và các tín hiệu tin cậy công khai.",
  },
  {
    value: "unsure",
    label: "Tôi chưa biết, hãy tư vấn giúp tôi",
    description: "AI cân bằng mục tiêu, độ khó, chi phí, mentor và dữ liệu còn thiếu.",
  },
];

export const DEFAULT_COMPARE_GOAL = "unsure";

export const DOMAIN_COMPARE_RUBRICS = {
  programming: [
    "thân thiện với người mới",
    "kiến thức đầu vào",
    "lộ trình nghề nghiệp",
    "ứng dụng vào dự án",
    "độ khó",
    "công cụ/công nghệ",
  ],
  sports: [
    "thân thiện với người mới",
    "cường độ",
    "an toàn",
    "dụng cụ/địa điểm",
    "tần suất luyện tập",
    "chi phí tiếp tục",
  ],
  language: [
    "trọng tâm nghe/nói/đọc/viết",
    "ứng dụng đời sống",
    "liên quan thi cử/công việc/học tập",
    "chất lượng phản hồi",
  ],
  public_speaking: [
    "xây dựng sự tự tin",
    "thực hành nói",
    "trình bày/biểu diễn",
    "phản hồi",
    "sản phẩm đầu ra thực tế",
  ],
  creative: [
    "sản phẩm sáng tạo đầu ra",
    "mức độ thực hành",
    "giá trị portfolio",
    "công cụ/vật liệu",
    "chất lượng phản hồi",
  ],
  food_beverage: [
    "thực hành trực tiếp",
    "dụng cụ/nguyên liệu",
    "liên quan công việc",
    "thân thiện với người mới",
  ],
  music: [
    "tần suất luyện tập",
    "nền tảng kỹ thuật",
    "tự tin biểu diễn",
    "nhạc cụ",
    "phản hồi mentor",
  ],
  wellness: [
    "an toàn",
    "thân thiện với người mới",
    "cường độ",
    "duy trì thói quen",
    "phù hợp sức khỏe",
  ],
  other: [
    "phù hợp mục tiêu learner",
    "lợi ích ngắn hạn",
    "lợi ích dài hạn",
    "độ khó khi bắt đầu",
    "thời gian cần đầu tư",
    "chi phí/giá trị",
  ],
} as const;

export const CROSS_DOMAIN_RUBRIC = [
  "phù hợp mục tiêu học",
  "lợi ích ngắn hạn",
  "lợi ích dài hạn",
  "độ khó khi bắt đầu",
  "thời gian cần đầu tư",
  "chi phí/giá trị",
  "rủi ro hoặc thông tin còn thiếu",
];

export function getCompareGoalLabel(goal?: string | null) {
  return COURSE_COMPARE_GOALS.find((item) => item.value === goal)?.label ?? COURSE_COMPARE_GOALS.at(-1)?.label ?? "";
}

export function getCourseCompareRubric(domains: Array<string | null | undefined>) {
  const uniqueDomains = [...new Set(domains.filter((domain): domain is keyof typeof DOMAIN_COMPARE_RUBRICS => Boolean(domain)))];
  if (uniqueDomains.length !== 1) return CROSS_DOMAIN_RUBRIC;
  return DOMAIN_COMPARE_RUBRICS[uniqueDomains[0]] ?? CROSS_DOMAIN_RUBRIC;
}
