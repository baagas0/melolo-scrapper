# 📤 Upload Scheduler Guide

## Overview
Fitur auto-upload ke Dailymotion yang berjalan setiap jam. Upload series berurutan sampai seluruh episode selesai di-upload.

## Features
- ✅ Upload 1 episode per jam
- ✅ Series upload berurutan (series 1 selesai dulu, baru series 2)
- ✅ Auto-retry up to 3 times jika gagal
- ✅ Skip episode jika file corrupt/hilang atau max retry tercapai
- ✅ Resume dari episode terakhir jika server restart
- ✅ Monitor status upload (pending, uploading, completed, failed, skipped)
- ✅ WebSocket real-time updates

## Prerequisites

### 1. Setup Dailymotion API
Tambahkan credentials ke file `.env`:
```env
DAILYMOTION_API_KEY=your_api_key_here
DAILYMOTION_API_SECRET=your_api_secret_here
```

Untuk mendapatkan API credentials:
1. Buka https://www.dailymotion.com/partner
2. Create/login account
3. Buat application baru
4. Copy API Key dan API Secret

### 2. Download All Episodes
**PENTING**: Sebelum schedule upload, pastikan SEMUA episode dari series sudah di-download.

Sistem akan check dan reject jika ada episode yang belum di-download.

## How to Use

### 1. Start Server
```bash
cd /Users/baagas0/Documents/project/melolo-scrapper
node src/server.js
```

Server akan otomatis start upload scheduler saat startup.

### 2. Web Interface
Buka browser: http://localhost:3000

### 3. Add Series to Schedule

#### Via Web UI:
1. Buka tab **"📤 Upload Schedule"**
2. Masukkan Series ID (dari database)
3. Click **"Add to Upload Schedule"**
4. Episodes akan dijadwalkan otomatis (1 episode per jam)

#### Via API:
```bash
curl -X POST http://localhost:3000/api/upload/schedule \
  -H "Content-Type: application/json" \
  -d '{"seriesId": 123}'
```

**Response:**
```json
{
  "success": true,
  "message": "Scheduled 50 episodes for upload",
  "seriesTitle": "My Series Title",
  "episodesScheduled": 50,
  "scheduleStartTime": "2024-01-15T10:00:00.000Z"
}
```

### 4. Monitor Upload Progress

#### Web UI:
Tab **"📤 Upload Schedule"** menampilkan:
- **Stats**: Total, Pending, Uploading, Completed, Failed, Skipped
- **Currently Uploading**: Episode yang sedang di-upload dengan progress bar
- **Next Uploads**: 5 episode berikutnya yang dijadwalkan
- **Failed Uploads**: Episode yang gagal dengan error message

#### Via API:
```bash
curl http://localhost:3000/api/upload/schedule
```

### 5. Remove Series from Schedule

#### Web UI:
Click button **"🗑️ Remove"** pada series card

#### Via API:
```bash
curl -X DELETE http://localhost:3000/api/upload/schedule/123
```

**Note**: Hanya removes pending dan failed episodes. Episode yang sudah completed tidak akan dihapus.

## How It Works

### Scheduling Algorithm
```
Episode 1: Upload at Hour 0 (e.g., 10:00)
Episode 2: Upload at Hour 1 (e.g., 11:00)
Episode 3: Upload at Hour 2 (e.g., 12:00)
...
Episode N: Upload at Hour N-1
```

Jika current time: 10:30, scheduler akan mulai dari jam 11:00 untuk episode pertama.

### Upload Process
1. **Check**: Setiap menit, scheduler check apakah ada episode yang dijadwalkan untuk upload sekarang
2. **Validate**: Check apakah file video exists
3. **Upload**: Upload ke Dailymotion dengan progress tracking
4. **Retry**: Jika gagal, retry up to 3 times
5. **Skip**: Jika masih gagal setelah 3x retry, skip episode dan lanjut ke berikutnya

### Video Metadata
- **Title**: `[Series Title] - Episode X`
- **Description**: Dari database column `series.intro`
- **Status**: Published (langsung public)

### Retry Logic
```
Attempt 1: Upload immediately
Attempt 2: If failed, retry on next scheduler check
Attempt 3: If failed again, retry one more time
After 3 fails: Mark as "skipped" and move to next episode
```

### Resume After Restart
Saat server restart:
1. Scheduler otomatis start
2. Check database untuk episode dengan status "pending" atau "failed"
3. Resume upload dari episode terakhir yang belum completed

## API Endpoints

### POST /api/upload/schedule
Add series to upload schedule

**Request:**
```json
{
  "seriesId": 123
}
```

**Response:**
```json
{
  "success": true,
  "message": "Scheduled 50 episodes for upload",
  "seriesTitle": "Series Name",
  "episodesScheduled": 50
}
```

**Errors:**
- `400`: Series ID required
- `404`: Series not found
- `400`: Not all episodes downloaded
- `500`: Server error

### GET /api/upload/schedule
Get upload schedule status

**Query Parameters:**
- `seriesId` (optional): Filter by series ID

**Response:**
```json
{
  "success": true,
  "schedule": {
    "total": 150,
    "pending": 100,
    "uploading": 1,
    "completed": 45,
    "failed": 3,
    "skipped": 1,
    "bySeries": [
      {
        "seriesId": 123,
        "seriesTitle": "Series Name",
        "episodes": [...]
      }
    ]
  }
}
```

### DELETE /api/upload/schedule/:seriesId
Remove series from schedule

**Response:**
```json
{
  "success": true,
  "message": "Removed 45 scheduled uploads"
}
```

