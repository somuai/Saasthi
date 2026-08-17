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
import { fetchFlags, updateFlag, type FlagData } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";

const severityBadge: Record<string, { bg: string; text: string }> = {
  high: { bg: "bg-rose-50 text-rose-700 border-rose-100", text: "High" },
  medium: { bg: "bg-amber-50 text-amber-700 border-amber-100", text: "Medium" },
  low: { bg: "bg-emerald-50 text-emerald-700 border-emerald-100", text: "Low" },
  critical: { bg: "bg-purple-50 text-purple-750 border-purple-100", text: "Critical" },
};

const statusBadge: Record<string, { bg: string; text: string }> = {
  open: { bg: "bg-rose-50 text-rose-700 border-rose-100", text: "Open" },
  acknowledged: { bg: "bg-amber-50 text-amber-700 border-amber-100", text: "Acknowledged" },
  resolved: { bg: "bg-emerald-50 text-emerald-700 border-emerald-100", text: "Resolved" },
  dismissed: { bg: "bg-slate-50 text-slate-500 border-slate-200", text: "Dismissed" },
};

export function Flags() {
  const toast = useToast();
  const [flags, setFlags] = useState<FlagData[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFlags();
      setFlags(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load flags");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(id: number, newStatus: string) {
    try {
      await updateFlag(id, newStatus);
      toast.success(`Flag marked as ${newStatus}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update flag");
    }
  }

  const filtered = statusFilter
    ? flags.filter((f) => f.status === statusFilter)
    : flags;

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Active Flags</h1>
          <p className="text-xs text-slate-500 font-medium">Monitor clinically critical indicators, triage states, and severity resolutions</p>
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
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
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
            <div className="p-12 text-center text-slate-400 text-sm font-medium">No flags found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-bold text-slate-700 text-xs">Flag Type</TableHead>
                    <TableHead className="font-bold text-slate-700 text-xs">Severity</TableHead>
                    <TableHead className="font-bold text-slate-700 text-xs">Status</TableHead>
                    <TableHead className="font-bold text-slate-700 text-xs">Created On</TableHead>
                    <TableHead className="w-44 font-bold text-slate-700 text-xs text-right pr-6">Triage Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((f) => {
                    const mappedSeverity = severityBadge[f.severity] || { bg: "bg-slate-50 text-slate-550 border-slate-200", text: f.severity };
                    const mappedStatus = statusBadge[f.status] || { bg: "bg-slate-50 text-slate-500 border-slate-200", text: f.status };
                    return (
                      <TableRow key={f.id} className="hover:bg-slate-50/40 transition-colors">
                        <TableCell className="font-bold text-slate-800 text-xs">{f.flag_type}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${mappedSeverity.bg} border font-semibold text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-lg`}>
                            {mappedSeverity.text}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${mappedStatus.bg} border font-semibold text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-lg`}>
                            {mappedStatus.text}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-450 font-medium">
                          {formatDateTime(f.created_at)}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <Select
                            value={f.status}
                            onValueChange={(v) => handleStatusChange(f.id, v)}
                          >
                            <SelectTrigger className="h-8 w-36 ml-auto text-xs font-semibold rounded-xl border-slate-200 shadow-sm bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="acknowledged">Acknowledge</SelectItem>
                              <SelectItem value="resolved">Resolve</SelectItem>
                              <SelectItem value="dismissed">Dismiss</SelectItem>
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
