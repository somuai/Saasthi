#!/usr/bin/env python
"""
Gunicorn + Django startup script for Docker container.
Runs migrations, collects static files, then starts Gunicorn.
"""
import os
import sys
import subprocess

def run_command(cmd, check=True):
    """Run shell command and return exit code."""
    print(f"[start.py] Running: {' '.join(cmd)}", flush=True)
    result = subprocess.run(cmd, check=False)
    if check and result.returncode != 0:
        print(f"[start.py] ERROR: Command failed with exit code {result.returncode}", file=sys.stderr)
        sys.exit(result.returncode)
    return result.returncode

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)) + "/..")
    print("[start.py] Starting Saasthi backend...", flush=True)
    
    # Run migrations
    run_command(["python", "manage.py", "migrate", "--noinput"])
    
    # Collect static files
    run_command(["python", "manage.py", "collectstatic", "--noinput", "--clear"])
    
    # Run Django checks
    run_command(["python", "manage.py", "check"], check=False)
    
    # Start Gunicorn
    gunicorn_cmd = [
        "gunicorn",
        "--bind", "0.0.0.0:8000",
        "--workers", os.environ.get("GUNICORN_WORKERS", "4"),
        "--worker-class", "sync",
        "--worker-tmp-dir", "/dev/shm",
        "--max-requests", "1000",
        "--timeout", "30",
        "--access-logfile", "-",
        "--error-logfile", "-",
        "--log-level", os.environ.get("LOG_LEVEL", "info"),
        "shaasthi_backend.wsgi:application",
    ]
    
    print("[start.py] Starting Gunicorn...", flush=True)
    run_command(gunicorn_cmd, check=False)

if __name__ == "__main__":
    main()
