import { useQuery } from '@tanstack/react-query';
import { AlertThreshold, SystemHealthStatus } from '@/types';

export function useUserProfile() {
  return useQuery({
    queryKey: ['settings', 'profile'],
    queryFn: async () => {
      // Mock profile
      return {
        id: 1, 
        name: 'Dr. Priya Sharma', 
        phone: '+91 9876543210', 
        role: 'supervisor', 
        jurisdiction: 'Mumbai North District', 
        facility: 'PHC Andheri West', 
        joined_at: '2024-01-15'
      };
    },
    staleTime: 60 * 60 * 1000,
  });
}

export function useAlertConfig() {
  return useQuery<AlertThreshold[]>({
    queryKey: ['settings', 'alerts'],
    queryFn: async () => {
      return [
        { severity: 'CRITICAL', auto_escalate_after_min: 5, notify_supervisor: true, notify_doctor: true },
        { severity: 'HIGH', auto_escalate_after_min: 15, notify_supervisor: true, notify_doctor: true },
        { severity: 'MEDIUM', auto_escalate_after_min: 60, notify_supervisor: true, notify_doctor: false },
        { severity: 'LOW', auto_escalate_after_min: 1440, notify_supervisor: false, notify_doctor: false },
      ];
    },
    staleTime: 60 * 60 * 1000,
  });
}

export function useSystemHealth() {
  return useQuery<SystemHealthStatus[]>({
    queryKey: ['settings', 'health'],
    queryFn: async () => {
      const now = new Date().toISOString();
      return [
        { service: 'API Gateway', status: 'healthy', latency_ms: 45, last_check: now },
        { service: 'WebSocket Server', status: 'healthy', latency_ms: 12, last_check: now },
        { service: 'Location Service', status: 'healthy', latency_ms: 28, last_check: now },
        { service: 'Dispatch Engine', status: 'degraded', latency_ms: 230, last_check: now },
        { service: 'Analytics Pipeline', status: 'healthy', latency_ms: 67, last_check: now },
        { service: 'Sync Service', status: 'healthy', latency_ms: 55, last_check: now }
      ];
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}
