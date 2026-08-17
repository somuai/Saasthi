import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface Patient {
  id: number;
  name: string;
  age: number;
  phone: string;
  village: string;
  assigned_worker_id: number;
  assigned_worker_name: string;
  risk_level: "High" | "Medium" | "Low";
  cohort: "Pregnant" | "Lactating" | "Child" | "Elderly" | "General";
  last_visit_date: string;
  status: "Active" | "Inactive";
}

interface FetchPatientsParams {
  page?: number;
  limit?: number;
  search?: string;
  riskLevel?: string;
  cohort?: string;
  supervisorId?: number;
}

export function usePatients(params: FetchPatientsParams) {
  return useQuery({
    queryKey: ['patients', params],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/patients/', { params });
        return {
          data: res.data.results || res.data,
          total: res.data.count || res.data.length,
        };
      } catch (err) {
        console.warn("Failed to fetch patients from API, using mock data.", err);
        // Fallback to mock data for UI testing if endpoint doesn't exist
        const mockData: Patient[] = Array.from({ length: 50 }).map((_, i) => ({
          id: i + 1,
          name: `Patient ${i + 1}`,
          age: 20 + (i % 30),
          phone: `+91 98765${43210 + i}`,
          village: i % 2 === 0 ? "Bhandari" : "Kumbhar",
          assigned_worker_id: i % 5 + 1,
          assigned_worker_name: `ASHA Worker ${i % 5 + 1}`,
          risk_level: i % 7 === 0 ? "High" : i % 3 === 0 ? "Medium" : "Low",
          cohort: i % 4 === 0 ? "Pregnant" : i % 5 === 0 ? "Lactating" : i % 6 === 0 ? "Child" : "General",
          last_visit_date: new Date(Date.now() - (i * 86400000)).toISOString(),
          status: i % 10 === 0 ? "Inactive" : "Active",
        }));
        
        // Simple mock filtering
        let filtered = [...mockData];
        if (params.search) {
          filtered = filtered.filter(p => p.name.toLowerCase().includes(params.search!.toLowerCase()));
        }
        if (params.riskLevel && params.riskLevel !== 'All') {
          filtered = filtered.filter(p => p.risk_level === params.riskLevel);
        }
        
        return {
          data: filtered.slice(0, params.limit || 20),
          total: filtered.length,
        };
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function usePatientDetail(patientId: number | null) {
  return useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      if (!patientId) return null;
      try {
        const res = await apiClient.get(`/patients/${patientId}/`);
        return res.data;
      } catch (err) {
        console.warn(`Failed to fetch patient ${patientId} from API, using mock.`, err);
        return {
          id: patientId,
          name: `Patient ${patientId}`,
          age: 28,
          phone: "+91 9876543210",
          village: "Bhandari",
          assigned_worker_name: "ASHA Worker 1",
          risk_level: "High",
          cohort: "Pregnant",
          last_visit_date: new Date().toISOString(),
          status: "Active",
          vitals: [
            { date: "2026-05-01", systolic: 120, diastolic: 80, weight: 60, sugar: 90 },
            { date: "2026-05-15", systolic: 140, diastolic: 90, weight: 62, sugar: 95 },
            { date: "2026-06-01", systolic: 165, diastolic: 100, weight: 64, sugar: 105 }, // High risk
          ],
          ai_insights: {
            risk_score: 85,
            factors: ["Systolic BP 165 (Critical)", "Rapid weight gain"],
            recommendation: "Refer to PHC for immediate ultrasound and BP management."
          }
        };
      }
    },
    enabled: !!patientId,
  });
}
