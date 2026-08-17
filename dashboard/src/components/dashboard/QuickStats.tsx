"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, Activity, ShieldAlert, FileWarning, Clock, BellRing } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  loading: boolean;
}

function StatCard({ title, value, description, icon, loading }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? <div className="h-8 w-24 bg-gray-200 animate-pulse rounded"></div> : <div className="text-2xl font-bold">{value}</div>}
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

export function QuickStats() {
  const { user } = useAuth();
  const isSupervisor = user?.role === "supervisor" || user?.is_supervisor;

  const { data, isLoading, error } = useQuery({
    queryKey: ["kpis", user?.id, isSupervisor ? "supervisor" : "doctor"],
    queryFn: async () => {
      const res = await apiClient.get("/dashboard/admin/summary/");
      return res.data;
    },
    enabled: !!user?.id,
  });

  if (error) {
    return <div className="text-red-500">Failed to load statistics</div>;
  }

  if (isSupervisor) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Patients"
          value={data?.total_patients || 0}
          description="Registered across your jurisdiction"
          icon={<Users className="h-4 w-4 text-blue-500" />}
          loading={isLoading}
        />
        <StatCard
          title="Follow-ups Due Today"
          value={data?.follow_ups_due || 0}
          description="Tasks assigned to ASHA workers"
          icon={<Clock className="h-4 w-4 text-orange-500" />}
          loading={isLoading}
        />
        <StatCard
          title="Data Quality Score"
          value={`${data?.data_quality_score || 0}%`}
          description="Completeness of patient records"
          icon={<CheckCircle className="h-4 w-4 text-green-500" />}
          loading={isLoading}
        />
        <StatCard
          title="Worker Availability"
          value={`${data?.worker_availability || 0}%`}
          description="Online/active ASHA workers"
          icon={<Activity className="h-4 w-4 text-emerald-500" />}
          loading={isLoading}
        />
      </div>
    );
  }

  // Doctor View
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="High-Risk Patients"
        value={data?.high_risk_patients || 0}
        description="Require clinical review"
        icon={<ShieldAlert className="h-4 w-4 text-red-500" />}
        loading={isLoading}
      />
      <StatCard
        title="Pending Referrals"
        value={data?.pending_referrals || 0}
        description="Awaiting action"
        icon={<FileWarning className="h-4 w-4 text-orange-500" />}
        loading={isLoading}
      />
      <StatCard
        title="Active Alerts"
        value={data?.active_alerts || 0}
        description="Unresolved clinical alerts"
        icon={<BellRing className="h-4 w-4 text-[#416CAF]" />}
        loading={isLoading}
      />
      <StatCard
        title="Overdue Patients"
        value={data?.overdue_followups || 0}
        description="Missed scheduled visits"
        icon={<Clock className="h-4 w-4 text-gray-500" />}
        loading={isLoading}
      />
    </div>
  );
}
