import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchIncentives, approveIncentive, payIncentive, type IncentiveData } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, CheckCircle2, DollarSign } from "lucide-react";

const statusBadge: Record<string, string> = {
  pending: "warning",
  approved: "info",
  paid: "success",
};

export function Incentives() {
  const toast = useToast();
  const [entries, setEntries] = useState<IncentiveData[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchIncentives();
      setEntries(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load incentives");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApprove(id: number) {
    try {
      await approveIncentive(id);
      toast.success("Entry approved");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    }
  }

  async function handlePay(id: number) {
    try {
      await payIncentive(id);
      toast.success("Entry marked as paid");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to pay");
    }
  }

  const filtered = statusFilter
    ? entries.filter((e) => e.status === statusFilter)
    : entries;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Incentives</h1>
        <Button variant="ghost" size="icon" onClick={load}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">No incentive entries found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activity</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium max-w-xs truncate">
                        {e.description || e.activity_type}
                      </TableCell>
                      <TableCell className="font-semibold">
                        ₹{(e.amount_paise / 100).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-slate-500">{e.month_year}</TableCell>
                      <TableCell>
                        <Badge variant={(statusBadge[e.status] || "secondary") as any}>
                          {e.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {formatDateTime(e.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {e.status === "pending" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => handleApprove(e.id)}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                          )}
                          {e.status === "approved" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs text-green-600"
                              onClick={() => handlePay(e.id)}
                            >
                              <DollarSign className="h-3 w-3 mr-1" />
                              Pay
                            </Button>
                          )}
                          {e.status === "paid" && (
                            <span className="text-xs text-green-600 font-medium px-2">Paid ✓</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
