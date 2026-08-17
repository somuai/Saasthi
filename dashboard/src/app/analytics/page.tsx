"use client";

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAnalyticsOverview, useWorkerScorecard, useTrendData } from '@/hooks/useAnalytics';
import { GeoInsightsMapWrapper } from '@/components/analytics/GeoInsightsMapWrapper';
import { WorkerRadarChart } from '@/components/analytics/WorkerRadarChart';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

export default function AnalyticsPage() {
  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview();
  const { data: trendsNewReg, isLoading: trendsRegLoading } = useTrendData('registrations', 30);
  const { data: trendsHighRisk, isLoading: trendsRiskLoading } = useTrendData('high_risk', 30);
  
  // Mock worker scorecards
  const { data: worker1Data } = useWorkerScorecard(1);
  const { data: worker2Data } = useWorkerScorecard(2);
  const { data: worker3Data } = useWorkerScorecard(3);

  const riskColors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
  const riskDistribution = overview?.risk_distribution ?? [];
  const riskChartData = riskDistribution.map((d) => ({ name: d.level, value: d.count }));

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Analytics & Insights</h2>
      </div>
      <p className="text-muted-foreground">Deep-dive into population health, worker performance, and geographic patterns.</p>

      <Tabs defaultValue="population" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="population">Population Health</TabsTrigger>
          <TabsTrigger value="workers">Worker Performance</TabsTrigger>
          <TabsTrigger value="geographic">Geographic Insights</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="population" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Risk Distribution</CardTitle>
                <CardDescription>Current patient risk stratification</CardDescription>
              </CardHeader>
              <CardContent>
                {overviewLoading ? <Skeleton className="h-[250px] w-full" /> : (
                  <div className="h-[250px] min-h-[250px] min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={riskChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
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

            <Card className="col-span-1 md:col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle>Condition Prevalence</CardTitle>
                <CardDescription>Top conditions affecting the population</CardDescription>
              </CardHeader>
              <CardContent>
                {overviewLoading ? <Skeleton className="h-[250px] w-full" /> : (
                  <div className="h-[250px] min-h-[250px] min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overview?.condition_prevalence || []} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <XAxis type="number" />
                        <YAxis dataKey="condition" type="category" width={120} />
                        <RechartsTooltip />
                        <Bar dataKey="count" fill="#416CAF" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="workers" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Priya Sharma</CardTitle>
                <CardDescription>Worker ID: #001</CardDescription>
              </CardHeader>
              <CardContent>
                {worker1Data ? <WorkerRadarChart data={worker1Data} workerName="Priya Sharma" /> : <Skeleton className="h-[250px] w-full" />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Anjali Patel</CardTitle>
                <CardDescription>Worker ID: #002</CardDescription>
              </CardHeader>
              <CardContent>
                {worker2Data ? <WorkerRadarChart data={worker2Data} workerName="Anjali Patel" /> : <Skeleton className="h-[250px] w-full" />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Kavita Desai</CardTitle>
                <CardDescription>Worker ID: #003</CardDescription>
              </CardHeader>
              <CardContent>
                {worker3Data ? <WorkerRadarChart data={worker3Data} workerName="Kavita Desai" /> : <Skeleton className="h-[250px] w-full" />}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="geographic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>H3 Risk Density Heatmap</CardTitle>
              <CardDescription>Geospatial clustering of high-risk patients using H3 hexagon indexing.</CardDescription>
            </CardHeader>
            <CardContent>
              <GeoInsightsMapWrapper />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>30-Day Trends</CardTitle>
              <CardDescription>New registrations vs High-risk detections</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] min-h-[350px] min-w-0">
                {trendsRegLoading || trendsRiskLoading ? <Skeleton className="h-full w-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" allowDuplicatedCategory={false} />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <RechartsTooltip />
                      <Line yAxisId="left" data={trendsNewReg} type="monotone" dataKey="value" name="New Registrations" stroke="#416CAF" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" data={trendsHighRisk} type="monotone" dataKey="value" name="High Risk Detections" stroke="#ef4444" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
