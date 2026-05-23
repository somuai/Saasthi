import { Model } from "@nozbe/watermelondb";
import { field, text, lazy } from "@nozbe/watermelondb/decorators";
import { Q } from "@nozbe/watermelondb";

export default class Household extends Model {
  static table = "households";

  static associations = {
    patients: { type: "has_many", foreignKey: "household_id" },
  };

  @text("server_id") serverId;
  @field("is_synced") isSynced;
  @field("created_at") createdAt;
  @field("updated_at") updatedAt;
  @field("is_deleted") isDeleted;
  @field("is_mock") isMock;

  @text("household_code") householdCode;
  @text("head_of_family") headOfFamily;
  @text("address") address;
  @text("village") village;
  @text("block") block;
  @text("district") district;
  @field("gps_lat") gpsLat;
  @field("gps_lng") gpsLng;
  @field("total_members") totalMembers;
  @field("male_count") maleCount;
  @field("female_count") femaleCount;
  @field("children_under5") childrenUnder5;
  @field("elderly_above60") elderlyAbove60;
  @field("has_toilet") hasToilet;
  @text("water_source") waterSource;
  @field("is_bpl") isBpl;
  @text("awc_number") awcNumber;
  @text("lgd_code") lgdCode;
  @text("asha_worker_id") ashaWorkerId;

  @lazy patients = this.collections.get("patients").query(Q.where("household_id", this.id), Q.where("is_deleted", false));
}
