import pool from '../db/database.js';
import { getSeriesDetail, getVideoStream } from '../api/client.js';

/**
 * Save or update series in database
 * @param {Object} seriesData - Series data from API
 * @returns {Promise<number>} Series ID
 */
export async function saveSeries(seriesData) {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      INSERT INTO series (melolo_series_id, cover_url, intro, title, episode_count, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT(melolo_series_id) DO UPDATE SET
        cover_url = EXCLUDED.cover_url,
        intro = EXCLUDED.intro,
        title = EXCLUDED.title,
        episode_count = EXCLUDED.episode_count,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [
      seriesData.series_id || seriesData.id,
      seriesData.cover_url || seriesData.cover,
      seriesData.intro || seriesData.description || '',
      seriesData.title || seriesData.name,
      seriesData.episode_count || 0
    ]);

    return result.rows[0].id;
  } finally {
    client.release();
  }
}

/**
 * Save or update episode in database
 * @param {number} seriesId - Database series ID
 * @param {Object} episodeData - Episode data from API
 * @returns {Promise<number>} Episode ID
 */
export async function saveEpisode(seriesId, episodeData) {
  const client = await pool.connect();
  
  try {
    // Check if episode already exists
    const checkResult = await client.query(
      'SELECT id FROM episodes WHERE melolo_vid_id = $1',
      [episodeData.vid]
    );
    
    if (checkResult.rows.length > 0) {
      console.log(`Episode ${episodeData.vid} already exists, skipping...`);
      return checkResult.rows[0].id;
    }

    const result = await client.query(`
      INSERT INTO episodes (
        series_id, melolo_vid_id, cover, title, index_sequence, 
        duration, video_height, video_weight, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT(melolo_vid_id) DO UPDATE SET
        cover = EXCLUDED.cover,
        title = EXCLUDED.title,
        index_sequence = EXCLUDED.index_sequence,
        duration = EXCLUDED.duration,
        video_height = EXCLUDED.video_height,
        video_weight = EXCLUDED.video_weight,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [
      seriesId,
      episodeData.vid,
      episodeData.episode_cover || '',
      episodeData.title || episodeData.name || '',
      episodeData.vid_index || 0,
      episodeData.duration || 0,
      episodeData.video_height || 1080,
      episodeData.video_weight || episodeData.video_width || 720
    ]);

    return result.rows[0].id;
  } finally {
    client.release();
  }
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
        const episodeId = await saveEpisode(dbSeriesId, {
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
          console.error(`episodeId not found`);
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
 * @returns {Promise<Array>} Episodes without paths
 */
export async function getEpisodesToDownload(seriesId) {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT e.*, s.title as series_title
      FROM episodes e
      JOIN series s ON e.series_id = s.id
      WHERE e.series_id = $1 AND (e.path IS NULL OR e.path = '')
      ORDER BY e.index_sequence ASC
    `, [seriesId]);
    
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Update episode path after download
 * @param {number} episodeId - Database episode ID
 * @param {string} path - File path
 * @returns {Promise<void>}
 */
export async function updateEpisodePath(episodeId, path) {
  const client = await pool.connect();
  
  try {
    await client.query(`
      UPDATE episodes 
      SET path = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `, [path, episodeId]);
  } finally {
    client.release();
  }
}

