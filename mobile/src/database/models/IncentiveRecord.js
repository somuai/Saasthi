import { Model } from "@nozbe/watermelondb";
import { field, text } from "@nozbe/watermelondb/decorators";

export default class IncentiveRecord extends Model {
  static table = "incentive_records";

  @text("server_id") serverId;
  @field("is_synced") isSynced;
  @field("created_at") createdAt;
  @field("updated_at") updatedAt;
  @field("is_deleted") isDeleted;
  @field("is_mock") isMock;

  @text("action_type") actionType;
  @text("patient_id") patientId;
  @text("reference_id") referenceId;
  @field("points") points;
  @field("amount_inr") amountInr;
  @text("period_date") periodDate;
  @field("is_approved") isApproved;
  @text("approved_at") approvedAt;
  @field("payment_received") paymentReceived;
}
