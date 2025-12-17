// API Base URL
const API_URL = window.location.origin;
const WS_URL = `ws://${window.location.host}`;

// WebSocket connection
let ws = null;
let reconnectInterval = null;

// State
let currentBooks = [];
let queueUpdateInterval = null;
let uploadScheduleInterval = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initForms();
  initWebSocket();
  loadStats();
  loadBooks();
  loadQueue();
  loadUploadSchedule();
  
  // Auto-refresh queue every 3 seconds
  queueUpdateInterval = setInterval(loadQueue, 3000);
  
  // Auto-refresh upload schedule every 10 seconds
  uploadScheduleInterval = setInterval(loadUploadSchedule, 10000);
});

// WebSocket
function initWebSocket() {
  const statusEl = document.getElementById('connection-status');
  
  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('WebSocket connected');
      statusEl.textContent = 'Connected';
      statusEl.className = 'status-badge status-connected';
      addLog('WebSocket connected', 'success');
      
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      statusEl.textContent = 'Disconnected';
      statusEl.className = 'status-badge status-disconnected';
      addLog('WebSocket disconnected', 'error');
      
      // Try to reconnect
      if (!reconnectInterval) {
        reconnectInterval = setInterval(() => {
          console.log('Attempting to reconnect...');
          initWebSocket();
        }, 5000);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      addLog('WebSocket error', 'error');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
  } catch (error) {
    console.error('Failed to connect WebSocket:', error);
    statusEl.textContent = 'Connection Failed';
    statusEl.className = 'status-badge status-disconnected';
  }
}

function handleWebSocketMessage(message) {
  const { type, data } = message;
  
  switch (type) {
    case 'connected':
      addLog(data.message, 'info');
      break;
    
    case 'search_start':
      addLog(`Starting search with tagId=${data.tagId}, limit=${data.limit}...`, 'info');
      break;
    
    case 'search_complete':
      addLog(`Search completed! Saved ${data.totalSaved} books`, 'success');
      loadStats();
      loadBooks();
      showSearchResults(data);
      break;
    
    case 'search_error':
      addLog(`Search error: ${data.message}`, 'error');
      showError('search-results', data.message);
      break;
    
    case 'scrape_start':
      addLog(`Starting scrape for series: ${data.seriesId}`, 'info');
      showProgress('scrape-progress', 'Scraping metadata...');
      break;
    
    case 'scrape_metadata_complete':
      addLog(`Metadata scraped: ${data.title} (${data.episodesCount} episodes)`, 'success');
      break;
    
    case 'download_start':
      addLog(`Starting download of ${data.episodesCount} episodes...`, 'info');
      loadQueue(); // Refresh queue when download starts
      break;
    
    case 'download_progress':
      // Update specific episode progress in queue
      updateEpisodeProgress(data.episodeId, data);
      break;
    
    case 'download_complete':
      addLog(`Downloaded ${data.count} episodes`, 'success');
      loadQueue(); // Refresh queue when download completes
      break;
    
    case 'scrape_complete':
      addLog(`Scrape completed for: ${data.title}`, 'success');
      showSuccess('scrape-progress', `Successfully scraped ${data.episodesCount} episodes, downloaded ${data.downloadedCount} videos`);
      loadStats();
      loadBooks();
      loadQueue();
      break;
    
    case 'scrape_error':
      addLog(`Scrape error: ${data.message}`, 'error');
      showError('scrape-progress', data.message);
      break;
    
    case 'batch_start':
      addLog(`Starting batch scrape of ${data.total} books...`, 'info');
      showProgress('batch-progress', `Processing 0/${data.total}...`);
      break;
    
    case 'batch_progress':
      addLog(`[${data.current}/${data.total}] Processing: ${data.bookName}`, 'info');
      showProgress('batch-progress', `Processing ${data.current}/${data.total}: ${data.bookName}`, (data.current / data.total) * 100);
      break;
    
    case 'batch_item_complete':
      addLog(`✓ Completed: ${data.bookName}`, 'success');
      break;
    
    case 'batch_item_error':
      addLog(`✗ Failed: ${data.bookName} - ${data.error}`, 'error');
      break;
    
    case 'batch_complete':
      addLog(`Batch completed! Processed: ${data.processed}, Failed: ${data.failed}`, 'success');
      showSuccess('batch-progress', `Batch complete! Processed: ${data.processed}, Failed: ${data.failed}`);
      loadStats();
      loadBooks();
      loadQueue();
      break;
    
    case 'queue_cleared':
      addLog(`Queue cleared: ${data.count} items removed`, 'info');
      loadQueue();
      break;
    
    case 'queue_retry':
      addLog(`Retrying ${data.count} failed downloads`, 'info');
      loadQueue();
      break;
    
    case 'upload_scheduled':
      addLog(`✓ Scheduled ${data.episodesScheduled} episodes for upload: ${data.seriesTitle}`, 'success');
      loadUploadSchedule();
      break;
    
    case 'upload_progress':
      addLog(`Uploading ${data.seriesTitle} Episode ${data.episodeIndex}: ${data.progress}%`, 'info');
      loadUploadSchedule();
      break;
    
    case 'upload_complete':
      addLog(`✓ Upload completed: ${data.seriesTitle} Episode ${data.episodeIndex}`, 'success');
      loadUploadSchedule();
      break;
    
    case 'upload_error':
      addLog(`✗ Upload failed: ${data.seriesTitle} Episode ${data.episodeIndex} - ${data.error}`, 'error');
      loadUploadSchedule();
      break;
    
    case 'upload_schedule_removed':
      addLog(`Removed ${data.count} scheduled uploads`, 'info');
      loadUploadSchedule();
      break;
    
    default:
      console.log('Unknown message type:', type);
  }
}

