# ⚡ Bre AI - Asisten AI Cerdas & Serba Bisa (Vercel Ready)

**Bre AI** adalah aplikasi web kecerdasan buatan serba bisa tanpa batasan kaku. Dirancang dengan arsitektur serverless modern yang dapat di-deploy ke **Vercel secara 100% GRATIS** tanpa biaya database maupun server tambahan.

---

## ✨ Fitur Unggulan

- ⚡ **Siap Deploy ke Vercel (100% Gratis)**: Menggunakan arsitektur native Vercel Serverless Functions (`/api/*`) dan static CDN. Zero setup, zero paid database.
- 🤖 **Identitas Mutlak Bre AI**: Dalam bahasa apapun (Indonesia, Inggris, Mandarin, dll.), saat ditanya mengenai model/identitas/pembuatnya, Bre AI selalu menjawab dengan bangga bahwa dirinya adalah **Bre AI**.
- 🚀 **Tanpa Limit Token Artifisial (Real-Time SSE Streaming)**: Menghasilkan output teks, kode panjang, atau esai tanpa terpotong dan tanpa terkena timeout gateway Vercel.
- 🔑 **Multi-API Key & Smart Failover**:
  - Mendukung input banyak API key sekaligus di panel admin.
  - **Auto-Rotation & Fallback**: Jika salah satu API key terkena limit (HTTP 429) atau error kuota, Bre AI otomatis berpindah ke key berikutnya secara transparan tanpa mengganggu obrolan pengguna!
- 🌐 **Custom Endpoint Fleksibel**: Kompatibel dengan semua API berstandar OpenAI (Inception Labs Mercury, OpenAI GPT-4o, OpenRouter, Groq, DeepSeek, Together, Ollama lokal, dll.).
- ⚙️ **Panel Admin Interaktif**: Dilengkapi fitur uji koneksi (test latency & status tiap key), ubah endpoint, rotasi key, ganti model, hingga kustomisasi prompt.
- 🎨 **Tampilan Ultra-Modern**: Desain Obsidian Dark dengan Glassmorphism, efek neon glow, animasi streaming, salin kode 1-klik, dan ekspor obrolan ke Markdown.
- 🔒 **Privasi & Keamanan**: Riwayat obrolan tersimpan aman di browser masing-masing pengguna via `localStorage` (tanpa biaya database server).

---

## 🚀 Panduan Deploy ke Vercel (Gratis & Cepat)

### Langkah 1: Siapkan Repository GitHub
1. Buat repository baru di [GitHub](https://github.com/new).
2. Upload atau push seluruh file dalam folder proyek ini ke repository tersebut:
   ```bash
   git init
   git add .
   git commit -m "Initial commit Bre AI"
   git branch -M main
   git remote add origin https://github.com/USERNAME/NAMA-REPO.git
   git push -u origin main
   ```

### Langkah 2: Import ke Vercel
1. Buka [Vercel Dashboard](https://vercel.com/dashboard) dan klik **Add New...** > **Project**.
2. Pilih repository GitHub yang baru saja Anda buat, lalu klik **Import**.
3. Pada halaman konfigurasi:
   - **Framework Preset**: Pilih `Other` (atau biarkan default).
   - **Root Directory**: `./` (biarkan default).
4. *(Opsional tapi Disarankan)* Buka bagian **Environment Variables** dan tambahkan:
   - `BRE_API_KEYS` : API key Anda (bisa pisahkan dengan koma jika lebih dari satu, contoh: `sk_key1,sk_key2`).
   - `BRE_API_URL` : `https://api.inceptionlabs.ai/v1/chat/completions` (atau endpoint pilihan Anda).
   - `BRE_MODEL` : `mercury-2`
   - `ADMIN_PASSWORD` : `admin` (atau password rahasia pilihan Anda).
5. Klik tombol **Deploy**!
6. Dalam hitungan detik, aplikasi Bre AI Anda sudah aktif di domain gratis seperti `https://nama-proyek.vercel.app`.

---

## 💻 Menjalankan Secara Lokal (Windows / Mac / Linux)

Pastikan Anda sudah menginstall [Node.js](https://nodejs.org) (versi 18 ke atas).

1. Buka folder ini di Terminal / Command Prompt.
2. Jalankan perintah:
   ```bash
   npm start
   ```
   *Atau di Windows, cukup klik dua kali file `start.bat`.*
3. Buka browser di `http://localhost:3000`.

---

## ⚙️ Menggunakan Panel Admin

1. Klik tombol **⚙️ Admin** di pojok kanan atas aplikasi.
2. Masukkan password admin (default: `admin`).
3. Anda dapat:
   - Mengubah **API Endpoint URL** (tersedia preset cepat untuk Inception, OpenAI, OpenRouter, Groq, DeepSeek).
   - Memasukkan **Banyak API Key** (satu baris per key).
   - Mengklik tab **⚡ Uji Koneksi** untuk mengetes semua key dan melihat latensi.
   - Mengedit **System Prompt** dan **Model ID**.
   - Klik **Simpan Konfigurasi**.

---

## 📂 Struktur Proyek

```
ai_engine/
├── api/
│   ├── _shared.js      # Helper konfigurasi, failover, & guardrail identitas Bre AI
│   ├── chat.js         # Vercel Serverless Function: Chat completion & SSE streaming
│   ├── config.js       # Vercel Serverless Function: Manajemen konfigurasi admin
│   ├── info.js         # Vercel Serverless Function: Public info & status
│   └── test.js         # Vercel Serverless Function: Uji koneksi & latensi multi API key
├── public/
│   ├── index.html      # Antarmuka web Bre AI
│   ├── style.css       # Desain Obsidian Dark Glassmorphism
│   └── app.js          # Logika client, streaming reader, & admin controller
├── config.json         # Konfigurasi default lokal
├── package.json        # Node.js metadata & scripts
├── server.js           # Server lokal terintegrasi
├── vercel.json         # Konfigurasi routing Vercel
├── start.bat           # Launcher cepat untuk Windows
└── README.md           # Dokumentasi resmi
```
