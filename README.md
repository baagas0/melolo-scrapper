# Melolo Scrapper

Scraper untuk download video dari Melolo API dengan PostgreSQL database.

## Prerequisites

- Node.js (v18 atau lebih baru)
- PostgreSQL (v12 atau lebih baru)

## Installation

1. Install dependencies:
```bash
yarn install
```

2. Setup database PostgreSQL:
```bash
# Login ke PostgreSQL
psql -U postgres

# Buat database baru
CREATE DATABASE melolo;

# Keluar dari psql
\q
```

3. Setup environment variables:
```bash
# Copy file env.example ke .env
cp env.example .env

# Edit .env sesuai konfigurasi PostgreSQL Anda
```

4. Jalankan migration:
```bash
yarn migrate
```

## Configuration

Edit file `.env` dengan konfigurasi database Anda:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=melolo
DB_USER=postgres
DB_PASSWORD=postgres
```

## Usage

### 🌐 Web Interface (Recommended)

Gunakan web interface untuk pengalaman yang lebih mudah dan visual:

```bash
# Start web server
yarn web
```

Then open browser: **http://localhost:3000**

**Features:**
- 📊 Real-time statistics dashboard
- 🔍 Search books dengan interface yang mudah
- 📚 Browse dan manage books library
- ⚙️ Scrape series dengan progress tracking
- 🚀 Batch scrape dengan monitoring
- 📝 Real-time logs via WebSocket
- 🎨 Modern, responsive UI

📖 **Detailed guide**: See [WEB_GUIDE.md](./WEB_GUIDE.md) for complete web interface documentation.

### 💻 CLI Interface

### Direct Scrape (if you have series ID)

Scrape dan download series:
```bash
yarn start <series_id>
```

Options:
- `--no-download` - Skip video download
- `--output-dir=DIR` - Output directory (default: ./video)
- `--concurrency=N` - Number of concurrent downloads (default: 1)

Example:
```bash
yarn start 7498275267933113345
yarn start 7498275267933113345 --output-dir=./videos --concurrency=2
```

### Search & Scrape Interface

#### 1. Search Books/Series

Cari dan simpan books/series ke database:
```bash
yarn search search [options]
```

Options:
- `--tag-id=ID` - Tag ID untuk filtering (default: 25)
- `--tag-type=TYPE` - Tag type (default: 2)
- `--limit=N` - Hasil per halaman (default: 20)
- `--max-pages=N` - Maksimal halaman (default: 1)

Example:
```bash
# Search dengan default options
yarn search search

# Search multiple pages
yarn search search --limit=20 --max-pages=5

# Search dengan tag tertentu
yarn search search --tag-id=25 --tag-type=2 --limit=10
```

#### 2. List Saved Books

Lihat daftar books yang sudah disimpan:
```bash
yarn search list [options]
```

Options:
- `--scraped-only` - Tampilkan hanya books yang sudah di-scrape
- `--limit=N` - Limit hasil (default: 50)

Example:
```bash
# List semua books
yarn search list

# List hanya yang sudah di-scrape
yarn search list --scraped-only

# List dengan limit
yarn search list --limit=100
```

#### 3. Scrape Specific Series

Scrape series tertentu by ID:
```bash
yarn search scrape <series_id> [options]
```

Options:
- `--no-download` - Skip video download
- `--output-dir=DIR` - Output directory (default: ./video)
- `--concurrency=N` - Concurrent downloads (default: 1)

Example:
```bash
yarn search scrape 7498275267933113345
yarn search scrape 7498275267933113345 --output-dir=./videos --concurrency=2
yarn search scrape 7498275267933113345 --no-download
```

#### 4. Batch Scrape

Scrape multiple books otomatis dari database:
```bash
yarn search batch [options]
```

Options:
- `--limit=N` - Jumlah books untuk di-scrape (default: 5)
- `--no-download` - Skip video download
- `--output-dir=DIR` - Output directory (default: ./video)
- `--concurrency=N` - Concurrent downloads (default: 1)

Example:
```bash
# Batch scrape 5 books
yarn search batch

