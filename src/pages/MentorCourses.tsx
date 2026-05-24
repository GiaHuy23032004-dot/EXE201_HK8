import { useState } from "react";
import { Link } from "react-router-dom";
import { MentorLayout } from "@/components/layout/MentorLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useMentorCourses, useDeleteCourse, type Course } from "@/hooks/use-courses";
import { EditCourseDialog } from "@/components/mentor/EditCourseDialog";
import {
  Plus, Star, Users, Eye, MapPin, Video,
  Pencil, Trash2, ExternalLink, Clock, AlertTriangle,
  BookOpen, Loader2, Search, LayoutGrid, List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── constants ────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "approved" | "pending" | "rejected";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all",      label: "Tất cả"    },
  { key: "approved", label: "Đã duyệt"  },
  { key: "pending",  label: "Chờ duyệt" },
  { key: "rejected", label: "Từ chối"   },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  approved: { label: "Đã duyệt",  cls: "bg-success/10 text-success border-0"        },
  pending:  { label: "Chờ duyệt", cls: "bg-warning/10 text-warning border-0"         },
  rejected: { label: "Từ chối",   cls: "bg-destructive/10 text-destructive border-0" },
};

const FORMAT_ICON: Record<string, React.ReactNode> = {
  online:  <Video  className="h-3 w-3" />,
  offline: <MapPin className="h-3 w-3" />,
};

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop";

// ─── skeleton ─────────────────────────────────────────────────────────────────

