import { searchAndSaveBooks, getBooks, getUnscrapedBooks } from './services/books.js';
import { scrapeSeries, getEpisodesToDownload } from './services/scraper.js';
import { downloadSeriesEpisodes } from './services/downloader.js';

/**
 * Search and save books
 * @param {Object} options - Search options
 */
async function searchCommand(options = {}) {
  const {
    tagId = '25',
    tagType = '2',
    limit = 20,
    maxPages = 1,
    cellId = '7450059162446200848'
  } = options;

  try {
    console.log('='.repeat(60));
    console.log('Melolo Search');
    console.log('='.repeat(60));
    console.log(`Tag ID: ${tagId}`);
    console.log(`Tag Type: ${tagType}`);
    console.log(`Limit per page: ${limit}`);
    console.log(`Max pages: ${maxPages}`);
    console.log(`Cell ID: ${cellId}`);
    console.log('='.repeat(60));

    console.log('\nSearching books...');
    const result = await searchAndSaveBooks({
      tagId,
      tagType,
      limit,
      maxPages,
      cellId
    });

    console.log('\n' + '='.repeat(60));
    console.log(`Search completed!`);
    console.log(`Total books saved: ${result.totalSaved}`);
    console.log(`Has more results: ${result.hasMore}`);
    console.log('='.repeat(60));

    if (result.books.length > 0) {
      console.log('\nBooks found:');
      result.books.forEach((book, index) => {
        console.log(`${index + 1}. ${book.name} by ${book.author} (${book.episodes} episodes)`);
      });
    }
  } catch (error) {
    console.error('\nError:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * List saved books
 * @param {Object} options - List options
 */
async function listCommand(options = {}) {
  const {
    scrapedOnly = false,
    limit = 50
  } = options;

  try {
    console.log('='.repeat(60));
    console.log('Books List');
    console.log('='.repeat(60));

    const books = await getBooks({ scrapedOnly, limit });

    if (books.length === 0) {
      console.log('No books found in database.');
      return;
    }

    console.log(`\nTotal books: ${books.length}\n`);
    books.forEach((book, index) => {
      const status = book.scraped ? '✓' : '✗';
      console.log(`${index + 1}. [${status}] ${book.book_name}`);
      console.log(`   Author: ${book.author}`);
      console.log(`   Book ID: ${book.book_id}`);
      console.log(`   Episodes: ${book.serial_count}`);
      console.log(`   Language: ${book.language}`);
      console.log('');
    });

    console.log('='.repeat(60));
  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  }
}

/**
 * Scrape series from book ID
 * @param {string} seriesId - Series/Book ID
 * @param {Object} options - Scrape options
 */
async function scrapeCommand(seriesId, options = {}) {
  const {
    download = true,
    outputDir = './video',
    concurrency = 1
  } = options;

  try {
    console.log('='.repeat(60));
    console.log('Melolo Scraper');
    console.log('='.repeat(60));
    console.log(`Series ID: ${seriesId}`);
    console.log(`Download: ${download}`);
    console.log(`Output Directory: ${outputDir}`);
    console.log('='.repeat(60));

    // Step 1: Scrape series and episodes
    console.log('\n[Step 1] Scraping series and episodes...');
    const scrapedData = await scrapeSeries(seriesId);
    
    console.log(`\nScraped Series: ${scrapedData.title}`);
    console.log(`Total Episodes: ${scrapedData.episodes.length}`);

    // Step 2: Download videos if requested
    if (download) {
      console.log('\n[Step 2] Downloading videos...');
      const downloadedPaths = await downloadSeriesEpisodes(
        scrapedData.seriesId,
        outputDir,
        concurrency
      );
      
      console.log(`\nDownloaded ${downloadedPaths.length} videos`);
    } else {
      const episodesToDownload = await getEpisodesToDownload(scrapedData.seriesId);
      console.log(`\n${episodesToDownload.length} episodes ready for download`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('Scraping completed!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\nError:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Batch scrape unscraped books
 * @param {Object} options - Batch options
 */
async function batchScrapeCommand(options = {}) {
  const {
    limit = 5,
    download = true,
    outputDir = './video',
    concurrency = 1
  } = options;

  try {
    console.log('='.repeat(60));
    console.log('Batch Scrape Unscraped Books');
    console.log('='.repeat(60));

    const unscrapedBooks = await getUnscrapedBooks(limit);

    if (unscrapedBooks.length === 0) {
      console.log('No unscraped books found.');
      return;
    }

    console.log(`\nFound ${unscrapedBooks.length} unscraped books\n`);

    for (let i = 0; i < unscrapedBooks.length; i++) {
      const book = unscrapedBooks[i];
      console.log(`\n[${ i + 1}/${unscrapedBooks.length}] Processing: ${book.book_name}`);
      console.log(`Book ID: ${book.book_id}`);
      
      try {
        await scrapeCommand(book.book_id, { download, outputDir, concurrency });
      } catch (error) {
        console.error(`Failed to scrape ${book.book_name}:`, error.message);
        console.log('Continuing with next book...');
      }

      // Delay between books
      if (i < unscrapedBooks.length - 1) {
        console.log('\nWaiting 3 seconds before next book...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Batch scraping completed!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  console.log('Usage: node src/search.js <command> [options]');
  console.log('\nCommands:');
  console.log('  search          Search and save books to database');
  console.log('  list            List saved books');
  console.log('  scrape <id>     Scrape a specific series by ID');
  console.log('  batch           Batch scrape unscraped books');
  console.log('\nSearch Options:');
  console.log('  --tag-id=ID         Tag ID for filtering (default: 25)');
  console.log('  --tag-type=TYPE     Tag type (default: 2)');
  console.log('  --limit=N           Results per page (default: 20)');
  console.log('  --max-pages=N       Maximum pages to fetch (default: 1)');
  console.log('  --cell-id=ID        Cell ID (default: 7450059162446200848)');
  console.log('\nList Options:');
  console.log('  --scraped-only      Show only scraped books');
  console.log('  --limit=N           Limit results (default: 50)');
  console.log('\nScrape Options:');
  console.log('  --no-download       Skip video download');
  console.log('  --output-dir=DIR    Output directory (default: ./video)');
  console.log('  --concurrency=N     Concurrent downloads (default: 1)');
  console.log('\nBatch Options:');
  console.log('  --limit=N           Number of books to scrape (default: 5)');
  console.log('  --no-download       Skip video download');
  console.log('  --output-dir=DIR    Output directory (default: ./video)');
  console.log('  --concurrency=N     Concurrent downloads (default: 1)');
  console.log('\nExamples:');
  console.log('  node src/search.js search --limit=10 --max-pages=3');
  console.log('  node src/search.js list');
  console.log('  node src/search.js scrape 7498275267933113345');
  console.log('  node src/search.js batch --limit=3');
  process.exit(1);
}

// Parse options
const options = {};
args.slice(1).forEach(arg => {
  if (arg === '--no-download') {
    options.download = false;
  } else if (arg === '--scraped-only') {
    options.scrapedOnly = true;
  } else if (arg.startsWith('--tag-id=')) {
    options.tagId = arg.split('=')[1];
  } else if (arg.startsWith('--tag-type=')) {
    options.tagType = arg.split('=')[1];
  } else if (arg.startsWith('--cell-id=')) {
    options.cellId = arg.split('=')[1];
  } else if (arg.startsWith('--limit=')) {
    options.limit = parseInt(arg.split('=')[1], 10) || 20;
  } else if (arg.startsWith('--max-pages=')) {
    options.maxPages = parseInt(arg.split('=')[1], 10) || 1;
  } else if (arg.startsWith('--output-dir=')) {
    options.outputDir = arg.split('=')[1];
  } else if (arg.startsWith('--concurrency=')) {
    options.concurrency = parseInt(arg.split('=')[1], 10) || 1;
  }
});

// Execute command
switch (command) {
  case 'search':
    searchCommand(options).catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
    break;
  
  case 'list':
    listCommand(options).catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
    break;
  
  case 'scrape':
    const seriesId = args[1];
    if (!seriesId) {
      console.error('Error: Series ID is required for scrape command');
      process.exit(1);
    }
    // Skip first arg (command) and second arg (seriesId) when parsing options
    const scrapeOptions = {};
    args.slice(2).forEach(arg => {
      if (arg === '--no-download') {
        scrapeOptions.download = false;
      } else if (arg.startsWith('--output-dir=')) {
        scrapeOptions.outputDir = arg.split('=')[1];
      } else if (arg.startsWith('--concurrency=')) {
        scrapeOptions.concurrency = parseInt(arg.split('=')[1], 10) || 1;
      }
    });
    scrapeCommand(seriesId, scrapeOptions).catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
    break;
  
  case 'batch':
    batchScrapeCommand(options).catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
    break;
  
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}

