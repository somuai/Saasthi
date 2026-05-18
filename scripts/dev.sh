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
pip install -q -r requirements/dev.txt
pip install -q -r ../eval/requirements.txt
python manage.py migrate --noinput
python manage.py migrate accounts 0001 --fake 2>/dev/null || true
echo "==> Generating demo sync data (optional)..."
python manage.py generate_mock_data --workers 1 --patients 3 2>/dev/null || true
echo "==> Starting API on http://127.0.0.1:8000"
python manage.py runserver 127.0.0.1:8000
