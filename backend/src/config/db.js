const { Pool } = require("pg");
const logger = require("./logger");

const isProduction = process.env.NODE_ENV === "production";
const hasDatabaseUrl = !!process.env.DATABASE_URL;

const pool = new Pool(
  hasDatabaseUrl
    ? {
        connectionString: process.env.DATABASE_URL,
        min: parseInt(process.env.DB_POOL_MIN || "2", 10),
        max: parseInt(process.env.DB_POOL_MAX || "10", 10),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        ssl: isProduction ? { rejectUnauthorized: false } : false,
      }
    : {
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432", 10),
        database: process.env.DB_NAME || "voting_db",
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD,
        min: parseInt(process.env.DB_POOL_MIN || "2", 10),
        max: parseInt(process.env.DB_POOL_MAX || "10", 10),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      }
);

pool.on("connect", () => {
  logger.debug("New database client connected");
});

pool.on("error", (err) => {
  logger.error("Idle database client error", { error: err.message });
});

const query = async (text, params) => {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  if (duration > 1000) {
    logger.warn("Slow query detected", { duration, query: text });
  }

  return result;
};

const withTransaction = async (fn) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  query,
  withTransaction,
  end: () => pool.end(),
};