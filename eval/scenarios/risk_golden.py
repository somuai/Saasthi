#!/usr/bin/env python3
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main() -> int:
    proc = subprocess.run(
        ["npm", "test", "--", "--testPathPattern=riskGolden"],
        cwd=ROOT / "shaasthi-app",
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print(proc.stdout[-1500:])
        print(proc.stderr[-1500:])
        print("FAIL risk_golden")
        return 1
    print("PASS risk_golden")
    return 0


if __name__ == "__main__":
    sys.exit(main())
