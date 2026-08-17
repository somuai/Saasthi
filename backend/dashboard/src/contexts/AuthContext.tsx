import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface User {
  id?: number;
  phone?: string;
  username?: string;
  role?: string;
  first_name?: string;
  last_name?: string;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  login: (token: string, refreshToken: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("shaasthi_dash_token")
  );
  const [user, setUser] = useState<User | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("shaasthi_dash_user") || "null");
    } catch {
      return null;
    }
  });

  function login(newToken: string, newRefreshToken: string, newUser: User) {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("shaasthi_dash_token", newToken);
    localStorage.setItem("shaasthi_dash_refresh_token", newRefreshToken);
    localStorage.setItem("shaasthi_dash_user", JSON.stringify(newUser));
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem("shaasthi_dash_token");
    localStorage.removeItem("shaasthi_dash_refresh_token");
    localStorage.removeItem("shaasthi_dash_user");
  }

  return (
    <AuthContext.Provider
      value={{ token, user, login, logout, isAuthenticated: !!token }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export type { User };
