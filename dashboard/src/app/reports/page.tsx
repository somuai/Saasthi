"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Area, AreaChart, CartesianGrid, XAxis, Bar, BarChart, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";

interface ReportTrend {
  date: string;
  referrals: number;
  resolved: number;
}

interface ConditionData {
  condition: string;
  count: number;
}

// Mock data fallback if API is unavailable
const mockReportsData = [
  { date: "2026-05-01", referrals: 12, resolved: 8 },
  { date: "2026-05-02", referrals: 19, resolved: 10 },
  { date: "2026-05-03", referrals: 15, resolved: 12 },
  { date: "2026-05-04", referrals: 22, resolved: 18 },
  { date: "2026-05-05", referrals: 28, resolved: 20 },
  { date: "2026-05-06", referrals: 25, resolved: 22 },
  { date: "2026-05-07", referrals: 30, resolved: 25 },
];

const mockConditionsData = [
  { condition: "Anemia", count: 120 },
  { condition: "High BP", count: 85 },
  { condition: "Gestational Diabetes", count: 40 },
  { condition: "Malnutrition", count: 65 },
];

const areaChartConfig = {
  referrals: {
    label: "Total Referrals",
    color: "hsl(var(--chart-1))",
  },
  resolved: {
    label: "Resolved Cases",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const barChartConfig = {
  count: {
    label: "Condition Frequency",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

export default function ReportsPage() {
  const [reportsData, setReportsData] = useState<ReportTrend[]>([]);
  const [conditionsData, setConditionsData] = useState<ConditionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const res = await apiClient.get("/reports/summary/");
        if (isMounted) {
          setReportsData(res.data.trends || mockReportsData);
          setConditionsData(res.data.conditions || mockConditionsData);
        }
      } catch (error) {
        console.warn("API not ready or failed, using mock data for visualization", error);
        if (isMounted) {
          setReportsData(mockReportsData);
          setConditionsData(mockConditionsData);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) return <div className="p-8 animate-pulse">Loading visualizations...</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Referrals</h1>
          <p className="text-muted-foreground">Visualize ASHA worker activity, referrals, and health trends.</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="referrals">Referrals Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-0 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Area Chart for Trends */}
            <Card className="col-span-2 shadow-sm border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle>Referral vs Resolution Trends</CardTitle>
                <CardDescription>Daily volume of patient referrals vs resolved cases over the last 7 days.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={areaChartConfig} className="h-[300px] w-full">
                  <AreaChart data={reportsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorReferrals" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-referrals)" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="var(--color-referrals)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-resolved)" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="var(--color-resolved)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="referrals" stroke="var(--color-referrals)" fillOpacity={1} fill="url(#colorReferrals)" />
                    <Area type="monotone" dataKey="resolved" stroke="var(--color-resolved)" fillOpacity={1} fill="url(#colorResolved)" />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Bar Chart for Conditions */}
            <Card className="col-span-2 lg:col-span-1 shadow-sm border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle>Top Health Conditions</CardTitle>
                <CardDescription>Distribution of flagged conditions from ASHA worker reports.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={barChartConfig} className="h-[250px] w-full">
                  <BarChart data={conditionsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="condition" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <ChartTooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Placeholder for future pie chart or summary stats */}
            <Card className="col-span-2 lg:col-span-1 shadow-sm border-slate-200 dark:border-slate-800 flex flex-col justify-center items-center p-6 text-center">
               <div className="rounded-full bg-teal-100 dark:bg-teal-900/30 p-4 mb-4">
                 <svg className="w-8 h-8 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
               </div>
               <h3 className="text-xl font-bold mb-2">94% Reporting Compliance</h3>
               <p className="text-muted-foreground text-sm">ASHA workers in your district have submitted their mandatory reports for the current cycle.</p>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="referrals">
          <Card>
            <CardContent className="py-20 text-center text-muted-foreground">
              Detailed referral tracking view goes here. This tab will contain a data table of all historical referrals.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
