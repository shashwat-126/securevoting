const logger = require("../config/logger");

// Central error handler — must have 4 params for Express to treat it as error middleware
// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  // Default to 500
  let statusCode = err.statusCode || err.status || 500;
  let message    = err.message || "Internal server error";

  // Postgres unique violation
  if (err.code === "23505") {
    statusCode = 409;
    message = "A record with that value already exists";
  }

  // Postgres foreign key violation
  if (err.code === "23503") {
    statusCode = 400;
    message = "Referenced record does not exist";
  }

  // JWT errors
  if (err.name === "JsonWebTokenError")  { statusCode = 401; message = "Invalid token"; }
  if (err.name === "TokenExpiredError")  { statusCode = 401; message = "Token has expired"; }
  if (err.name === "NotBeforeError")     { statusCode = 401; message = "Token not yet active"; }

  // CORS
  if (err.message && err.message.startsWith("CORS")) {
    statusCode = 403;
    message = err.message;
  }

  // Log server errors with full stack, client errors only briefly
  if (statusCode >= 500) {
    logger.error("Server error", {
      statusCode,
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
  } else {
    logger.warn("Client error", {
      statusCode,
      message,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
  }

  // Never leak stack traces in production
  const body = {
    success: false,
    message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  };

  res.status(statusCode).json(body);
};
