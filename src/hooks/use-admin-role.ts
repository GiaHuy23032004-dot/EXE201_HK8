import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useAdminRole() {
  const { isLoggedIn, session } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn || !session) {
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
  }, [isLoggedIn, session]);

  return { isAdmin, isLoading };
}
