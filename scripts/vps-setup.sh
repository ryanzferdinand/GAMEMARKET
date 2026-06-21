#!/bin/bash
# =============================================================================
#  GameMarket — VPS First-Time Setup Script
#  Jalankan sekali setelah fresh VPS (Ubuntu 22.04)
#  Usage: bash vps-setup.sh
# =============================================================================

set -e  # Exit on any error

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()   { echo -e "${YELLOW}[!]${NC} $1"; }
error()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info()   { echo -e "${CYAN}[i]${NC} $1"; }
header() { echo -e "\n${BLUE}══════════════════════════════════════${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}══════════════════════════════════════${NC}"; }

# ── Check root ────────────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  error "Jalankan sebagai root: sudo bash vps-setup.sh"
fi

header "GameMarket VPS Setup"
echo "  OS      : $(lsb_release -d | cut -f2)"
echo "  IP      : $(curl -s ifconfig.me 2>/dev/null || echo 'unknown')"
echo "  Date    : $(date)"
echo ""

# ── Get domain from user ──────────────────────────────────────────────────────
read -p "Masukkan domain kamu (contoh: schwinn.my.id, atau kosongkan untuk skip SSL): " DOMAIN
read -p "Masukkan email untuk SSL/Let's Encrypt: " SSL_EMAIL
read -p "Nama app PM2 [gamemarket-backend]: " APP_NAME
APP_NAME=${APP_NAME:-gamemarket-backend}
read -p "Deploy path [/home/deploy/app]: " APP_DIR
APP_DIR=${APP_DIR:-/home/deploy/app}
read -p "Username deploy user [deploy]: " DEPLOY_USER
DEPLOY_USER=${DEPLOY_USER:-deploy}

echo ""
warn "Konfigurasi:"
echo "  Domain      : ${DOMAIN:-'(skip)'}"
echo "  App name    : $APP_NAME"
echo "  Deploy path : $APP_DIR"
echo "  Deploy user : $DEPLOY_USER"
echo ""
read -p "Lanjutkan? (y/N): " CONFIRM
[[ "$CONFIRM" =~ ^[Yy]$ ]] || { echo "Dibatalkan."; exit 0; }

# ── 1. System update ──────────────────────────────────────────────────────────
header "1/9 — System Update"
apt update -qq && apt upgrade -y -qq
apt install -y -qq curl wget git unzip ufw htop
log "System updated"

# ── 2. Create deploy user ─────────────────────────────────────────────────────
header "2/9 — Deploy User"
if id "$DEPLOY_USER" &>/dev/null; then
  warn "User '$DEPLOY_USER' sudah ada, skip"
else
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
  usermod -aG sudo "$DEPLOY_USER"
  # Copy SSH keys dari root ke deploy user
  if [ -d /root/.ssh ]; then
    mkdir -p /home/$DEPLOY_USER/.ssh
    cp /root/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/ 2>/dev/null || true
    chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
    chmod 700 /home/$DEPLOY_USER/.ssh
    chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys 2>/dev/null || true
    log "SSH keys copied ke user $DEPLOY_USER"
  fi
  log "User '$DEPLOY_USER' dibuat"
fi

# ── 3. Install Node.js via nvm ────────────────────────────────────────────────
header "3/9 — Node.js 20 (via nvm)"
if sudo -u $DEPLOY_USER bash -c 'source ~/.nvm/nvm.sh 2>/dev/null && node -v' 2>/dev/null | grep -q "v20"; then
  warn "Node.js 20 sudah terinstall, skip"
else
  sudo -u $DEPLOY_USER bash << 'NODEINSTALL'
    export NVM_DIR="$HOME/.nvm"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    source "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
    nvm alias default 20
    npm install -g pm2
NODEINSTALL
  log "Node.js 20 + PM2 terinstall"
fi

# ── 4. Install MongoDB 7 ──────────────────────────────────────────────────────
header "4/9 — MongoDB 7"
if systemctl is-active --quiet mongod; then
  warn "MongoDB sudah berjalan, skip install"
