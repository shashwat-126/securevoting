const bcrypt = require("bcrypt");
const jwt    = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const db     = require("../config/db");
const { audit } = require("../middleware/audit");
const logger = require("../config/logger");

const SALT_ROUNDS = 12;

// ─── helpers ──────────────────────────────────────────────────
function signVoterToken(userId) {
  return jwt.sign({ id: userId, role: "voter" }, process.env.JWT_VOTER_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });
}

function signAdminToken(adminId) {
  return jwt.sign({ id: adminId, role: "admin" }, process.env.JWT_ADMIN_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });
}

function validationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, errors: errors.array() });
    return true;
  }
  return false;
}

// ─── Voter: Register ──────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    if (validationErrors(req, res)) return;

    const { name, email, password } = req.body;

    // Check duplicate
    const existing = await db.query("SELECT id FROM voters WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await db.query(
      "INSERT INTO voters (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, created_at",
      [name.trim(), email.toLowerCase(), hash]
    );

    const voter = rows[0];

    await audit({
      actorId: voter.id, actorRole: "voter",
      action: "VOTER_REGISTERED",
      entity: "voters", entityId: voter.id,
      ip: req.ip, userAgent: req.headers["user-agent"],
    });

    logger.info("Voter registered", { id: voter.id, email: voter.email });

    res.status(201).json({
      success: true,
      message: "Registration successful",
      data: { id: voter.id, name: voter.name, email: voter.email },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Voter: Login ─────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    if (validationErrors(req, res)) return;

    const { email, password } = req.body;

    const { rows } = await db.query(
      "SELECT id, name, email, password, is_active FROM voters WHERE email = $1",
      [email.toLowerCase()]
    );
    const voter = rows[0];

    // Constant-time comparison even when user doesn't exist (prevent timing attacks)
    const passwordToCheck = voter ? voter.password : "$2b$12$invalidhashfillerthatislong";
    const match = await bcrypt.compare(password, passwordToCheck);

    if (!voter || !match) {
      await audit({
        actorRole: "voter", action: "LOGIN_FAILED",
        ip: req.ip, meta: { email },
      });
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    if (!voter.is_active) {
      return res.status(403).json({ success: false, message: "Account is deactivated" });
    }

    const token = signVoterToken(voter.id);

    await audit({
      actorId: voter.id, actorRole: "voter",
      action: "LOGIN_SUCCESS", entity: "voters", entityId: voter.id,
      ip: req.ip, userAgent: req.headers["user-agent"],
    });

    res.json({
      success: true,
      message: "Login successful",
      data: {
        token,
        expiresIn: process.env.JWT_EXPIRES_IN || "8h",
        voter: { id: voter.id, name: voter.name, email: voter.email },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Admin: Login ─────────────────────────────────────────────
exports.adminLogin = async (req, res, next) => {
  try {
    if (validationErrors(req, res)) return;

    const { username, password } = req.body;

    const { rows } = await db.query(
      "SELECT id, username, password, is_active FROM admins WHERE username = $1",
      [username]
    );
    const admin = rows[0];

    const passwordToCheck = admin ? admin.password : "$2b$12$invalidhashfillerthatislong";
    const match = await bcrypt.compare(password, passwordToCheck);

    if (!admin || !match) {
      await audit({
        actorRole: "admin", action: "ADMIN_LOGIN_FAILED",
        ip: req.ip, meta: { username },
      });
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    if (!admin.is_active) {
      return res.status(403).json({ success: false, message: "Admin account deactivated" });
    }

    const token = signAdminToken(admin.id);

    await audit({
      actorId: admin.id, actorRole: "admin",
      action: "ADMIN_LOGIN_SUCCESS", entity: "admins", entityId: admin.id,
      ip: req.ip, userAgent: req.headers["user-agent"],
    });

    res.json({
      success: true,
      message: "Admin login successful",
      data: {
        token,
        expiresIn: process.env.JWT_EXPIRES_IN || "8h",
        admin: { id: admin.id, username: admin.username },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Voter: Profile ───────────────────────────────────────────
exports.profile = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      "SELECT id, name, email, is_verified, created_at FROM voters WHERE id = $1",
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: "Voter not found" });

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};
