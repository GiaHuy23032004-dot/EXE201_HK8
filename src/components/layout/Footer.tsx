import { Link } from "react-router-dom";
import logoImg from "@/assets/logo.png";

export function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img src={logoImg} alt="EduMarket" className="h-8 w-auto" />
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
        <div className="mt-8 border-t pt-6 flex items-center justify-between text-sm text-muted-foreground flex-wrap gap-3">
          <span>© 2026 EduMarket. Tất cả quyền được bảo lưu.</span>
          <Link to="/admin/login" className="flex items-center gap-1 text-xs opacity-50 hover:opacity-100 hover:text-primary transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
