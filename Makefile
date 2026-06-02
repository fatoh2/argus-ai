.PHONY: up down check test test-local chat health logs help

# ──────────────────────────────────────────────
# argus-ai — Developer Makefile
# ──────────────────────────────────────────────

APP_PORT ?= 3000

up: ## Start dev stack (Docker + NestJS watch mode)
	docker compose -f docker-compose.dev.yml up -d && \
		echo "Waiting for Docker services to be ready..." && \
		sleep 3 && \
		npm run start:dev

down: ## Stop dev stack
	docker compose -f docker-compose.dev.yml down

check: ## Type-check and lint
	npx tsc --noEmit && npm run lint

test: ## Run tests
	npm test

test-local: ## Boot stack, run tsc + tests, hit /health endpoint
	docker compose up -d
	@echo "Waiting for health..."
	@for i in $$(seq 1 30); do \
	  curl -sf http://localhost:3000/health && break || sleep 2; \
	done
	npx tsc --noEmit
	npm test
	curl -sf http://localhost:3000/health | grep -q ok
	@echo "✅ argus-ai local test passed"

chat: ## Send a message to the chat API — usage: make chat MSG="hello"
	@if [ -z "$(MSG)" ]; then \
		echo "Usage: make chat MSG=\"your message\""; \
		exit 1; \
	fi
	@printf '%s' '$(MSG)' | jq -Rs '{message: .}' | \
		curl -s -X POST http://localhost:$(APP_PORT)/chat \
			-H "Content-Type: application/json" \
			-d @- | jq .

health: ## Check LLM health endpoint
	curl -s http://localhost:$(APP_PORT)/health/llm | jq .

logs: ## Tail Docker logs
	docker compose -f docker-compose.dev.yml logs -f

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-12s\033[0m %s\n", $$1, $$2}'
