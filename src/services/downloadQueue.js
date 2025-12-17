import pool from '../db/database.js';

/**
 * Add episodes to download queue
 * @param {number} seriesId - Series ID
 * @param {Array} episodes - Array of episode objects
 * @returns {Promise<void>}
 */
export async function addToQueue(seriesId, episodes) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    for (const episode of episodes) {
      // Check if already in queue
      const existing = await client.query(
        'SELECT id FROM download_queue WHERE episode_id = $1',
        [episode.id]
      );
      
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO download_queue (episode_id, series_id, status)
           VALUES ($1, $2, 'pending')`,
          [episode.id, seriesId]
        );
      }
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update download status
 * @param {number} episodeId - Episode ID
 * @param {string} status - Status (pending, downloading, completed, failed)
 * @param {Object} data - Additional data (progress, bytes, error)
 * @returns {Promise<void>}
 */
export async function updateDownloadStatus(episodeId, status, data = {}) {
  const client = await pool.connect();
  
  try {
    const updates = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [status];
    let paramIndex = 2;
    
    if (data.progress !== undefined) {
      updates.push(`progress = $${paramIndex}`);
      values.push(data.progress);
      paramIndex++;
    }
    
    if (data.totalBytes !== undefined) {
      updates.push(`total_bytes = $${paramIndex}`);
      values.push(data.totalBytes);
      paramIndex++;
    }
    
    if (data.downloadedBytes !== undefined) {
      updates.push(`downloaded_bytes = $${paramIndex}`);
      values.push(data.downloadedBytes);
      paramIndex++;
    }
    
    if (data.error) {
      updates.push(`error_message = $${paramIndex}`);
      values.push(data.error);
      paramIndex++;
    }
    
    if (status === 'downloading' && !data.skipStartTime) {
      updates.push('started_at = CURRENT_TIMESTAMP');
    }
    
    if (status === 'completed' || status === 'failed') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
    }
    
    values.push(episodeId);
    
    await client.query(
      `UPDATE download_queue 
       SET ${updates.join(', ')}
       WHERE episode_id = $${paramIndex}`,
      values
    );
  } finally {
    client.release();
  }
}

/**
 * Get download queue status
 * @param {number} seriesId - Optional series ID filter
 * @returns {Promise<Object>} Queue statistics
 */
export async function getQueueStatus(seriesId = null) {
  const client = await pool.connect();
  
  try {
    let whereClause = '';
    let values = [];
    
    if (seriesId) {
      whereClause = 'WHERE dq.series_id = $1';
      values = [seriesId];
    }
    
    const result = await client.query(
      `SELECT 
        dq.*,
        e.title as episode_title,
        e.index_sequence,
        e.melolo_vid_id,
        s.title as series_title
       FROM download_queue dq
       JOIN episodes e ON dq.episode_id = e.id
       JOIN series s ON dq.series_id = s.id
       ${whereClause}
       ORDER BY dq.created_at ASC`,
      values
    );
    
    const items = result.rows;
    
    const stats = {
      total: items.length,
      pending: items.filter(i => i.status === 'pending').length,
      downloading: items.filter(i => i.status === 'downloading').length,
      completed: items.filter(i => i.status === 'completed').length,
      failed: items.filter(i => i.status === 'failed').length,
      items: items
    };
    
    return stats;
  } finally {
    client.release();
  }
}

/**
 * Get next pending episodes
 * @param {number} limit - Number of episodes to get
 * @returns {Promise<Array>} Episodes to download
 */
export async function getNextPending(limit = 1) {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT 
        dq.*,
        e.title,
        e.index_sequence,
        e.melolo_vid_id,
        e.series_id,
        s.title as series_title
       FROM download_queue dq
       JOIN episodes e ON dq.episode_id = e.id
       JOIN series s ON dq.series_id = s.id
       WHERE dq.status = 'pending'
       ORDER BY dq.created_at ASC
       LIMIT $1`,
      [limit]
    );
    
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Clear completed/failed downloads from queue
 * @param {number} seriesId - Optional series ID filter
 * @returns {Promise<number>} Number of cleared items
 */
export async function clearQueue(seriesId = null) {
  const client = await pool.connect();
  
  try {
    let query = `DELETE FROM download_queue WHERE status IN ('completed', 'failed')`;
    let values = [];
    
    if (seriesId) {
      query += ' AND series_id = $1';
      values = [seriesId];
    }
    
    const result = await client.query(query, values);
    return result.rowCount;
  } finally {
    client.release();
  }
}

/**
 * Reset failed downloads to pending
 * @param {number} seriesId - Optional series ID filter
 * @returns {Promise<number>} Number of reset items
 */
export async function retryFailed(seriesId = null) {
  const client = await pool.connect();
  
  try {
    let query = `
      UPDATE download_queue 
      SET status = 'pending', 
          error_message = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE status = 'failed'
    `;
    let values = [];
    
    if (seriesId) {
      query += ' AND series_id = $1';
      values = [seriesId];
    }
    
    const result = await client.query(query, values);
    return result.rowCount;
  } finally {
    client.release();
  }
}

