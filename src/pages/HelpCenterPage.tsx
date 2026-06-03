import { MainLayout } from "@/components/layout/MainLayout";
import { HelpCircle, MessageCircle, BookOpen, Phone, Mail, ChevronDown } from "lucide-react";
import { useState } from "react";

const faqs = [
  {
    q: "Làm thế nào để đặt lịch học?",
    a: "Tìm khóa học phù hợp, vào trang chi tiết và nhấn 'Đặt lịch học ngay'. Chọn lịch, nhập số điện thoại và chọn phương thức thanh toán phù hợp với hình thức Online/Offline.",
  },
  {
    q: "Tôi có thể hủy lịch học không?",
    a: "Có, bạn có thể hủy lịch học khi trạng thái còn là 'Sắp tới' trong trang Dashboard của học viên. Vui lòng hủy trước ít nhất 24h.",
  },
  {
    q: "Làm sao để trở thành Mentor?",
    a: "Đăng ký tài khoản với vai trò Mentor, hoàn thiện hồ sơ và gửi xác minh danh tính. Sau khi được duyệt, bạn có thể tạo khóa học.",
  },
  {
    q: "Phí nền tảng là bao nhiêu?",
    a: "VET thu phí 15% trên mỗi giao dịch thành công. Phần còn lại (85%) sẽ được chuyển vào ví Mentor sau 7 ngày kể từ ngày buổi học hoàn thành.",
  },
  {
    q: "Tôi có thể thanh toán bằng cách nào?",
    a: "Lớp online bắt buộc thanh toán 100% qua nền tảng. Lớp offline có thể đặt cọc giữ chỗ qua nền tảng hoặc trả trực tiếp tại lớp nếu mentor xác nhận.",
  },
  {
    q: "Làm sao để liên hệ hỗ trợ?",
    a: "Bạn có thể gửi email đến support@vet.edu.vn hoặc gọi hotline 1800-VET-EDU (miễn phí) từ 8h-22h hàng ngày.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-5 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="font-medium text-foreground">{q}</span>
        <ChevronDown className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t px-5 pb-5 pt-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function HelpCenterPage() {
  return (
    <MainLayout>
      <div className="container max-w-4xl py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary">
            <HelpCircle className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Trung tâm trợ giúp</h1>
          <p className="mt-2 text-muted-foreground">Tìm câu trả lời cho các câu hỏi thường gặp</p>
        </div>

        {/* Quick links */}
        <div className="mb-12 grid gap-4 sm:grid-cols-3">
          {[
            { icon: BookOpen, title: "Hướng dẫn sử dụng", desc: "Tìm hiểu cách dùng VET" },
            { icon: MessageCircle, title: "Chat hỗ trợ", desc: "Trò chuyện với đội ngũ hỗ trợ" },
            { icon: Phone, title: "Hotline", desc: "1800-VET-EDU (miễn phí)" },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border bg-card p-5 text-center hover:border-primary/30 transition-colors cursor-pointer">
              <item.icon className="h-8 w-8 text-primary mx-auto mb-3" />
              <p className="font-semibold text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <h2 className="mb-6 text-xl font-bold text-foreground">Câu hỏi thường gặp</h2>
        <div className="space-y-3 mb-12">
          {faqs.map((faq) => <FaqItem key={faq.q} {...faq} />)}
        </div>

        {/* Contact */}
        <div className="rounded-2xl border bg-card p-8 text-center">
          <Mail className="h-8 w-8 text-primary mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">Vẫn cần hỗ trợ?</h3>
          <p className="text-sm text-muted-foreground mb-4">Đội ngũ của chúng tôi luôn sẵn sàng giúp đỡ bạn</p>
          <a href="mailto:support@vet.edu.vn" className="inline-flex items-center gap-2 rounded-xl gradient-primary px-6 py-3 text-sm font-medium text-primary-foreground">
            <Mail className="h-4 w-4" />
            support@vet.edu.vn
          </a>
        </div>
      </div>
    </MainLayout>
  );
}
