#!/bin/bash
# =============================================================================
#  GameMarket — MongoDB Backup Script
#  Bisa dijalankan manual atau dijadwalkan via cron
#  Usage: bash scripts/vps-backup.sh
#
#  Setup cron otomatis (backup setiap hari jam 02:00):
#    crontab -e
#    0 2 * * * /home/deploy/app/scripts/vps-backup.sh >> /var/log/gamemarket-backup.log 2>&1
# =============================================================================

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
info() { echo -e "${CYAN}[→]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

# ── Config ────────────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
DB_NAME="${DB_NAME:-gamemarket}"
KEEP_DAYS="${KEEP_DAYS:-7}"    # Simpan backup selama 7 hari
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_PATH="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}"

mkdir -p "$BACKUP_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  GameMarket Backup — $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Check mongodump ───────────────────────────────────────────────────────────
command -v mongodump &>/dev/null || {
  warn "mongodump tidak ditemukan. Install: apt install -y mongodb-database-tools"
  exit 1
}

# ── Dump database ─────────────────────────────────────────────────────────────
info "Backup database '$DB_NAME' ..."
mongodump --db "$DB_NAME" --out "$BACKUP_PATH" --quiet
log "Dump selesai: $BACKUP_PATH"

# ── Compress ──────────────────────────────────────────────────────────────────
info "Compressing ..."
tar -czf "${BACKUP_PATH}.tar.gz" -C "$BACKUP_DIR" "$(basename $BACKUP_PATH)"
rm -rf "$BACKUP_PATH"
SIZE=$(du -sh "${BACKUP_PATH}.tar.gz" | cut -f1)
log "Compressed: ${BACKUP_PATH}.tar.gz ($SIZE)"

# ── Backup uploads folder ─────────────────────────────────────────────────────
UPLOADS_DIR="$APP_DIR/backend/uploads"
if [ -d "$UPLOADS_DIR" ] && [ "$(ls -A $UPLOADS_DIR 2>/dev/null)" ]; then
  info "Backup uploads folder ..."
  tar -czf "$BACKUP_DIR/uploads_${TIMESTAMP}.tar.gz" -C "$APP_DIR/backend" uploads
  UPLOAD_SIZE=$(du -sh "$BACKUP_DIR/uploads_${TIMESTAMP}.tar.gz" | cut -f1)
  log "Uploads backup: uploads_${TIMESTAMP}.tar.gz ($UPLOAD_SIZE)"
fi

# ── Cleanup old backups ───────────────────────────────────────────────────────
info "Membersihkan backup > $KEEP_DAYS hari ..."
DELETED=$(find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$KEEP_DAYS -print -delete | wc -l)
[ "$DELETED" -gt 0 ] && log "Deleted $DELETED file lama" || info "Tidak ada file lama"

# ── List current backups ──────────────────────────────────────────────────────
echo ""
info "Backup tersedia di $BACKUP_DIR:"
ls -lh "$BACKUP_DIR"/*.tar.gz 2>/dev/null | awk '{print "  " $NF " (" $5 ")"}'
echo ""
log "Backup selesai!"
