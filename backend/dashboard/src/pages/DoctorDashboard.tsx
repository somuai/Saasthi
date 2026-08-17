import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api, ForbiddenError } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, Calendar, Clock, ExternalLink, FileText, Heart,
  AlertCircle, CheckCircle, Video, User, MapPin, RefreshCw,
  Search, ShieldAlert, Users, ArrowUpRight, Timer,
} from "lucide-react";

interface Referral {
  id: number;
  local_uuid: string;
  patient: number;
  flag: number | null;
  destination: string;
  reason: string;
  status: string;
  assigned_doctor: number | null;
  teleconsultation_scheduled_at: string | null;
  teleconsultation_jitsi_link: string | null;
  doctor_notes: string;
  metadata: any;
  created_at: string;
  updated_at: string;
  patient_name: string;
  patient_age: number | null;
  patient_gender: string;
  patient_village: string;
  patient_phone: string;
  patient_pregnancy_status: boolean;
  patient_is_high_risk: boolean;
}

const AUTO_REFRESH_MS = 30000;

export function DoctorDashboard() {
  const { user } = useAuth();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"immediate" | "today" | "week" | "done">("immediate");

  const [doctorNotes, setDoctorNotes] = useState("");
  const [prescription, setPrescription] = useState("");
  const [recommendedAction, setRecommendedAction] = useState("telemedicine");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const loadQueue = useCallback(async () => {
    setRefreshing(true);
    setAccessDenied(false);
    setError(null);
    try {
      const data = await api.get<Referral[]>("/api/v1/referrals/doctor-queue/");
      setReferrals(data || []);
    } catch (err) {
      if (err instanceof ForbiddenError) {
        setAccessDenied(true);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load clinical queue");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(loadQueue, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadQueue]);

  useEffect(() => {
    if (selectedReferral) {
      setDoctorNotes(selectedReferral.doctor_notes || "");
      setPrescription(selectedReferral.metadata?.prescription || "");
      setRecommendedAction(selectedReferral.metadata?.recommended_action || "telemedicine");
      setSuccessMsg("");
    }
  }, [selectedReferral]);

  // Stats
  const activeCases = referrals.filter((r) => r.status !== "completed" && r.status !== "cancelled").length;
  const urgentCases = referrals.filter(
    (r) => r.status !== "completed" && r.status !== "cancelled" && r.patient_is_high_risk
  ).length;
  const todayTeleconsults = referrals.filter((r) => {
    if (r.status === "completed" || r.status === "cancelled" || !r.teleconsultation_scheduled_at) return false;
    const d = new Date(r.teleconsultation_scheduled_at);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const completedThisWeek = referrals.filter((r) => {
    if (r.status !== "completed") return false;
    const d = new Date(r.updated_at);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  }).length;

  // Filtering
  const filteredReferrals = referrals.filter((ref) => {
    const term = searchTerm.toLowerCase();
    if (!ref.patient_name?.toLowerCase().includes(term) &&
        !ref.reason?.toLowerCase().includes(term) &&
        !ref.patient_village?.toLowerCase().includes(term)) return false;

    const scheduledDate = ref.teleconsultation_scheduled_at ? new Date(ref.teleconsultation_scheduled_at) : null;
    const now = new Date();
    const isToday = scheduledDate && scheduledDate.getDate() === now.getDate() &&
      scheduledDate.getMonth() === now.getMonth() && scheduledDate.getFullYear() === now.getFullYear();
    const isThisWeek = scheduledDate && scheduledDate >= now &&
      scheduledDate <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (activeTab === "done") return ref.status === "completed";
    if (ref.status === "completed" || ref.status === "cancelled") return false;
    if (activeTab === "immediate") return ref.patient_is_high_risk || !scheduledDate;
    if (activeTab === "today") return !!isToday;
    if (activeTab === "week") return !!isThisWeek;
    return true;
  });

  async function handleRespond(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReferral) return;
    setSubmitting(true);
    try {
      const updated = await api.post<Referral>(
        `/api/v1/referrals/${selectedReferral.id}/doctor-respond/`,
        { doctor_notes: doctorNotes, prescription, recommended_action: recommendedAction }
      );
      setSuccessMsg("Clinical response submitted successfully!");
      setReferrals((prev) => prev.map((r) => (r.id === selectedReferral.id ? { ...r, ...updated } : r)));
      setSelectedReferral(updated);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      if (err instanceof ForbiddenError) {
        setError("Your role does not have permission to submit clinical responses.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to submit response");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (accessDenied) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md shadow-premium border-slate-200/60 rounded-2xl bg-white">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
              <ShieldAlert className="h-7 w-7 text-amber-600" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">Access Restricted</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              The Doctor Consultation Desk is available to referral partners and administrators.
              Your current role (<span className="font-bold capitalize">{user?.role || "unknown"}</span>) does not have permission.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4">
        <Skeleton className="h-12 w-1/3 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[500px] lg:col-span-1 rounded-xl" />
          <Skeleton className="h-[500px] lg:col-span-2 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 md:p-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Doctor Consultation Desk
          </h1>
          <p className="text-base text-slate-500 font-medium mt-1 flex items-center gap-2">
            <Timer className="h-4 w-4 text-slate-400" />
            Auto-refreshes every 30s
          </p>
        </div>
        <Button
          onClick={loadQueue}
          disabled={refreshing}
          variant="outline"
          className="text-sm h-11 font-bold text-slate-600 hover:text-teal-700 rounded-xl transition-all border-slate-200 bg-white shadow-sm px-5"
        >
          <RefreshCw className={`h-4.5 w-4.5 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh Queue"}
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-sm font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-600 font-bold">✕</button>
        </div>
      )}

      {/* Summary Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-slate-200/60 rounded-xl bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-slate-900">{activeCases}</div>
              <div className="text-xs font-medium text-slate-500">Active Cases</div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200/60 rounded-xl bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
              <AlertCircle className="h-5 w-5 text-rose-500" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-slate-900">{urgentCases}</div>
              <div className="text-xs font-medium text-slate-500">Urgent Cases</div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200/60 rounded-xl bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-slate-900">{todayTeleconsults}</div>
              <div className="text-xs font-medium text-slate-500">Today's Teleconsults</div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200/60 rounded-xl bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-slate-900">{completedThisWeek}</div>
              <div className="text-xs font-medium text-slate-500">Completed This Week</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: Patient Queue */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="shadow-premium border-slate-200/60 rounded-2xl overflow-hidden bg-white">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Activity className="h-5 w-5 text-teal-650" /> Patient Queue
              </CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by name, village..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-10 border-slate-200 rounded-xl text-sm"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Tabs */}
              <div className="grid grid-cols-4 text-center border-b border-slate-100 bg-slate-50/30 text-xs font-semibold text-slate-500">
                {(["immediate", "today", "week", "done"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-3 transition-all flex flex-col items-center gap-1 ${
                      activeTab === tab
                        ? tab === "immediate"
                          ? "text-rose-600 border-b-2 border-rose-500 bg-rose-50/20 font-bold"
                          : "text-teal-700 border-b-2 border-teal-650 bg-teal-50/20 font-bold"
                        : "hover:bg-slate-100/50"
                    }`}
                  >
                    <span className="capitalize">{tab === "done" ? "Completed" : tab}</span>
                  </button>
                ))}
              </div>

              {/* Referral list */}
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {filteredReferrals.length === 0 ? (
                  <div className="p-10 text-center">
                    <div className="mx-auto w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-3">
                      <Users className="h-6 w-6 text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-400 font-medium">
                      {searchTerm
                        ? "No referrals match your search."
                        : activeTab === "done"
                          ? "No completed referrals yet."
                          : activeTab === "immediate"
                            ? "No urgent referrals. All clear!"
                            : `No referrals scheduled for ${activeTab === "today" ? "today" : "this week"}.`}
                    </p>
                  </div>
                ) : (
                  filteredReferrals.map((ref) => {
                    const isSelected = selectedReferral?.id === ref.id;
                    return (
                      <div
                        key={ref.id}
                        onClick={() => setSelectedReferral(ref)}
                        className={`p-4 transition-all duration-200 cursor-pointer ${
                          isSelected ? "bg-teal-50/40 border-l-4 border-teal-600" : "hover:bg-slate-50/50"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-slate-800 text-base">{ref.patient_name}</h4>
                          {ref.patient_is_high_risk && (
                            <Badge variant="destructive" className="text-[10px] uppercase font-bold tracking-wider">HRP</Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 space-y-1">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            {ref.patient_village || "Unknown"}
                          </div>
                          {ref.teleconsultation_scheduled_at && (
                            <div className="flex items-center gap-1 text-teal-600 font-medium">
                              <Calendar className="h-3 w-3" />
                              {new Date(ref.teleconsultation_scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Count footer */}
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/30 text-[10px] font-semibold text-slate-400 flex justify-between">
                <span>{filteredReferrals.length} shown</span>
                <span>{referrals.length} total</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Clinical Workspace */}
        <div className="lg:col-span-2 space-y-6">
          {selectedReferral ? (
            <div className="space-y-6 animate-fade-in">
              {/* Patient Header */}
              <Card className="shadow-premium border-slate-200/60 rounded-2xl overflow-hidden bg-white">
                <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-xl font-extrabold text-slate-800">
                        {selectedReferral.patient_name}
                      </CardTitle>
                      {selectedReferral.patient_is_high_risk && (
                        <Badge variant="destructive" className="text-[10px] uppercase font-bold">High Risk Pregnancy</Badge>
                      )}
                      {selectedReferral.patient_pregnancy_status && (
                        <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] font-bold">Pregnant</Badge>
                      )}
                    </div>
                    <CardDescription className="text-sm font-medium mt-0.5">
                      {selectedReferral.patient_age ? `${selectedReferral.patient_age} yrs` : "Age N/A"} •{" "}
                      <span className="capitalize">{selectedReferral.patient_gender}</span>
                      {selectedReferral.patient_phone && ` • ${selectedReferral.patient_phone}`}
                    </CardDescription>
                  </div>
                  {selectedReferral.status !== "completed" && selectedReferral.teleconsultation_jitsi_link && (
                    <Button
                      onClick={() => window.open(selectedReferral.teleconsultation_jitsi_link!, "_blank")}
                      className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-11 px-5 shadow-sm font-bold"
                    >
                      <Video className="h-4.5 w-4.5 mr-2" />
                      Join Teleconsultation
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* Metadata grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm font-medium">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-400 text-xs block mb-0.5">Village</span>
                      <span className="text-slate-800 text-base font-bold">{selectedReferral.patient_village || "N/A"}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-400 text-xs block mb-0.5">Referral Status</span>
                      <Badge className={`mt-0.5 font-bold ${
                        selectedReferral.status === "completed"
                          ? "bg-teal-100 text-teal-800 hover:bg-teal-100 border-none"
                          : "bg-amber-100 text-amber-800 hover:bg-amber-100 border-none"
                      }`}>
                        {selectedReferral.status}
                      </Badge>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-400 text-xs block mb-0.5">Destination</span>
                      <span className="text-slate-800 text-base font-bold capitalize">{selectedReferral.destination || "N/A"}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-400 text-xs block mb-0.5">Created</span>
                      <span className="text-slate-800 text-base font-bold">
                        {new Date(selectedReferral.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* ASHA Referral Reason */}
                  <div className="p-4 bg-amber-50/40 border border-amber-100/50 rounded-xl">
                    <h5 className="font-extrabold text-slate-800 text-sm mb-1.5 flex items-center gap-2">
                      <AlertCircle className="h-4.5 w-4.5 text-amber-500" /> ASHA Referral Reason
                    </h5>
                    <p className="text-slate-650 text-sm leading-relaxed font-medium">
                      {selectedReferral.reason || "No referral notes entered by field worker."}
                    </p>
                  </div>

                  {/* MedGemma AI */}
                  {selectedReferral.metadata?.gemma_analysis && (
                    <div className="p-4 bg-teal-50/20 border border-teal-100/50 rounded-xl space-y-2">
                      <h5 className="font-extrabold text-teal-800 text-sm flex items-center gap-2">
                        <Activity className="h-4.5 w-4.5 text-teal-600 animate-pulse" /> MedGemma AI Pre-Analysis
                      </h5>
                      <p className="text-slate-650 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                        {selectedReferral.metadata.gemma_analysis}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Clinical Assessment Form */}
              <Card className="shadow-premium border-slate-200/60 rounded-2xl overflow-hidden bg-white">
                <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/30">
                  <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-teal-650" /> Clinical Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {selectedReferral.status === "completed" ? (
                    <div className="space-y-6 text-sm font-medium">
                      <div className="p-4 bg-teal-50/30 border border-teal-100/50 rounded-xl flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-teal-650 shrink-0 mt-0.5" />
                        <div>
                          <h6 className="font-bold text-teal-800 text-base">Referral Resolved</h6>
                          <p className="text-slate-500 text-xs mt-0.5">Consultation submitted and sent back to ASHA.</p>
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs block mb-1">Clinical Notes</span>
                        <p className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 whitespace-pre-wrap leading-relaxed">
                          {selectedReferral.doctor_notes || "No notes."}
                        </p>
                      </div>
                      {selectedReferral.metadata?.prescription && (
                        <div>
                          <span className="text-slate-400 text-xs block mb-1">Prescription</span>
                          <p className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 whitespace-pre-wrap font-mono leading-relaxed">
                            {selectedReferral.metadata.prescription}
                          </p>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-400 text-xs block mb-1">Care Path</span>
                        <Badge className="bg-teal-50 text-teal-800 hover:bg-teal-50 capitalize font-bold">
                          {selectedReferral.metadata?.recommended_action || "telemedicine"}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleRespond} className="space-y-5">
                      {successMsg && (
                        <div className="p-3 bg-teal-100 text-teal-850 font-semibold rounded-xl text-sm border border-teal-200">
                          {successMsg}
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-sm font-extrabold text-slate-700">Clinical Notes</label>
                        <textarea
                          required
                          placeholder="Clinical findings, symptoms evaluated, diagnostic conclusions..."
                          value={doctorNotes}
                          onChange={(e) => setDoctorNotes(e.target.value)}
                          className="flex min-h-[120px] w-full rounded-xl border border-slate-200 bg-background px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-extrabold text-slate-700">Prescription</label>
                        <textarea
                          placeholder="Medicines, dosage, duration..."
                          value={prescription}
                          onChange={(e) => setPrescription(e.target.value)}
                          className="flex min-h-[90px] font-mono w-full rounded-xl border border-slate-200 bg-background px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-extrabold text-slate-700">Recommended Action</label>
                        <select
                          value={recommendedAction}
                          onChange={(e) => setRecommendedAction(e.target.value)}
                          className="w-full h-11 border border-slate-200 rounded-xl text-sm px-3 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                        >
                          <option value="telemedicine">Monitor via Telemedicine</option>
                          <option value="phc_visit">Refer to PHC</option>
                          <option value="hospitalize">Immediate Referral to CHC / District Hospital</option>
                          <option value="monitor">Routine ASHA Follow-up</option>
                        </select>
                      </div>

                      <Button
                        type="submit"
                        disabled={submitting}
                        className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl h-11 px-6 shadow-sm font-bold w-full"
                      >
                        {submitting ? "Submitting..." : "Submit Clinical Report"}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="h-[400px] flex items-center justify-center border border-dashed border-slate-200 rounded-2xl bg-white/50 text-slate-400 font-semibold p-6 text-center">
              <div>
                <ArrowUpRight className="h-8 w-8 mx-auto mb-3 text-slate-300" />
                <p>Select a patient from the queue to begin clinical evaluation.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}