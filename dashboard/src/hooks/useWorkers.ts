import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface Worker {
  id: number;
  name: string;
  phone: string;
  status: "Online" | "Offline" | "Syncing";
  last_sync_time: string;
  active_patients: number;
  location: {
    lat: number;
    lng: number;
    last_updated: string;
  };
  performance: {
    visits_today: number;
    visits_this_week: number;
    high_risk_followed: number;
  };
}

// Generate some mock workers clustered around a central location (e.g., a PHC in Maharashtra)
const BASE_LAT = 19.0760;
const BASE_LNG = 72.8777;

const MOCK_WORKERS: Worker[] = Array.from({ length: 12 }).map((_, i) => ({
  id: i + 1,
  name: `ASHA Worker ${i + 1}`,
  phone: `+91 98765${43000 + i}`,
  status: i % 4 === 0 ? "Offline" : i % 7 === 0 ? "Syncing" : "Online",
  last_sync_time: new Date(Date.now() - (i * 3600000)).toISOString(),
  active_patients: 15 + (i * 3),
  location: {
    lat: BASE_LAT + (Math.random() - 0.5) * 0.05,
    lng: BASE_LNG + (Math.random() - 0.5) * 0.05,
    last_updated: new Date(Date.now() - (i * 900000)).toISOString(),
  },
  performance: {
    visits_today: Math.floor(Math.random() * 10),
    visits_this_week: 20 + Math.floor(Math.random() * 30),
    high_risk_followed: Math.floor(Math.random() * 5),
  }
}));

export function useWorkers() {
  return useQuery({
    queryKey: ['workers'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/workers/');
        return res.data.results || res.data;
      } catch {
        console.warn("Failed to fetch workers from API, using mock data.");
        return MOCK_WORKERS;
      }
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useWorkerDetail(workerId: number | null) {
  return useQuery({
    queryKey: ['worker', workerId],
    queryFn: async () => {
      if (!workerId) return null;
      try {
        const res = await apiClient.get(`/workers/${workerId}/`);
        return res.data;
      } catch {
        return MOCK_WORKERS.find(w => w.id === workerId) || null;
      }
    },
    enabled: !!workerId,
  });
}
