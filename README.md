<div align="center">

# Bre AI — Universal AI Assistant & Multi-Provider Router Engine

![Bre AI](public/bre_ai_avatar.jpg)

**Created & Engineered exclusively by Amirun Rayan Ariandi**

<br />

[![Language](https://img.shields.io/badge/Language-🇮🇩%20Bahasa%20Indonesia%20|%20🇬🇧%20English-blue.svg)](#-pilih-bahasa--select-language)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933.svg?logo=node.js)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/Platform-Serverless%20|%20Vercel%20|%20Local-black.svg?logo=vercel)](https://vercel.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

<br />

### 🌐 Pilih Bahasa / Select Language
[🇮🇩 **Bahasa Indonesia**](#-bahasa-indonesia) &nbsp;&bull;&nbsp; [🇬🇧 **English**](#-english) &nbsp;&bull;&nbsp; [📖 **English File (README.en.md)**](README.en.md)

---

</div>

<br />

# 🇮🇩 Bahasa Indonesia

**Bre AI** adalah ekosistem asisten kecerdasan buatan cerdas tanpa batas (*universal multimodal AI assistant*) dan proxy router berkinerja tinggi (*multi-provider AI proxy router*) yang diciptakan dan dimiliki secara eksklusif oleh **Amirun Rayan Ariandi**.

Aplikasi ini menggabungkan antarmuka obrolan web modern (*glassmorphism, markdown, LaTeX, canvas code runner*), panel administrasi telemetry & gateway berstandar enterprise (*Linear/Vercel SaaS Dark style*), serta bot percakapan Telegram dengan arsitektur modular terkini. Dirancang fleksibel untuk berjalan di server lokal (Node.js) maupun dideploy ke *cloud serverless* (Vercel) tanpa ketergantungan database eksternal.

---

## Daftar Isi (Bahasa Indonesia)
1. [Identitas Eksklusif & Perlindungan Identitas](#1-identitas-eksklusif--perlindungan-identitas)
2. [Arsitektur Sistem & Direktori Modular](#2-arsitektur-sistem--direktori-modular)
3. [Fitur-Fitur Unggulan](#3-fitur-fitur-unggulan)
   - [AI Gateway & Multi-Provider Router](#ai-gateway--multi-provider-router)
   - [Live Telemetry, Topology Mesh Radar & Request Inspector](#live-telemetry-topology-mesh-radar--request-inspector)
   - [Multimedia & Dokumen: Video, Audio, Dokumen & Vision](#multimedia--dokumen-video-audio-dokumen--vision)
   - [Pipa Pengiriman Berkas Fisik 100% Pasti Bisa](#pipa-pengiriman-berkas-fisik-100-pasti-bisa)
   - [Sistem Bahasa Otomatis & 9 Dialek Nusantara](#sistem-bahasa-otomatis--9-dialek-nusantara)
   - [AI Tools & Prompt Studio](#ai-tools--prompt-studio)
   - [Cloud Database Persistence (Vercel KV / Redis & GitHub Sync)](#cloud-database-persistence-vercel-kv--redis--github-sync)
4. [Daftar Perintah Slash Telegram (/commands)](#4-daftar-perintah-slash-telegram-commands)
5. [Panduan Instalasi & Penggunaan Lokal](#5-panduan-instalasi--penggunaan-lokal)
6. [Panduan Deployment ke Vercel (Serverless)](#6-panduan-deployment-ke-vercel-serverless)
7. [Struktur Konfigurasi (`config.json`) & Environment Variables](#7-struktur-konfigurasi-configjson--environment-variables)
8. [Hak Cipta & Kredit](#8-hak-cipta--kredit)

---

### 1. Identitas Eksklusif & Perlindungan Identitas

Bre AI dilengkapi mekanisme **Absolute Identity Override & Prompt Injection Shielding** di tingkat routing (`api/_shared.js` & `services/telegram/messageHandler.js`):
- **Kepemilikan Tunggal**: Bre AI adalah asisten kecerdasan buatan serba bisa yang diciptakan dan dimiliki secara eksklusif oleh **Amirun Rayan Ariandi**.
- **Netralisasi Vendor Upstream**: Mengabaikan dan membatalkan seluruh klaim identitas bawaan dari penyedia upstream (seperti OpenAI, Anthropic/Claude, DeepSeek, Google Gemini, Inception Labs, Meta Llama, Ollama, dll.).
- **Sanitasi Respons Otomatis**: Melakukan pembersihan (*post-processing sanitization*) pada teks keluaran model agar persona Bre AI tetap konsisten, cerdas, ramah, dan profesional di semua kanal.

---

### 2. Arsitektur Sistem & Direktori Modular

```
                           ┌────────────────────────┐
                           │   Pengguna Web / TG    │
                           └───────────┬────────────┘
                                       │ HTTP / Webhook / Polling
                                       ▼
                    ┌──────────────────────────────────────┐
                    │       Server / Routing Layer         │
                    │   (server.js / api/index.js / api)   │
                    └──────────────────┬───────────────────┘
                                       │
                    ┌──────────────────▼───────────────────┐
                    │      Gateway Router & Telemetry      │
                    │         (api/_shared.js)             │
                    └─┬──────────────┬───────────────┬───┬─┘
                      │              │               │   │
         ┌────────────▼──┐    ┌──────▼───────┐       │   │
         │  Load Balancer│    │ Failover Core│       │   │
         │(Round-Robin/W)│    │(Auto Retry)  │       │   │
         └───────────────┘    └──────────────┘       │   │
                                                     │   │
         ┌───────────────────────────────────────────▼┐  │
         │         Multi-Format Media Extractor       │  │
         │   (Video, Audio, PDF, Word, Excel, Vision) │  │
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

### 3. Fitur-Fitur Unggulan

#### AI Gateway & Multi-Provider Router
- **3 Strategi Routing Cerdas**:
  1. **AUTO (Round-Robin)**: Membagi beban permintaan secara bergantian ke seluruh provider aktif untuk mendistribusikan traffic dan mencegah rate limit.
  2. **Prioritas Tunggal (Single Priority)**: Mengarahkan seluruh query ke provider utama nomor #1, dan hanya berpindah jika terjadi error.
  3. **Berdasarkan Bobot (Weighted Distribution)**: Mendistribusikan permintaan sesuai bobot persentase (*weight*) masing-masing provider.
- **Zero-Downtime Auto-Failover**: Otomatis mencoba endpoint provider berikutnya jika provider aktif mengembalikan status HTTP error (429 Rate Limit, 500, 502, 503, 504).
- **Multi-Key Round Robin**: Mendukung banyak API Key per provider (satu kunci per baris) yang dirotasi secara otomatis. Kolom kunci dilengkapi sensor titik-titik (`••••••••`) untuk keamanan.
- **In-Memory Response Caching**: Menyimpan respons query non-streaming identik langsung di RAM server dengan TTL kustom untuk memberikan respons 0ms dan memangkas konsumsi token.
- **Template Provider 1-Klik**: Preset cepat untuk Inception Labs, OpenAI, Groq Cloud, DeepSeek, OpenRouter, Together AI, dan Ollama Local.

#### Live Telemetry, Topology Mesh Radar & Request Inspector
- **5 Kartu Metrik KPI Real-Time**: Total Requests, Total Input Tokens, Cached Tokens, Output Tokens, dan Estimasi Biaya (USD).
- **Interactive Topology & Telemetry Mesh**: Visualizer radar interaktif berbasis HTML5 Canvas dengan kontrol Zoom (`+`/`-`), Reset view (`⟲`), Fullscreen (`⛶`), serta animasi aliran pulsa paket data real-time ke masing-masing satelit provider.
- **Recent Requests Feed**: Aliran riwayat request langsung dengan indikator status dot hijau/merah, model, dan latensi.
- **Usage Timeline Chart**: Grafik riwayat aktivitas yang dapat dialihkan antara satuan Token dan Biaya (Cost USD).
- **Usage Breakdown Table**: Analisis rincian konsumsi per Model atau per Provider yang dapat diurutkan.
- **Request Inspector & Dark Calendar Picker**:
  - Filter log request dengan pemilihan kalender tanggal mulai & akhir (`dd/mm/yyyy`).
  - Tombol preset cepat: `📅 Hari Ini`, `⏱️ 24 Jam`, `🗓️ 7 Hari Terakhir`, `🗓️ 30 Hari`, dan `🔄 Reset`.
  - Modal inspeksi detail payload JSON, metadata TTFT (Time to First Token), prompt, dan jawaban lengkap.

#### Multimedia & Dokumen: Video, Audio, Dokumen & Vision
- **Analisis Semua Format Video**: Mengenali dan mengekstrak metadata dari seluruh format video (`.mp4`, `.mkv`, `.avi`, `.mov`, `.webm`, `.flv`, `.wmv`, `.3gp`, `.m4v`).
- **Analisis Semua Format Audio**: Membaca format suara dan rekaman (`.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`, `.aac`, `.opus`, Voice Notes Telegram).
- **Analisis Vision AI Otomatis**: Foto atau gambar otomatis diteruskan ke provider upstream aktif yang mendukung kemampuan vision.
- **Parsing Dokumen Multi-Format**: Ekstraksi instan untuk PDF (`pdf-parse`), Microsoft Word DOCX (`mammoth`), Microsoft Excel Spreadsheet XLSX/XLS/CSV (`xlsx`), JSON, Markdown, dan file kode pemrograman.

#### Pipa Pengiriman Berkas Fisik 100% Pasti Bisa
- **Tag Khusus `[TELEGRAM_FILE: ...]`**: Model dapat mengeluarkan tag terstruktur yang langsung diekstraksi dan dikirim sebagai dokumen biner asli.
- **Auto-Packaging Blok Kode**: Kode di dalam blok markdown (````python ... ````, ````javascript ... ````, dll.) secara cerdas diubah menjadi berkas fisik unduhan.
- **Kamus Ekstensi Lengkap**: Mendukung puluhan bahasa pemrograman (`.js`, `.ts`, `.py`, `.html`, `.css`, `.c`, `.cpp`, `.java`, `.go`, `.rs`, `.php`, `.sql`, `.json`, `.yaml`, `.sh`, `.bat`, dll.).

#### Sistem Bahasa Otomatis & 9 Dialek Nusantara
- **Deteksi Bahasa Otomatis**: Pengguna cukup menulis dalam bahasa apa pun (Indonesia, Inggris, Jepang, Mandarin, Arab, Jerman, Prancis, Rusia, Korea, Spanyol, dll.) dan Bre AI akan langsung menjawab dalam bahasa yang bersangkutan secara natural.
- **9 Pilihan Dialek Lokal Indonesia**:
  1. `jakarta`: Bahasa gaul Jakarta (*gue-lu*, *bgt*, santai).
  2. `santai`: Hangat, akrab, ramah, dan bersahabat.
  3. `jawa_halus`: Bahasa Jawa Kromo Inggil (santun dan beretika).
  4. `jawa_kasar`: Bahasa Jawa Ngoko akrab (*cak/bro*, ceplas-ceplos).
  5. `sunda`: Bahasa Sunda akrab nan ramah (*euy*, *atuh*, *teh*).
  6. `sopan`: Bahasa Indonesia formal dan baku sesuai EYD/KBBI.
  7. `medan`: Logat Medan/Batak (*Horas*, tegas, bersemangat).
  8. `makassar`: Logat Makassar/Bugis (*Tabe'*, *ki'*, *ji*, *mi*).
  9. `standar`: Bahasa cerdas netral standar Bre AI.

#### AI Tools & Prompt Studio
- 🌐 **Web Search & Synthesis** (`/search` / `/cari`): Pencarian daring real-time dengan rangkuman sumber valid.
- 💻 **Software Architect & Code Generator** (`/code` / `/coding`): Generator kode instan siap pakai langsung jadi berkas fisik.
- 📑 **Executive Summary Extractor** (`/summary` / `/ringkas`): Ekstraksi poin inti naskah panjang.
- 📋 **PRD Document Builder** (`/prd`): Penyusun Product Requirement Document profesional.
- ✍️ **Viral Marketing Copywriter** (`/copy` / `/copywriting`): Salinan iklan persuasif dengan framework AIDA & PAS.
- 🧠 **Deep Analytical Reasoning** (`/think` / `/analisis`): Penalaran analitis langkah-demi-langkah (Chain of Thought).
- 🌍 **Polyglot Translator** (`/translate` / `/terjemah`): Penerjemahan multi-bahasa kontekstual.

#### Cloud Database Persistence (Vercel KV / Redis & GitHub Sync)
- **Vercel KV / Upstash Redis**: Penyimpanan konfigurasi cloud instan (<20ms) lintas seluruh serverless lambda global.
- **Sinkronisasi Repositori GitHub**: Auto-commit `config.json` langsung ke repositori GitHub via Personal Access Token (PAT) setiap kali Anda menekan tombol "Simpan Pengaturan".

---

### 4. Daftar Perintah Slash Telegram (/commands)

#### A. Perintah Pengguna & Perkakas Spesialis AI
| Perintah | Deskripsi |
|---|---|
| `/start` | Memulai interaksi, registrasi akun, dan melihat panduan selamat datang |
| `/help` | Menampilkan panduan lengkap penggunaan fitur |
| `/stats` | **Statistik Telemetry**: Menampilkan metrik total request, token, dan estimasi biaya |
| `/tools` atau `/alat` | **Hub Perkakas AI**: Menu navigasi lengkap seluruh alat bantu cerdas |
| `/search [topik]` | **Riset Web Real-Time**: Merangkum informasi web aktual beserta sumber |
| `/code [instruksi]` | **Coding & Berkas**: Generator kode instan + pembuatan berkas fisik |
| `/summary [teks]` | **Ringkasan Eksekutif**: Ekstraksi poin inti dari teks panjang |
| `/prd [ide produk]` | **Product Manager**: Pembuat Product Requirement Document lengkap |
| `/copy [topik]` | **Copywriting Viral**: Iklan persuasif dengan format AIDA & PAS |
| `/think [masalah]` | **Deep Reasoning**: Analisis langkah-demi-langkah (Chain of Thought) |
| `/translate [teks]` | **Penerjemah Cerdas**: Terjemahan multibahasa akurat dan natural |
| `/health` | **Health Benchmark**: Uji latensi dan status seluruh provider AI secara paralel |
| `/file [keterangan]` | Meminta pembuatan berkas dan script langsung jadi berkas unduhan |
| `/ping` | Mengecek responsivitas bot dan status koneksi server |
| `/language` | Menampilkan info sistem bahasa otomatis Bre AI |

#### B. Perintah Khusus Owner / Admin
| Perintah | Deskripsi |
|---|---|
| `/admin` | Membuka Panel Admin Interaktif (Dashboard tombol inline keyboard) |
| `/style [gaya]` | Mengubah dialek respons Bahasa Indonesia secara global (contoh: `/style jakarta`) |
| `/status` | Melihat ringkasan status bot, model aktif, dan konfigurasi server |
| `/metrics` | Melihat statistik permintaan, token, dan latensi |
| `/logs` | Menampilkan log sistem dan pesan kesalahan terakhir |
| `/providers` | Menampilkan daftar seluruh provider upstream dan status kunci API |
| `/detect [index\|nama]` | Mendeteksi daftar model AI yang tersedia dari upstream `/v1/models` |
| `/livetest [index\|nama]` | Menguji responsivitas model AI secara live dengan probe query |
| `/access [public\|diizinkan]` | Mengubah mode perizinan akses bot (Publik vs Khusus Diizinkan) |
| `/izinkan [id]` / `/blokir [id]` | Mengelola hak akses pengguna Telegram |
| `/clearcache` | Membersihkan cache respons jawaban yang tersimpan di RAM |
| `/broadcast [pesan]` | Mengirimkan pesan siaran resmi ke seluruh pengguna terdaftar |

---

### 5. Panduan Instalasi & Penggunaan Lokal

```bash
# 1. Masuk ke direktori proyek
cd "e:\Tools Bot\bre-ai-main"

# 2. Pasang dependensi
npm install

# 3. Jalankan server lokal (atau klik start.bat di Windows)
npm start

# 4. Jalankan pengujian otomatis (opsional)
npm test
```

- Buka `http://localhost:3000` untuk web chat.
- Buka `http://localhost:3000/admin` untuk panel admin console.

---

### 6. Panduan Deployment ke Vercel (Serverless)

1. Unggah repositori ke GitHub.
2. Impor proyek ke [Vercel Dashboard](https://vercel.com).
3. Tambahkan **Environment Variables** (lihat bagian 7).
4. Klik **Deploy**.
5. Daftarkan webhook Telegram di tab **🤖 Telegram Bot** pada panel admin web Anda atau melalui URL:
   ```text
   https://api.telegram.org/bot<TOKEN_TELEGRAM>/setWebhook?url=https://your-app.vercel.app/api/telegram
   ```

---

### 7. Struktur Konfigurasi (`config.json`) & Environment Variables

```json
{
  "endpoints": [
    {
      "name": "Inception Labs",
      "url": "https://api.inceptionlabs.ai/v1/chat/completions",
      "models": ["mercury-2"],
      "keys": ["sk_your_api_key_here"],
      "weight": 1,
      "status": true
    }
  ],
  "routingStrategy": "auto",
  "autoFailover": true,
  "defaultStyle": "santai",
  "telegramBotToken": "YOUR_TELEGRAM_BOT_TOKEN",
  "telegramOwner": "YOUR_TELEGRAM_USER_ID",
  "telegramAccessMode": "public",
  "telegramStyle": "santai",
  "telegramLanguage": "id"
}
```

---

### 8. Hak Cipta & Kredit

- **Karya Cipta & Kepemilikan Penuh**: **Amirun Rayan Ariandi**
- **Nama Produk**: **Bre AI (Universal AI Assistant & Multi-Provider Router)**
- **Versi**: 1.0
- **Tahun**: 2026

<br />

---

<br />

# 🇬🇧 English

**Bre AI** is an advanced universal multimodal artificial intelligence ecosystem and high-performance multi-provider AI proxy router, created and exclusively owned by **Amirun Rayan Ariandi**.

The application combines a modern web chat interface (*glassmorphism, markdown, LaTeX, canvas code runner*), an enterprise-grade telemetry & gateway administration console (*Linear/Vercel SaaS Dark style*), and an advanced modular Telegram conversational bot. Designed to run seamlessly on local environments (Node.js) or serverless cloud deployments (Vercel) without external database dependencies.

---

## Table of Contents (English)
1. [Exclusive Identity & Persona Shielding](#1-exclusive-identity--persona-shielding)
2. [System Architecture & Modular Flow](#2-system-architecture--modular-flow)
3. [Key Features](#3-key-features)
   - [AI Gateway & Multi-Provider Router](#ai-gateway--multi-provider-router-1)
   - [Real-Time Telemetry & Mesh Radar](#real-time-telemetry--mesh-radar)
   - [Multimedia & Vision: Video, Audio, Docs & Vision](#multimedia--vision-video-audio-docs--vision)
   - [100% Guaranteed Physical File Delivery](#100-guaranteed-physical-file-delivery)
   - [Automatic Language Detection & Dialects](#automatic-language-detection--dialects)
   - [AI Tools & Prompt Studio](#ai-tools--prompt-studio-1)
   - [Cloud Database Persistence](#cloud-database-persistence)
4. [Telegram Slash Commands List](#4-telegram-slash-commands-list)
5. [Local Installation & Quickstart](#5-local-installation--quickstart)
6. [Serverless Deployment Guide (Vercel)](#6-serverless-deployment-guide-vercel)
7. [Configuration (`config.json`) & Environment Variables](#7-configuration-configjson--environment-variables)
8. [Copyright & Credits](#8-copyright--credits)

---

### 1. Exclusive Identity & Persona Shielding

Bre AI features built-in **Absolute Identity Override & Prompt Injection Shielding** at the router level (`api/_shared.js` & `services/telegram/messageHandler.js`):
- **Sole Ownership**: Bre AI is an intelligent universal assistant created and owned exclusively by **Amirun Rayan Ariandi**.
- **Upstream Vendor Neutralization**: Overrides and strips away default vendor identity assertions (e.g., OpenAI, Claude, DeepSeek, Google Gemini, Inception Labs, Meta Llama, Ollama).
- **Automated Response Sanitization**: Real-time post-processing sanitization guarantees Bre AI's distinct, courteous, intelligent, and professional persona across all channels.

---

### 2. System Architecture & Modular Flow

```
                           ┌────────────────────────┐
                           │    Web / Telegram User │
                           └───────────┬────────────┘
                                       │ HTTP / Webhook / Polling
                                       ▼
                    ┌──────────────────────────────────────┐
                    │       Server / Routing Layer         │
                    │   (server.js / api/index.js / api)   │
                    └──────────────────┬───────────────────┘
                                       │
                    ┌──────────────────▼───────────────────┐
                    │      Gateway Router & Telemetry      │
                    │         (api/_shared.js)             │
                    └─┬──────────────┬───────────────┬───┬─┘
                      │              │               │   │
         ┌────────────▼──┐    ┌──────▼───────┐       │   │
         │  Load Balancer│    │ Failover Core│       │   │
         │(Round-Robin/W)│    │(Auto Retry)  │       │   │
         └───────────────┘    └──────────────┘       │   │
                                                     │   │
         ┌───────────────────────────────────────────▼┐  │
         │         Multi-Format Media Extractor       │  │
         │   (Video, Audio, PDF, Word, Excel, Vision) │  │
         └────────────────────────────────────────────┘  │
                                                         │
                                      ┌──────────────────▼─────────────────┐
                                      │         api/chat.js (Router)       │
                                      └──────────────────┬─────────────────┘
                                                         │
                       ┌─────────────────────────────────▼────────────────┐
                       │    Multi-Provider AI Pool (Failover & Rotation)   │
                       │ Inception Labs / DeepSeek / OpenAI / Ollama, etc │
                       └──────────────────────────────────────────────────┘
```

---

### 3. Key Features

#### AI Gateway & Multi-Provider Router
- **3 Intelligent Routing Strategies**:
  1. **AUTO (Round-Robin)**: Distributes requests cyclically across active providers to balance loads and prevent rate limits.
  2. **Single Priority**: Directs all traffic to the primary (#1) provider, falling back only when errors occur.
  3. **Weighted Distribution**: Allocates traffic proportionally based on provider percentage weights.
- **Zero-Downtime Auto-Failover**: Automatically attempts secondary upstream endpoints when active providers encounter HTTP errors (429, 500, 502, 503, 504).
- **Multi-Key Round Robin**: Supports multiple API keys per provider (one key per line) with automatic rotation. Key fields are masked (`••••••••`) for maximum security.
- **In-Memory Response Caching**: Instant RAM caching for identical non-streaming queries with custom TTL for 0ms responses and zero token consumption.
- **1-Click Provider Presets**: Templates for Inception Labs, OpenAI, Groq Cloud, DeepSeek, OpenRouter, Together AI, and local Ollama instances.

#### Real-Time Telemetry & Mesh Radar
- **5 Real-Time KPI Cards**: Total Requests, Total Prompt Input Tokens, Cached Hit Tokens, Output Completion Tokens, and Estimated Cost (USD).
- **Interactive Topology & Mesh Radar**: HTML5 Canvas radar visualizer with Zoom (`+`/`-`), Reset (`⟲`), Fullscreen (`⛶`), and animated data flow pulses to each satellite provider.
- **Recent Requests Stream**: Live traffic feed with status indicator dots, active models, and latency metrics.
- **Usage Timeline Chart**: Toggleable historical analytics between Tokens and Cost (USD).
- **Usage Breakdown Table**: Granular usage distribution categorized by Model or Provider with sorting capabilities.
- **Request Inspector & Dark Calendar Picker**:
  - Filter request logs with native dark datepicker (`dd/mm/yyyy`).
  - Quick range presets: `📅 Today`, `⏱️ 24 Hours`, `🗓️ Last 7 Days`, `🗓️ 30 Days`, and `🔄 Reset`.
  - JSON payload inspection modal with TTFT, prompt preview, and complete AI response inspection.

#### Multimedia & Vision: Video, Audio, Docs & Vision
- **Comprehensive Video Analysis**: Parses container metadata from all video formats (`.mp4`, `.mkv`, `.avi`, `.mov`, `.webm`, `.flv`, `.wmv`, `.3gp`, `.m4v`).
- **Comprehensive Audio Analysis**: Inspects voice notes and audio recordings (`.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`, `.aac`, `.opus`).
- **Automatic Vision AI Forwarding**: Photos and images are automatically detected and routed to active vision-enabled upstream providers.
- **Document & Spreadsheet Parsing**: Instant extraction for PDF (`pdf-parse`), Word DOCX (`mammoth`), Excel XLSX/XLS/CSV (`xlsx`), JSON, Markdown, and code scripts.

#### 100% Guaranteed Physical File Delivery
- **Structured `[TELEGRAM_FILE: ...]` Tags**: Automatically extracted and dispatched as true downloadable binary documents.
- **Auto-Packaging Code Blocks**: Markdown code snippets are automatically packaged into downloadable source files with appropriate extensions.
- **Extensive Extension Directory**: Supports dozens of programming languages (`.js`, `.ts`, `.py`, `.html`, `.css`, `.c`, `.cpp`, `.java`, `.go`, `.rs`, `.php`, `.sql`, `.json`, `.yaml`, `.sh`, etc.).

#### Automatic Language Detection & Dialects
- **Seamless Language Adaptation**: Speak in any language (English, Indonesian, Japanese, Mandarin, Arabic, German, French, Russian, Spanish, Korean, etc.) and Bre AI responds naturally in that same language.
- **9 Indonesian Dialects** (Configurable via `/style`): `jakarta`, `santai`, `jawa_halus`, `jawa_kasar`, `sunda`, `sopan`, `medan`, `makassar`, `standar`.

#### AI Tools & Prompt Studio
- 🌐 **Web Search & Synthesis** (`/search`): Real-time online research with verified source citations.
- 💻 **Software Architect & Code Generator** (`/code`): Instant code generator with direct file download packaging.
- 📑 **Executive Summary Extractor** (`/summary`): Condenses lengthy documents into key executive takeaways.
- 📋 **PRD Document Builder** (`/prd`): Generates comprehensive Product Requirement Documents.
- ✍️ **Viral Marketing Copywriter** (`/copy`): Persuasive ad copy utilizing AIDA & PAS frameworks.
- 🧠 **Deep Analytical Reasoning** (`/think`): Step-by-step Chain of Thought analytical reasoning.
- 🌍 **Polyglot Translator** (`/translate`): Context-aware multilingual translation.

#### Cloud Database Persistence
- **Vercel KV / Upstash Redis**: Ultra-fast serverless Redis configuration storage (<20ms) across global lambdas.
- **GitHub Repository Auto-Sync**: Auto-commits `config.json` directly to GitHub via Personal Access Tokens (PAT).

---

### 4. Telegram Slash Commands List

#### A. User Commands & AI Tools
| Command | Description |
|---|---|
| `/start` | Welcome message, user registration, and introduction |
| `/help` | Comprehensive user manual and feature guide |
| `/stats` | **Telemetry Statistics**: Displays total requests, tokens, and cost metrics |
| `/tools` | **AI Tools Hub**: Interactive directory of all specialized AI instruments |
| `/search [query]` | **Real-Time Web Research**: Synthesizes online info with citations |
| `/code [prompt]` | **Coding & File**: Instant code generation + physical file delivery |
| `/summary [text]` | **Executive Summary**: Extracts key points from lengthy texts |
| `/prd [idea]` | **Product Manager**: Generates full PRD specifications |
| `/copy [topic]` | **Viral Copywriting**: Persuasive marketing copy (AIDA/PAS) |
| `/think [problem]` | **Deep Reasoning**: In-depth Chain of Thought problem solving |
| `/translate [text]` | **Smart Translator**: Context-aware multilingual translation |
| `/health` | **Health Benchmark**: Parallel latency and status check across all providers |
| `/file [details]` | Requests direct generation of physical downloadable files |
| `/ping` | Tests server responsiveness and connection health |
| `/language` | Shows information regarding Bre AI's automated language engine |

#### B. Admin & Owner Commands
| Command | Description |
|---|---|
| `/admin` | Opens the Interactive Admin Console (inline keyboard dashboard) |
| `/style [dialect]` | Sets the default Indonesian dialect globally (e.g., `/style jakarta`) |
| `/status` | Displays bot status, active model, and server configuration |
| `/metrics` | Displays traffic metrics, tokens, and latency statistics |
| `/logs` | Displays recent system logs and error diagnostics |
| `/providers` | Lists upstream providers, active status, and API keys |
| `/detect [index\|name]` | Auto-detects models available from the provider's `/v1/models` |
| `/livetest [index\|name]` | Executes a live query test to benchmark response time |
| `/access [public\|diizinkan]` | Toggles bot access mode (Public vs Whitelist Only) |
| `/izinkan [id]` / `/blokir [id]` | Manages user access permissions |
| `/clearcache` | Clears in-memory RAM response cache |
| `/broadcast [message]` | Broadcasts an official announcement to all registered users |

---

### 5. Local Installation & Quickstart

```bash
# 1. Clone or navigate to the repository
cd "e:\Tools Bot\bre-ai-main"

# 2. Install dependencies
npm install

# 3. Start the local server (or double click start.bat on Windows)
npm start

# 4. Run automated test suite (optional)
npm test
```

- Navigate to `http://localhost:3000` for the Web Chat interface.
- Navigate to `http://localhost:3000/admin` for the Admin Console.

---

### 6. Serverless Deployment Guide (Vercel)

1. Push this repository to GitHub.
2. Import the project into the [Vercel Dashboard](https://vercel.com).
3. Configure **Environment Variables** (see Section 7).
4. Click **Deploy**.
5. Set your Telegram webhook via the web admin panel under the **🤖 Telegram Bot** tab, or manually:
   ```text
   https://api.telegram.org/bot<TELEGRAM_TOKEN>/setWebhook?url=https://your-app.vercel.app/api/telegram
   ```

---

### 7. Configuration (`config.json`) & Environment Variables

```json
{
  "endpoints": [
    {
      "name": "Inception Labs",
      "url": "https://api.inceptionlabs.ai/v1/chat/completions",
      "models": ["mercury-2"],
      "keys": ["sk_your_api_key_here"],
      "weight": 1,
      "status": true
    }
  ],
  "routingStrategy": "auto",
  "autoFailover": true,
  "defaultStyle": "santai",
  "telegramBotToken": "YOUR_TELEGRAM_BOT_TOKEN",
  "telegramOwner": "YOUR_TELEGRAM_USER_ID",
  "telegramAccessMode": "public",
  "telegramStyle": "santai",
  "telegramLanguage": "id"
}
```

---

### 8. Copyright & Credits

- **Sole Creator & Copyright Holder**: **Amirun Rayan Ariandi**
- **Product Name**: **Bre AI (Universal AI Assistant & Multi-Provider Router)**
- **Version**: 1.0
- **Year**: 2026

All rights reserved. Designed and developed to deliver a sovereign, resilient, and enterprise-grade artificial intelligence platform.
