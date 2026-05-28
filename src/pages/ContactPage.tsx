import { MainLayout } from "@/components/layout/MainLayout";
import { Mail, Phone, MapPin, Clock, Send, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function ContactPage() {
  const { toast } = useToast();
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate sending
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    toast({ title: "Đã gửi tin nhắn!", description: "Chúng tôi sẽ phản hồi trong vòng 24h." });
    setName(""); setEmail(""); setSubject(""); setMessage("");
  };

  return (
    <MainLayout>
      <div className="container max-w-5xl py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-foreground">Liên hệ với chúng tôi</h1>
          <p className="mt-2 text-muted-foreground">Chúng tôi luôn sẵn sàng lắng nghe và hỗ trợ bạn</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Contact info */}
          <div className="space-y-6">
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="mb-5 font-semibold text-foreground">Thông tin liên hệ</h2>
              <div className="space-y-4">
                {[
                  { icon: Mail, label: "Email hỗ trợ", value: "support@vet.edu.vn" },
                  { icon: Phone, label: "Hotline (miễn phí)", value: "1800-VET-EDU" },
                  { icon: MapPin, label: "Địa chỉ", value: "Lô E2a-7, Đường D1, Khu Công nghệ cao, TP.HCM" },
                  { icon: Clock, label: "Giờ làm việc", value: "Thứ 2 - Chủ nhật: 8:00 - 22:00" },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-sm font-medium text-foreground">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-6">
              <h2 className="mb-3 font-semibold text-foreground">Câu hỏi nhanh</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• Vấn đề về tài khoản → <span className="text-primary">account@vet.edu.vn</span></p>
                <p>• Vấn đề về thanh toán → <span className="text-primary">billing@vet.edu.vn</span></p>
                <p>• Báo cáo vi phạm → <span className="text-primary">report@vet.edu.vn</span></p>
                <p>• Hợp tác kinh doanh → <span className="text-primary">partner@vet.edu.vn</span></p>
              </div>
            </div>
          </div>

          {/* Contact form */}
          <div className="rounded-2xl border bg-card p-6">
            <h2 className="mb-5 font-semibold text-foreground">Gửi tin nhắn</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Họ và tên</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nguyễn Văn A" className="mt-1" required />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="email@example.com" className="mt-1" required />
                </div>
              </div>
              <div>
                <Label>Chủ đề</Label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Tôi cần hỗ trợ về..." className="mt-1" required />
              </div>
              <div>
                <Label>Nội dung</Label>
                <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Mô tả chi tiết vấn đề của bạn..." className="mt-1 min-h-[140px]" required />
              </div>
              <Button type="submit" disabled={loading} className="w-full gradient-primary border-0 text-primary-foreground gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {loading ? "Đang gửi..." : "Gửi tin nhắn"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
