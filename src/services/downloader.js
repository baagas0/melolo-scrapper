import axios from 'axios';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { getVideoStream } from '../api/client.js';
import { updateEpisodePath } from './scraper.js';

/**
 * Sanitize filename to remove invalid characters
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .trim();
}

/**
 * Download video file
 * @param {string} url - Video URL
 * @param {string} outputPath - Output file path
 * @returns {Promise<void>}
 */
async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    // Ensure directory exists
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 300000, // 5 minutes timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
      .then((response) => {
        const writer = createWriteStream(outputPath);
        response.data.pipe(writer);

        let downloadedBytes = 0;
        const totalBytes = parseInt(response.headers['content-length'] || '0', 10);

        response.data.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0) {
            const percent = ((downloadedBytes / totalBytes) * 100).toFixed(2);
            process.stdout.write(`\rDownloading: ${percent}% (${(downloadedBytes / 1024 / 1024).toFixed(2)} MB)`);
          }
        });

        writer.on('finish', () => {
          console.log(`\nDownload completed: ${outputPath}`);
          resolve();
        });

        writer.on('error', (error) => {
          reject(error);
        });
      })
      .catch((error) => {
        reject(error);
      });
  });
}

/**
 * Extract video URL from stream response
 * @param {Object} streamResponse - API response from getVideoStream
 * @returns {string|null} Video URL
 */
function extractVideoUrl(streamResponse) {
  // Try different possible response structures
  const data = streamResponse.data || streamResponse;
  
  // Check for video_list or video_info
  const videoList = data.video_list || data.video_info || data.videos || [];
  if (videoList.length > 0) {
    const video = videoList[0];
    // Try different URL fields
    return video.play_url || video.url || video.video_url || video.main_url || null;
  }

  // Check direct fields
  return data.play_url || data.url || data.video_url || data.main_url || null;
}

/**
 * Download episode video
 * @param {Object} episode - Episode object from database
 * @param {string} baseDir - Base directory for videos (default: ./video)
 * @returns {Promise<string>} Downloaded file path
 */
export async function downloadEpisode(episode, baseDir = './video') {
  const { melolo_vid_id, index_sequence, series_title, id: episodeId } = episode;
  console.log('===> downloader.js:101 ~ episode', episode);
  
  console.log(`\nDownloading episode ${index_sequence}: ${episode.title || melolo_vid_id}`);

  try {
    // Get video stream URL
    console.log(`Fetching video stream for: ${melolo_vid_id}`);
    const streamResponse = await getVideoStream(melolo_vid_id);
    
    const videoUrl = extractVideoUrl(streamResponse);
    
    if (!videoUrl) {
      throw new Error(`No video URL found in response for ${melolo_vid_id}`);
    }

    console.log(`Video URL obtained: ${videoUrl.substring(0, 100)}...`);

    // Sanitize series title for folder name
    const sanitizedTitle = sanitizeFilename(series_title || 'unknown');
    const episodeFileName = `episode_${index_sequence}.mp4`;
    const outputPath = join(baseDir, sanitizedTitle, episodeFileName);

    // Check if file already exists
    if (existsSync(outputPath)) {
      console.log(`File already exists: ${outputPath}, skipping download`);
      // Update database path
      await updateEpisodePath(episodeId, outputPath);
      return outputPath;
    }

    // Download video
    await downloadFile(videoUrl, outputPath);

    // Update database with path
    await updateEpisodePath(episodeId, outputPath);

    return outputPath;
  } catch (error) {
    console.error(`Error downloading episode ${index_sequence}:`, error.message);
    throw error;
  }
}

/**
 * Download all episodes for a series
 * @param {number} seriesId - Database series ID
 * @param {string} baseDir - Base directory for videos
 * @param {number} concurrency - Number of concurrent downloads (default: 1)
 * @returns {Promise<Array>} Array of downloaded file paths
 */
export async function downloadSeriesEpisodes(seriesId, baseDir = './video', concurrency = 1) {
  const { getEpisodesToDownload } = await import('./scraper.js');
  const episodes = await getEpisodesToDownload(seriesId);

  if (episodes.length === 0) {
    console.log('No episodes to download');
    return [];
  }

  console.log(`\nFound ${episodes.length} episodes to download`);

  const downloadedPaths = [];
  const errors = [];

  // Download with concurrency control
  for (let i = 0; i < episodes.length; i += concurrency) {
    const batch = episodes.slice(i, i + concurrency);
    
    const promises = batch.map(async (episode) => {
      try {
        const path = await downloadEpisode(episode, baseDir);
        downloadedPaths.push(path);
        return { success: true, episode, path };
      } catch (error) {
        errors.push({ episode, error: error.message });
        return { success: false, episode, error: error.message };
      }
    });

    await Promise.all(promises);
    
    // Small delay between batches to avoid rate limiting
    if (i + concurrency < episodes.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (errors.length > 0) {
    console.log(`\n${errors.length} episodes failed to download:`);
    errors.forEach(({ episode, error }) => {
      console.log(`  Episode ${episode.index}: ${error}`);
    });
  }

  return downloadedPaths;
}

