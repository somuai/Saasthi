import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/types';

export function useAlerts(filters?: { severity?: string; status?: string }) {
  return useQuery<Alert[]>({
    queryKey: ['alerts', filters],
    queryFn: async () => {
      // Generate mock alerts
      const baseAlerts: Alert[] = [
        { id: '1', patient: { id: 101, name: 'Sunita Devi', age: 24, location: { lat: 19.102, lng: 72.845 }, village: 'Andheri' }, condition_summary: 'Severe anemia', severity: 'CRITICAL', status: 'ACTIVE', created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(), updated_at: new Date().toISOString() },
        { id: '2', patient: { id: 102, name: 'Kamala Rao', age: 29, location: { lat: 19.221, lng: 72.854 }, village: 'Borivali' }, condition_summary: 'Pre-eclampsia risk', severity: 'CRITICAL', status: 'ACTIVE', created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), updated_at: new Date().toISOString() },
        { id: '3', patient: { id: 103, name: 'Lakshmi Patel', age: 22, location: { lat: 19.182, lng: 72.964 }, village: 'Thane' }, condition_summary: 'Postpartum hemorrhage risk', severity: 'CRITICAL', status: 'IN_PROGRESS', assigned_worker: { id: 1, name: 'Worker 1' }, created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), updated_at: new Date().toISOString() },
        
        { id: '4', patient: { id: 104, name: 'Pooja Singh', age: 26, location: { lat: 19.231, lng: 73.123 }, village: 'Kalyan' }, condition_summary: 'Gestational diabetes', severity: 'HIGH', status: 'ACTIVE', created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), updated_at: new Date().toISOString() },
        { id: '5', patient: { id: 105, name: 'Anita Kumar', age: 21, location: { lat: 18.981, lng: 73.111 }, village: 'Panvel' }, condition_summary: 'Malnutrition grade 3', severity: 'HIGH', status: 'IN_PROGRESS', assigned_worker: { id: 2, name: 'Worker 2' }, created_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), updated_at: new Date().toISOString() },
        { id: '6', patient: { id: 106, name: 'Meena Roy', age: 31, location: { lat: 19.034, lng: 73.012 }, village: 'Navi Mumbai' }, condition_summary: 'Incomplete immunization', severity: 'HIGH', status: 'RESOLVED', assigned_worker: { id: 3, name: 'Worker 3' }, created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), updated_at: new Date().toISOString() },
        { id: '7', patient: { id: 107, name: 'Sita Sharma', age: 25, location: { lat: 19.012, lng: 72.842 }, village: 'Dadar' }, condition_summary: 'High blood pressure', severity: 'HIGH', status: 'ACTIVE', created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), updated_at: new Date().toISOString() },
        { id: '8', patient: { id: 108, name: 'Rekha Gupta', age: 27, location: { lat: 19.123, lng: 72.823 }, village: 'Juhu' }, condition_summary: 'Fetal growth restriction', severity: 'HIGH', status: 'RESOLVED', assigned_worker: { id: 1, name: 'Worker 1' }, created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), updated_at: new Date().toISOString() },
      ];
      
      let filtered = [...baseAlerts];
      // Generate the remaining MEDIUM and LOW alerts to get to 20
      for(let i=9; i<=20; i++) {
        const isMed = i <= 15;
        filtered.push({
          id: String(i),
          patient: { id: 100+i, name: `Patient ${i}`, age: 20 + (i%15), location: { lat: 19.076 + (Math.random()*0.1-0.05), lng: 72.877 + (Math.random()*0.1-0.05) }, village: 'Mumbai Region' },
          condition_summary: isMed ? 'Moderate anemia' : 'Missed scheduled visit',
          severity: isMed ? 'MEDIUM' : 'LOW',
          status: (i%3===0) ? 'RESOLVED' : ((i%3===1) ? 'IN_PROGRESS' : 'ACTIVE'),
          created_at: new Date(Date.now() - 1000 * 60 * 60 * i).toISOString(),
          updated_at: new Date().toISOString(),
          ...(i%3===0 || i%3===1 ? { assigned_worker: { id: (i%5)+1, name: 'Worker ' + ((i%5)+1) } } : {})
        } as Alert);
      }

      if (filters?.severity) {
        filtered = filtered.filter(a => a.severity === filters.severity);
      }
      if (filters?.status) {
        filtered = filtered.filter(a => a.status === filters.status);
      }

      return filtered;
    },
    staleTime: 60 * 1000,
  });
}

export function useAlertStats() {
  const { data: alerts } = useAlerts();
  
  if (!alerts) return { critical: 0, high: 0, medium: 0, low: 0, active: 0, in_progress: 0, resolved: 0 };
  
  return {
    critical: alerts.filter(a => a.severity === 'CRITICAL').length,
    high: alerts.filter(a => a.severity === 'HIGH').length,
    medium: alerts.filter(a => a.severity === 'MEDIUM').length,
    low: alerts.filter(a => a.severity === 'LOW').length,
    active: alerts.filter(a => a.status === 'ACTIVE').length,
    in_progress: alerts.filter(a => a.status === 'IN_PROGRESS').length,
    resolved: alerts.filter(a => a.status === 'RESOLVED').length,
  };
}

export function useAlertActions() {
  const queryClient = useQueryClient();

  const acknowledge = useMutation({
    mutationFn: async (id: string) => {
      return { id, status: 'IN_PROGRESS' as const };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['alerts', undefined], (old: Alert[] | undefined) => {
        if (!old) return old;
        return old.map(a => a.id === data.id ? { ...a, status: 'IN_PROGRESS' } : a);
      });
    }
  });

  const assign = useMutation({
    mutationFn: async ({ id, workerId }: { id: string; workerId: number }) => {
      return { id, assigned_worker: { id: workerId, name: 'Worker ' + workerId }, status: 'IN_PROGRESS' as const };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['alerts', undefined], (old: Alert[] | undefined) => {
        if (!old) return old;
        return old.map(a => a.id === data.id ? { ...a, status: 'IN_PROGRESS', assigned_worker: data.assigned_worker } : a);
      });
    }
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      return { id, status: 'RESOLVED' as const };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['alerts', undefined], (old: Alert[] | undefined) => {
        if (!old) return old;
        return old.map(a => a.id === data.id ? { ...a, status: 'RESOLVED' } : a);
      });
    }
  });

  return { acknowledge, assign, resolve };
}
