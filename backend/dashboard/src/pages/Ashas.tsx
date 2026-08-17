import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPhone } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import {
  Search,
  RefreshCw,
  Eye,
  Plus,
  FileSpreadsheet,
  Camera,
  Loader2,
  Trash2,
  CheckCircle,
  MoreVertical,
  Edit,
  Trash,
  UserCheck,
  Building,
  UserPlus
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface WorkerOverviewRow {
  id: number | null;
  name: string;
  name_hi: string;
  asha_id: string;
  village: string;
  phone_number: string;
  is_active: boolean;
  onboarded_at: string | null;
  onboarding_status: "joined" | "sms_sent" | "not_contacted";
  last_sync_at: string | null;
  sync_status: "today" | "recent" | "stale" | "never";
  total_households: number;
  total_patients: number;
  surveys_this_month: number;
  high_risk_count: number;
  pending_followups: number;
  estimated_households: number;
}

interface WorkerDetailData {
  id: number;
  name: string;
  asha_id: string;
  phone_number: string;
  village: string;
  block: string;
  district: string;
  estimated_households: number;
  total_households: number;
  total_patients: number;
  surveys_last_30_days: number;
  recent_surveys: {
    id: number;
    patient_name: string;
    survey_type: string;
    submitted_at: string;
    score: number;
  }[];
  incentives: {
    id: number;
    activity: string;
    amount: number;
    status: string;
    created_at: string;
  }[];
}

interface ExtractedWorker {
  name: string;
  phone: string;
  asha_id: string;
  village: string;
  estimated_households: number;
  confidence: string;
}

export function Ashas() {
  const toast = useToast();
  const [workers, setWorkers] = useState<WorkerOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<WorkerDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modals state
  const [manualOpen, setManualOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deactivateId, setDeactivateId] = useState<number | null>(null);

  // Manual Form State
  const [manualForm, setManualForm] = useState({
    name: "",
    name_hi: "",
    asha_id: "",
    phone_number: "",
    village: "",
    estimated_households: 200,
  });
  const [submittingManual, setSubmittingManual] = useState(false);

  // Edit Form State
  const [editForm, setEditForm] = useState({
    id: 0,
    name: "",
    phone_number: "",
    village: "",
    estimated_households: 200,
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Import State (CSV / OCR)
  const [importTab, setImportTab] = useState<"csv" | "ocr">("csv");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [ocrImage, setOcrImage] = useState<File | null>(null);
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [extractedWorkers, setExtractedWorkers] = useState<ExtractedWorker[]>([]);
  const [autofillVillage, setAutofillVillage] = useState("");
  const [importingWorkers, setImportingWorkers] = useState(false);

  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>("/api/anm/workers-overview/");
      setWorkers(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load ASHA workers");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  const loadWorkerDetail = async (id: number) => {
    setDetailLoading(true);
    setDetailId(id);
    try {
      const data = await api.get<any>(`/api/anm/workers/${id}/detail/`);
      setDetailData(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load details");
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingManual(true);
    try {
      await api.post<any>("/api/anm/workers/", manualForm);
      toast.success(`Successfully onboarded ASHA worker ${manualForm.name}`);
      setManualOpen(false);
      setManualForm({
        name: "",
        name_hi: "",
        asha_id: "",
        phone_number: "",
        village: "",
        estimated_households: 200,
      });
      fetchWorkers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error onboarding worker");
    } finally {
      setSubmittingManual(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingEdit(true);
    try {
      await api.patch<any>(`/api/anm/workers/${editForm.id}/`, editForm);
      toast.success("Successfully updated worker information");
      setEditOpen(false);
      fetchWorkers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error updating details");
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    try {
      await api.delete<void>(`/api/anm/workers/${deactivateId}/deactivate/`);
      toast.success("Successfully deactivated ASHA worker account");
      setDeactivateId(null);
      fetchWorkers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error deactivating account");
    }
  };

  const handleResendSMS = async (id: number) => {
    try {
      await api.post<void>(`/api/anm/workers/${id}/resend-sms/`);
      toast.success("Onboarding invitation SMS queued successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error dispatching invite");
    }
  };

  // CSV Parsing helper (Local preview)
  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = text.split("\n").map(r => r.split(","));
      // Assume header row exists: asha_id, name, name_hi, phone, village
      const parsed = rows.slice(1, 6).filter(row => row.length >= 2).map(row => ({
        asha_id: row[0]?.replace(/"/g, "") || "",
        name: row[1]?.replace(/"/g, "") || "",
        phone: row[3]?.replace(/"/g, "") || "",
        village: row[4]?.replace(/"/g, "") || "",
      }));
      setCsvPreview(parsed);
    };
    reader.readAsText(file);
  };

  const handleCsvImport = async () => {
    if (!csvFile) return;
    setImportingWorkers(true);
    const formData = new FormData();
    formData.append("file", csvFile);

    try {
      const result = await api.post<any>("/api/anm/workers/bulk-import/", formData);
      toast.success(`CSV Import Complete: Created ${result.created || 0}, Updated ${result.updated || 0} workers`);
      setImportOpen(false);
      setCsvFile(null);
      setCsvPreview([]);
      fetchWorkers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "CSV Import failed");
    } finally {
      setImportingWorkers(false);
    }
  };

  // OCR Roster Image Scan
  const handleOcrImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrImage(file);
    setOcrPreviewUrl(URL.createObjectURL(file));
  };

  const runOcrExtract = async () => {
    if (!ocrImage) return;
    setOcrLoading(true);
    setExtractedWorkers([]);
    const formData = new FormData();
    formData.append("image", ocrImage);

    try {
      const data = await api.post<any>("/api/anm/workers/ocr-extract/", formData);
      const rows: ExtractedWorker[] = data.extracted.map((item: any) => ({
        name: item.name || "",
        phone: item.phone || "",
        asha_id: "",
        village: "",
        estimated_households: 200,
        confidence: item.confidence || "low",
      }));
      setExtractedWorkers(rows);
      toast.success(`OCR Scan complete: Identified ${rows.length} rows`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "OCR scanning failed. Try a sharper image.");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleApplyOcrVillage = () => {
    setExtractedWorkers(prev =>
      prev.map(w => ({
        ...w,
        village: w.village ? w.village : autofillVillage,
      }))
    );
    toast.success(`Applied village "${autofillVillage}" to empty fields`);
  };

  const handleOcrImport = async () => {
    const incomplete = extractedWorkers.some(w => !w.name || !w.phone || !w.village);
    if (incomplete) {
      toast.error("Please fill in Name, Phone, and Village for all workers before importing.");
      return;
    }
    setImportingWorkers(true);
    try {
      const result = await api.post<any>("/api/anm/workers/bulk-import/", { workers: extractedWorkers });
      toast.success(`OCR Import Complete: Onboarded ${result.created || 0} ASHA workers`);
      setImportOpen(false);
      setExtractedWorkers([]);
      setOcrImage(null);
      setOcrPreviewUrl(null);
      fetchWorkers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Importing OCR scanned list failed");
    } finally {
      setImportingWorkers(false);
    }
  };

  const filteredWorkers = workers.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.asha_id.toLowerCase().includes(search.toLowerCase()) ||
    w.village.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">ASHA Directory</h1>
          <p className="text-xs text-slate-500 font-medium">Manage assignments, track offline database sync frequency, and review performance registers</p>
        </div>

        <div className="flex gap-2.5">
          <Button
            variant="outline"
            className="flex items-center gap-1.5 rounded-xl border-slate-200 text-slate-600 font-semibold text-xs shadow-sm hover:bg-slate-50"
            onClick={() => {
              setImportTab("csv");
              setImportOpen(true);
            }}
          >
            <FileSpreadsheet className="h-4 w-4 text-slate-400" />
            Import CSV
          </Button>

          <Button
            className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-1.5 rounded-xl font-semibold text-xs shadow-sm"
            onClick={() => setManualOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Onboard ASHA
          </Button>

          <Button variant="ghost" size="icon" onClick={fetchWorkers} className="h-9 w-9 rounded-xl border border-slate-200 shadow-sm text-slate-500 hover:text-slate-900 bg-white">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick Statistics KPI Row */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="rounded-2xl border border-slate-100 shadow-premium bg-white">
          <CardContent className="p-5 flex flex-col justify-between h-24">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Registers</span>
            <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{workers.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-slate-100 shadow-premium bg-white">
          <CardContent className="p-5 flex flex-col justify-between h-24">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active App Users</span>
            <p className="text-3xl font-extrabold text-teal-700 tracking-tight">
              {workers.filter(w => w.is_active && w.onboarding_status === "joined").length}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-slate-100 shadow-premium bg-white">
          <CardContent className="p-5 flex flex-col justify-between h-24">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-rose-500">High Risk HRP</span>
            <p className="text-3xl font-extrabold text-rose-600 tracking-tight">
              {workers.reduce((sum, w) => sum + w.high_risk_count, 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-slate-100 shadow-premium bg-white">
          <CardContent className="p-5 flex flex-col justify-between h-24">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monthly Surveys</span>
            <p className="text-3xl font-extrabold text-indigo-700 tracking-tight">
              {workers.reduce((sum, w) => sum + w.surveys_this_month, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by name, ID, or village..."
          className="pl-9 rounded-xl border-slate-200 shadow-sm bg-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ASHA Workers Grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Card key={idx} className="rounded-2xl border border-slate-100 shadow-premium">
              <CardContent className="p-6 space-y-4">
                <div className="flex gap-4 items-center">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredWorkers.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2 border-slate-200 rounded-2xl bg-white shadow-premium">
          <CardContent className="p-6 flex flex-col items-center">
            <UserPlus className="h-12 w-12 text-slate-300 mb-3" />
            <p className="text-slate-700 font-bold text-sm">No ASHA workers found</p>
            <p className="text-xs text-slate-400 mt-1 mb-5 max-w-xs">Onboard ASHA workers to monitor villages and survey registers.</p>
            <div className="flex gap-3">
              <Button size="sm" className="rounded-xl" onClick={() => setManualOpen(true)}>Manual Entry</Button>
              <Button size="sm" variant="outline" className="rounded-xl border-slate-200" onClick={() => { setImportTab("ocr"); setImportOpen(true); }}>Scan Roster Photo</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {filteredWorkers.map((worker) => {
            const registeredProgress = worker.estimated_households > 0
              ? Math.min(100, Math.round((worker.total_households / worker.estimated_households) * 100))
              : 0;

            const syncColors = {
              today: "bg-emerald-50 text-emerald-700 border-emerald-100",
              recent: "bg-amber-50 text-amber-700 border-amber-100",
              stale: "bg-rose-50 text-rose-700 border-rose-100",
              never: "bg-slate-50 text-slate-500 border-slate-200"
            };

            const syncLabels = {
              today: "Synced: Today",
              recent: "Synced: 1-2 days",
              stale: "Synced: 3+ days ago",
              never: "Never Synced"
            };

            return (
              <Card key={worker.phone_number} className="overflow-hidden border border-slate-100 bg-white rounded-2xl shadow-premium hover:shadow-premium-hover hover:-translate-y-0.5 transition-all duration-300">
                <CardContent className="p-6 space-y-4">
                  {/* Top Row: Worker profile & Sync indicator */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-11 w-11 border border-slate-100 shadow-sm">
                        <AvatarFallback className="bg-gradient-to-br from-teal-500 to-teal-700 text-white text-sm font-extrabold">
                          {(worker.name?.[0] || "?").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span className="tracking-tight text-sm md:text-base">{worker.name}</span>
                          {worker.name_hi && (
                            <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 font-normal font-hindi">
                              {worker.name_hi}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-semibold text-slate-400 mt-0.5 flex items-center gap-1">
                          ID: <span className="font-mono text-slate-650">{worker.asha_id}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <Badge variant="outline" className={`${syncColors[worker.sync_status]} border font-semibold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-lg`}>
                        {syncLabels[worker.sync_status]}
                      </Badge>
                    </div>
                  </div>

                  {/* Onboarding Pill Banner */}
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      {worker.onboarding_status === "joined" && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold">
                          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          App Joined · ऐप से जुड़े
                        </div>
                      )}
                      {worker.onboarding_status === "sms_sent" && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-800 font-semibold">
                          <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                          SMS Invite Sent · आमंत्रित
                        </div>
                      )}
                      {worker.onboarding_status === "not_contacted" && (
                        <div className="flex items-center gap-1.5 text-xs text-rose-800 font-semibold">
                          <span className="flex h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                          Not Onboarded · अभी सूचित नहीं
                        </div>
                      )}
                    </div>

                    {worker.onboarding_status !== "joined" && (
                      <Button
                        size="sm"
                        variant="link"
                        className="p-0 text-xs font-bold text-teal-700 hover:text-teal-900 h-auto"
                        onClick={() => handleResendSMS(worker.id || 0)}
                      >
                        {worker.onboarding_status === "sms_sent" ? "Resend SMS" : "Send SMS Invite"}
                      </Button>
                    )}
                  </div>

                  {/* Progress bar: Households */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium text-slate-500">
                      <span>Households Registered</span>
                      <span className="font-bold text-slate-800">{worker.total_households} / {worker.estimated_households} ({registeredProgress}%)</span>
                    </div>
                    <div className="w-full bg-slate-100/80 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-teal-500 to-teal-750 h-full rounded-full transition-all duration-500"
                        style={{ width: `${registeredProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Bottom Stats */}
                  <div className="grid grid-cols-3 gap-2 p-3 text-center bg-slate-50/30 rounded-xl text-xs font-medium text-slate-500 border border-slate-100/50">
                    <div className="border-r border-slate-150">
                      <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Surveys</span>
                      <span className="text-slate-800 font-bold text-sm block mt-0.5">{worker.surveys_this_month}</span>
                    </div>
                    <div className="border-r border-slate-150">
                      <span className="text-[9px] text-rose-500 block uppercase font-bold tracking-wider">High Risk</span>
                      <span className="text-rose-600 font-bold text-sm block mt-0.5">{worker.high_risk_count}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Pending</span>
                      <span className="text-slate-800 font-bold text-sm block mt-0.5">{worker.pending_followups}</span>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                      <Building className="h-3.5 w-3.5 text-slate-400" />
                      Village: <strong className="text-slate-800 font-semibold">{worker.village}</strong>
                    </span>

                    <div className="flex gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditForm({
                            id: worker.id || 0,
                            name: worker.name,
                            phone_number: worker.phone_number,
                            village: worker.village,
                            estimated_households: worker.estimated_households,
                          });
                          setEditOpen(true);
                        }}
                        className="h-8 w-8 text-slate-550 hover:bg-slate-50 hover:text-slate-900 rounded-lg p-0"
                        title="Edit Worker"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeactivateId(worker.id)}
                        className="h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-lg p-0"
                        title="Deactivate Worker"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                      {worker.onboarding_status === "joined" && worker.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadWorkerDetail(worker.id!)}
                          className="h-8 text-teal-700 border-teal-200 hover:bg-teal-50 hover:border-teal-300 font-bold text-xs rounded-xl px-3 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Review Details
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Manual Worker Add Dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Onboard ASHA Worker</DialogTitle>
            <DialogDescription>
              Create a new registry and trigger onboarding credentials invite SMS.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="man-name">Full Name (English) *</Label>
                <Input
                  id="man-name"
                  value={manualForm.name}
                  onChange={(e) => setManualForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="man-name-hi">Hindi Name (Optional)</Label>
                <Input
                  id="man-name-hi"
                  value={manualForm.name_hi}
                  onChange={(e) => setManualForm(f => ({ ...f, name_hi: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="man-id">ASHA ID (Unique) *</Label>
                <Input
                  id="man-id"
                  placeholder="e.g. AS-WB-2847"
                  value={manualForm.asha_id}
                  onChange={(e) => setManualForm(f => ({ ...f, asha_id: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="man-phone">Phone Number (10 digits) *</Label>
                <Input
                  id="man-phone"
                  placeholder="9876543210"
                  value={manualForm.phone_number}
                  onChange={(e) => setManualForm(f => ({ ...f, phone_number: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="man-village">Assigned Village *</Label>
                <Input
                  id="man-village"
                  value={manualForm.village}
                  onChange={(e) => setManualForm(f => ({ ...f, village: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="man-est">Estimated Households *</Label>
                <Input
                  id="man-est"
                  type="number"
                  value={manualForm.estimated_households}
                  onChange={(e) => setManualForm(f => ({ ...f, estimated_households: parseInt(e.target.value) || 200 }))}
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" type="button" onClick={() => setManualOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-teal-700 hover:bg-teal-800 text-white" disabled={submittingManual}>
                {submittingManual && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Onboard ASHA
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Worker Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit ASHA Worker details</DialogTitle>
            <DialogDescription>Update the worker's geographical assignment and records estimation.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name *</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone Number *</Label>
              <Input
                id="edit-phone"
                value={editForm.phone_number}
                onChange={(e) => setEditForm(f => ({ ...f, phone_number: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-village">Village *</Label>
                <Input
                  id="edit-village"
                  value={editForm.village}
                  onChange={(e) => setEditForm(f => ({ ...f, village: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-est">Estimated Households *</Label>
                <Input
                  id="edit-est"
                  type="number"
                  value={editForm.estimated_households}
                  onChange={(e) => setEditForm(f => ({ ...f, estimated_households: parseInt(e.target.value) || 200 }))}
                  required
                />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button variant="outline" type="button" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-teal-700 hover:bg-teal-800 text-white" disabled={submittingEdit}>
                {submittingEdit && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deactivate Worker Confirm */}
      <Dialog open={deactivateId !== null} onOpenChange={() => setDeactivateId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate ASHA Worker</DialogTitle>
            <DialogDescription>
              Are you sure? This will disable this ASHA worker's login sessions. Their registered households data will be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeactivate}>Deactivate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detailed View Modal */}
      <Dialog open={detailId !== null} onOpenChange={() => { setDetailId(null); setDetailData(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailLoading ? (
            <div className="p-12 space-y-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-teal-700" />
              <p className="text-slate-500 text-xs">Loading historical log...</p>
            </div>
          ) : detailData ? (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="text-xl">{detailData.name}</DialogTitle>
                <DialogDescription>
                  ASHA ID: <strong className="font-mono">{detailData.asha_id}</strong> | Phone: {formatPhone(detailData.phone_number)}
                </DialogDescription>
              </DialogHeader>

              {/* Geographic Scope */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg text-xs font-semibold text-slate-600 border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Subcenter Village</span>
                  <span className="text-slate-800 font-bold">{detailData.village}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Reporting Block</span>
                  <span className="text-slate-800 font-bold">{detailData.block}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">District</span>
                  <span className="text-slate-800 font-bold">{detailData.district}</span>
                </div>
              </div>

              {/* Summary KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Registered</span>
                    <span className="text-2xl font-bold text-teal-700">{detailData.total_households}</span>
                    <span className="text-[9px] text-slate-400 block">est. {detailData.estimated_households}</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Total Patients</span>
                    <span className="text-2xl font-bold text-slate-800">{detailData.total_patients}</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Surveys (30 Days)</span>
                    <span className="text-2xl font-bold text-indigo-600">{detailData.surveys_last_30_days}</span>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Survey Log */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-2">Recent Health Surveys</h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                  <Table className="bg-white">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient Name</TableHead>
                        <TableHead>Survey Type</TableHead>
                        <TableHead>Submitted At</TableHead>
                        <TableHead className="text-right">Risk Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailData.recent_surveys.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-slate-400 py-4">No surveys filed recently</TableCell>
                        </TableRow>
                      ) : (
                        detailData.recent_surveys.map(s => (
                          <TableRow key={s.id}>
                            <TableCell className="font-semibold text-slate-900">{s.patient_name}</TableCell>
                            <TableCell className="uppercase text-slate-500">{s.survey_type}</TableCell>
                            <TableCell className="text-slate-400">{new Date(s.submitted_at).toLocaleDateString("en-IN")}</TableCell>
                            <TableCell className="text-right font-bold">
                              <Badge className={`${s.score >= 5 ? "bg-red-500" : s.score >= 2 ? "bg-amber-500" : "bg-emerald-500"} text-white border-none`}>
                                {s.score}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Incentives Approved ledger list */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-2">Activity Incentives Ledger</h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                  <Table className="bg-white">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Activity</TableHead>
                        <TableHead>Logged At</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Incentive</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailData.incentives.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-slate-400 py-4">No incentives registered in ledger</TableCell>
                        </TableRow>
                      ) : (
                        detailData.incentives.map(inc => (
                          <TableRow key={inc.id}>
                            <TableCell className="font-semibold text-slate-800">{inc.activity}</TableCell>
                            <TableCell className="text-slate-400">{new Date(inc.created_at).toLocaleDateString("en-IN")}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  inc.status === "paid"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : inc.status === "approved"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-slate-100 text-slate-500 border-slate-200"
                                }
                              >
                                {inc.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold text-teal-700">Rs {inc.amount}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* CSV / OCR Image Scanning Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import ASHA Workers Registry</DialogTitle>
            <DialogDescription>
              Register multiple ASHA workers in bulk using a CSV file or scan roster logs via OCR photo text recognition.
            </DialogDescription>
          </DialogHeader>

          {/* Modal custom tabs selector */}
          <div className="flex border-b border-slate-200 mb-4">
            <button
              className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-all ${
                importTab === "csv" ? "border-teal-700 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
              onClick={() => setImportTab("csv")}
            >
              CSV Sheet Upload
            </button>
            <button
              className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-all ${
                importTab === "ocr" ? "border-teal-700 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
              onClick={() => setImportTab("ocr")}
            >
              Scan Roster Image (OCR)
            </button>
          </div>

          {importTab === "csv" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-150">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-800">ASHA-Soft CSV Template</span>
                  <p className="text-xs text-slate-500">Includes columns: asha_id, asha_name, asha_name_hi, mobile_number, village, block, district</p>
                </div>
                <a
                  href="/static/asha_import_template.csv"
                  download
                  className="bg-white border text-slate-700 hover:bg-slate-50 text-xs px-3 py-2 rounded font-semibold transition"
                >
                  Download Template
                </a>
              </div>

              <div className="space-y-2">
                <Label htmlFor="csv-picker">Select CSV File</Label>
                <Input
                  id="csv-picker"
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={handleCsvChange}
                />
              </div>

              {csvPreview.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700">Preview (First 5 records):</span>
                  <div className="border border-slate-200 rounded-md overflow-hidden text-xs">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ASHA ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Village</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvPreview.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-semibold text-slate-850">{row.asha_id}</TableCell>
                            <TableCell>{row.name}</TableCell>
                            <TableCell>{row.phone}</TableCell>
                            <TableCell>{row.village}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <DialogFooter className="pt-2 border-t border-slate-100">
                <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
                <Button
                  className="bg-teal-700 hover:bg-teal-800 text-white"
                  onClick={handleCsvImport}
                  disabled={!csvFile || importingWorkers}
                >
                  {importingWorkers && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Import Workers
                </Button>
              </DialogFooter>
            </div>
          )}

          {importTab === "ocr" && (
            <div className="space-y-4">
              <div className="p-3 bg-indigo-50 border border-indigo-150 rounded-lg text-indigo-700 text-xs flex gap-2">
                <Camera className="h-5 w-5 flex-shrink-0" />
                <div>
                  <strong>OCR Photo Scan:</strong> Photograph a printed register, Excel roster on monitor, or WhatsApp group list screenshot. The service automatically extracts names and phone numbers.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Roster Photo File</Label>
                  <div className="border-2 border-dashed border-slate-250 rounded-lg p-6 text-center hover:bg-slate-50 transition cursor-pointer relative">
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={handleOcrImageChange}
                    />
                    <Camera className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <span className="text-xs text-slate-500 font-semibold block">Click to upload photo</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Supports PNG, JPG (Max 10MB)</span>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center min-h-[140px] max-h-[160px]">
                  {ocrPreviewUrl ? (
                    <img src={ocrPreviewUrl} alt="Scan preview" className="object-contain max-h-full" />
                  ) : (
                    <span className="text-xs text-slate-450 italic">No image selected</span>
                  )}
                </div>
              </div>

              {ocrImage && extractedWorkers.length === 0 && (
                <Button
                  className="w-full bg-indigo-700 hover:bg-indigo-850 text-white"
                  onClick={runOcrExtract}
                  disabled={ocrLoading}
                >
                  {ocrLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Reading roster text with OCR (Hindi & English)...
                    </>
                  ) : (
                    "Run OCR Extraction Scan"
                  )}
                </Button>
              )}

              {extractedWorkers.length > 0 && (
                <div className="space-y-3">
                  <div className="flex gap-2 items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <Input
                      placeholder="Autofill village..."
                      className="max-w-[200px] h-8 text-xs"
                      value={autofillVillage}
                      onChange={(e) => setAutofillVillage(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-semibold"
                      onClick={handleApplyOcrVillage}
                    >
                      Autofill Village for Empty Rows
                    </Button>
                  </div>

                  <div className="border border-slate-200 rounded-md overflow-hidden text-xs max-h-[250px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-slate-50 sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="w-8">#</TableHead>
                          <TableHead>Extracted Name *</TableHead>
                          <TableHead>Extracted Phone *</TableHead>
                          <TableHead>ASHA ID *</TableHead>
                          <TableHead>Village Assignment *</TableHead>
                          <TableHead className="text-right w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {extractedWorkers.map((w, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-slate-400 font-semibold">{idx + 1}</TableCell>
                            <TableCell>
                              <Input
                                value={w.name}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setExtractedWorkers(prev => prev.map((item, i) => i === idx ? { ...item, name: val } : item));
                                }}
                                className="h-8 text-xs font-semibold"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={w.phone}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setExtractedWorkers(prev => prev.map((item, i) => i === idx ? { ...item, phone: val } : item));
                                }}
                                className="h-8 text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                placeholder="ASHA ID"
                                value={w.asha_id}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setExtractedWorkers(prev => prev.map((item, i) => i === idx ? { ...item, asha_id: val } : item));
                                }}
                                className="h-8 text-xs font-mono"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                placeholder="Village"
                                value={w.village}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setExtractedWorkers(prev => prev.map((item, i) => i === idx ? { ...item, village: val } : item));
                                }}
                                className="h-8 text-xs"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-rose-500"
                                onClick={() => setExtractedWorkers(prev => prev.filter((_, i) => i !== idx))}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>* Review and fill in all mandatory village names before importing.</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExtractedWorkers(prev => [...prev, { name: "", phone: "", asha_id: "", village: "", estimated_households: 200, confidence: "high" }])}
                      className="text-teal-700 hover:text-teal-900 font-semibold"
                    >
                      + Add Manual Row
                    </Button>
                  </div>
                </div>
              )}

              <DialogFooter className="pt-2 border-t border-slate-100">
                <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
                <Button
                  className="bg-indigo-700 hover:bg-indigo-800 text-white"
                  onClick={handleOcrImport}
                  disabled={extractedWorkers.length === 0 || importingWorkers}
                >
                  {importingWorkers && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Import Reviewed Workers
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
