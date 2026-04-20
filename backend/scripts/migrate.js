const path = require("path");
const dotenv = require("dotenv");

const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env";

dotenv.config({
  path: path.resolve(process.cwd(), envFile)
});

const bcrypt = require("bcrypt");
const db = require("../src/config/db");

async function main() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const email = process.env.ADMIN_EMAIL || "admin@yourdomain.com";
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.error("❌ Set ADMIN_PASSWORD in .env.production");
    process.exit(1);
  }

  if (password.length < 12) {
    console.error("❌ ADMIN_PASSWORD must be at least 12 characters");
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
    console.log(`✅ Admin created: ${rows[0].username} (${rows[0].email})`);
  } else {
    console.log(`ℹ️ Admin '${username}' already exists — skipped`);
  }

  await db.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
});