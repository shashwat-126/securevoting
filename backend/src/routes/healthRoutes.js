const { Router } = require("express");
const db = require("../config/db");

const router = Router();

router.get("/", async (req, res) => {
  const start = Date.now();
  let dbStatus = "ok";

  try {
    await db.query("SELECT 1");
  } catch {
    dbStatus = "error";
  }

  const status = dbStatus === "ok" ? 200 : 503;

  res.status(status).json({
    status: status === 200 ? "ok" : "degraded",
    version: process.env.npm_package_version || "2.0.0",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    latency: `${Date.now() - start}ms`,
    services: {
      database: dbStatus,
    },
  });
});

module.exports = router;
