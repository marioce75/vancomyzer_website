.PHONY: run venv curl-health curl-auc

run:
	@bash ./run.sh

venv:
	@python3 -m venv .venv
	@. .venv/bin/activate && pip install --upgrade pip
	@. .venv/bin/activate && pip install -r backend/requirements.txt
	@echo "✅ venv ready at .venv"

curl-health:
	@curl -i http://127.0.0.1:8000/api/health

curl-auc:
	@curl -i -X POST http://127.0.0.1:8000/api/interactive/auc -H "Content-Type: application/json" -d '{"dose_mg":1000,"interval_hr":12}'
