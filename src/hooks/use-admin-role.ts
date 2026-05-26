import { useState, useEffect } from "react";
import { supabase, supabaseUrl } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useAdminRole() {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    if (import.meta.env.DEV) {
      console.log("Supabase URL", supabaseUrl);
    }

    supabase.functions
      .invoke("admin-check", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then(({ data, error }) => {
        if (import.meta.env.DEV) {
          console.log("admin-check response", { data, error });
          console.log("admin-check response payload", data);
          if (error) console.error("admin-check error object", error);
        }

        if (!cancelled) {
          setIsAdmin(!error && data?.isAdmin === true);
          setIsLoading(false);
        }
      })
      .catch((error) => {
        if (import.meta.env.DEV) {
          console.error("admin-check error object", error);
        }

        if (!cancelled) {
          setIsAdmin(false);
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [accessToken]);

  return { isAdmin, isLoading };
}
