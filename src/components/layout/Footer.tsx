import { Link } from "react-router-dom";
import logoImg from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { COURSE_CATEGORIES } from "@/constants/courseCategories";

export function Footer() {
  const { user } = useAuth();
  const isMentor = user?.role === "mentor";

  return (
    <footer className="border-t border-border/40 bg-secondary">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Link to="/" className="mb-4 flex items-center gap-2">
              <img src={logoImg} alt="VET" className="h-8 w-auto" />
            </Link>
            <p className="text-sm text-muted-foreground">
              Nền tảng kết nối người học và người dạy. Tìm kiếm khóa học phù hợp gần bạn.
            </p>
          </div>

          <div>
            <h4 className="mb-3 font-semibold text-foreground">Khám phá</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link to="/search" className="transition-colors hover:text-primary">
                Tìm khóa học
              </Link>
              <Link to="/map" className="transition-colors hover:text-primary">
                Bản đồ lớp học
              </Link>
              {COURSE_CATEGORIES.slice(0, 2).map((category) => (
                <Link key={category.slug} to={`/search?category=${category.slug}`} className="transition-colors hover:text-primary">
                  {category.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-3 font-semibold text-foreground">Dành cho Mentor</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              {isMentor ? (
                <>
                  <Link to="/mentor/dashboard" className="transition-colors hover:text-primary">
                    Bảng điều khiển
                  </Link>
                  <Link to="/mentor/create-course" className="transition-colors hover:text-primary">
                    Tạo khóa học
                  </Link>
                </>
              ) : (
                <Link to="/auth?role=mentor" className="transition-colors hover:text-primary">
                  Đăng ký dạy
                </Link>
              )}
            </div>
          </div>

          <div>
            <h4 className="mb-3 font-semibold text-foreground">Hỗ trợ</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link to="/help" className="transition-colors hover:text-primary">
                Trung tâm trợ giúp
              </Link>
              <Link to="/privacy" className="transition-colors hover:text-primary">
                Chính sách bảo mật
              </Link>
              <Link to="/terms" className="transition-colors hover:text-primary">
                Điều khoản sử dụng
              </Link>
              <Link to="/contact" className="transition-colors hover:text-primary">
                Liên hệ
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-border/40 pt-6 text-sm text-muted-foreground">
          <span>© 2026 VET. Tất cả quyền được bảo lưu.</span>
        </div>
      </div>
    </footer>
  );
}
