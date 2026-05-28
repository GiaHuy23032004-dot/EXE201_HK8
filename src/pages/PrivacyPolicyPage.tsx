import { MainLayout } from "@/components/layout/MainLayout";
import { Shield } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <MainLayout>
      <div className="container max-w-3xl py-12">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Chính sách bảo mật</h1>
            <p className="text-sm text-muted-foreground">Cập nhật lần cuối: 01/01/2026</p>
          </div>
        </div>

        <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">
          {[
            {
              title: "1. Thông tin chúng tôi thu thập",
              content: "Chúng tôi thu thập thông tin bạn cung cấp khi đăng ký tài khoản (tên, email, số điện thoại), thông tin thanh toán, lịch sử đặt lịch và đánh giá khóa học. Chúng tôi cũng thu thập dữ liệu sử dụng như địa chỉ IP, loại thiết bị và hành vi duyệt web.",
            },
            {
              title: "2. Cách chúng tôi sử dụng thông tin",
              content: "Thông tin được dùng để cung cấp dịch vụ kết nối học viên và mentor, xử lý thanh toán, gửi thông báo về lịch học, cải thiện trải nghiệm người dùng và tuân thủ các yêu cầu pháp lý.",
            },
            {
              title: "3. Chia sẻ thông tin",
              content: "Chúng tôi không bán thông tin cá nhân của bạn cho bên thứ ba. Thông tin chỉ được chia sẻ với mentor khi bạn đặt lịch học, với đối tác thanh toán để xử lý giao dịch, hoặc khi có yêu cầu từ cơ quan pháp luật.",
            },
            {
              title: "4. Bảo mật dữ liệu",
              content: "Chúng tôi sử dụng mã hóa SSL/TLS cho tất cả dữ liệu truyền tải. Mật khẩu được mã hóa bằng bcrypt. Dữ liệu được lưu trữ trên hạ tầng Supabase với các biện pháp bảo mật cấp doanh nghiệp.",
            },
            {
              title: "5. Quyền của bạn",
              content: "Bạn có quyền truy cập, chỉnh sửa hoặc xóa thông tin cá nhân của mình. Bạn có thể yêu cầu xuất dữ liệu hoặc xóa tài khoản bất kỳ lúc nào bằng cách liên hệ support@vet.edu.vn.",
            },
            {
              title: "6. Cookie",
              content: "Chúng tôi sử dụng cookie để duy trì phiên đăng nhập và cải thiện trải nghiệm. Bạn có thể tắt cookie trong cài đặt trình duyệt, tuy nhiên một số tính năng có thể không hoạt động.",
            },
            {
              title: "7. Liên hệ",
              content: "Nếu có câu hỏi về chính sách bảo mật, vui lòng liên hệ: privacy@vet.edu.vn hoặc gọi 1800-VET-EDU.",
            },
          ].map((section) => (
            <div key={section.title} className="rounded-2xl border bg-card p-6">
              <h2 className="mb-3 font-semibold text-foreground">{section.title}</h2>
              <p className="text-sm leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