else
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
    gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
    https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
    tee /etc/apt/sources.list.d/mongodb-org-7.0.list
  apt update -qq
  apt install -y -qq mongodb-org
  systemctl enable --now mongod
  log "MongoDB 7 terinstall dan berjalan"
fi

# ── 5. Install Nginx ──────────────────────────────────────────────────────────
header "5/9 — Nginx"
if systemctl is-active --quiet nginx; then
  warn "Nginx sudah berjalan, skip install"
else
  apt install -y -qq nginx
  systemctl enable --now nginx
  log "Nginx terinstall dan berjalan"
fi

# ── 6. Firewall ───────────────────────────────────────────────────────────────
header "6/9 — Firewall (UFW)"
ufw --force reset > /dev/null
ufw default deny incoming > /dev/null
ufw default allow outgoing > /dev/null
ufw allow OpenSSH > /dev/null
ufw allow 'Nginx Full' > /dev/null
ufw --force enable > /dev/null
log "Firewall aktif: SSH + HTTP/HTTPS diizinkan"

# ── 7. Setup app directory ────────────────────────────────────────────────────
header "7/9 — App Directory"
mkdir -p "$APP_DIR"
chown -R $DEPLOY_USER:$DEPLOY_USER "$(dirname $APP_DIR)"
log "App directory: $APP_DIR"

# ── 8. Nginx config ───────────────────────────────────────────────────────────
header "8/9 — Nginx Config"

NGINX_CONF="/etc/nginx/sites-available/gamemarket"

if [ -n "$DOMAIN" ]; then
  cat > "$NGINX_CONF" << NGINXCONF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    client_max_body_size 10M;

    # Logging
    access_log /var/log/nginx/gamemarket_access.log;
    error_log  /var/log/nginx/gamemarket_error.log;

    location / {
        proxy_pass         http://127.0.0.1:5000;
        proxy_http_version 1.1;

        # Socket.io support
        proxy_set_header Upgrade    \$http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_read_timeout  60s;
        proxy_send_timeout  60s;
        proxy_connect_timeout 10s;
    }
}
NGINXCONF
  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/gamemarket
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  log "Nginx config dibuat untuk domain: $DOMAIN"
else
  warn "Domain kosong — Nginx config skip. Jalankan manual nanti."
fi

# ── 9. SSL via Certbot ────────────────────────────────────────────────────────
header "9/9 — SSL (Let's Encrypt)"
if [ -n "$DOMAIN" ] && [ -n "$SSL_EMAIL" ]; then
  apt install -y -qq certbot python3-certbot-nginx
  certbot --nginx \
    --non-interactive \
    --agree-tos \
    --email "$SSL_EMAIL" \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --redirect && log "SSL aktif untuk $DOMAIN" || warn "SSL gagal — cek apakah DNS sudah mengarah ke server ini"
else
  warn "SSL skip — install manual dengan: certbot --nginx -d yourdomain.com"
fi

# ── Save config ───────────────────────────────────────────────────────────────
cat > /home/$DEPLOY_USER/vps-config.env << VPSCONFIG
APP_DIR=$APP_DIR
APP_NAME=$APP_NAME
DEPLOY_USER=$DEPLOY_USER
DOMAIN=$DOMAIN
VPSCONFIG
chown $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/vps-config.env

# ── Done ──────────────────────────────────────────────────────────────────────
header "Setup Selesai!"
echo ""
log "System dependencies terinstall"
log "MongoDB berjalan"
log "Nginx berjalan"
log "Firewall aktif"
echo ""
info "Langkah berikutnya:"
echo "  1. Upload kode ke: $APP_DIR"
echo "  2. Setup .env: cp $APP_DIR/backend/.env.example $APP_DIR/backend/.env"
echo "  3. Edit .env production: nano $APP_DIR/backend/.env"
echo "  4. Jalankan deploy: bash $APP_DIR/scripts/vps-deploy.sh"
echo ""
info "Login sebagai deploy user: su - $DEPLOY_USER"
echo ""
