# Web Interface Guide

Panduan lengkap menggunakan Melolo Scraper Web Interface.

## 🚀 Quick Start

### 1. Setup Database
```bash
# Pastikan PostgreSQL sudah running
# Buat file .env dari env.example
cp env.example .env

# Edit .env sesuai konfigurasi database
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=melolo
# DB_USER=postgres
# DB_PASSWORD=your_password

# Jalankan migration
yarn migrate
```

### 2. Start Web Server
```bash
yarn web
```

Server akan running di: **http://localhost:3000**

### 3. Open Browser
Buka browser dan akses: **http://localhost:3000**

## 📊 Dashboard Overview

### Connection Status
Top-right corner menampilkan:
- **WebSocket Status**: Real-time connection status
- **Database Status**: PostgreSQL connection status

### Statistics Cards
Dashboard menampilkan 4 statistik utama:
1. **Total Books** - Jumlah books yang tersimpan
2. **Scraped Books** - Books yang sudah di-scrape
3. **Series** - Total series di database
4. **Episodes** - Total episodes di database

## 🔍 Search Tab

### Fungsi
Mencari books/series dari Melolo API dan menyimpannya ke database.

### Cara Menggunakan
1. Pilih tab **🔍 Search**
2. Isi form:
   - **Tag ID**: ID kategori (default: 25 untuk "One Night Stand")
   - **Tag Type**: Tipe tag (default: 2)
   - **Limit per Page**: Jumlah hasil per halaman (1-100)
   - **Max Pages**: Maksimal halaman yang akan di-fetch (1-20)
3. Klik **"Search & Save to Database"**
4. Tunggu proses selesai
5. Hasil akan ditampilkan di bawah form

### Tag ID Reference
- `25` - Cinta Satu Malam (One Night Stand)
- `754` - CEO
- `721` - Serangan balik (Counterattack)
- `2` - Romansa
- `79` - Romansa Urban

### Tips
- Gunakan **Max Pages = 1-3** untuk testing
- Untuk bulk collection, gunakan **Max Pages = 5-10**
- Progress akan tampil di **Logs tab**

## 📚 Books Tab

### Fungsi
Melihat, manage, dan scrape books yang tersimpan di database.

### Cara Menggunakan
1. Pilih tab **📚 Books**
2. Filter (optional):
   - Centang **"Show scraped only"** untuk lihat books yang sudah di-scrape
3. Klik **🔄 Refresh** untuk reload data

### Book Card
Setiap book card menampilkan:
- **Status Indicator**: 
  - 🟢 Hijau = Sudah di-scrape
  - ⚫ Abu-abu = Belum di-scrape
- **Book Name**: Judul book
- **Author**: Nama author
- **Episodes**: Jumlah episode
- **Language**: Bahasa
- **Book ID**: ID untuk scraping

### Actions
- **⚙️ Scrape** / **🔄 Re-scrape**: Scrape book ini (redirect ke Scrape tab)
- **🗑️**: Delete book dari database

### Tips
- Books dengan border hijau = sudah di-scrape
- Klik Scrape untuk langsung scrape book tertentu
- Delete hanya menghapus dari database, tidak menghapus video

## ⚙️ Scrape Tab

### Fungsi
Scrape series tertentu dan download episode videos.

### Cara Menggunakan
1. Pilih tab **⚙️ Scrape**
2. Isi form:
   - **Series ID / Book ID**: ID series yang akan di-scrape (required)
   - **Download videos**: Centang untuk download video (default: checked)
   - **Concurrency**: Jumlah download concurrent (1-10)
   - **Output Directory**: Folder output (default: ./video)
3. Klik **"Start Scraping"**
4. Progress akan ditampilkan di bawah form

### Process Flow
1. **Scraping metadata**: Mengambil info series dan episodes
2. **Download start**: Mulai download videos (jika enabled)
3. **Download progress**: Tampil di Logs tab
4. **Complete**: Series berhasil di-scrape

### Tips
- **Concurrency = 1**: Untuk koneksi lambat atau avoid rate limit
- **Concurrency = 2-3**: Optimal untuk most cases
- **Concurrency = 5+**: Untuk koneksi cepat dan server yang allow
- Gunakan **no download** untuk scrape metadata saja

## 🚀 Batch Tab

### Fungsi
Scrape multiple books otomatis dari database (unscraped books).

### Cara Menggunakan
1. Pilih tab **🚀 Batch**
2. Isi form:
   - **Number of Books**: Berapa books yang akan di-scrape (1-50)
   - **Concurrency**: Concurrent downloads per book
   - **Download videos**: Enable/disable video download
   - **Output Directory**: Folder output
3. Klik **"Start Batch Scraping"**
4. Monitor progress di progress area dan Logs tab

### Process Flow
1. Ambil N unscraped books dari database
2. Loop setiap book:
   - Scrape metadata
   - Download videos (jika enabled)
   - Mark as scraped
   - Delay 2 detik sebelum next book
3. Complete dengan summary

### Tips
- Start dengan **limit kecil** (2-3 books) untuk testing
- Batch process berjalan di **background**
- Gunakan **Logs tab** untuk monitor detail
- Process bisa memakan waktu lama untuk batch besar

## 📝 Logs Tab

### Fungsi
Menampilkan real-time logs dari semua operasi.

### Features
- **Real-time updates** via WebSocket
- **Color-coded** messages:
  - 🟢 Green = Success
  - 🔵 Blue/Cyan = Info
  - 🟡 Yellow = Warning
  - 🔴 Red = Error
