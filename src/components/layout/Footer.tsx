import { BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
                <BookOpen className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold">EduMarket</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Nền tảng kết nối người học và người dạy. Tìm kiếm khóa học phù hợp gần bạn.
            </p>
          </div>
          <div>
            <h4 className="mb-3 font-semibold text-foreground">Khám phá</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link to="/search" className="hover:text-primary transition-colors">Tìm khóa học</Link>
              <Link to="/map" className="hover:text-primary transition-colors">Bản đồ lớp học</Link>
              <Link to="/search?category=music" className="hover:text-primary transition-colors">Âm nhạc</Link>
              <Link to="/search?category=language" className="hover:text-primary transition-colors">Ngoại ngữ</Link>
            </div>
          </div>
          <div>
            <h4 className="mb-3 font-semibold text-foreground">Dành cho Mentor</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link to="/mentor/dashboard" className="hover:text-primary transition-colors">Bảng điều khiển</Link>
              <Link to="/mentor/create-course" className="hover:text-primary transition-colors">Tạo khóa học</Link>
              <Link to="/auth" className="hover:text-primary transition-colors">Đăng ký dạy</Link>
            </div>
          </div>
          <div>
            <h4 className="mb-3 font-semibold text-foreground">Hỗ trợ</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <a href="#" className="hover:text-primary transition-colors">Trung tâm trợ giúp</a>
              <a href="#" className="hover:text-primary transition-colors">Chính sách bảo mật</a>
              <a href="#" className="hover:text-primary transition-colors">Điều khoản sử dụng</a>
              <a href="#" className="hover:text-primary transition-colors">Liên hệ</a>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
          © 2026 EduMarket. Tất cả quyền được bảo lưu.
        </div>
      </div>
    </footer>
  );
}
