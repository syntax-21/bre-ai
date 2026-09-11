# Bre AI — Universal AI Assistant & Multi-Provider Router Engine

![Bre AI](public/bre_ai_avatar.jpg)

**Created & Engineered exclusively by Amirun Rayan Ariandi**

<br />

[![Language](https://img.shields.io/badge/Language-🇮🇩%20Bahasa%20Indonesia%20|%20🇬🇧%20English-blue.svg)](README.md)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933.svg?logo=node.js)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/Platform-Serverless%20|%20Vercel%20|%20Local-black.svg?logo=vercel)](https://vercel.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

<br />

### 🌐 Select Language
[🇮🇩 **Versi Bahasa Indonesia (README.md)**](README.md#-bahasa-indonesia) &nbsp;&bull;&nbsp; [🇬🇧 **English Edition**](README.en.md)

---

**Bre AI** is an advanced universal multimodal artificial intelligence ecosystem and high-performance multi-provider AI proxy router, created and exclusively owned by **Amirun Rayan Ariandi**.

The application combines a modern web chat interface (*glassmorphism, markdown, LaTeX, canvas code runner*), an enterprise-grade telemetry & gateway administration console (*Linear/Vercel SaaS Dark style*), and an advanced modular Telegram conversational bot. Designed to run seamlessly on local environments (Node.js) or serverless cloud deployments (Vercel) without external database dependencies.

---

## Table of Contents
1. [Exclusive Identity & Persona Shielding](#1-exclusive-identity--persona-shielding)
2. [System Architecture & Modular Flow](#2-system-architecture--modular-flow)
3. [Key Features](#3-key-features)
   - [AI Gateway & Multi-Provider Router](#ai-gateway--multi-provider-router)
   - [Real-Time Telemetry & Mesh Radar](#real-time-telemetry--mesh-radar)
   - [Multimedia & Vision: Video, Audio, Docs & Vision](#multimedia--vision-video-audio-docs--vision)
   - [100% Guaranteed Physical File Delivery](#100-guaranteed-physical-file-delivery)
   - [Automatic Language Detection & Dialects](#automatic-language-detection--dialects)
   - [AI Tools & Prompt Studio](#ai-tools--prompt-studio)
   - [Cloud Database Persistence](#cloud-database-persistence)
4. [Telegram Slash Commands List](#4-telegram-slash-commands-list)
5. [Directory Structure & Modules](#5-directory-structure--modules)
6. [Local Installation & Quickstart](#6-local-installation--quickstart)
7. [Serverless Deployment Guide (Vercel)](#7-serverless-deployment-guide-vercel)
8. [Configuration (`config.json`) & Environment Variables](#8-configuration-configjson--environment-variables)
9. [Copyright & Credits](#9-copyright--credits)

---

## 1. Exclusive Identity & Persona Shielding

Bre AI features built-in **Absolute Identity Override & Prompt Injection Shielding** at the router level (`api/_shared.js` & `services/telegram/messageHandler.js`):
- **Sole Ownership**: Bre AI is an intelligent universal assistant created and owned exclusively by **Amirun Rayan Ariandi**.
- **Upstream Vendor Neutralization**: Overrides and strips away default vendor identity assertions (e.g., OpenAI, Claude, DeepSeek, Google Gemini, Inception Labs, Meta Llama, Ollama).
- **Automated Response Sanitization**: Real-time post-processing sanitization guarantees Bre AI's distinct, courteous, intelligent, and professional persona across all channels.

---

## 2. System Architecture & Modular Flow

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

## 3. Key Features

### AI Gateway & Multi-Provider Router
- **3 Intelligent Routing Strategies**:
  1. **AUTO (Round-Robin)**: Distributes requests cyclically across active providers to balance loads and prevent rate limits.
  2. **Single Priority**: Directs all traffic to the primary (#1) provider, falling back only when errors occur.
  3. **Weighted Distribution**: Allocates traffic proportionally based on provider percentage weights.
- **Zero-Downtime Auto-Failover**: Automatically attempts secondary upstream endpoints when active providers encounter HTTP errors (429, 500, 502, 503, 504).
- **Multi-Key Round Robin**: Supports multiple API keys per provider (one key per line) with automatic rotation. Key fields are masked (`••••••••`) for maximum security.
- **In-Memory Response Caching**: Instant RAM caching for identical non-streaming queries with custom TTL for 0ms responses and zero token consumption.
- **1-Click Provider Presets**: Templates for Inception Labs, OpenAI, Groq Cloud, DeepSeek, OpenRouter, Together AI, and local Ollama instances.

### Real-Time Telemetry & Mesh Radar
- **5 Real-Time KPI Cards**: Total Requests, Total Prompt Input Tokens, Cached Hit Tokens, Output Completion Tokens, and Estimated Cost (USD).
- **Interactive Topology & Mesh Radar**: HTML5 Canvas radar visualizer with Zoom (`+`/`-`), Reset (`⟲`), Fullscreen (`⛶`), and animated data flow pulses to each satellite provider.
- **Recent Requests Stream**: Live traffic feed with status indicator dots, active models, and latency metrics.
- **Usage Timeline Chart**: Toggleable historical analytics between Tokens and Cost (USD).
- **Usage Breakdown Table**: Granular usage distribution categorized by Model or Provider with sorting capabilities.
- **Request Inspector & Dark Calendar Picker**:
  - Filter request logs with native dark datepicker (`dd/mm/yyyy`).
  - Quick range presets: `📅 Today`, `⏱️ 24 Hours`, `🗓️ Last 7 Days`, `🗓️ 30 Days`, and `🔄 Reset`.
  - JSON payload inspection modal with TTFT, prompt preview, and complete AI response inspection.

### Multimedia & Vision: Video, Audio, Docs & Vision
- **Comprehensive Video Analysis**: Parses container metadata from all video formats (`.mp4`, `.mkv`, `.avi`, `.mov`, `.webm`, `.flv`, `.wmv`, `.3gp`, `.m4v`).
- **Comprehensive Audio Analysis**: Inspects voice notes and audio recordings (`.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`, `.aac`, `.opus`).
- **Automatic Vision AI Forwarding**: Photos and images are automatically detected and routed to active vision-enabled upstream providers.
- **Document & Spreadsheet Parsing**: Instant extraction for PDF (`pdf-parse`), Word DOCX (`mammoth`), Excel XLSX/XLS/CSV (`xlsx`), JSON, Markdown, and code scripts.

### 100% Guaranteed Physical File Delivery
- **Structured `[TELEGRAM_FILE: ...]` Tags**: Automatically extracted and dispatched as true downloadable binary documents.
- **Auto-Packaging Code Blocks**: Markdown code snippets are automatically packaged into downloadable source files with appropriate extensions.
- **Extensive Extension Directory**: Supports dozens of programming languages (`.js`, `.ts`, `.py`, `.html`, `.css`, `.c`, `.cpp`, `.java`, `.go`, `.rs`, `.php`, `.sql`, `.json`, `.yaml`, `.sh`, etc.).

### Automatic Language Detection & Dialects
- **Seamless Language Adaptation**: Speak in any language (English, Indonesian, Japanese, Mandarin, Arabic, German, French, Russian, Spanish, Korean, etc.) and Bre AI responds naturally in that same language.
- **9 Indonesian Dialects** (Configurable via `/style`): `jakarta`, `santai`, `jawa_halus`, `jawa_kasar`, `sunda`, `sopan`, `medan`, `makassar`, `standar`.

### AI Tools & Prompt Studio
- 🌐 **Web Search & Synthesis** (`/search`): Real-time online research with verified source citations.
- 💻 **Software Architect & Code Generator** (`/code`): Instant code generator with direct file download packaging.
- 📑 **Executive Summary Extractor** (`/summary`): Condenses lengthy documents into key executive takeaways.
- 📋 **PRD Document Builder** (`/prd`): Generates comprehensive Product Requirement Documents.
- ✍️ **Viral Marketing Copywriter** (`/copy`): Persuasive ad copy utilizing AIDA & PAS frameworks.
- 🧠 **Deep Analytical Reasoning** (`/think`): Step-by-step Chain of Thought analytical reasoning.
- 🌍 **Polyglot Translator** (`/translate`): Context-aware multilingual translation.

### Cloud Database Persistence
- **Vercel KV / Upstash Redis**: Ultra-fast serverless Redis configuration storage (<20ms) across global lambdas.
- **GitHub Repository Auto-Sync**: Auto-commits `config.json` directly to GitHub via Personal Access Tokens (PAT).

---

## 4. Telegram Slash Commands List

### A. User Commands & AI Tools
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

### B. Admin & Owner Commands
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

## 5. Directory Structure & Modules

```
bre-ai-main/
├── api/                               # SERVERLESS & BACKEND API ENGINE
│   ├── _shared.js                     # Core logic: Bre AI identity, routing, telemetry, cache, metrics
│   ├── chat.js                        # Chat completions endpoint, failover, & SSE streaming
│   ├── config.js                      # Admin endpoints, telemetry aggregator & config manager
│   ├── info.js                        # Public status info endpoint
│   ├── models.js                      # OpenAI compatible /v1/models endpoint
│   ├── search.js                      # Smart web research utility
│   ├── telegram.js                    # Serverless Telegram webhook handler for Vercel
│   └── test.js                        # Connection benchmark & latency test endpoint
│
├── data/                              # LOCAL PERSISTENT STORAGE
│   ├── request_logs.json              # Local telemetry request records
│   └── telegram_sessions.json         # Telegram multi-turn chat session memory
│
├── public/                            # FRONTEND WEB APPLICATION
│   ├── admin.html                     # Bre AI Admin Console (Linear/Vercel Dark, Telemetry Radar)
│   ├── admin.js                       # Admin panel interactive logic (Canvas mesh, date filter, key mask)
│   ├── app.js                         # Web chat client (Markdown, LaTeX, canvas, & download)
│   ├── bre_ai_avatar.jpg              # Official Bre AI visual avatar asset
│   ├── index.html                     # Main user chat interface
│   └── style.css                      # Dark theme system, glassmorphism, & UI animations
│
├── services/                          # BACKGROUND SERVICES & BOT
│   ├── telegram/                      # MODULAR TELEGRAM BOT ENGINE (SRP)
│   │   ├── accessControl.js           # Access control system (Owner, Allowed, Blocked)
│   │   ├── adminMenu.js               # Telegram inline keyboard menu controller (/admin)
│   │   ├── api.js                     # Telegram Bot API client (sends text, files, photos, polls)
│   │   ├── commandHandler.js          # Handles all slash commands
│   │   ├── constants.js               # Shared constants & extension directory
│   │   ├── documentParser.js          # PDF, Word DOCX, & Excel XLSX parsers
│   │   ├── forwardHandler.js          # Forwarded message handler (Bot API 7.0+ & Classic)
│   │   ├── index.js                   # Main service loop & bot lifecycle
│   │   ├── mediaProcessor.js          # Physical file generator & interactive media dispatcher
│   │   ├── messageHandler.js          # Message coordinator & router forwarder
│   │   └── sessionManager.js          # Multi-turn chat conversation memory manager
│   └── telegramBot.js                 # Backward-compatibility wrapper
│
├── tests/                             # AUTOMATED TEST SUITE (npm test)
│   ├── test_docx_xlsx.js              # Word DOCX & Excel XLSX parser tests
│   ├── verify_diagnostics.js          # Latency ping, detect model, live test verification
│   ├── verify_all_updates.js          # Bre AI identity, 9 dialects, provider CRUD tests
│   ├── verify_forward_and_files.js    # Forwarded messages & 100% physical file delivery tests
│   ├── verify_language_switch.js      # Automated language detection tests
│   ├── verify_telegram_memory.js      # Multi-turn chat context memory tests
│   ├── verify_telegram_modular.js     # Modular Telegram bot service integrity tests
│   ├── verify_telegram_excel_flow.js  # Spreadsheet analysis end-to-end flow tests
│   └── verify_video_audio_telemetry.js # Video, audio container parser & telemetry aggregation tests
│
├── .gitignore                         # Git ignore rules
├── config.example.json                # Example base configuration file
├── config.json                        # Local active configuration file (safe storage)
├── package.json                       # Node.js manifest & scripts (npm start / npm test)
├── README.md                          # Primary dual-language system documentation
├── README.en.md                       # Standalone English documentation
├── server.js                          # Integrated local HTTP server
├── start.bat                          # 1-Click Windows launch script
└── vercel.json                        # Vercel serverless routing configuration
```

---

## 6. Local Installation & Quickstart

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

## 7. Serverless Deployment Guide (Vercel)

1. Push this repository to GitHub.
2. Import the project into the [Vercel Dashboard](https://vercel.com).
3. Configure **Environment Variables** (see Section 8).
4. Click **Deploy**.
5. Set your Telegram webhook via the web admin panel under the **🤖 Telegram Bot** tab, or manually:
   ```text
   https://api.telegram.org/bot<TELEGRAM_TOKEN>/setWebhook?url=https://your-app.vercel.app/api/telegram
   ```

---

## 8. Configuration (`config.json`) & Environment Variables

### Local Configuration (`config.json`)
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

### Environment Variables (Vercel / Cloud Serverless)
| Variable | Description |
|---|---|
| `CONFIG_JSON` | Full stringified content of `config.json` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather |
| `TELEGRAM_OWNER_ID` | Telegram User ID of the Owner |
| `ADMIN_PASSWORD` | Password to access the web console at `/admin` |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis / Vercel KV REST API endpoint URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis / Vercel KV REST API authentication token |
| `GITHUB_TOKEN` | GitHub Personal Access Token (PAT) for auto-sync |
| `GITHUB_REPO` | Target GitHub repository (e.g., `AmirunRayan/bre-ai-main`) |
| `PORT` | Local server port (default: `3000`) |

---

## 9. Copyright & Credits

- **Sole Creator & Copyright Holder**: **Amirun Rayan Ariandi**
- **Product Name**: **Bre AI (Universal AI Assistant & Multi-Provider Router)**
- **Version**: 1.0
- **Year**: 2026

All rights reserved. Designed and developed to deliver a sovereign, resilient, and enterprise-grade artificial intelligence platform.
