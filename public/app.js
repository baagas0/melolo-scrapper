// API Base URL
const API_URL = window.location.origin;
const WS_URL = `ws://${window.location.host}`;

// WebSocket connection
let ws = null;
let reconnectInterval = null;

// State
let currentBooks = [];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initForms();
  initWebSocket();
  loadStats();
  loadBooks();
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
      break;
    
    case 'download_complete':
      addLog(`Downloaded ${data.count} episodes`, 'success');
      break;
    
    case 'scrape_complete':
      addLog(`Scrape completed for: ${data.title}`, 'success');
      showSuccess('scrape-progress', `Successfully scraped ${data.episodesCount} episodes, downloaded ${data.downloadedCount} videos`);
      loadStats();
      loadBooks();
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

