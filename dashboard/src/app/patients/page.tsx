"use client";

import { useState } from "react";
import { usePatients, Patient } from "@/hooks/usePatients";
import { PatientTable } from "@/components/patients/PatientTable";
import { PatientFilters } from "@/components/patients/PatientFilters";
import { PatientDetailDrawer } from "@/components/patients/PatientDetailDrawer";
import { useAuth } from "@/providers/AuthProvider";

export default function PatientsRegistryPage() {
  const { user } = useAuth();
  
  // State for filtering
  const [search, setSearch] = useState("");
  const [riskLevel, setRiskLevel] = useState("All");
  const page = 1;
  const limit = 20;

  // State for drawer
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  // Fetch patients using React Query
  const { data, isLoading } = usePatients({
    search,
    riskLevel,
    page,
    limit,
    supervisorId: user?.id,
  });

  const handleRowClick = (patient: Patient) => {
    setSelectedPatientId(patient.id);
  };

  return (
    <div className="flex-1 space-y-4 h-full flex flex-col p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Patient Registry</h2>
      </div>
      
      <PatientFilters 
        search={search}
        setSearch={setSearch}
        riskLevel={riskLevel}
        setRiskLevel={setRiskLevel}
      />
      
      <div className="flex-1 overflow-hidden min-h-0">
        <PatientTable 
          data={data?.data || []}
          isLoading={isLoading}
          onRowClick={handleRowClick}
        />
      </div>

      <PatientDetailDrawer 
        patientId={selectedPatientId}
        isOpen={selectedPatientId !== null}
        onClose={() => setSelectedPatientId(null)}
      />
    </div>
  );
}
