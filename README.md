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

## Migration from SQLite

Jika Anda sebelumnya menggunakan SQLite, data perlu dimigrasikan manual ke PostgreSQL. Database schema sudah disesuaikan untuk PostgreSQL.

## Changes from SQLite

- Menggunakan `pg` driver untuk PostgreSQL
- Query menggunakan parameterized queries dengan `$1, $2, ...` format
- Semua database operations sekarang async/await
- `AUTOINCREMENT` diganti dengan `SERIAL`
- `DATETIME` diganti dengan `TIMESTAMP`
- `excluded` diganti dengan `EXCLUDED` (uppercase) dalam ON CONFLICT
