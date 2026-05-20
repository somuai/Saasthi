"""Redact PHI/PII before writing structured logs."""

from __future__ import annotations

import copy
import re

SENSITIVE_KEYS = frozenset(
    {
        "answers",
        "full_name",
        "phone",
        "name",
        "patient_name",
        "address",
        "metadata",
        "explanation",
        "explanations",
        "score_snapshot",
        "aadhaar",
        "date_of_birth",
    }
)

_PHONE_RE = re.compile(r"\+?\d{10,}")


def _redact_value(key: str, value):
    if key in SENSITIVE_KEYS:
        if isinstance(value, dict):
            return {"_redacted": True, "keys": list(value.keys())[:20]}
        if isinstance(value, list):
            return {"_redacted": True, "len": len(value)}
        return "[redacted]"
    if isinstance(value, str) and _PHONE_RE.search(value):
        return "[redacted]"
    return value


def redact_for_log(payload, *, max_depth: int = 6):
    """Return a copy safe for INFO-level logging."""

    def walk(obj, depth):
        if depth > max_depth:
            return "[truncated]"
        if isinstance(obj, dict):
            return {k: walk(_redact_value(k, v), depth + 1) for k, v in obj.items()}
        if isinstance(obj, list):
            return [walk(item, depth + 1) for item in obj[:50]]
        return obj

    if payload is None:
        return None
    return walk(copy.deepcopy(payload), 0)
