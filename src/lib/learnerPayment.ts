export type LearnerPaymentOption = "platform_full" | "platform_deposit" | "pay_at_class";

export const DEPOSIT_RATE = 0.2;
export const MINIMUM_DEPOSIT = 50000;
export const PLATFORM_FEE_RATE = 0.15;

export function formatVnd(amount: number) {
  return `${Math.max(0, Math.round(amount)).toLocaleString("vi-VN")}đ`;
}

export function calculateDepositAmount(totalPrice: number) {
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) return 0;
  const suggestedDeposit = Math.max(totalPrice * DEPOSIT_RATE, MINIMUM_DEPOSIT);
  return Math.min(totalPrice, Math.round(suggestedDeposit));
}

export function calculateDepositBreakdown(totalPrice: number) {
  const depositAmount = calculateDepositAmount(totalPrice);
  return {
    depositAmount,
    remainingAmount: Math.max(0, totalPrice - depositAmount),
  };
}

export function calculateMentorNetAmount(originalAmount: number) {
  if (!Number.isFinite(originalAmount) || originalAmount <= 0) return 0;
  return Math.max(0, Math.round(originalAmount * (1 - PLATFORM_FEE_RATE)));
}

export function calculateVoucherPaymentBreakdown(originalAmount: number, discountAmount: number) {
  const safeOriginalAmount = Number.isFinite(originalAmount) ? Math.max(0, Math.round(originalAmount)) : 0;
  const safeDiscountAmount = Number.isFinite(discountAmount)
    ? Math.min(safeOriginalAmount, Math.max(0, Math.round(discountAmount)))
    : 0;
  const finalAmount = Math.max(0, safeOriginalAmount - safeDiscountAmount);
  const mentorNetAmount = calculateMentorNetAmount(safeOriginalAmount);

  return {
    originalAmount: safeOriginalAmount,
    discountAmount: safeDiscountAmount,
    finalAmount,
    mentorNetAmount,
    platformFeeAfterDiscount: Math.max(0, finalAmount - mentorNetAmount),
  };
}

export function defaultLearnerPaymentOption(format?: "online" | "offline" | string | null): LearnerPaymentOption {
  return format === "online" ? "platform_full" : "platform_deposit";
}

export function mapPaymentOptionToBookingMethod(option: LearnerPaymentOption): "platform" | "later" {
  return option === "pay_at_class" ? "later" : "platform";
}

export function isPlatformPaymentOption(option: LearnerPaymentOption) {
  return option === "platform_full" || option === "platform_deposit";
}

export function getPaymentOptionLabel(option: LearnerPaymentOption) {
  switch (option) {
    case "platform_full":
      return "Thanh toán qua nền tảng";
    case "platform_deposit":
      return "Đặt cọc giữ chỗ";
    case "pay_at_class":
      return "Trả tại lớp";
    default:
      return "Thanh toán";
  }
}

export function getPlatformPaymentAmount(option: LearnerPaymentOption, totalPrice: number) {
  if (option === "platform_deposit") return calculateDepositAmount(totalPrice);
  if (option === "platform_full") return totalPrice;
  return 0;
}

export function inferPaymentOptionFromBooking(input: {
  courseFormat?: string | null;
  paymentMethod?: string | null;
  totalPrice: number;
  transactionAmount?: number | null;
}): LearnerPaymentOption {
  if (input.paymentMethod !== "platform") return "pay_at_class";
  if (input.courseFormat === "online") return "platform_full";
  if (typeof input.transactionAmount === "number" && input.transactionAmount >= input.totalPrice) {
    return "platform_full";
  }
  return "platform_deposit";
}
