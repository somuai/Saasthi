"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Incentive {
  id: number;
  asha_worker: {
    id: number;
    name: string;
    phone_number: string;
  };
  activity_type: string;
  amount: string;
  status: "PENDING" | "APPROVED" | "PAID";
  created_at: string;
}

export default function IncentivesPage() {
  const [incentives, setIncentives] = useState<Incentive[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchIncentives = async () => {
      try {
        const res = await apiClient.get("/incentives/");
        const results = res.data.results || res.data;
        if (isMounted) {
          setIncentives(results);
        }
      } catch (error) {
        console.error("Failed to fetch incentives", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchIncentives();
    return () => {
      isMounted = false;
    };
  }, []);



  const handleApprove = async (id: number) => {
    try {
      await apiClient.post(`/incentives/${id}/approve/`);
      setIncentives((current) => current.map(i => i.id === id ? { ...i, status: "APPROVED" } : i));
    } catch (error) {
      console.error("Failed to approve incentive", error);
    }
  };

  if (loading) return <div className="p-8">Loading supervisor inbox...</div>;

  const pendingIncentives = incentives.filter(i => i.status === "PENDING");

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Supervisor Inbox</h1>
          <p className="text-muted-foreground">Review and approve completed ASHA worker activities.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingIncentives.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              No pending incentives require approval.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ASHA Worker</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingIncentives.map((incentive) => (
                  <TableRow key={incentive.id}>
                    <TableCell className="font-medium">
                      {incentive.asha_worker?.name || `Worker #${incentive.asha_worker?.id}`}
                      <div className="text-xs text-muted-foreground">{incentive.asha_worker?.phone_number}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {incentive.activity_type.toLowerCase().replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-teal-600 dark:text-teal-400">
                      ₹{parseFloat(incentive.amount).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(incentive.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="border-teal-500 text-teal-600 hover:bg-teal-50 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-950" onClick={() => handleApprove(incentive.id)}>
                        Approve
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
