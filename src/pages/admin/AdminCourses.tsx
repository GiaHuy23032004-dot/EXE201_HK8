import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  Loader2,
  MessageSquare,
  Search,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getCourseCategoryLabel } from "@/constants/courseCategories";

type AdminCourseStatus = "pending" | "approved" | "rejected";
type AdminCourseFilter = "all" | AdminCourseStatus | "hidden";
type CourseAction = "approve_course" | "hide_course" | "unhide_course" | "delete_course_if_safe";

type CourseCounts = {
  bookings: number;
  reviews: number;
  transactions: number;
  reports: number;
};

type CourseSchedule = {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
};

type AdminCourse = {
  id: string;
  mentor_id: string;
  title: string;
  description: string | null;
  category: string;
  format: "online" | "offline";
  price: number;
  location: string | null;
  meeting_link: string | null;
  image_url: string | null;
  status: AdminCourseStatus;
  is_promoted: boolean;
  is_hidden: boolean;
  hidden_reason: string | null;
  hidden_at: string | null;
  students_count: number;
  rating: number;
  review_count: number;
  reviewed_at: string | null;
  rejection_reason: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  mentor: {
    user_id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
  } | null;
  counts: CourseCounts;
  can_delete: boolean;
  course_schedules?: CourseSchedule[];
};

const filterLabels: Record<AdminCourseFilter, string> = {
  all: "Tất cả",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  hidden: "Đã tạm ẩn",
};

const formatVnd = (value: number) => value.toLocaleString("vi-VN") + "đ";
const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString("vi-VN") : "Chưa có");
const formatShortDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa có");
const formatTime = (value?: string | null) => (value ? value.slice(0, 5) : "");
const isAutoHiddenCourse = (course: AdminCourse) =>
  course.is_hidden && course.hidden_reason === "Auto-hidden due to high report volume";

function CourseStatusBadge({ status }: { status: AdminCourseStatus }) {
  if (status === "approved") {
    return <Badge className="border-0 bg-success/10 text-success">Đã duyệt</Badge>;
  }

  if (status === "rejected") {
    return <Badge className="border-0 bg-destructive/10 text-destructive">Từ chối</Badge>;
  }

  return <Badge className="border-0 bg-warning/10 text-warning">Chờ duyệt</Badge>;
}