// Tabs
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      
      // Update active states
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      document.getElementById(`tab-${tabName}`).classList.add('active');
    });
  });
}

// Forms
function initForms() {
  // Search form
  document.getElementById('search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const tagId = document.getElementById('search-tag-id').value;
    const tagType = document.getElementById('search-tag-type').value;
    const limit = parseInt(document.getElementById('search-limit').value);
    const maxPages = parseInt(document.getElementById('search-max-pages').value);
    const cellId = document.getElementById('search-cell-id').value;
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Searching...';
    
    showProgress('search-results', 'Searching books...');
    
    try {
      const response = await fetch(`${API_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId, tagType, limit, maxPages, cellId })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Search failed');
      }
      
      // Results will be shown via WebSocket
    } catch (error) {
      console.error('Search error:', error);
      showError('search-results', error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Search & Save to Database';
    }
  });

  // Scrape form
  document.getElementById('scrape-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const seriesId = document.getElementById('scrape-series-id').value;
    const download = document.getElementById('scrape-download').checked;
    const concurrency = parseInt(document.getElementById('scrape-concurrency').value);
    const outputDir = document.getElementById('scrape-output-dir').value;
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Scraping...';
    
    showProgress('scrape-progress', 'Starting scrape...');
    
    try {
      const response = await fetch(`${API_URL}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesId, download, concurrency, outputDir })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Scrape failed');
      }
      
      // Results will be shown via WebSocket
    } catch (error) {
      console.error('Scrape error:', error);
      showError('scrape-progress', error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Start Scraping';
    }
  });

  // Batch form
  document.getElementById('batch-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const limit = parseInt(document.getElementById('batch-limit').value);
    const download = document.getElementById('batch-download').checked;
    const concurrency = parseInt(document.getElementById('batch-concurrency').value);
    const outputDir = document.getElementById('batch-output-dir').value;
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    
    showProgress('batch-progress', 'Starting batch scrape...');
    
    try {
      const response = await fetch(`${API_URL}/api/batch-scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit, download, concurrency, outputDir })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Batch scrape failed');
      }
      
      showInfo('batch-progress', `Batch scraping started for ${result.total} books`);
    } catch (error) {
      console.error('Batch scrape error:', error);
      showError('batch-progress', error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Start Batch Scraping';
    }
  });

  // Filter checkbox
  document.getElementById('filter-scraped-only').addEventListener('change', (e) => {
    loadBooks(e.target.checked);
  });

  // Refresh button
  document.getElementById('refresh-books').addEventListener('click', () => {
    const scrapedOnly = document.getElementById('filter-scraped-only').checked;
    loadBooks(scrapedOnly);
  });

  // Clear logs button
  document.getElementById('clear-logs').addEventListener('click', () => {
    document.getElementById('logs-container').innerHTML = '<p class="log-entry log-info">Logs cleared</p>';
  });

  // Queue management buttons
  document.getElementById('refresh-queue').addEventListener('click', () => {
    loadQueue();
  });

  document.getElementById('clear-queue').addEventListener('click', async () => {
    if (!confirm('Clear all completed and failed downloads from queue?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/download/queue/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      if (result.success) {
        addLog(result.message, 'success');
      }
    } catch (error) {
      console.error('Error clearing queue:', error);
      addLog(`Error clearing queue: ${error.message}`, 'error');
    }
  });

  document.getElementById('retry-failed').addEventListener('click', async () => {
    if (!confirm('Retry all failed downloads?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/download/queue/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      if (result.success) {
        addLog(result.message, 'success');
      }
    } catch (error) {
      console.error('Error retrying failed:', error);
      addLog(`Error retrying failed: ${error.message}`, 'error');
    }
  });

  // Upload schedule form
  document.getElementById('schedule-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const seriesId = document.getElementById('schedule-series-id').value;
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding to schedule...';
    
    showProgress('schedule-result', 'Adding series to upload schedule...');
    
    try {
      const response = await fetch(`${API_URL}/api/upload/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesId: parseInt(seriesId) })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to add to schedule');
      }
      
      showSuccess('schedule-result', result.message);
      document.getElementById('schedule-series-id').value = '';
      loadUploadSchedule();
    } catch (error) {
      console.error('Schedule error:', error);
      showError('schedule-result', error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add to Upload Schedule';
    }
  });

  // Refresh upload schedule
  document.getElementById('refresh-schedule').addEventListener('click', () => {
    loadUploadSchedule();
  });
}

