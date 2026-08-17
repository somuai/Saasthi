import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, FileText, Download, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WorkerReportRow {
  id: number;
  name: string;
  asha_id: string;
  village: string;
  phone_number: string;
  onboarding_status: string;
  total_households: number;
  total_patients: number;
  surveys_this_month: number;
  high_risk_count: number;
  estimated_households: number;
}

export function Reports() {
  const toast = useToast();
  const [workers, setWorkers] = useState<WorkerReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadingBulk, setDownloadingBulk] = useState(false);
  const [officialDownload, setOfficialDownload] = useState<string | null>(null);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/anm/workers-overview/", {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("shaasthi_dash_token") || ""}`
        }
      });
      if (!response.ok) throw new Error("Failed to fetch worker statistics");
      const data = await response.json();
      setWorkers(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error loading reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  const changeMonth = (offset: number) => {
    const [yearStr, monthStr] = month.split('-');
    let yr = parseInt(yearStr);
    let mn = parseInt(monthStr) - 1 + offset;
    
    if (mn < 0) {
      mn = 11;
      yr -= 1;
    } else if (mn > 11) {
      mn = 0;
      yr += 1;
    }
    
    setMonth(`${yr}-${String(mn + 1).padStart(2, '0')}`);
  };

  const getMonthLabel = () => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  };

  const downloadSinglePDF = async (worker: WorkerReportRow) => {
    if (!worker.id) {
      toast.error("ASHA worker has not claimed their account yet.");
      return;
    }
    setDownloadingId(worker.id);
    try {
      const response = await fetch(`/api/anm/reports/monthly/?worker_id=${worker.id}&month=${month}&format=pdf`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("shaasthi_dash_token") || ""}`
        }
      });
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ASHA_Report_${worker.asha_id}_${month}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Downloaded report for ${worker.name}`);
    } catch (err) {
      toast.error("Could not download report. Verify database sync status.");
    } finally {
      setDownloadingId(null);
    }
  };

  const downloadBulkPDF = async () => {
    const activeWorkers = workers.filter(w => w.id !== null);
    if (activeWorkers.length === 0) {
      toast.error("No active onboarded workers available to report.");
      return;
    }
    setDownloadingBulk(true);
    try {
      const response = await fetch(`/api/anm/reports/monthly/bulk-pdf/?month=${month}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("shaasthi_dash_token") || ""}`
        }
      });
      if (!response.ok) throw new Error("Failed to generate bulk PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Bulk_ASHA_Reports_${month}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Downloaded bulk PDF successfully");
    } catch (err) {
      toast.error("Failed to generate bulk report bundle.");
    } finally {
      setDownloadingBulk(false);
    }
  };

  const downloadOfficialReport = async (kind: "rch" | "formatD") => {
    const config = {
      rch: {
        url: "/api/anm/reports/rch-shadow-register/",
        filename: `ANM_RCH_Shadow_Register_${month}.csv`,
        label: "ANM RCH shadow register",
      },
      formatD: {
        url: `/api/anm/reports/format-d/?month=${month}`,
        filename: `Format_D_${month}.csv`,
        label: "Format D monthly report",
      },
    }[kind];

    setOfficialDownload(kind);
    try {
      const response = await fetch(config.url, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("shaasthi_dash_token") || ""}`
        }
      });
      if (!response.ok) throw new Error(`Failed to generate ${config.label}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = config.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Downloaded ${config.label}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not download official report.");
    } finally {
      setOfficialDownload(null);
    }
  };

  // Compute sums
  const totalSurveys = workers.reduce((acc, curr) => acc + curr.surveys_this_month, 0);
  const totalHighRisk = workers.reduce((acc, curr) => acc + curr.high_risk_count, 0);
  const registeredCount = workers.filter(w => w.onboarding_status === 'joined').length;

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">NHM Performance Reports</h1>
          <p className="text-xs text-slate-500 font-medium">Review and export official monthly village health progress summaries</p>
        </div>

        {/* Bulk Actions */}
        <Button
          onClick={downloadBulkPDF}
          disabled={downloadingBulk || loading || workers.filter(w => w.id !== null).length === 0}
          className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-2 rounded-xl font-semibold text-xs shadow-sm h-9 px-4 transition-colors"
        >
          {downloadingBulk ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Download Bulk PDF
        </Button>
      </div>

      {/* Period Selection Controls */}
      <div className="flex items-center gap-2.5 bg-white p-2 rounded-xl border border-slate-200/60 shadow-sm w-fit">
        <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)} className="h-8 w-8 rounded-lg hover:bg-slate-50">
          <ChevronLeft className="h-4 w-4 text-slate-500" />
        </Button>
        <span className="font-bold text-slate-800 text-xs min-w-[130px] text-center tracking-tight">
          {getMonthLabel()}
        </span>
        <Button variant="ghost" size="icon" onClick={() => changeMonth(1)} className="h-8 w-8 rounded-lg hover:bg-slate-50">
          <ChevronRight className="h-4 w-4 text-slate-500" />
        </Button>
      </div>

      {/* Summary KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border border-slate-100 shadow-premium bg-white">
          <CardContent className="p-5 flex flex-col justify-between h-24">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ASHA Reporting</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-3xl font-extrabold text-teal-700 tracking-tight">{registeredCount}</span>
              <span className="text-xs text-slate-400 font-semibold">of {workers.length} registered</span>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-slate-100 shadow-premium bg-white">
          <CardContent className="p-5 flex flex-col justify-between h-24">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Surveys</span>
            <p className="text-3xl font-extrabold text-slate-800 tracking-tight mt-0.5">{totalSurveys}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-slate-100 shadow-premium bg-white">
          <CardContent className="p-5 flex flex-col justify-between h-24">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-rose-500">High Risk cases</span>
            <p className="text-3xl font-extrabold text-rose-600 tracking-tight mt-0.5">{totalHighRisk}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border border-slate-100 shadow-premium bg-white">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Official WB/NHM Exports</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Export government-facing registers for ANM review, PHC submission, and monthly block reporting.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => downloadOfficialReport("rch")}
                disabled={officialDownload !== null}
                className="h-9 rounded-xl border-teal-200 text-teal-750 hover:bg-teal-50 text-xs font-bold"
              >
                {officialDownload === "rch" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                RCH Shadow CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => downloadOfficialReport("formatD")}
                disabled={officialDownload !== null}
                className="h-9 rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold"
              >
                {officialDownload === "formatD" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Format D CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card className="rounded-2xl border border-slate-100 shadow-premium overflow-hidden bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold text-slate-700 text-xs">ASHA Worker</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs">ASHA ID</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs">Village</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs text-center">Households</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs text-center">Surveys</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs text-center">High Risk (HRP)</TableHead>
                  <TableHead className="w-40 font-bold text-slate-700 text-xs text-right pr-6">Report Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <TableRow key={idx}>
                      {Array.from({ length: 7 }).map((_, cIdx) => (
                        <TableCell key={cIdx}>
                          <div className="h-5 bg-slate-100 rounded animate-pulse" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : workers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-slate-400 text-sm font-medium">
                      No ASHA workers registered under your supervision.
                    </TableCell>
                  </TableRow>
                ) : (
                  workers.map((worker) => (
                    <TableRow key={worker.phone_number} className="hover:bg-slate-50/40 transition-colors">
                      <TableCell className="font-bold text-slate-800 text-xs">{worker.name}</TableCell>
                      <TableCell className="text-xs font-mono text-slate-400">{worker.asha_id}</TableCell>
                      <TableCell className="text-slate-600 text-xs font-medium">{worker.village || "—"}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-slate-800 text-xs">{worker.total_households}</span>
                          <span className="text-[9px] text-slate-400 font-semibold">est. {worker.estimated_households}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-bold text-teal-700 text-xs">{worker.surveys_this_month}</TableCell>
                      <TableCell className="text-center font-bold text-red-600 text-xs">{worker.high_risk_count}</TableCell>
                      <TableCell className="text-right pr-4">
                        {worker.onboarding_status === 'joined' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadSinglePDF(worker)}
                            disabled={downloadingId === worker.id}
                            className="text-teal-700 border-teal-200 hover:bg-teal-50 hover:border-teal-300 font-bold text-[11px] rounded-xl px-3 h-8 shadow-sm ml-auto inline-flex items-center gap-1.5 transition-all"
                          >
                            {downloadingId === worker.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <FileText className="h-3.5 w-3.5" />
                            )}
                            PDF Report
                          </Button>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-250 font-bold text-[9px] uppercase tracking-wider rounded-lg px-2.5 py-0.5">
                            Not Onboarded
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
