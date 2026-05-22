import { Model } from "@nozbe/watermelondb";
import { field, text, relation } from "@nozbe/watermelondb/decorators";

export default class GrowthRecord extends Model {
  static table = "growth_records";

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
  @text("recorded_date") recordedDate;
  @field("age_months") ageMonths;
  @field("weight_kg") weightKg;
  @field("height_cm") heightCm;
  @field("muac_cm") muacCm;
  @field("weight_for_age_z") weightForAgeZ;
  @field("height_for_age_z") heightForAgeZ;
  @field("weight_for_height_z") weightForHeightZ;
  @text("nutrition_status") nutritionStatus;
  @text("recorded_by") recordedBy;
  @text("awc_number") awcNumber;

  @relation("patients", "patient_id") patient;
}
