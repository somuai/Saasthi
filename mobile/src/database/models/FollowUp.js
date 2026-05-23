import { Model } from "@nozbe/watermelondb";
import { field, text, relation } from "@nozbe/watermelondb/decorators";

export default class FollowUp extends Model {
  static table = "follow_ups";

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
  @text("survey_id") surveyId;
  @text("due_date") dueDate;
  @text("completed_date") completedDate;
  @field("is_completed") isCompleted;
  @field("is_overdue") isOverdue;
  @text("follow_type") followType;
  @text("outcome") outcome;
  @text("notes") notes;
  @field("incentive_awarded") incentiveAwarded;

  @field("visit_lat") visitLat;
  @field("visit_lng") visitLng;
  @field("visit_accuracy_m") visitAccuracyM;

  @relation("patients", "patient_id") patient;
}
