"""Redact PHI/PII before writing structured logs + logging filters/formatters."""

from __future__ import annotations

import copy
import json
import logging
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


class PHIRedactionFilter(logging.Filter):
    """Filter that redacts PHI/PII from log record messages and args."""

    def filter(self, record):
        if isinstance(record.msg, str):
            record.msg = _PHONE_RE.sub("[redacted]", record.msg)
        if not record.args:
            return True
        if isinstance(record.args, dict):
            record.args = {k: _redact_value(k, v) for k, v in record.args.items()}
        else:
            redacted = []
            for arg in record.args:
                if isinstance(arg, dict):
                    redacted.append(redact_for_log(arg))
                elif isinstance(arg, str) and _PHONE_RE.search(arg):
                    redacted.append("[redacted]")
                else:
                    redacted.append(arg)
            record.args = tuple(redacted)
        return True


class JsonLogFormatter(logging.Formatter):
    """Output structured JSON logs for production log aggregation."""

    def format(self, record):
        log_entry = {
            "timestamp": self.formatTime(record),
            "name": record.name,
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "func": record.funcName,
            "line": record.lineno,
        }
        if record.exc_info and record.exc_info[0]:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry, default=str)
