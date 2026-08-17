#!/usr/bin/env python3
"""
Saasthi Release Toolkit (retk)
------------------------------
A comprehensive utility for performing pre-flight verification, testing,
version validation, artifact packaging, and release deployment preparation.
"""

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tarfile
from datetime import datetime
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
MOBILE_DIR = ROOT_DIR / "mobile"
DASHBOARD_DIR = ROOT_DIR / "dashboard"
DIST_DIR = ROOT_DIR / "dist"

VERSION = "1.0.0"


def print_banner():
    print("=" * 70)
    print(f"  SAASTHI RELEASE TOOLKIT (retk) — v{VERSION}")
    print("  Digital Health Platform for India's ASHA Workers")
    print("=" * 70)


def run_command(cmd, cwd, description):
    print(f"[*] {description}...")
    try:
        res = subprocess.run(
            cmd,
            cwd=str(cwd),
            shell=True,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        print(f"    [SUCCESS] {description}")
        return True, res.stdout
    except subprocess.CalledProcessError as e:
        print(f"    [FAILED] {description}")
        print(f"    Error: {e.stderr.strip() or e.stdout.strip()}")
        return False, e.stderr


def check_preflight():
    print("\n--- Running Pre-Flight Verification ---")
    results = {}

    # 1. Backend Linting
    venv_ruff = ROOT_DIR / ".venv" / "bin" / "ruff"
    ruff_cmd = f"{venv_ruff} check ." if venv_ruff.exists() else "ruff check ."
    ok, _ = run_command(ruff_cmd, BACKEND_DIR, "Backend Ruff Linting")
    results["backend_lint"] = ok

    # 2. Backend Pytest
    venv_pytest = ROOT_DIR / ".venv" / "bin" / "pytest"
    pytest_cmd = f"{venv_pytest}" if venv_pytest.exists() else "pytest"
    ok, out = run_command(pytest_cmd, BACKEND_DIR, "Backend Pytest Suite (490+ tests)")
    results["backend_tests"] = ok

    # 3. Mobile ESLint
    ok, _ = run_command("npx eslint src/", MOBILE_DIR, "Mobile ESLint Checks")
    results["mobile_lint"] = ok

    # 4. Mobile Jest Tests
    ok, _ = run_command("npx jest --no-watchman", MOBILE_DIR, "Mobile Jest Test Suite")
    results["mobile_tests"] = ok

    # 5. Dashboard TypeScript Type Check
    ok, _ = run_command("npx tsc --noEmit", DASHBOARD_DIR, "Dashboard TypeScript Compilation")
    results["dashboard_typecheck"] = ok

    all_passed = all(results.values())
    print("\nPre-Flight Summary:")
    for check, passed in results.items():
        status_str = "PASSED" if passed else "FAILED"
        print(f"  - {check:<25}: {status_str}")

    if all_passed:
        print("\n>>> ALL PRE-FLIGHT CHECKS PASSED SUCCESSFULLY! Ready for release.")
    else:
        print("\n>>> PRE-FLIGHT VERIFICATION FAILED. Please resolve errors before packaging.")
    return all_passed


def compute_sha256(filepath):
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()


def package_release(target_version=VERSION):
    print(f"\n--- Packaging Saasthi Release v{target_version} ---")
    DIST_DIR.mkdir(exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    archive_name = f"saasthi_release_v{target_version}_{timestamp}.tar.gz"
    archive_path = DIST_DIR / archive_name

    include_paths = [
        ("backend", "backend"),
        ("dashboard", "dashboard"),
        ("mobile", "mobile"),
        ("docs", "docs"),
        ("k8s", "k8s"),
        ("docker-compose.yml", "docker-compose.yml"),
        ("nginx.conf", "nginx.conf"),
        ("prometheus.yml", "prometheus.yml"),
        ("README.md", "README.md"),
        ("ABOUT.md", "ABOUT.md"),
        ("RELEASE_NOTES.md", "RELEASE_NOTES.md"),
    ]

    exclude_patterns = [
        "node_modules",
        ".venv",
        "__pycache__",
        ".git",
        ".pytest_cache",
        ".ruff_cache",
        ".next",
        "dist",
        "build",
        ".DS_Store",
    ]

    def filter_func(tarinfo):
        for pattern in exclude_patterns:
            if pattern in tarinfo.name.split("/"):
                return None
        return tarinfo

    print(f"[*] Compressing repository artifacts into {archive_name}...")
    with tarfile.open(archive_path, "w:gz") as tar:
        for src, arc in include_paths:
            src_path = ROOT_DIR / src
            if src_path.exists():
                tar.add(src_path, arcname=arc, filter=filter_func)

    checksum = compute_sha256(archive_path)
    checksum_file = DIST_DIR / f"{archive_name}.sha256"
    checksum_file.write_text(f"{checksum}  {archive_name}\n")

    manifest = {
        "project": "Saasthi",
        "version": target_version,
        "release_timestamp": timestamp,
        "archive_file": archive_name,
        "sha256": checksum,
        "git_commit": get_git_commit(),
    }
    manifest_file = DIST_DIR / f"release_manifest_v{target_version}.json"
    manifest_file.write_text(json.dumps(manifest, indent=2))

    print(f"\n[SUCCESS] Release packaged successfully!")
    print(f"  Archive   : {archive_path}")
    print(f"  SHA-256   : {checksum}")
    print(f"  Manifest  : {manifest_file}")


def get_git_commit():
    try:
        res = subprocess.run(
            "GIT_CONFIG_GLOBAL=/dev/null git rev-parse HEAD",
            cwd=str(ROOT_DIR),
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        return res.stdout.strip() if res.returncode == 0 else "unknown"
    except Exception:
        return "unknown"


def main():
    print_banner()
    parser = argparse.ArgumentParser(description="Saasthi Release Toolkit (retk)")
    parser.add_argument("--check", action="store_true", help="Run full pre-flight verification checks")
    parser.add_argument("--package", action="store_true", help="Build clean release tarball and checksums")
    parser.add_argument("--all", action="store_true", help="Run verification checks and build release package")
    parser.add_argument("--version", type=str, default=VERSION, help="Target release version string")

    args = parser.parse_args()

    if args.all or (not args.check and not args.package):
        passed = check_preflight()
        if passed:
            package_release(args.version)
        else:
            sys.exit(1)
    elif args.check:
        passed = check_preflight()
        sys.exit(0 if passed else 1)
    elif args.package:
        package_release(args.version)


if __name__ == "__main__":
    main()
