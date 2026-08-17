import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

interface MaternalPatient {
  id: number;
  name: string;
  name_hi: string;
  age: number;
  phone: string;
  village: string;
  asha_name: string;
  lmp: string | null;
  edd: string | null;
}

export function Maternal() {
  const toast = useToast();
  const [patients, setPatients] = useState<MaternalPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [downloadingSlipId, setDownloadingSlipId] = useState<number | null>(null);

  const loadPregnancyRegister = async () => {
    setLoading(true);
    try {
      const data = await api.get<MaternalPatient[]>("/api/anm/high-risk-patients/");
      setPatients(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error loading maternal register");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPregnancyRegister();
  }, []);

  const downloadReferralSlip = async (patient: MaternalPatient) => {
    setDownloadingSlipId(patient.id);
    try {
      const response = await fetch(`/api/anm/reports/hrp-referral-slip/${patient.id}/`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("shaasthi_dash_token") || ""}`
        }
      });
      if (!response.ok) throw new Error("Failed to generate HRP referral slip");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `HRP_Referral_${patient.name}_${patient.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Downloaded HRP referral slip for ${patient.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not download referral slip");
    } finally {
      setDownloadingSlipId(null);
    }
  };

  const filteredPatients = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.village.toLowerCase().includes(search.toLowerCase()) ||
    p.asha_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Pregnancy Register</h1>
          <p className="text-xs text-slate-500 font-medium">Monitor active pregnancies, predicted EDD milestones, and high-risk classifications</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by name, village, or ASHA..."
          className="pl-9 rounded-xl border-slate-200 shadow-sm bg-white text-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="rounded-2xl border border-slate-100 shadow-premium overflow-hidden bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold text-slate-700 text-xs">Mother Patient</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs">ASHA Worker</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs">Village</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs">LMP Date</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs">EDD Date</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs">Status</TableHead>
                  <TableHead className="w-64 text-right"></TableHead>
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
                ) : filteredPatients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-slate-450">
                      No pregnancy records match criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPatients.map((p) => (
                    <TableRow key={p.id} className="hover:bg-slate-50/40 transition-colors">
                      <TableCell>
                        <div>
                          <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            {p.name}
                            {p.name_hi && (
                              <span className="text-[10px] text-slate-400 font-normal font-hindi">
                                ({p.name_hi})
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">Age: {p.age} years</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-650 text-xs font-semibold">{p.asha_name}</TableCell>
                      <TableCell className="text-slate-600 text-xs font-medium">{p.village || "—"}</TableCell>
                      <TableCell className="text-slate-500 text-xs font-medium">{p.lmp ? new Date(p.lmp).toLocaleDateString("en-IN") : "—"}</TableCell>
                      <TableCell className="text-slate-700 text-xs font-bold">{p.edd ? new Date(p.edd).toLocaleDateString("en-IN") : "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-rose-50 text-rose-750 border-rose-100 font-bold text-[9px] uppercase tracking-wider rounded-lg px-2 py-0.5">
                          High Risk (HRP)
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadReferralSlip(p)}
                            disabled={downloadingSlipId === p.id}
                            className="h-8 rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 text-[11px] font-bold"
                          >
                            <FileText className="h-3.5 w-3.5 mr-1.5" />
                            HRP Slip
                          </Button>
                          <Link
                            to={`/patients/${p.id}`}
                            className="text-[11px] text-teal-700 hover:text-teal-900 border border-teal-200 hover:bg-teal-50 px-3 py-1 rounded-xl font-bold transition-all inline-flex items-center"
                          >
                            Review details &rarr;
                          </Link>
                        </div>
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
