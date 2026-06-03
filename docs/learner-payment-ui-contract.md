# Learner Payment UI Contract

This document describes the current frontend-only learner booking and payment rules for VET / EduMarket.

No real payment gateway is integrated in this contract. The checkout page is provider-agnostic and only prepares the UI flow for future backend/payment work.

## Business Rules By Course Format

### Online

- Learner can only use `platform_full`.
- Learner pays the full course/session amount through the platform.
- The UI must not show "Trả tại lớp" or pay-later options.
- Booking is created first with `bookings.payment_method = "platform"`.
- A pending transaction/payment session should be created for the full amount.
- Booking should be confirmed only after a future payment provider webhook confirms payment.

### Offline

- Default option is `platform_deposit`.
- Learner pays a deposit through the platform to hold a spot.
- Remaining amount is paid directly to the mentor at class.
- Learner may choose `pay_at_class`.
- If `pay_at_class` is selected, the backend should only create a booking request pending mentor confirmation.
- Mentor confirmation may be required for offline bookings, especially when no deposit has been paid.

## Frontend Payment Option Values

```ts
type LearnerPaymentOption =
  | "platform_full"
  | "platform_deposit"
  | "pay_at_class";
```

Mapping to current database fields:

| Frontend option | bookings.payment_method | transactions amount |
| --- | --- | --- |
| `platform_full` | `platform` | full course price |
| `platform_deposit` | `platform` | deposit amount |
| `pay_at_class` | `later` | no transaction |

## Deposit UI Rule

Current temporary frontend rule:

```ts
depositRate = 0.2
minimumDeposit = 50000
depositAmount = min(totalPrice, max(totalPrice * depositRate, minimumDeposit))
remainingAmount = totalPrice - depositAmount
```

The backend should eventually own this rule and return the authoritative payment amount.

## Backend Integration Notes

- Create the booking first.
- For `platform_full` and `platform_deposit`, create a pending transaction/payment session.
- Return QR/payment information from the bank/payment provider when available.
- A payment webhook should confirm the transaction and update booking/payment status.
- For `pay_at_class`, create only the booking request and leave payment to learner/mentor at class.
- Do not expose secrets, bank credentials, or provider keys to the frontend.

## UI Expectations

- Online booking CTA: "Tiếp tục thanh toán".
- Offline deposit CTA: "Đặt cọc giữ chỗ".
- Offline pay-at-class CTA: "Gửi yêu cầu đặt lịch".
- Online checkout title: "Thanh toán khóa học".
- Offline deposit checkout title: "Thanh toán đặt cọc giữ chỗ".
- Deposit receipt title: "Biên nhận đặt cọc".
- Full payment receipt title: "Thanh toán khóa học".
