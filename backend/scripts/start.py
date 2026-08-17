#!/usr/bin/env python
"""
Production startup script for Docker container.
Runs migrations, collects static files, then execs into Gunicorn
so that signals (SIGTERM, SIGINT) reach the worker process directly.
"""

import os
import sys


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)) + "/..")

    # Run migrations
    _run(["python", "manage.py", "migrate", "--noinput"])

    # Collect static files
    _run(["python", "manage.py", "collectstatic", "--noinput", "--clear", "--no-post-process"])

    # Validate deployment config (non-fatal)
    _run(["python", "manage.py", "check", "--deploy"], check=False)

    # Exec Gunicorn — replaces this process so signals propagate correctly
    gunicorn_args = [
        "gunicorn",
        "--bind",
        "0.0.0.0:8000",
        "--workers",
        os.environ.get("GUNICORN_WORKERS", "4"),
        "--worker-class",
        "sync",
        "--worker-tmp-dir",
        "/dev/shm",
        "--max-requests",
        "1000",
        "--max-requests-jitter",
        "50",
        "--timeout",
        "30",
        "--graceful-timeout",
        "30",
        "--keep-alive",
        "5",
        "--access-logfile",
        "-",
        "--error-logfile",
        "-",
        "--log-level",
        os.environ.get("GUNICORN_LOG_LEVEL", "info"),
        "shaasthi_backend.wsgi:application",
    ]
    os.execvp("gunicorn", gunicorn_args)


def _run(cmd, check=True):
    import subprocess

    print(f"[start.py] Running: {' '.join(cmd)}", flush=True)
    result = subprocess.run(cmd, check=False)
    if check and result.returncode != 0:
        print(f"[start.py] ERROR: Command failed with exit code {result.returncode}", file=sys.stderr)
        sys.exit(result.returncode)
    return result.returncode


if __name__ == "__main__":
    main()
