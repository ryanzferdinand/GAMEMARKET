#!/bin/bash
# =============================================================================
#  GameMarket — Rollback Script
#  Kembali ke commit Git sebelumnya jika deploy baru bermasalah
#  Usage: bash scripts/vps-rollback.sh
#         bash scripts/vps-rollback.sh <commit-hash>
# =============================================================================

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
log()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()   { echo -e "${YELLOW}[!]${NC} $1"; }
error()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info()   { echo -e "${CYAN}[→]${NC} $1"; }
header() { echo -e "\n${BLUE}══════════════════════════════════════${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}══════════════════════════════════════${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

VPS_CONFIG="$HOME/vps-config.env"
[ -f "$VPS_CONFIG" ] && source "$VPS_CONFIG"
APP_NAME=${APP_NAME:-gamemarket-backend}

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

header "GameMarket Rollback"

cd "$APP_DIR"
[ -d .git ] || error "Bukan Git repo — tidak bisa rollback"

CURRENT=$(git rev-parse --short HEAD)
TARGET="${1:-}"

if [ -z "$TARGET" ]; then
  echo ""
  info "5 commit terakhir:"
  git log --oneline -5
  echo ""
  TARGET=$(git rev-parse --short HEAD~1)
  warn "Akan rollback ke commit sebelumnya: $TARGET"
  read -p "Lanjutkan? (y/N): " CONFIRM
  [[ "$CONFIRM" =~ ^[Yy]$ ]] || { echo "Dibatalkan."; exit 0; }
fi

info "Rollback: $CURRENT → $TARGET"
git checkout "$TARGET"

# Rebuild
info "Rebuild backend ..."
cd "$APP_DIR/backend"
npm install --omit=dev --prefer-offline 2>&1 | tail -2

info "Rebuild frontend ..."
cd "$APP_DIR/frontend"
npm install --prefer-offline 2>&1 | tail -2
npm run build 2>&1 | tail -3

info "Restart PM2 ..."
pm2 restart "$APP_NAME" --update-env

sleep 3
PORT=$(grep -E "^PORT=" "$APP_DIR/backend/.env" | cut -d= -f2 || echo "5000")
PORT=${PORT:-5000}
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/api/health" 2>/dev/null || echo "000")

echo ""
if [ "$HEALTH" = "200" ]; then
  log "Rollback berhasil ke commit: $TARGET"
else
  warn "Health check gagal (HTTP $HEALTH) — cek: pm2 logs $APP_NAME"
fi

info "Untuk kembali ke versi terbaru: git checkout main && bash scripts/vps-deploy.sh"
