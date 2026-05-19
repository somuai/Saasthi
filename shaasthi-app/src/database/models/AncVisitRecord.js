import { Model } from "@nozbe/watermelondb";
import { field, text, relation } from "@nozbe/watermelondb/decorators";

export default class AncVisitRecord extends Model {
  static table = "anc_visit_records";

  static associations = {
    mother_records: { type: "belongs_to", key: "mother_record_id" },
  };

  @text("server_id") serverId;
  @field("is_synced") isSynced;
  @field("created_at") createdAt;
  @field("updated_at") updatedAt;
  @field("is_deleted") isDeleted;
  @field("is_mock") isMock;

  @text("mother_record_id") motherRecordId;
  @field("visit_number") visitNumber;
  @text("visit_date") visitDate;
  @field("pog_weeks") pogWeeks;
  @field("weight_kg") weightKg;
  @field("pulse_rate") pulseRate;
  @field("bp_systolic") bpSystolic;
  @field("bp_diastolic") bpDiastolic;
  @text("pallor") pallor;
  @field("oedema") oedema;
  @field("jaundice") jaundice;
  @text("complaints") complaints;
  @field("fundal_height_cm") fundalHeightCm;
  @text("lie_presentation") liePresentation;
  @text("fetal_movements") fetalMovements;
  @field("fetal_heart_rate") fetalHeartRate;
  @field("hemoglobin_gm") hemoglobinGm;
  @text("urine_albumin") urineAlbumin;
  @text("urine_sugar") urineSugar;
  @field("ultrasonography_done") ultrasonographyDone;
  @field("gdm_screening") gdmScreening;
  @field("is_under_pmsma") isUnderPmsma;

  @relation("mother_records", "mother_record_id") motherRecord;
}
