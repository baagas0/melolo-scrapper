# Melolo Scraper

Scraper untuk download video dari Melolo API menggunakan Node.js.

## Fitur

- ✅ Scrape series dan episode dari Melolo API
- ✅ Download video ke folder `video/{movie_name}/episode_{index}.mp4`
- ✅ Mencegah duplicate episode menggunakan database SQLite
- ✅ Database schema sesuai spesifikasi (tables: series, episodes)

## Instalasi

```bash
npm install
```

## Setup Database

Jalankan migration untuk membuat database dan tables:

```bash
npm run migrate
```

## Penggunaan

### Basic Usage

```bash
npm start <series_id>
```

Contoh:
```bash
npm start 7498275267933113345
```

### Options

- `--no-download`: Skip download video (hanya scrape ke database)
- `--output-dir=DIR`: Tentukan output directory (default: `./video`)
- `--concurrency=N`: Jumlah concurrent downloads (default: 1)

Contoh:
```bash
npm start 7498275267933113345 --output-dir=./videos --concurrency=2
```

## Database Schema

### Table: series
- `id` - Primary key
- `melolo_series_id` - ID dari Melolo API (unique)
- `cover_url` - URL cover image
- `intro` - Deskripsi series
- `title` - Judul series
- `episode_count` - Jumlah episode
- `created_at` - Timestamp
- `updated_at` - Timestamp

### Table: episodes
- `id` - Primary key
- `series_id` - Foreign key ke series
- `melolo_vid_id` - ID video dari Melolo API (unique)
- `cover` - URL cover episode
- `title` - Judul episode
- `index` - Index episode
- `duration` - Durasi video (detik)
- `path` - Path file video yang didownload
- `video_height` - Tinggi video
- `video_weight` - Lebar video
- `created_at` - Timestamp
- `updated_at` - Timestamp

## Struktur Folder

```
melolo-scrapper/
├── src/
│   ├── api/
│   │   └── client.js          # API client untuk Melolo
│   ├── db/
│   │   ├── database.js        # Database connection
│   │   └── migrate.js         # Database migration
│   ├── services/
│   │   ├── scraper.js         # Scraper service
│   │   └── downloader.js      # Video downloader
│   └── index.js               # Main entry point
├── data/
│   └── melolo.db              # SQLite database (auto-generated)
├── video/                     # Output folder untuk video (auto-generated)
│   └── {movie_name}/
│       └── episode_{index}.mp4
├── package.json
└── README.md
```

## Catatan

- Scraper menggunakan headers dari Postman collection yang disediakan
- Video akan disimpan di folder `video/{movie_name}/episode_{index}.mp4`
- Duplicate episode dicegah dengan mengecek `melolo_vid_id` di database
- Jika file sudah ada, download akan di-skip

## Troubleshooting

Jika terjadi error saat download, pastikan:
1. Koneksi internet stabil
2. Headers API masih valid (mungkin perlu update dari Postman collection)
3. Video URL masih accessible

