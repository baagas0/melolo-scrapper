import { getNextEpisodeToUpload, uploadEpisode } from "./uploader.js";

/**
 * Upload Scheduler
 * Runs every minute to check if there's an episode scheduled for upload
 */
class UploadScheduler {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.currentUpload = null;
    this.progressCallback = null;
  }

  /**
   * Start the scheduler
   */
  start(onProgress = null) {
    if (this.isRunning) {
      console.log("[Scheduler] Already running");
      return;
    }

    this.isRunning = true;
    this.progressCallback = onProgress;

    console.log("[Scheduler] Starting upload scheduler...");

    // Check immediately on start
    this.checkAndUpload();

    // Then check every minute
    this.intervalId = setInterval(() => {
      this.checkAndUpload();
      // }, 60000); // Every 1 minute
      // 10 minute
      // }, 600000);
      // 1 hour
    }, 3600000);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      console.log("[Scheduler] Not running");
      return;
    }

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log("[Scheduler] Upload scheduler stopped");
  }

  /**
   * Check if there's an episode to upload and upload it
   */
  async checkAndUpload() {
    // Skip if already uploading
    if (this.currentUpload) {
      console.log("[Scheduler] Upload in progress, skipping check...");
      return;
    }

    try {
      // Get next episode to upload
      const episode = await getNextEpisodeToUpload();

      if (!episode) {
        // No episode scheduled for now
        return;
      }

      const now = new Date();
      const scheduledTime = new Date(episode.scheduled_at);

      console.log(`[Scheduler] Found episode to upload: ${episode.series_title} - Episode ${episode.index_sequence}`);
      console.log(`[Scheduler] Scheduled: ${scheduledTime.toLocaleString()}, Current: ${now.toLocaleString()}`);

      // Mark current upload
      this.currentUpload = episode;

      // Upload the episode
      const seriesInfo = {
        title: episode.series_title,
        intro: episode.intro,
      };

      try {
        await uploadEpisode(episode, seriesInfo, (episodeId, progress, videoId) => {
          if (this.progressCallback) {
            this.progressCallback({
              type: "upload_progress",
              data: {
                episodeId,
                seriesId: episode.series_id,
                seriesTitle: episode.series_title,
                episodeIndex: episode.index_sequence,
                progress,
                videoId,
              },
            });
          }
        });

        console.log(`[Scheduler] ✓ Upload completed for Episode ${episode.index_sequence}`);

        if (this.progressCallback) {
          this.progressCallback({
            type: "upload_complete",
            data: {
              episodeId: episode.episode_id,
              seriesId: episode.series_id,
              seriesTitle: episode.series_title,
              episodeIndex: episode.index_sequence,
            },
          });
        }
      } catch (error) {
        console.error(`[Scheduler] ✗ Upload failed for Episode ${episode.index_sequence}:`, error.message);

        if (this.progressCallback) {
          this.progressCallback({
            type: "upload_error",
            data: {
              episodeId: episode.episode_id,
              seriesId: episode.series_id,
              seriesTitle: episode.series_title,
              episodeIndex: episode.index_sequence,
              error: error.message,
            },
          });
        }
      }

      // Clear current upload
      this.currentUpload = null;
    } catch (error) {
      console.error("[Scheduler] Error in checkAndUpload:", error);
      this.currentUpload = null;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      currentUpload: this.currentUpload
        ? {
            seriesTitle: this.currentUpload.series_title,
            episodeIndex: this.currentUpload.index_sequence,
            episodeId: this.currentUpload.episode_id,
          }
        : null,
    };
  }
}

// Singleton instance
let schedulerInstance = null;

/**
 * Get or create scheduler instance
 */
export function getScheduler() {
  if (!schedulerInstance) {
    schedulerInstance = new UploadScheduler();
  }
  return schedulerInstance;
}
