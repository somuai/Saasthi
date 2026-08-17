#!/usr/bin/env python3
"""Production-readiness static gates for the Saasthi release train.

These checks are intentionally conservative. They do not replace unit,
integration, or device tests; they catch release-blocking configuration and
deployment mistakes before a release candidate reaches a pilot environment.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

EXCLUDED_PARTS = {
    ".git",
    ".pytest_cache",
    ".ruff_cache",
    ".venv",
    "__pycache__",
    "coverage",
    "dist",
    "node_modules",
    "staticfiles",
}


@dataclass(frozen=True)
class Check:
    check_id: str
    ok: bool
    severity: str
    detail: str


def read(rel_path: str) -> str:
    path = ROOT / rel_path
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="ignore")


def exists(rel_path: str) -> bool:
    return (ROOT / rel_path).exists()


def source_files(base: str, suffixes: tuple[str, ...]) -> list[Path]:
    root = ROOT / base
    if not root.exists():
        return []
    files: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix not in suffixes:
            continue
        if any(part in EXCLUDED_PARTS for part in path.relative_to(ROOT).parts):
            continue
        files.append(path)
    return files


def grep_files(paths: list[Path], pattern: str, *, flags: int = 0) -> list[tuple[Path, int, str]]:
    rx = re.compile(pattern, flags)
    matches: list[tuple[Path, int, str]] = []
    for path in paths:
        text = path.read_text(encoding="utf-8", errors="ignore")
        for idx, line in enumerate(text.splitlines(), start=1):
            if rx.search(line):
                matches.append((path, idx, line.strip()))
    return matches


def summarize_matches(matches: list[tuple[Path, int, str]], limit: int = 6) -> str:
    if not matches:
        return "no matches"
    rendered = []
    for path, line_no, line in matches[:limit]:
        rendered.append(f"{path.relative_to(ROOT)}:{line_no}: {line[:120]}")
    suffix = "" if len(matches) <= limit else f" (+{len(matches) - limit} more)"
    return "; ".join(rendered) + suffix


def max_to_version(migrations_text: str) -> int | None:
    versions = [int(match) for match in re.findall(r"toVersion(?:\(|\s*:)\s*(\d+)", migrations_text)]
    return max(versions) if versions else None


def schema_version(schema_text: str) -> int | None:
    match = re.search(r"version:\s*(\d+)", schema_text)
    return int(match.group(1)) if match else None


def add(checks: list[Check], check_id: str, ok: bool, detail: str, severity: str = "BLOCKER") -> None:
    checks.append(Check(check_id=check_id, ok=ok, severity=severity, detail=detail))


def collect_checks() -> list[Check]:
    checks: list[Check] = []

    gitignore = read(".gitignore")
    settings = read("backend/shaasthi_backend/settings.py")
    root_urls = read("backend/shaasthi_backend/urls.py")
    dockerfile = read("backend/Dockerfile")
    start_py = read("backend/scripts/start.py")
    compose = read("docker-compose.yml")
    render = read("render.yaml")
    nginx = read("nginx.conf")
    requirements = read("backend/requirements.txt")
    api_js = read("mobile/src/constants/api.js")
    app_json = read("mobile/app.json")
    ci = read(".github/workflows/ci.yml")
    eval_ci = read(".github/workflows/eval.yml")
    dashboard_main = read("backend/dashboard/src/main.tsx")
    dashboard_urls = read("backend/dashboard/urls.py")
    dashboard_api_views = read("backend/dashboard/api/views.py")
    anm_router = read("backend/api/routers/anm.py")
    ocr_service = read("backend/services/ocr_service.py")
    report_service = read("backend/services/report_service.py")

    add(
        checks,
        "secrets-env-gitignored",
        ".env" in gitignore and ".env.*" in gitignore and "!.env.example" in gitignore,
        ".env, .env.*, and .env.example exception are present in .gitignore",
    )
    add(
        checks,
        "django-secret-key-prod-guard",
        "DJANGO_SECRET_KEY" in settings and "FATAL: DJANGO_SECRET_KEY" in settings and "sys.exit(1)" in settings,
        "Django exits when DJANGO_SECRET_KEY is missing or unsafe for production",
    )
    add(
        checks,
        "django-allowed-hosts-prod-guard",
        "DJANGO_ALLOWED_HOSTS" in settings and "_DEFAULT_HOSTS" in settings and "FATAL: DJANGO_ALLOWED_HOSTS" in settings,
        "Django rejects localhost-only ALLOWED_HOSTS when DJANGO_DEBUG=false",
    )
    add(
        checks,
        "django-secure-cookie-settings",
        all(token in settings for token in ["SESSION_COOKIE_SECURE = True", "SESSION_COOKIE_HTTPONLY = True", "SESSION_COOKIE_SAMESITE = \"Lax\"", "CSRF_COOKIE_SECURE = True"]),
        "secure session and CSRF cookie settings are enabled in production",
    )
    add(
        checks,
        "django-json-renderer-in-prod",
        "if not DEBUG:" in settings and "DEFAULT_RENDERER_CLASSES" in settings and "JSONRenderer" in settings,
        "DRF browsable API is disabled in production",
    )
    add(
        checks,
        "jwt-rotation-blacklist",
        all(token in settings for token in ["rest_framework_simplejwt.token_blacklist", "ROTATE_REFRESH_TOKENS", "BLACKLIST_AFTER_ROTATION"]),
        "JWT refresh rotation and blacklist support are configured",
    )
    add(
        checks,
        "scoped-rate-throttles-configured",
        "ScopedRateThrottle" in settings and '"otp"' in settings and '"sync_push"' in settings and '"sync_pull"' in settings,
        "OTP and sync endpoints have configured ScopedRateThrottle scopes",
    )
    add(
        checks,
        "whitenoise-manifest-static",
        "whitenoise.middleware.WhiteNoiseMiddleware" in settings and "CompressedManifestStaticFilesStorage" in settings,
        "WhiteNoise manifest static storage is configured",
    )
    add(
        checks,
        "collectstatic-post-process-enabled",
        "--no-post-process" not in start_py,
        "startup collectstatic must allow manifest/hash post-processing for CompressedManifestStaticFilesStorage",
    )
    add(
        checks,
        "deploy-check-is-fatal",
        "check --deploy" in start_py and ("--fail-level" in start_py or "check=True" in start_py.split("check\", \"--deploy", 1)[-1][:120]),
        "production startup should fail or CI should fail on manage.py check --deploy warnings",
    )
    add(
        checks,
        "ocr-runtime-installed",
        "pytesseract" not in requirements or ("tesseract-ocr" in dockerfile and "tesseract-ocr-hin" in dockerfile),
        "Docker runtime installs tesseract OCR binaries when pytesseract is a dependency",
    )
    add(
        checks,
        "readiness-endpoints-exposed",
        all(token in root_urls for token in ['path("health/"', 'path("livez/"', 'path("readyz/"']),
        "health, liveness, and readiness endpoints are exposed",
    )
    add(
        checks,
        "container-health-uses-readiness",
        "/readyz/" in dockerfile and "/readyz/" in compose and "/readyz/" in render,
        "Docker, compose, and host health checks should use readiness semantics, not always-200 health",
    )
    add(
        checks,
        "nginx-health-route-valid",
        "/api/health/livez/" not in nginx and ("/health/" in nginx or "/readyz/" in nginx),
        "nginx health route should proxy to a real Django health endpoint",
    )
    add(
        checks,
        "compose-no-dev-code-mount",
        "./backend:/app" not in compose and "../backend:/app" not in compose,
        "root docker-compose does not mount mutable backend source into app services",
    )
    add(
        checks,
        "compose-services-restart",
        compose.count("restart: unless-stopped") >= 4,
        "api, celery worker, celery beat, and nginx use restart: unless-stopped",
    )
    add(
        checks,
        "render-celery-beat-defined",
        "beat" in render.lower() and "celery -A shaasthi_backend beat" in render,
        "Render deployment defines a Celery beat service for scheduled tasks",
    )
    add(
        checks,
        "ci-dashboard-build-gate",
        "backend/dashboard" in ci and "npm run build" in ci,
        "CI builds the Django-hosted dashboard bundle",
    )
    ignored_failure_patterns = [
        r"ruff\s+check.*\|\|\s+true",
        r"pytest.*\|\|\s+true",
        r"npm\s+run\s+(lint|type-check|test|build).*\|\|\s+true",
        r"manage\.py\s+check.*\|\|\s+true",
    ]
    ignored_failures = []
    for workflow_name, workflow_text in [("ci.yml", ci), ("eval.yml", eval_ci)]:
        for pattern in ignored_failure_patterns:
            if re.search(pattern, workflow_text):
                ignored_failures.append(f"{workflow_name}:{pattern}")
    add(
        checks,
        "ci-no-ignored-quality-failures",
        not ignored_failures,
        "quality gates do not hide test/lint/build failures with '|| true'",
    )
    add(
        checks,
        "mobile-prod-api-url-fail-fast",
        "throw new Error" in api_js and "EXPO_PUBLIC_API_URL" in api_js and "__DEV__" in api_js,
        "production mobile builds throw when EXPO_PUBLIC_API_URL is missing",
    )
    direct_console = grep_files(
        [p for p in source_files("mobile/src", (".js", ".jsx", ".ts", ".tsx")) if p.relative_to(ROOT).as_posix() != "mobile/src/utils/logger.js"],
        r"\bconsole\.(log|debug|info|warn|error)\(",
    )
    add(
        checks,
        "mobile-no-direct-console",
        not direct_console,
        f"mobile production code should use src/utils/logger.js; matches: {summarize_matches(direct_console)}",
    )
    schema = schema_version(read("mobile/src/database/schema.js"))
    migration = max_to_version(read("mobile/src/database/migrations.js"))
    add(
        checks,
        "watermelon-schema-migration-version",
        schema is not None and migration is not None and migration >= schema,
        f"WatermelonDB schema version {schema} has a migration path through version {migration}",
    )
    mapbox_scan_paths = []
    for rel_path in ["package.json", "mobile/package.json", "backend/dashboard/package.json"]:
        path = ROOT / rel_path
        if path.exists():
            mapbox_scan_paths.append(path)
    mapbox_scan_paths.extend(source_files("mobile/src", (".js", ".jsx", ".ts", ".tsx")))
    mapbox_scan_paths.extend(source_files("backend/dashboard/src", (".js", ".jsx", ".ts", ".tsx")))
    mapbox_matches = grep_files(mapbox_scan_paths, r"mapbox|@rnmapbox|maplibre-token", flags=re.IGNORECASE)
    add(
        checks,
        "mapbox-not-required",
        not mapbox_matches,
        f"Mapbox SDK/token references should not be required for OSM deployment; matches: {summarize_matches(mapbox_matches)}",
    )
    add(
        checks,
        "anm-api-versioned",
        'path("api/v1/anm/"' in root_urls,
        "ANM API should be mounted under /api/v1/anm/ to match mobile API versioning conventions",
    )
    add(
        checks,
        "dashboard-router-basename",
        'basename="/dashboard"' in dashboard_main or "HashRouter" in dashboard_main,
        "dashboard BrowserRouter needs basename=/dashboard or hash routing when served under /dashboard/",
    )
    add(
        checks,
        "dashboard-spa-direct-link-fallback",
        "re_path" in dashboard_urls and "DashboardSPAView" in dashboard_urls,
        "dashboard URLs should serve the SPA for direct links like /dashboard/patients",
    )
    add(
        checks,
        "dashboard-command-runner-admin-only",
        "class CommandRunner" not in dashboard_api_views or ("IsAdminUser" in dashboard_api_views and "CommandRunner" in dashboard_api_views),
        "dashboard command runner must be admin-only, audited, and isolated from supervisor users",
    )
    sync_tests = "\n".join(path.read_text(encoding="utf-8", errors="ignore") for path in source_files("backend/tests", (".py",)))
    add(
        checks,
        "sync-direct-object-scope-tests",
        bool(re.search(r"household.*(scope|geograph|another|other worker|outside)", sync_tests, re.IGNORECASE))
        and bool(re.search(r"patient.*(scope|geograph|another|other worker|outside)", sync_tests, re.IGNORECASE)),
        "backend tests should reject direct patient/household sync writes outside the authenticated worker scope",
    )
    add(
        checks,
        "anm-ocr-endpoint-present",
        "OCRService" in ocr_service and "ocr-extract" in anm_router,
        "ANM OCR extraction service and route are present",
        severity="WARN",
    )
    add(
        checks,
        "monthly-report-service-present",
        "reportlab" in requirements and "MonthlyReportService" in report_service and "reports/monthly" in anm_router,
        "monthly report service and ANM report routes are present",
        severity="WARN",
    )
    add(
        checks,
        "mobile-extra-api-base-url-empty",
        '"apiBaseUrl": ""' in app_json or '"apiBaseUrl"' not in app_json,
        "app.json does not embed a non-empty API URL; production should use EXPO_PUBLIC_API_URL secrets",
        severity="WARN",
    )

    return checks


def main() -> int:
    parser = argparse.ArgumentParser(description="Saasthi production readiness static gates")
    parser.add_argument("--fail-on-warn", action="store_true", help="Treat warnings as failures")
    args = parser.parse_args()

    checks = collect_checks()
    failed = [check for check in checks if not check.ok and (check.severity == "BLOCKER" or args.fail_on_warn)]
    warned = [check for check in checks if not check.ok and check.severity == "WARN"]

    for check in checks:
        if check.ok:
            status = "PASS"
        elif check.severity == "WARN" and not args.fail_on_warn:
            status = "WARN"
        else:
            status = "FAIL"
        print(f"[{status}] {check.check_id} - {check.detail}")

    print()
    print(f"Production readiness: {len(checks) - len(failed) - len(warned)} passed, {len(warned)} warnings, {len(failed)} blockers")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
