# VET Plus SQL Test Guide

Tài liệu này chỉ dùng để kiểm tra dữ liệu sau khi chạy flow demo/test. Không chạy câu lệnh update/delete trên dữ liệu production nếu chưa có kế hoạch rollback.

## 1. Kiểm tra subscription plans

Mục đích: xác nhận gói Free/VET Plus đã tồn tại và đúng cấu hình.

```sql
select
  id,
  code,
  name,
  price,
  ai_credits_per_month,
  voucher_count,
  voucher_amount,
  created_at
from public.subscription_plans
order by price asc;
```

Kết quả kỳ vọng:

- Có plan Free.
- Có plan VET Plus.
- VET Plus có giá 99.000đ/tháng nếu đang dùng cấu hình demo hiện tại.
- VET Plus có 60 AI credits/tháng và 2 voucher nếu các cột này tồn tại trong schema.

## 2. Kiểm tra subscription payments

Mục đích: xem các payment nâng cấp/gia hạn VET Plus gần nhất.

```sql
select
  id,
  learner_id,
  reference_code,
  amount,
  status,
  payment_status,
  provider,
  payment_method,
  created_at,
  paid_at,
  completed_at
from public.subscription_payments
order by created_at desc
limit 10;
```

Kết quả kỳ vọng:

- Payment mới tạo có trạng thái pending.
- Sau webhook success, payment chuyển sang success/paid/completed theo schema hiện tại.
- `reference_code` của subscription nên có dạng dễ phân biệt, ví dụ `VETSUB-...`.

## 3. Kiểm tra learner subscriptions

Mục đích: xác nhận learner đã được kích hoạt VET Plus sau payment success.

```sql
select
  learner_id,
  plan_id,
  plan_code,
  status,
  current_period_start,
  current_period_end,
  ai_credits_remaining,
  created_at,
  updated_at
from public.learner_subscriptions
order by updated_at desc nulls last, created_at desc
limit 10;
```

Kết quả kỳ vọng:

- Learner nâng cấp thành công có `status = 'active'`.
- `current_period_end` nằm trong tương lai.
- `ai_credits_remaining` được reset về 60 cho Plus user.

## 4. Kiểm tra vouchers

Mục đích: xác nhận Plus user có voucher 30.000đ và trạng thái voucher đúng.

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

Kết quả kỳ vọng:

- Plus user mới kích hoạt/gia hạn có 2 voucher.
- Voucher có `amount = 30000`.
- Điều kiện booking tối thiểu là 300.000đ nếu `min_booking_amount` tồn tại.
- Voucher chưa dùng có status unused/active theo schema hiện tại.
- Sau checkout dùng voucher, voucher chuyển used và có `booking_id`/`used_at`.

## 5. Kiểm tra AI usage logs

Mục đích: xác nhận AI credit gating có log reserve/finalize.

```sql
select
  id,
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

Kết quả kỳ vọng:

- Mỗi lần dùng AI có một log.
- AI call thành công có status success.
- AI call thất bại có status failed và credit được hoàn theo RPC `finalize_ai_usage`.
- Khi hết credit, không nên có log success mới cho request bị chặn.

## 6. Kiểm tra webhook events

Mục đích: xác nhận webhook được ghi log và có idempotency/debug trail.

```sql
select
  id,
  provider,
  event_key,
  payment_type,
  reference_code,
  amount,
  status,
  reason,
  created_at,
  processed_at
from public.payment_webhook_events
order by created_at desc
limit 20;
```

Kết quả kỳ vọng:

- Webhook SePay/VietQR tạo event mới.
- `payment_type = 'subscription'` cho mã VETSUB.
- Webhook xử lý thành công có status processed/success tùy schema.
- Webhook duplicate/không match được reference có thể là ignored/failed với reason rõ ràng.

## 7. Kiểm tra booking có voucher

Mục đích: xác nhận booking đã lưu thông tin voucher/discount đúng.

```sql
select
  id,
  learner_id,
  mentor_id,
  course_id,
  status,
  payment_method,
  original_total_price,
  voucher_discount_amount,
  total_price,
  subscription_voucher_id,
  created_at
from public.bookings
where subscription_voucher_id is not null
order by created_at desc
limit 20;
```

Kết quả kỳ vọng:

- Booking dùng voucher có `subscription_voucher_id`.
- `original_total_price` là học phí gốc.
- `voucher_discount_amount` là số tiền giảm, ví dụ 30.000đ.
- `total_price` là số learner phải thanh toán sau voucher.

Nếu schema hiện tại dùng tên cột khác cho voucher booking, điều chỉnh query theo migration thực tế.

## 8. Kiểm tra mentor payout không bị giảm sai

Mục đích: xác nhận voucher subscription không làm giảm sai thu nhập mentor.

```sql
select
  b.id as booking_id,
  b.mentor_id,
  b.original_total_price,
  b.voucher_discount_amount,
  b.total_price as learner_paid_amount,
  t.amount as transaction_amount,
  t.platform_fee,
  t.net_amount,
  t.status as transaction_status,
  t.created_at
from public.bookings b
left join public.transactions t on t.booking_id = b.id
where b.subscription_voucher_id is not null
order by b.created_at desc
limit 20;
```

Kết quả kỳ vọng:

- Booking có voucher vẫn liên kết được transaction nếu payment đã tạo.
- `net_amount` của mentor không bị giảm sai ngoài rule payout hiện tại.
- Nếu business rule hiện tại tính mentor payout theo học phí gốc, kiểm tra `net_amount` tương ứng 85% của học phí gốc.
- Nếu business rule hiện tại tính theo số learner thanh toán sau voucher, cần ghi nhận rủi ro dòng tiền trước demo.

## 9. Kiểm tra admin subscription dashboard data source

Mục đích: đối chiếu dữ liệu hiển thị ở `/admin/subscriptions`.

```sql
select count(*) as active_plus_users
from public.learner_subscriptions
where status = 'active'
  and (current_period_end is null or current_period_end > now());
```

Kết quả kỳ vọng:

- Số lượng gần với card `Learner Plus active` trong admin dashboard.

```sql
select
  coalesce(sum(amount), 0) as total_subscription_revenue
from public.subscription_payments
where coalesce(payment_status, status) in ('success', 'paid', 'completed');
```

Kết quả kỳ vọng:

- Số tiền gần với card doanh thu subscription trong admin dashboard.
