.PHONY: eval eval-offline eval-tier1 eval-tier2

eval:
	python3 eval/run.py

eval-offline:
	python3 eval/run.py --offline

eval-tier1:
	cd medilift-app && npm test

eval-tier2:
	cd medilift-api && . .venv/bin/activate && python manage.py test tests
