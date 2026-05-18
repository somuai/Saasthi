import { Model } from "@nozbe/watermelondb";
import { field, text, relation } from "@nozbe/watermelondb/decorators";

export default class Referral extends Model {
  static table = "referrals";

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
  @text("provider_name") providerName;
  @text("provider_type") providerType;
  @text("disease_category") diseaseCategory;
  @text("referral_date") referralDate;
  @text("status") status;
  @text("outcome") outcome;
  @field("incentive_awarded") incentiveAwarded;

  @relation("patients", "patient_id") patient;
}
