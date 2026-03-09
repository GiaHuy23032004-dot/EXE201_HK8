import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield } from "lucide-react";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading, session } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    if (!isLoggedIn || !session) {
      navigate("/admin/login", { replace: true });
      return;
    }

    const checkAdmin = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("admin-check", {
          body: { action: "check" },
        });
        if (!error && data?.isAdmin) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          navigate("/admin/login", { replace: true });
        }
      } catch {
        setIsAdmin(false);
        navigate("/admin/login", { replace: true });
      }
    };

    checkAdmin();
  }, [isLoggedIn, isLoading, session, navigate]);

  if (isLoading || isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary text-primary-foreground">
            <Shield className="h-7 w-7" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Đang xác thực quyền Admin...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return <>{children}</>;
}
