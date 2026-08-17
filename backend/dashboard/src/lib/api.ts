const BASE = "/dashboard/api";

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function getNewToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("/api/v1/auth/token/refresh/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem("shaasthi_dash_token", data.access);
      if (data.refresh) {
        localStorage.setItem("shaasthi_dash_refresh_token", data.refresh);
      }
      return data.access;
    }
  } catch (err) {
    console.error("Token refresh API error:", err);
  }
  return null;
}

export class ForbiddenError extends Error {
  status: number;
  body: any;
  constructor(message: string, body?: any) {
    super(message);
    this.name = "ForbiddenError";
    this.status = 403;
    this.body = body;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("shaasthi_dash_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (options.body instanceof FormData) {
    delete headers["Content-Type"];
  }
  const url = path.startsWith("/api/") ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers,
  });

  // 403 = permission denied (not auth failure) — throw descriptive error, never nuke session
  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    throw new ForbiddenError(
      body.detail || body.message || "You do not have permission to perform this action.",
      body
    );
  }

  if (res.status === 401) {
    const refreshToken = localStorage.getItem("shaasthi_dash_refresh_token");
    if (refreshToken) {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = getNewToken(refreshToken).finally(() => {
          isRefreshing = false;
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        const retryRes = await fetch(url, {
          ...options,
          headers,
        });
        // Retry: 403 is still fine (not auth), 401 means refresh didn't help
        if (retryRes.status === 403) {
          const body = await retryRes.json().catch(() => ({}));
          throw new ForbiddenError(
            body.detail || body.message || "You do not have permission to perform this action.",
            body
          );
        }
        if (retryRes.status !== 401) {
          if (!retryRes.ok) {
            const text = await retryRes.text().catch(() => "");
            let detail = retryRes.statusText;
            try {
              const body = JSON.parse(text);
              detail = body.detail || body.message || detail;
            } catch {
              if (text) detail = text;
            }
            throw new Error(detail || "Request failed");
          }
          if (retryRes.status === 204) return undefined as T;
          const text = await retryRes.text();
          return (text ? JSON.parse(text) : undefined) as T;
        }
      }
    }

    // 401 + token refresh failed = session expired, nuke
    localStorage.removeItem("shaasthi_dash_token");
    localStorage.removeItem("shaasthi_dash_refresh_token");
    localStorage.removeItem("shaasthi_dash_user");
    window.location.href = "/dashboard/";
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = res.statusText;
    try {
      const body = JSON.parse(text);
      detail = body.detail || body.message || detail;
    } catch {
      if (text) detail = text;
    }
    throw new Error(detail || "Request failed");
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export interface SummaryData {
  total_patients: number;
  active_patients: number;
  pregnant: number;
  high_risk: number;
  open_flags: number;
  total_referrals: number;
  pending_referrals: number;
  total_ashas: number;
  registered_ashas: number;
  flags_by_severity: { severity: string; count: number }[];
  referrals_by_status: { status: string; count: number }[];
}

export interface PatientData {
  id: number;
  local_uuid: string;
  full_name: string;
  name_hi?: string;
  phone: string;
  gender?: string;
  date_of_birth?: string | null;
  village: string;
  block: string;
  district: string;
  region?: string;
  status: string;
  pregnancy_status: boolean;
  is_high_risk_pregnancy: boolean;
  asha_worker: number | null;
  asha_worker_name: string | null;
  asha_worker_phone?: string | null;
  household_code?: string | null;
  relationship_to_head?: string;
  household_details?: {
    id: number;
    local_uuid: string;
    household_code?: string;
    head_name: string;
    head_name_hi?: string;
    member_count: number;
    village: string;
    block: string;
    district: string;
    region?: string;
    address?: string;
    lat?: number;
    lng?: number;
  } | null;
  household_members?: {
    id: number;
    full_name: string;
    gender?: string;
    relationship_to_head?: string;
    pregnancy_status?: boolean;
    status: string;
  }[];
  // MCP fields
  lmp_date?: string | null;
  edd?: string | null;
  blood_group?: string | null;
  rh_typing?: string | null;
  gravida?: number | null;
  para?: number | null;
  abortions?: number | null;
  last_delivery_date?: string | null;
  last_delivery_place?: string | null;
  obstetric_complications?: string[];
  mcp_card_issued?: boolean;
  mcp_card_number?: string | null;
  mcts_rch_id?: string | null;
  diabetes?: boolean;
  hypertension?: boolean;
  tb_history?: boolean;
  anc_visit_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ASHAData {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  phone: string;
  village: string;
  block: string;
  district: string;
  requires_review: boolean;
  is_active: boolean;
  last_login: string | null;
  patients_count: number;
  has_registration: boolean;
}

export interface FlagData {
  id: number;
  flag_type: string;
  severity: string;
  status: string;
  patient: number;
  patient_name?: string;
  created_at: string;
}

export interface ReferralData {
  id: number;
  patient: number;
  patient_name?: string;
  destination: string;
  status: string;
  reason: string;
  created_at: string;
}

export interface IncentiveData {
  id: number;
  activity_type: string;
  amount: string;
  amount_paise: number;
  status: string;
  month_year: string;
  description: string;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface ActivityData {
  type: string;
  description: string;
  timestamp: string;
  resource_id: number;
  resource_type: string;
}

// ── MCP Clinical Data Types ──────────────────────────────────────────

export interface ANCVisitData {
  id: number;
  local_uuid: string;
  visit_number: number;
  visit_date: string;
  pog_weeks: number | null;
  weight_kg: number | null;
  pulse_rate: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pallor: string | null;
  oedema: string | null;
  jaundice: string | null;
  any_complaints: string;
  fundal_height_cm: number | null;
  lie_presentation: string | null;
  fetal_movements: string | null;
  fetal_heart_rate: number | null;
  hemoglobin_gms: number | null;
  urine_albumin: string | null;
  urine_sugar: string | null;
  hiv_screening: string | null;
  syphilis_test: string | null;
  ultrasonography: boolean | null;
  gdm_screening: string | null;
  blood_group: string | null;
  rh_typing: string | null;
  tsh_value: number | null;
  hbsag: string | null;
  blood_sugar_value: number | null;
  tt_injection_given: boolean;
  ifa_tablets_given: number;
  calcium_tablets_given: boolean;
  albendazole_given: boolean;
  is_high_risk: boolean;
  risk_flags_summary: string[];
  created_at: string;
  updated_at: string;
}

export interface DeliveryData {
  id: number;
  local_uuid: string;
  delivery_date: string;
  delivery_place: string;
  institution_name: string | null;
  delivery_type: string;
  delivery_outcome: string;
  baby_sex: string | null;
  birth_weight_kg: number | null;
  birth_weight_grams: number | null;
  baby_cried_immediately: boolean | null;
  breastfeed_within_1hr: boolean | null;
  vitamin_k_given: boolean | null;
  complications: string;
  ifa_postnatal_started: boolean;
  calcium_postnatal_started: boolean;
  institution_stay_days: number | null;
  jsy_registered: boolean;
  pmmvy_registered: boolean;
  created_at: string;
  updated_at: string;
}

export interface PNCVisitData {
  id: number;
  local_uuid: string;
  visit_timing: string;
  visit_date: string;
  mother_complaints: string;
  mother_pallor: string | null;
  mother_pulse: number | null;
  mother_bp_sys: number | null;
  mother_bp_dia: number | null;
  mother_temp_f: number | null;
  breasts_condition: string | null;
  uterus_tenderness: string | null;
  bleeding_pv: string | null;
  lochia: string | null;
  family_planning_counselled: boolean;
  baby_weight_kg: number | null;
  baby_diarrhoea: boolean;
  baby_vomiting: boolean;
  baby_convulsions: boolean;
  baby_activity: string | null;
  baby_sucking: string | null;
  baby_breathing: string | null;
  baby_chest_indrawing: boolean;
  baby_temp_f: number | null;
  baby_jaundice: boolean;
  umbilical_stump: string | null;
  is_extra_visit: boolean;
  created_at: string;
  updated_at: string;
}

export interface GrowthRecordData {
  id: number;
  local_uuid: string;
  recorded_date: string;
  age_completed_months: number;
  weight_kg: number;
  height_cm: number | null;
  muac_cm: number | null;
  wfa_z_score: number | null;
  wfh_z_score: number | null;
  hfa_z_score: number | null;
  nutritional_status: string;
  weight_change_kg: number | null;
  is_faltering: boolean;
  created_at: string;
  updated_at: string;
}

export interface ImmunizationData {
  id: number;
  local_uuid: string;
  vaccine_name: string;
  dose_number: number;
  scheduled_date: string;
  administered_date: string | null;
  administered_at: string | null;
  status: string;
  missed_reason: string;
  next_reschedule: string | null;
  fic_eligible: boolean;
  cic_eligible: boolean;
  is_vitamin_a: boolean;
  vitamin_a_dose_num: number | null;
  created_at: string;
  updated_at: string;
}

export interface MilestoneData {
  id: number;
  local_uuid: string;
  check_date: string;
  age_at_check_months: number;
  milestones_achieved: Record<string, boolean>;
  warning_signs: Record<string, boolean>;
  any_warning_sign: boolean;
  developmental_concern: string;
  referred_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface CareInteractionData {
  id: number;
  local_uuid: string;
  protocol: string;
  notes: string;
  payload: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

export interface SurveyResponseData {
  id: number;
  local_uuid: string;
  survey_type: string;
  answers: Record<string, unknown>;
  submitted_at: string;
  score_snapshot: Record<string, unknown>;
  photo_base64?: string;
  created_at: string;
  updated_at: string;
}

export interface MCPData {
  anc_visits: ANCVisitData[];
  deliveries: DeliveryData[];
  pnc_visits: PNCVisitData[];
  growth_records: GrowthRecordData[];
  immunizations: ImmunizationData[];
  milestones: MilestoneData[];
  care_interactions: CareInteractionData[];
  survey_responses: SurveyResponseData[];
}

export async function fetchSummary(): Promise<SummaryData> {
  return api.get<SummaryData>("/summary/");
}

export async function fetchActivity(): Promise<ActivityData[]> {
  return api.get<ActivityData[]>("/activity/");
}

export async function fetchPatients(params?: string): Promise<PatientData[]> {
  return api.get<PatientData[]>(`/patients/${params ? `?${params}` : ""}`);
}

export async function fetchPatient(id: number): Promise<PatientData> {
  return api.get<PatientData>(`/patients/${id}/`);
}

export async function fetchPatientMCP(id: number): Promise<MCPData> {
  return api.get<MCPData>(`/patients/${id}/mcp/`);
}

export async function createPatient(data: Partial<PatientData>): Promise<PatientData> {
  return api.post<PatientData>("/patients/", data);
}

export async function updatePatient(id: number, data: Partial<PatientData>): Promise<PatientData> {
  return api.patch<PatientData>(`/patients/${id}/`, data);
}

export async function deletePatient(id: number): Promise<void> {
  return api.delete<void>(`/patients/${id}/`);
}

export async function fetchASHAs(params?: string): Promise<ASHAData[]> {
  return api.get<ASHAData[]>(`/ashas/${params ? `?${params}` : ""}`);
}

export async function fetchASHA(id: number): Promise<any> {
  return api.get<any>(`/ashas/${id}/`);
}

export async function fetchFlags(params?: string): Promise<any[]> {
  return api.get<any[]>(`/flags/${params ? `?${params}` : ""}`);
}

export async function updateFlag(id: number, status: string): Promise<void> {
  return api.patch<void>(`/flags/${id}/`, { status });
}

export async function fetchReferrals(params?: string): Promise<any[]> {
  return api.get<any[]>(`/referrals/${params ? `?${params}` : ""}`);
}

export async function updateReferral(id: number, status: string): Promise<void> {
  return api.patch<void>(`/referrals/${id}/`, { status });
}

export async function fetchIncentives(params?: string): Promise<any[]> {
  return api.get<any[]>(`/incentives/${params ? `?${params}` : ""}`);
}

export async function approveIncentive(id: number): Promise<void> {
  return api.post<void>(`/incentives/${id}/approve/`);
}

export async function payIncentive(id: number): Promise<void> {
  return api.post<void>(`/incentives/${id}/pay/`);
}

export async function runCommand(command: string, args: string[] = []): Promise<{ stdout: string; stderr: string; error?: string }> {
  return api.post("/commands/", { command, args });
}
