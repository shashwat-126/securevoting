const cron   = require("node-cron");
const db     = require("../config/db");
const logger = require("../config/logger");

/**
 * Runs every minute.
 * Checks for elections whose end time has passed and marks them 'ended'.
 * Checks for elections whose start time has passed and marks them 'active'.
 */
function startScheduler() {
  // Every minute
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      // Activate elections that have reached their start time
      const activated = await db.query(
        `UPDATE elections
         SET status = 'active', updated_at = NOW()
         WHERE status = 'pending'
           AND starts_at IS NOT NULL
           AND starts_at <= $1
         RETURNING id, title`,
        [now]
      );
      if (activated.rows.length > 0) {
        activated.rows.forEach((e) =>
          logger.info("Election auto-activated", { id: e.id, title: e.title })
        );
      }

      // End elections that have reached their end time
      const ended = await db.query(
        `UPDATE elections
         SET status = 'ended', updated_at = NOW()
         WHERE status = 'active'
           AND ends_at IS NOT NULL
           AND ends_at <= $1
         RETURNING id, title`,
        [now]
      );
      if (ended.rows.length > 0) {
        ended.rows.forEach((e) =>
          logger.info("Election auto-ended", { id: e.id, title: e.title })
        );
      }
    } catch (err) {
      logger.error("Scheduler error", { error: err.message });
    }
  });

  logger.info("Election scheduler started");
}

module.exports = { startScheduler };
