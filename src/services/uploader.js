import axios from "axios";
import { createReadStream, statSync, existsSync } from "fs";
import FormData from "form-data";
import pool from "../db/database.js";

/**
 * Dailymotion API client for handling authentication and video uploads
 */
class DailymotionClient {
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.accessToken = null;
    this.tokenExpiry = null;

    this.apiClient = axios.create({
      baseURL: "https://partner.api.dailymotion.com",
      timeout: 300000, // 5 minutes for upload
    });

    // Add request interceptor to include auth token
    this.apiClient.interceptors.request.use((config) => {
      console.log("===> INTERCEPTOR uploader.js:23 ~ this.accessToken", this.accessToken);
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });
  }

  /**
   * Authenticate with Dailymotion API using client credentials flow
   */
  async authenticate() {
    try {
      //   const params = new URLSearchParams();
      //   params.append('grant_type', 'client_credentials');
      //   params.append('client_id', this.apiKey);
      //   params.append('client_secret', this.apiSecret);
      //   params.append('scope', 'manage_videos');
      // const params = {
      //   grant_type: "client_credentials",
      //   client_id: this.apiKey,
      //   client_secret: this.apiSecret,
      //   scope: "manage_videos",
      // };
			const formData = new FormData();
			formData.append('grant_type', 'client_credentials');
			formData.append('client_id', this.apiKey);
			formData.append('client_secret', this.apiSecret);
			formData.append('scope', 'manage_videos');
			formData.append('Content-Type', 'application/x-www-form-urlencoded');

      const response = await axios.post(
        "https://partner.api.dailymotion.com/oauth/v1/token",
        formData
        // {
        //   headers: {
        //     'Content-Type': 'application/x-www-form-urlencoded',
        //   },
        // }
      );

      this.accessToken = response.data.access_token;
      // Set expiry to 5 minutes before actual expiry for safety margin
      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiry = Date.now() + (expiresIn - 300) * 1000;

      console.log("[Dailymotion] Authentication successful");
    } catch (error) {
      console.error("[Dailymotion] Authentication failed:", error.message);
      throw new Error("Failed to authenticate with Dailymotion API");
    }
  }

  /**
   * Check if the current token is still valid
   */
  isTokenValid() {
    return this.accessToken !== null && this.tokenExpiry !== null && Date.now() < this.tokenExpiry;
  }

  /**
   * Ensure we have a valid token, refresh if needed
   */
  async ensureValidToken() {
    if (!this.isTokenValid()) {
      await this.authenticate();
    }
  }

  /**
   * Get upload URL for a video file
   */
  async getUploadUrl() {
    try {
      await this.ensureValidToken();

      const response = await this.apiClient.get("/rest/file/upload");

      return response.data;
    } catch (error) {
      console.error("[Dailymotion] Failed to get upload URL:", error.message);
      console.error(error);
      throw new Error("Failed to get upload URL from Dailymotion");
    }
  }

  /**
   * Upload a video file to Dailymotion
   */
  async uploadFile(filePath, uploadUrl, onProgress) {
    try {
      console.log("[Dailymotion] Uploading file:", filePath);
      console.log("[Dailymotion] Upload URL:", uploadUrl);

      const fileStats = statSync(filePath);
      const fileSize = fileStats.size;
      console.log("[Dailymotion] File size:", (fileSize / 1024 / 1024).toFixed(2), "MB");

      // Create form data with file field as required by Dailymotion
      const formData = new FormData();
      formData.append("file", createReadStream(filePath));

      const uploadResponse = await axios.post(uploadUrl, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            onProgress(progress);
          }
        },
      });

      console.log("[Dailymotion] Upload response:", uploadResponse.data);

      // Return upload_url from response (this is used as upload token)
      return uploadResponse.data.upload_url || uploadResponse.data.url;
    } catch (error) {
      console.error("[Dailymotion] File upload failed:", error.response?.data || error.message);
      throw new Error(`Failed to upload file to Dailymotion: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Publish a video with metadata
   */
  async publishVideo(uploadUrl, title, description) {
    try {
      await this.ensureValidToken();

      console.log("[Dailymotion] Publishing video with URL:", uploadUrl);

      const response = await this.apiClient.post("/rest/video/create", {
        url: uploadUrl,
        title,
        description: description || "",
        published: true,
      });

      console.log(`[Dailymotion] Video published successfully: ${response.data.id}`);
      return response.data;
    } catch (error) {
      console.error("[Dailymotion] Video publish failed:", error.response?.data || error.message);
      throw new Error(`Failed to publish video to Dailymotion: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Complete video upload and publish
   */
  async uploadAndPublishVideo(filePath, title, description, onProgress) {
    try {
      console.log(`[Dailymotion] Starting upload: ${title}`);

      // Step 1: Get upload URL
      const uploadUrlData = await this.getUploadUrl();
      console.log("[Dailymotion] Received upload URL");

      // Step 2: Upload file to the provided URL
      const uploadedUrl = await this.uploadFile(filePath, uploadUrlData.upload_url, onProgress);
      console.log("[Dailymotion] File uploaded, URL:", uploadedUrl);

      // Step 3: Publish video with the uploaded URL
      const publishResponse = await this.publishVideo(uploadedUrl, title, description);
      console.log("[Dailymotion] Video published with ID:", publishResponse.id);

      return publishResponse.id;
    } catch (error) {
      console.error("[Dailymotion] Upload and publish failed:", error.message);
      throw error;
    }
  }
}

// Singleton instance
let dailymotionClient = null;

/**
 * Get or create the Dailymotion client instance
 */
function getDailymotionClient() {
  if (!dailymotionClient) {
    const apiKey = process.env.DAILYMOTION_API_KEY;
    const apiSecret = process.env.DAILYMOTION_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error("DAILYMOTION_API_KEY and DAILYMOTION_API_SECRET environment variables are required");
    }

    dailymotionClient = new DailymotionClient(apiKey, apiSecret);
  }

  return dailymotionClient;
}

