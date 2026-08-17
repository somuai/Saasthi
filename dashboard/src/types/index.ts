// ============================================================
// Saasthi Platform — Shared Type Definitions
// Inspired by Uber's polyglot data model architecture
// ============================================================

// --- Worker / Location Types (Uber: Driver + Location Service) ---

export interface WorkerLocation {
  lat: number;
  lng: number;
  last_updated: string;
  h3_cell_id?: string; // H3 resolution-7 cell ID
}

export interface WorkerPerformance {
  visits_today: number;
  visits_this_week: number;
  high_risk_followed: number;
  avg_response_time_min?: number;
  coverage_pct?: number;
  data_quality_score?: number;
}

export interface Worker {
  id: number;
  name: string;
  phone: string;
  status: "Online" | "Offline" | "Syncing";
  last_sync_time: string;
  active_patients: number;
  location: WorkerLocation;
  performance: WorkerPerformance;
}

// --- Patient Types ---

export interface Patient {
  id: number;
  name: string;
  age: number;
  gender: string;
  village: string;
  phone: string;
  risk_level: "Critical" | "High" | "Medium" | "Low";
  edd?: string;
  lmp?: string;
  gestational_age_weeks?: number;
  last_visit_date: string;
  assigned_worker?: string;
  is_overdue: boolean;
  conditions: string[];
  location?: WorkerLocation;
}

// --- Alert Types (Uber: Trip/Ride Events) ---

export type AlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type AlertStatus = "ACTIVE" | "IN_PROGRESS" | "RESOLVED" | "ESCALATED";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  status: AlertStatus;
  patient: {
    id: number;
    name: string;
    age: number;
    village: string;
    location?: { lat: number; lng: number };
  };
  condition_summary: string;
  ai_rationale?: string;
  assigned_worker?: {
    id: number;
    name: string;
    distance_km?: number;
  };
  created_at: string;
  updated_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
}

// --- Dispatch Types (Uber: Matching/Dispatch Service) ---

export type DispatchState =
  | "Pending"      // Searching for worker (Uber: Searching)
  | "Assigned"     // Worker matched (Uber: Matched)
  | "EnRoute"      // Worker traveling (Uber: DriverEnRoute)
  | "OnSite"       // Worker arrived (Uber: Arrived)
  | "Completed"    // Visit done (Uber: Completed)
  | "Cancelled";   // Cancelled at any stage

export interface DispatchRequest {
  id: string;
  alert_id: string;
  state: DispatchState;
  patient: {
    id: number;
    name: string;
    location: { lat: number; lng: number };
  };
  assigned_worker?: {
    id: number;
    name: string;
    phone: string;
    location: { lat: number; lng: number };
    eta_minutes?: number;
  };
  nearby_workers: NearbyWorkerCandidate[];
  created_at: string;
  state_history: { state: DispatchState; timestamp: string }[];
}

export interface NearbyWorkerCandidate {
  id: number;
  name: string;
  phone: string;
  distance_km: number;
  active_patients: number;
  status: "Online" | "Offline" | "Syncing";
  last_sync_time: string;
  location: { lat: number; lng: number };
  score: number; // Ranking score (lower = better candidate)
}

// --- Analytics Types (Uber: Surge Pricing / Supply-Demand) ---

export interface H3HeatmapCell {
  h3_index: string;
  lat: number;
  lng: number;
  total_patients: number;
  high_risk_count: number;
  risk_density: number; // 0.0 - 1.0
  assigned_workers: number;
  coverage_ratio: number; // workers / patients
}

export interface TrendDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface KPI {
  key: string;
  label: string;
  value: number;
  unit?: string;
  trend: TrendDataPoint[];
  change_pct: number; // vs previous period
}

export interface AnalyticsOverview {
  kpis: KPI[];
  risk_distribution: { level: string; count: number; pct: number }[];
  age_demographics: { bracket: string; count: number }[];
  condition_prevalence: { condition: string; count: number }[];
  h3_heatmap: H3HeatmapCell[];
}

// --- Settings Types ---

export interface AlertThreshold {
  severity: AlertSeverity;
  auto_escalate_after_min: number;
  notify_supervisor: boolean;
  notify_doctor: boolean;
}

export interface SystemHealthStatus {
  service: string;
  status: "healthy" | "degraded" | "down";
  latency_ms: number;
  last_check: string;
}

// --- WebSocket Event Types ---

export type WSEventType =
  | "alert:new"
  | "alert:updated"
  | "dispatch:state_change"
  | "worker:location_update"
  | "system:health";

export interface WSEvent {
  type: WSEventType;
  payload: unknown;
  timestamp: string;
}
