const rateLimit = require("express-rate-limit");
const logger = require("../config/logger");

const handler = (req, res, _next, options) => {
  logger.warn("Rate limit exceeded", {
    ip: req.ip,
    path: req.path,
    limit: options.max,
  });
  res.status(429).json({
    success: false,
    message: "Too many requests. Please slow down and try again later.",
    retryAfter: Math.ceil(options.windowMs / 1000),
  });
};

// Applied globally to all routes
const globalRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"),  // 15 min
  max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

// Stricter limiter for auth routes (register, login)
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 min
  max:      parseInt(process.env.AUTH_RATE_LIMIT_MAX || "10"),
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

// Very strict for vote casting — one attempt per minute
const voteRateLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 min
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

module.exports = { globalRateLimiter, authRateLimiter, voteRateLimiter };