/**
 * Update upload schedule status
 */
async function updateUploadStatus(episodeId, status, data = {}) {
  const client = await pool.connect();

  try {
    const updates = ["status = $1", "updated_at = CURRENT_TIMESTAMP"];
    const values = [status];
    let paramIndex = 2;

    if (data.progress !== undefined) {
      updates.push(`upload_progress = $${paramIndex}`);
      values.push(data.progress);
      paramIndex++;
    }

    if (data.dailymotionVideoId) {
      updates.push(`dailymotion_video_id = $${paramIndex}`);
      values.push(data.dailymotionVideoId);
      paramIndex++;
    }

    if (data.error) {
      updates.push(`error_message = $${paramIndex}`);
      values.push(data.error);
      paramIndex++;
    }

    if (data.incrementRetry) {
      updates.push("retry_count = retry_count + 1");
    }

    if (status === "uploading" && !data.skipStartTime) {
      updates.push("started_at = CURRENT_TIMESTAMP");
    }

    if (status === "completed" || status === "failed" || status === "skipped") {
      updates.push("completed_at = CURRENT_TIMESTAMP");
    }

    values.push(episodeId);

    await client.query(
      `UPDATE upload_schedule 
       SET ${updates.join(", ")}
       WHERE episode_id = $${paramIndex}`,
      values
    );
  } finally {
    client.release();
  }
}

/**
 * Upload episode to Dailymotion
 */
