import { Model } from "@nozbe/watermelondb";
import { field, text, relation } from "@nozbe/watermelondb/decorators";

export default class ChildDevelopment extends Model {
  static table = "child_development";

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
  @text("assessment_date") assessmentDate;
  @field("age_months") ageMonths;
  @text("milestones_json") milestonesJson;
  @text("warning_signs_json") warningSignsJson;
  @text("assessed_by") assessedBy;
  @field("referral_needed") referralNeeded;

  @relation("patients", "patient_id") patient;
}
