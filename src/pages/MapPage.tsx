import { MainLayout } from "@/components/layout/MainLayout";
import { useCourses } from "@/hooks/use-courses";
import { MapPin, Star, ArrowLeft, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PIN_POSITIONS = [
  { top: "20%", left: "25%" }, { top: "35%", left: "55%" },
  { top: "55%", left: "20%" }, { top: "30%", left: "72%" },
  { top: "60%", left: "48%" }, { top: "70%", left: "68%" },
  { top: "45%", left: "35%" }, { top: "25%", left: "45%" },
];

export default function MapPage() {
  const { data: allCourses = [], isLoading } = useCourses({ format: "offline" });

  const offlineCourses = allCourses.filter((c) => c.format === "offline");

  return (
    <MainLayout hideFooter>
      <div className="flex h-[calc(100vh-4rem)] flex-col md:flex-row">
        {/* Sidebar */}
        <div className="w-full overflow-y-auto border-r md:w-96">
          <div className="border-b p-4">
            <div className="flex items-center gap-2 mb-3">
              <Link to="/search">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h2 className="font-semibold text-foreground">Lớp học gần bạn</h2>
            </div>
            <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Tìm theo vị trí..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : offlineCourses.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center px-4">
              <MapPin className="h-10 w-10 text-muted mb-3" />
              <p className="text-sm text-muted-foreground">Chưa có lớp học offline nào</p>
            </div>
          ) : (
            <div className="divide-y">
              {offlineCourses.map((course) => (
                <Link
                  key={course.id}
                  to={`/course/${course.id}`}
                  className="flex gap-3 p-4 transition-colors hover:bg-muted/50"
                >
                  <img
                    src={course.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=200&h=200&fit=crop"}
                    alt={course.title}
                    className="h-20 w-20 rounded-xl object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-card-foreground line-clamp-1">{course.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{course.mentor?.name || "Mentor"}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 fill-warning text-warning" />
                      {course.rating}
                      {course.location && (
                        <>
                          <span>•</span>
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{course.location}</span>
                        </>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-bold text-primary">{course.price.toLocaleString("vi-VN")}đ/buổi</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Map area */}
        <div className="relative flex-1 bg-muted">
          <div className="absolute inset-0 bg-gradient-to-br from-muted to-accent/30">
            <svg className="absolute inset-0 h-full w-full opacity-10" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* User location */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="relative">
                <div className="h-4 w-4 rounded-full bg-secondary shadow-lg" />
                <div className="absolute -inset-2 animate-ping rounded-full bg-secondary/30" />
              </div>
            </div>

            {/* Course pins từ Supabase */}
            {offlineCourses.slice(0, 8).map((course, i) => (
              <Link
                key={course.id}
                to={`/course/${course.id}`}
                className="absolute group"
                style={{
                  top: PIN_POSITIONS[i % PIN_POSITIONS.length]?.top,
                  left: PIN_POSITIONS[i % PIN_POSITIONS.length]?.left,
                }}
              >
                <div className="flex flex-col items-center">
                  <div className="rounded-full gradient-primary p-2 shadow-lg transition-transform group-hover:scale-110">
                    <MapPin className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="mt-1 rounded-lg bg-card px-2 py-1 shadow-card opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap max-w-[160px]">
                    <p className="text-xs font-semibold text-card-foreground truncate">{course.title}</p>
                    <p className="text-xs text-primary font-bold">{course.price.toLocaleString("vi-VN")}đ</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <Badge className="bg-card text-card-foreground shadow-elevated px-4 py-2">
              <MapPin className="mr-2 h-4 w-4 text-primary" />
              {offlineCourses.length} lớp học gần bạn
            </Badge>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
