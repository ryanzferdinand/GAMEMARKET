#!/bin/bash
# =============================================================================
#  GameMarket — Log Viewer
#  Usage: bash scripts/vps-logs.sh           — backend logs (realtime)
#         bash scripts/vps-logs.sh nginx      — nginx access log
#         bash scripts/vps-logs.sh nginx-err  — nginx error log
#         bash scripts/vps-logs.sh mongo      — mongodb log
#         bash scripts/vps-logs.sh pm2        — pm2 combined log
# =============================================================================

VPS_CONFIG="$HOME/vps-config.env"
[ -f "$VPS_CONFIG" ] && source "$VPS_CONFIG"
APP_NAME=${APP_NAME:-gamemarket-backend}

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

TARGET="${1:-backend}"

case $TARGET in
  backend|app)
    echo "📋 Backend logs (Ctrl+C untuk keluar):"
    pm2 logs "$APP_NAME" --lines 50
    ;;
  backend-err|err)
    echo "❌ Backend error logs:"
    pm2 logs "$APP_NAME" --lines 50 --err
    ;;
  nginx)
    echo "🌐 Nginx access log:"
    sudo tail -f /var/log/nginx/gamemarket_access.log 2>/dev/null || \
    sudo tail -f /var/log/nginx/access.log
    ;;
  nginx-err)
    echo "❌ Nginx error log:"
    sudo tail -f /var/log/nginx/gamemarket_error.log 2>/dev/null || \
    sudo tail -f /var/log/nginx/error.log
    ;;
  mongo|mongodb)
    echo "🗄️  MongoDB log:"
    sudo tail -f /var/log/mongodb/mongod.log
    ;;
  pm2)
    echo "⚙️  PM2 combined log:"
    pm2 logs --lines 100
    ;;
  *)
    echo "Usage: bash vps-logs.sh [backend|nginx|nginx-err|mongo|pm2]"
    exit 1
    ;;
esac
