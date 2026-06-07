# Phase 6 - VET Plus QA Checklist

Tài liệu này dùng để kiểm tra nhanh trước khi demo VET Plus với giảng viên. Phase 6 chỉ kiểm thử và chuẩn bị demo, không thay đổi business logic, database schema, payment/webhook, AI provider/model, API key hoặc dữ liệu production.

## 1. Pre-check

### Build và type check

- [ ] Chạy `npx tsc --noEmit` và pass.
- [ ] Chạy `npm run build` và pass.
- [ ] Nếu chỉ có warning bundle size hoặc Browserslist cũ thì ghi nhận là warning, không phải lỗi chức năng.

### Edge Functions đã deploy

- [ ] `ai-search`
- [ ] `ai-chat`
- [ ] `create-subscription-payment`
- [ ] `sepay-webhook`
- [ ] `admin-subscriptions`

### Bảng và RPC cần tồn tại

- [ ] `subscription_plans`
- [ ] `learner_subscriptions`
- [ ] `subscription_payments`
- [ ] `subscription_vouchers`
- [ ] `ai_usage_logs`
- [ ] `payment_webhook_events`
- [ ] `get_my_subscription()`
- [ ] `reserve_ai_usage(feature, credits, prompt_preview, metadata)`
- [ ] `finalize_ai_usage(usage_log_id, status, error_message)`
- [ ] `get_my_subscription_vouchers()`
- [ ] `get_my_available_subscription_vouchers()`
- [ ] `complete_subscription_payment()`

## 2. Learner Free Flow

- [ ] Learner Free mở `/pricing`.
- [ ] Learner thấy rõ gói Free và VET Plus.
- [ ] Learner mở `/learner/subscription`.
- [ ] Trang hiển thị gói Free và 3 AI credits thử nghiệm mỗi tháng.
- [ ] Learner dùng AI Search hoặc EduBot.
- [ ] AI call thành công khi còn credit.
- [ ] AI credit giảm sau mỗi lần dùng.
- [ ] Khi credit = 0, AI bị chặn.
- [ ] Modal nâng cấp hiển thị nội dung hết credit và CTA tới `/pricing`.
- [ ] Search/filter thường của marketplace vẫn hoạt động, không bị chặn bởi AI credit.

## 3. Upgrade VET Plus Flow

- [ ] Learner bấm `Nâng cấp VET Plus` từ `/pricing` hoặc `/learner/subscription`.
- [ ] Edge Function `create-subscription-payment` tạo payment trạng thái pending.
- [ ] Modal thanh toán hiển thị mã chuyển khoản dạng `VETSUB-...`.
- [ ] Admin mở `/admin/subscriptions` và thấy payment pending trong tab Payments.
- [ ] Giả lập webhook success cho payment subscription.
- [ ] Payment chuyển sang success/paid/completed theo logic hiện tại.
- [ ] Subscription của learner chuyển sang VET Plus Active.
- [ ] Learner mở `/learner/subscription` thấy VET Plus Active.
- [ ] AI credits được reset về 60.
- [ ] Hệ thống tạo 2 voucher 30.000đ cho tháng hiện tại.
- [ ] Admin dashboard cập nhật summary revenue/payment/webhook.

## 4. Voucher Checkout Flow

- [ ] Learner Plus có ít nhất 1 voucher chưa dùng.
- [ ] Booking dưới 300.000đ: voucher bị disabled hoặc không được chọn.
- [ ] Booking từ 300.000đ: voucher selectable.
- [ ] Preview voucher hiển thị đúng điều kiện và giá trị giảm.
- [ ] Apply voucher giảm đúng 30.000đ.
- [ ] Checkout hiển thị học phí gốc.
- [ ] Checkout hiển thị số tiền voucher giảm.
- [ ] Checkout hiển thị tổng sau voucher.
- [ ] Booking/payment không voucher vẫn hoạt động bình thường.
- [ ] Mentor payout không bị giảm sai do voucher. Mentor vẫn được tính theo giá trị khóa học/booking theo rule hiện tại, không bị trừ trực tiếp bởi discount subscription voucher.

## 5. Admin Subscription Dashboard Flow

- [ ] Admin mở `/admin/subscriptions`.
- [ ] Trang hiển thị summary cards.
- [ ] Tab `Learner Plus` hiển thị danh sách subscription.
- [ ] Tab `Payments` hiển thị subscription payments.
- [ ] Tab `Webhook Logs` hiển thị webhook events.
- [ ] Search payment bằng `reference_code` hoạt động.
- [ ] Filter payment theo `pending`, `success`, `failed` hoạt động.
- [ ] Search learner bằng name/email hoạt động.
- [ ] Filter learner theo `active`, `cancelled`, `expired`, `pending` hoạt động.
- [ ] Filter webhook theo `payment_type` và `status` hoạt động.
- [ ] Copy reference code hiển thị toast `Đã copy`.
- [ ] User thường hoặc learner không truy cập được `/admin/subscriptions`.
- [ ] Nếu Edge Function lỗi, trang hiển thị error card và nút `Thử lại`.

## 6. Regression Checklist

- [ ] Marketplace `/search` vẫn load.
- [ ] Homepage `/` vẫn load cho learner.
- [ ] Map `/map` vẫn load.
- [ ] Course detail vẫn load.
- [ ] Booking không dùng voucher vẫn hoạt động.
- [ ] Booking dùng voucher vẫn hoạt động.
- [ ] Checkout booking cũ không bị ảnh hưởng.
- [ ] Learner dashboard vẫn load.
- [ ] Learner reports vẫn load.
- [ ] Mentor dashboard vẫn load.
- [ ] Mentor courses vẫn load.
- [ ] Mentor schedule vẫn load.
- [ ] Mentor wallet không bị ảnh hưởng sai.
- [ ] Admin dashboard cũ `/admin/dashboard` vẫn load.
- [ ] Admin users/reports/courses vẫn load.
- [ ] Admin mentor verification vẫn load.

## 7. Demo Sign-off

- [ ] Đã có ít nhất 1 learner Free để demo credit gating.
- [ ] Đã có ít nhất 1 learner Plus để demo subscription/voucher.
- [ ] Đã có ít nhất 1 payment pending để demo admin dashboard.
- [ ] Đã có ít nhất 1 webhook event để demo webhook log.
- [ ] Đã chuẩn bị fallback nếu webhook test không chạy được trong buổi demo: dùng SQL read-only để chỉ ra payment/subscription/voucher đã tồn tại.
