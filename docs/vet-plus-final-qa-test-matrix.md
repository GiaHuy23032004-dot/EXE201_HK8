# VET Plus Final QA Test Matrix

Dung bang nay de tick pass/fail truoc demo Phase 8. Moi test nen thuc hien tren moi truong staging/local co du Edge Functions va RPC da deploy.

| Nhom test | Muc tieu | Buoc test | Ket qua ky vong | Status |
| --- | --- | --- | --- | --- |
| Learner Free | Xac nhan user Free co AI credits dung thu | Login learner Free, vao `/learner/subscription` | Hien goi Free, con 3 AI credits neu chua dung trong thang | [ ] Pass / [ ] Fail |
| Learner Free | Chan AI khi het credit | Dung AI den khi credit ve 0, goi AI Advisor/Roadmap/EduBot | Khong goi AI provider, hien modal/nut nang cap VET Plus | [ ] Pass / [ ] Fail |
| Learner Plus | Xac nhan Plus active | Login learner Plus, vao `/learner/subscription` | Hien Plus active, 60 AI credits theo chu ky, 2 voucher neu data da tao | [ ] Pass / [ ] Fail |
| Goi y khoa hoc | Tim khoa hoc phu hop bang du lieu that | Vao search/marketplace, nhap nhu cau, bam Goi y khoa hoc | Khong tru AI credits, khong goi `ai-search`, hien khoa hoc that va ly do khop rule-based | [ ] Pass / [ ] Fail |
| AI Advisor | Tu van truoc booking | Mo course detail, bam AI Advisor | Tru 1 credit, ket qua khong bia gia/lich/link meeting, metadata co course_id | [ ] Pass / [ ] Fail |
| So sanh khoa hoc | So sanh 2-3 khoa hoc bang du lieu that | Chon 2-3 khoa trong search, bam So sanh khoa hoc | Khong tru AI credits, khong goi `ai-compare`, hien bang so sanh theo gia/lich/hinh thuc/danh gia/mentor | [ ] Pass / [ ] Fail |
| AI Roadmap | Tao lo trinh hoc | Vao `/learner/roadmap`, nhap muc tieu va tao roadmap | Tru 3 credits, roadmap co weekly plan va khoa hoc goi y hop le | [ ] Pass / [ ] Fail |
| Learning Profile | Luu ho so hoc tap | Vao `/learner/learning-profile`, nhap goal, category, budget, format, bam luu | RPC `upsert_my_learning_profile` thanh cong, toast thanh cong | [ ] Pass / [ ] Fail |
| Learning Profile | AI dung profile lam context phu | Luu category/format/budget, goi AI Search/Roadmap voi query ngan | AI van uu tien query truc tiep, metadata co `learning_profile_used = true` | [ ] Pass / [ ] Fail |
| AI History | Hien lich su AI cua learner | Sau khi dung AI, vao `/learner/learning-profile` | AI History hien feature, credits, status, ngay, provider/model, summary ngan | [ ] Pass / [ ] Fail |
| AI History | Khong ro ri raw payload | Kiem tra UI va RPC `get_my_ai_history` | Khong hien raw provider payload/full response dai | [ ] Pass / [ ] Fail |
| Voucher checkout | Booking duoi 300.000d khong dung voucher | Chon course gia duoi min booking amount, mo checkout | Voucher bi disable/khong ap dung, UI co ly do ro rang | [ ] Pass / [ ] Fail |
| Voucher checkout | Booking tu 300.000d dung voucher | Chon course du dieu kien, ap dung voucher | Giam 30.000d cho learner, booking luu voucher fields | [ ] Pass / [ ] Fail |
| Voucher checkout | Mentor payout regression | Kiem tra booking dung voucher va transaction/wallet lien quan | Mentor payout khong bi giam sai ngoai business rule hien tai | [ ] Pass / [ ] Fail |
| Subscription payment | Tao payment VETSUB | Vao `/pricing`, bam nang cap VET Plus | Tao `subscription_payments` pending va hien reference `VETSUB-*` | [ ] Pass / [ ] Fail |
| Subscription payment | Webhook success | Goi curl webhook success voi reference VETSUB | Payment success, learner Plus active, credit reset 60, tao voucher | [ ] Pass / [ ] Fail |
| Subscription payment | Webhook duplicate | Goi lai webhook cung event/reference | Khong kich hoat trung, `payment_webhook_events` ghi processed/ignored hop ly | [ ] Pass / [ ] Fail |
| Admin subscription dashboard | Admin xem dashboard | Login admin, vao `/admin/subscriptions` | Hien summary, Learner Plus, Payments, Webhook Logs | [ ] Pass / [ ] Fail |
| Admin subscription dashboard | Filter/search/copy | Search reference/email, filter status, copy reference/event_key | Filter dung, copy toast "Da copy", khong crash khi rong | [ ] Pass / [ ] Fail |
| Mentor wallet regression | Mentor wallet van load | Login mentor, vao `/mentor/wallet` hoac route doanh thu | Summary, transactions, withdrawals load, khong bi anh huong voucher/subscription | [ ] Pass / [ ] Fail |
| Booking regression | Booking binh thuong van hoat dong | Learner dat online/offline course theo flow hien tai | Tao booking dung status/payment_method, khong RLS error transactions | [ ] Pass / [ ] Fail |
| Marketplace regression | Search/filter marketplace | Mo `/search`, loc category, format, map neu can | Danh sach khoa hoc approved/visible load binh thuong | [ ] Pass / [ ] Fail |
| Unauthorized access test | Chan learner vao admin | Login learner, mo `/admin/subscriptions` | Bi redirect/403, khong thay du lieu admin | [ ] Pass / [ ] Fail |
| Unauthorized access test | Chan anonymous AI/private data | Logout, goi AI feature hoac `/learner/learning-profile` | Yeu cau dang nhap, khong tra AI history/profile | [ ] Pass / [ ] Fail |
| Unauthorized access test | Mentor khong dung learner AI gated flow neu bi chan | Login mentor, goi AI Advisor/Roadmap learner-only | Tra `LEARNER_REQUIRED` hoac UI chan hop ly | [ ] Pass / [ ] Fail |

## Smoke SQL Sau QA

```sql
select feature, status, count(*)
from public.ai_usage_logs
group by feature, status
order by feature, status;
```

```sql
select reference_code, status, payment_status, amount, paid_at, completed_at
from public.subscription_payments
order by created_at desc
limit 10;
```

```sql
select code, amount, min_booking_amount, status, booking_id, expires_at
from public.subscription_vouchers
order by created_at desc
limit 10;
```
