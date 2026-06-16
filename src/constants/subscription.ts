export type SubscriptionPlanCode = "free" | "vet_plus";

export interface SubscriptionPlanDefinition {
  code: SubscriptionPlanCode;
  name: string;
  price: number;
  billingInterval: "month" | "none";
  aiCreditsPerMonth: number;
  voucherCount: number;
  voucherAmount: number;
  voucherMinBookingAmount: number;
  recommended?: boolean;
  summary: string;
  features: string[];
}

export interface MySubscription {
  subscription_id: string | null;
  plan_code: SubscriptionPlanCode;
  plan_name: string;
  status: string;
  is_plus: boolean;
  price: number;
  billing_interval: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  ai_credits_remaining: number;
  ai_credits_per_month: number;
  voucher_count: number;
  voucher_amount: number;
  voucher_min_booking_amount: number;
  features: string[];
}

export interface SubscriptionVoucher {
  voucher_id: string;
  code: string;
  amount: number;
  min_booking_amount: number;
  status: string;
  booking_id: string | null;
  used_at: string | null;
  expires_at: string | null;
  created_at: string | null;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlanDefinition[] = [
  {
    code: "free",
    name: "Free",
    price: 0,
    billingInterval: "none",
    aiCreditsPerMonth: 3,
    voucherCount: 0,
    voucherAmount: 0,
    voucherMinBookingAmount: 0,
    summary: "Dành cho learner mới bắt đầu khám phá khóa học trên VET.",
    features: [
      "3 AI credits dùng thử mỗi tháng",
      "Tìm kiếm khóa học cơ bản",
      "Xem mentor và khóa học",
      "Đặt lịch học",
      "Lưu khóa học yêu thích",
    ],
  },
  {
    code: "vet_plus",
    name: "VET Plus",
    price: 99000,
    billingInterval: "month",
    aiCreditsPerMonth: 60,
    voucherCount: 2,
    voucherAmount: 30000,
    voucherMinBookingAmount: 300000,
    recommended: true,
    summary: "Học thông minh hơn với AI, voucher booking và gợi ý cá nhân hóa.",
    features: [
      "60 AI credits mỗi tháng",
      "Gợi ý khóa học cá nhân hóa",
      "So sánh 2–3 khóa học trước khi đặt lịch",
      "AI tạo lộ trình học",
      "AI tư vấn trước khi đặt lịch",
      "2 voucher 30.000đ mỗi tháng",
      "Voucher áp dụng cho booking từ 300.000đ",
      "Thông báo khóa học và slot phù hợp",
      "Lưu hồ sơ học tập cá nhân",
    ],
  },
];

export const SUBSCRIPTION_PLAN_BY_CODE = SUBSCRIPTION_PLANS.reduce(
  (map, plan) => {
    map[plan.code] = plan;
    return map;
  },
  {} as Record<SubscriptionPlanCode, SubscriptionPlanDefinition>,
);

export const FREE_SUBSCRIPTION: MySubscription = {
  subscription_id: null,
  plan_code: "free",
  plan_name: "Free",
  status: "active",
  is_plus: false,
  price: 0,
  billing_interval: null,
  current_period_start: null,
  current_period_end: null,
  ai_credits_remaining: 3,
  ai_credits_per_month: 3,
  voucher_count: 0,
  voucher_amount: 0,
  voucher_min_booking_amount: 0,
  features: SUBSCRIPTION_PLAN_BY_CODE.free.features,
};

export function normalizeSubscriptionPlanCode(value: unknown): SubscriptionPlanCode {
  const code = String(value ?? "").trim().toLowerCase();
  return code === "vet_plus" || code === "plus" ? "vet_plus" : "free";
}

export function formatSubscriptionPrice(price: number) {
  return new Intl.NumberFormat("vi-VN").format(price) + "đ";
}
