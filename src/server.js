import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { 
  searchAndSaveBooks, 
  getBooks, 
  getUnscrapedBooks,
  markBookAsScraped,
  deleteBook 
} from './services/books.js';
import { scrapeSeries, getEpisodesToDownload } from './services/scraper.js';
import { downloadSeriesEpisodes } from './services/downloader.js';
import { 
  getQueueStatus, 
  clearQueue, 
  retryFailed 
} from './services/downloadQueue.js';
import {
  addSeriesToSchedule,
  getUploadSchedule,
  removeSeriesFromSchedule
} from './services/uploader.js';
import { getScheduler } from './services/uploadScheduler.js';
import pool from './db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// Store active WebSocket connections
const wsClients = new Set();

// API Routes

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    
    res.json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: error.message 
    });
  }
});

/**
 * POST /api/search
 * Search books and save to database
 */
app.post('/api/search', async (req, res) => {
  try {
    const { tagId, tagType, limit, maxPages, cellId } = req.body;
    console.log('===> server.js:64 ~ { tagId, tagType, limit, maxPages, cellId }', { tagId, tagType, limit, maxPages, cellId });
    
    broadcastMessage({
      type: 'search_start',
      data: { tagId, tagType, limit, maxPages }
    });

    const result = await searchAndSaveBooks({
      tagId,
      tagType,
      limit: limit || 20,
      maxPages: maxPages || 1,
      cellId: cellId || '7450059162446200848'
    });

    broadcastMessage({
      type: 'search_complete',
      data: result
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Search error:', error);
    broadcastMessage({
      type: 'search_error',
      data: { message: error.message }
    });
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

/**
 * GET /api/books
 * Get all books from database
 */
app.get('/api/books', async (req, res) => {
  try {
    const { scrapedOnly, limit } = req.query;
    
    const books = await getBooks({
      scrapedOnly: scrapedOnly === 'true',
      limit: parseInt(limit) || 100
    });

    res.json({
      success: true,
      total: books.length,
      books
    });
  } catch (error) {
    console.error('Get books error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

/**
 * GET /api/books/unscraped
 * Get unscraped books
 */
app.get('/api/books/unscraped', async (req, res) => {
  try {
    const { limit } = req.query;
    
    const books = await getUnscrapedBooks(parseInt(limit) || 10);

    res.json({
      success: true,
      total: books.length,
      books
    });
  } catch (error) {
    console.error('Get unscraped books error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

/**
 * POST /api/scrape
 * Scrape a specific series
 */
app.post('/api/scrape', async (req, res) => {
  try {
    const { seriesId, download, outputDir, concurrency } = req.body;

    if (!seriesId) {
      return res.status(400).json({
        success: false,
        message: 'Series ID is required'
      });
    }

    broadcastMessage({
      type: 'scrape_start',
      data: { seriesId }
    });

    // Scrape series
    const scrapedData = await scrapeSeries(seriesId);
    
    broadcastMessage({
      type: 'scrape_metadata_complete',
      data: {
        seriesId,
        title: scrapedData.title,
        episodesCount: scrapedData.episodes.length
      }
    });

    let downloadedPaths = [];
    if (download !== false) {
      broadcastMessage({
        type: 'download_start',
        data: { 
          seriesId: scrapedData.seriesId,
          episodesCount: scrapedData.episodes.length 
        }
      });

      // Progress callback for WebSocket updates
      const progressCallback = (episodeId, data) => {
        broadcastMessage({
          type: 'download_progress',
          data: {
            seriesId: scrapedData.seriesId,
            episodeId,
            ...data
          }
        });
      };

      downloadedPaths = await downloadSeriesEpisodes(
        scrapedData.seriesId,
        outputDir || './video',
        concurrency || 1,
        progressCallback
      );

      broadcastMessage({
        type: 'download_complete',
        data: { 
          seriesId: scrapedData.seriesId,
          count: downloadedPaths.length 
        }
      });
    }

    // Mark book as scraped if exists
    try {
      await markBookAsScraped(seriesId);
    } catch (err) {
      console.log('Book not in database, skipping mark as scraped');
    }

    broadcastMessage({
      type: 'scrape_complete',
      data: {
        seriesId,
        title: scrapedData.title,
        episodesCount: scrapedData.episodes.length,
        downloadedCount: downloadedPaths.length
      }
    });

    res.json({
      success: true,
      series: scrapedData,
      downloadedCount: downloadedPaths.length
    });
  } catch (error) {
    console.error('Scrape error:', error);
    broadcastMessage({
      type: 'scrape_error',
      data: { message: error.message }
    });
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

/**
 * POST /api/batch-scrape
 * Batch scrape multiple books
 */
app.post('/api/batch-scrape', async (req, res) => {
  try {
    const { limit, download, outputDir, concurrency } = req.body;

    const unscrapedBooks = await getUnscrapedBooks(limit || 5);

    if (unscrapedBooks.length === 0) {
      return res.json({
        success: true,
        message: 'No unscraped books found',
        processed: 0
      });
    }

    broadcastMessage({
      type: 'batch_start',
      data: { total: unscrapedBooks.length }
    });

    // Start batch process (don't await - run in background)
    processBatchScrape(unscrapedBooks, {
      download: download !== false,
      outputDir: outputDir || './video',
      concurrency: concurrency || 1
    });

    res.json({
      success: true,
      message: 'Batch scraping started',
      total: unscrapedBooks.length
    });
  } catch (error) {
    console.error('Batch scrape error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

/**
 * DELETE /api/books/:bookId
 * Delete a book
 */
app.delete('/api/books/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;
    
    await deleteBook(bookId);

    res.json({
      success: true,
      message: 'Book deleted successfully'
    });
  } catch (error) {
    console.error('Delete book error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

/**
 * GET /api/stats
 * Get statistics
 */
app.get('/api/stats', async (req, res) => {
  try {
    const client = await pool.connect();
    
    const [booksResult, scrapedResult, seriesResult, episodesResult] = await Promise.all([
      client.query('SELECT COUNT(*) as count FROM books'),
      client.query('SELECT COUNT(*) as count FROM books WHERE scraped = true'),
      client.query('SELECT COUNT(*) as count FROM series'),
      client.query('SELECT COUNT(*) as count FROM episodes')
    ]);
    
    client.release();

    res.json({
      success: true,
      stats: {
        totalBooks: parseInt(booksResult.rows[0].count),
        scrapedBooks: parseInt(scrapedResult.rows[0].count),
        totalSeries: parseInt(seriesResult.rows[0].count),
        totalEpisodes: parseInt(episodesResult.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

/**
 * GET /api/download/queue
 * Get download queue status
 */
app.get('/api/download/queue', async (req, res) => {
  try {
    const { seriesId } = req.query;
    
    const queueStatus = await getQueueStatus(seriesId ? parseInt(seriesId) : null);

    res.json({
      success: true,
      queue: queueStatus
    });
  } catch (error) {
    console.error('Get queue error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

/**
 * POST /api/download/queue/clear
 * Clear completed/failed downloads from queue
 */
app.post('/api/download/queue/clear', async (req, res) => {
  try {
    const { seriesId } = req.body;
    
    const cleared = await clearQueue(seriesId || null);

    broadcastMessage({
      type: 'queue_cleared',
      data: { count: cleared }
    });

    res.json({
      success: true,
      message: `Cleared ${cleared} items from queue`
    });
  } catch (error) {
    console.error('Clear queue error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

/**
 * POST /api/download/queue/retry
 * Retry failed downloads
 */
app.post('/api/download/queue/retry', async (req, res) => {
  try {
    const { seriesId } = req.body;
    
    const retried = await retryFailed(seriesId || null);

    broadcastMessage({
      type: 'queue_retry',
      data: { count: retried }
    });

    res.json({
      success: true,
      message: `Reset ${retried} failed downloads to pending`
    });
  } catch (error) {
    console.error('Retry failed error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

/**
 * POST /api/upload/schedule
 * Add series to upload schedule
 */
app.post('/api/upload/schedule', async (req, res) => {
  try {
    const { seriesId } = req.body;

    if (!seriesId) {
      return res.status(400).json({
        success: false,
        message: 'Series ID is required'
      });
    }

    const result = await addSeriesToSchedule(parseInt(seriesId));

    broadcastMessage({
      type: 'upload_scheduled',
      data: result
    });

    res.json({
      success: true,
      message: `Scheduled ${result.episodesScheduled} episodes for upload`,
      ...result
    });
  } catch (error) {
    console.error('Schedule upload error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

/**
 * GET /api/upload/schedule
 * Get upload schedule
 */
app.get('/api/upload/schedule', async (req, res) => {
  try {
    const { seriesId } = req.query;
    
    const schedule = await getUploadSchedule(seriesId ? parseInt(seriesId) : null);

    res.json({
      success: true,
      schedule
    });
  } catch (error) {
    console.error('Get upload schedule error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

/**
 * DELETE /api/upload/schedule/:seriesId
 * Remove series from upload schedule
 */
app.delete('/api/upload/schedule/:seriesId', async (req, res) => {
  try {
    const { seriesId } = req.params;
    
    const removed = await removeSeriesFromSchedule(parseInt(seriesId));

    broadcastMessage({
      type: 'upload_schedule_removed',
      data: { seriesId, count: removed }
    });

    res.json({
      success: true,
      message: `Removed ${removed} scheduled uploads`
    });
  } catch (error) {
    console.error('Remove upload schedule error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

/**
 * GET /api/upload/scheduler/status
 * Get scheduler status
 */
app.get('/api/upload/scheduler/status', (req, res) => {
  try {
    const scheduler = getScheduler();
    const status = scheduler.getStatus();

    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Get scheduler status error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// Helper functions

async function processBatchScrape(books, options) {
  const { download, outputDir, concurrency } = options;
  let processed = 0;
  let failed = 0;

  for (const book of books) {
    try {
      broadcastMessage({
        type: 'batch_progress',
        data: {
          current: processed + 1,
          total: books.length,
          bookName: book.book_name,
          bookId: book.book_id
        }
      });

      const scrapedData = await scrapeSeries(book.book_id);
      
      if (download) {
        // Progress callback for WebSocket updates
        const progressCallback = (episodeId, data) => {
          broadcastMessage({
            type: 'download_progress',
            data: {
              seriesId: scrapedData.seriesId,
              episodeId,
              ...data
            }
          });
        };

        await downloadSeriesEpisodes(
          scrapedData.seriesId,
          outputDir,
          concurrency,
          progressCallback
        );
      }

      await markBookAsScraped(book.book_id);
      processed++;

      broadcastMessage({
        type: 'batch_item_complete',
        data: {
          bookId: book.book_id,
          bookName: book.book_name,
          success: true
        }
      });

    } catch (error) {
      console.error(`Failed to scrape ${book.book_name}:`, error.message);
      failed++;

      broadcastMessage({
        type: 'batch_item_error',
        data: {
          bookId: book.book_id,
          bookName: book.book_name,
          error: error.message
        }
      });
    }

    // Delay between books
    if (processed + failed < books.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  broadcastMessage({
    type: 'batch_complete',
    data: {
      total: books.length,
      processed,
      failed
    }
  });
}

function broadcastMessage(message) {
  const data = JSON.stringify(message);
  wsClients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(data);
    }
  });
}

// Start server
const server = app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('Melolo Scraper Web Interface');
  console.log('='.repeat(60));
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log(`WebSocket server ready`);
  console.log('='.repeat(60));
  
  // Start upload scheduler
  const scheduler = getScheduler();
  scheduler.start((message) => {
    // Broadcast upload progress via WebSocket
    broadcastMessage(message);
  });
  console.log('Upload scheduler started');
});

// WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');
  wsClients.add(ws);

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    wsClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    wsClients.delete(ws);
  });

  // Send initial connection message
  ws.send(JSON.stringify({
    type: 'connected',
    data: { message: 'Connected to Melolo Scraper' }
  }));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  
  // Stop scheduler
  const scheduler = getScheduler();
  scheduler.stop();
  
  server.close(() => {
    console.log('Server closed');
    pool.end();
  });
});

