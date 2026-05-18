.PHONY: test test-backend test-mobile lint-backend lint-mobile

test: test-backend test-mobile

test-backend:
	cd medilift-backend && pytest

test-mobile:
	cd medilift-app && npm test -- --runInBand

lint-backend:
	cd medilift-backend && ruff check .

lint-mobile:
	cd medilift-app && npm run lint

