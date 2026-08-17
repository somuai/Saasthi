"use client";

import React, { useState } from 'react';
import { useAlerts, useAlertActions, useAlertStats } from '@/hooks/useAlerts';
import { AlertCard } from '@/components/alerts/AlertCard';
import { DispatchMatchModal } from '@/components/alerts/DispatchMatchModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Crosshair } from 'lucide-react';
import { Alert } from '@/types';

export default function AlertsPage() {
  const { data: alerts, isLoading } = useAlerts();
  const stats = useAlertStats();
  const { acknowledge, assign, resolve } = useAlertActions();

  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  const activeAlerts = alerts?.filter(a => a.status === 'ACTIVE') || [];
  const inProgressAlerts = alerts?.filter(a => a.status === 'IN_PROGRESS') || [];
  const resolvedAlerts = alerts?.filter(a => a.status === 'RESOLVED') || [];

  const handleOpenDispatch = (alert?: Alert) => {
    if (alert) {
      setSelectedAlert(alert);
    } else {
      // Find highest priority active alert
      const priorityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      const highestPriority = [...activeAlerts].sort((a, b) => 
        priorityOrder[b.severity as keyof typeof priorityOrder] - priorityOrder[a.severity as keyof typeof priorityOrder]
      )[0];
      setSelectedAlert(highestPriority || null);
    }
    setDispatchModalOpen(true);
  };

  const handleAssign = (workerId: number) => {
    if (selectedAlert) {
      assign.mutate({ id: selectedAlert.id, workerId });
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8 relative min-h-screen">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Alerts & Action Center</h2>
      </div>
      <p className="text-muted-foreground">Manage and dispatch responses for high-risk maternal health events.</p>

      {/* Stats Bar */}
      <div className="flex flex-wrap gap-4">
        <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50 px-3 py-1 text-sm">
          Critical: {stats.critical}
        </Badge>
        <Badge variant="outline" className="text-orange-500 border-orange-200 bg-orange-50 px-3 py-1 text-sm">
          High: {stats.high}
        </Badge>
        <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50 px-3 py-1 text-sm">
          Medium: {stats.medium}
        </Badge>
        <Badge variant="outline" className="text-blue-500 border-blue-200 bg-blue-50 px-3 py-1 text-sm">
          Low: {stats.low}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {/* Active Column */}
        <div className="space-y-4">
          <div className="border-b-2 border-red-500 pb-2">
            <h3 className="font-semibold text-lg flex justify-between">
              Active <Badge className="bg-red-500 text-white hover:bg-red-600">{activeAlerts.length}</Badge>
            </h3>
          </div>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              activeAlerts.map(alert => (
                <AlertCard 
                  key={alert.id} 
                  alert={alert} 
                  onAcknowledge={(id) => acknowledge.mutate(id)}
                  onAssign={() => handleOpenDispatch(alert)}
                />
              ))
            )}
            {activeAlerts.length === 0 && !isLoading && (
              <div className="text-center p-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                No active alerts
              </div>
            )}
          </div>
        </div>

        {/* In Progress Column */}
        <div className="space-y-4">
          <div className="border-b-2 border-blue-500 pb-2">
            <h3 className="font-semibold text-lg flex justify-between">
              In Progress <Badge className="bg-blue-500 text-white hover:bg-blue-600">{inProgressAlerts.length}</Badge>
            </h3>
          </div>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              inProgressAlerts.map(alert => (
                <AlertCard 
                  key={alert.id} 
                  alert={alert}
                  onAssign={() => handleOpenDispatch(alert)}
                  onResolve={(id) => resolve.mutate(id)}
                />
              ))
            )}
            {inProgressAlerts.length === 0 && !isLoading && (
              <div className="text-center p-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                No alerts in progress
              </div>
            )}
          </div>
        </div>

        {/* Resolved Column */}
        <div className="space-y-4">
          <div className="border-b-2 border-green-500 pb-2">
            <h3 className="font-semibold text-lg flex justify-between">
              Resolved <Badge className="bg-green-500 text-white hover:bg-green-600">{resolvedAlerts.length}</Badge>
            </h3>
          </div>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              resolvedAlerts.map(alert => (
                <AlertCard key={alert.id} alert={alert} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      {activeAlerts.length > 0 && (
        <Button 
          className="fixed bottom-8 right-8 h-14 px-6 rounded-full shadow-lg bg-[#416CAF] hover:bg-[#2c4e8a] flex items-center gap-2"
          onClick={() => handleOpenDispatch()}
        >
          <Crosshair className="h-5 w-5" />
          Find & Dispatch
        </Button>
      )}

      <DispatchMatchModal 
        isOpen={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        alert={selectedAlert}
        onAssign={handleAssign}
      />
    </div>
  );
}
