"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon, StethoscopeIcon } from "lucide-react";

interface Referral {
  id: number;
  patient_name: string;
  patient_id: number;
  referred_by: string; // ASHA worker name
  reason: string;
  status: "PENDING" | "REVIEWED" | "RESOLVED";
  date: string;
}

// Fallback data
const mockReferrals: Referral[] = [
  { id: 101, patient_name: "Aaradhya Devi", patient_id: 452, referred_by: "Sunita S.", reason: "Severe Anemia (Hb < 7)", status: "PENDING", date: "2026-06-03" },
  { id: 102, patient_name: "Kavita Rao", patient_id: 893, referred_by: "Meena M.", reason: "High BP 150/100", status: "PENDING", date: "2026-06-02" },
  { id: 103, patient_name: "Lakshmi N.", patient_id: 231, referred_by: "Sunita S.", reason: "Fetal movement decreased", status: "REVIEWED", date: "2026-06-01" },
  { id: 104, patient_name: "Pooja Sharma", patient_id: 554, referred_by: "Anjali P.", reason: "Gestational Diabetes", status: "RESOLVED", date: "2026-05-29" },
];

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchReferrals = async () => {
      try {
        const res = await apiClient.get("/referrals/");
        if (isMounted) {
          setReferrals(res.data.results || res.data);
        }
      } catch (error) {
        console.warn("Failed to fetch referrals, using mock data", error);
        if (isMounted) {
          setReferrals(mockReferrals);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchReferrals();
    return () => {
      isMounted = false;
    };
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING": return <Badge variant="destructive">Needs Review</Badge>;
      case "REVIEWED": return <Badge className="bg-amber-500 hover:bg-amber-600">In Progress</Badge>;
      case "RESOLVED": return <Badge variant="outline" className="border-teal-500 text-teal-600">Resolved</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Referrals Pipeline</h1>
          <p className="text-muted-foreground">Manage patients referred to the clinic by ASHA workers.</p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StethoscopeIcon className="w-5 h-5 text-indigo-500" />
            Active Referrals
          </CardTitle>
          <CardDescription>
            List of all incoming referrals based on ASHA worker field reports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Loading referrals...</div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Referred By (ASHA)</TableHead>
                <TableHead>Clinical Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referrals.map((ref) => (
                <TableRow key={ref.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <TableCell className="font-medium">
                    {ref.patient_name}
                    <div className="text-xs text-muted-foreground">ID: #{ref.patient_id}</div>
                  </TableCell>
                  <TableCell>{ref.referred_by}</TableCell>
                  <TableCell className="max-w-xs truncate text-slate-700 dark:text-slate-300">
                    {ref.reason}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(ref.status)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(ref.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950">
                      View Chart <ArrowRightIcon className="w-4 h-4 ml-1" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
