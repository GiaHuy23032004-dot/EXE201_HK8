# VET Plus Demo Data Helper

Tài liệu này chỉ hướng dẫn cách tạo dữ liệu demo thủ công. Không tự động insert dữ liệu, không xóa dữ liệu, không dùng với production thật nếu chưa có kế hoạch kiểm thử an toàn.

## Nguyên tắc an toàn

- Chỉ dùng cho môi trường test/demo.
- Không đưa service role key vào frontend.
- Không commit secret webhook hoặc token thật.
- Không chạy lệnh update/delete nếu chưa backup dữ liệu.
- Không dùng tài khoản learner/mentor/admin thật của người dùng production để demo.
- Sau demo, ghi lại những payment/reference đã tạo để dễ kiểm tra.

## 1. Tạo payment pending qua UI

Mục tiêu: tạo dữ liệu subscription payment pending đúng flow hiện tại.

Các bước:

1. Login bằng learner demo.
2. Mở `/pricing` hoặc `/learner/subscription`.
3. Bấm `Nâng cấp VET Plus`.
4. Đợi modal thanh toán hiển thị.
5. Ghi lại `reference_code`, thường có dạng `VETSUB-...`.
6. Login admin và mở `/admin/subscriptions`.
7. Kiểm tra tab Payments có payment pending vừa tạo.

Không cần insert trực tiếp vào `subscription_payments`.

## 2. Giả lập webhook success bằng curl

Mục tiêu: mô phỏng provider gửi callback thành công cho payment subscription.

Chỉ dùng trong test/demo. Payload thực tế phải khớp với contract của `sepay-webhook` hiện tại. Nếu webhook function yêu cầu header secret, dùng biến môi trường local, không ghi secret thật vào tài liệu.

```bash
curl -X POST "$SUPABASE_URL/functions/v1/sepay-webhook" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $SEPAY_WEBHOOK_SECRET" \
  -d '{
    "id": "demo-vetsub-webhook-001",
    "gateway": "sepay",
    "transactionDate": "2026-06-07 10:00:00",
    "accountNumber": "DEMO_ACCOUNT",
    "code": "VETSUB-DEMO-REFERENCE",
    "content": "Thanh toan VET Plus VETSUB-DEMO-REFERENCE",
    "transferType": "in",
    "transferAmount": 99000,
    "referenceCode": "VETSUB-DEMO-REFERENCE",
    "description": "Demo VET Plus payment success"
  }'
```

Ghi chú:

- Thay `VETSUB-DEMO-REFERENCE` bằng reference thật vừa tạo từ UI.
- Thay `$SUPABASE_URL` bằng URL Supabase project test.
- Thay `$SEPAY_WEBHOOK_SECRET` bằng secret test từ môi trường local/CI, không hard-code vào repo.
- Nếu webhook hiện tại dùng field khác để match payment, chỉnh payload theo source `supabase/functions/sepay-webhook/index.ts`.

## 3. Kiểm tra Plus active

Sau khi webhook success:

1. Mở `/learner/subscription`.
2. Kiểm tra trạng thái VET Plus Active.
3. Kiểm tra AI credits = 60.
4. Mở `/admin/subscriptions`.
5. Kiểm tra summary revenue/payment đã cập nhật.

SQL đọc nhanh:

```sql
select
  learner_id,
  plan_code,
  status,
  current_period_start,
  current_period_end,
  ai_credits_remaining,
  updated_at
from public.learner_subscriptions
order by updated_at desc nulls last, created_at desc
limit 10;
```

## 4. Kiểm tra voucher

Sau khi Plus active:

1. Mở `/learner/subscription`.
2. Kiểm tra section `Voucher VET Plus`.
3. Plus user mới nên có 2 voucher 30.000đ nếu dữ liệu được tạo bởi flow hiện tại.
4. Mở checkout booking >= 300.000đ để kiểm tra voucher selectable.

SQL đọc nhanh:

```sql
select
  voucher_id,
  learner_id,
  code,
  amount,
  min_booking_amount,
  status,
  booking_id,
  used_at,
  expires_at,
  created_at
from public.subscription_vouchers
order by created_at desc
limit 20;
```

## 5. Kiểm tra AI credits

Các bước:

1. Mở AI Search hoặc EduBot bằng learner demo.
2. Gửi một prompt ngắn.
3. Quay lại `/learner/subscription`.
4. Kiểm tra credit giảm.
5. Kiểm tra `ai_usage_logs`.

SQL đọc nhanh:

```sql
select
  learner_id,
  feature,
  credits,
  status,
  prompt_preview,
  error_message,
  created_at,
  finalized_at
from public.ai_usage_logs
order by created_at desc
limit 20;
```

## 6. Kiểm tra admin dashboard

Mở `/admin/subscriptions` bằng admin demo.

Kiểm tra:

- Summary cards hiển thị.
- Tab Learner Plus có learner active.
- Tab Payments có payment vừa tạo.
- Tab Webhook Logs có event vừa gửi.
- Search theo reference code hoạt động.
- Copy reference code hiển thị toast `Đã copy`.

## 7. Fallback khi webhook không chạy trong buổi demo

Nếu webhook test không chạy được:

1. Không sửa code ngay trong buổi demo.
2. Chỉ dùng admin dashboard để chỉ ra payment pending.
3. Dùng SQL read-only trong `docs/vet-plus-sql-test-guide.md` để kiểm tra trạng thái.
4. Giải thích rằng payment confirmation được xử lý qua Edge Function webhook và cần provider callback hoặc curl test đúng secret.

Không nên:

- Tự update `learner_subscriptions` bằng tay trong demo.
- Tự đổi payment status trong production.
- Tắt RLS hoặc dùng service role key trong frontend.
