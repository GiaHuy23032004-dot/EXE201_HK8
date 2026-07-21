import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import {
  AlertCircle,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Search,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { COURSE_CATEGORIES, getCourseCategoryLabel, getCourseCategoryShortLabel, normalizeCourseCategory } from "@/constants/courseCategories";
import { type AdminCourse, type AdminCourseAction, useAdminCourseActions, useAdminCourseDetail, useAdminCourses } from "@/hooks/useAdminCourses";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type AdminCourseFilter = "all" | "pending" | "approved" | "rejected" | "hidden" | "reported";
type ConfirmAction = { action: Extract<AdminCourseAction, "approve_course" | "unhide_course" | "delete_course_if_safe">; course: AdminCourse };
type ReasonDialogState = { action: Extract<AdminCourseAction, "reject_course" | "hide_course">; course: AdminCourse };

const PAGE_SIZE = 10;
const ALL_CATEGORIES = "all";

const filterLabels: Record<AdminCourseFilter, string> = {
  all: "Tất cả",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  hidden: "Đã ẩn",
  reported: "Có báo cáo",
};

const safeText = "min-w-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word]";
const formatVnd = (value: number) => value.toLocaleString("vi-VN") + "đ";
const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString("vi-VN") : "Chưa có");
const formatShortDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa có");
const formatTime = (value?: string | null) => (value ? value.slice(0, 5) : "");
const getInitials = (name?: string | null) => (name || "VT").slice(0, 2).toUpperCase();
const isAutoHiddenCourse = (course: AdminCourse) => {
  const reason = course.hidden_reason?.toLowerCase() ?? "";
  return course.is_hidden && (reason.includes("auto-hidden") || reason.includes("high report") || reason.includes("tự động"));
};

function CourseStatusBadge({ status }: { status: AdminCourse["status"] }) {
  if (status === "approved") {
    return <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">Đã duyệt</Badge>;
  }
  if (status === "rejected") {
    return <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 text-rose-700">Từ chối</Badge>;
  }
  return <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-700">Chờ duyệt</Badge>;
}

