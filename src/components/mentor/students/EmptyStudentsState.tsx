import { Link } from "react-router-dom";
import { BookOpen, SearchX, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStudentsStateProps {
  filtered?: boolean;
}

export function EmptyStudentsState({ filtered }: EmptyStudentsStateProps) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-border bg-card px-6 py-16 text-center">
      {filtered ? (
        <SearchX className="mb-4 h-11 w-11 text-muted-foreground" />
      ) : (
        <UsersRound className="mb-4 h-11 w-11 text-muted-foreground" />
      )}
      <p className="text-base font-semibold text-foreground">
        {filtered ? "Không tìm thấy học viên phù hợp" : "Chưa có học viên nào"}
      </p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {filtered
          ? "Thử đổi từ khóa tìm kiếm hoặc bộ lọc."
          : "Học viên sẽ xuất hiện ở đây sau khi họ đặt lịch học với khóa học của bạn."}
      </p>
      {!filtered && (
        <Link to="/mentor/courses">
          <Button className="mt-5 rounded-xl border-0 text-primary-foreground gradient-primary">
            <BookOpen className="mr-2 h-4 w-4" />
            Xem khóa học của tôi
          </Button>
        </Link>
      )}
    </div>
  );
}
