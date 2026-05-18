#!/usr/bin/env bash
# Start MEDILIFT API + instructions for Expo (run in second terminal).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> MEDILIFT dev bootstrap"
cd "$ROOT/medilift-api"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -r requirements.txt
pip install -q -r requirements-dev.txt
pip install -q -r ../eval/requirements.txt
python manage.py migrate --noinput
echo "==> Starting API on http://127.0.0.1:8000"
python manage.py runserver 127.0.0.1:8000
