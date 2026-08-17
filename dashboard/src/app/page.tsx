"use client";

import { QuickStats } from "@/components/dashboard/QuickStats";
import { useAuth } from "@/providers/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalyticsOverview } from "@/hooks/useAnalytics";
import { ActivityFeed } from "@/components/analytics/ActivityFeed";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { user } = useAuth();
  const { data: overview, isLoading } = useAnalyticsOverview();
  const riskColors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
  const riskDistribution = overview?.risk_distribution ?? [];
  const riskChartData = riskDistribution.map((d) => ({ name: d.level, value: d.count }));

  // Mock data for referrals area chart
  const referralData = [
    { name: 'Mon', referrals: 40, resolved: 24 },
    { name: 'Tue', referrals: 30, resolved: 13 },
    { name: 'Wed', referrals: 20, resolved: 48 },
    { name: 'Thu', referrals: 27, resolved: 39 },
    { name: 'Fri', referrals: 18, resolved: 48 },
    { name: 'Sat', referrals: 23, resolved: 38 },
    { name: 'Sun', referrals: 34, resolved: 43 },
  ];

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          Welcome back, {user?.name || 'User'}
        </h2>
      </div>
      
      <QuickStats />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Risk Distribution</CardTitle>
            <CardDescription>Current patient risk stratification</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[300px] w-full" /> : (
              <div className="h-[300px] min-h-[300px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {riskDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={riskColors[index % riskColors.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Live feed of system events</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityFeed />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Referral Trends (7 Days)</CardTitle>
            <CardDescription>Generated referrals vs resolved cases</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] min-h-[300px] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={referralData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReferrals" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#416CAF" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#416CAF" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <RechartsTooltip />
                  <Area type="monotone" dataKey="referrals" stroke="#416CAF" fillOpacity={1} fill="url(#colorReferrals)" />
                  <Area type="monotone" dataKey="resolved" stroke="#22c55e" fillOpacity={1} fill="url(#colorResolved)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
