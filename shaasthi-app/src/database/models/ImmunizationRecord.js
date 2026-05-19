import { Model } from "@nozbe/watermelondb";
import { field, text, relation } from "@nozbe/watermelondb/decorators";

export default class ImmunizationRecord extends Model {
  static table = "immunization_records";

  static associations = {
    patients: { type: "belongs_to", key: "patient_id" },
    mother_records: { type: "belongs_to", key: "mother_record_id" },
  };

  @text("server_id") serverId;
  @field("is_synced") isSynced;
  @field("created_at") createdAt;
  @field("updated_at") updatedAt;
  @field("is_deleted") isDeleted;
  @field("is_mock") isMock;

  @text("patient_id") patientId;
  @text("mother_record_id") motherRecordId;
  @text("vaccine_name") vaccineName;
  @text("vaccine_code") vaccineCode;
  @text("scheduled_date") scheduledDate;
  @text("administered_date") administeredDate;
  @field("is_administered") isAdministered;
  @field("is_missed") isMissed;
  @text("missed_reason") missedReason;
  @text("next_due_date") nextDueDate;
  @text("batch_number") batchNumber;
  @text("anm_name") anmName;
  @text("site") site;
  @text("adverse_event") adverseEvent;

  @relation("patients", "patient_id") patient;
}
