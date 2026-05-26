import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export interface UserProfile {
  name: string;
  email: string;
  username?: string;
  avatar?: string;
  role: "learner" | "mentor";
  phone?: string;
  bio?: string;
  isBlocked?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  session: Session | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  /** Login by username OR email + password */
  login: (identifier: string, password: string) => Promise<{ error?: string; role?: "learner" | "mentor" }>;
  register: (params: {
    name: string;
    email: string;
    password: string;
    role: "learner" | "mentor";
  }) => Promise<{ error?: string; needsEmailConfirmation?: boolean }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (authUser: User) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", authUser.id)
      .single();

    if (data) {
      const productRole = data.role === "mentor" ? "mentor" : "learner";

      setUser({
        name: data.name || authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "User",
        email: data.email || authUser.email || "",
        username: (data as any).username || undefined,
        avatar: data.avatar_url || authUser.user_metadata?.avatar_url,
        role: productRole,
        phone: data.phone || undefined,
        bio: data.bio || undefined,
        isBlocked: data.is_blocked ?? false,
      });
    } else {
      setUser({
        name: authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "User",
        email: authUser.email || "",
        role: "learner",
      });
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        if (newSession?.user) {
          setTimeout(() => fetchProfile(newSession.user), 0);
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      if (existingSession?.user) {
        fetchProfile(existingSession.user);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (identifier: string, password: string): Promise<{ error?: string; role?: "learner" | "mentor" }> => {
    const email = identifier.trim().toLowerCase();
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    const userId = authData.user?.id;
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_blocked, role")
        .eq("user_id", userId)
        .single();

      if (profile?.is_blocked) {
        await supabase.auth.signOut();
        return { error: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên." };
      }

      const role: "learner" | "mentor" = profile?.role === "mentor" ? "mentor" : "learner";
      return { role };
    }

    return {};
  };

  const register = async ({ name, email, password, role }: {
    name: string;
    email: string;
    password: string;
    role: "learner" | "mentor";
  }) => {
    const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: name.trim(),
          role,
        },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (error) return { error: error.message };
    return { needsEmailConfirmation: !data.session };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!session?.user) return;
    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.bio !== undefined) updates.bio = data.bio;
    if (data.avatar !== undefined) updates.avatar_url = data.avatar;

    await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", session.user.id);

    setUser((prev) => (prev ? { ...prev, ...data } : null));
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { error: error.message };
    return {};
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoggedIn: !!session && !!user,
        isLoading,
        login,
        register,
        logout,
        updateProfile,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
