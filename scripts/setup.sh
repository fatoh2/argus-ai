#!/bin/bash
set -euo pipefail

# ──────────────────────────────────────────────
# argus-ai — One-command local setup
# ──────────────────────────────────────────────
# Checks prerequisites, creates .env, installs deps,
# pulls Docker images, and prints next steps.
# ──────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { printf "${CYAN}ℹ %s${NC}\n" "$*"; }
ok()    { printf "${GREEN}✓ %s${NC}\n" "$*"; }
warn()  { printf "${YELLOW}⚠ %s${NC}\n" "$*"; }
err()   { printf "${RED}✗ %s${NC}\n" "$*"; }

# ── 1. Check Node.js ──────────────────────────
info "Checking Node.js version..."

if ! command -v node &>/dev/null; then
  err "Node.js is not installed."
  echo "  Install Node.js v20 or later: https://nodejs.org/"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  err "Node.js v20+ is required (found v$(node -v | sed 's/v//'))."
  echo "  Upgrade Node.js: https://nodejs.org/"
  exit 1
fi

ok "Node.js $(node -v) detected."

# ── 2. Check npm ──────────────────────────────
info "Checking npm..."

if ! command -v npm &>/dev/null; then
  err "npm is not installed."
  echo "  npm is bundled with Node.js — reinstall Node.js from https://nodejs.org/"
  exit 1
fi

ok "npm $(npm -v) detected."

# ── 3. Check Docker ───────────────────────────
info "Checking Docker..."

if ! command -v docker &>/dev/null; then
  err "Docker is not installed."
  echo "  Install Docker: https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker info &>/dev/null; then
  err "Docker is installed but not running."
  echo "  Start Docker Desktop or the Docker daemon and try again."
  exit 1
fi

ok "Docker is running."

# ── 4. Create .env from .env.example ──────────
info "Setting up environment variables..."

if [ -f .env ]; then
  warn ".env already exists — skipping."
else
  if [ ! -f .env.example ]; then
    err ".env.example not found. Are you in the project root?"
    exit 1
  fi
  cp .env.example .env
  ok ".env created from .env.example."
  warn "Don't forget to add your DEEPSEEK_API_KEY to .env!"
fi

# ── 5. Install npm dependencies ───────────────
info "Installing npm dependencies..."
npm install --no-workspaces
ok "npm dependencies installed."

# ── 6. Pull Docker images ─────────────────────
info "Pulling Docker images for the dev stack..."

if [ -f docker-compose.dev.yml ]; then
  docker compose -f docker-compose.dev.yml pull
  ok "Docker images pulled."
else
  warn "docker-compose.dev.yml not found — skipping Docker pull."
fi

# ── 7. Done ───────────────────────────────────
echo ""
printf "${GREEN}✅ Setup complete.${NC}\n"
echo ""
echo "  Next steps:"
echo "    1. Edit .env and add your DEEPSEEK_API_KEY"
echo "    2. Run:  make up"
echo ""
echo "  Or start services individually:"
echo "    docker compose -f docker-compose.dev.yml up -d"
echo "    npm run start:dev"
echo ""
