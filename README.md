# StoryMap 🗺️

Aplikasi berbagi cerita interaktif dengan peta lokasi.
**Dibuat dengan Vanilla JavaScript murni — tanpa framework UI apapun.**

## ✅ Fitur yang Diimplementasi

### Kriteria 1 — Submission Sebelumnya
- ✅ **SPA** dengan hash-based router dan transisi halaman (fade)
- ✅ **Peta interaktif** (Leaflet.js) — tampil marker semua cerita
- ✅ **Tambah cerita** — upload foto, kamera, pilih lokasi di peta
- ✅ **Aksesibilitas** — skip link, ARIA labels, focus management, role attributes

### Kriteria 2 — Push Notification (Advanced ✨)
- ✅ Push notification dari Dicoding Story API via Service Worker
- ✅ Isi notifikasi dinamis (judul, icon, pesan dari data event)
- ✅ **Button toggle** enable/disable langganan push notification
- ✅ **Action button** di notifikasi untuk navigasi ke detail cerita

### Kriteria 3 — PWA (Advanced ✨)
- ✅ **Installable** — pop-up banner install di desktop & mobile
- ✅ **Offline support** — app shell tetap tampil saat offline
- ✅ **Dynamic cache** — data API di-cache, tampil saat offline
- ✅ Web App Manifest lengkap (icons, screenshots, shortcuts, theme)
- ✅ Tidak ada warning di Chrome DevTools Application > Manifest

### Kriteria 4 — IndexedDB (Advanced ✨)
- ✅ **Create** — simpan cerita ke favorit, tambah ke offline queue
- ✅ **Read** — tampil daftar favorit, daftar antrian offline
- ✅ **Delete** — hapus favorit, hapus dari antrian, hapus semua
- ✅ **Search** — cari di favorit berdasarkan nama/deskripsi
- ✅ **Sort** — urutkan favorit (terbaru, nama, tanggal)
- ✅ **Sync offline** — cerita dibuat saat offline otomatis dikirim saat online

### Kriteria 5 — Deployment
- ✅ Deploy via GitHub Pages (GitHub Actions)
- ✅ URL dicantumkan di STUDENT.txt

## 📁 Struktur Project

```
story-app/
├── index.html              ← Entry point
├── sw.js                   ← Service Worker (cache + push)
├── manifest.json           ← Web App Manifest
├── STUDENT.txt             ← URL deployment
├── icons/                  ← App icons
├── screenshots/            ← PWA screenshots
└── src/
    ├── app.js              ← Bootstrap & routing
    ├── styles/main.css     ← Semua styling
    ├── pages/
    │   ├── home.js         ← Halaman beranda
    │   ├── explore.js      ← Jelajahi + peta semua cerita
    │   ├── detail.js       ← Detail cerita + peta lokasi
    │   ├── add-story.js    ← Tambah cerita + offline queue
    │   ├── favorites.js    ← Favorit (IndexedDB CRUD)
    │   └── auth.js         ← Login & Register
    └── utils/
        ├── api.js          ← Dicoding Story API service
        ├── idb.js          ← IndexedDB service
        ├── push.js         ← Push notification utility
        ├── router.js       ← Hash-based SPA router
        └── helpers.js      ← Fungsi utilitas

```

## 🚀 Cara Deploy ke GitHub Pages

1. **Buat repository baru** di GitHub (misal: `storymap-app`)
2. **Push semua file** ke branch `main`:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: StoryMap PWA"
   git branch -M main
   git remote add origin https://github.com/USERNAME/storymap-app.git
   git push -u origin main
   ```
3. Buka **Settings → Pages → Source: GitHub Actions**
4. Tunggu workflow selesai (~1-2 menit)
5. Copy URL hasil deploy ke **STUDENT.txt**

## 🛠️ Teknologi

- **Vanilla JavaScript** (ES Modules, tanpa framework)
- **Leaflet.js** — peta interaktif
- **Service Worker** — offline & push notification
- **IndexedDB** — penyimpanan lokal
- **Web Push API** — push notification
- **Dicoding Story API** — backend data cerita
