import { Model } from "@nozbe/watermelondb";
import { field, text, relation, lazy } from "@nozbe/watermelondb/decorators";
import { Q } from "@nozbe/watermelondb";

export default class MotherRecord extends Model {
  static table = "mother_records";

  static associations = {
    patients: { type: "belongs_to", key: "patient_id" },
    anc_visit_records: { type: "has_many", foreignKey: "mother_record_id" },
  };

  @text("server_id") serverId;
  @field("is_synced") isSynced;
  @field("created_at") createdAt;
  @field("updated_at") updatedAt;
  @field("is_deleted") isDeleted;
  @field("is_mock") isMock;

  @text("patient_id") patientId;
  @text("mcts_rch_id_mother") mctsRchIdMother;
  @text("mcts_rch_id_child") mctsRchIdChild;
  @text("mother_aadhaar_last4") motherAadhaarLast4;
  @text("child_aadhaar_last4") childAadhaarLast4;
  @text("father_name") fatherName;
  @text("lmp_date") lmpDate;
  @text("edd") edd;
  @field("gravida") gravida;
  @field("prev_live_births") prevLiveBirths;
  @field("is_high_risk") isHighRisk;
  @field("is_pmmvy_eligible") isPmmvyEligible;
  @text("bank_name") bankName;
  @text("bank_account") bankAccount;
  @text("bank_ifsc") bankIfsc;
  @text("postal_account") postalAccount;
  @text("identified_delivery_institution") identifiedDeliveryInstitution;
  @text("anc_visit_1_json") ancVisit1Json;
  @text("anc_visit_2_json") ancVisit2Json;
  @text("anc_visit_3_json") ancVisit3Json;
  @text("anc_visit_4_json") ancVisit4Json;
  @text("anc_visit_5_json") ancVisit5Json;
  @text("tt_injection_1_date") ttInjection1Date;
  @text("tt_injection_2_date") ttInjection2Date;
  @field("ifa_tablets_issued") ifaTabletsIssued;
  @text("ifa_dates_json") ifaDatesJson;
  @field("calcium_tablets") calciumTablets;
  @field("albendazole_given") albendazoleGiven;
  @text("blood_group") bloodGroup;
  @text("rh_type") rhType;
  @text("hiv_screening_date") hivScreeningDate;
  @text("hiv_result") hivResult;
  @text("syphilis_date") syphilisDate;
  @text("syphilis_result") syphilisResult;
  @text("delivery_date") deliveryDate;
  @text("delivery_place") deliveryPlace;
  @text("delivery_type") deliveryType;
  @text("pregnancy_outcome") pregnancyOutcome;
  @field("birth_weight_kg") birthWeightKg;
  @text("child_sex") childSex;
  @field("child_cried_at_birth") childCriedAtBirth;
  @field("breastfed_within_1hr") breastfedWithin1hr;
  @field("vit_k_given") vitKGiven;
  @text("birth_registration_no") birthRegistrationNo;
  @text("pnc_day1_json") pncDay1Json;
  @text("pnc_day3_json") pncDay3Json;
  @text("pnc_day7_json") pncDay7Json;
  @text("pnc_week6_json") pncWeek6Json;
  @field("jsy_registered") jsyRegistered;
  @field("jsy_payment_received") jsyPaymentReceived;
  @field("pmmvy_installment_1") pmmvyInstallment1;
  @field("pmmvy_installment_2") pmmvyInstallment2;
  @field("pmmvy_installment_3") pmmvyInstallment3;
  @text("sub_centre_reg_no") subCentreRegNo;
  @text("fixed_vhsnd_day") fixedVhsndDay;

  @relation("patients", "patient_id") patient;

  @lazy ancVisits = this.collections
    .get("anc_visit_records")
    .query(Q.where("mother_record_id", this.id), Q.sortBy("visit_number", Q.asc));
}
