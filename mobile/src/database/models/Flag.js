import { Model } from "@nozbe/watermelondb";
import { field, text, relation } from "@nozbe/watermelondb/decorators";

export default class Flag extends Model {
  static table = "flags";

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
  @text("flag_type") flagType;
  @text("severity") severity;
  @text("description") description;
  @field("is_resolved") isResolved;
  @text("resolved_at") resolvedAt;
  @text("resolution_notes") resolutionNotes;

  @relation("patients", "patient_id") patient;
}
