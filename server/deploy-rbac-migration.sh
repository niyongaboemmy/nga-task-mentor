#!/bin/bash
#
# RBAC rollout deploy script — run this ON the production server, from the
# repo root, after pulling commit adaab71 (or later) on the `main` branch.
#
# What it does, in order:
#   1. Confirms you're on the right commit and shows pending migrations
#      BEFORE touching anything, so you can abort if something looks off.
#   2. Builds the server (dist/) and client (dist/).
#   3. Runs `npm run migrate` — this applies the 5 new RBAC migrations
#      (roles/permissions/role_permissions tables, role_id on users, seed
#      data, and the QUIZZES_MANAGE_ANY/QUESTION_BANK_MANAGE_ANY backfill)
#      plus any other migrations already pending on this DB. It is safe to
#      re-run: Sequelize tracks applied migrations and skips them.
#   4. Restarts the API process via pm2.
#
# It does NOT touch client-side file upload to cPanel — copy client/dist/
# to your usual public_html location yourself afterward (see
# DEPLOYMENT_CHECKLIST.md), since that step varies by hosting setup.
#
# Safe to Ctrl-C at any prompt; nothing destructive runs before the
# migration step, and the migration step itself only adds tables/columns
# (no drops) per the migration files under server/migrations/.

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo -e "${YELLOW}== 1. Pre-flight checks ==${NC}"
echo "Repo root: $REPO_ROOT"
echo "Current commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'not a git checkout')"
echo "Current branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"

read -p "Continue with build + migrate + restart? [y/N] " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

echo -e "${YELLOW}== 2. Building server ==${NC}"
cd "$REPO_ROOT/server"
npm install
npm run build
if [ ! -f "dist/index.js" ]; then
  echo -e "${RED}Error: dist/index.js not found after build. Aborting before migrate.${NC}"
  exit 1
fi

echo -e "${YELLOW}== 3. Building client ==${NC}"
cd "$REPO_ROOT/client"
npm install
npm run build
if [ ! -d "dist" ]; then
  echo -e "${RED}Error: client dist/ not found after build.${NC}"
  exit 1
fi
echo -e "${GREEN}Client build ready at client/dist/ — copy this to your public_html per your usual cPanel step.${NC}"

echo -e "${YELLOW}== 4. Migration status BEFORE migrating ==${NC}"
cd "$REPO_ROOT/server"
npm run migrate:status

read -p "Apply the pending migrations shown above? [y/N] " CONFIRM_MIGRATE
if [[ "$CONFIRM_MIGRATE" != "y" && "$CONFIRM_MIGRATE" != "Y" ]]; then
  echo "Skipped migration. You can run 'npm run migrate' manually later."
else
  echo -e "${YELLOW}== 5. Running migrations ==${NC}"
  npm run migrate
  echo -e "${GREEN}Migration status after:${NC}"
  npm run migrate:status
fi

echo -e "${YELLOW}== 6. Restarting API process ==${NC}"
if command -v pm2 &> /dev/null; then
  pm2 restart spwms-api || echo -e "${RED}pm2 restart failed — check the process name with 'pm2 list' and restart manually.${NC}"
  pm2 save
else
  echo -e "${RED}pm2 not found on this server — restart the Node process manually (however you normally do it).${NC}"
fi

echo -e "${GREEN}Done. Verify by hitting GET /health and logging in as each role to confirm sidebar/permissions look right.${NC}"