export default function AdminCourses() {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AdminCourseFilter>("all");
  const [selectedCourse, setSelectedCourse] = useState<AdminCourse | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: CourseAction; course: AdminCourse } | null>(null);
  const [rejectCourse, setRejectCourse] = useState<AdminCourse | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");

  const invokeCourseAction = async (body: Record<string, unknown>) => {
    const accessToken = session?.access_token;
    if (!accessToken) throw new Error("Missing admin session");

    const { data, error } = await supabase.functions.invoke("admin-course-actions", {
      body,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (import.meta.env.DEV) {
      console.log("admin-course-actions response", { body, data, error });
    }

    if (error || data?.error) {
      throw new Error(error?.message || data?.error || "Không thể thực hiện thao tác.");
    }

    return data;
  };

  const {
    data: courses = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-courses"],
    enabled: !!session?.access_token,
    queryFn: async () => {
      const data = await invokeCourseAction({ action: "list_courses" });
      return (data.courses ?? []) as AdminCourse[];
    },
  });

  const counts = useMemo(() => ({
    all: courses.length,
    pending: courses.filter((course) => course.status === "pending").length,
    approved: courses.filter((course) => course.status === "approved" && !course.is_hidden).length,
    rejected: courses.filter((course) => course.status === "rejected").length,
    hidden: courses.filter((course) => course.is_hidden).length,
  }), [courses]);

  const filteredCourses = useMemo(() => {
    const term = search.trim().toLowerCase();

    return courses.filter((course) => {
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "hidden"
            ? course.is_hidden
            : course.status === filter && (filter !== "approved" || !course.is_hidden);

      const matchesSearch =
        !term ||
        [course.title, course.category, getCourseCategoryLabel(course.category), course.mentor?.name, course.mentor?.email]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term));

      return matchesFilter && matchesSearch;
    });
  }, [courses, filter, search]);

  const refreshCourses = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
  };

  const openDetail = async (courseId: string) => {
    setDetailLoadingId(courseId);
    try {
      const data = await invokeCourseAction({ action: "get_course_detail", courseId });
      setSelectedCourse(data.course as AdminCourse);
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể tải chi tiết khóa học.",
        variant: "destructive",
      });
    } finally {
      setDetailLoadingId(null);
    }
  };

  const runAction = async (action: CourseAction, course: AdminCourse, reason?: string) => {
    setActionLoading(`${course.id}_${action}`);
    try {
      const data = await invokeCourseAction({ action, courseId: course.id, reason });
      await refreshCourses();
      if (data.course) setSelectedCourse(data.course as AdminCourse);
      if (action === "delete_course_if_safe") setSelectedCourse(null);

      toast({
        title:
          action === "approve_course"
            ? "Đã duyệt khóa học"
            : action === "hide_course"
              ? "Đã tạm ẩn khóa học"
              : action === "unhide_course"
                ? "Đã bỏ ẩn khóa học"
                : "Đã xóa khóa học",
      });
      setConfirmAction(null);
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể cập nhật khóa học.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const submitReject = async () => {
    if (!rejectCourse) return;
    if (!rejectReason.trim()) {
      setRejectError("Vui lòng nhập lý do từ chối.");
      return;
    }

    setActionLoading(`${rejectCourse.id}_reject_course`);
    try {
      const data = await invokeCourseAction({
        action: "reject_course",
        courseId: rejectCourse.id,
        reason: rejectReason.trim(),
      });
      await refreshCourses();
      if (data.course) setSelectedCourse(data.course as AdminCourse);
      toast({ title: "Đã từ chối khóa học" });
      setRejectCourse(null);
      setRejectReason("");
      setRejectError("");
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể từ chối khóa học.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const openReject = (course: AdminCourse) => {
    setRejectCourse(course);
    setRejectReason(course.rejection_reason ?? "");
    setRejectError("");
  };

  const stop = (event: MouseEvent) => event.stopPropagation();

  const renderActions = (course: AdminCourse, compact = false) => (
    <div className={`flex flex-wrap gap-2 ${compact ? "" : "justify-end"}`} onClick={stop}>
      <Button size="sm" variant="outline" className="rounded-lg" onClick={() => void openDetail(course.id)}>
        {detailLoadingId === course.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Eye className="mr-1 h-4 w-4" />}
        Xem chi tiết
      </Button>

      {(course.status === "pending" || course.status === "rejected") && (
        <Button
          size="sm"
          className="gradient-primary border-0 text-primary-foreground rounded-lg"
          disabled={actionLoading === `${course.id}_approve_course`}
          onClick={() => setConfirmAction({ action: "approve_course", course })}
        >
          {actionLoading === `${course.id}_approve_course` ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
          {course.status === "rejected" ? "Duyệt lại" : "Duyệt"}
        </Button>
      )}

      {(course.status === "pending" || course.status === "approved") && (
        <Button
          size="sm"
          variant="outline"
          className="rounded-lg text-destructive hover:text-destructive"
          disabled={actionLoading === `${course.id}_reject_course`}
          onClick={() => openReject(course)}
        >
          {actionLoading === `${course.id}_reject_course` ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <X className="mr-1 h-4 w-4" />}
          {course.status === "approved" ? "Gỡ duyệt" : "Từ chối"}
        </Button>
      )}

      {course.status === "approved" && !course.is_hidden && (
        <Button
          size="sm"
          variant="outline"
          className="rounded-lg"
          disabled={actionLoading === `${course.id}_hide_course`}
          onClick={() => setConfirmAction({ action: "hide_course", course })}
        >
          {actionLoading === `${course.id}_hide_course` ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <EyeOff className="mr-1 h-4 w-4" />}
          Tạm ẩn
        </Button>
      )}

      {course.is_hidden && (
        <Button
          size="sm"
          variant="outline"
          className="rounded-lg"
          disabled={actionLoading === `${course.id}_unhide_course`}
          onClick={() => setConfirmAction({ action: "unhide_course", course })}
        >
          {actionLoading === `${course.id}_unhide_course` ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Eye className="mr-1 h-4 w-4" />}
          Bỏ ẩn
        </Button>
      )}

      {course.can_delete && (
        <Button
          size="sm"
          variant="outline"
          className="rounded-lg text-destructive hover:text-destructive"
          disabled={actionLoading === `${course.id}_delete_course_if_safe`}
          onClick={() => setConfirmAction({ action: "delete_course_if_safe", course })}
        >
          {actionLoading === `${course.id}_delete_course_if_safe` ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
          Xóa
        </Button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Khóa học</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Duyệt, tạm ẩn và quản lý khóa học đang được đăng trên VET.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Tìm theo tên khóa học, mentor, danh mục..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", "pending", "approved", "rejected", "hidden"] as AdminCourseFilter[]).map((item) => (
              <Button
                key={item}
                size="sm"
                variant={filter === item ? "default" : "outline"}
                className={`rounded-xl ${filter === item ? "gradient-primary border-0 text-primary-foreground" : ""}`}
                onClick={() => setFilter(item)}
              >
                {filterLabels[item]} ({counts[item]})
              </Button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center rounded-2xl border border-destructive/20 bg-destructive/5 py-16 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
          <p className="font-semibold text-foreground">Không thể tải danh sách khóa học</p>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Vui lòng thử lại sau."}
          </p>
          <Button variant="outline" className="mt-4 rounded-xl" onClick={() => void refetch()}>
            Thử lại
          </Button>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border bg-card py-16 text-center shadow-card">
          <BookOpen className="mb-3 h-12 w-12 text-muted" />
          <p className="font-semibold text-foreground">Không có khóa học phù hợp</p>
          <p className="mt-1 text-sm text-muted-foreground">Thử đổi từ khóa tìm kiếm hoặc bộ lọc.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCourses.map((course) => (
            <button
              key={course.id}
              type="button"
              className="w-full rounded-2xl border bg-card p-4 text-left shadow-card transition-colors hover:bg-muted/30"
              onClick={() => void openDetail(course.id)}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="h-24 w-full overflow-hidden rounded-xl bg-muted lg:w-36">
                  {course.image_url ? (
                    <img src={course.image_url} alt={course.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <BookOpen className="h-8 w-8" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground">{course.title}</h2>
                    <CourseStatusBadge status={course.status} />
                    {course.is_hidden && <Badge className="border-0 bg-muted text-muted-foreground">Đã tạm ẩn</Badge>}
                    {isAutoHiddenCourse(course) && <Badge className="border-0 bg-orange-100 text-orange-700">Hệ thống tự động ẩn</Badge>}
                    {course.is_promoted && <Badge className="border-0 bg-primary/10 text-primary">Promoted</Badge>}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Mentor: {course.mentor?.name || "Không rõ"}</span>
                    <span>{getCourseCategoryLabel(course.category)}</span>
                    <span>{course.format === "online" ? "Online" : "Offline"}</span>
                    <span>Tạo: {formatShortDate(course.created_at)}</span>
                  </div>

                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {course.description || "Chưa có mô tả khóa học."}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <span className="font-bold text-primary">{formatVnd(course.price)}/buổi</span>
                    <span className="text-muted-foreground">{course.students_count} học viên</span>
                    <span className="text-muted-foreground">{course.rating.toFixed(1)} sao ({course.review_count})</span>
                    {!course.can_delete && (
                      <span className="text-muted-foreground">
                        Có dữ liệu liên quan: {course.counts.bookings + course.counts.reviews + course.counts.transactions + course.counts.reports}
                      </span>
                    )}
                  </div>
                </div>

                <div className="lg:min-w-[320px]">{renderActions(course)}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!selectedCourse} onOpenChange={(open) => !open && setSelectedCourse(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-2xl">
          {selectedCourse && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {selectedCourse.title}
                  <CourseStatusBadge status={selectedCourse.status} />
                  {selectedCourse.is_hidden && <Badge className="border-0 bg-muted text-muted-foreground">Đã tạm ẩn</Badge>}
                  {isAutoHiddenCourse(selectedCourse) && <Badge className="border-0 bg-orange-100 text-orange-700">Hệ thống tự động ẩn</Badge>}
                </DialogTitle>
              </DialogHeader>

              <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                <div className="space-y-4">
                  <div className="aspect-video overflow-hidden rounded-2xl bg-muted">
                    {selectedCourse.image_url ? (
                      <img src={selectedCourse.image_url} alt={selectedCourse.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <BookOpen className="h-10 w-10" />
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border bg-muted/30 p-4">
                    <p className="text-sm font-semibold text-foreground">Mentor</p>
                    <p className="mt-2 text-sm text-foreground">{selectedCourse.mentor?.name || "Không rõ"}</p>
                    <p className="text-xs text-muted-foreground">{selectedCourse.mentor?.email || "Chưa có email"}</p>
                    <p className="text-xs text-muted-foreground">{selectedCourse.mentor?.phone || "Chưa có số điện thoại"}</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Mô tả</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                      {selectedCourse.description || "Chưa có mô tả khóa học."}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoItem label="Danh mục" value={getCourseCategoryLabel(selectedCourse.category)} />
                    <InfoItem label="Hình thức" value={selectedCourse.format === "online" ? "Online" : "Offline"} />
                    <InfoItem label="Học phí" value={`${formatVnd(selectedCourse.price)}/buổi`} />
                    <InfoItem label="Ngày tạo" value={formatDate(selectedCourse.created_at)} />
                    <InfoItem label="Cập nhật" value={formatDate(selectedCourse.updated_at)} />
                    <InfoItem label="Promoted" value={selectedCourse.is_promoted ? "Có" : "Không"} />
                    {selectedCourse.format === "offline" && <InfoItem label="Địa điểm" value={selectedCourse.location || "Chưa có"} />}
                    {selectedCourse.format === "online" && <InfoItem label="Meeting link" value={selectedCourse.meeting_link || "Chưa có"} />}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <Metric icon={Users} label="Học viên" value={selectedCourse.students_count} />
                    <Metric icon={Star} label="Đánh giá" value={`${selectedCourse.rating.toFixed(1)} (${selectedCourse.review_count})`} />
                    <Metric icon={CalendarDays} label="Booking" value={selectedCourse.counts.bookings} />
                    <Metric icon={MessageSquare} label="Báo cáo" value={selectedCourse.counts.reports} />
                  </div>

                  {selectedCourse.rejection_reason && (
                    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                      <p className="text-sm font-semibold text-destructive">Lý do từ chối</p>
                      <p className="mt-1 text-sm text-muted-foreground">{selectedCourse.rejection_reason}</p>
                    </div>
                  )}

                  {selectedCourse.is_hidden && (
                    <div className="rounded-2xl border bg-muted/40 p-4">
                      <p className="text-sm font-semibold text-foreground">Thông tin tạm ẩn</p>
                      <p className="mt-1 text-sm text-muted-foreground">{selectedCourse.hidden_reason || "Không có ghi chú."}</p>
                      <p className="text-xs text-muted-foreground">Thời gian: {formatDate(selectedCourse.hidden_at)}</p>
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-sm font-semibold text-foreground">Lịch học cố định</p>
                    {selectedCourse.course_schedules?.length ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {selectedCourse.course_schedules.map((slot) => (
                          <div key={slot.id} className="rounded-xl border bg-muted/30 px-3 py-2 text-sm">
                            <span className="font-medium">{slot.day_of_week}</span>
                            <span className="text-muted-foreground"> · {formatTime(slot.start_time)} - {formatTime(slot.end_time)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl border border-dashed py-6 text-center text-sm text-muted-foreground">
                        Chưa có lịch cố định
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 border-t pt-4">
                    {renderActions(selectedCourse, true)}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectCourse} onOpenChange={(open) => !open && setRejectCourse(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Từ chối khóa học</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">Lý do từ chối</Label>
            <Textarea
              id="rejection-reason"
              value={rejectReason}
              onChange={(event) => {
                setRejectReason(event.target.value);
                setRejectError("");
              }}
              placeholder="Nhập lý do để mentor có thể điều chỉnh khóa học..."
              className="min-h-28"
            />
            {rejectError && <p className="text-sm text-destructive">{rejectError}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setRejectCourse(null)}>Hủy</Button>
            <Button
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!actionLoading}
              onClick={() => void submitReject()}
            >
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Xác nhận từ chối
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.action === "approve_course"
                ? "Duyệt khóa học?"
                : confirmAction?.action === "hide_course"
                  ? "Tạm ẩn khóa học?"
                  : confirmAction?.action === "unhide_course"
                    ? "Bỏ ẩn khóa học?"
                    : "Xóa khóa học?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === "approve_course"
                ? "Bạn có chắc muốn duyệt khóa học này không?"
                : confirmAction?.action === "hide_course"
                  ? "Khóa học sẽ không còn hiển thị trên marketplace công khai."
                  : confirmAction?.action === "unhide_course"
                    ? "Khóa học sẽ hiển thị lại nếu đang ở trạng thái đã duyệt."
                    : "Hành động này không thể hoàn tác. Bạn có chắc muốn xóa khóa học này không?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Hủy</AlertDialogCancel>
            <AlertDialogAction
              className={`rounded-xl ${confirmAction?.action === "approve_course" || confirmAction?.action === "unhide_course" ? "gradient-primary border-0 text-primary-foreground" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}`}
              disabled={!!actionLoading}
              onClick={(event) => {
                event.preventDefault();
                if (confirmAction) void runAction(confirmAction.action, confirmAction.course);
              }}
            >
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <Icon className="mb-2 h-4 w-4 text-primary" />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}
