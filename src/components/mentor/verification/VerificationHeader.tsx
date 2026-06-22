import { ShieldCheck } from "lucide-react";

export function VerificationHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Xác minh mentor</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bổ sung hồ sơ và tài liệu chuyên môn để tăng độ tin cậy với học viên.
          </p>
        </div>
      </div>
    </div>
  );
}
