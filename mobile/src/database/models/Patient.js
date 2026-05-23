import { Model } from "@nozbe/watermelondb";
import { field, text, relation, lazy } from "@nozbe/watermelondb/decorators";
import { Q } from "@nozbe/watermelondb";

export default class Patient extends Model {
  static table = "patients";

  static associations = {
    households: { type: "belongs_to", key: "household_id" },
    survey_responses: { type: "has_many", foreignKey: "patient_id" },
    follow_ups: { type: "has_many", foreignKey: "patient_id" },
    mother_records: { type: "has_many", foreignKey: "patient_id" },
    immunization_records: { type: "has_many", foreignKey: "patient_id" },
    growth_records: { type: "has_many", foreignKey: "patient_id" },
    child_development: { type: "has_many", foreignKey: "patient_id" },
    flags: { type: "has_many", foreignKey: "patient_id" },
    referrals: { type: "has_many", foreignKey: "patient_id" },
  };

  @text("server_id") serverId;
  @field("is_synced") isSynced;
  @field("created_at") createdAt;
  @field("updated_at") updatedAt;
  @field("is_deleted") isDeleted;
  @field("is_mock") isMock;

  @text("patient_code") patientCode;
  @text("household_id") householdId;
  @text("name") name;
  @field("age") age;
  @text("gender") gender;
  @text("phone") phone;
  @text("aadhaar_last4") aadhaarLast4;
  @field("has_diabetes") hasDiabetes;
  @field("has_hypertension") hasHypertension;
  @field("has_tb") hasTb;
  @field("has_asthma") hasAsthma;
  @field("has_heart_disease") hasHeartDisease;
  @field("is_pregnant") isPregnant;
  @field("hospitalized_last_year") hospitalizedLastYear;
  @field("regular_medicines") regularMedicines;
  @text("medicines_name") medicinesName;
  @field("risk_score") riskScore;
  @text("risk_level") riskLevel;
  @text("last_visited") lastVisited;
  @text("asha_worker_server_id") ashaWorkerServerId;
  @text("date_of_birth") dateOfBirth;
  @field("immunization_defaulter") immunizationDefaulter;
  @field("latest_weight_for_age_z") latestWeightForAgeZ;

  @relation("households", "household_id") household;

  @lazy surveys = this.collections.get("survey_responses").query(Q.where("patient_id", this.id), Q.sortBy("created_at", Q.desc));

  @lazy openFollowUps = this.collections
    .get("follow_ups")
    .query(Q.where("patient_id", this.id), Q.where("is_completed", false), Q.where("is_deleted", false));

  @lazy motherRecord = this.collections
    .get("mother_records")
    .query(Q.where("patient_id", this.id), Q.where("is_deleted", false), Q.take(1));

  @lazy openFlags = this.collections
    .get("flags")
    .query(Q.where("patient_id", this.id), Q.where("is_resolved", false), Q.where("is_deleted", false));
}
