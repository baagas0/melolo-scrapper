import db from '../db/database.js';
import { getSeriesDetail, getVideoStream } from '../api/client.js';

/**
 * Save or update series in database
 * @param {Object} seriesData - Series data from API
 * @returns {number} Series ID
 */
export function saveSeries(seriesData) {
  const stmt = db.prepare(`
    INSERT INTO series (melolo_series_id, cover_url, intro, title, episode_count, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(melolo_series_id) DO UPDATE SET
      cover_url = excluded.cover_url,
      intro = excluded.intro,
      title = excluded.title,
      episode_count = excluded.episode_count,
      updated_at = CURRENT_TIMESTAMP
  `);

  console.log('asdasd', seriesData.series_id || seriesData.id,
    seriesData.cover_url || seriesData.cover,
    seriesData.intro || seriesData.description || '',
    seriesData.title || seriesData.name,
    seriesData.episode_count || 0)

  const info = stmt.run(
    seriesData.series_id || seriesData.id,
    seriesData.cover_url || seriesData.cover,
    seriesData.intro || seriesData.description || '',
    seriesData.title || seriesData.name,
    seriesData.episode_count || 0
  );

  // Get the series ID
  const getSeriesId = db.prepare('SELECT id FROM series WHERE melolo_series_id = ?');
  const series = getSeriesId.get(seriesData.series_id || seriesData.id);
  return series.id;
}

/**
 * Save or update episode in database
 * @param {number} seriesId - Database series ID
 * @param {Object} episodeData - Episode data from API
 * @returns {number} Episode ID or null if duplicate
 */
export function saveEpisode(seriesId, episodeData) {
  // Check if episode already exists
  const checkStmt = db.prepare('SELECT id FROM episodes WHERE melolo_vid_id = ?');
  const existing = checkStmt.get(episodeData.vid);
  
  if (existing) {
    console.log(`Episode ${episodeData.vid} already exists, skipping...`);
    return existing.id;
  }

  const stmt = db.prepare(`
    INSERT INTO episodes (
      series_id, melolo_vid_id, cover, title, index_sequence, 
      duration, video_height, video_weight, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(melolo_vid_id) DO UPDATE SET
      cover = excluded.cover,
      title = excluded.title,
      index_sequence = excluded.index_sequence,
      duration = excluded.duration,
      video_height = excluded.video_height,
      video_weight = excluded.video_weight,
      updated_at = CURRENT_TIMESTAMP
  `);

  const info = stmt.run(
    seriesId,
    episodeData.vid,
    episodeData.episode_cover || '',
    episodeData.title || episodeData.name || '',
    episodeData.vid_index || 0,
    episodeData.duration || 0,
    episodeData.video_height || 1080,
    episodeData.video_weight || episodeData.video_width || 720
  );

  return info.lastInsertRowid;
}

/**
 * Scrape series and episodes
 * @param {string} seriesId - Melolo series ID
 * @returns {Promise<Object>} Scraped series data
 */
export async function scrapeSeries(seriesId) {
  console.log(`Fetching series detail for: ${seriesId}`);
  
  try {
    const detailResponse = await getSeriesDetail(seriesId);
    
    // Extract series info (adjust based on actual API response structure)
    const seriesInfo = detailResponse.data.video_data;
    console.log('===> scraper.js:100 ~ seriesInfo', seriesInfo);
    
    // Save series to database
    const dbSeriesId = saveSeries({
      series_id: seriesId,
      cover_url: seriesInfo.series_cover,
      intro: seriesInfo.series_intro || '',
      title: seriesInfo.series_title || '',
      episode_count: seriesInfo.episode_cnt || 0
    });

    console.log(`Series saved: ${seriesInfo.title || seriesId}`);

    // Extract episodes (adjust based on actual API response structure)
    const episodes = seriesInfo.video_list || [];

    console.log(`Found ${episodes.length} episodes`);

    // Save episodes
    const savedEpisodes = [];
    for (const episode of episodes) {
      try {
        const episodeIndex = episode.vid_index || 0;
        const episodeId = saveEpisode(dbSeriesId, {
          ...episode,
          index_sequence: episodeIndex
        });
        
        if (episodeId) {
          savedEpisodes.push({
            id: episodeId,
            melolo_vid_id: episode.video_id || episode.id,
            index_sequence: episodeIndex,
            title: episode.title || episode.name
          });
        } else {
          console.error(`episodeId not found:`, error.message);
        }
      } catch (error) {
        console.error(`Error saving episode:`, error.message);
      }
    }

    return {
      seriesId: dbSeriesId,
      meloloSeriesId: seriesId,
      title: seriesInfo.title || seriesInfo.name,
      episodes: savedEpisodes
    };
  } catch (error) {
    console.error(`Error scraping series ${seriesId}:`, error.message);
    throw error;
  }
}

/**
 * Get episodes that need to be downloaded (no path set)
 * @param {number} seriesId - Database series ID
 * @returns {Array} Episodes without paths
 */
export function getEpisodesToDownload(seriesId) {
  const stmt = db.prepare(`
    SELECT e.*, s.title as series_title
    FROM episodes e
    JOIN series s ON e.series_id = s.id
    WHERE e.series_id = ? AND (e.path IS NULL OR e.path = '')
    ORDER BY e.index_sequence ASC
  `);
  
  return stmt.all(seriesId);
}

/**
 * Update episode path after download
 * @param {number} episodeId - Database episode ID
 * @param {string} path - File path
 */
export function updateEpisodePath(episodeId, path) {
  const stmt = db.prepare(`
    UPDATE episodes 
    SET path = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  stmt.run(path, episodeId);
}