// API Functions
async function loadStats() {
  try {
    const response = await fetch(`${API_URL}/api/stats`);
    const result = await response.json();
    
    if (result.success) {
      const { stats } = result;
      document.getElementById('stat-books').textContent = stats.totalBooks;
      document.getElementById('stat-scraped').textContent = stats.scrapedBooks;
      document.getElementById('stat-series').textContent = stats.totalSeries;
      document.getElementById('stat-episodes').textContent = stats.totalEpisodes;
      
      document.getElementById('db-status').textContent = 'Database: Connected';
      document.getElementById('db-status').className = 'status-badge status-connected';
    }
  } catch (error) {
    console.error('Error loading stats:', error);
    document.getElementById('db-status').textContent = 'Database: Error';
    document.getElementById('db-status').className = 'status-badge status-disconnected';
  }
}

async function loadBooks(scrapedOnly = false) {
  const container = document.getElementById('books-list');
  container.innerHTML = '<p class="loading">Loading books...</p>';
  
  try {
    const response = await fetch(`${API_URL}/api/books?scrapedOnly=${scrapedOnly}&limit=100`);
    const result = await response.json();
    
    if (result.success) {
      currentBooks = result.books;
      displayBooks(result.books);
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error loading books:', error);
    container.innerHTML = `<p class="loading" style="color: var(--danger);">Error loading books: ${error.message}</p>`;
  }
}

async function loadQueue() {
  try {
    const response = await fetch(`${API_URL}/api/download/queue`);
    const result = await response.json();
    
    if (result.success) {
      displayQueue(result.queue);
    }
  } catch (error) {
    console.error('Error loading queue:', error);
  }
}

function displayQueue(queue) {
  // Update stats
  document.getElementById('queue-total').textContent = queue.total;
  document.getElementById('queue-pending').textContent = queue.pending;
  document.getElementById('queue-downloading').textContent = queue.downloading;
  document.getElementById('queue-completed').textContent = queue.completed;
  document.getElementById('queue-failed').textContent = queue.failed;
  
  const container = document.getElementById('queue-container');
  
  if (queue.items.length === 0) {
    container.innerHTML = '<p class="loading">No downloads in queue</p>';
    return;
  }
  
  // Group by status
  const pending = queue.items.filter(i => i.status === 'pending');
  const downloading = queue.items.filter(i => i.status === 'downloading');
  const completed = queue.items.filter(i => i.status === 'completed');
  const failed = queue.items.filter(i => i.status === 'failed');
  
  let html = '';
  
  if (downloading.length > 0) {
    html += '<h3 style="margin-top: 20px;">⬇️ Currently Downloading</h3>';
    html += '<div class="queue-items">';
    downloading.forEach(item => {
      const progress = item.progress || 0;
      const mbDownloaded = (item.downloaded_bytes / 1024 / 1024).toFixed(2);
      const mbTotal = item.total_bytes > 0 ? (item.total_bytes / 1024 / 1024).toFixed(2) : '?';
      
      html += `
        <div class="queue-item downloading" data-episode-id="${item.episode_id}">
          <div class="queue-item-header">
            <strong>${escapeHtml(item.series_title)}</strong> - Episode ${item.index_sequence}
          </div>
          <div class="queue-item-title">${escapeHtml(item.episode_title || item.melolo_vid_id)}</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <div class="queue-item-info">
            ${progress}% - ${mbDownloaded} MB / ${mbTotal} MB
          </div>
        </div>
      `;
    });
    html += '</div>';
  }
  
  if (pending.length > 0) {
    html += '<h3 style="margin-top: 20px;">⏳ Pending Downloads</h3>';
    html += '<div class="queue-items">';
    pending.forEach(item => {
      html += `
        <div class="queue-item pending">
          <div class="queue-item-header">
            <strong>${escapeHtml(item.series_title)}</strong> - Episode ${item.index_sequence}
          </div>
          <div class="queue-item-title">${escapeHtml(item.episode_title || item.melolo_vid_id)}</div>
          <div class="queue-item-info">Waiting to download...</div>
        </div>
      `;
    });
    html += '</div>';
  }
  
  if (completed.length > 0) {
    html += '<h3 style="margin-top: 20px;">✅ Completed (showing last 10)</h3>';
    html += '<div class="queue-items">';
    completed.slice(0, 10).forEach(item => {
      html += `
        <div class="queue-item completed">
          <div class="queue-item-header">
            <strong>${escapeHtml(item.series_title)}</strong> - Episode ${item.index_sequence}
          </div>
          <div class="queue-item-title">${escapeHtml(item.episode_title || item.melolo_vid_id)}</div>
          <div class="queue-item-info">✓ Downloaded successfully</div>
        </div>
      `;
    });
    html += '</div>';
  }
  
  if (failed.length > 0) {
    html += '<h3 style="margin-top: 20px;">❌ Failed Downloads</h3>';
    html += '<div class="queue-items">';
    failed.forEach(item => {
      html += `
        <div class="queue-item failed">
          <div class="queue-item-header">
            <strong>${escapeHtml(item.series_title)}</strong> - Episode ${item.index_sequence}
          </div>
          <div class="queue-item-title">${escapeHtml(item.episode_title || item.melolo_vid_id)}</div>
          <div class="queue-item-info error-message">
            ✗ ${escapeHtml(item.error_message || 'Unknown error')}
          </div>
        </div>
      `;
    });
    html += '</div>';
  }
  
  container.innerHTML = html;
}

function updateEpisodeProgress(episodeId, data) {
  const item = document.querySelector(`.queue-item[data-episode-id="${episodeId}"]`);
  if (!item) return;
  
  if (data.progress !== undefined) {
    const progressBar = item.querySelector('.progress-fill');
    if (progressBar) {
      progressBar.style.width = `${data.progress}%`;
    }
    
    const info = item.querySelector('.queue-item-info');
    if (info && data.downloadedBytes && data.totalBytes) {
      const mbDownloaded = (data.downloadedBytes / 1024 / 1024).toFixed(2);
      const mbTotal = (data.totalBytes / 1024 / 1024).toFixed(2);
      info.textContent = `${data.progress}% - ${mbDownloaded} MB / ${mbTotal} MB`;
    }
  }
  
  if (data.status === 'completed') {
    item.classList.remove('downloading');
    item.classList.add('completed');
  } else if (data.status === 'failed') {
    item.classList.remove('downloading');
    item.classList.add('failed');
  }
}

async function loadUploadSchedule() {
  try {
    const response = await fetch(`${API_URL}/api/upload/schedule`);
    const result = await response.json();
    
    if (result.success) {
      displayUploadSchedule(result.schedule);
    }
  } catch (error) {
    console.error('Error loading upload schedule:', error);
  }
}

function displayUploadSchedule(schedule) {
  // Update stats
  document.getElementById('upload-total').textContent = schedule.total;
  document.getElementById('upload-pending').textContent = schedule.pending;
  document.getElementById('upload-uploading').textContent = schedule.uploading;
  document.getElementById('upload-completed').textContent = schedule.completed;
  document.getElementById('upload-failed').textContent = schedule.failed;
  document.getElementById('upload-skipped').textContent = schedule.skipped;
  
  const container = document.getElementById('upload-schedule-container');
  
  if (schedule.bySeries.length === 0) {
    container.innerHTML = '<p class="loading">No series scheduled for upload</p>';
    return;
  }
  
  let html = '';
  
  schedule.bySeries.forEach(series => {
    const uploading = series.episodes.filter(e => e.status === 'uploading');
    const pending = series.episodes.filter(e => e.status === 'pending');
    const completed = series.episodes.filter(e => e.status === 'completed');
    const failed = series.episodes.filter(e => e.status === 'failed');
    const skipped = series.episodes.filter(e => e.status === 'skipped');
    
    html += `
      <div class="series-upload-section">
        <div class="series-upload-header">
          <h3>${escapeHtml(series.seriesTitle)}</h3>
          <button class="btn btn-danger btn-small" onclick="removeSeriesSchedule(${series.seriesId})">
            🗑️ Remove
          </button>
        </div>
        <div class="series-upload-stats">
          <span class="badge badge-pending">${pending.length} Pending</span>
          <span class="badge badge-uploading">${uploading.length} Uploading</span>
          <span class="badge badge-completed">${completed.length} Completed</span>
          <span class="badge badge-failed">${failed.length} Failed</span>
          <span class="badge badge-skipped">${skipped.length} Skipped</span>
        </div>
    `;
    
    // Show uploading episodes
    if (uploading.length > 0) {
      html += '<h4 style="margin-top: 15px;">📤 Currently Uploading</h4>';
      html += '<div class="upload-items">';
      uploading.forEach(ep => {
        const scheduledTime = new Date(ep.scheduled_at).toLocaleString();
        html += `
          <div class="upload-item uploading">
            <div class="upload-item-header">
              <strong>Episode ${ep.index_sequence}</strong>
              <span class="upload-time">⏰ ${scheduledTime}</span>
            </div>
            <div class="upload-item-title">${escapeHtml(ep.episode_title || ep.melolo_vid_id)}</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${ep.upload_progress}%"></div>
            </div>
            <div class="upload-item-info">${ep.upload_progress}% uploaded</div>
          </div>
        `;
      });
      html += '</div>';
    }
    
    // Show next 5 pending episodes
    if (pending.length > 0) {
      html += '<h4 style="margin-top: 15px;">⏳ Next Uploads</h4>';
      html += '<div class="upload-items">';
      pending.slice(0, 5).forEach(ep => {
        const scheduledTime = new Date(ep.scheduled_at).toLocaleString();
        html += `
          <div class="upload-item pending">
            <div class="upload-item-header">
              <strong>Episode ${ep.index_sequence}</strong>
              <span class="upload-time">⏰ ${scheduledTime}</span>
            </div>
            <div class="upload-item-title">${escapeHtml(ep.episode_title || ep.melolo_vid_id)}</div>
            <div class="upload-item-info">Scheduled for upload</div>
          </div>
        `;
      });
      if (pending.length > 5) {
        html += `<p class="more-info">... and ${pending.length - 5} more episodes</p>`;
      }
      html += '</div>';
    }
    
    // Show failed episodes
    if (failed.length > 0) {
      html += '<h4 style="margin-top: 15px;">❌ Failed Uploads</h4>';
      html += '<div class="upload-items">';
      failed.forEach(ep => {
        html += `
          <div class="upload-item failed">
            <div class="upload-item-header">
              <strong>Episode ${ep.index_sequence}</strong>
              <span class="retry-badge">Retry ${ep.retry_count}/3</span>
            </div>
            <div class="upload-item-title">${escapeHtml(ep.episode_title || ep.melolo_vid_id)}</div>
            <div class="upload-item-info error-message">${escapeHtml(ep.error_message || 'Unknown error')}</div>
          </div>
        `;
      });
      html += '</div>';
    }
    
    html += '</div>';
  });
  
  container.innerHTML = html;
}

async function removeSeriesSchedule(seriesId) {
  if (!confirm('Remove this series from upload schedule?')) return;
  
  try {
    const response = await fetch(`${API_URL}/api/upload/schedule/${seriesId}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (result.success) {
      addLog(result.message, 'success');
      loadUploadSchedule();
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error removing schedule:', error);
    alert(`Failed to remove schedule: ${error.message}`);
  }
}

function displayBooks(books) {
  const container = document.getElementById('books-list');
  
  if (books.length === 0) {
    container.innerHTML = '<p class="loading">No books found</p>';
    return;
  }
  
  container.innerHTML = books.map(book => `
    <div class="book-card ${book.scraped ? 'scraped' : ''}">
      <div class="book-status ${book.scraped ? 'scraped' : 'unscraped'}"></div>
      <div class="book-title">${escapeHtml(book.book_name)}</div>
      <div class="book-info">📖 Author: ${escapeHtml(book.author || 'Unknown')}</div>
      <div class="book-info">📺 Episodes: ${book.serial_count}</div>
      <div class="book-info">🌐 Language: ${book.language || 'N/A'}</div>
      <div class="book-info">🆔 ID: ${book.book_id}</div>
      <div class="book-actions">
        <button class="btn btn-primary btn-small" onclick="scrapeBook('${book.book_id}')">
          ${book.scraped ? '🔄 Re-scrape' : '⚙️ Scrape'}
        </button>
        <button class="btn btn-danger btn-small" onclick="deleteBook('${book.book_id}')">
          🗑️
        </button>
      </div>
    </div>
  `).join('');
}

async function scrapeBook(bookId) {
  // Switch to scrape tab
  document.querySelector('.tab-button[data-tab="scrape"]').click();
  
  // Fill form
  document.getElementById('scrape-series-id').value = bookId;
  
  // Submit form
  document.getElementById('scrape-form').dispatchEvent(new Event('submit'));
}

async function deleteBook(bookId) {
  if (!confirm('Are you sure you want to delete this book?')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/api/books/${bookId}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (result.success) {
      addLog(`Book deleted: ${bookId}`, 'success');
      loadBooks();
      loadStats();
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error deleting book:', error);
    alert(`Failed to delete book: ${error.message}`);
  }
}

// UI Helpers
function showSearchResults(data) {
  const container = document.getElementById('search-results');
  
  let html = `<div class="result-message result-success">
    ✓ Successfully saved ${data.totalSaved} books to database
  </div>`;
  
  if (data.books && data.books.length > 0) {
    html += '<div class="books-grid" style="margin-top: 20px;">';
    data.books.slice(0, 6).forEach(book => {
      html += `
        <div class="book-card">
          <div class="book-title">${escapeHtml(book.name)}</div>
          <div class="book-info">📖 Author: ${escapeHtml(book.author || 'Unknown')}</div>
          <div class="book-info">📺 Episodes: ${book.episodes}</div>
          <div class="book-info">🆔 ID: ${book.id}</div>
        </div>
      `;
    });
    html += '</div>';
    
    if (data.books.length > 6) {
      html += `<p style="margin-top: 15px; color: var(--gray);">And ${data.books.length - 6} more books...</p>`;
    }
  }
  
  container.innerHTML = html;
}

function showProgress(containerId, message, percent = null) {
  const container = document.getElementById(containerId);
  let html = `<div class="result-message result-info">${message}</div>`;
  
  if (percent !== null) {
    html += `
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${percent}%"></div>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

function showSuccess(containerId, message) {
  const container = document.getElementById(containerId);
  container.innerHTML = `<div class="result-message result-success">✓ ${message}</div>`;
}

function showError(containerId, message) {
  const container = document.getElementById(containerId);
  container.innerHTML = `<div class="result-message result-error">✗ ${message}</div>`;
}

function showInfo(containerId, message) {
  const container = document.getElementById(containerId);
  container.innerHTML = `<div class="result-message result-info">ℹ ${message}</div>`;
}

function addLog(message, type = 'info') {
  const container = document.getElementById('logs-container');
  const timestamp = new Date().toLocaleTimeString();
  
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry log-${type}`;
  logEntry.innerHTML = `<span class="log-timestamp">[${timestamp}]</span>${escapeHtml(message)}`;
  
  container.appendChild(logEntry);
  container.scrollTop = container.scrollHeight;
  
  // Keep only last 100 logs
  while (container.children.length > 100) {
    container.removeChild(container.firstChild);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Make functions globally available
window.scrapeBook = scrapeBook;
window.deleteBook = deleteBook;
window.removeSeriesSchedule = removeSeriesSchedule;

