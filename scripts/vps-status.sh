#!/bin/bash
# =============================================================================
#  GameMarket — Status & Health Check Script
#  Usage: bash scripts/vps-status.sh
# =============================================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}● OK${NC}     $1"; }
fail() { echo -e "  ${RED}● FAIL${NC}   $1"; }
warn() { echo -e "  ${YELLOW}● WARN${NC}   $1"; }
info() { echo -e "  ${CYAN}→${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

VPS_CONFIG="$HOME/vps-config.env"
[ -f "$VPS_CONFIG" ] && source "$VPS_CONFIG"
APP_NAME=${APP_NAME:-gamemarket-backend}

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

PORT=$(grep -E "^PORT=" "$APP_DIR/backend/.env" 2>/dev/null | cut -d= -f2 || echo "5000")
PORT=${PORT:-5000}

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  GameMarket Status — $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ── Services ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[ Services ]${NC}"

systemctl is-active --quiet mongod \
  && ok "MongoDB" \
  || fail "MongoDB — jalankan: sudo systemctl start mongod"

systemctl is-active --quiet nginx \
  && ok "Nginx" \
  || fail "Nginx — jalankan: sudo systemctl start nginx"

pm2 describe "$APP_NAME" &>/dev/null
PM2_STATUS=$(pm2 describe "$APP_NAME" 2>/dev/null | grep "status" | awk '{print $4}' | head -1)
if [ "$PM2_STATUS" = "online" ]; then
  ok "PM2 ($APP_NAME) — online"
else
  fail "PM2 ($APP_NAME) — status: ${PM2_STATUS:-tidak ditemukan}"
fi

# ── API Health ────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[ API Health ]${NC}"

HEALTH_RESPONSE=$(curl -s "http://127.0.0.1:$PORT/api/health" 2>/dev/null)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/api/health" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  ok "API merespons (HTTP 200) di port $PORT"
  MODE=$(echo "$HEALTH_RESPONSE" | grep -o '"mode":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "?")
  info "Mode: $MODE"
else
  fail "API tidak merespons (HTTP $HTTP_CODE) di port $PORT"
fi

# ── SSL ───────────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[ SSL ]${NC}"
if [ -n "$DOMAIN" ]; then
  CERT_EXPIRE=$(echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  if [ -n "$CERT_EXPIRE" ]; then
    ok "SSL aktif untuk $DOMAIN"
    info "Expires: $CERT_EXPIRE"
  else
    warn "SSL tidak terdeteksi untuk $DOMAIN"
  fi
else
  warn "Domain tidak dikonfigurasi (skip SSL check)"
fi

# ── Disk & Memory ─────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[ Resources ]${NC}"

DISK_USAGE=$(df -h / | awk 'NR==2 {print $5 " used (" $3 "/" $2 ")"}')
DISK_PCT=$(df / | awk 'NR==2 {gsub("%","",$5); print $5}')
if [ "$DISK_PCT" -lt 80 ]; then
  ok "Disk: $DISK_USAGE"
elif [ "$DISK_PCT" -lt 90 ]; then
  warn "Disk: $DISK_USAGE — mulai penuh"
else
  fail "Disk: $DISK_USAGE — KRITIS"
fi

MEM_TOTAL=$(free -m | awk 'NR==2{print $2}')
MEM_USED=$(free -m | awk 'NR==2{print $3}')
MEM_PCT=$((MEM_USED * 100 / MEM_TOTAL))
if [ "$MEM_PCT" -lt 80 ]; then
  ok "Memory: ${MEM_USED}MB / ${MEM_TOTAL}MB (${MEM_PCT}%)"
elif [ "$MEM_PCT" -lt 90 ]; then
  warn "Memory: ${MEM_USED}MB / ${MEM_TOTAL}MB (${MEM_PCT}%) — tinggi"
else
  fail "Memory: ${MEM_USED}MB / ${MEM_TOTAL}MB (${MEM_PCT}%) — KRITIS"
fi

LOAD=$(uptime | awk -F'load average:' '{print $2}' | xargs)
info "Load average: $LOAD"
info "Uptime: $(uptime -p)"

# ── Backup ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[ Backup ]${NC}"
BACKUP_DIR="$HOME/backups"
if [ -d "$BACKUP_DIR" ]; then
  LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | head -1)
  if [ -n "$LATEST_BACKUP" ]; then
    BACKUP_AGE=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")) / 3600 ))
    if [ "$BACKUP_AGE" -lt 25 ]; then
      ok "Backup terakhir: $(basename $LATEST_BACKUP) (${BACKUP_AGE}h lalu)"
    else
      warn "Backup terakhir: ${BACKUP_AGE}h lalu — jalankan vps-backup.sh"
    fi
  else
    warn "Belum ada backup — jalankan: bash scripts/vps-backup.sh"
  fi
else
  warn "Belum ada backup — jalankan: bash scripts/vps-backup.sh"
fi

# ── PM2 Process List ──────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[ PM2 Processes ]${NC}"
pm2 list 2>/dev/null | grep -v "^$" | tail -n +3 | head -10 || true

# ── Recent logs ───────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[ Recent Errors (last 5) ]${NC}"
pm2 logs "$APP_NAME" --lines 5 --nostream --err 2>/dev/null | grep -v "^$" | tail -5 || true

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
