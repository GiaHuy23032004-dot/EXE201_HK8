import { MainLayout } from "@/components/layout/MainLayout";
import { FileText } from "lucide-react";

export default function TermsPage() {
  return (
    <MainLayout>
      <div className="container max-w-3xl py-12">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary">
            <FileText className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Điều khoản sử dụng</h1>
            <p className="text-sm text-muted-foreground">Cập nhật lần cuối: 01/01/2026</p>
          </div>
        </div>

        <div className="space-y-4">
          {[
            {
              title: "1. Chấp nhận điều khoản",
              content: "Bằng cách sử dụng VET, bạn đồng ý tuân thủ các điều khoản này. Nếu không đồng ý, vui lòng không sử dụng dịch vụ.",
            },
            {
              title: "2. Tài khoản người dùng",
              content: "Bạn chịu trách nhiệm bảo mật tài khoản và mật khẩu. Không được chia sẻ tài khoản với người khác. VET có quyền khóa tài khoản vi phạm điều khoản.",
            },
            {
              title: "3. Quy tắc ứng xử",
              content: "Người dùng không được đăng nội dung vi phạm pháp luật, xúc phạm, phân biệt đối xử hoặc gian lận. Mentor phải cung cấp thông tin chính xác về trình độ và kinh nghiệm.",
            },
            {
              title: "4. Thanh toán và hoàn tiền",
              content: "Học viên thanh toán theo giá niêm yết. VET thu phí 15% trên mỗi giao dịch. Hoàn tiền được xem xét trong vòng 48h nếu mentor không thực hiện buổi học đã xác nhận.",
            },
            {
              title: "5. Nội dung khóa học",
              content: "Mentor sở hữu nội dung khóa học của mình. Học viên không được sao chép, phân phối lại nội dung mà không có sự đồng ý của mentor.",
            },
            {
              title: "6. Giới hạn trách nhiệm",
              content: "VET là nền tảng kết nối, không chịu trách nhiệm về chất lượng giảng dạy của từng mentor. Chúng tôi cung cấp hệ thống đánh giá để học viên tham khảo.",
            },
            {
              title: "7. Thay đổi điều khoản",
              content: "VET có quyền cập nhật điều khoản bất kỳ lúc nào. Người dùng sẽ được thông báo qua email khi có thay đổi quan trọng.",
            },
            {
              title: "8. Luật áp dụng",
              content: "Điều khoản này được điều chỉnh bởi pháp luật Việt Nam. Mọi tranh chấp sẽ được giải quyết tại Tòa án nhân dân TP.HCM.",
            },
          ].map((section) => (
            <div key={section.title} className="rounded-2xl border bg-card p-6">
              <h2 className="mb-3 font-semibold text-foreground">{section.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