function FormatBadge({ format }: { format: AdminCourse["format"] }) {
  return (
    <Badge variant="outline" className={cn("rounded-full", format === "online" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-violet-200 bg-violet-50 text-violet-700")}>
      {format === "online" ? "Online" : "Offline"}
    </Badge>
  );
}

export default function AdminCourses() {
  const { toast } = useToast();
  const coursesQuery = useAdminCourses();
  const { updateCourse, refreshCourses } = useAdminCourseActions();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AdminCourseFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [reasonDialog, setReasonDialog] = useState<ReasonDialogState | null>(null);
  const [reasonValue, setReasonValue] = useState("");
  const [reasonError, setReasonError] = useState("");

  const detailQuery = useAdminCourseDetail(selectedCourseId, Boolean(selectedCourseId));
  const courses = coursesQuery.data ?? [];
  const selectedCourse = detailQuery.data ?? null;

  const counts = useMemo(() => ({
    pending: courses.filter((course) => course.status === "pending").length,
    approved: courses.filter((course) => course.status === "approved").length,
    rejected: courses.filter((course) => course.status === "rejected").length,
    hidden: courses.filter((course) => course.is_hidden).length,
    autoHidden: courses.filter(isAutoHiddenCourse).length,
    reported: courses.filter((course) => (course.counts?.reports ?? 0) > 0).length,
  }), [courses]);

  const metricCards: Array<{ label: string; value: number; filter?: AdminCourseFilter }> = [
    { label: "Chờ duyệt", value: counts.pending, filter: "pending" },
    { label: "Đã duyệt", value: counts.approved, filter: "approved" },
    { label: "Từ chối", value: counts.rejected, filter: "rejected" },
    { label: "Đã ẩn", value: counts.hidden, filter: "hidden" },
    { label: "Tự động ẩn", value: counts.autoHidden, filter: "hidden" },
    { label: "Có báo cáo", value: counts.reported, filter: "reported" },
  ];

  const filteredCourses = useMemo(() => {
    const term = search.trim().toLowerCase();

    return courses.filter((course) => {
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "hidden"
            ? course.is_hidden
            : filter === "reported"
              ? (course.counts?.reports ?? 0) > 0
              : course.status === filter;

      const matchesCategory = categoryFilter === ALL_CATEGORIES || normalizeCourseCategory(course.category) === categoryFilter;
      const matchesSearch =
        !term ||
        [
          course.title,
          course.description,
          course.category,
          getCourseCategoryLabel(course.category),
          course.mentor?.name,
          course.mentor?.email,
          course.location,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));

      return matchesFilter && matchesCategory && matchesSearch;
    });
  }, [categoryFilter, courses, filter, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedCourses = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredCourses.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredCourses]);

  const pageStart = filteredCourses.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filteredCourses.length);
  const pageNumbers = useMemo(() => {
    const maxVisiblePages = 5;
    const start = Math.max(1, Math.min(currentPage - 2, Math.max(1, totalPages - maxVisiblePages + 1)));
    const length = Math.min(maxVisiblePages, totalPages);
    return Array.from({ length }, (_, index) => start + index);
  }, [currentPage, totalPages]);

  const stop = (event: MouseEvent) => event.stopPropagation();

  const openDetail = (courseId: string) => {
    setSelectedCourseId(courseId);
  };

  const runAction = async (action: AdminCourseAction, course: AdminCourse, reason?: string) => {
    setActionLoading(`${course.id}_${action}`);
    try {
      const data = await updateCourse({ action, courseId: course.id, reason });
      await refreshCourses();
      if (selectedCourseId) await detailQuery.refetch();
      if (action === "delete_course_if_safe") setSelectedCourseId(null);

      toast({
        title:
          action === "approve_course"
            ? "Đã duyệt khóa học"
            : action === "reject_course"
              ? "Đã từ chối khóa học"
              : action === "hide_course"
                ? "Đã tạm ẩn khóa học"
                : action === "unhide_course"
                  ? "Đã bỏ ẩn khóa học"
                  : "Đã xóa khóa học",
      });

      if (data.course && selectedCourseId === course.id) {
        await detailQuery.refetch();
      }
      setConfirmAction(null);
      setReasonDialog(null);
      setReasonValue("");
      setReasonError("");
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

  const openReasonDialog = (action: ReasonDialogState["action"], course: AdminCourse) => {
    setReasonDialog({ action, course });
    setReasonValue(action === "reject_course" ? course.rejection_reason ?? "" : course.hidden_reason ?? "");
    setReasonError("");
  };

  const submitReasonDialog = async () => {
    if (!reasonDialog) return;
    if (!reasonValue.trim()) {
      setReasonError(reasonDialog.action === "reject_course" ? "Vui lòng nhập lý do từ chối." : "Vui lòng nhập lý do tạm ẩn.");
      return;
    }
    await runAction(reasonDialog.action, reasonDialog.course, reasonValue.trim());
  };

  const renderActions = (course: AdminCourse, compact = false) => (
    <div className={cn("flex flex-wrap gap-2", compact ? "" : "justify-end")} onClick={stop}>
      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openDetail(course.id)}>
        <Eye className="mr-1 h-4 w-4" />
        Xem chi tiết
      </Button>

      {(course.status === "pending" || course.status === "rejected") && (
        <Button
          size="sm"
          className="gradient-primary rounded-xl border-0 text-primary-foreground"
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
          className="rounded-xl text-destructive hover:text-destructive"
          disabled={actionLoading === `${course.id}_reject_course`}
          onClick={() => openReasonDialog("reject_course", course)}
        >
          {actionLoading === `${course.id}_reject_course` ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <X className="mr-1 h-4 w-4" />}
          {course.status === "approved" ? "Gỡ duyệt" : "Từ chối"}
        </Button>
      )}

      {course.status === "approved" && !course.is_hidden && (
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl"
          disabled={actionLoading === `${course.id}_hide_course`}
          onClick={() => openReasonDialog("hide_course", course)}
        >
          {actionLoading === `${course.id}_hide_course` ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <EyeOff className="mr-1 h-4 w-4" />}
          Tạm ẩn
        </Button>
      )}

      {course.is_hidden && (
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl"
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
          className="rounded-xl text-destructive hover:text-destructive"
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
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Khóa học</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Kiểm duyệt nội dung, trạng thái hiển thị và rủi ro báo cáo của khóa học.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metricCards.map((card) => (
          <button
            key={card.label}
            type="button"
            className={cn(
              "rounded-2xl border bg-card px-4 py-3 text-left shadow-sm transition hover:border-primary/30 hover:bg-primary/5",
              card.filter && filter === card.filter ? "border-primary/40 bg-primary/10 shadow-primary/10" : "",
            )}
            onClick={() => card.filter && setFilter(card.filter)}
          >
            <p className="truncate text-xs font-medium text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-2xl font-bold leading-none text-foreground">{card.value}</p>
          </button>
        ))}
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-3.5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 rounded-xl pl-10"
                placeholder="Tìm khóa học, mentor, danh mục, địa điểm..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-9 w-full rounded-xl lg:w-52">
                  <SelectValue placeholder="Tất cả danh mục" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_CATEGORIES}>Tất cả danh mục</SelectItem>
                  {COURSE_CATEGORIES.map((category) => (
                    <SelectItem key={category.slug} value={category.slug}>{category.shortLabel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(filterLabels) as AdminCourseFilter[]).map((item) => (
                  <Button
                    key={item}
                    size="sm"
                    variant={filter === item ? "default" : "outline"}
                    className={cn("h-8 rounded-full px-3 text-xs", filter === item ? "border-primary bg-primary/10 text-primary hover:bg-primary/15" : "bg-background")}
                    onClick={() => setFilter(item)}
                  >
                    {filterLabels[item]}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {coursesQuery.isLoading ? (
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="space-y-3">
            {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-16 rounded-xl" />)}
          </div>
        </div>
      ) : coursesQuery.isError ? (
        <div className="flex flex-col items-center rounded-2xl border border-destructive/20 bg-destructive/5 py-16 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
          <p className="font-semibold text-foreground">Không thể tải danh sách khóa học</p>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {coursesQuery.error instanceof Error ? coursesQuery.error.message : "Vui lòng thử lại sau."}
          </p>
          <Button variant="outline" className="mt-4 rounded-xl" onClick={() => void coursesQuery.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border bg-card py-16 text-center shadow-sm">
          <BookOpen className="mb-3 h-12 w-12 text-muted-foreground" />
          <p className="font-semibold text-foreground">Không có khóa học phù hợp</p>
          <p className="mt-1 text-sm text-muted-foreground">Thử đổi từ khóa, trạng thái hoặc danh mục.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="min-w-[320px]">Khóa học</TableHead>
                  <TableHead className="min-w-[180px]">Mentor</TableHead>
                  <TableHead>Category / Format</TableHead>
                  <TableHead>Giá</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Rủi ro</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCourses.map((course) => (
                  <TableRow key={course.id} className="cursor-pointer transition-colors hover:bg-primary/5" onClick={() => openDetail(course.id)}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                          {course.image_url ? (
                            <img src={course.image_url} alt={course.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <ImageIcon className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className={`line-clamp-2 font-semibold text-foreground ${safeText}`}>{course.title}</p>
                          <p className={`mt-1 line-clamp-1 text-xs text-muted-foreground ${safeText}`}>
                            {course.description || "Chưa có mô tả khóa học."}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className={`font-medium text-foreground ${safeText}`}>{course.mentor?.name || "Không rõ"}</p>
                      <p className={`text-xs text-muted-foreground ${safeText}`}>{course.mentor?.email || "Chưa có email"}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <Badge variant="outline" className="w-fit rounded-full bg-muted/40">{getCourseCategoryShortLabel(course.category)}</Badge>
                        <FormatBadge format={course.format} />
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-primary">{formatVnd(course.price)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <CourseStatusBadge status={course.status} />
                        {course.is_hidden && <Badge variant="outline" className="w-fit rounded-full bg-muted text-muted-foreground">Đã ẩn</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <Badge variant="outline" className={cn("w-fit rounded-full", (course.counts?.reports ?? 0) > 0 ? "border-orange-200 bg-orange-50 text-orange-700" : "")}>
                          {course.counts?.reports ?? 0} report
                        </Badge>
                        {isAutoHiddenCourse(course) && <Badge className="w-fit rounded-full border-0 bg-orange-100 text-orange-700">Hệ thống tự động ẩn</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatShortDate(course.created_at)}</TableCell>
                    <TableCell>
                      {renderActions(course)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-3 border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>Hiển thị {pageStart}–{pageEnd} / {filteredCourses.length} khóa học</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 rounded-xl" disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>
                Trước
              </Button>
              {pageNumbers.map((page) => (
                <Button
                  key={page}
                  size="sm"
                  variant={page === currentPage ? "default" : "outline"}
                  className={cn("h-8 min-w-8 rounded-xl px-2", page === currentPage ? "bg-primary/10 text-primary hover:bg-primary/15" : "")}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              ))}
              <Button size="sm" variant="outline" className="h-8 rounded-xl" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>
                Sau
              </Button>
            </div>
          </div>
        </div>
      )}

      <Sheet open={!!selectedCourseId} onOpenChange={(open) => !open && setSelectedCourseId(null)}>
        <SheetContent side="right" className="w-[96vw] overflow-y-auto sm:max-w-5xl">
          <SheetHeader>
            <SheetTitle>Chi tiết khóa học</SheetTitle>
            <SheetDescription>Kiểm tra nội dung, lịch học, mentor, báo cáo và lịch sử kiểm duyệt.</SheetDescription>
          </SheetHeader>

          {detailQuery.isLoading ? (
            <div className="mt-6 space-y-4">
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          ) : detailQuery.isError ? (
            <div className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
              <AlertCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
              <p className="font-semibold">Không thể tải chi tiết khóa học</p>
              <Button variant="outline" className="mt-4 rounded-xl" onClick={() => void detailQuery.refetch()}>Thử lại</Button>
            </div>
          ) : selectedCourse ? (
            <CourseDetailDrawer course={selectedCourse} renderActions={renderActions} />
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={!!reasonDialog} onOpenChange={(open) => {
        if (!open) {
          setReasonDialog(null);
          setReasonValue("");
          setReasonError("");
        }
      }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{reasonDialog?.action === "reject_course" ? "Từ chối khóa học" : "Tạm ẩn khóa học"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="moderation-reason">{reasonDialog?.action === "reject_course" ? "Lý do từ chối" : "Lý do tạm ẩn"}</Label>
            <Textarea
              id="moderation-reason"
              value={reasonValue}
              onChange={(event) => {
                setReasonValue(event.target.value);
                setReasonError("");
              }}
              placeholder={reasonDialog?.action === "reject_course" ? "Nhập lý do để mentor điều chỉnh khóa học..." : "Nhập lý do tạm ẩn để Admin và mentor theo dõi..."}
              className="min-h-28 rounded-xl"
            />
            {reasonError && <p className="text-sm text-destructive">{reasonError}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setReasonDialog(null)}>Hủy</Button>
            <Button
              className={cn("rounded-xl", reasonDialog?.action === "reject_course" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "gradient-primary border-0 text-primary-foreground")}
              disabled={!!actionLoading}
              onClick={() => void submitReasonDialog()}
            >
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Xác nhận
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
                : confirmAction?.action === "unhide_course"
                  ? "Bỏ ẩn khóa học?"
                  : "Xóa khóa học?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === "approve_course"
                ? "Bạn có chắc muốn duyệt khóa học này không?"
                : confirmAction?.action === "unhide_course"
                  ? "Khóa học sẽ hiển thị lại nếu đang ở trạng thái đã duyệt."
                  : "Hành động này không thể hoàn tác. Bạn có chắc muốn xóa khóa học này không?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Hủy</AlertDialogCancel>
            <AlertDialogAction
              className={cn("rounded-xl", confirmAction?.action === "delete_course_if_safe" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "gradient-primary border-0 text-primary-foreground")}
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

function CourseDetailDrawer({ course, renderActions }: { course: AdminCourse; renderActions: (course: AdminCourse, compact?: boolean) => JSX.Element }) {
  return (
    <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div className="aspect-video overflow-hidden rounded-2xl bg-muted">
              {course.image_url ? (
                <img src={course.image_url} alt={course.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <BookOpen className="h-10 w-10" />
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CourseStatusBadge status={course.status} />
              {course.is_hidden && <Badge variant="outline" className="rounded-full bg-muted text-muted-foreground">Đã ẩn</Badge>}
              {isAutoHiddenCourse(course) && <Badge className="rounded-full border-0 bg-orange-100 text-orange-700">Hệ thống tự động ẩn</Badge>}
              {course.is_promoted && <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 text-primary">Promoted</Badge>}
            </div>
            <div>
              <h2 className={`text-xl font-bold text-foreground ${safeText}`}>{course.title}</h2>
              <p className={`mt-2 whitespace-pre-line text-sm text-muted-foreground ${safeText}`}>
                {course.description || "Chưa có mô tả khóa học."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoItem label="Danh mục" value={getCourseCategoryLabel(course.category)} />
              <InfoItem label="Hình thức" value={course.format === "online" ? "Online" : "Offline"} />
              <InfoItem label="Học phí" value={`${formatVnd(course.price)}/buổi`} />
              <InfoItem label="Ngày tạo" value={formatDate(course.created_at)} />
              <InfoItem label="Cập nhật" value={formatDate(course.updated_at)} />
              <InfoItem label="Reviewed at" value={formatDate(course.reviewed_at)} />
              {course.format === "offline" && <InfoItem label="Địa điểm" value={course.location || "Chưa có"} />}
              {course.format === "online" && <InfoItem label="Meeting link" value={course.meeting_link || "Chưa có"} />}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground">Lịch học</h3>
            {course.course_schedules?.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {course.course_schedules.map((slot) => (
                  <div key={slot.id} className="rounded-xl border bg-muted/30 px-3 py-2 text-sm">
                    <span className="font-medium">{slot.day_of_week}</span>
                    <span className="text-muted-foreground"> · {formatTime(slot.start_time)} - {formatTime(slot.end_time)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed py-6 text-center text-sm text-muted-foreground">Chưa có lịch cố định</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardContent className="space-y-3 p-5">
            <h3 className="font-semibold text-foreground">Related reports</h3>
            {(course.related_reports ?? []).length === 0 ? (
              <p className="rounded-xl border border-dashed py-6 text-center text-sm text-muted-foreground">Chưa có báo cáo liên quan.</p>
            ) : (
              <div className="space-y-2">
                {(course.related_reports ?? []).map((report) => (
                  <div key={report.id} className="rounded-xl border bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className={`font-medium text-foreground ${safeText}`}>{report.title || report.reason || "Báo cáo"}</p>
                      <Badge variant="outline" className="rounded-full">{report.status || "pending"}</Badge>
                    </div>
                    {report.reason && <p className={`mt-1 text-sm text-muted-foreground ${safeText}`}>{report.reason}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(report.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <aside className="min-w-0 space-y-5 xl:sticky xl:top-4 xl:self-start">
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground">Mentor</h3>
            <div className="mt-3 flex items-center gap-3">
              <Avatar className="h-12 w-12 rounded-xl">
                <AvatarImage src={course.mentor?.avatar_url || undefined} />
                <AvatarFallback className="rounded-xl">{getInitials(course.mentor?.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className={`font-semibold text-foreground ${safeText}`}>{course.mentor?.name || "Không rõ"}</p>
                <p className={`text-xs text-muted-foreground ${safeText}`}>{course.mentor?.email || "Chưa có email"}</p>
                <p className={`text-xs text-muted-foreground ${safeText}`}>{course.mentor?.phone || "Chưa có số điện thoại"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardContent className="space-y-3 p-5">
            <h3 className="font-semibold text-foreground">Performance context</h3>
            <div className="grid grid-cols-2 gap-3">
              <Metric icon={CalendarDays} label="Booking" value={course.counts.bookings} />
              <Metric icon={BadgeCheck} label="Hoàn thành" value={course.completed_bookings_count ?? course.counts.completed_bookings ?? 0} />
              <Metric icon={Star} label="Rating" value={`${Number(course.rating || 0).toFixed(1)} (${course.review_count})`} />
              <Metric icon={MessageSquare} label="Report" value={course.counts.reports} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardContent className="space-y-3 p-5">
            <h3 className="font-semibold text-foreground">Moderation history</h3>
            <InfoItem label="Reviewed at" value={formatDate(course.reviewed_at)} />
            <InfoItem label="Lý do từ chối" value={course.rejection_reason || "Chưa có"} />
            <InfoItem label="Admin note" value={course.admin_note || "Chưa có"} />
            <InfoItem label="Lý do ẩn" value={course.hidden_reason || "Chưa có"} />
            <InfoItem label="Thời gian ẩn" value={formatDate(course.hidden_at)} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardContent className="space-y-2 p-5">
            <h3 className="font-semibold text-foreground">Hành động</h3>
            {renderActions(course, true)}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-medium text-foreground ${safeText}`}>{value}</p>
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
