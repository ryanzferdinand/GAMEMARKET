# GameMarket — VPS Deployment Guide

## Scripts

| Script | Dijalankan di | Fungsi |
|--------|--------------|--------|
| `vps-setup.sh` | VPS (root) | Install semua dependencies — jalankan **sekali** |
| `vps-deploy.sh` | VPS (deploy user) | Deploy / update kode |
| `vps-rollback.sh` | VPS (deploy user) | Rollback ke commit sebelumnya |
| `vps-backup.sh` | VPS (deploy user) | Backup MongoDB + uploads |
| `vps-status.sh` | VPS (deploy user) | Cek status semua service |
| `vps-logs.sh` | VPS (deploy user) | Lihat logs |

---

## Alur Deployment Pertama Kali

### 1. Setup VPS (jalankan sebagai root)
```bash
# Upload script ke VPS
scp -r scripts/ root@IP_SERVER:/tmp/scripts/

# Jalankan setup
ssh root@IP_SERVER "bash /tmp/scripts/vps-setup.sh"
```

### 2. Upload kode
```bash
# Dari lokal — upload via rsync
rsync -avz --exclude node_modules --exclude .git --exclude "backend/uploads" \
  "." deploy@IP_SERVER:/home/deploy/app/

# ATAU clone dari Git
ssh deploy@IP_SERVER
git clone https://github.com/username/repo.git /home/deploy/app
```

### 3. Setup .env production
```bash
ssh deploy@IP_SERVER
nano /home/deploy/app/backend/.env
```

Isi minimal untuk production:
```env
NODE_ENV=production
FRONTEND_URL=https://domainmu.com
MONGODB_URI=mongodb://127.0.0.1:27017/gamemarket
JWT_SECRET=   # generate: openssl rand -hex 32
CHAT_ENCRYPTION_KEY=  # generate: openssl rand -hex 32
```

### 4. Deploy
```bash
ssh deploy@IP_SERVER
bash /home/deploy/app/scripts/vps-deploy.sh
```

---

## Update Kode (deployment berikutnya)

```bash
ssh deploy@IP_SERVER
cd /home/deploy/app
bash scripts/vps-deploy.sh
```

Atau hanya backend (tanpa rebuild frontend):
```bash
bash scripts/vps-deploy.sh --skip-frontend
```

---

## Cek Status

```bash
bash scripts/vps-status.sh
```

---

## Rollback

```bash
# Rollback ke commit sebelumnya
bash scripts/vps-rollback.sh

# Rollback ke commit spesifik
bash scripts/vps-rollback.sh abc1234
```

---

## Backup

```bash
# Manual
bash scripts/vps-backup.sh

# Setup otomatis setiap hari jam 02:00
crontab -e
# Tambahkan:
0 2 * * * /home/deploy/app/scripts/vps-backup.sh >> /var/log/gamemarket-backup.log 2>&1
```

---

## Lihat Logs

```bash
bash scripts/vps-logs.sh              # backend realtime
bash scripts/vps-logs.sh nginx        # nginx access
bash scripts/vps-logs.sh nginx-err    # nginx errors
bash scripts/vps-logs.sh mongo        # mongodb
```

---

## Perintah PM2 Umum

```bash
pm2 list                          # lihat semua proses
pm2 logs gamemarket-backend       # log realtime
pm2 monit                         # dashboard CPU/RAM
pm2 restart gamemarket-backend    # restart
pm2 stop gamemarket-backend       # stop
pm2 delete gamemarket-backend     # hapus dari PM2
```
