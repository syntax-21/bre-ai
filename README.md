# Bre AI

Bre AI adalah aplikasi antarmuka percakapan kecerdasan buatan berbasis web dan bot Telegram yang dilengkapi sistem manajemen proxy router (*multi-provider AI proxy*). Aplikasi ini dirancang agar dapat berjalan secara lokal menggunakan Node.js maupun di-deploy ke platform *cloud serverless* seperti Vercel tanpa memerlukan basis data eksternal.

---

## Daftar Isi
- [Arsitektur Sistem](#arsitektur-sistem)
- [Fitur Utama](#fitur-utama)
- [Struktur Direktori](#struktur-direktori)
- [Kebutuhan Sistem](#kebutuhan-sistem)
- [Panduan Instalasi & Menjalankan Lokal](#panduan-instalasi--menjalankan-lokal)
- [Panduan Deploy ke Vercel](#panduan-deploy-ke-vercel)
- [Integrasi Bot Telegram](#integrasi-bot-telegram)
- [Panel Admin (/admin)](#panel-admin-admin)
- [Variabel Lingkungan (Environment Variables)](#variabel-lingkungan-environment-variables)
- [Lisensi & Kredit](#lisensi--kredit)

---

## Arsitektur Sistem

Bre AI terdiri dari tiga komponen utama:
1. **Frontend Web Chat (`public/index.html`, `app.js`, `style.css`)**: Antarmuka obrolan responsif berbasis peramban dengan dukungan *Server-Sent Events* (SSE) untuk efek teks mengalir (*streaming*), riwayat tersimpan pada `localStorage`, dan ekspor dokumen.
2. **Serverless API Engine (`api/*`)**: Endpoint Node.js untuk perutean permintaan obrolan, rotasi kunci API (*key rotation*), *failover* otomatis antar-*provider*, *caching* respons di memori, pembatasan laju (*rate limiting*), serta penegakan kata kunci terlarang (*blacklist*).
3. **Layanan Bot Telegram (`services/telegramBot.js`, `api/telegram.js`)**: Bot percakapan dua arah dengan panel admin interaktif (*inline keyboards*) dan sistem kontrol akses (*whitelist/blocklist*). Mendukung mode *long-polling* untuk server lokal dan mode *webhook* untuk lingkungan *serverless*.

---

## Fitur Utama

- **Multi-Provider AI Router & Failover**: Mendukung banyak endpoint AI berbasis OpenAI-compatible API (seperti Inception Labs, OpenAI, Groq, DeepSeek, OpenRouter, Together AI, maupun Ollama lokal). Jika satu endpoint atau kunci API mengalami kendala (misalnya HTTP 429 atau kuota habis), sistem dapat berpindah otomatis ke kunci atau endpoint cadangan.
- **Server-Sent Events (SSE) Streaming**: Respon teks AI dikirimkan secara bertahap secara *real-time* ke klien web.
- **In-Memory Response Caching**: Menyimpan respon dari kueri non-streaming yang identik di dalam memori (RAM) dengan pengaturan *Time-to-Live* (TTL) untuk menghemat penggunaan token upstream.
- **Multi-Client API Keys**: Memungkinkan pembuatan kunci API klien (`sk-bre-...`) untuk menghubungkan aplikasi eksternal (seperti NextChat, LibreChat, atau ekstensi peramban) ke proxy Bre AI dengan autentikasi *Bearer token*.
- **Inspeksi Latensi & Log Permintaan**: Menampilkan riwayat log permintaan (status HTTP, latensi milidetik, estimasi token) serta modul *batch benchmark* untuk menguji latensi tiap endpoint.
- **Panel Admin Terisolasi**: Antarmuka administrasi berada pada rute `/admin` dan dilindungi oleh autentikasi password master. Rute ini tidak memiliki tautan langsung dari halaman obrolan umum untuk menjaga privasi pengelolaan.
- **Integrasi Bot Telegram Penuh**:
  - Chat langsung dengan AI melalui Telegram dengan ingatan percakapan per-pengguna.
  - Panel kontrol pemilik (*Owner Control Panel*) di Telegram via perintah `/admin` menggunakan tombol interaktif (*inline keyboards*) tanpa mengetik perintah teks rumit.
  - Manajemen akses pengguna (mode Publik atau khusus Pengguna Terdaftar).

---

## Struktur Direktori

```text
bre-ai-main/
├── api/
│   ├── _shared.js         # Logika konfigurasi, logging, metrik, caching, & filter
│   ├── chat.js            # Handler perutean chat completion & SSE streaming
│   ├── config.js          # Endpoint administrasi & manajemen konfigurasi
│   ├── info.js            # Endpoint informasi status sistem
│   ├── search.js          # Utilitas pencarian web
│   ├── telegram.js        # Endpoint webhook serverless untuk bot Telegram
│   └── test.js            # Endpoint uji latensi koneksi upstream
├── public/
│   ├── admin.html         # Halaman antarmuka web panel admin
│   ├── admin.js           # Logika interaktif panel admin
│   ├── app.js             # Logika klien web chat
│   ├── bre_ai_avatar.jpg  # Aset gambar resmi avatar Bre AI
│   ├── index.html         # Halaman antarmuka obrolan utama
│   └── style.css          # Gaya visual antarmuka web
├── services/
│   └── telegramBot.js     # Engine bot Telegram (polling, webhook handler, & panel owner)
├── .gitignore             # Daftar berkas yang diabaikan oleh Git
├── config.example.json    # Berkas contoh konfigurasi dasar
├── config.json            # Berkas konfigurasi aktif lokal
├── package.json           # Berkas manifest dependensi & script Node.js
├── README.md              # Dokumentasi proyek
├── server.js              # Server HTTP terintegrasi untuk penggunaan lokal
├── start.bat              # Script otomasi peluncuran lokal di Windows
└── vercel.json            # Konfigurasi routing platform Vercel
```

---

## Kebutuhan Sistem

- **Node.js**: Versi 18.0.0 atau lebih baru (membutuhkan implementasi `fetch` bawaan).
- **Akses Jaringan**: Koneksi internet keluar (*outbound*) ke endpoint API upstream (misalnya `api.inceptionlabs.ai` atau `api.telegram.org`).

---

## Panduan Instalasi & Menjalankan Lokal

1. **Clone atau Unduh Proyek**:
   Buka folder proyek di terminal atau command prompt:
   ```bash
   cd "bre-ai-main"
   ```

2. **Jalankan Server**:
   - **Di Windows**: Klik dua kali berkas `start.bat`, atau jalankan:
     ```cmd
     start.bat
     ```
     *(Script ini otomatis memeriksa dan menutup proses lama yang masih menahan port 3000 jika terjadi konflik `EADDRINUSE`).*
   - **Melalui Terminal (Windows/Linux/macOS)**:
     ```bash
     npm start
     ```

3. **Akses Aplikasi di Browser**:
   - Obrolan Klien: `http://localhost:3000`
   - Panel Admin: `http://localhost:3000/admin` (Password bawaan: `admin`)

---

## Panduan Deploy ke Vercel

Aplikasi ini telah dilengkapi berkas `vercel.json` dan struktur folder `/api` yang kompatibel langsung dengan arsitektur *Vercel Serverless Functions*.

### Berkas yang Diunggah ke Repository Git:
- Folder: `api/`, `public/`, `services/`
- Berkas: `package.json`, `vercel.json`, `config.json`, `.gitignore`, `README.md`
- *Catatan:* Berkas `.env`, `start.bat`, dan folder `node_modules/` tidak perlu diunggah.

### Langkah Penerapan:
1. Dorong (*push*) proyek ke repository GitHub baru (disarankan mode **Private**).
2. Masuk ke [Vercel Dashboard](https://vercel.com/) dan pilih **Add New...** > **Project**.
3. Pilih repository Anda lalu klik **Import**.
4. Buka bagian **Environment Variables** (lihat daftar variabel di bawah) untuk mengisi konfigurasi tanpa membocorkan kredensial.
5. Klik **Deploy**. Selesai.

---

## Integrasi Bot Telegram

Bot Telegram Bre AI dapat beroperasi dalam dua mode:

### 1. Mode Polling Lokal (Penggunaan di Komputer/Server Pribadi/VPS)
1. Buka `/admin` di peramban, lalu masuk ke tab **🤖 Telegram Bot**.
2. Masukkan **Telegram Bot Token** yang diperoleh dari `@BotFather`.
3. Masukkan ID Telegram Anda pada kolom **Telegram Owner ID** (dapat dicek via `@userinfobot`).
4. Aktifkan sakelar **Aktifkan Integrasi Telegram Bot**.
5. Klik tombol **`💾 Simpan & Mulai Bot`**. Sistem akan memulai *long-polling* secara lokal.

### 2. Mode Webhook Cloud (Penggunaan di Vercel)
Karena Vercel berjalan pada arsitektur *serverless stateless*, proses *long-polling* lokal tidak berjalan terus-menerus. Untuk itu, gunakan endpoint Webhook:
1. Pastikan variabel lingkungan `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_OWNER_ID` telah diatur di Vercel Dashboard.
2. Daftarkan URL Webhook ke Telegram dengan membuka tautan berikut di peramban (jalankan satu kali):
   ```text
   https://api.telegram.org/bot<TOKEN_BOT_ANDA>/setWebhook?url=https://<DOMAIN-VERCEL-ANDA>/api/telegram
   ```
3. Telegram akan merespon dengan `{"ok":true,"result":true,"description":"Webhook was set"}`. Bot akan aktif merespon pesan melalui serverless function Vercel.

---

## Panel Admin (/admin)

Panel admin menyediakan kontrol terpusat untuk konfigurasi proxy:
- **Endpoints & Routing**: Menambahkan, mengedit, mengatur bobot (*weight*), memetakan alias model, dan memasukkan banyak kunci API per-provider.
- **Global Engine**: Mengatur *System Prompt*, *Temperature*, *Top-P*, *Frequency Penalty*, *Presence Penalty*, batas *Max Tokens*, dan mode respons *caching*.
- **Keamanan & Klien API**: Mengubah password admin, mengatur batas laju request (*Rate Limit*), serta membuat daftar kunci API untuk klien eksternal.
- **Telegram Bot**: Pengaturan status bot, token API, mode akses (Publik vs Whitelist), dan tabel data pengguna khusus (Whitelist/Blocked).
- **Live Model Tester**: Menguji kueri teks langsung ke model AI upstream untuk memantau respon dan latensi.
- **Backup & Restore**: Mengekspor seluruh konfigurasi ke berkas `.json` atau memulihkan konfigurasi dari berkas cadangan.

---

## Variabel Lingkungan (Environment Variables)

Variabel lingkungan berikut dapat digunakan untuk menggantikan atau menimpa nilai dalam `config.json`, terutama saat berjalan di lingkungan cloud Vercel:

| Variabel | Deskripsi | Contoh Nilai |
| :--- | :--- | :--- |
| `ADMIN_PASSWORD` | Kata sandi untuk masuk ke panel web `/admin` | `KataSandiKuat123` |
| `API_KEY` / `INCEPTION_API_KEY` | Kunci API utama untuk provider AI upstream | `sk_683f99...` |
| `TELEGRAM_BOT_TOKEN` | Token bot Telegram dari `@BotFather` | `1234567890:ABCdef...` |
| `TELEGRAM_OWNER_ID` | User ID akun pemilik bot untuk akses panel `/admin` di Telegram | `425134037` |
| `BRE_CONFIG` | *(Opsional)* String format JSON untuk menimpa seluruh konfigurasi | `{"temperature":0.7}` |

---

## Lisensi & Kredit

- **Pengembang**: Amirun Rayan Ariandi
- **Lisensi**: MIT License
