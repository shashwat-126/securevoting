const path = require("path");
const dotenv = require("dotenv");

const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env";

dotenv.config({
  path: path.resolve(process.cwd(), envFile)
});

const app = require("./src/app");
const logger = require("./src/config/logger");
const db = require("./src/config/db");
const { startScheduler } = require("./src/services/scheduler");

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Server running`, {
    port: PORT,
    env: process.env.NODE_ENV || "development",
    pid: process.pid,
  });
  startScheduler();
});

// Graceful Shutdown
async function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);

  server.close(async () => {
    logger.info("HTTP server closed");
    try {
      await db.end();
      logger.info("Database pool closed");
    } catch (err) {
      logger.error("Error closing database pool", { error: err.message });
    }
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Forcing shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason });
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception — shutting down", {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});