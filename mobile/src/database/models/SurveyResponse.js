import { Model } from "@nozbe/watermelondb";
import { field, text, relation } from "@nozbe/watermelondb/decorators";

export default class SurveyResponse extends Model {
  static table = "survey_responses";

  static associations = {
    patients: { type: "belongs_to", key: "patient_id" },
  };

  @text("server_id") serverId;
  @field("is_synced") isSynced;
  @field("created_at") createdAt;
  @field("updated_at") updatedAt;
  @field("is_deleted") isDeleted;
  @field("is_mock") isMock;

  @text("patient_id") patientId;
  @text("asha_worker_server_id") ashaWorkerServerId;
  @text("survey_date") surveyDate;
  @text("visit_type") visitType;
  @text("asha_observation") ashaObservation;
  @text("living_condition") livingCondition;
  @text("healthcare_access") healthcareAccess;
  @text("symptom_fever_json") symptomFeverJson;
  @text("symptom_cough_json") symptomCoughJson;
  @text("symptom_breathless_json") symptomBreathlessJson;
  @text("symptom_chest_pain_json") symptomChestPainJson;
  @text("symptom_weakness_json") symptomWeaknessJson;
  @text("symptom_diarrhea_json") symptomDiarrheaJson;
  @text("symptom_vomiting_json") symptomVomitingJson;
  @field("serious_severe_breathing") seriousSevereBreathing;
  @field("serious_chest_pain") seriousChestPain;
  @field("serious_unable_walk") seriousUnableWalk;
  @field("serious_pregnancy_comp") seriousPregnancyComp;
  @field("chronic_freq_urination") chronicFreqUrination;
  @field("chronic_excess_thirst") chronicExcessThirst;
  @field("chronic_joint_pain") chronicJointPain;
  @field("chronic_known_bp_dm") chronicKnownBpDm;
  @field("comm_cough_2weeks") commCough2weeks;
  @field("comm_fever_3days") commFever3days;
  @field("comm_infection_wounds") commInfectionWounds;
  @field("comm_contact_sick") commContactSick;
  @text("followup_condition") followupCondition;
  @field("followup_doctor_visited") followupDoctorVisited;
  @field("followup_treatment_started") followupTreatmentStarted;
  @field("computed_risk_score") computedRiskScore;
  @text("computed_risk_level") computedRiskLevel;
  @text("triggered_factors_json") triggeredFactorsJson;
  @text("ml_model_version") mlModelVersion;
  @field("is_complete") isComplete;
  @text("device_id") deviceId;
  @text("synced_at") syncedAt;
  @field("consent_accepted") consentAccepted;
  @text("consent_version") consentVersion;

  @relation("patients", "patient_id") patient;
}