export async function uploadEpisode(episode, seriesInfo, onProgress = null) {
  const { id: episodeId, index_sequence, path } = episode;
  const { title: seriesTitle, intro } = seriesInfo;

  console.log(`\n[Upload] Starting upload for Episode ${index_sequence}: ${episode.title || ""}`);

  try {
    // Check if file exists
    if (!path || !existsSync(path)) {
      throw new Error(`Video file not found: ${path}`);
    }

    // Mark as uploading
    await updateUploadStatus(episodeId, "uploading", { progress: 0 });

    const client = getDailymotionClient();

    // Create title and description
    const videoTitle = `${seriesTitle} - Episode ${index_sequence}`;
    const videoDescription = intro || "";

    // Progress callback
    let lastUpdate = 0;
    const progressCallback = async (progress) => {
      const now = Date.now();
      // Update DB every 5 seconds to avoid too many queries
      if (now - lastUpdate > 5000) {
        await updateUploadStatus(episodeId, "uploading", {
          progress,
          skipStartTime: true,
        });
        lastUpdate = now;
      }

      // Always call external callback
      if (onProgress) {
        onProgress(episodeId, progress);
      }
    };

    // Upload video
    const dailymotionVideoId = await client.uploadAndPublishVideo(path, videoTitle, videoDescription, progressCallback);

    // Mark as completed
    await updateUploadStatus(episodeId, "completed", {
      progress: 100,
      dailymotionVideoId,
    });

    console.log(`[Upload] ✓ Episode ${index_sequence} uploaded successfully: ${dailymotionVideoId}`);

    if (onProgress) {
      onProgress(episodeId, 100, dailymotionVideoId);
    }

    return dailymotionVideoId;
  } catch (error) {
    console.error(`[Upload] ✗ Episode ${index_sequence} upload failed:`, error.message);

    // Get retry count
    const client = await pool.connect();
    const result = await client.query("SELECT retry_count FROM upload_schedule WHERE episode_id = $1", [episodeId]);
    client.release();

    const retryCount = result.rows[0]?.retry_count || 0;

    if (retryCount >= 2) {
      // Already tried 3 times (0, 1, 2)
      console.log(`[Upload] Max retries reached for Episode ${index_sequence}, skipping...`);
      await updateUploadStatus(episodeId, "skipped", {
        error: `Max retries exceeded: ${error.message}`,
        incrementRetry: true,
      });
    } else {
      console.log(`[Upload] Will retry Episode ${index_sequence} (attempt ${retryCount + 2}/3)`);
      await updateUploadStatus(episodeId, "failed", {
        error: error.message,
        incrementRetry: true,
      });
    }

    throw error;
  }
}

/**
 * Add series to upload schedule
 */
