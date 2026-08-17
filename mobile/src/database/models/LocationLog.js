import { Model } from "@nozbe/watermelondb";
import { field, date, readonly } from "@nozbe/watermelondb/decorators";

export default class LocationLog extends Model {
  static table = "location_logs";

  @field("server_id") serverId;
  @field("is_synced") isSynced;
  @readonly @date("created_at") createdAt;
  @readonly @date("updated_at") updatedAt;
  @field("is_deleted") isDeleted;
  @field("is_mock") isMock;

  @field("latitude") latitude;
  @field("longitude") longitude;
  @field("accuracy_m") accuracy;
  @field("altitude_m") altitude;
  @field("speed_mps") speed;
  @field("battery_pct") batteryPct;
  @field("recorded_at") recordedAt;
  @field("is_during_visit") isDuringVisit;
  @field("visit_id") visitId;
}
