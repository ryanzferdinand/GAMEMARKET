# 🎮 GameMarket — Platform Jual Beli Akun Game

Dashboard marketplace modern untuk jual beli akun game dengan UI/UX terinspirasi Apple.

## ✨ Fitur

- **Banner Promo** — Sliding banner otomatis, dapat dikelola admin
- **Auth Google + Custom Username** — Login/Register dengan Google OAuth atau email
- **Sistem Role & Badge** — Admin 👑, Moderator 🛡️, Trusted Seller ⭐, Trusted Buyer 💎, Seller 🏪, Buyer 🛒
- **Sidebar Lengkap** — Terbaru, Trending, Postinganku, Kategori Game, Forum, Search Bar
- **Filter Pencarian** — Per kategori, harga, tipe penjual, dan sorting
- **Like/Dislike & Komentar** — Di setiap postingan dengan reply bersarang
- **Forum dengan Vote** — Thread diskusi dengan up/downvote Reddit-style
- **Sistem Persetujuan** — Postingan seller biasa perlu approval admin/moderator
- **Chat Real-time** — WebSocket-based chat dengan penjual
- **Admin Panel** — Kelola banner, approve/reject postingan, manage users & roles
- **Dark Mode** — Full dark mode support
- **Responsive** — Mobile-friendly

## 🏗️ Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 18 + Vite + TailwindCSS + Zustand |
| Backend | Node.js + Express + MongoDB/Mongoose |
| Realtime | Socket.io |
| Auth | JWT + Google OAuth 2.0 |

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Jalankan script install
scripts\install.bat
```

Atau manual:
```bash
cd backend && npm install
cd frontend && npm install
```

### 2. Konfigurasi Environment

**Backend** (`backend/.env`):
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/gamemarket
JWT_SECRET=your_super_secret_key
GOOGLE_CLIENT_ID=your_google_oauth_client_id
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

**Frontend** (`frontend/.env`):
```env
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

### 3. Pastikan MongoDB Berjalan

```bash
# Windows
net start MongoDB

# Atau gunakan MongoDB Atlas (cloud)
```

### 4. Jalankan Server

**Cara termudah** — otomatis deteksi mode:

```bash
start.bat
```

atau:

```bash
scripts\start.bat
```

| Konfigurasi | Perilaku |
|-------------|----------|
| `FRONTEND_URL=http://localhost:3000` (default) | Jalankan **local dev** — frontend :3000 + backend :5000 |
| `NODE_ENV=production` + `FRONTEND_URL=https://yourdomain.com` | **Production** — build frontend + serve dari satu server |

Manual development (dua terminal):

```bash
scripts\start-dev.bat
```

Buka: http://localhost:3000

## 🌐 Publish dengan Custom Domain

### Opsi A — Satu server (VPS, Railway, Render, dll.)

1. Edit `backend/.env`:

```env
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/gamemarket
JWT_SECRET=your_long_random_secret
GOOGLE_CLIENT_ID=your_google_client_id
PORT=5000
```

2. Edit `frontend/.env` — kosongkan backend URL agar same-origin:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_BACKEND_URL=
```

3. Di Google Cloud Console, tambahkan `https://yourdomain.com` ke **Authorized JavaScript Origins**.

4. Arahkan DNS domain ke server Anda (A record → IP server).

5. Jalankan:

```bash
start.bat
```

Server akan build frontend, lalu serve API + website dari port yang dikonfigurasi.

### Opsi B — Frontend & backend terpisah

- Deploy frontend (Vercel/Netlify) dengan `VITE_BACKEND_URL=https://api.yourdomain.com`
- Deploy backend dengan `FRONTEND_URL=https://yourdomain.com` (tanpa build frontend di server)

### Reverse proxy (Nginx)

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Tambahkan SSL dengan Certbot (`certbot --nginx`).

## 📁 Struktur Proyek

```
├── backend/
│   ├── lib/            # Constants shared
│   ├── middleware/     # Auth, upload middleware
│   ├── models/         # Mongoose schemas
│   ├── routes/         # Express API routes
│   ├── socket/         # Socket.io handlers
│   ├── uploads/        # Uploaded images
│   └── server.js       # Entry point
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── banners/   # PromoBanner
│       │   ├── chat/      # ChatPanel
│       │   ├── common/    # PostCard, CommentSection, FilterBar, UserBadge
│       │   ├── layouts/   # MainLayout, AuthLayout, AdminLayout
│       │   └── navigation/ # Navbar, Sidebar
│       ├── lib/            # API client, constants, socket
│       ├── pages/
│       │   ├── admin/      # Dashboard, Banners, Posts, Users
│       │   └── *.jsx       # Home, Login, Register, PostDetail, etc.
│       └── store/          # Zustand stores
│
└── scripts/            # Setup & start scripts
```

## 🔐 Setup Google OAuth

1. Buka [Google Cloud Console](https://console.cloud.google.com)
2. Buat project baru
3. Aktifkan "Google+ API" / "Google Identity Services"
4. Buat OAuth 2.0 Client ID
5. Tambahkan `http://localhost:3000` ke Authorized JavaScript Origins
6. Copy Client ID ke `GOOGLE_CLIENT_ID` di `.env` files

## 👤 Membuat Admin Pertama

Setelah register akun pertama, ubah role via MongoDB:

```js
db.users.updateOne(
  { email: "your@email.com" },
  { $set: { role: "admin" } }
)
```

## 📝 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/google` | Google OAuth |
| GET | `/api/posts` | List postingan |
| POST | `/api/posts` | Buat postingan |
| GET | `/api/posts/:id` | Detail postingan |
| POST | `/api/posts/:id/vote` | Like/Dislike |
| GET | `/api/banners/active` | Banner aktif |
| GET | `/api/forum` | List forum threads |
| POST | `/api/forum` | Buat thread |
| GET | `/api/admin/stats` | Statistik (admin) |
| POST | `/api/admin/posts/:id/approve` | Approve postingan |
