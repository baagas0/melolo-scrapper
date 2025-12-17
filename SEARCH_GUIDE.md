# Search & Scrape Guide

Quick reference untuk menggunakan fitur search dan scrape.

## Quick Start

### 1️⃣ Setup Database
```bash
# Jalankan migration untuk create tables
yarn migrate
```

### 2️⃣ Search Books
```bash
# Search books dan simpan ke database
yarn search search --limit=20 --max-pages=5

# Output akan menampilkan:
# - Total books saved
# - List books dengan author dan jumlah episodes
```

### 3️⃣ List Books
```bash
# Lihat semua books yang tersimpan
yarn search list

# Lihat hanya yang sudah di-scrape
yarn search list --scraped-only
```

### 4️⃣ Scrape
```bash
# Option A: Scrape specific series
yarn search scrape 7498275267933113345 --concurrency=2

# Option B: Batch scrape otomatis
yarn search batch --limit=5 --concurrency=2
```

## Common Workflows

### Workflow 1: Discovery & Download
```bash
# 1. Search trending books
yarn search search --tag-id=25 --limit=20 --max-pages=3

# 2. Review hasil
yarn search list

# 3. Download top 5 books
yarn search batch --limit=5 --concurrency=2
```

### Workflow 2: Targeted Scraping
```bash
# 1. Search specific category
yarn search search --tag-id=754 --tag-type=2 --limit=10

# 2. List untuk pilih
yarn search list

# 3. Scrape specific series (copy book_id dari list)
yarn search scrape <book_id> --concurrency=3
```

### Workflow 3: Bulk Collection
```bash
# 1. Search multiple pages
yarn search search --limit=20 --max-pages=10

# 2. Batch scrape semua (metadata only, no download)
yarn search batch --limit=100 --no-download

# 3. Download nanti dengan concurrency tinggi
yarn search scrape <book_id> --concurrency=5
```

## Tag Reference

Common tag IDs untuk search:

- `25` - Cinta Satu Malam (One Night Stand)
- `754` - CEO
- `721` - Serangan balik (Counterattack)
- `2` - Romansa
- `79` - Romansa Urban

Tag types:
- `2` - Standard type
- `10` - Category dimension

## Tips & Tricks

### 1. Cari Books Populer
```bash
yarn search search --tag-id=25 --limit=50 --max-pages=1
```

### 2. Download dengan Rate Limiting
```bash
# Gunakan concurrency=1 untuk avoid rate limits
yarn search batch --limit=3 --concurrency=1
```

### 3. Preview Sebelum Download
```bash
# Scrape metadata saja dulu
yarn search scrape <book_id> --no-download

# Kalau OK, baru download
yarn start <book_id> --concurrency=2
```

### 4. Monitor Progress
```bash
# Check berapa yang sudah di-scrape
yarn search list --scraped-only

# Check total
yarn search list
```

### 5. Filter by Language
Setelah search, books disimpan dengan language field. Bisa query manual dari database:
```sql
SELECT * FROM books WHERE language = 'id' AND scraped = false;
```

## Troubleshooting

### Error: Database Connection
```bash
# Check .env file
cat .env

# Test connection
psql -U postgres -d melolo -c "SELECT COUNT(*) FROM books;"
```

### Error: API Rate Limit
```bash
# Gunakan delay lebih lama atau concurrency lebih kecil
yarn search batch --limit=2 --concurrency=1
```

### Error: Out of Memory
```bash
# Reduce limit per batch
yarn search search --limit=10 --max-pages=2
```

## Advanced Usage

### Custom Search Parameters
Edit `src/api/client.js` untuk customize:
- Session ID
- Cell ID
- User preferences
- Region settings

### Database Queries
```bash
# Connect ke PostgreSQL
psql -U postgres -d melolo

# Query examples:
SELECT COUNT(*) FROM books;
SELECT COUNT(*) FROM books WHERE scraped = true;
SELECT book_name, serial_count FROM books ORDER BY serial_count DESC LIMIT 10;
SELECT language, COUNT(*) FROM books GROUP BY language;
```

### Export Results
```bash
# Export books list to CSV
psql -U postgres -d melolo -c "COPY (SELECT book_id, book_name, author, serial_count FROM books) TO STDOUT WITH CSV HEADER" > books.csv
```

## Architecture

```
Search Flow:
┌─────────────────┐
│  yarn search    │
│    search       │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  API Client     │
│  searchBooks()  │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Books Service  │
│  saveBook()     │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  PostgreSQL     │
│  books table    │
└─────────────────┘

Scrape Flow:
┌─────────────────┐
│  yarn search    │
│    batch        │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Get unscraped  │
│  books from DB  │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  For each book  │
│  scrape series  │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Download       │
│  episodes       │
└─────────────────┘
```

## File Structure

```
src/
├── api/
│   └── client.js          # API functions (searchBooks, getSeriesDetail)
├── services/
│   ├── books.js           # Books service (save, list, search)
│   ├── scraper.js         # Series scraper
│   └── downloader.js      # Video downloader
├── db/
│   ├── database.js        # PostgreSQL connection
│   └── migrate.js         # Database migrations
├── search.js              # CLI interface for search
└── index.js               # Direct scrape CLI
```


