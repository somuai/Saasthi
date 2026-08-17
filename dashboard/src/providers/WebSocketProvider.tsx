"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";

interface AlertMessage {
  id: string;
  type: "HIGH_RISK" | "URGENT_TASK" | "SYSTEM";
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status?: string;
  patient_name?: string;
  message: string;
  timestamp: string;
}

interface DispatchUpdate {
  id: string;
  timestamp: string;
  [key: string]: unknown;
}

interface WebSocketContextType {
  socket: WebSocket | null;
  isConnected: boolean;
  alerts: AlertMessage[];
  dispatchUpdates: DispatchUpdate[];
  simulateAlert: (alert: Omit<AlertMessage, "id" | "timestamp">) => void;
  simulateDispatch: (dispatch: Omit<DispatchUpdate, "id" | "timestamp">) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
  alerts: [],
  dispatchUpdates: [],
  simulateAlert: () => {},
  simulateDispatch: () => {},
});

export const useWebSocket = () => useContext(WebSocketContext);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [alerts, setAlerts] = useState<AlertMessage[]>([]);
  const [dispatchUpdates, setDispatchUpdates] = useState<DispatchUpdate[]>([]);

  const simulateAlert = (alert: Omit<AlertMessage, "id" | "timestamp">) => {
    const newAlert: AlertMessage = {
      ...alert,
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
    };
    setAlerts((prev) => [newAlert, ...prev].slice(0, 50));
  };

  const simulateDispatch = (dispatch: Omit<DispatchUpdate, "id" | "timestamp">) => {
    const newUpdate = {
      ...dispatch,
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
    };
    setDispatchUpdates((prev) => [newUpdate, ...prev].slice(0, 50));
  };

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!user || !token) {
      window.setTimeout(() => {
        setSocket(null);
        setIsConnected(false);
      }, 0);
      return;
    }

    if (process.env.NODE_ENV !== "production" && !process.env.NEXT_PUBLIC_WS_URL) {
      window.setTimeout(() => {
        setSocket(null);
        setIsConnected(false);
      }, 0);
      return;
    }

    const buildWebSocketUrl = () => {
      if (process.env.NEXT_PUBLIC_WS_URL) {
        const url = new URL(process.env.NEXT_PUBLIC_WS_URL);
        url.searchParams.set("token", token);
        return url.toString();
      }
      const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1");
      apiUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
      apiUrl.pathname = "/ws/location/";
      apiUrl.search = "";
      apiUrl.searchParams.set("token", token);
      return apiUrl.toString();
    };

    const socketInstance = new WebSocket(buildWebSocketUrl());

    socketInstance.onopen = () => {
      setIsConnected(true);
    };

    socketInstance.onclose = () => {
      setIsConnected(false);
    };

    socketInstance.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "location_update" || message.type === "worker:location_update") {
          const update: DispatchUpdate = {
            id: String(message.worker_id ?? message.id ?? Date.now()),
            timestamp: message.timestamp ?? new Date().toISOString(),
            ...message,
          };
          setDispatchUpdates((prev) => [update, ...prev].slice(0, 50));
          return;
        }
        if (message.type === "alert" || message.type === "alert:new") {
          setAlerts((prev) => [message.payload ?? message, ...prev].slice(0, 50));
          return;
        }
        if (message.type === "alert:updated") {
          const updatedAlert = message.payload ?? message;
          setAlerts((prev) => prev.map((alert) => (alert.id === updatedAlert.id ? updatedAlert : alert)));
        }
      } catch {
        // Ignore malformed telemetry frames; the socket remains healthy.
      }
    };

    window.setTimeout(() => {
      setSocket(socketInstance);
    }, 0);

    return () => {
      socketInstance.close();
    };
  }, [user]);

  return (
    <WebSocketContext.Provider value={{ socket, isConnected, alerts, dispatchUpdates, simulateAlert, simulateDispatch }}>
      {children}
    </WebSocketContext.Provider>
  );
}
