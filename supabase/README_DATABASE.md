# Hướng dẫn Setup Database Supabase

## Bước 1: Vào Supabase Dashboard

1. Truy cập [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Chọn project: `rzuybkfmxgvigfotckfu`
3. Vào menu **SQL Editor** (thanh bên trái)

## Bước 2: Chạy Migration

1. Click **New query**
2. Copy toàn bộ nội dung file `migrations/001_initial_schema.sql`
3. Paste vào SQL Editor
4. Click **Run** (hoặc Ctrl+Enter)
5. Kiểm tra không có lỗi đỏ

## Bước 3: Kiểm tra bảng đã tạo

Vào **Table Editor** để xác nhận các bảng sau đã xuất hiện:

| Bảng | Mô tả |
|------|-------|
| `profiles` | ✅ Có sẵn - Thông tin user |
| `user_roles` | ✅ Có sẵn - Phân quyền |
| `courses` | 🆕 Khóa học |
| `course_schedules` | 🆕 Lịch dạy |
| `bookings` | 🆕 Đặt lịch học |
| `reviews` | 🆕 Đánh giá |
| `saved_courses` | 🆕 Khóa học đã lưu |
| `transactions` | 🆕 Lịch sử thanh toán |
| `mentor_wallets` | 🆕 Ví mentor |
| `wallet_transactions` | 🆕 Lịch sử ví |
| `withdrawal_requests` | 🆕 Yêu cầu rút tiền |
| `promoted_listings` | 🆕 Tin nổi bật |
| `reports` | 🆕 Báo cáo vi phạm |
| `mentor_strikes` | 🆕 Gậy phạt mentor |

## Bước 4: Cập nhật types.ts

Sau khi chạy migration, vào Supabase Dashboard:
1. **Settings** → **API** → kéo xuống phần **TypeScript Types**
2. Copy types mới và thay thế nội dung file `src/integrations/supabase/types.ts`

Hoặc dùng Supabase CLI:
```bash
npx supabase gen types typescript --project-id rzuybkfmxgvigfotckfu > src/integrations/supabase/types.ts
```

## Sơ đồ quan hệ (ERD)

```
profiles (đã có)
  ├── courses (mentor_id → profiles.user_id)
  │     ├── course_schedules (course_id → courses.id)
  │     ├── bookings (course_id → courses.id)
  │     ├── reviews (course_id → courses.id)
  │     ├── saved_courses (course_id → courses.id)
  │     ├── transactions (course_id → courses.id)
  │     └── promoted_listings (course_id → courses.id)
  ├── bookings (learner_id / mentor_id → profiles.user_id)
  ├── reviews (learner_id → profiles.user_id)
  ├── saved_courses (user_id → profiles.user_id)
  ├── transactions (learner_id / mentor_id → profiles.user_id)
  ├── mentor_wallets (mentor_id → profiles.user_id)
  ├── wallet_transactions (mentor_id → profiles.user_id)
  ├── withdrawal_requests (mentor_id → profiles.user_id)
  ├── reports (reporter_id / reported_user_id → profiles.user_id)
  └── mentor_strikes (mentor_id → profiles.user_id)
```

## Lưu ý quan trọng

- **Platform fee**: 15% trên mỗi giao dịch (đã hardcode trong schema)
- **Held balance**: Tiền giữ 7 ngày trước khi vào ví khả dụng
- **RLS**: Tất cả bảng đều có Row Level Security — user chỉ thấy data của mình
- **Triggers tự động**:
  - Tạo ví mentor khi profile có role = 'mentor'
  - Cập nhật rating khóa học khi có review mới
  - Cập nhật students_count khi booking completed