### GET /api/upload/scheduler/status
Get scheduler status

**Response:**
```json
{
  "success": true,
  "status": {
    "isRunning": true,
    "currentUpload": {
      "seriesTitle": "Series Name",
      "episodeIndex": 15,
      "episodeId": 12345
    }
  }
}
```

## Database Schema

### upload_schedule Table
```sql
CREATE TABLE upload_schedule (
  id SERIAL PRIMARY KEY,
  series_id INTEGER NOT NULL,
  episode_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  dailymotion_video_id TEXT,
  upload_progress INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Status Values:**
- `pending`: Waiting to be uploaded
- `uploading`: Currently uploading
- `completed`: Successfully uploaded
- `failed`: Failed but will retry
- `skipped`: Failed 3x, skipped

## WebSocket Events

### upload_scheduled
Triggered when series added to schedule
```json
{
  "type": "upload_scheduled",
  "data": {
    "seriesTitle": "Series Name",
    "episodesScheduled": 50
  }
}
```

### upload_progress
Triggered during upload
```json
{
  "type": "upload_progress",
  "data": {
    "episodeId": 12345,
    "seriesId": 123,
    "seriesTitle": "Series Name",
    "episodeIndex": 15,
    "progress": 45
  }
}
```

### upload_complete
Triggered when upload succeeds
```json
{
  "type": "upload_complete",
  "data": {
    "episodeId": 12345,
    "seriesId": 123,
    "seriesTitle": "Series Name",
    "episodeIndex": 15
  }
}
```

### upload_error
Triggered when upload fails
```json
{
  "type": "upload_error",
  "data": {
    "episodeId": 12345,
    "seriesId": 123,
    "seriesTitle": "Series Name",
    "episodeIndex": 15,
    "error": "Error message"
  }
}
```

## Troubleshooting

### Upload Tidak Mulai
**Check:**
1. Apakah server running? `node src/server.js`
2. Apakah scheduled_at sudah lewat? Check database
3. Apakah file video exists? Check `episodes.path`

**Solution:**
```sql
-- Check scheduled episodes
SELECT * FROM upload_schedule 
WHERE status = 'pending' 
  AND scheduled_at <= NOW() 
ORDER BY scheduled_at;

-- Check episode files
SELECT e.id, e.title, e.path, e.index_sequence
FROM episodes e
JOIN upload_schedule us ON e.id = us.episode_id
WHERE us.status = 'pending';
```

### Upload Failed: File Not Found
**Cause**: Video file tidak ditemukan di path yang disimpan

**Solution:**
1. Check apakah file ada: `ls -la ./video/Series_Name/`
2. Re-download episode yang missing
3. Retry upload

### Upload Failed: Authentication Error
**Cause**: Dailymotion API credentials salah atau expired

**Solution:**
1. Check `.env` file
2. Verify API key dan secret di Dailymotion partner portal
3. Restart server setelah update credentials

### Upload Stuck at "Uploading"
**Cause**: Upload process crashed atau timeout

**Solution:**
```sql
-- Reset stuck uploads
UPDATE upload_schedule 
SET status = 'failed', 
    error_message = 'Upload timeout, will retry'
WHERE status = 'uploading' 
  AND started_at < NOW() - INTERVAL '30 minutes';
```

### Too Many Failed Episodes
**Check:**
1. Network connection stable?
2. Dailymotion API rate limits?
3. Video file size valid? (Dailymotion max: 2GB)

## Best Practices

### 1. Download Management
- Download semua episode sebelum schedule upload
- Verify file integrity setelah download
- Check disk space (upload need temporary space)

### 2. Monitoring
- Check upload progress secara berkala
- Review failed episodes dan error messages
- Monitor Dailymotion account quota

### 3. Scheduling
- Jangan schedule terlalu banyak series sekaligus
- Consider Dailymotion upload limits dan quotas
- Schedule di jam low-traffic untuk bandwidth optimal

### 4. Error Handling
- Review failed episodes setelah 3x retry
- Check if file corrupted: re-download if needed
- Monitor retry_count to avoid infinite loops

## Performance Tips

### 1. Network Optimization
- Upload di jam low-traffic (malam/dini hari)
- Ensure stable internet connection
- Consider upload bandwidth limits

### 2. Resource Management
- Upload scheduler runs in background
- Won't block other operations
- Automatic cleanup after completion

### 3. Database Optimization
- Archive old upload_schedule records
- Keep only recent uploads for monitoring

```sql
-- Archive completed uploads older than 30 days
DELETE FROM upload_schedule 
WHERE status = 'completed' 
  AND completed_at < NOW() - INTERVAL '30 days';
```

## Example Workflow

### Complete Upload Flow:
```bash
# 1. Search and save books
POST /api/search
{"tagId": "25", "limit": 20}

# 2. Scrape series with download
POST /api/scrape
{"seriesId": "7498275267933113345", "download": true}

# 3. Wait for all episodes downloaded
# Check download monitor tab

# 4. Schedule upload
POST /api/upload/schedule
{"seriesId": 123}

# 5. Monitor upload progress
# Check upload schedule tab

# 6. Wait for completion
# Scheduler will upload 1 episode per hour automatically
```

## Support

Jika ada masalah:
1. Check logs di terminal/console
2. Check WebSocket messages di browser console
3. Review database untuk status detail
4. Check Dailymotion partner dashboard untuk upload history

---

**Note**: Scheduler otomatis start saat server running dan akan terus berjalan di background. Tidak perlu manual intervention setelah schedule dibuat.

