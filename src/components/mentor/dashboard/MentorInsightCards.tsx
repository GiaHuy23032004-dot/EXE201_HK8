import { CheckCircle2, Info, Lightbulb, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { MentorDashboardInsight } from "@/hooks/useMentorDashboardAnalytics";
import { cn } from "@/lib/utils";

const toneConfig = {
  info: {
    icon: Info,
    accent: "border-l-sky-500",
    iconClassName: "bg-sky-50 text-sky-700",
  },
  warning: {
    icon: TriangleAlert,
    accent: "border-l-amber-500",
    iconClassName: "bg-amber-50 text-amber-700",
  },
  success: {
    icon: CheckCircle2,
    accent: "border-l-emerald-500",
    iconClassName: "bg-emerald-50 text-emerald-700",
  },
} as const;

function getActionHint(insight: MentorDashboardInsight) {
  const text = `${insight.id} ${insight.title} ${insight.description}`.toLowerCase();
  if (text.includes("pending") || text.includes("chờ")) return "Bước tiếp theo: vào lịch dạy và xác nhận hoặc từ chối booking sớm.";
  if (text.includes("save") || text.includes("lưu")) return "Bước tiếp theo: làm rõ lịch học, học phí và nút đặt lịch trên trang khóa học.";
  if (text.includes("view") || text.includes("xem")) return "Bước tiếp theo: kiểm tra ảnh, mô tả đầu ra và câu hỏi thường gặp của khóa học.";
  if (text.includes("cancel") || text.includes("hủy")) return "Bước tiếp theo: rà soát lịch trống, điều kiện học và cách nhắc lịch cho học viên.";
  if (text.includes("revenue") || text.includes("doanh thu")) return "Bước tiếp theo: phân tích khóa đang tạo doanh thu tốt để nhân rộng lịch hoặc nội dung.";
  return "Bước tiếp theo: theo dõi thêm trong vài ngày tới rồi tối ưu khóa có tín hiệu rõ nhất.";
}

interface MentorInsightCardsProps {
  insights?: MentorDashboardInsight[];
  isLoading?: boolean;
}

export function MentorInsightCards({ insights = [], isLoading }: MentorInsightCardsProps) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Gợi ý cải thiện hiệu quả</CardTitle>
            <CardDescription>Dựa trên lượt xem, lượt lưu, booking, doanh thu và đánh giá của khóa học.</CardDescription>
          </div>
          <Lightbulb className="h-5 w-5 shrink-0 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : insights.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 p-8 text-center">
            <p className="font-semibold text-foreground">Chưa có đủ dữ liệu để đưa ra gợi ý.</p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Khi khóa học có lượt xem, booking hoặc doanh thu, hệ thống sẽ tự động hiển thị gợi ý phù hợp.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {insights.map((insight) => {
              const config = toneConfig[insight.tone];
              const Icon = config.icon;
              return (
                <div key={insight.id} className={cn("rounded-2xl border border-l-4 bg-background p-4 shadow-sm", config.accent)}>
                  <div className="flex items-start gap-3">
                    <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", config.iconClassName)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{insight.title}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{insight.description}</p>
                      <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium leading-5 text-foreground">
                        {getActionHint(insight)}
                      </p>
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
