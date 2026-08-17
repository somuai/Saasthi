"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useWebSocket } from "@/providers/WebSocketProvider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ActivityIcon, BellIcon } from "lucide-react";

const CommandMap = dynamic(() => import("@/components/CommandMap"), {
  ssr: false,
  loading: () => <div className="h-[600px] w-full rounded-xl bg-muted animate-pulse flex items-center justify-center border">Loading Live Map...</div>,
});

export default function MapPage() {
  const { alerts, isConnected, simulateAlert } = useWebSocket();

  return (
    <div className="p-8 h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            Live Command Center
            <Badge variant={isConnected ? "default" : "secondary"} className={isConnected ? "bg-teal-500 hover:bg-teal-600 text-white ml-2" : "ml-2"}>
              {isConnected ? "Live" : "Offline"}
            </Badge>
          </h1>
          <p className="text-muted-foreground">Monitor ASHA workers and active emergency dispatches in real-time.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-3 h-full">
          <CommandMap />
        </div>
        
        <div className="h-[600px] lg:h-full flex flex-col">
          <Card className="flex-1 flex flex-col overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="shrink-0 bg-slate-50 dark:bg-slate-900/50 border-b">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ActivityIcon className="w-5 h-5 text-indigo-500" />
                  Live Dispatch Feed
                </div>
                {process.env.NODE_ENV !== "production" && (
                  <button 
                    onClick={() => simulateAlert({ type: Math.random() > 0.5 ? 'HIGH_RISK' : 'URGENT_TASK', message: "Mock emergency dispatched to sub-center." })}
                    className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-1 rounded"
                  >
                    Simulate
                  </button>
                )}
              </CardTitle>
              <CardDescription>Real-time updates from field workers.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="h-full w-full">
                {alerts.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-full gap-3 opacity-60">
                    <BellIcon className="w-8 h-8" />
                    <p>No active dispatches or alerts right now.</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {alerts.map((alert, idx) => (
                      <div key={idx} className="p-4 border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <Badge variant={alert.type === 'HIGH_RISK' ? 'destructive' : alert.type === 'URGENT_TASK' ? 'default' : 'secondary'} 
                                 className={alert.type === 'URGENT_TASK' ? 'bg-amber-500 text-white hover:bg-amber-600' : ''}>
                            {alert.type.replace('_', ' ')}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{alert.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