function CourseSkeleton() {
  return (
    <div className="rounded-2xl border bg-card shadow-card overflow-hidden animate-pulse">
      <div className="h-44 bg-muted" />
      <div className="p-4 space-y-3">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded-full bg-muted" />
          <div className="h-5 w-16 rounded-full bg-muted" />
        </div>
        <div className="flex justify-between pt-1">
          <div className="h-4 w-20 rounded bg-muted" />
          <div className="h-4 w-16 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

// ─── course card (grid) ───────────────────────────────────────────────────────

interface CourseCardProps {
  course:   Course;
  onEdit:   (course: Course) => void;
  onDelete: (course: Course) => void;
  index:    number;
}

function CourseCard({ course: c, onEdit, onDelete, index }: CourseCardProps) {
  const sb = STATUS_BADGE[c.status] ?? STATUS_BADGE.pending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group rounded-2xl border bg-card shadow-card overflow-hidden hover:shadow-card-hover transition-shadow"
    >
      {/* Thumbnail */}
      <div className="relative h-44 overflow-hidden bg-muted">
        <img
          src={c.image_url ?? FALLBACK_IMG}
          alt={c.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3">
          <Badge className={cn("text-[11px] font-semibold shadow-sm", sb.cls)}>
            {sb.label}
          </Badge>
        </div>
        <div className="absolute right-3 top-3">
          <Badge className="flex items-center gap-1 bg-background/90 text-foreground border-0 text-[11px] backdrop-blur-sm">
            {FORMAT_ICON[c.format]}
            {c.format === "online" ? "Online" : "Offline"}
          </Badge>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-primary/70">
          {c.category}
        </p>
        <h3 className="mb-2 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {c.title}
        </h3>

        {/* Stats */}
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-warning text-warning" />
            {c.rating > 0 ? c.rating.toFixed(1) : "—"}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />{c.students_count}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />{c.review_count}
          </span>
          <span className="flex items-center gap-1 ml-auto">
            <Clock className="h-3 w-3" />
            {new Date(c.created_at).toLocaleDateString("vi-VN")}
          </span>
        </div>

        {/* Price */}
        <p className="mb-4 text-base font-bold text-primary">
          {c.price.toLocaleString("vi-VN")}đ
          <span className="ml-1 text-xs font-normal text-muted-foreground">/buổi</span>
        </p>

        {/* Actions — 3 buttons in a row */}
        <div className="grid grid-cols-3 gap-2">
          <Link to={`/course/${c.id}`} target="_blank">
            <Button variant="outline" size="sm" className="w-full rounded-xl text-xs gap-1">
              <ExternalLink className="h-3.5 w-3.5" />
              Xem
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={() => onEdit(c)}
            className="w-full rounded-xl text-xs gap-1 gradient-primary border-0 text-primary-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
            Sửa
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(c)}
            className="w-full rounded-xl text-xs gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Xóa
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── course row (list view) ───────────────────────────────────────────────────

interface CourseRowProps {
  course:   Course;
  onEdit:   (course: Course) => void;
  onDelete: (course: Course) => void;
  index:    number;
}

function CourseRow({ course: c, onEdit, onDelete, index }: CourseRowProps) {
  const sb = STATUS_BADGE[c.status] ?? STATUS_BADGE.pending;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center gap-4 rounded-2xl border bg-card px-5 py-4 shadow-card hover:shadow-card-hover transition-shadow"
    >
      <img
        src={c.image_url ?? FALLBACK_IMG}
        alt={c.title}
        className="h-16 w-24 shrink-0 rounded-xl object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <Badge className={cn("text-[10px]", sb.cls)}>{sb.label}</Badge>
          <Badge className="flex items-center gap-1 bg-muted text-muted-foreground border-0 text-[10px]">
            {FORMAT_ICON[c.format]}
            {c.format === "online" ? "Online" : "Offline"}
          </Badge>
          <span className="text-[11px] font-medium text-primary/70 uppercase tracking-wide">
            {c.category}
          </span>
        </div>
        <p className="truncate text-sm font-semibold text-foreground">{c.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-warning text-warning" />
            {c.rating > 0 ? c.rating.toFixed(1) : "—"}
          </span>
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.students_count} học viên</span>
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{c.review_count} đánh giá</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(c.created_at).toLocaleDateString("vi-VN")}</span>
        </div>
      </div>
      <p className="shrink-0 text-base font-bold text-primary hidden sm:block">
        {c.price.toLocaleString("vi-VN")}đ
      </p>
      {/* Actions — icon-only buttons */}
      <div className="flex shrink-0 items-center gap-2">
        <Link to={`/course/${c.id}`} target="_blank">
          <Button variant="outline" size="sm" className="rounded-xl h-8 w-8 p-0" title="Xem trang">
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </Link>
        <Button
          size="sm"
          onClick={() => onEdit(c)}
          className="rounded-xl h-8 w-8 p-0 gradient-primary border-0 text-primary-foreground"
          title="Chỉnh sửa"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDelete(c)}
          className="rounded-xl h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
          title="Xóa"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function MentorCourses() {
  const { session } = useAuth();
  const { toast }   = useToast();
  const mentorId    = session?.user?.id ?? "";

  const { data: courses = [], isLoading, isError } = useMentorCourses(mentorId || undefined);
  const deleteCourse = useDeleteCourse();

  const [activeTab,    setActiveTab]    = useState<StatusFilter>("all");
  const [search,       setSearch]       = useState("");
  const [viewMode,     setViewMode]     = useState<"grid" | "list">("grid");
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [editTarget,   setEditTarget]   = useState<Course | null>(null);

  // ── derived data ──────────────────────────────────────────────────────────
  const counts: Record<StatusFilter, number> = {
    all:      courses.length,
    approved: courses.filter((c) => c.status === "approved").length,
    pending:  courses.filter((c) => c.status === "pending").length,
    rejected: courses.filter((c) => c.status === "rejected").length,
  };

  const filtered = courses.filter((c) => {
    const matchTab    = activeTab === "all" || c.status === activeTab;
    const matchSearch = search.trim() === "" ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  // ── delete handler ────────────────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCourse.mutateAsync(deleteTarget.id);
      toast({ title: "Đã xóa khóa học", description: deleteTarget.title });
    } catch (err: any) {
      toast({ title: "Lỗi khi xóa", description: err.message, variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <MentorLayout>
      <div className="p-6 lg:p-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Khóa học của tôi</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Quản lý toàn bộ {courses.length} khóa học của bạn
            </p>
          </div>
          <Link to="/mentor/create-course">
            <Button className="gradient-primary border-0 text-primary-foreground rounded-xl shadow-lg shadow-primary/20 shrink-0">
              <Plus className="mr-2 h-4 w-4" />
              Tạo khóa học mới
            </Button>
          </Link>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Status tabs */}
          <div className="flex items-center gap-1 rounded-xl border bg-card p-1 shadow-card overflow-x-auto">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {tab.label}
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  activeTab === tab.key
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}>
                  {counts[tab.key]}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên, danh mục..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 rounded-xl border bg-card p-1 shadow-card ml-auto">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className={cn(
            viewMode === "grid"
              ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
              : "space-y-3"
          )}>
            {Array.from({ length: 6 }).map((_, i) =>
              viewMode === "grid"
                ? <CourseSkeleton key={i} />
                : <div key={i} className="h-24 rounded-2xl border bg-card animate-pulse shadow-card" />
            )}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center rounded-2xl border border-destructive/20 bg-destructive/5 py-16 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
            <p className="font-semibold text-foreground">Không thể tải khóa học</p>
            <p className="mt-1 text-sm text-muted-foreground">Vui lòng thử lại sau.</p>
          </div>
        ) : filtered.length === 0 ? (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center rounded-2xl border-2 border-dashed border-border py-20 text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <BookOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              {search || activeTab !== "all" ? (
                <>
                  <p className="font-semibold text-foreground">Không tìm thấy khóa học</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4 rounded-xl"
                    onClick={() => { setSearch(""); setActiveTab("all"); }}
                  >
                    Xóa bộ lọc
                  </Button>
                </>
              ) : (
                <>
                  <p className="font-semibold text-foreground">Bạn chưa có khóa học nào</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tạo khóa học đầu tiên để bắt đầu dạy học.
                  </p>
                  <Link to="/mentor/create-course">
                    <Button className="mt-4 gradient-primary border-0 text-primary-foreground rounded-xl">
                      <Plus className="mr-2 h-4 w-4" />
                      Tạo khóa học đầu tiên
                    </Button>
                  </Link>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        ) : viewMode === "grid" ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((course, i) => (
              <CourseCard
                key={course.id}
                course={course}
                onEdit={setEditTarget}
                onDelete={setDeleteTarget}
                index={i}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((course, i) => (
              <CourseRow
                key={course.id}
                course={course}
                onEdit={setEditTarget}
                onDelete={setDeleteTarget}
                index={i}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Edit dialog ── */}
      <EditCourseDialog
        course={editTarget}
        mentorId={mentorId}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
      />

      {/* ── Delete confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Xóa khóa học?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bạn sắp xóa khóa học{" "}
              <span className="font-semibold text-foreground">"{deleteTarget?.title}"</span>.
              Hành động này không thể hoàn tác và sẽ xóa toàn bộ lịch dạy liên quan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteCourse.isPending}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCourse.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : "Xóa khóa học"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MentorLayout>
  );
}
