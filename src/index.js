import { scrapeSeries, getEpisodesToDownload } from './services/scraper.js';
import { downloadSeriesEpisodes } from './services/downloader.js';

/**
 * Main scraper function
 * @param {string} seriesId - Melolo series ID to scrape
 * @param {Object} options - Options
 * @param {boolean} options.download - Whether to download videos (default: true)
 * @param {string} options.outputDir - Output directory for videos (default: ./video)
 * @param {number} options.concurrency - Number of concurrent downloads (default: 1)
 */
async function main(seriesId, options = {}) {
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
      const episodesToDownload = getEpisodesToDownload(scrapedData.seriesId);
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

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node src/index.js <series_id> [options]');
  console.log('\nOptions:');
  console.log('  --no-download     Skip video download');
  console.log('  --output-dir=DIR  Output directory (default: ./video)');
  console.log('  --concurrency=N   Number of concurrent downloads (default: 1)');
  console.log('\nExample:');
  console.log('  node src/index.js 7498275267933113345');
  console.log('  node src/index.js 7498275267933113345 --output-dir=./videos --concurrency=2');
  process.exit(1);
}

const seriesId = args[0];
const options = {};

// Parse options
args.slice(1).forEach(arg => {
  if (arg === '--no-download') {
    options.download = false;
  } else if (arg.startsWith('--output-dir=')) {
    options.outputDir = arg.split('=')[1];
  } else if (arg.startsWith('--concurrency=')) {
    options.concurrency = parseInt(arg.split('=')[1], 10) || 1;
  }
});

// Run scraper
main(seriesId, options).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

