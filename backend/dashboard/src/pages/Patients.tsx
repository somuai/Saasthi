import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchPatients,
  fetchPatient,
  createPatient,
  updatePatient,
  deletePatient,
  type PatientData,
} from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2, MoreHorizontal, RefreshCw, Users } from "lucide-react";

const statusBadge: Record<string, { bg: string; text: string }> = {
  active: { bg: "bg-emerald-50 text-emerald-700 border-emerald-100", text: "Active" },
  inactive: { bg: "bg-slate-50 text-slate-500 border-slate-200", text: "Inactive" },
  transferred: { bg: "bg-blue-50 text-blue-700 border-blue-100", text: "Transferred" },
  deceased: { bg: "bg-rose-50 text-rose-700 border-rose-100", text: "Deceased" },
};

export function Patients() {
  const toast = useToast();
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<PatientData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (q?: string, s?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("search", q);
      if (s) params.set("status", s);
      const data = await fetchPatients(params.toString());
      setPatients(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load patients");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load(search, statusFilter);
  }, [load, search, statusFilter]);

  async function handleSave(data: Partial<PatientData>) {
    setSaving(true);
    try {
      if (selected) {
        await updatePatient(selected.id, data);
        toast.success("Patient updated");
      } else {
        await createPatient(data);
        toast.success("Patient created");
      }
      setSheetOpen(false);
      setSelected(null);
      load(search, statusFilter);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deletePatient(deleteId);
      toast.success("Patient deleted");
      setDeleteId(null);
      load(search, statusFilter);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  function openEdit(p: PatientData) {
    setSelected(p);
    setSheetOpen(true);
  }

  function openCreate() {
    setSelected(null);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Beneficiary Registry</h1>
          <p className="text-xs text-slate-500 font-medium">Review and manage patients registered in the maternal-child tracking network</p>
        </div>
        <Button onClick={openCreate} size="sm" className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-semibold text-xs shadow-sm">
          <Plus className="h-4 w-4 mr-1.5" /> Add Patient
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search patients by name..."
            className="pl-9 rounded-xl border-slate-200 shadow-sm bg-white text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-36 rounded-xl border-slate-200 shadow-sm bg-white text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="transferred">Transferred</SelectItem>
            <SelectItem value="deceased">Deceased</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" onClick={() => load(search, statusFilter)} className="rounded-xl border border-slate-200 shadow-sm h-9 w-9 bg-white text-slate-550 hover:text-slate-950">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <Card className="rounded-2xl border border-slate-100 shadow-premium overflow-hidden bg-white">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : patients.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <Users className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-slate-700 font-bold text-sm">No patients found</p>
              <p className="text-xs text-slate-400 mt-1 mb-5">Try modifying your query or register a new patient.</p>
              <Button size="sm" className="rounded-xl" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1.5" /> Add Patient
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-bold text-slate-700 text-xs">Name</TableHead>
                    <TableHead className="font-bold text-slate-700 text-xs">Phone</TableHead>
                    <TableHead className="font-bold text-slate-700 text-xs">Village</TableHead>
                    <TableHead className="font-bold text-slate-700 text-xs">Status</TableHead>
                    <TableHead className="font-bold text-slate-700 text-xs">Assigned ASHA</TableHead>
                    <TableHead className="font-bold text-slate-700 text-xs">Risk Matrix</TableHead>
                    <TableHead className="font-bold text-slate-700 text-xs">Registered On</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients.map((p) => {
                    const mappedStatus = statusBadge[p.status] || { bg: "bg-slate-50 text-slate-500 border-slate-200", text: p.status };
                    return (
                      <TableRow key={p.id} className="hover:bg-slate-50/40 transition-colors">
                        <TableCell className="font-bold text-slate-800 text-xs">{p.full_name}</TableCell>
                        <TableCell className="text-slate-500 text-xs font-mono">{formatPhone(p.phone)}</TableCell>
                        <TableCell className="text-slate-650 text-xs font-medium">{p.village}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${mappedStatus.bg} border font-semibold text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-lg`}>
                            {mappedStatus.text}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-600 text-xs font-medium">
                          {p.asha_worker_name || "—"}
                        </TableCell>
                        <TableCell>
                          {p.is_high_risk_pregnancy ? (
                            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-250 font-bold text-[9px] uppercase tracking-wider rounded-lg px-2 py-0.5">
                              High Risk (HRP)
                            </Badge>
                          ) : p.pregnancy_status ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-250 font-bold text-[9px] uppercase tracking-wider rounded-lg px-2 py-0.5">
                              Pregnancy
                            </Badge>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-400 text-xs font-medium">
                          {formatDate(p.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-50" onClick={() => openEdit(p)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50"
                              onClick={() => setDeleteId(p.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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

      {/* Create/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected ? "Edit Patient" : "Add Patient"}</SheetTitle>
            <SheetDescription>
              {selected
                ? `Editing ${selected.full_name}`
                : "Register a new patient in the system"}
            </SheetDescription>
          </SheetHeader>
          <Separator className="my-4" />
          <PatientForm
            initial={selected}
            onSave={handleSave}
            onCancel={() => setSheetOpen(false)}
            saving={saving}
          />
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Patient</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the patient and all
              associated records.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PatientForm({
  initial,
  onSave,
  saving,
}: {
  initial: PatientData | null;
  onSave: (data: Partial<PatientData>) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    full_name: initial?.full_name || "",
    phone: initial?.phone || "",
    village: initial?.village || "",
    block: initial?.block || "",
    district: initial?.district || "",
    status: initial?.status || "active",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Full Name *</Label>
        <Input
          id="name"
          value={form.full_name}
          onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder="+91XXXXXXXXXX"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="village">Village</Label>
          <Input id="village" value={form.village} onChange={(e) => setForm((f) => ({ ...f, village: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="block">Block</Label>
          <Input id="block" value={form.block} onChange={(e) => setForm((f) => ({ ...f, block: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="district">District</Label>
          <Input id="district" value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="transferred">Transferred</SelectItem>
            <SelectItem value="deceased">Deceased</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <SheetFooter>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : initial ? "Update Patient" : "Create Patient"}
        </Button>
      </SheetFooter>
    </form>
  );
}
