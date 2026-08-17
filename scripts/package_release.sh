#!/usr/bin/env bash
# Saasthi Release Packaging Script
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "========================================================"
echo "  Packaging Saasthi Production Release Bundle"
echo "========================================================"

python3 "${SCRIPT_DIR}/release_toolkit.py" --all "$@"
