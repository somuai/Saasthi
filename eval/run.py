#!/usr/bin/env python3
"""SHAASTHI eval orchestrator — runs T1–T5 and writes eval/report.json."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVAL_DIR = Path(__file__).resolve().parent
REPORT_PATH = EVAL_DIR / "report.json"


def run_cmd(name: str, cmd: list[str], cwd: Path | None = None, env: dict | None = None) -> dict:
    started = time.time()
    merged_env = {**os.environ, **(env or {})}
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(cwd or ROOT),
            env=merged_env,
            capture_output=True,
            text=True,
            timeout=300,
        )
        ok = proc.returncode == 0
        return {
            "name": name,
            "ok": ok,
            "exit_code": proc.returncode,
            "duration_sec": round(time.time() - started, 2),
            "stdout_tail": (proc.stdout or "")[-2000:],
            "stderr_tail": (proc.stderr or "")[-2000:],
        }
    except subprocess.TimeoutExpired as exc:
        return {
            "name": name,
            "ok": False,
            "exit_code": -1,
            "duration_sec": round(time.time() - started, 2),
            "stdout_tail": (exc.stdout or "")[-2000:] if exc.stdout else "",
            "stderr_tail": "timeout",
        }


def tier_jest() -> dict:
    return run_cmd("T1_jest", ["npm", "test"], cwd=ROOT / "mobile")


def tier_django() -> dict:
    venv_python = ROOT / "backend" / ".venv" / "bin" / "python"
    python = str(venv_python) if venv_python.exists() else sys.executable
    return run_cmd("T2_django", [python, "-m", "pytest", "tests/", "-v", "--tb=short"], cwd=ROOT / "backend")


def tier_contracts(offline: bool) -> dict:
    cmd = ["node", str(EVAL_DIR / "validate-contracts.mjs")]
    if offline:
        cmd.append("--offline")
    return run_cmd("T3_contracts", cmd, cwd=ROOT)


def _api_python() -> str:
    venv_python = ROOT / "backend" / ".venv" / "bin" / "python"
    return str(venv_python) if venv_python.exists() else sys.executable


def tier_scenarios(offline: bool) -> list[dict]:
    if offline:
        return [{"name": "T4_live_api", "ok": True, "skipped": True, "reason": "--offline"}]
    python = _api_python()
    scenarios_dir = EVAL_DIR / "scenarios"
    results = []
    for script in sorted(scenarios_dir.glob("*.py")):
        if script.name.startswith("_"):
            continue
        results.append(
            run_cmd(
                f"T4_{script.stem}",
                [python, str(script)],
                cwd=ROOT,
                env={"SHAASTHI_API_URL": os.getenv("SHAASTHI_API_URL", "http://127.0.0.1:8000")},
            )
        )
    return results


def tier_compliance() -> dict:
    return run_cmd("T5_compliance", [_api_python(), str(EVAL_DIR / "compliance_check.py")], cwd=ROOT)


def main() -> int:
    parser = argparse.ArgumentParser(description="SHAASTHI eval suite")
    parser.add_argument("--offline", action="store_true", help="Skip live API tiers (T3 live, T4)")
    parser.add_argument("--tier", type=int, choices=[1, 2, 3, 4, 5], help="Run single tier only")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    report = {"started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "tiers": []}
    all_ok = True

    def record(tier_name: str, results):
        nonlocal all_ok
        if isinstance(results, dict):
            results = [results]
        tier_ok = all(r.get("ok") or r.get("skipped") for r in results)
        if not tier_ok:
            all_ok = False
        report["tiers"].append({"tier": tier_name, "results": results})
        for r in results:
            status = "SKIP" if r.get("skipped") else ("PASS" if r.get("ok") else "FAIL")
            print(f"[{status}] {r['name']}")
            if args.verbose and not r.get("ok") and not r.get("skipped"):
                if r.get("stderr_tail"):
                    print(r["stderr_tail"])
                if r.get("stdout_tail"):
                    print(r["stdout_tail"])

    if args.tier is None or args.tier == 1:
        record("T1", tier_jest())
    if args.tier is None or args.tier == 2:
        record("T2", tier_django())
    if args.tier is None or args.tier == 3:
        record("T3", tier_contracts(args.offline))
    if args.tier is None or args.tier == 4:
        record("T4", tier_scenarios(args.offline))
    if args.tier is None or args.tier == 5:
        record("T5", tier_compliance())

    report["ok"] = all_ok
    report["finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nReport: {REPORT_PATH}")
    print("OVERALL:", "PASS" if all_ok else "FAIL")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
