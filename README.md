# Bre AI v3.0 — Universal AI Assistant & Multi-Provider Router Engine

![Bre AI Avatar](public/bre_ai_avatar.jpg)

**Bre AI** adalah ekosistem asisten kecerdasan buatan cerdas tanpa batas (*universal multimodal AI assistant*) dan proxy router berkinerja tinggi (*multi-provider AI proxy router*) yang diciptakan dan dimiliki secara eksklusif oleh **Amirun Rayan Ariandi**.

Aplikasi ini menggabungkan antarmuka obrolan web modern (*glassmorphism, markdown, LaTeX, canvas code runner*) dan bot percakapan Telegram dengan arsitektur modular terkini. Dirancang fleksibel untuk berjalan di server lokal (Node.js) maupun dideploy ke *cloud serverless* (seperti Vercel) tanpa ketergantungan database eksternal.

---

## Daftar Isi
1. [Identitas Eksklusif & Perlindungan Identitas Bre AI](#1-identitas-eksklusif--perlindungan-identitas-bre-ai)
2. [Arsitektur Sistem & Direktori Modular](#2-arsitektur-sistem--direktori-modular)
3. [Fitur-Fitur Unggulan](#3-fitur-fitur-unggulan)
   - [Pipa Pengiriman Berkas Fisik 100% Pasti Bisa](#pipa-pengiriman-berkas-fisik-100-pasti-bisa)
   - [Dukungan Pesan Terusan (Telegram Bot API 7.0+ & Classic)](#dukungan-pesan-terusan-telegram-bot-api-70--classic)
   - [Media Interaktif Non-Teks & Multimodal](#media-interaktif-non-teks--multimodal)
   - [Sistem Bahasa & 9 Dialek Nusantara](#sistem-bahasa--9-dialek-nusantara)
   - [Manajemen Provider & Endpoint via Chat Telegram](#manajemen-provider--endpoint-via-chat-telegram)
   - [Sistem Akses Kontrol: Mode Publik & Mode Diizinkan](#sistem-akses-kontrol-mode-publik--mode-diizinkan)
4. [Daftar Perintah Slash Telegram (/commands)](#4-daftar-perintah-slash-telegram-commands)
5. [Struktur Direktori & Penjelasan Modul](#5-struktur-direktori--penjelasan-modul)
6. [Panduan Instalasi & Penggunaan Lokal](#6-panduan-instalasi--penggunaan-lokal)
7. [Panduan Deployment ke Vercel (Serverless)](#7-panduan-deployment-ke-vercel-serverless)
8. [Struktur Konfigurasi (`config.json`) & Environment Variables](#8-struktur-konfigurasi-configjson--environment-variables)
9. [Hak Cipta & Kredit](#9-hak-cipta--kredit)

---

## 1. Identitas Eksklusif & Perlindungan Identitas Bre AI

Bre AI dilengkapi mekanisme **Absolute Identity Override & Prompt Injection Shielding** di tingkat routing (`api/_shared.js` & `services/telegram/messageHandler.js`):
- **Kepemilikan Tunggal**: Bre AI adalah asisten kecerdasan buatan serba bisa yang diciptakan dan dimiliki secara eksklusif oleh **Amirun Rayan Ariandi**.
- **Netralisasi Vendor Upstream**: Mengabaikan dan membatalkan seluruh klaim identitas bawaan dari penyedia upstream (seperti OpenAI, Anthropic/Claude, DeepSeek, Google Gemini, Inception Labs, Meta Llama, Ollama, dll.).
- **Sanitasi Respons Otomatis**: Melakukan pembersihan (*post-processing sanitization*) pada teks keluaran model agar identitas Bre AI tetap konsisten, tegas, ramah, dan profesional di semua kanal.

---

## 2. Arsitektur Sistem & Direktori Modular

Bre AI v3.0 memisahkan beban kerja menjadi modul-modul independen berprinsip *Single Responsibility Principle (SRP)*:

```
                          ┌────────────────────────┐
                          │   Pengguna Telegram    │
                          └───────────┬────────────┘
                                      │ Polling / Webhook
                                      ▼
                   ┌──────────────────────────────────────┐
                   │       services/telegram/index.js     │
                   └──────────────────┬───────────────────┘
                                      │
                   ┌──────────────────▼───────────────────┐
                   │ services/telegram/messageHandler.js  │
                   │       (Koordinator Utama Pesan)      │
                   └─┬──────────────┬───────────────┬───┬─┘
                     │              │               │   │
        ┌────────────▼──┐    ┌──────▼───────┐       │   │
        │ forwardHandler│    │commandHandler│       │   │
        │(Pesan Terusan)│    │(Semua /perintah)     │   │
        └───────────────┘    └──────────────┘       │   │
                                                    │   │
        ┌───────────────────────────────────────────▼┐  │
        │       services/telegram/mediaProcessor.js  │  │
        │  (Ekstraksi Tag, Codeblock & Unduh Berkas) │  │
        └────────────────────────────────────────────┘  │
                                                        │
                                     ┌──────────────────▼─────────────────┐
                                     │         api/chat.js (Router)       │
                                     └──────────────────┬─────────────────┘
                                                        │
                      ┌─────────────────────────────────▼────────────────┐
                      │    Multi-Provider AI Pool (Failover & Rotation)   │
                      │ Inception Labs / DeepSeek / OpenAI / Ollama, dll │
                      └──────────────────────────────────────────────────┘
```

---

## 3. Fitur-Fitur Unggulan

### Pipa Pengiriman Berkas Fisik 100% Pasti Bisa
Bot Telegram maupun Web App Bre AI tidak sekadar menampilkan teks kode, melainkan memiliki **garansi 100% pengiriman berkas nyata** (*actual downloadable file delivery*):
1. **Tag Khusus `[TELEGRAM_FILE: ...]`**: Model dapat mengeluarkan tag terstruktur yang langsung diekstraksi dan dikirim sebagai dokumen biner asli.
2. **Auto-Packaging Blok Kode**: Kode di dalam blok markdown (````python ... ````, ````javascript ... ````, dll.) secara cerdas diubah menjadi berkas fisik dengan nama yang terdeteksi dari baris komentar atau instruksi pengguna.
3. **Kamus Format Lengkap (`EXT_MAP`)**: Mendukung puluhan bahasa pemrograman dan format dokumen:
   - **Web & Scripting**: `.js`, `.ts`, `.html`, `.css`, `.scss`, `.py`, `.php`, `.rb`, `.lua`, `.dart`, `.swift`.
   - **Sistem & Kompilasi**: `.c`, `.cpp`, `.h`, `.hpp`, `.java`, `.kt`, `.go`, `.rs`.
   - **Shell & Otomasi**: `.sh`, `.bash`, `.bat`, `.cmd`, `.ps1`.
   - **Data & Konfigurasi**: `.json`, `.csv`, `.tsv`, `.sql`, `.yaml`, `.yml`, `.xml`, `.svg`, `.env`, `.ini`, `.toml`.
   - **Dokumentasi & Teks**: `.md`, `.txt`, `Dockerfile`, `.prd`.
4. **Absolute Fallback Guarantee**: Jika pengguna meminta dibuatkan berkas namun model AI upstream hanya merespons berupa teks narasi, Bre AI secara otomatis mengemas narasi tersebut menjadi berkas fisik (`.txt`, `.csv`, `.py`, dsb.) dan langsung mengirimkannya ke ruang obrolan.

### Dukungan Pesan Terusan (Telegram Bot API 7.0+ & Classic)
Bre AI mampu menerima dan menelaah pesan terusan (*forwarded messages*) dari segala sumber:
- **Dukungan API Terbaru & Klasik**: Membaca objek `forward_origin` (Bot API 7.0+) untuk pengguna perorangan, akun yang menyembunyikan identitas (*hidden_user*), obrolan grup (*chat*), serta channel siaran (*channel*), lengkap dengan tanda tangan penulis (*author signature*) dan stempel waktu asli (WIB).
- **Pemahaman Konteks Mendalam**: Bre AI secara otomatis menyusun prompt khusus untuk membedah pesan terusan—baik berupa pertanyaan, konsultasi kode/bug, artikel berita, maupun berkas dokumen—dan memberikan evaluasi komprehensif.

### Media Interaktif Non-Teks & Multimodal
Bre AI tidak hanya terpaku pada teks, melainkan mengenali dan menghasilkan beragam media Telegram:
- **Input Multimodal**:
  - 📷 **Foto & Gambar**: Analisis visual menggunakan Vision API (diubah otomatis ke Base64 Data URL).
  - 🎙️ **Pesan Suara (Voice Note) & Audio**: Membaca durasi, artis, dan judul berkas rekaman.
  - 🎥 **Video & Video Bulat (Video Note)**: Analisis dimensi, durasi, dan catatan video.
  - 📁 **Semua Format Dokumen**: Ekstraksi teks langsung hingga ukuran 1MB untuk berkas kode, konfigurasi, dan teks; serta identifikasi kategori berkas biner (PDF, Office, Arsip, APK, Installer).
  - 📍 **Titik Lokasi GPS & Tempat (Venue)**: Menelaah koordinat geografis, nama tempat, dan alamat.
  - 👤 **Kartu Kontak**: Menelaah vCard/nomor telepon dan nama kontak.
  - 🎲 **Dadu & Mini-Game Animasi**: Merespons lemparan dadu, panahan, bola basket, sepak bola, bowling, dan mesin slot dengan skor riil Telegram.
  - 📊 **Polling & Kuis**: Menelaah pertanyaan jajak pendapat beserta opsi-opsinya.
  - 🎞️ **Animasi GIF & Stiker**: Merespons ekspresi dan set stiker secara interaktif.
- **Output Interaktif**:
  - `[TELEGRAM_POLL: ...]`: Mengirimkan polling/kuis Telegram nyata ke obrolan.
  - `[TELEGRAM_DICE: 🎲]`: Melempar dadu, panah, atau bola interaktif ke obrolan.
  - `[TELEGRAM_LOCATION: ...]`: Mengirimkan pin koordinat GPS atau venue peta.
  - `[TELEGRAM_CONTACT: ...]`: Membagikan kartu nama / nomor kontak.
  - `[TELEGRAM_PHOTO: ...]`: Mengirim foto langsung dari URL eksternal.

### Sistem Bahasa & Multi-Bahasa Per-Akun Telegram
Bre AI mendukung personalisasi bahasa dan gaya tutur yang **terisolasi penuh untuk masing-masing akun pengguna Telegram** (`fromUser.id` & `chatId`) serta tersimpan permanen di `config.json`:
- **Pilihan Bahasa Internasional (10 Bahasa Dunia)**:
  - 🇮🇩 **Bahasa Indonesia**: Otomatis menggunakan gaya **Gaul & Santai** khas anak muda Jakarta (akrab, luwes, asik, tidak kaku). Pengguna juga dapat memilih dialek lokal Nusantara lainnya.
  - 🇺🇸 **English**: Menggunakan gaya **Formal Bre AI** (cerdas, santun, terstruktur, profesional).
  - 🇯🇵 **日本語 (Japanese)**: Menggunakan gaya **Formal Bre AI** (polite Keigo/Desu-Masu, cerdas & santun).
  - 🇨🇳 **中文 (Chinese)**: Menggunakan gaya **Formal Bre AI** (Standard Chinese formal & profesional).
  - 🇪🇸 **Español (Spanish)**: Menggunakan gaya **Formal Bre AI** (formal, jelas & akurat).
  - 🇸🇦 **العربية (Arabic)**: Menggunakan gaya **Formal Bre AI** (Fusha formal & sopan).
  - 🇩🇪 **Deutsch (German)**: Menggunakan gaya **Formal Bre AI** (formal & terstruktur rapi).
  - 🇫🇷 **Français (French)**: Menggunakan gaya **Formal Bre AI** (formal & elegan).
  - 🇷🇺 **Русский (Russian)**: Menggunakan gaya **Formal Bre AI** (formal & akurat).
  - 🇰🇷 **한국어 (Korean)**: Menggunakan gaya **Formal Bre AI** (Jon-daet-mal formal & sopan).
- **Anti-Tabrakan Cache & Isolasi Prompt Murni**:
  - Generator cache router (`api/chat.js`) membedakan cache berdasarkan bahasa dan gaya (`requestedLang` + `requestedStyle`). Kueri singkat seperti *"Halo"* atau *"Siapa kamu"* tidak akan pernah salah mengembalikan bahasa lain dari cache.
  - Untuk bahasa asing, seluruh instruksi Bahasa Indonesia dihilangkan total dari system prompt guna mencegah bias token model AI.
- **9 Pilihan Gaya & Dialek Lokal untuk Bahasa Indonesia**:
  1. `santai`: Hangat, akrab, ramah, dan santai.
  2. `jakarta`: Bahasa gaul Jakarta (*gue-lu*, *bgt*, *santai abis*, *default* Bahasa Indonesia).
  3. `jawa_halus`: Bahasa Jawa Kromo Inggil (penuh rasa hormat, sopan, tata krama luhur).
  4. `jawa_kasar`: Bahasa Jawa Ngoko akrab (*cak/bro*, lugas, ceplas-ceplos).
  5. `sunda`: Bahasa Sunda akrab nan ramah (*euy*, *atuh*, *teh*, sopan dan ceria).
  6. `sopan`: Bahasa Indonesia formal dan baku sesuai EYD/KBBI.
  7. `medan`: Logat Medan/Batak (*Horas*, tegas, lugas, bersahabat).
  8. `makassar`: Logat Makassar/Bugis (*Tabe'*, *ki'*, *ji*, *mi*, bersemangat).
  9. `standar`: Bahasa cerdas standar Bre AI.

### Manajemen Provider & Endpoint via Chat Telegram
Pemilik bot (*Owner*) dapat mengontrol seluruh konfigurasi proxy router langsung dari obrolan Telegram tanpa perlu membuka file `config.json` atau merestart bot:
- Mengganti model aktif, bobot prioritas (*weight*), dan URL endpoint.
- Menambah atau memperbarui kunci API (*single* maupun *multi-key rotation*).
- Menambah atau menghapus provider baru secara fleksibel.

### Sistem Akses Kontrol: Mode Publik & Mode Diizinkan
- **Mode Publik**: Siapa pun pengguna Telegram dapat langsung menggunakan bot Bre AI.
- **Mode Diizinkan**: Hanya akun pengguna yang status perizinannya disetujui (*diizinkan*) oleh Owner yang dapat berinteraksi. Pengguna baru otomatis mengirimkan notifikasi permintaan akses ke akun Telegram Owner.
- **Daftar Blokir**: Memblokir pengguna tertentu agar tidak dapat mengirim pesan ke bot.

---

## 4. Daftar Perintah Slash Telegram (/commands)

### A. Perintah Pengguna Umum
| Perintah | Deskripsi |
|---|---|
| `/start` | Memulai interaksi, registrasi akun, dan melihat pesan selamat datang |
| `/help` | Menampilkan panduan lengkap penggunaan fitur dan format pesan |
| `/style` atau `/gaya [nama]` | Memilih gaya bahasa dan dialek lokal (Jakarta, Jawa, Sunda, dll.), atau langsung `/style jakarta` |
| `/language` atau `/bahasa [kode/nama]` | Memilih bahasa utama AI (contoh: `/bahasa en`, `/bahasa inggris`, `/lang ja`, `/bahasa id`), atau tanpa argumen untuk membuka menu tombol interaktif 10 bahasa dunia (tersimpan permanen) |
| `/file [keterangan]` | Meminta pembuatan berkas dan script langsung jadi berkas unduhan |
| `/poll [pertanyaan] \| [opsi1] \| [opsi2]` | Membuat polling interaktif langsung di chat |
| `/quiz [pertanyaan] \| [opsi1] \| [opsi2] \| [index_benar]` | Membuat kuis interaktif Telegram |
| `/dice [emoji]` | Menggelindingkan animasi dadu/permainan (🎲, 🎯, 🏀, ⚽, 🎳, 🎰) |
| `/location [lat, lon] \| [nama] \| [alamat]` | Mengirimkan titik koordinat lokasi/tempat di peta |
| `/contact [nomor] [nama_depan] [nama_belakang]` | Mengirim kartu kontak telepon |
| `/ping` | Mengecek responsivitas bot dan status koneksi |

### B. Perintah Khusus Owner / Admin
| Perintah | Deskripsi |
|---|---|
| `/admin` | Membuka Panel Admin Interaktif (Dashboard tombol inline) |
| `/status` | Melihat ringkasan status bot, model aktif, dan konfigurasi server |
| `/metrics` | Melihat statistik permintaan, token, latensi, dan histori panggilan |
| `/logs` | Menampilkan log sistem dan pesan kesalahan terakhir |
| `/providers` | Menampilkan daftar seluruh provider upstream dan status kunci API |
| `/detect [index\|nama]` | Mendeteksi daftar model AI yang tersedia dari endpoint `/v1/models` |
| `/livetest [index\|nama\|model]` | Menguji responsivitas model AI secara live dengan probe query dan latensi |
| `/setrouting [failover\|loadbalance]` | Mengganti strategi perutean permintaan AI |
| `/addprovider [nama] [url] [model] [key]` | Menambahkan provider AI baru secara langsung |
| `/delprovider [index\|nama]` | Menghapus provider AI dari sistem |
| `/editprovider [index\|nama] [url\|key\|model\|name\|weight] [nilai]` | Mengubah data spesifik dari provider tertentu |
| `/seturl [index\|nama] [url_baru]` | Mengubah alamat endpoint upstream provider |
| `/setkey [index\|nama] [kunci_baru]` | Mengatur kunci API utama provider |
| `/addkey [index\|nama] [kunci_tambahan]` | Menambahkan kunci API tambahan untuk rotasi otomatis |
| `/delkey [index\|nama] [index_kunci]` | Menghapus kunci API tertentu dari rotasi |
| `/setmodel [index\|nama] [nama_model]` | Mengganti model AI yang dipanggil pada provider tersebut |
| `/setname [index\|nama] [nama_baru]` | Mengubah label nama tampilan provider |
| `/setweight [index\|nama] [bobot_angka]` | Mengatur bobot prioritas provider (1 - 100) |
| `/access [public\|diizinkan]` | Mengubah mode perizinan akses bot |
| `/diizinkan` atau `/allowed` | Menampilkan daftar seluruh pengguna yang telah diizinkan |
| `/izinkan [telegram_user_id]` | Memberikan izin akses kepada pengguna tertentu |
| `/tolak [telegram_user_id]` | Menolak permintaan izin akses pengguna |
| `/blokir [telegram_user_id]` | Memblokir pengguna agar tidak dapat mengakses bot |
| `/hapususer [telegram_user_id]` | Menghapus akun pengguna dari daftar manajemen akses |
| `/clearcache` | Membersihkan cache respons jawaban yang tersimpan di RAM |
| `/broadcast [isi pesan]` | Mengirimkan pesan siaran resmi ke seluruh pengguna terdaftar |

---

## 5. Struktur Direktori & Penjelasan Modul

Arsitektur direktori Bre AI v3.0 dirancang terstruktur dan mudah dikembangkan:

```
bre-ai-main/
├── api/                               # SERVERLESS & BACKEND API ENGINE
│   ├── _shared.js                     # Logika inti: identitas Bre AI, dialek, routing, cache, metrik
│   ├── chat.js                        # Endpoint chat completion, failover, & SSE streaming
│   ├── config.js                      # Endpoint administrasi & manajemen konfigurasi web
│   ├── info.js                        # Endpoint publik untuk informasi status sistem
│   ├── search.js                      # Utilitas pencarian web pintar
│   ├── telegram.js                    # Webhook serverless handler untuk Telegram di Vercel
│   └── test.js                        # Endpoint uji benchmark koneksi & latensi endpoint
│
├── public/                            # FRONTEND WEB APPLICATION
│   ├── admin.html                     # Antarmuka web panel admin Bre AI
│   ├── admin.js                       # Logika interaktif panel admin (manajemen provider & akses)
│   ├── app.js                         # Klien web chat (rendering markdown, LaTeX, canvas, & download)
│   ├── bre_ai_avatar.jpg              # Aset visual avatar resmi Bre AI
│   ├── index.html                     # Antarmuka obrolan utama pengguna
│   └── style.css                      # Sistem tema gelap, glassmorphism, & animasi UI
│
├── services/                          # LAYANAN BACKGROUND & BOT
│   ├── telegram/                      # MODUL ARSITEKTUR BOT TELEGRAM TERPISAH (SRP)
│   │   ├── accessControl.js           # Sistem kontrol akses (Owner, Diizinkan, Blokir, Notifikasi)
│   │   ├── adminMenu.js               # Pengendali menu inline keyboard Telegram (/admin dashboard)
│   │   ├── api.js                     # Klien Telegram Bot API (kirim teks, berkas, foto, poll, dll.)
│   │   ├── commandHandler.js          # Pengendali seluruh perintah slash (/admin, /providers, dll.)
│   │   ├── constants.js               # Konstanta bersama, kamus ekstensi file, dan opsi bahasa
│   │   ├── forwardHandler.js          # Penangan pesan terusan (Bot API 7.0+ & Classic)
│   │   ├── index.js                   # Layanan utama polling loop & manajemen siklus bot
│   │   ├── mediaProcessor.js          # Generator berkas fisik asli & pengirim media interaktif
│   │   └── messageHandler.js          # Koordinator penerima pesan Telegram & query ke router
│   └── telegramBot.js                 # Wrapper backward-compatibility untuk ekosistem lama
│
├── tests/                             # SUITE PENGUJIAN OTOMATIS & VERIFIKASI QC (npm test)
│   ├── verify_diagnostics.js          # Pengujian fitur ping latensi, detect model, dan live test
│   ├── verify_all_updates.js          # Pengujian identitas Bre AI, 9 dialek, dan CRUD provider
│   ├── verify_forward_and_files.js    # Pengujian pesan terusan & pembuatan berkas fisik 100%
│   ├── verify_telegram_modular.js     # Pengujian integritas modularitas layanan Telegram
│   └── verify_language_switch.js      # Pengujian pergantian multi-bahasa, alias, & isolasi prompt
│
├── .gitignore                         # Daftar berkas terabaikan Git
├── config.example.json                # Berkas contoh konfigurasi dasar
├── config.json                        # Berkas konfigurasi aktif lokal (tersimpan aman)
├── package.json                       # Manifest dependensi & skrip Node.js (npm start / npm test)
├── README.md                          # Dokumentasi teknis komprehensif sistem
├── server.js                          # Server HTTP lokal terintegrasi
├── start.bat                          # Skrip peluncur otomatis sekali-klik di Windows
└── vercel.json                        # Konfigurasi perutean & serverless platform Vercel
```

---

## 6. Panduan Instalasi & Penggunaan Lokal

### Kebutuhan Sistem
- **Node.js**: Versi 18.0.0 atau lebih baru (menggunakan implementasi `fetch` bawaan).
- **Akses Internet**: Koneksi jaringan outbound ke provider AI dan `api.telegram.org`.

### Langkah-Langkah Menjalankan
1. **Masuk ke Direktori Proyek**:
   ```bash
   cd "e:\Tools Bot\bre-ai-main"
   ```

2. **Siapkan Konfigurasi**:
   Jika belum memiliki `config.json`, salin dari berkas contoh:
   ```bash
   cp config.example.json config.json
   ```
   Buka `config.json` dan masukkan token bot Telegram Anda serta API key upstream (misalnya Inception Labs atau OpenAI).

3. **Jalankan Aplikasi**:
   - **Di Windows**: Cukup klik dua kali `start.bat`, atau jalankan di terminal:
     ```bash
     npm start
     ```
   - Server lokal akan berjalan di port `3000` (dapat diubah via variabel `PORT`).
   - Buka browser di `http://localhost:3000` untuk obrolan web.
   - Buka `http://localhost:3000/admin` untuk panel admin web.
   - Layanan bot Telegram otomatis aktif dalam mode *Long Polling*.

4. **Menjalankan Pengujian Otomatis (Opsional)**:
   Untuk memastikan seluruh integrasi (pembuatan berkas fisik, pesan terusan, 9 dialek, dan CRUD provider) berjalan 100% normal:
   ```bash
   npm test
   ```

---

## 7. Panduan Deployment ke Vercel (Serverless)

Aplikasi ini sudah dioptimalkan 100% untuk berjalan di Vercel:
1. Unggah repositori ke GitHub / GitLab.
2. Impor proyek ke dashboard [Vercel](https://vercel.com).
3. Tambahkan **Environment Variables** di pengaturan proyek Vercel (lihat bagian 8).
4. Klik **Deploy**.
5. **Konfigurasi Webhook Telegram**:
   Setelah URL Vercel aktif (misalnya `https://bre-ai.vercel.app`), daftarkan webhook bot Anda dengan mengakses URL berikut di browser:
   ```text
   https://api.telegram.org/bot<TOKEN_TELEGRAM>/setWebhook?url=https://bre-ai.vercel.app/api/telegram
   ```
   Bot Anda kini akan aktif 24/7 tanpa membutuhkan server VPS menyala terus-menerus!

---

## 8. Struktur Konfigurasi (`config.json`) & Environment Variables

### Berkas Konfigurasi Lokal (`config.json`)
```json
{
  "endpoints": [
    {
      "name": "Inception Labs",
      "url": "https://api.inceptionlabs.ai/v1",
      "apiKey": "sk_your_api_key_here",
      "model": "mercury-2",
      "weight": 100,
      "enabled": true
    }
  ],
  "routing": "failover",
  "defaultStyle": "santai",
  "telegramToken": "YOUR_TELEGRAM_BOT_TOKEN",
  "telegramOwnerId": "YOUR_TELEGRAM_USER_ID",
  "telegramAccessMode": "public",
  "telegramStyle": "santai",
  "telegramLanguage": "id"
}
```

### Variabel Lingkungan (Vercel / Cloud Serverless)
| Variabel | Keterangan |
|---|---|
| `CONFIG_JSON` | Seluruh isi `config.json` dalam bentuk stringified JSON (direkomendasikan untuk Vercel) |
| `TELEGRAM_BOT_TOKEN` | Token bot Telegram dari @BotFather |
| `TELEGRAM_OWNER_ID` | Telegram User ID milik Owner bot |
| `ADMIN_PASSWORD` | Kata sandi untuk mengakses web panel di `/admin` |
| `DEFAULT_API_KEY` | Kunci API upstream utama (jika tidak menggunakan `CONFIG_JSON`) |
| `DEFAULT_BASE_URL` | Base URL upstream API (default: `https://api.inceptionlabs.ai/v1`) |
| `PORT` | Port server lokal (default: `3000`) |

---

## 9. Hak Cipta & Kredit

- **Karya Cipta & Kepemilikan Penuh**: **Amirun Rayan Ariandi**
- **Nama Produk**: **Bre AI (Universal AI Assistant & Multi-Provider Router)**
- **Versi**: 3.0.0 (Edisi Modular & Multimodal)
- **Tahun**: 2026

Seluruh hak cipta dilindungi. Penggunaan, pengembangan, dan integrasi ditujukan untuk memberikan asisten kecerdasan buatan terbaik, mandiri, dan andal bagi pengguna di seluruh dunia.
