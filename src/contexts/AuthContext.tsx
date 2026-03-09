import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export interface UserProfile {
  name: string;
  email: string;
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
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (email: string, password: string, name: string, role: "learner" | "mentor") => Promise<{ error?: string; needsEmailConfirmation?: boolean }>;
  loginWithGoogle: () => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
      setUser({
        name: data.name || authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "User",
        email: data.email || authUser.email || "",
        avatar: data.avatar_url || authUser.user_metadata?.avatar_url,
        role: (data.role as "learner" | "mentor") || "learner",
        phone: data.phone || undefined,
        bio: data.bio || undefined,
      });
    } else {
      // Fallback if profile not yet created
      setUser({
        name: authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "User",
        email: authUser.email || "",
        avatar: authUser.user_metadata?.avatar_url,
        role: "learner",
      });
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        if (newSession?.user) {
          // Use setTimeout to avoid deadlock with Supabase auth
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

  const login = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) return { error: error.message };
    return {};
  };

  const register = async (email: string, password: string, name: string, role: "learner" | "mentor") => {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { full_name: name.trim(), role },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) return { error: error.message };
    return { needsEmailConfirmation: !data.session };
  };

  const loginWithGoogle = async () => {
    // Demo mode: mock Google login with fake account
    setSession({ user: { id: "mock-google-user" } } as any);
    const mockUser: UserProfile = {
      name: "Nguyễn Văn A",
      email: "nguyenvana@gmail.com",
      avatar: "https://lh3.googleusercontent.com/a/default-user=s96-c",
      role: "learner",
    };
    setUser(mockUser);
    return {};
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
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
        loginWithGoogle,
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
