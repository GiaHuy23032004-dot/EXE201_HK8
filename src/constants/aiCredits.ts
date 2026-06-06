export type AiFeature = "course_match" | "advisor" | "search" | "chat" | "compare" | "roadmap";

export const AI_CREDIT_COSTS: Record<AiFeature, number> = {
  course_match: 1,
  advisor: 1,
  search: 1,
  chat: 1,
  compare: 2,
  roadmap: 3,
};

export const AI_FEATURE_LABELS: Record<AiFeature, string> = {
  course_match: "AI gợi ý khóa học",
  advisor: "AI tư vấn trước khi đặt lịch",
  search: "AI gợi ý tìm kiếm",
  chat: "EduBot AI",
  compare: "AI so sánh khóa học",
  roadmap: "AI tạo lộ trình học",
};
