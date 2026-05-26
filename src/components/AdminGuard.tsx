import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, supabaseUrl } from "@/integrations/supabase/client";
import { Loader2, Shield } from "lucide-react";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, session } = useAuth();
  const accessToken = session?.access_token;
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    let cancelled = false;
    const verifyAdmin = async () => {
      setIsAdmin(null);
      const token =
        accessToken ??
        (await supabase.auth.getSession()).data.session?.access_token;

      if (!token) {
        if (!cancelled) {
          setIsAdmin(false);
          navigate("/admin/login", { replace: true });
        }
        return;
      }

      try {
        if (import.meta.env.DEV) {
          console.log("Supabase URL", supabaseUrl);
        }

        const { data, error } = await supabase.functions.invoke("admin-check", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (import.meta.env.DEV) {
          console.log("admin-check response", { data, error });
          console.log("admin-check response payload", data);
          if (error) console.error("admin-check error object", error);
        }

        if (cancelled) return;
        if (!error && data?.isAdmin === true) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          navigate("/admin/login", { replace: true });
        }
      } catch (checkError) {
        if (import.meta.env.DEV) {
          console.error("admin-check error object", checkError);
        }

        if (cancelled) return;
        setIsAdmin(false);
        navigate("/admin/login", { replace: true });
      }
    };

    verifyAdmin();

    return () => { cancelled = true; };
    // Re-check whenever the access token changes so admin access follows the current session.
  }, [accessToken, isLoading, navigate]);

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
