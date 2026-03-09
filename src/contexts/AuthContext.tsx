import { createContext, useContext, useState, ReactNode } from "react";

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  role: "learner" | "mentor";
  phone?: string;
  bio?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoggedIn: boolean;
  login: (user: UserProfile) => void;
  logout: () => void;
  updateProfile: (data: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);

  const login = (profile: UserProfile) => setUser(profile);
  const logout = () => setUser(null);
  const updateProfile = (data: Partial<UserProfile>) =>
    setUser((prev) => (prev ? { ...prev, ...data } : null));

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
