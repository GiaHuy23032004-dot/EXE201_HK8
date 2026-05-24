import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Mic2 } from "lucide-react";

export function MentorGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, session, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      navigate("/auth?role=mentor", { replace: true });
      return;
    }
    if (user && user.role !== "mentor" && user.role !== "admin") {
      navigate("/", { replace: true });
    }
  }, [isLoading, session, user, navigate]);

  if (isLoading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary text-primary-foreground">
            <Mic2 className="h-7 w-7" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Đang xác thực...</p>
        </div>
      </div>
    );
  }

  if (user && user.role !== "mentor" && user.role !== "admin") return null;

  return <>{children}</>;
}
