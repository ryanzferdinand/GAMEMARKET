#!/bin/bash
# =============================================================================
#  GameMarket — Deploy / Update Script
#  Jalankan setiap kali ada update kode
#  Usage: bash scripts/vps-deploy.sh
#         bash scripts/vps-deploy.sh --skip-frontend   (backend only)
#         bash scripts/vps-deploy.sh --skip-pull       (tanpa git pull)
# =============================================================================

set -e

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
log()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()   { echo -e "${YELLOW}[!]${NC} $1"; }
error()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info()   { echo -e "${CYAN}[→]${NC} $1"; }
header() { echo -e "\n${BLUE}══════════════════════════════════════${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}══════════════════════════════════════${NC}"; }

# ── Detect script location ────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

# ── Load saved VPS config (dari vps-setup.sh) ─────────────────────────────────
VPS_CONFIG="$HOME/vps-config.env"
if [ -f "$VPS_CONFIG" ]; then
  source "$VPS_CONFIG"
  # Override APP_DIR dengan lokasi script ini
  APP_DIR="$(dirname "$SCRIPT_DIR")"
fi

APP_NAME=${APP_NAME:-gamemarket-backend}

# ── Parse flags ───────────────────────────────────────────────────────────────
SKIP_FRONTEND=false
SKIP_PULL=false
for arg in "$@"; do
  case $arg in
    --skip-frontend) SKIP_FRONTEND=true ;;
    --skip-pull)     SKIP_PULL=true ;;
  esac
done

# ── Load nvm ──────────────────────────────────────────────────────────────────
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

# ── Validate ──────────────────────────────────────────────────────────────────
command -v node  &>/dev/null || error "Node.js tidak ditemukan. Jalankan vps-setup.sh dulu."
command -v pm2   &>/dev/null || error "PM2 tidak ditemukan. Install: npm install -g pm2"
[ -d "$APP_DIR/backend" ]  || error "Backend folder tidak ditemukan di: $APP_DIR/backend"
[ -f "$APP_DIR/backend/.env" ] || error ".env tidak ditemukan. Buat dulu: cp backend/.env.example backend/.env"

# ── Check NODE_ENV ────────────────────────────────────────────────────────────
NODE_ENV_VAL=$(grep -E "^NODE_ENV=" "$APP_DIR/backend/.env" | cut -d= -f2 | tr -d '"' | tr -d "'")
if [ "$NODE_ENV_VAL" != "production" ]; then
  warn "NODE_ENV bukan 'production' di .env (saat ini: '${NODE_ENV_VAL:-kosong}')"
  read -p "Lanjutkan tetap? (y/N): " CONT
  [[ "$CONT" =~ ^[Yy]$ ]] || exit 0
fi

header "GameMarket Deploy — $(date '+%Y-%m-%d %H:%M:%S')"
info "App dir : $APP_DIR"
info "PM2 name: $APP_NAME"
echo ""

# ── 1. Git pull ───────────────────────────────────────────────────────────────
if [ "$SKIP_PULL" = false ]; then
  header "1 — Git Pull"
  cd "$APP_DIR"
  if [ -d .git ]; then
    PREV_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    git fetch origin
    git pull origin "$(git rev-parse --abbrev-ref HEAD)"
    NEW_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    log "Updated: $PREV_COMMIT → $NEW_COMMIT"
  else
    warn "Bukan Git repo — skip pull"
  fi
else
  warn "Git pull diskip (--skip-pull)"
fi

# ── 2. Backend dependencies ───────────────────────────────────────────────────
header "2 — Backend Dependencies"
cd "$APP_DIR/backend"
info "Running npm install --omit=dev ..."
npm install --omit=dev --prefer-offline 2>&1 | tail -3
log "Backend dependencies ok"

# ── 3. Build frontend ─────────────────────────────────────────────────────────
if [ "$SKIP_FRONTEND" = false ]; then
  header "3 — Frontend Build"
  cd "$APP_DIR/frontend"

  # Pastikan frontend/.env ada
  if [ ! -f .env ]; then
    if [ -f .env.example ]; then
      cp .env.example .env
      warn "frontend/.env dibuat dari .env.example — cek isinya!"
    fi
  fi

  info "Running npm install ..."
  npm install --prefer-offline 2>&1 | tail -3
  info "Building production bundle ..."
  npm run build 2>&1 | tail -5
  log "Frontend build selesai → dist/"
else
  warn "Frontend build diskip (--skip-frontend)"
fi

# ── 4. Restart backend ────────────────────────────────────────────────────────
header "4 — Restart Backend (PM2)"
cd "$APP_DIR/backend"

ECOSYSTEM="$APP_DIR/backend/ecosystem.config.cjs"

if pm2 describe "$APP_NAME" &>/dev/null; then
  info "Restarting PM2 process '$APP_NAME' ..."
  pm2 restart "$APP_NAME" --update-env
  log "Backend restarted"
else
  info "Starting PM2 dari ecosystem config ..."
  if [ -f "$ECOSYSTEM" ]; then
    pm2 start "$ECOSYSTEM" --env production
  else
    pm2 start server.js \
      --name "$APP_NAME" \
      --max-memory-restart 512M \
      --exp-backoff-restart-delay=100 \
      --log-date-format "YYYY-MM-DD HH:mm:ss"
  fi
  pm2 save
  # Setup auto-start saat reboot (hanya sekali)
  if ! crontab -l 2>/dev/null | grep -q "pm2 resurrect"; then
    pm2 startup | tail -1 | bash 2>/dev/null || \
      warn "Setup PM2 startup manual: jalankan 'pm2 startup' dan copy perintahnya"
  fi
  log "Backend started dan disimpan ke PM2 startup"
fi

# ── 5. Health check ───────────────────────────────────────────────────────────
header "5 — Health Check"
info "Menunggu server siap ..."
sleep 3

PORT=$(grep -E "^PORT=" "$APP_DIR/backend/.env" | cut -d= -f2 | tr -d '"' || echo "5000")
PORT=${PORT:-5000}

for i in 1 2 3 4 5; do
  HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/api/health" 2>/dev/null || echo "000")
  if [ "$HEALTH" = "200" ]; then
    log "Server merespons di port $PORT (HTTP 200)"
    break
  fi
  warn "Attempt $i — HTTP $HEALTH — menunggu ..."
  sleep 3
done

if [ "$HEALTH" != "200" ]; then
  warn "Health check gagal! Cek log: pm2 logs $APP_NAME"
else
  log "Deploy berhasil!"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
pm2 list
echo ""
info "Perintah berguna:"
echo "  pm2 logs $APP_NAME        — lihat log realtime"
echo "  pm2 monit                  — monitor CPU/RAM"
echo "  pm2 restart $APP_NAME     — restart manual"
echo "  bash scripts/vps-rollback.sh — rollback ke commit sebelumnya"
echo ""
