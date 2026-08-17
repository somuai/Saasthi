import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchPatient,
  fetchPatientMCP,
  type PatientData,
  type MCPData,
  type ANCVisitData,
  type GrowthRecordData,
  type SurveyResponseData,
} from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, formatDateTime, formatPhone } from "@/lib/utils";
import {
  ArrowLeft,
  Heart,
  Baby,
  Syringe,
  TrendingUp,
  ClipboardList,
  Activity,
  Calendar,
  User,
  MapPin,
  Phone,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ── Helpers ──────────────────────────────────────────────────────────

function formatLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function val(v: unknown, suffix = ""): string {
  if (v === null || v === undefined || v === "") return "—";
  return `${v}${suffix}`;
}

function boolBadge(v: boolean | null | undefined, trueLabel = "Yes", falseLabel = "No") {
  if (v === null || v === undefined) return <span className="text-slate-400">—</span>;
  return v ? (
    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold uppercase tracking-wider rounded-lg px-2 py-0.5">
      {trueLabel}
    </Badge>
  ) : (
    <span className="text-slate-500 text-xs">{falseLabel}</span>
  );
}

const immunizationStatusBadge: Record<string, { bg: string; icon: typeof CheckCircle2 }> = {
  given: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  due: { bg: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  overdue: { bg: "bg-rose-50 text-rose-700 border-rose-200", icon: AlertTriangle },
  missed: { bg: "bg-slate-100 text-slate-500 border-slate-200", icon: XCircle },
};

const nutritionStatusBadge: Record<string, string> = {
  normal: "bg-emerald-50 text-emerald-700 border-emerald-200",
  underweight: "bg-amber-50 text-amber-700 border-amber-200",
  severely_underweight: "bg-rose-50 text-rose-700 border-rose-200",
  wasted: "bg-orange-50 text-orange-700 border-orange-200",
  severely_wasted: "bg-rose-50 text-rose-700 border-rose-200",
  stunted: "bg-purple-50 text-purple-700 border-purple-200",
  severely_stunted: "bg-rose-50 text-rose-700 border-rose-200",
  overweight: "bg-blue-50 text-blue-700 border-blue-200",
};

// ── Stat Card (efferd-inspired) ─────────────────────────────────────

function StatCard({ label, value, icon: Icon, accent = "text-slate-600" }: {
  label: string;
  value: string | number;
  icon: typeof Heart;
  accent?: string;
}) {
  return (
    <Card className="shadow-none border-slate-100">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`flex items-center justify-center w-9 h-9 rounded-lg bg-slate-50 ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500 font-medium truncate">{label}</p>
          <p className="text-lg font-semibold text-slate-900 tabular-nums leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Field Row ───────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
      <span className="text-[11px] text-slate-500 font-medium">{label}</span>
      <span className="text-xs font-semibold text-slate-800 text-right">{children}</span>
    </div>
  );
}

// ── Empty State ─────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, subtitle }: {
  icon: typeof Heart;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mb-3">
        <Icon className="h-5 w-5 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="text-xs text-slate-400 mt-1 max-w-[280px]">{subtitle}</p>
    </div>
  );
}

// ── ANC Visit Card ──────────────────────────────────────────────────

function ANCVisitCard({ visit }: { visit: ANCVisitData }) {
  return (
    <Card className="shadow-none border-slate-100 hover:border-slate-200 transition-colors">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-teal-50 text-teal-600 text-xs font-bold">
            {visit.visit_number}
          </div>
          <div>
            <CardTitle className="text-xs font-bold text-slate-800">ANC Visit #{visit.visit_number}</CardTitle>
            <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(visit.visit_date)}</p>
          </div>
        </div>
        {visit.is_high_risk && (
          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[9px] font-bold uppercase tracking-wider rounded-lg px-2 py-0.5">
            <AlertTriangle className="h-3 w-3 mr-1" /> High Risk
          </Badge>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
          <FieldRow label="POG (weeks)">{val(visit.pog_weeks, "w")}</FieldRow>
          <FieldRow label="Weight">{val(visit.weight_kg, " kg")}</FieldRow>
          <FieldRow label="BP">{visit.bp_systolic && visit.bp_diastolic ? `${visit.bp_systolic}/${visit.bp_diastolic}` : "—"}</FieldRow>
          <FieldRow label="Pulse">{val(visit.pulse_rate, " bpm")}</FieldRow>
          <FieldRow label="Hb">{val(visit.hemoglobin_gms, " g/dL")}</FieldRow>
          <FieldRow label="Urine Albumin">{val(visit.urine_albumin)}</FieldRow>
          <FieldRow label="Urine Sugar">{val(visit.urine_sugar)}</FieldRow>
          <FieldRow label="Fundal Height">{val(visit.fundal_height_cm, " cm")}</FieldRow>
          <FieldRow label="FHR">{val(visit.fetal_heart_rate, " bpm")}</FieldRow>
          <FieldRow label="Fetal Movements">{val(visit.fetal_movements)}</FieldRow>
          <FieldRow label="TT Injection">{boolBadge(visit.tt_injection_given, "Given", "Not given")}</FieldRow>
          <FieldRow label="IFA Tablets">{val(visit.ifa_tablets_given)}</FieldRow>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Growth Chart ────────────────────────────────────────────────────

function GrowthChart({ records }: { records: GrowthRecordData[] }) {
  const chartData = records.map(r => ({
    age: r.age_completed_months,
    weight: r.weight_kg,
    height: r.height_cm,
    label: `${r.age_completed_months}mo`,
  }));

  if (chartData.length < 2) return null;

  return (
    <Card className="shadow-none border-slate-100 mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold text-slate-700">Weight Progression</CardTitle>
        <p className="text-[10px] text-slate-400">Weight (kg) plotted against age in months</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickMargin={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickMargin={8}
              width={36}
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
              formatter={(value: number) => [`${value} kg`, "Weight"]}
            />
            <Line
              type="monotone"
              dataKey="weight"
              stroke="#0d9488"
              strokeWidth={2}
              dot={{ fill: "#0d9488", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [mcp, setMcp] = useState<MCPData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [activeSurvey, setActiveSurvey] = useState<SurveyResponseData | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchPatient(Number(id))
      .then((data) => {
        setPatient(data);
        setMcpLoading(true);
        return fetchPatientMCP(Number(id));
      })
      .then(setMcp)
      .catch((err) => {
        if (!patient) toast.error(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        setLoading(false);
        setMcpLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Patient not found</p>
        <Button variant="outline" className="mt-3 rounded-xl" onClick={() => navigate("/patients")}>
          Back to patients
        </Button>
      </div>
    );
  }

  const totalMCPRecords = mcp
    ? mcp.anc_visits.length + mcp.pnc_visits.length + mcp.growth_records.length +
      mcp.immunizations.length + mcp.milestones.length + mcp.deliveries.length
    : 0;

  const vaccinesGiven = mcp ? mcp.immunizations.filter(i => i.status === "given").length : 0;
  const vaccinesDue = mcp ? mcp.immunizations.filter(i => i.status === "due" || i.status === "overdue").length : 0;

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/patients")} className="rounded-xl border border-slate-200 shadow-sm h-9 w-9 bg-white text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{patient.full_name}</h1>
            {patient.name_hi && (
              <span className="text-xs text-slate-400 font-normal">({patient.name_hi})</span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            ID: {patient.local_uuid?.slice(0, 8) || patient.id} · {patient.village}{patient.block ? `, ${patient.block}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {patient.is_high_risk_pregnancy && (
            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[9px] font-bold uppercase tracking-wider rounded-lg px-2 py-0.5">
              <AlertTriangle className="h-3 w-3 mr-1" />High Risk
            </Badge>
          )}
          <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-wider rounded-lg px-2.5 py-0.5 ${
            patient.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"
          }`}>
            {patient.status}
          </Badge>
        </div>
      </div>

      {/* ── Quick Stats (efferd stat card pattern) ────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="ANC Visits"
          value={mcp?.anc_visits.length ?? patient.anc_visit_count ?? 0}
          icon={Heart}
          accent="text-teal-600"
        />
        <StatCard
          label="Vaccines Given"
          value={vaccinesGiven}
          icon={Syringe}
          accent="text-blue-600"
        />
        <StatCard
          label="Vaccines Due"
          value={vaccinesDue}
          icon={Clock}
          accent={vaccinesDue > 0 ? "text-amber-600" : "text-emerald-600"}
        />
        <StatCard
          label="Total Records"
          value={totalMCPRecords}
          icon={FileText}
          accent="text-slate-600"
        />
      </div>

      {/* ── Tabbed Clinical Panel ─────────────────────────────── */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full flex overflow-x-auto bg-slate-50 rounded-xl p-1 gap-0.5">
          <TabsTrigger value="overview" className="flex-1 min-w-0 rounded-lg text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <User className="h-3.5 w-3.5 mr-1.5 hidden sm:inline-block" />Overview
          </TabsTrigger>
          <TabsTrigger value="anc" className="flex-1 min-w-0 rounded-lg text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Heart className="h-3.5 w-3.5 mr-1.5 hidden sm:inline-block" />ANC
            {mcp && mcp.anc_visits.length > 0 && (
              <span className="ml-1 text-[9px] bg-teal-100 text-teal-700 rounded-full px-1.5 py-0.5 font-bold tabular-nums">{mcp.anc_visits.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pnc" className="flex-1 min-w-0 rounded-lg text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Baby className="h-3.5 w-3.5 mr-1.5 hidden sm:inline-block" />PNC
            {mcp && mcp.pnc_visits.length > 0 && (
              <span className="ml-1 text-[9px] bg-purple-100 text-purple-700 rounded-full px-1.5 py-0.5 font-bold tabular-nums">{mcp.pnc_visits.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="growth" className="flex-1 min-w-0 rounded-lg text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <TrendingUp className="h-3.5 w-3.5 mr-1.5 hidden sm:inline-block" />Growth
          </TabsTrigger>
          <TabsTrigger value="immunization" className="flex-1 min-w-0 rounded-lg text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Syringe className="h-3.5 w-3.5 mr-1.5 hidden sm:inline-block" />Vaccines
          </TabsTrigger>
          <TabsTrigger value="milestones" className="flex-1 min-w-0 rounded-lg text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <ClipboardList className="h-3.5 w-3.5 mr-1.5 hidden sm:inline-block" />Milestones
          </TabsTrigger>
          <TabsTrigger value="surveys" className="flex-1 min-w-0 rounded-lg text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <ClipboardList className="h-3.5 w-3.5 mr-1.5 hidden sm:inline-block" />Surveys
            {mcp && mcp.survey_responses && mcp.survey_responses.length > 0 && (
              <span className="ml-1 text-[9px] bg-indigo-100 text-indigo-700 rounded-full px-1.5 py-0.5 font-bold tabular-nums">{mcp.survey_responses.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW TAB ──────────────────────────────────────── */}
        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
            {/* Personal Information */}
            <Card className="shadow-none border-slate-100">
              <CardHeader className="pb-2 border-b border-slate-50">
                <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" />Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-0">
                <FieldRow label="Full Name">{patient.full_name}</FieldRow>
                <FieldRow label="Gender">{val(patient.gender)}</FieldRow>
                <FieldRow label="Date of Birth">{patient.date_of_birth ? formatDate(patient.date_of_birth) : "—"}</FieldRow>
                <FieldRow label="Phone"><span className="flex items-center gap-1"><Phone className="h-3 w-3 text-slate-400" />{formatPhone(patient.phone) || "—"}</span></FieldRow>
                <FieldRow label="Household">{val(patient.household_code)}</FieldRow>
              </CardContent>
            </Card>

            {/* Location */}
            <Card className="shadow-none border-slate-100">
              <CardHeader className="pb-2 border-b border-slate-50">
                <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />Location
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-0">
                <FieldRow label="Village">{val(patient.village)}</FieldRow>
                <FieldRow label="Block">{val(patient.block)}</FieldRow>
                <FieldRow label="District">{val(patient.district)}</FieldRow>
                <FieldRow label="Region">{val(patient.region)}</FieldRow>
                <FieldRow label="ASHA Worker">{val(patient.asha_worker_name)}</FieldRow>
              </CardContent>
            </Card>

            {/* Household & Family Structure */}
            {patient.household_details && (
              <Card className="shadow-none border-slate-100 md:col-span-2 lg:col-span-2">
                <CardHeader className="pb-2 border-b border-slate-50">
                  <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-slate-400" />Household & Family Structure
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
                    <FieldRow label="Household Code">
                      <span className="font-bold text-slate-800">{val(patient.household_details.household_code)}</span>
                    </FieldRow>
                    <FieldRow label="Head of Family">{val(patient.household_details.head_name)}</FieldRow>
                    <FieldRow label="Members Count">{val(patient.household_details.member_count)}</FieldRow>
                    <FieldRow label="Village">{val(patient.household_details.village)}</FieldRow>
                    <FieldRow label="Location">
                      {patient.household_details.lat && patient.household_details.lng ? (
                        <span className="font-mono text-[10px]">{patient.household_details.lat.toFixed(4)}, {patient.household_details.lng.toFixed(4)}</span>
                      ) : "—"}
                    </FieldRow>
                    <FieldRow label="Relationship to Head">{val(patient.relationship_to_head)}</FieldRow>
                  </div>

                  {patient.household_members && patient.household_members.length > 0 && (
                    <div className="space-y-2 mt-2 pt-2 border-t border-slate-50">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Other Family Members</p>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-slate-50/50">
                            <TableRow className="hover:bg-transparent h-8">
                              <TableHead className="font-bold text-slate-700 text-[10px] py-1">Name</TableHead>
                              <TableHead className="font-bold text-slate-700 text-[10px] py-1">Relationship</TableHead>
                              <TableHead className="font-bold text-slate-700 text-[10px] py-1">Gender</TableHead>
                              <TableHead className="font-bold text-slate-700 text-[10px] py-1">Condition</TableHead>
                              <TableHead className="w-16 py-1"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {patient.household_members.map((m) => (
                              <TableRow key={m.id} className="hover:bg-slate-50/40 transition-colors h-9">
                                <TableCell className="text-xs font-semibold text-slate-750 py-1">{m.full_name}</TableCell>
                                <TableCell className="text-xs text-slate-500 py-1">{val(m.relationship_to_head)}</TableCell>
                                <TableCell className="text-xs text-slate-500 py-1 capitalize">{val(m.gender)}</TableCell>
                                <TableCell className="py-1">
                                  {m.pregnancy_status ? (
                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-250 font-bold text-[8px] uppercase tracking-wider rounded-lg px-1.5 py-0.5">
                                      Pregnant
                                    </Badge>
                                  ) : (
                                    <span className="text-slate-400 text-xs">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="py-1 text-right">
                                  <Button
                                    variant="link"
                                    className="text-teal-700 hover:text-teal-800 text-[10px] p-0 h-auto font-bold"
                                    onClick={() => navigate(`/patients/${m.id}`)}
                                  >
                                    View Profile
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Pregnancy Card */}
            {patient.pregnancy_status && (
              <Card className="shadow-none border-slate-100 md:col-span-2 lg:col-span-1">
                <CardHeader className="pb-2 border-b border-slate-50">
                  <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Heart className="h-3.5 w-3.5 text-rose-400" />Pregnancy Card
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3 space-y-0">
                  <FieldRow label="LMP Date">{patient.lmp_date ? formatDate(patient.lmp_date) : "—"}</FieldRow>
                  <FieldRow label="EDD">{patient.edd ? (
                    <span className="font-bold text-teal-700">{formatDate(patient.edd)}</span>
                  ) : "—"}</FieldRow>
                  <FieldRow label="Gravida / Para">{`G${val(patient.gravida)} P${val(patient.para)} A${val(patient.abortions)}`}</FieldRow>
                  <FieldRow label="Blood Group">
                    <span className="font-bold">{val(patient.blood_group)} {val(patient.rh_typing)}</span>
                  </FieldRow>
                  <FieldRow label="MCP Card">{boolBadge(patient.mcp_card_issued, "Issued", "Not issued")}</FieldRow>
                  <FieldRow label="MCTS/RCH ID">{val(patient.mcts_rch_id)}</FieldRow>
                  <FieldRow label="High Risk">{boolBadge(patient.is_high_risk_pregnancy, "Yes — HRP", "No")}</FieldRow>
                </CardContent>
              </Card>
            )}

            {/* Medical History */}
            <Card className="shadow-none border-slate-100">
              <CardHeader className="pb-2 border-b border-slate-50">
                <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-slate-400" />Medical History
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-0">
                <FieldRow label="Diabetes">{boolBadge(patient.diabetes)}</FieldRow>
                <FieldRow label="Hypertension">{boolBadge(patient.hypertension)}</FieldRow>
                <FieldRow label="TB History">{boolBadge(patient.tb_history)}</FieldRow>
                <FieldRow label="Last Delivery">{patient.last_delivery_date ? formatDate(patient.last_delivery_date) : "—"}</FieldRow>
                <FieldRow label="Last Delivery Place">{val(patient.last_delivery_place)}</FieldRow>
              </CardContent>
            </Card>

            {/* Delivery Record (if available) */}
            {mcp && mcp.deliveries.length > 0 && (
              <Card className="shadow-none border-slate-100 md:col-span-2 lg:col-span-2">
                <CardHeader className="pb-2 border-b border-slate-50">
                  <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Baby className="h-3.5 w-3.5 text-purple-400" />Delivery Record
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3">
                  {mcp.deliveries.map((d) => (
                    <div key={d.id} className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
                      <FieldRow label="Date">{formatDate(d.delivery_date)}</FieldRow>
                      <FieldRow label="Place">{val(d.delivery_place)}</FieldRow>
                      <FieldRow label="Type">{val(d.delivery_type)}</FieldRow>
                      <FieldRow label="Outcome">{val(d.delivery_outcome)}</FieldRow>
                      <FieldRow label="Baby Sex">{val(d.baby_sex)}</FieldRow>
                      <FieldRow label="Birth Weight">{d.birth_weight_kg ? `${d.birth_weight_kg} kg` : val(d.birth_weight_grams, "g")}</FieldRow>
                      <FieldRow label="Cried Immediately">{boolBadge(d.baby_cried_immediately)}</FieldRow>
                      <FieldRow label="Breastfed < 1hr">{boolBadge(d.breastfeed_within_1hr)}</FieldRow>
                      <FieldRow label="JSY Registered">{boolBadge(d.jsy_registered)}</FieldRow>
                      <FieldRow label="PMMVY Registered">{boolBadge(d.pmmvy_registered)}</FieldRow>
                      {d.complications && <FieldRow label="Complications"><span className="text-rose-600">{d.complications}</span></FieldRow>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Timestamps */}
            <Card className="shadow-none border-slate-100">
              <CardHeader className="pb-2 border-b border-slate-50">
                <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />Timestamps
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-0">
                <FieldRow label="Created">{formatDateTime(patient.created_at)}</FieldRow>
                <FieldRow label="Last Updated">{formatDateTime(patient.updated_at)}</FieldRow>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── ANC VISITS TAB ────────────────────────────────────── */}
        <TabsContent value="anc">
          <div className="mt-4 space-y-3">
            {mcpLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
              </div>
            ) : !mcp || mcp.anc_visits.length === 0 ? (
              <EmptyState
                icon={Heart}
                title="No ANC visits recorded"
                subtitle="Antenatal care visit records from the ASHA worker's mobile app will appear here once synced."
              />
            ) : (
              mcp.anc_visits.map((visit) => (
                <ANCVisitCard key={visit.id} visit={visit} />
              ))
            )}
          </div>
        </TabsContent>

        {/* ── PNC VISITS TAB ────────────────────────────────────── */}
        <TabsContent value="pnc">
          <div className="mt-4 space-y-3">
            {mcpLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
              </div>
            ) : !mcp || mcp.pnc_visits.length === 0 ? (
              <EmptyState
                icon={Baby}
                title="No PNC visits recorded"
                subtitle="Postnatal care visits for both mother and newborn will be displayed here after syncing."
              />
            ) : (
              mcp.pnc_visits.map((visit) => (
                <Card key={visit.id} className="shadow-none border-slate-100 hover:border-slate-200 transition-colors">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[9px] font-bold uppercase tracking-wider rounded-lg px-2 py-0.5">
                        {visit.visit_timing}
                      </Badge>
                      <p className="text-[10px] text-slate-400">{formatDate(visit.visit_date)}</p>
                    </div>
                    {visit.is_extra_visit && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-[9px] font-bold uppercase tracking-wider rounded-lg px-2 py-0.5">Extra</Badge>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Mother */}
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mother</p>
                        <FieldRow label="BP">{visit.mother_bp_sys && visit.mother_bp_dia ? `${visit.mother_bp_sys}/${visit.mother_bp_dia}` : "—"}</FieldRow>
                        <FieldRow label="Pulse">{val(visit.mother_pulse, " bpm")}</FieldRow>
                        <FieldRow label="Temp">{val(visit.mother_temp_f, " °F")}</FieldRow>
                        <FieldRow label="Pallor">{val(visit.mother_pallor)}</FieldRow>
                        <FieldRow label="Bleeding PV">{val(visit.bleeding_pv)}</FieldRow>
                        <FieldRow label="Uterus Tenderness">{val(visit.uterus_tenderness)}</FieldRow>
                        <FieldRow label="Family Planning Counselled">{boolBadge(visit.family_planning_counselled)}</FieldRow>
                      </div>
                      {/* Baby */}
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Newborn</p>
                        <FieldRow label="Weight">{val(visit.baby_weight_kg, " kg")}</FieldRow>
                        <FieldRow label="Activity">{val(visit.baby_activity)}</FieldRow>
                        <FieldRow label="Sucking">{val(visit.baby_sucking)}</FieldRow>
                        <FieldRow label="Breathing">{val(visit.baby_breathing)}</FieldRow>
                        <FieldRow label="Temp">{val(visit.baby_temp_f, " °F")}</FieldRow>
                        <FieldRow label="Jaundice">{boolBadge(visit.baby_jaundice, "Present", "No")}</FieldRow>
                        <FieldRow label="Diarrhoea">{boolBadge(visit.baby_diarrhoea, "Yes", "No")}</FieldRow>
                        <FieldRow label="Convulsions">{boolBadge(visit.baby_convulsions, "Yes", "No")}</FieldRow>
                      </div>
                    </div>
                    {visit.mother_complaints && (
                      <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-100">
                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-0.5">Complaints</p>
                        <p className="text-xs text-amber-800">{visit.mother_complaints}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* ── GROWTH TAB ────────────────────────────────────────── */}
        <TabsContent value="growth">
          <div className="mt-4">
            {mcpLoading ? (
              <Skeleton className="h-64 rounded-xl" />
            ) : !mcp || mcp.growth_records.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="No growth records"
                subtitle="Child weight, height, and MUAC measurements with WHO Z-score classifications will appear here."
              />
            ) : (
              <>
                <GrowthChart records={mcp.growth_records} />
                <Card className="shadow-none border-slate-100 overflow-hidden">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-50/50">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="font-bold text-slate-700 text-[10px]">Date</TableHead>
                            <TableHead className="font-bold text-slate-700 text-[10px]">Age (mo)</TableHead>
                            <TableHead className="font-bold text-slate-700 text-[10px]">Weight</TableHead>
                            <TableHead className="font-bold text-slate-700 text-[10px]">Height</TableHead>
                            <TableHead className="font-bold text-slate-700 text-[10px]">MUAC</TableHead>
                            <TableHead className="font-bold text-slate-700 text-[10px]">WFA-Z</TableHead>
                            <TableHead className="font-bold text-slate-700 text-[10px]">HFA-Z</TableHead>
                            <TableHead className="font-bold text-slate-700 text-[10px]">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mcp.growth_records.map((r) => (
                            <TableRow key={r.id} className="hover:bg-slate-50/40 transition-colors">
                              <TableCell className="text-xs font-medium text-slate-700">{formatDate(r.recorded_date)}</TableCell>
                              <TableCell className="text-xs tabular-nums text-slate-600">{r.age_completed_months}</TableCell>
                              <TableCell className="text-xs tabular-nums font-semibold text-slate-800">{r.weight_kg} kg</TableCell>
                              <TableCell className="text-xs tabular-nums text-slate-600">{r.height_cm ? `${r.height_cm} cm` : "—"}</TableCell>
                              <TableCell className="text-xs tabular-nums text-slate-600">{r.muac_cm ? `${r.muac_cm} cm` : "—"}</TableCell>
                              <TableCell className="text-xs tabular-nums text-slate-600">{r.wfa_z_score?.toFixed(1) ?? "—"}</TableCell>
                              <TableCell className="text-xs tabular-nums text-slate-600">{r.hfa_z_score?.toFixed(1) ?? "—"}</TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] font-bold uppercase tracking-wider rounded-lg px-2 py-0.5 ${
                                    nutritionStatusBadge[r.nutritional_status] || "bg-slate-50 text-slate-500 border-slate-200"
                                  }`}
                                >
                                  {r.nutritional_status.replace(/_/g, " ")}
                                </Badge>
                                {r.is_faltering && (
                                  <Badge variant="outline" className="ml-1 bg-red-50 text-red-600 border-red-200 text-[9px] font-bold uppercase tracking-wider rounded-lg px-2 py-0.5">
                                    <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />Faltering
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TabsContent>

        {/* ── IMMUNIZATION TAB ──────────────────────────────────── */}
        <TabsContent value="immunization">
          <div className="mt-4">
            {mcpLoading ? (
              <Skeleton className="h-64 rounded-xl" />
            ) : !mcp || mcp.immunizations.length === 0 ? (
              <EmptyState
                icon={Syringe}
                title="No immunization records"
                subtitle="Vaccination schedules and administration records from the national immunization programme will appear here."
              />
            ) : (
              <Card className="shadow-none border-slate-100 overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="font-bold text-slate-700 text-[10px]">Vaccine</TableHead>
                          <TableHead className="font-bold text-slate-700 text-[10px]">Dose</TableHead>
                          <TableHead className="font-bold text-slate-700 text-[10px]">Scheduled</TableHead>
                          <TableHead className="font-bold text-slate-700 text-[10px]">Administered</TableHead>
                          <TableHead className="font-bold text-slate-700 text-[10px]">Status</TableHead>
                          <TableHead className="font-bold text-slate-700 text-[10px]">Facility</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mcp.immunizations.map((imm) => {
                          const statusStyle = immunizationStatusBadge[imm.status] || immunizationStatusBadge.due;
                          const StatusIcon = statusStyle.icon;
                          return (
                            <TableRow key={imm.id} className="hover:bg-slate-50/40 transition-colors h-12">
                              <TableCell className="font-bold text-slate-800 text-xs">{imm.vaccine_name}</TableCell>
                              <TableCell className="text-xs tabular-nums text-slate-600">#{imm.dose_number}</TableCell>
                              <TableCell className="text-xs text-slate-500 font-medium">{formatDate(imm.scheduled_date)}</TableCell>
                              <TableCell className="text-xs text-slate-700 font-semibold">{imm.administered_date ? formatDate(imm.administered_date) : "—"}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`${statusStyle.bg} text-[9px] font-bold uppercase tracking-wider rounded-lg px-2 py-0.5 inline-flex items-center gap-1`}>
                                  <StatusIcon className="h-3 w-3" />{imm.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-slate-500">{imm.administered_at || "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── MILESTONES TAB ────────────────────────────────────── */}
        <TabsContent value="milestones">
          <div className="mt-4 space-y-3">
            {mcpLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            ) : !mcp || mcp.milestones.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No milestone checks"
                subtitle="Child developmental milestone assessments (motor, social, language, cognitive) will appear here once recorded."
              />
            ) : (
              mcp.milestones.map((ms) => {
                const achieved = Object.entries(ms.milestones_achieved || {}).filter(([, v]) => v);
                const warnings = Object.entries(ms.warning_signs || {}).filter(([, v]) => v);
                return (
                  <Card key={ms.id} className="shadow-none border-slate-100 hover:border-slate-200 transition-colors">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-bold">
                          {ms.age_at_check_months}mo
                        </div>
                        <div>
                          <CardTitle className="text-xs font-bold text-slate-800">
                            {ms.age_at_check_months} Month Assessment
                          </CardTitle>
                          <p className="text-[10px] text-slate-400">{formatDate(ms.check_date)}</p>
                        </div>
                      </div>
                      {ms.any_warning_sign && (
                        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[9px] font-bold uppercase tracking-wider rounded-lg px-2 py-0.5">
                          <AlertTriangle className="h-3 w-3 mr-1" />Warning Signs
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      {achieved.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Milestones Achieved</p>
                          <div className="flex flex-wrap gap-1">
                            {achieved.map(([key]) => (
                              <Badge key={key} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-semibold rounded-lg px-2 py-0.5">
                                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />{key.replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {warnings.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-1">Warning Signs</p>
                          <div className="flex flex-wrap gap-1">
                            {warnings.map(([key]) => (
                              <Badge key={key} variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[9px] font-semibold rounded-lg px-2 py-0.5">
                                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />{key.replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {ms.referred_to && (
                        <div className="p-2 rounded-lg bg-amber-50 border border-amber-100">
                          <p className="text-[10px] font-bold text-amber-700">Referred to: <span className="font-semibold text-amber-800">{ms.referred_to}</span></p>
                        </div>
                      )}
                      {ms.developmental_concern && (
                        <p className="text-xs text-slate-600"><span className="font-bold text-slate-700">Concern:</span> {ms.developmental_concern}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* ── SURVEYS TAB ────────────────────────────────────────── */}
        <TabsContent value="surveys">
          <div className="mt-4 space-y-3">
            {mcpLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            ) : !mcp || !mcp.survey_responses || mcp.survey_responses.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No survey responses"
                subtitle="Survey assessments logged by ASHA workers will appear here."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {mcp.survey_responses.map((s) => {
                  const severity = s.score_snapshot?.severity;
                  const severityStr = typeof severity === "string" ? severity : "normal";
                  const score = s.score_snapshot?.score;
                  const scoreStr = (typeof score === "number" || typeof score === "string") ? String(score) : "";
                  return (
                    <Card key={s.id} className="shadow-none border-slate-100 hover:border-slate-200 transition-colors flex flex-col justify-between">
                      <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <div>
                          <CardTitle className="text-xs font-bold text-slate-800">
                            {formatLabel(s.survey_type)}
                          </CardTitle>
                          <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(s.submitted_at)}</p>
                        </div>
                        {scoreStr && (
                          <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-wider rounded-lg px-2 py-0.5 ${
                            severityStr === "high" || severityStr === "critical"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : severityStr === "medium"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}>
                            Score: {scoreStr}
                          </Badge>
                        )}
                      </CardHeader>
                      <CardContent className="pt-0 pb-3 flex-1 flex flex-col justify-between">
                        <p className="text-xs text-slate-500 mb-4">
                          {Object.keys(s.answers || {}).length} questions answered.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-[10px] h-7 font-bold rounded-lg"
                          onClick={() => setActiveSurvey(s)}
                        >
                          Inspect Answers
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Survey Details Dialog ────────────────────────────── */}
      <Dialog open={activeSurvey !== null} onOpenChange={(open) => !open && setActiveSurvey(null)}>
        <DialogContent className="max-w-lg rounded-xl max-h-[85vh] overflow-y-auto font-sans">
          {activeSurvey && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle className="text-sm font-bold text-slate-900">
                    {formatLabel(activeSurvey.survey_type)} Details
                  </DialogTitle>
                  {typeof activeSurvey.score_snapshot?.severity === "string" ? (
                    <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-wider rounded-lg px-2 py-0.5 ${
                      activeSurvey.score_snapshot.severity === "high" || activeSurvey.score_snapshot.severity === "critical"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : activeSurvey.score_snapshot.severity === "medium"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}>
                      {activeSurvey.score_snapshot.severity} risk
                    </Badge>
                  ) : null}
                </div>
                <DialogDescription className="text-[10px] text-slate-400">
                  Submitted at {formatDateTime(activeSurvey.submitted_at)}
                </DialogDescription>
              </DialogHeader>

              {activeSurvey.photo_base64 && (
                <div className="my-3 border border-slate-100 rounded-xl overflow-hidden aspect-video bg-slate-50 flex items-center justify-center">
                  <img
                    src={`data:image/jpeg;base64,${activeSurvey.photo_base64}`}
                    alt="Survey Attachment"
                    className="object-contain max-h-full max-w-full"
                  />
                </div>
              )}

              <div className="space-y-1 py-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Answers</p>
                <div className="divide-y divide-slate-50">
                  {Object.entries(activeSurvey.answers || {}).map(([key, value]) => (
                    <div key={key} className="py-2 flex justify-between gap-4">
                      <span className="text-[10px] text-slate-500 font-medium">{formatLabel(key)}</span>
                      <span className="text-xs font-semibold text-slate-800 text-right">
                        {typeof value === "boolean" ? (
                          value ? "Yes" : "No"
                        ) : typeof value === "object" ? (
                          JSON.stringify(value)
                        ) : (
                          String(value)
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
