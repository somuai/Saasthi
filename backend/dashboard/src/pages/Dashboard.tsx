import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, fetchSummary, fetchActivity, type SummaryData, type ActivityData } from "@/lib/api";
import { formatDateTime, cn } from "@/lib/utils";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import { ChartContainer } from "@/components/ui/chart";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Users,
  Activity,
  Heart,
  AlertCircle,
  Flag,
  ArrowRightLeft,
  Stethoscope,
  UserCheck,
  Locate,
  RefreshCw,
  MapPin,
  Calendar,
  ChevronRight,
  TrendingUp,
  Clock,
  Layers,
  Map
} from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = {
  high: "var(--chart-1)",      // HSL rose-500
  medium: "var(--chart-3)",    // HSL amber-500
  low: "var(--chart-2)",       // HSL emerald-500
  critical: "var(--chart-4)",  // HSL violet-500
};

const STATUS_COLORS: Record<string, string> = {
  open: "#ef4444",
  acknowledged: "#f59e0b",
  resolved: "#10b981",
  dismissed: "#64748b",
  draft: "#94a3b8",
  sent: "#3b82f6",
  accepted: "#6366f1",
  completed: "#10b981",
  cancelled: "#f43f5e",
};

const weeklyData = [
  { name: "Week 1", "Home Visits": 85, "New Registrations": 22 },
  { name: "Week 2", "Home Visits": 105, "New Registrations": 31 },
  { name: "Week 3", "Home Visits": 142, "New Registrations": 28 },
  { name: "Week 4", "Home Visits": 138, "New Registrations": 42 },
  { name: "Week 5", "Home Visits": 190, "New Registrations": 36 },
  { name: "Week 6", "Home Visits": 224, "New Registrations": 54 },
  { name: "Week 7", "Home Visits": 285, "New Registrations": 48 },
];

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-md border border-slate-100 p-3 rounded-xl shadow-premium text-[11px] font-sans">
        <p className="font-bold text-slate-800 mb-1">{label || payload[0].name}</p>
        <div className="space-y-1">
          {payload.map((p: any, idx: number) => (
            <div key={idx} className="flex items-center gap-4 justify-between">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
                {p.name}:
              </span>
              <span className="font-bold text-slate-800 tabular-nums">{p.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

function Progress({ value }: { value: number }) {
  return (
    <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
      <div
        className="bg-teal-600 h-1 rounded-full transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function Dashboard() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [activity, setActivity] = useState<ActivityData[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  async function load() {
    try {
      const [summary, acts, workersData] = await Promise.all([
        fetchSummary(),
        fetchActivity(),
        api.get<any[]>("/api/anm/workers-overview/").catch(() => []),
      ]);
      setData(summary);
      setActivity(acts);
      setWorkers(workersData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (err) => {
          console.log("Geolocation error:", err);
        }
      );
    }
  }, []);

  const centerOnUser = () => {
    if (mapRef.current && userCoords) {
      mapRef.current.setView([userCoords.lat, userCoords.lng], 14);
    }
  };

  useEffect(() => {
    if (loading) return;
    
    const initialCenter: L.LatLngExpression = userCoords ? [userCoords.lat, userCoords.lng] : [22.5726, 88.3639];
    const map = L.map('district-overview-map', { zoomControl: false }).setView(initialCenter, 12);
    mapRef.current = map;
    
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    if (userCoords) {
      const userIconHtml = `
        <div style="
          position: relative;
          width: 16px;
          height: 16px;
          background-color: #3b82f6;
          border: 2px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
        "></div>
      `;
      const userIcon = L.divIcon({
        html: userIconHtml,
        className: 'custom-user-pin',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      
      const userMarker = L.marker([userCoords.lat, userCoords.lng], { icon: userIcon, zIndexOffset: 2000 }).addTo(map);
      userMarker.bindTooltip("<strong>Your Location</strong>", { permanent: false, direction: 'top' });
    }

    const activeCoords = workers
      .filter(w => w.lat && w.lng)
      .map(w => [w.lat, w.lng] as L.LatLngTuple);

    workers.forEach(w => {
      if (w.lat && w.lng) {
        const radius = Math.max(150, Math.min(2000, w.total_households * 8));
        const color = w.high_risk_count > 0 ? "#ef4444" : w.total_households > 0 ? "#f59e0b" : "#10b981";
        
        const circle = L.circle([w.lat, w.lng], {
          color: color,
          fillColor: color,
          fillOpacity: 0.08,
          radius: radius,
          weight: 1.2,
          dashArray: "3, 3"
        }).addTo(map);

        const iconHtml = `
          <div style="
            position: relative;
            width: 20px;
            height: 20px;
            background-color: ${color};
            border: 2px solid #ffffff;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.15);
          ">
            <div style="
              width: 6px;
              height: 6px;
              background-color: #ffffff;
              border-radius: 50%;
            "></div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-asha-pin',
          iconSize: [20, 20],
          iconAnchor: [10, 20]
        });

        const marker = L.marker([w.lat, w.lng], { icon: customIcon }).addTo(map);

        const tooltipContent = `
          <div style="font-family: Inter, sans-serif; font-size: 11px; padding: 4px; line-height: 1.4;">
            <strong style="font-size: 12px; color: #1e293b;">${w.name}</strong> (${w.asha_id})<br/>
            Village: <strong style="color: #475569;">${w.village}</strong><br/>
            Registered: <strong style="color: #0d9488;">${w.total_households} / ${w.estimated_households} households</strong><br/>
            High Risk: <strong style="color: #e11d48;">${w.high_risk_count} patients</strong>
          </div>
        `;

        circle.bindTooltip(tooltipContent, { permanent: false, direction: 'top' });
        marker.bindTooltip(tooltipContent, { permanent: false, direction: 'top' });
      }
    });
    
    if (activeCoords.length > 0) {
      const bounds = L.latLngBounds(activeCoords);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [loading, workers, userCoords]);

  const severityData = useMemo(() => {
    if (!data) return [];
    return data.flags_by_severity.map((s) => ({
      name: s.severity.charAt(0).toUpperCase() + s.severity.slice(1),
      value: s.count,
      color: SEVERITY_COLORS[s.severity] || "#64748b",
    }));
  }, [data]);

  const referralData = useMemo(() => {
    if (!data) return [];
    return data.referrals_by_status.map((r) => ({
      name: r.status.charAt(0).toUpperCase() + r.status.slice(1),
      count: r.count,
      fill: STATUS_COLORS[r.status] || "#64748b",
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in font-sans">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[440px] w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 font-sans">
        <div className="bg-white p-8 rounded-xl border border-slate-100 shadow-premium text-center max-w-sm">
          <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-3" />
          <p className="text-slate-800 font-semibold mb-1">Failed to Load Dashboard</p>
          <p className="text-slate-500 text-xs mb-4">{error}</p>
          <Button onClick={load} size="sm" className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Operations Dashboard</h1>
          <p className="text-sm md:text-base text-slate-500 font-medium mt-1">Maternal and child health analytics & supervisor control center</p>
        </div>
        <Button
          onClick={load}
          variant="outline"
          size="default"
          className="text-sm h-10 font-bold text-slate-600 hover:text-teal-750 rounded-xl transition-all duration-200 border-slate-200 bg-white shadow-sm px-4 shrink-0"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      {/* Stats Cards (Efferd Inspired Premium Layout with enlarged typography) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Patients */}
        <Card className="shadow-none border-slate-200/60 hover:border-slate-300 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="font-semibold text-slate-500 text-xs md:text-sm uppercase tracking-wider">
              Total Beneficiaries
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="font-black text-3xl md:text-4xl text-slate-900 tabular-nums leading-none tracking-tight">{data.total_patients}</p>
            <div className="flex items-center gap-1.5 text-xs md:text-sm mt-1">
              <Delta value={4.2}>
                <DeltaIcon />
                <DeltaValue />
              </Delta>
              <span className="text-slate-400">vs last month</span>
            </div>
          </CardContent>
        </Card>

        {/* Active Pregnancies */}
        <Card className="shadow-none border-slate-200/60 hover:border-slate-300 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="font-semibold text-slate-500 text-xs md:text-sm uppercase tracking-wider">
              Active Pregnancies
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="font-black text-3xl md:text-4xl text-teal-700 tabular-nums leading-none tracking-tight">{data.pregnant}</p>
            <div className="flex items-center gap-1.5 text-xs md:text-sm mt-1">
              <Delta value={1.8}>
                <DeltaIcon />
                <DeltaValue />
              </Delta>
              <span className="text-slate-400">vs last week</span>
            </div>
          </CardContent>
        </Card>

        {/* High Risk Cases */}
        <Card className="shadow-none border-slate-200/60 hover:border-slate-300 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="font-semibold text-slate-500 text-xs md:text-sm uppercase tracking-wider">
              High Risk cases (HRP)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="font-black text-3xl md:text-4xl text-rose-700 tabular-nums leading-none tracking-tight">{data.high_risk}</p>
            <div className="flex items-center gap-1.5 text-xs md:text-sm mt-1">
              <Delta value={-2.4}>
                <DeltaIcon />
                <DeltaValue />
              </Delta>
              <span className="text-slate-400">vs last week</span>
            </div>
          </CardContent>
        </Card>

        {/* Open Flags */}
        <Card className="shadow-none border-slate-200/60 hover:border-slate-300 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="font-semibold text-slate-500 text-xs md:text-sm uppercase tracking-wider">
              Open Risk Flags
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="font-black text-3xl md:text-4xl text-rose-750 tabular-nums leading-none tracking-tight">{data.open_flags}</p>
            <div className="flex items-center gap-1.5 text-xs md:text-sm mt-1">
              <Delta value={-6.8}>
                <DeltaIcon />
                <DeltaValue />
              </Delta>
              <span className="text-slate-400">vs yesterday</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid Section */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Left 3 Cols */}
        <div className="lg:col-span-3 space-y-6">
          {/* Weekly Activity Volume Chart (Efferd Area Style) */}
          <Card className="shadow-none border-slate-200/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base md:text-lg font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-teal-600" />Weekly ASHA Activity Trends
              </CardTitle>
              <CardDescription className="text-xs md:text-sm text-slate-400 font-medium">
                Home visits conducted vs registrations completed, last 7 weeks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer className="h-[250px] w-full" config={{
                "Home Visits": { label: "Home Visits", color: "var(--chart-2)" },
                "New Registrations": { label: "New Registrations", color: "var(--chart-1)" }
              }}>
                <AreaChart
                  data={weeklyData}
                  margin={{ left: -10, right: 10, top: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="visitsGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="regsGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#475569", fontWeight: 500 }}
                    tickMargin={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#475569", fontWeight: 500 }}
                    tickMargin={8}
                    width={36}
                  />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Area
                    dataKey="Home Visits"
                    type="natural"
                    stroke="var(--chart-2)"
                    strokeWidth={2.5}
                    fill="url(#visitsGrad)"
                  />
                  <Area
                    dataKey="New Registrations"
                    type="natural"
                    stroke="var(--chart-1)"
                    strokeWidth={2.5}
                    fill="url(#regsGrad)"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Leaflet Coverage Map */}
          <Card className="shadow-none border-slate-200/60 overflow-hidden">
            <CardHeader className="pb-2 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-teal-600" />
                  <CardTitle className="text-base md:text-lg font-bold text-slate-800">
                    ASHA Health Worker Coverage Map
                  </CardTitle>
                </div>
                {userCoords && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg border border-slate-200 bg-white" onClick={centerOnUser} title="Center on my location">
                    <Locate className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0 relative">
              <div id="district-overview-map" className="h-[360px] w-full z-0" />
              {/* Map Legend Overlay */}
              <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm p-4 rounded-xl border border-slate-200 z-[1000] text-xs space-y-2 shadow-md max-w-[200px]">
                <span className="font-bold text-slate-800 block mb-1 border-b border-slate-100 pb-1 text-sm">Village Risk Alerts</span>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
                  <span className="text-slate-650 font-medium text-xs">High Risk (HRP) Logged</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
                  <span className="text-slate-650 font-medium text-xs">Medium/Low Alerts Only</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
                  <span className="text-slate-650 font-medium text-xs">Normal / Clear</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col */}
        <div className="space-y-6">
          {/* Pie Chart of Flags (Efferd breakdown style) */}
          <Card className="shadow-none border-slate-200/60">
            <CardHeader className="pb-1">
              <CardTitle className="text-base md:text-lg font-bold text-slate-800">
                Risk Status Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              {severityData.length > 0 ? (
                <div className="relative">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={severityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={36}
                        outerRadius={55}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {severityData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Legend below */}
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs mt-3 border-t border-slate-100 pt-3">
                    {severityData.map((d, i) => (
                      <div key={i} className="flex items-center gap-1.5 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-slate-650 font-semibold truncate text-xs">{d.name}:</span>
                        <span className="font-extrabold text-slate-900 text-sm">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[160px] text-sm text-slate-400 font-semibold">
                  No active flags logged
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bar Chart of Referrals (Efferd CSAT style) */}
          <Card className="shadow-none border-slate-200/60">
            <CardHeader className="pb-1">
              <CardTitle className="text-base md:text-lg font-bold text-slate-800">
                Active Referrals Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              {referralData.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={referralData} barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} allowDecimals={false} width={20} />
                    <Tooltip content={<CustomChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                      {referralData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[160px] text-sm text-slate-400 font-semibold">
                  No active referrals
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ASHA Progress & Activity Log Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* ASHA Progress Overview */}
        <Card className="shadow-none border-slate-200/60">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-teal-600" />
              <CardTitle className="text-base md:text-lg font-bold text-slate-800">
                ASHA Workers Registration Progress
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto px-6">
              {workers.length > 0 ? (
                workers.slice(0, 10).map((w, idx) => {
                  const percent = w.estimated_households > 0
                    ? Math.round((w.total_households / w.estimated_households) * 100)
                    : 0;
                  return (
                    <div key={idx} className="py-4 flex flex-col gap-2">
                      <div className="flex justify-between items-center text-sm">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{w.name}</p>
                          <p className="text-xs text-slate-500 font-medium">Village: {w.village}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-slate-800 text-sm">{w.total_households} / {w.estimated_households} HH</p>
                          <p className="text-xs font-extrabold text-teal-700">{percent}%</p>
                        </div>
                      </div>
                      <Progress value={percent} />
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-400 py-8 text-center font-medium">No ASHA workers assigned to this geography</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Live Operations Feed */}
        <Card className="shadow-none border-slate-200/60">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-teal-600" />
              <CardTitle className="text-base md:text-lg font-bold text-slate-800">
                Live Operations Feed
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="overflow-y-auto max-h-[288px] pr-2 space-y-4">
              {activity.length > 0 ? (
                <div className="relative pl-4 space-y-5 after:absolute after:inset-y-0.5 after:left-1.5 after:w-0.5 after:bg-slate-100">
                  {activity.map((a, idx) => (
                    <div key={idx} className="relative flex gap-3 text-xs md:text-sm">
                      <span className="absolute -left-[14px] top-1.5 flex h-2 w-2 rounded-full bg-teal-500 ring-2 ring-white" />
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-750 font-medium leading-relaxed text-xs md:text-sm">{a.description}</p>
                        <p className="text-[10px] md:text-xs text-slate-400 font-semibold mt-0.5">{formatDateTime(a.timestamp)}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider h-5 bg-slate-100/50 border-slate-200 text-slate-600 shrink-0 px-2 py-0.5">
                        {a.type.replace("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-slate-400 font-medium">
                  No operational activities logged today
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
