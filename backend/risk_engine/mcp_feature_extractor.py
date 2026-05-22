import numpy as np


MCP_SCHEMA_VERSION = 1
MCP_FEATURE_COUNT = 35


class MCPFeatureExtractor:
    """
    Extracts 35-feature vector from maternal/child clinical data.
    Separate from general FeatureExtractor — never mix.
    """

    SCHEMA_VERSION = MCP_SCHEMA_VERSION
    FEATURE_COUNT = MCP_FEATURE_COUNT

    def extract_maternal(self, patient, latest_anc=None):
        features = np.zeros(MCP_FEATURE_COUNT, dtype=np.float32)

        features[0] = patient.age_years or 25
        features[1] = patient.gravida or 1
        features[2] = patient.para or 0

        obst_comps = patient.obstetric_complications or []
        features[3] = 1.0 if "LSCS" in obst_comps else 0.0
        features[4] = 1.0 if "PPH" in obst_comps else 0.0

        features[5] = getattr(latest_anc, "pog_weeks", 20) or 20
        features[6] = patient.anc_visit_count or 0
        features[7] = 0.0

        if latest_anc:
            features[8] = latest_anc.hemoglobin_gms or 0.0
            features[9] = latest_anc.bp_systolic or 0.0
            features[10] = latest_anc.bp_diastolic or 0.0
        else:
            features[8] = 11.0
            features[9] = 110.0
            features[10] = 70.0

        if latest_anc:
            features[11] = 0.0
            features[12] = 1.0 if latest_anc.pallor == "present" else 0.0
            fm = (latest_anc.fetal_movements or "normal").lower()
            features[13] = {"absent": 2.0, "reduced": 1.0}.get(fm, 0.0)
            features[14] = latest_anc.fetal_heart_rate or 130.0
            features[15] = latest_anc.fundal_height_cm or 20.0
            lp = (latest_anc.lie_presentation or "").lower()
            features[16] = 0.0 if lp in ("head", "cephalic", "") else 1.0
            features[17] = 1.0 if latest_anc.urine_albumin == "positive" else 0.0
            features[18] = 1.0 if latest_anc.gdm_screening == "positive" else 0.0
            features[19] = 1.0 if latest_anc.hiv_screening == "positive" else 0.0
            features[20] = 1.0 if getattr(latest_anc, "hbsag", None) == "positive" else 0.0
            features[21] = 1.0 if latest_anc.oedema == "present" else 0.0
            features[22] = 1.0 if latest_anc.jaundice == "present" else 0.0

        pmh = patient.past_medical_history or []
        features[23] = 1.0 if "TB" in pmh else 0.0
        features[24] = 1.0 if "Hypertension" in pmh else 0.0
        features[25] = 1.0 if "Heart Disease" in pmh else 0.0
        features[26] = 1.0 if "Diabetes" in pmh else 0.0
        features[27] = 1.0 if "Anaemia" in pmh else 0.0

        return features

    def extract_child(self, patient, latest_growth=None, missed_vaccines=0, latest_milestone=None):
        features = np.zeros(MCP_FEATURE_COUNT, dtype=np.float32)

        features[0] = patient.age_years or 2

        features[28] = float(patient.age_years * 12 if patient.age_years else 12)
        features[29] = patient.birth_weight_kg or 2.8

        if latest_growth:
            features[30] = latest_growth.wfa_z_score or 0.0
            features[31] = 1.0 if latest_growth.is_faltering else 0.0
            features[34] = latest_growth.muac_cm or 14.0

        features[32] = float(missed_vaccines)
        features[33] = 1.0 if (latest_milestone and latest_milestone.any_warning_sign) else 0.0

        return features
