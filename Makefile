.PHONY: up down check test test-local chat health logs help clean

# ──────────────────────────────────────────────
# argus-ai — Developer Makefile
# ──────────────────────────────────────────────

APP_PORT ?= 3000

# Detect Docker Compose command (v2 uses "docker compose", v1 uses "docker-compose")
DOCKER_COMPOSE := $(shell command -v docker-compose >/dev/null 2>&1 && echo "docker-compose" || echo "docker compose")

up: ## Start dev stack (Docker + NestJS watch mode)
	$(DOCKER_COMPOSE) -f docker-compose.dev.yml up -d && \
		echo "Waiting for Docker services to be ready..." && \
		sleep 3 && \
		npm run start:dev

down: ## Stop dev stack
	$(DOCKER_COMPOSE) -f docker-compose.dev.yml down

clean: ## Stop and remove all containers, networks, and volumes
	$(DOCKER_COMPOSE) down -v

check: ## Type-check and lint
	npx tsc --noEmit && npm run lint

test: ## Run tests
	npm test

test-local: ## Boot stack, run tsc + tests, hit /health endpoint
	@command -v curl >/dev/null 2>&1 || { echo "❌ curl is required but not installed. Install it with: sudo apt-get install -y curl"; exit 1; }
	@command -v docker >/dev/null 2>&1 || { echo "❌ docker is required but not installed."; exit 1; }
	$(DOCKER_COMPOSE) up -d
	@echo "Waiting for health..."
	@i=1; while [ $$i -le 30 ]; do \
	  if curl -sf http://localhost:$(APP_PORT)/health > /dev/null 2>&1; then \
	    echo "✅ Health check passed"; \
	    break; \
	  fi; \
	  if [ $$i -eq 30 ]; then \
	    echo "❌ Health check failed after 30 attempts"; \
	    $(DOCKER_COMPOSE) logs argus-ai; \
	    $(DOCKER_COMPOSE) down -v; \
	    exit 1; \
	  fi; \
	  sleep 2; \
	  i=$$(($$i + 1)); \
	done
	npx tsc --noEmit || { $(DOCKER_COMPOSE) down -v; exit 1; }
	npm test || { $(DOCKER_COMPOSE) down -v; exit 1; }
	@echo "✅ argus-ai local test passed"
	@$(DOCKER_COMPOSE) down -v

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
	$(DOCKER_COMPOSE) -f docker-compose.dev.yml logs -f

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-12s\033[0m %s\n", $$1, $$2}'
