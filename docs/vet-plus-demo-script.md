# VET Plus Demo Script

Thời lượng gợi ý: 5-7 phút. Script này viết theo hướng dễ nói khi demo trực tiếp với giảng viên.

## 1. Mở đầu - VET Plus là nguồn doanh thu subscription

"Ở phần này em demo VET Plus, đây là mô hình subscription dành cho learner. Ngoài doanh thu từ booking khóa học, nền tảng VET có thêm nguồn doanh thu định kỳ 99.000đ/tháng từ gói Plus. Learner Plus nhận nhiều AI credits hơn mỗi tháng và có voucher booking để quay lại sử dụng dịch vụ."

Điểm cần nhấn mạnh:

- Free vẫn dùng được app bình thường.
- VET Plus không thay thế booking, chỉ bổ sung quyền lợi.
- AI credits và voucher được kiểm soát bằng backend/RPC, không trừ thủ công ở frontend.

## 2. Mở trang pricing

Đi tới `/pricing`.

"Đây là trang pricing. Learner có thể so sánh gói Free và VET Plus. Free có AI credits thử nghiệm, còn VET Plus có 60 AI credits mỗi tháng và voucher booking."

Nói ngắn:

- Free phù hợp để thử.
- Plus dành cho learner dùng AI nhiều hơn và có nhu cầu học thường xuyên.

## 3. Giải thích Free vs VET Plus

"Điểm khác biệt chính là số AI credits và voucher. Free có 3 credits để trải nghiệm. VET Plus có 60 credits mỗi tháng, kèm 2 voucher 30.000đ cho booking đủ điều kiện."

Nếu có UI subscription:

- Mở `/learner/subscription`.
- Chỉ ra trạng thái gói hiện tại.
- Chỉ ra số AI credits còn lại.
- Chỉ ra voucher nếu là Plus.

## 4. Login learner Free và dùng AI credit

Login bằng tài khoản learner Free demo.

"Bây giờ em dùng một tính năng AI như AI Search hoặc EduBot. Mỗi lần gọi AI sẽ cần credit. Trước khi gọi AI, backend reserve credit. Nếu đủ credit thì AI mới chạy; nếu lỗi thì credit được hoàn lại."

Thao tác:

1. Mở AI Search hoặc EduBot.
2. Gửi một câu hỏi đơn giản.
3. Quay lại `/learner/subscription`.
4. Chỉ ra credit đã giảm.

Nếu credit đã hết:

"Khi credit bằng 0, learner không bị chặn toàn bộ app. Chỉ tính năng AI bị chặn và hệ thống gợi ý nâng cấp VET Plus."

## 5. Nâng cấp VET Plus

Từ `/pricing` hoặc `/learner/subscription`, bấm `Nâng cấp VET Plus`.

"Khi learner nâng cấp, hệ thống tạo một subscription payment pending. Mã thanh toán có dạng VETSUB để webhook biết đây là payment subscription, không nhầm với payment booking."

Chỉ ra:

- Modal thanh toán.
- Mã `VETSUB-...`.
- Số tiền 99.000đ.
- Hướng dẫn chuyển khoản/VietQR nếu UI có.

## 6. Giả lập webhook success

"Trong môi trường demo, em có thể giả lập webhook success thay cho chuyển khoản thật. Webhook sẽ xác nhận payment và kích hoạt gói Plus."

Thao tác demo:

- Nếu có webhook thật: thực hiện chuyển khoản test.
- Nếu giả lập: dùng curl mẫu trong `docs/vet-plus-demo-data-helper.md`.

Sau webhook:

- Payment chuyển success.
- Subscription active.
- AI credits reset về 60.
- 2 voucher được tạo.

## 7. Mở subscription page sau nâng cấp

Đi tới `/learner/subscription`.

"Sau khi payment thành công, learner thấy gói VET Plus đang active, AI credits là 60 và voucher VET Plus đã được ghi nhận."

Chỉ ra:

- Badge VET Plus Active.
- AI credits còn lại.
- Section Voucher VET Plus.
- 2 voucher 30.000đ nếu dữ liệu đã tạo.

## 8. Dùng voucher khi booking

Mở một course đủ điều kiện và đi tới checkout/booking.

"Khi booking đủ từ 300.000đ, voucher có thể được chọn. Checkout hiển thị học phí gốc, phần voucher giảm và tổng sau voucher."

Thao tác:

1. Chọn booking từ 300.000đ trở lên.
2. Chọn voucher.
3. Kiểm tra preview giảm 30.000đ.
4. Kiểm tra tổng sau voucher.

Nói rõ:

"Voucher là quyền lợi subscription cho learner. Phần mentor payout vẫn không bị giảm sai do voucher."

## 9. Mở Admin Subscription Dashboard

Login admin và mở `/admin/subscriptions`.

"Đây là dashboard admin dành cho VET Plus. Admin có thể theo dõi revenue subscription, số learner Plus, payment pending/success/failed, voucher và webhook logs."

Demo nhanh:

- Summary cards.
- Tab Learner Plus.
- Tab Payments.
- Tab Webhook Logs.
- Search bằng reference code.
- Copy reference code.
- Filter webhook failed/processed.

## 10. Kết luận

"Tóm lại, Phase subscription của VET đã có đủ flow chính: pricing, credit gating, nâng cấp Plus, payment qua SePay/VietQR, voucher checkout và admin dashboard theo dõi. Các thao tác nhạy cảm như payment confirmation và credit usage đều nằm ở backend/RPC/Edge Function, không xử lý thủ công ở frontend."

Thông điệp chốt:

- VET Plus tạo nguồn doanh thu định kỳ.
- Learner có lý do nâng cấp nhờ AI credits và voucher.
- Admin có dashboard để quan sát payment và webhook.
- Flow booking/mentor/admin cũ vẫn được giữ ổn định.