export async function addSeriesToSchedule(seriesId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get series info
    const seriesResult = await client.query("SELECT * FROM series WHERE id = $1", [seriesId]);
    console.log("===> uploader.js:354 ~ seriesId", seriesId);

    console.log("===> uploader.js:357 ~ seriesResult", seriesResult);
    if (seriesResult.rows.length === 0) {
      throw new Error("Series not found");
    }

    // Get all episodes with video files
    const episodesResult = await client.query(
      `SELECT * FROM episodes 
       WHERE series_id = $1 AND path IS NOT NULL
       ORDER BY index_sequence ASC`,
      [seriesId]
    );

    if (episodesResult.rows.length === 0) {
      throw new Error("No downloaded episodes found for this series");
    }

    // Check if all episodes are downloaded
    const totalEpisodesResult = await client.query("SELECT COUNT(*) as count FROM episodes WHERE series_id = $1", [seriesId]);

    const totalEpisodes = parseInt(totalEpisodesResult.rows[0].count);
    const downloadedEpisodes = episodesResult.rows.length;

    if (downloadedEpisodes < totalEpisodes) {
      throw new Error(`Not all episodes downloaded (${downloadedEpisodes}/${totalEpisodes}). Please download all episodes first.`);
    }

    // Schedule episodes (1 episode per hour)
    const now = new Date();
    let scheduleTime = new Date(now);
    scheduleTime.setMinutes(0, 0, 0); // Start at the next hour

    // If current time is past the hour mark, start from next hour
    if (now.getMinutes() > 0) {
      scheduleTime.setHours(scheduleTime.getHours() + 1);
    }

    for (const episode of episodesResult.rows) {
      // Check if already scheduled
      const existing = await client.query("SELECT id FROM upload_schedule WHERE episode_id = $1", [episode.id]);

      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO upload_schedule (series_id, episode_id, scheduled_at, status)
           VALUES ($1, $2, $3, 'pending')`,
          [seriesId, episode.id, scheduleTime]
        );

        // Next episode 1 hour later
        scheduleTime = new Date(scheduleTime.getTime() + 60 * 60 * 1000);
      }
    }

    await client.query("COMMIT");

    return {
      seriesTitle: seriesResult.rows[0].title,
      episodesScheduled: episodesResult.rows.length,
      firstUpload: episodesResult.rows[0],
      scheduleStartTime: now,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get upload schedule status
 */
export async function getUploadSchedule(seriesId = null) {
  const client = await pool.connect();

  try {
    let whereClause = "";
    let values = [];

    if (seriesId) {
      whereClause = "WHERE us.series_id = $1";
      values = [seriesId];
    }

    const result = await client.query(
      `SELECT 
        us.*,
        e.title as episode_title,
        e.index_sequence,
        e.path as video_path,
        s.title as series_title
       FROM upload_schedule us
       JOIN episodes e ON us.episode_id = e.id
       JOIN series s ON us.series_id = s.id
       ${whereClause}
       ORDER BY us.scheduled_at ASC`,
      values
    );

    const items = result.rows;

    const stats = {
      total: items.length,
      pending: items.filter((i) => i.status === "pending").length,
      uploading: items.filter((i) => i.status === "uploading").length,
      completed: items.filter((i) => i.status === "completed").length,
      failed: items.filter((i) => i.status === "failed").length,
      skipped: items.filter((i) => i.status === "skipped").length,
      items: items,
    };

    // Group by series
    const bySeries = {};
    items.forEach((item) => {
      if (!bySeries[item.series_id]) {
        bySeries[item.series_id] = {
          seriesId: item.series_id,
          seriesTitle: item.series_title,
          episodes: [],
        };
      }
      bySeries[item.series_id].episodes.push(item);
    });

    stats.bySeries = Object.values(bySeries);

    return stats;
  } finally {
    client.release();
  }
}

/**
 * Remove series from upload schedule
 */
export async function removeSeriesFromSchedule(seriesId) {
  const client = await pool.connect();

  try {
    // Only remove pending and failed items
    const result = await client.query(
      `DELETE FROM upload_schedule 
       WHERE series_id = $1 AND status IN ('pending', 'failed')`,
      [seriesId]
    );

    return result.rowCount;
  } finally {
    client.release();
  }
}

/**
 * Get next episode to upload
 */
export async function getNextEpisodeToUpload() {
  const client = await pool.connect();

  try {
    const now = new Date();

    // Get next pending or failed episode that is scheduled to upload now or in the past
    const result = await client.query(
      `SELECT 
        us.*,
        e.title as episode_title,
        e.index_sequence,
        e.path,
        e.melolo_vid_id,
        s.title as series_title,
        s.intro
       FROM upload_schedule us
       JOIN episodes e ON us.episode_id = e.id
       JOIN series s ON us.series_id = s.id
       WHERE us.status IN ('pending', 'failed')
         AND us.scheduled_at <= $1
         AND us.retry_count < 3
       ORDER BY us.scheduled_at ASC, us.id ASC
       LIMIT 1`,
      [now]
    );

    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * Test Dailymotion connection and credentials
 */
export async function testDailymotionConnection() {
  try {
    const client = getDailymotionClient();
    await client.authenticate();

    return {
      success: true,
      message: "Dailymotion authentication successful",
      tokenValid: client.isTokenValid(),
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Test upload a single episode (for testing purposes)
 */
export async function testUploadEpisode(episodeId, onProgress = null) {
  const client = await pool.connect();

  try {
    // Get episode with series info
    const result = await client.query(
      `SELECT 
        e.*,
        s.title as series_title,
        s.intro
       FROM episodes e
       JOIN series s ON e.series_id = s.id
       WHERE e.id = $1`,
      [episodeId]
    );

    if (result.rows.length === 0) {
      throw new Error("Episode not found");
    }

    const episode = result.rows[0];
    const seriesInfo = {
      title: episode.series_title,
      intro: episode.intro,
    };

    console.log(`[Test Upload] Starting test upload for Episode ${episode.index_sequence}`);

    // Upload episode
    const videoId = await uploadEpisode(episode, seriesInfo, onProgress);

    return {
      success: true,
      videoId,
      episode: {
        id: episode.id,
        index: episode.index_sequence,
        title: episode.title,
        seriesTitle: episode.series_title,
      },
      url: `https://www.dailymotion.com/video/${videoId}`,
    };
  } catch (error) {
    console.error("[Test Upload] Error:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get episode info for test upload
 */
export async function getEpisodeForTest(seriesId, episodeIndex = 1) {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT 
        e.id,
        e.title,
        e.index_sequence,
        e.path,
        s.title as series_title
       FROM episodes e
       JOIN series s ON e.series_id = s.id
       WHERE e.series_id = $1 AND e.index_sequence = $2 AND e.path IS NOT NULL`,
      [seriesId, episodeIndex]
    );

    return result.rows[0] || null;
  } finally {
    client.release();
  }
}
