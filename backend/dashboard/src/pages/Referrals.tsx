import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { fetchReferrals, updateReferral, type ReferralData } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";

const statusBadge: Record<string, { bg: string; text: string }> = {
  draft: { bg: "bg-slate-50 text-slate-500 border-slate-200", text: "Draft" },
  sent: { bg: "bg-blue-50 text-blue-700 border-blue-100", text: "Sent" },
  accepted: { bg: "bg-indigo-50 text-indigo-700 border-indigo-100", text: "Accepted" },
  completed: { bg: "bg-emerald-50 text-emerald-700 border-emerald-100", text: "Completed" },
  cancelled: { bg: "bg-rose-50 text-rose-700 border-rose-100", text: "Cancelled" },
};

export function Referrals() {
  const toast = useToast();
  const [referrals, setReferrals] = useState<ReferralData[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchReferrals();
      setReferrals(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load referrals");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(id: number, newStatus: string) {
    try {
      await updateReferral(id, newStatus);
      toast.success(`Referral marked as ${newStatus}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update referral");
    }
  }

  const filtered = statusFilter
    ? referrals.filter((r) => r.status === statusFilter)
    : referrals;

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Referral Pipeline</h1>
          <p className="text-xs text-slate-500 font-medium">Monitor clinical referral pipelines, tracking states, and destination facilities</p>
        </div>
        <Button variant="ghost" size="icon" onClick={load} className="rounded-xl border border-slate-200 shadow-sm h-9 w-9 bg-white text-slate-550 hover:text-slate-950">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40 rounded-xl border-slate-200 shadow-sm bg-white text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="rounded-2xl border border-slate-100 shadow-premium overflow-hidden bg-white">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm font-medium">No referrals found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-bold text-slate-700 text-xs">Destination Facility</TableHead>
                    <TableHead className="font-bold text-slate-700 text-xs">Referral Reason</TableHead>
                    <TableHead className="font-bold text-slate-700 text-xs">Status</TableHead>
                    <TableHead className="font-bold text-slate-700 text-xs">Created On</TableHead>
                    <TableHead className="w-44 font-bold text-slate-700 text-xs text-right pr-6">Pipeline Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const mappedStatus = statusBadge[r.status] || { bg: "bg-slate-50 text-slate-500 border-slate-200", text: r.status };
                    return (
                      <TableRow key={r.id} className="hover:bg-slate-50/40 transition-colors">
                        <TableCell className="font-bold text-slate-800 text-xs">{r.destination}</TableCell>
                        <TableCell className="text-slate-550 text-xs max-w-xs truncate font-medium">
                          {r.reason}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${mappedStatus.bg} border font-semibold text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-lg`}>
                            {mappedStatus.text}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-400 font-medium">
                          {formatDateTime(r.created_at)}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <Select
                            value={r.status}
                            onValueChange={(v) => handleStatusChange(r.id, v)}
                          >
                            <SelectTrigger className="h-8 w-36 ml-auto text-xs font-semibold rounded-xl border-slate-200 shadow-sm bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="sent">Sent</SelectItem>
                              <SelectItem value="accepted">Accepted</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
