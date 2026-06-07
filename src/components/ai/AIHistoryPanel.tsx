import { useState } from "react";
import { Link } from "react-router-dom";
import { Brain, Clock, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AI_FEATURE_LABELS } from "@/constants/aiCredits";
import { useAiHistory, type AiHistoryFilter } from "@/hooks/useAiHistory";

const filters: Array<{ value: AiHistoryFilter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "course_match", label: "Course Match" },
  { value: "advisor", label: "Advisor" },
  { value: "compare", label: "Compare" },
  { value: "roadmap", label: "Roadmap" },
  { value: "chat_search", label: "Chat/Search" },
];

const statusMeta: Record<string, { label: string; className: string }> = {
  reserved: { label: "Đang xử lý", className: "border-blue-200 bg-blue-50 text-blue-700" },
  pending: { label: "Đang xử lý", className: "border-blue-200 bg-blue-50 text-blue-700" },
  success: { label: "Thành công", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  failed: { label: "Thất bại", className: "border-red-200 bg-red-50 text-red-700" },
  refunded: { label: "Đã hoàn credit", className: "border-amber-200 bg-amber-50 text-amber-700" },
};

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function featureLabel(feature: string) {
  return AI_FEATURE_LABELS[feature as keyof typeof AI_FEATURE_LABELS] ?? feature;
}

function getRelatedCourseIds(metadata: Record<string, any>) {
  const ids = new Set<string>();
  const single = metadata.course_id;
  if (typeof single === "string") ids.add(single);
  for (const key of ["course_ids", "related_course_ids"]) {
    if (Array.isArray(metadata[key])) {
      metadata[key].forEach((id: unknown) => {
        if (typeof id === "string") ids.add(id);
      });
    }
  }
  return Array.from(ids).slice(0, 5);
}

export function AIHistoryPanel() {
  const [filter, setFilter] = useState<AiHistoryFilter>("all");
  const { data: history = [], isLoading, error, refetch } = useAiHistory(filter);

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-primary" />
              AI History
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Xem lại các lần bạn dùng AI và số credit đã sử dụng.
            </p>
          </div>
          <Button variant="outline" size="sm" className="w-fit rounded-xl" onClick={() => refetch()}>
            Tải lại
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={filter === item.value ? "default" : "outline"}
              className={`rounded-full ${filter === item.value ? "border-0 gradient-primary text-primary-foreground" : ""}`}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center rounded-2xl border border-dashed py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
            Đang tải lịch sử AI...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Không thể tải AI History. Vui lòng thử lại.
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-12 text-center">
            <Sparkles className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-semibold text-foreground">Chưa có lịch sử AI</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Các lần dùng AI Course Match, Advisor, Compare, Roadmap hoặc EduBot sẽ xuất hiện ở đây.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => {
              const status = statusMeta[item.status] ?? { label: item.status, className: "border-border bg-muted text-muted-foreground" };
              const summary =
                item.metadata?.result_summary ||
                item.metadata?.summary ||
                item.metadata?.fallback_reason ||
                item.prompt_preview;
              const relatedCourseIds = getRelatedCourseIds(item.metadata);

              return (
                <div key={item.id} className="rounded-2xl border bg-background p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-full bg-primary/5 text-primary">
                          {featureLabel(item.feature)}
                        </Badge>
                        <Badge variant="outline" className={`rounded-full ${status.className}`}>
                          {status.label}
                        </Badge>
                        <Badge variant="outline" className="rounded-full">
                          {item.credits_used} credit
                        </Badge>
                      </div>
                      {summary && (
                        <p className="break-words text-sm leading-relaxed text-foreground">
                          {String(summary).slice(0, 220)}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(item.created_at)}
                        </span>
                        {item.metadata?.provider && <span>Provider: {item.metadata.provider}</span>}
                        {item.metadata?.model && <span>Model: {item.metadata.model}</span>}
                      </div>
                      {relatedCourseIds.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {relatedCourseIds.map((courseId) => (
                            <Link key={courseId} to={`/course/${courseId}`}>
                              <Badge variant="outline" className="rounded-full hover:bg-primary/5 hover:text-primary">
                                Course {courseId.slice(0, 8)}
                              </Badge>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
