# VET Plus Final Demo Script

Thoi luong muc tieu: 7-10 phut. Script nay dung cho demo bang tieng Viet voi giang vien/hoi dong.

## 0:00 - 0:45 | Gioi thieu VET va VET Plus

"VET la marketplace ket noi learner voi mentor. Learner co the tim khoa hoc, dat lich, xem ban do lop hoc, bao cao noi dung va quan ly booking. Mentor co the quan ly khoa hoc, lich day, hoc vien va doanh thu.

Trong phase nay, em demo VET Plus: goi subscription cho learner, ket hop AI credits, voucher booking va dashboard admin de theo doi doanh thu subscription."

## 0:45 - 1:20 | Mo hinh doanh thu

"VET co 2 dong doanh thu:

1. Platform fee tu booking, hien tai rule la 15%.
2. Subscription VET Plus, demo gia 99.000 dong/thang, cho learner 60 AI credits va 2 voucher booking.

Muc tieu la tang gia tri cho learner ma khong lam vo flow booking/mentor payout hien co."

## 1:20 - 1:50 | Demo `/pricing`

Thao tac:

1. Mo `/pricing`.
2. Chi ra goi Free va VET Plus.
3. Giai thich Free co AI credits dung thu, Plus co 60 credits va voucher.

Noi:

"Trang pricing giu UI gon, learner thay ro loi ich va CTA nang cap. Day la entry point subscription."

## 1:50 - 2:30 | Learner Free dung AI credits

Thao tac:

1. Login learner Free.
2. Mo search/marketplace.
3. Goi AI Course Match voi nhu cau ngan.
4. Mo `/learner/subscription` de chi credits giam.

Noi:

"AI khong goi truc tiep tu frontend. Moi lan dung AI, Edge Function goi RPC `reserve_ai_usage`. Neu con credit thi tiep tuc goi provider, neu loi thi `finalize_ai_usage` hoan credit."

## 2:30 - 3:20 | Nang cap VET Plus bang VETSUB

Thao tac:

1. Quay lai `/pricing`.
2. Bam nang cap VET Plus.
3. Mo man hinh thanh toan subscription.
4. Chi reference code `VETSUB-*`.

Noi:

"Payment subscription tach biet bang ma tham chieu VETSUB. Ma nay giup webhook phan biet subscription payment voi booking payment."

## 3:20 - 3:55 | Gia lap webhook success

Thao tac:

1. Mo terminal/postman/curl da chuan bi.
2. Goi `sepay-webhook` voi payload success va reference VETSUB.
3. Quay lai UI/refetch.

Noi:

"Webhook duoc harden: co auth key, co log event, co idempotency va goi RPC `complete_subscription_payment` de kich hoat subscription mot cach backend-side."

## 3:55 - 4:35 | Plus active, 60 credits va 2 voucher

Thao tac:

1. Mo `/learner/subscription`.
2. Chi status Plus active.
3. Chi 60 AI credits.
4. Chi 2 voucher 30.000 dong.

Noi:

"Sau payment success, learner duoc kich hoat Plus, reset AI credits va nhan voucher. Voucher chi hien thi o trang subscription va duoc ap dung o checkout khi du dieu kien."

## 4:35 - 5:10 | Demo Learning Profile

Thao tac:

1. Mo `/learner/learning-profile`.
2. Nhap muc tieu, trinh do, category, format, budget.
3. Bam luu.

Noi:

"Learning Profile giup AI co context ngan ve muc tieu hoc, so thich category, ngan sach va format. Query truc tiep cua learner van duoc uu tien hon profile."

## 5:10 - 5:50 | Demo AI Course Match

Thao tac:

1. Mo `/search`.
2. Nhap nhu cau.
3. Bam AI Course Match.
4. Chi khoa hoc goi y va credit cost.

Noi:

"AI Course Match chi recommend course that tu database, khong duoc bia course id. Ket qua duoc validate truoc khi tra ve UI."

## 5:50 - 6:25 | Demo AI Advisor

Thao tac:

1. Mo mot course detail.
2. Bam AI Advisor.
3. Chi summary, muc do phu hop, cau hoi nen hoi mentor.

Noi:

"AI Advisor ho tro learner truoc booking, nhung khong cam ket ket qua hoc tap, payment hay refund."

## 6:25 - 7:00 | Demo AI Compare

Thao tac:

1. Quay lai search.
2. Chon 2-3 khoa hoc.
3. Bam AI Compare.
4. Chi bang so sanh.

Noi:

"AI Compare ton 2 credits vi output dai hon. He thong van validate course IDs va chi so sanh khoa hoc approved/visible."

## 7:00 - 7:35 | Demo AI Roadmap

Thao tac:

1. Mo `/learner/roadmap`.
2. Nhap muc tieu hoc.
3. Tao roadmap.

Noi:

"AI Roadmap ton 3 credits va tao weekly plan. Roadmap co the dung Learning Profile lam context phu de goi y sat hon."

## 7:35 - 8:05 | Demo AI History

Thao tac:

1. Mo lai `/learner/learning-profile`.
2. Keo xuong AI History.
3. Filter Course Match, Advisor, Compare, Roadmap.

Noi:

"Learner co the xem lai lich su AI: feature, credit, status, thoi gian, provider/model va summary ngan. He thong khong hien raw provider payload dai."

## 8:05 - 8:40 | Demo voucher checkout

Thao tac:

1. Chon course co gia tu 300.000 dong.
2. Vao checkout.
3. Ap dung voucher Plus.
4. Chi discount va tong tien sau giam.

Noi:

"Voucher lam giam so tien learner thanh toan theo rule subscription. Flow nay khong thay doi AI gating va can kiem tra mentor payout khong bi giam sai theo business rule."

## 8:40 - 9:25 | Demo Admin Subscription Dashboard

Thao tac:

1. Login admin.
2. Mo `/admin/subscriptions`.
3. Chi summary cards.
4. Mo tabs Learner Plus, Payments, Webhook Logs.
5. Search reference/email va copy reference code.

Noi:

"Admin co dashboard rieng de theo doi subscription revenue, learner Plus, payment status va webhook logs. Admin authorization chi dua vao `user_roles.role = admin`, khong dung product role trong profiles."

## 9:25 - 10:00 | Ket luan

"VET Plus da co du cac thanh phan cho demo production trial: pricing, payment, webhook, subscription activation, AI credit gating, voucher, AI History, Learning Profile va admin dashboard.

Huong tiep theo khi public beta la bat billing AI, dat spend cap 10-20 USD/thang ban dau, theo doi token usage va tiep tuc harden webhook/payment monitoring."

