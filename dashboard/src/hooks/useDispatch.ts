import { useQuery, useMutation } from '@tanstack/react-query';
import { NearbyWorkerCandidate, DispatchRequest } from '@/types';

// Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function useNearbyWorkers(lat: number, lng: number, radiusKm: number = 10) {
  return useQuery<NearbyWorkerCandidate[]>({
    queryKey: ['dispatch', 'nearby', lat, lng, radiusKm],
    queryFn: async () => {
      const candidates: NearbyWorkerCandidate[] = [
        { id: 1, name: 'Priya Sharma', phone: '+919876543210', distance_km: calculateDistance(lat, lng, lat + 0.01, lng + 0.01), active_patients: 2, status: 'Online', last_sync_time: new Date().toISOString(), location: { lat: lat + 0.01, lng: lng + 0.01 }, score: 0 },
        { id: 2, name: 'Anjali Patel', phone: '+919876543211', distance_km: calculateDistance(lat, lng, lat - 0.02, lng + 0.01), active_patients: 5, status: 'Online', last_sync_time: new Date().toISOString(), location: { lat: lat - 0.02, lng: lng + 0.01 }, score: 0 },
        { id: 3, name: 'Kavita Desai', phone: '+919876543212', distance_km: calculateDistance(lat, lng, lat + 0.015, lng - 0.02), active_patients: 1, status: 'Offline', last_sync_time: new Date(Date.now() - 3600000).toISOString(), location: { lat: lat + 0.015, lng: lng - 0.02 }, score: 0 },
        { id: 4, name: 'Sunita Reddy', phone: '+919876543213', distance_km: calculateDistance(lat, lng, lat + 0.03, lng + 0.03), active_patients: 3, status: 'Online', last_sync_time: new Date().toISOString(), location: { lat: lat + 0.03, lng: lng + 0.03 }, score: 0 },
        { id: 5, name: 'Lakshmi Iyer', phone: '+919876543214', distance_km: calculateDistance(lat, lng, lat - 0.025, lng - 0.025), active_patients: 4, status: 'Online', last_sync_time: new Date().toISOString(), location: { lat: lat - 0.025, lng: lng - 0.025 }, score: 0 },
        { id: 6, name: 'Sujata Menon', phone: '+919876543215', distance_km: calculateDistance(lat, lng, lat + 0.04, lng - 0.01), active_patients: 0, status: 'Online', last_sync_time: new Date().toISOString(), location: { lat: lat + 0.04, lng: lng - 0.01 }, score: 0 },
        { id: 7, name: 'Radha Krishna', phone: '+919876543216', distance_km: calculateDistance(lat, lng, lat - 0.01, lng + 0.04), active_patients: 6, status: 'Offline', last_sync_time: new Date(Date.now() - 7200000).toISOString(), location: { lat: lat - 0.01, lng: lng + 0.04 }, score: 0 },
        { id: 8, name: 'Gita Das', phone: '+919876543217', distance_km: calculateDistance(lat, lng, lat + 0.05, lng + 0.05), active_patients: 2, status: 'Online', last_sync_time: new Date().toISOString(), location: { lat: lat + 0.05, lng: lng + 0.05 }, score: 0 },
      ];

      // Rank by score: distance * 0.5 + activePatients * 0.3 + (status==='Offline' ? 100 : 0) * 0.2
      return candidates.sort((a, b) => {
        const scoreA = (a.distance_km * 0.5) + (a.active_patients * 0.3) + (a.status === 'Offline' ? 20 : 0);
        const scoreB = (b.distance_km * 0.5) + (b.active_patients * 0.3) + (b.status === 'Offline' ? 20 : 0);
        return scoreA - scoreB;
      });
    },
    staleTime: 30 * 1000, // Frequent updates for nearby workers
  });
}

export function useDispatchAssign() {
  return useMutation({
    mutationFn: async ({ alertId, workerId }: { alertId: string; workerId: number }) => {
      // Mock API call
      const dispatch: DispatchRequest = {
        id: String(Math.floor(Math.random() * 1000)),
        alert_id: alertId,
        worker_id: workerId,
        state: 'Assigned',
        created_at: new Date().toISOString(),
        patient: { id: 1, name: 'Test', location: { lat: 0, lng: 0 } },
        nearby_workers: [],
        state_history: [{ state: 'Assigned', timestamp: new Date().toISOString() }]
      } as unknown as DispatchRequest;
      return dispatch;
    }
  });
}

export function useDispatchState(dispatchId: number | null) {
  return useQuery({
    queryKey: ['dispatch', 'state', dispatchId],
    queryFn: async () => {
      if (!dispatchId) return null;
      // Mock polling state
      return {
        id: dispatchId,
        state: 'EnRoute',
        estimated_arrival_minutes: Math.floor(Math.random() * 15) + 5,
        updated_at: new Date().toISOString()
      };
    },
    enabled: !!dispatchId,
    refetchInterval: 5000,
  });
}
