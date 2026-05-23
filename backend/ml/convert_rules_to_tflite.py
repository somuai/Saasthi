"""
Export rule weights as a minimal TFLite model for on-device scoring.

Usage:
    python ml/convert_rules_to_tflite.py

Output: mobile/assets/ml/model.json, mobile/assets/ml/weights.bin

This creates a tiny 16→8→1 feedforward network whose weights are
derived from the mobile riskScorer.js rule weights. The model is
designed to approximate the rule-based scoring function so that
TFLite inference produces similar scores.

Requires: tensorflow
    pip install tensorflow
"""

import json
import os
import sys

import numpy as np

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "mobile", "assets", "ml")

os.makedirs(MODEL_DIR, exist_ok=True)

FEATURE_WEIGHTS = [
    ("age_elderly", 15),  # 0: age >= 60
    ("pregnant", 22),  # 1: isPregnant
    ("diabetes", 18),  # 2: hasDiabetes
    ("hypertension", 16),  # 3: hasHypertension
    ("has_tb", 14),  # 4: hasTb
    ("heart_disease", 14),  # 5: hasHeartDisease
    ("hospitalized", 8),  # 6: hospitalizedLastYear
    ("immunization_defaulter", 14),  # 7: immunizationDefaulter
    ("malnutrition", 16),  # 8: weight_for_age_z < -2
    ("severe_breathing", 35),  # 9: severeBreathing
    ("chest_pain", 32),  # 10: chestPain
    ("severe_anemia", 28),  # 11: hemoglobin / 20
    ("tb_cough", 22),  # 12: coughOver2Weeks
    ("fever_3days", 10),  # 13: feverOver3Days
    ("high_risk_pregnancy", 25),  # 14: is_high_risk
    ("age_infant", 12),  # 15: age <= 5
]

try:
    import tensorflow as tf
except ImportError:
    print("tensorflow not installed; generating JSON weights file instead")
    weights = {"features": [{"name": n, "weight": w} for n, w in FEATURE_WEIGHTS]}
    with open(os.path.join(MODEL_DIR, "weights.json"), "w") as f:
        json.dump(weights, f, indent=2)
    print(f"Wrote {MODEL_DIR}/weights.json")
    sys.exit(0)

model = tf.keras.Sequential(
    [
        tf.keras.layers.Dense(16, input_shape=(16,), activation="relu", name="feature_layer"),
        tf.keras.layers.Dense(8, activation="relu", name="hidden_layer"),
        tf.keras.layers.Dense(1, activation="sigmoid", name="output_layer"),
    ]
)


def rule_forward(features):
    score = 0.0
    for i, (name, weight) in enumerate(FEATURE_WEIGHTS):
        if features[i] > 0.5:
            score += weight
    return min(score / 100.0, 1.0)


train_x = np.random.rand(1000, 16).astype(np.float32)
train_y = np.array([[rule_forward(x)] for x in train_x], dtype=np.float32)

model.compile(optimizer="adam", loss="mse", metrics=["mae"])
model.fit(train_x, train_y, epochs=50, batch_size=32, verbose=0)

converter = tf.lite.TFLiteConverter.from_keras_model(model)
tflite_model = converter.convert()

tflite_path = os.path.join(MODEL_DIR, "model.tflite")
with open(tflite_path, "wb") as f:
    f.write(tflite_model)

print(f"TFLite model written to {tflite_path} ({len(tflite_model)} bytes)")
print("To use: copy to mobile/assets/ml/model.tflite and load via TFLiteService")
