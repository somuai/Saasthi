import { useQuery } from "@tanstack/react-query";
import { AnalyticsOverview, TrendDataPoint } from "@/types";
import { apiClient } from "@/lib/api/client";

export function useAnalyticsOverview() {
  return useQuery<AnalyticsOverview>({
    queryKey: ["analytics", "overview"],
    queryFn: async () => {
      const res = await apiClient.get("/dashboard/admin/analytics/overview/");
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useWorkerScorecard(workerId: number) {
  return useQuery({
    queryKey: ["analytics", "worker", workerId, "scorecard"],
    queryFn: async () => {
      const res = await apiClient.get(`/dashboard/admin/analytics/workers/${workerId}/scorecard/`);
      return res.data;
    },
    enabled: Number.isFinite(workerId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTrendData(metric: string, days: number = 30) {
  return useQuery<TrendDataPoint[]>({
    queryKey: ["analytics", "trends", metric, days],
    queryFn: async () => {
      const res = await apiClient.get("/dashboard/admin/analytics/trends/", { params: { metric, days } });
      return res.data as TrendDataPoint[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
