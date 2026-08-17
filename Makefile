.PHONY: eval eval-offline eval-production eval-production-offline eval-tier1 eval-tier2 eval-tier6 verify

verify:
	cd mobile && npm run verify

eval:
	python3 eval/run.py

eval-offline:
	DJANGO_DEBUG=true DJANGO_SECRET_KEY=ci-key-not-for-prod DATABASE_URL=sqlite:///tmp/ci.db CELERY_TASK_ALWAYS_EAGER=true EXPOSE_DEBUG_OTP=true python3 eval/run.py --offline

eval-production:
	python3 eval/run.py --production --verbose

eval-production-offline:
	DJANGO_DEBUG=true DJANGO_SECRET_KEY=ci-key-not-for-prod DATABASE_URL=sqlite:///tmp/ci.db CELERY_TASK_ALWAYS_EAGER=true EXPOSE_DEBUG_OTP=true python3 eval/run.py --offline --production --verbose

eval-tier1:
	cd mobile && npx jest --watchAll=false --passWithNoTests

eval-tier2:
	cd backend && DJANGO_SETTINGS_MODULE=shaasthi_backend.settings . .venv/bin/activate && python -m pytest -v

eval-tier6:
	python3 eval/run.py --tier 6 --verbose