- **Timestamps** untuk setiap log entry
- **Auto-scroll** ke log terbaru
- **Clear Logs** button untuk reset

### Tips
- Logs automatically limited ke 100 entries terakhir
- Monitor Logs tab saat running batch scrape
- Copy logs untuk debugging jika ada error

## 🌐 WebSocket Events

Web interface menggunakan WebSocket untuk real-time updates:

### Connection Events
- `connected` - WebSocket connected
- `disconnected` - Connection lost (auto-reconnect)

### Search Events
- `search_start` - Search dimulai
- `search_complete` - Search selesai, books saved
- `search_error` - Error saat search

### Scrape Events
- `scrape_start` - Scraping dimulai
- `scrape_metadata_complete` - Metadata fetched
- `download_start` - Download dimulai
- `download_complete` - Download selesai
- `scrape_complete` - Scraping selesai
- `scrape_error` - Error saat scrape

### Batch Events
- `batch_start` - Batch dimulai
- `batch_progress` - Progress update (current/total)
- `batch_item_complete` - 1 book selesai
- `batch_item_error` - 1 book error
- `batch_complete` - Batch selesai

## ⚙️ Configuration

### Environment Variables
```env
# Server
PORT=3000              # Web server port (default: 3000)

# Database
DB_HOST=localhost      # PostgreSQL host
DB_PORT=5432          # PostgreSQL port
DB_NAME=melolo        # Database name
DB_USER=postgres      # Database user
DB_PASSWORD=postgres  # Database password
```

### Custom Port
```bash
PORT=8080 yarn web
```

## 🔧 Troubleshooting

### WebSocket Not Connecting
1. Check if server is running: `http://localhost:3000/api/health`
2. Check browser console for errors
3. Try refresh page (F5)
4. Check firewall settings

### Database Error
1. Verify PostgreSQL is running
2. Check `.env` configuration
3. Test with: `psql -U postgres -d melolo -c "SELECT 1;"`
4. Run migration if needed: `yarn migrate`

### Stats Not Loading
1. Check database connection
2. Open browser DevTools → Network tab
3. Check `/api/stats` response
4. Verify tables exist in database

### Books Not Displaying
1. Check if books exist: `SELECT COUNT(*) FROM books;`
2. Check browser console for errors
3. Try refresh with **🔄 Refresh** button
4. Check `/api/books` API response

### Scraping Stuck
1. Check **Logs tab** untuk detail error
2. Verify series ID is correct
3. Check network connection
4. Try lower concurrency (1-2)
5. Check if video directory is writable

### Batch Scraping Not Starting
1. Check if unscraped books exist
2. Go to **Books tab** → uncheck "scraped only"
3. Verify books in database
4. Check **Logs tab** for errors

## 🎨 UI Features

### Responsive Design
- Desktop: Full-width layout dengan stats grid
- Tablet: 2-column grid
- Mobile: Single column, touch-friendly

### Dark Mode
Not implemented yet (coming soon!)

### Keyboard Shortcuts
- `Tab`: Navigate between form fields
- `Enter`: Submit active form
- `Esc`: (future) Close modals

## 📱 Mobile Access

Web interface fully responsive untuk mobile:

1. Start server: `yarn web`
2. Get your local IP: `ifconfig` or `ipconfig`
3. Access from mobile: `http://YOUR_IP:3000`
4. Make sure mobile dan server di network yang sama

## 🚀 Production Deployment

### Using PM2
```bash
# Install PM2
npm install -g pm2

# Start server
pm2 start src/server.js --name melolo-web

# Auto-restart on reboot
pm2 startup
pm2 save
```

### Using Docker (Future)
Coming soon!

### Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📊 Performance Tips

### Database
- Regular `VACUUM ANALYZE` untuk optimize PostgreSQL
- Index sudah created otomatis via migration
- Monitor dengan `pg_stat_statements`

### WebSocket
- Connection auto-reconnect jika disconnect
- Max 100 log entries di client
- Efficient JSON messaging

### API
- Connection pooling untuk PostgreSQL (max: 20)
- Proper error handling
- Request timeout: 30s

## 🔐 Security Notes

⚠️ **Important**: Web interface ini untuk **development/local use**.

Untuk production:
- Add authentication (JWT, OAuth, etc.)
- Enable HTTPS
- Add rate limiting
- Implement CORS properly
- Use environment variables untuk secrets
- Add input validation
- Sanitize user inputs

## 📝 API Endpoints Reference

- `GET /api/health` - Health check
- `GET /api/stats` - Statistics
- `GET /api/books` - List books
- `GET /api/books/unscraped` - Unscraped books
- `POST /api/search` - Search & save books
- `POST /api/scrape` - Scrape series
- `POST /api/batch-scrape` - Batch scrape
- `DELETE /api/books/:bookId` - Delete book

WebSocket: `ws://localhost:3000`

## 🎯 Best Practices

1. **Always start with search**: Get books first
2. **Test with small batch**: Try 2-3 books first
3. **Monitor logs**: Keep Logs tab open during operations
4. **Check stats regularly**: Monitor progress via dashboard
5. **Use appropriate concurrency**: Start low, increase if stable
6. **Regular cleanup**: Delete old/unwanted books
7. **Backup database**: Regular PostgreSQL backups

## 🆘 Support

Jika ada masalah:
1. Check **Logs tab** untuk detail error
2. Check browser console (F12)
3. Check server logs di terminal
4. Verify database connection
5. Try restart server: `Ctrl+C` then `yarn web`