# Batch scrape 10 books
yarn search batch --limit=10

# Batch scrape tanpa download
yarn search batch --limit=3 --no-download
```

### Complete Workflow Example

```bash
# 1. Search dan simpan books ke database
yarn search search --limit=20 --max-pages=3

# 2. List books yang tersimpan
yarn search list

# 3. Batch scrape beberapa books
yarn search batch --limit=5 --concurrency=2

# 4. Check hasil scraping
yarn search list --scraped-only
```

## Features

### 🌐 Web Interface
- ✅ **Modern Web UI** - Beautiful, responsive interface
- ✅ **Real-time Updates** - WebSocket-based live monitoring
- ✅ **Statistics Dashboard** - View stats at a glance
- ✅ **Visual Progress** - Track scraping and download progress
- ✅ **Books Management** - Browse, filter, and manage books
- ✅ **One-Click Actions** - Scrape and download with single click

### 🔧 Core Features
- ✅ **Direct Scraping** - Scrape series langsung dengan series ID
- ✅ **Search Interface** - Cari books/series dari API
- ✅ **Database Storage** - Simpan hasil search ke PostgreSQL
- ✅ **Batch Scraping** - Scrape multiple series otomatis
- ✅ **Video Download** - Download episode videos dengan progress tracking
- ✅ **Concurrent Downloads** - Download multiple episodes bersamaan
- ✅ **Resume Support** - Skip video yang sudah didownload

## Database Schema

### Series Table
- `id` - Primary key (auto increment)
- `melolo_series_id` - Unique series ID dari Melolo
- `cover_url` - URL cover image
- `intro` - Deskripsi series
- `title` - Judul series
- `episode_count` - Jumlah episode
- `created_at` - Timestamp dibuat
- `updated_at` - Timestamp update terakhir

### Episodes Table
- `id` - Primary key (auto increment)
- `series_id` - Foreign key ke series
- `melolo_vid_id` - Unique video ID dari Melolo
- `cover` - URL cover episode
- `title` - Judul episode
- `index_sequence` - Nomor urut episode
- `duration` - Durasi video (detik)
- `path` - Path file video yang sudah didownload
- `video_height` - Tinggi video
- `video_weight` - Lebar video
- `created_at` - Timestamp dibuat
- `updated_at` - Timestamp update terakhir

### Books Table
- `id` - Primary key (auto increment)
- `book_id` - Unique book ID dari Melolo
- `book_name` - Judul book/series
- `author` - Nama author
- `abstract` - Deskripsi singkat
- `thumb_url` - URL thumbnail
- `age_gate` - Age restriction
- `book_status` - Status book
- `book_type` - Tipe book
- `category_ids` - Category IDs (comma separated)
- `serial_count` - Jumlah episode/chapter
- `word_number` - Jumlah kata
- `language` - Bahasa
- `is_exclusive` - Exclusive flag
- `creation_status` - Status pembuatan
- `last_chapter_index` - Index chapter terakhir
- `scraped` - Flag sudah di-scrape atau belum
- `created_at` - Timestamp dibuat
- `updated_at` - Timestamp update terakhir

## Migration from SQLite

Jika Anda sebelumnya menggunakan SQLite, data perlu dimigrasikan manual ke PostgreSQL. Database schema sudah disesuaikan untuk PostgreSQL.

## Changes from SQLite

- Menggunakan `pg` driver untuk PostgreSQL
- Query menggunakan parameterized queries dengan `$1, $2, ...` format
- Semua database operations sekarang async/await
- `AUTOINCREMENT` diganti dengan `SERIAL`
- `DATETIME` diganti dengan `TIMESTAMP`
- `excluded` diganti dengan `EXCLUDED` (uppercase) dalam ON CONFLICT
