import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useAdminRole() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    supabase.functions
      .invoke("admin-check", { body: { action: "check" } })
      .then(({ data, error }) => {
        if (!cancelled) {
          setIsAdmin(!error && data?.isAdmin === true);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsAdmin(false);
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
    // Depend on stable userId — not the session object, which changes on every token refresh.
  }, [userId]);

  return { isAdmin, isLoading };
}
