"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RiskAssessment {
  id: number;
  patient: {
    id: number;
    name: string;
    age: number;
  };
  severity: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  score: number;
  ai_rationale: string;
  is_acknowledged: boolean;
  created_at: string;
}

export default function TriagePage() {
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchAssessments = async () => {
      try {
        const res = await apiClient.get("/risk/assessments/");
        if (isMounted) {
          setAssessments(res.data.results || res.data);
        }
      } catch (error) {
        console.error("Failed to fetch risk assessments", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchAssessments();
    return () => {
      isMounted = false;
    };
  }, []);



  const handleAcknowledge = async (id: number) => {
    try {
      await apiClient.post(`/risk/assessments/${id}/acknowledge/`);
      setAssessments((current) => current.map(a => a.id === id ? { ...a, is_acknowledged: true } : a));
    } catch (error) {
      console.error("Failed to acknowledge", error);
    }
  };

  if (loading) return <div className="p-8">Loading triage board...</div>;

  const criticalAndHigh = assessments.filter(a => ["CRITICAL", "HIGH"].includes(a.severity) && !a.is_acknowledged);
  const acknowledged = assessments.filter(a => a.is_acknowledged);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Triage Board</h1>
          <p className="text-muted-foreground">Review high-risk patient flags requiring immediate attention.</p>
        </div>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="pending">Pending Review ({criticalAndHigh.length})</TabsTrigger>
          <TabsTrigger value="acknowledged">Acknowledged ({acknowledged.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending" className="mt-0">
          {criticalAndHigh.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No critical or high-risk patients pending review.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {criticalAndHigh.map((assessment) => (
                <Card key={assessment.id} className={`border-l-4 transition-all hover:shadow-md ${assessment.severity === 'CRITICAL' ? 'border-l-red-500' : 'border-l-amber-500'}`}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{assessment.patient?.name || `Patient #${assessment.patient?.id}`}</CardTitle>
                      <Badge variant={assessment.severity === 'CRITICAL' ? 'destructive' : 'default'} className={assessment.severity === 'HIGH' ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}>
                        {assessment.severity}
                      </Badge>
                    </div>
                    <CardDescription>
                      <span className="font-semibold text-foreground">Score: {Math.round(assessment.score * 100)}%</span> | Logged: {new Date(assessment.created_at).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground mb-4">
                      <strong className="block mb-1 text-foreground">AI Rationale:</strong>
                      <ScrollArea className="h-20 w-full rounded border p-2 bg-muted/30">
                        {assessment.ai_rationale || "No rationale provided by the risk engine."}
                      </ScrollArea>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button onClick={() => handleAcknowledge(assessment.id)} className="w-full bg-slate-900 hover:bg-slate-800 text-white">
                        Acknowledge Review
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="acknowledged" className="mt-0">
          {acknowledged.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No acknowledged cases found.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 opacity-70">
              {acknowledged.map((assessment) => (
                <Card key={assessment.id} className="border-l-4 border-l-slate-300">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{assessment.patient?.name || `Patient #${assessment.patient?.id}`}</CardTitle>
                      <Badge variant="outline">Acknowledged</Badge>
                    </div>
                    <CardDescription>Score: {Math.round(assessment.score * 100)}%</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground line-clamp-2">
                      <strong>AI Rationale:</strong> {assessment.ai_rationale}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
