"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import { apiClient } from "@/lib/api/client";

interface User {
  id: number;
  phone_number: string;
  role: string;
  name?: string;
  is_supervisor?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginOtpRequest: (phoneNumber: string) => Promise<{ success: boolean; debug_otp?: string; message?: string }>;
  verifyOtp: (phoneNumber: string, otp: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getAuthErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; phone?: string[] } | undefined;
    return data?.error || data?.phone?.[0] || fallback;
  }
  return fallback;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const token = localStorage.getItem("access_token");
    
    if (token) {
      apiClient.get("/auth/me/")
        .then((res) => {
          if (isMounted) setUser(res.data);
        })
        .catch(() => {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    } else {
      window.setTimeout(() => {
        if (isMounted) setIsLoading(false);
      }, 0);
    }
    
    return () => {
      isMounted = false;
    };
  }, []);

  const loginOtpRequest = async (phoneNumber: string) => {
    try {
      const res = await apiClient.post("/auth/otp/request/", { phone: phoneNumber });
      return { success: true, debug_otp: res.data.debug_otp, message: res.data.message };
    } catch (error: unknown) {
      return { success: false, message: getAuthErrorMessage(error, "Failed to request OTP") };
    }
  };

  const verifyOtp = async (phoneNumber: string, otp: string) => {
    try {
      const res = await apiClient.post("/auth/otp/verify/", {
        phone: phoneNumber,
        code: otp,
      });
      const { access, refresh, user: userData } = res.data;
      localStorage.setItem("access_token", access);
      localStorage.setItem("refresh_token", refresh);
      setUser(userData);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, message: getAuthErrorMessage(error, "Invalid OTP") };
    }
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, loginOtpRequest, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
