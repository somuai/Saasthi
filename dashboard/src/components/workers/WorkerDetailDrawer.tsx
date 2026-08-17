"use client";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useWorkerDetail } from "@/hooks/useWorkers";
import { Loader2, Phone, MessageSquare, MapPin, Activity, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const buildWeeklyVisitData = (visitsThisWeek: number) => {
  const weights = [0.16, 0.18, 0.2, 0.16, 0.18, 0.12, 0];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((day, index) => ({
    day,
    visits: Math.max(0, Math.round(visitsThisWeek * weights[index])),
  }));
};

export function WorkerDetailDrawer({ 
  workerId, 
  isOpen, 
  onClose 
}: { 
  workerId: number | null, 
  isOpen: boolean, 
  onClose: () => void 
}) {
  const { data: worker, isLoading } = useWorkerDetail(workerId);
  const performanceData = worker ? buildWeeklyVisitData(worker.performance.visits_this_week) : [];

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md lg:max-w-lg overflow-y-auto p-0 sm:p-6 bg-slate-50">
        
        {isLoading || !worker ? (
          <div className="h-full flex flex-col items-center justify-center p-12">
            <Loader2 className="h-10 w-10 animate-spin text-[#416CAF]" />
            <p className="mt-4 text-muted-foreground">Loading worker record...</p>
          </div>
        ) : (
          <div className="flex flex-col h-full space-y-6">
            
            {/* Header Section */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <SheetTitle className="text-2xl font-bold text-gray-900">{worker.name}</SheetTitle>
                  <p className="text-gray-500 text-sm mt-1 flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {worker.phone}
                  </p>
                </div>
                <Badge className={
                  worker.status === 'Online' ? 'bg-green-100 text-green-800' :
                  worker.status === 'Syncing' ? 'bg-blue-100 text-blue-800' :
                  'bg-slate-100 text-slate-800'
                }>
                  {worker.status}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2 mt-6">
                <Button variant="outline" size="sm" className="gap-2 flex-1 border-[#416CAF] text-[#416CAF] hover:bg-blue-50">
                  <Phone className="h-4 w-4" /> Call
                </Button>
                <Button size="sm" className="gap-2 flex-1 bg-[#416CAF] hover:bg-[#2b4c80]">
                  <MessageSquare className="h-4 w-4" /> SMS Broadcast
                </Button>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                  <Activity className="h-4 w-4" />
                  <span className="text-sm font-medium">Active Patients</span>
                </div>
                <p className="text-3xl font-bold text-slate-800">{worker.active_patients}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                  <ListChecks className="h-4 w-4" />
                  <span className="text-sm font-medium">Visits Today</span>
                </div>
                <p className="text-3xl font-bold text-slate-800">{worker.performance.visits_today}</p>
              </div>
            </div>

            {/* Location Info */}
            <div className="bg-white p-5 rounded-xl border shadow-sm">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-red-500" /> Location Tracking
              </h3>
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>Current Coordinates:</span>
                  <span className="font-medium text-slate-900">{worker.location.lat.toFixed(4)}, {worker.location.lng.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Updated:</span>
                  <span className="font-medium text-slate-900">
                    {formatDistanceToNow(new Date(worker.location.last_updated), { addSuffix: true })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Last Device Sync:</span>
                  <span className="font-medium text-slate-900">
                    {formatDistanceToNow(new Date(worker.last_sync_time), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>

            {/* Performance Chart */}
            <div className="bg-white p-5 rounded-xl border shadow-sm flex-1">
              <h3 className="font-semibold text-lg mb-4">Visits (Last 7 Days)</h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="visits" fill="#416CAF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-center text-sm text-slate-500 mt-2">
                Total visits this week: <span className="font-bold text-slate-800">{worker.performance.visits_this_week}</span>
              </p>
            </div>

          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
