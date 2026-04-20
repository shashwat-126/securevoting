const winston = require("winston");
const path = require("path");

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const logDir = path.resolve(process.env.LOG_FILE ? path.dirname(process.env.LOG_FILE) : "logs");

const transports = [
  // Always log errors to a dedicated file
  new winston.transports.File({
    filename: path.join(logDir, "error.log"),
    level: "error",
    maxsize: 10_000_000,   // 10 MB
    maxFiles: 5,
    tailable: true,
  }),
  // Combined log
  new winston.transports.File({
    filename: process.env.LOG_FILE || path.join(logDir, "app.log"),
    maxsize: 50_000_000,   // 50 MB
    maxFiles: 10,
    tailable: true,
  }),
];

// Pretty console output in development
if (process.env.NODE_ENV !== "production") {
  transports.push(
    new winston.transports.Console({
      format: combine(colorize(), simple()),
    })
  );
} else {
  transports.push(
    new winston.transports.Console({
      format: combine(timestamp(), json()),
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    json()
  ),
  transports,
  exitOnError: false,
});

// Silence logs during testing
if (process.env.NODE_ENV === "test") {
  logger.silent = true;
}

module.exports = logger;
