# Risk Rule Contract

## Risk Output

```json
{
  "score": 82,
  "riskLevel": "critical",
  "riskLevelHi": "गंभीर",
  "riskColor": "#C0392B",
  "triggeredFactors": [
    {
      "factor": "severe_breathing",
      "labelHi": "गंभीर सांस लेने में कठिनाई",
      "labelEn": "Severe Breathing Difficulty",
      "category": "critical",
      "weight": 35
    }
  ],
  "triggeredByCategory": {"critical": []},
  "modelVersion": "rules_v2_mcp_2026",
  "computedAt": "2026-05-18T00:00:00.000Z"
}
```

## Thresholds

- `low`: 0-25
- `medium`: 26-50
- `high`: 51-75
- `critical`: 76-100

## MVP Rule Policy

- Rules are explainable and versioned.
- Critical red flags create local flags and follow-ups before sync.
- Random Forest output is advisory and must not suppress rule-based critical alerts.
- Rules must not infer prenatal fetal sex or encode referral-volume incentives.

