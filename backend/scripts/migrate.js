/**
 * scripts/migrate.js
 *
 * Run once after setting up the database:
 *   node scripts/migrate.js
 *
 * Creates the initial admin account. Set credentials via env:
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD=StrongPass123 node scripts/migrate.js
 */

require("dotenv").config();
const bcrypt = require("bcrypt");
const db     = require("../src/config/db");

async function main() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const email    = process.env.ADMIN_EMAIL    || "admin@yourdomain.com";
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.error("❌  Set ADMIN_PASSWORD environment variable before running this script");
    process.exit(1);
  }

  if (password.length < 12) {
    console.error("❌  ADMIN_PASSWORD must be at least 12 characters");
    process.exit(1);
  }

  console.log("Creating initial admin account...");
  const hash = await bcrypt.hash(password, 12);

  const { rows } = await db.query(
    `INSERT INTO admins (username, email, password)
     VALUES ($1, $2, $3)
     ON CONFLICT (username) DO NOTHING
     RETURNING id, username, email`,
    [username, email, hash]
  );

  if (rows[0]) {
    console.log(`✅  Admin created: ${rows[0].username} (${rows[0].email})`);
  } else {
    console.log(`ℹ️   Admin '${username}' already exists — skipped`);
  }

  await db.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
