const jwt = require("jsonwebtoken");
const db  = require("../config/db");

// Generic verifier factory
function makeAuthMiddleware(role) {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers["authorization"];
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "No token provided" });
      }

      const token = authHeader.slice(7);
      const secret =
        role === "admin"
          ? process.env.JWT_ADMIN_SECRET
          : process.env.JWT_VOTER_SECRET;

      if (!secret) {
        throw new Error("JWT secret is not configured");
      }

      const payload = jwt.verify(token, secret);

      // Confirm user still exists & is active in DB
      if (role === "admin") {
        const { rows } = await db.query(
          "SELECT id, username, is_active FROM admins WHERE id = $1",
          [payload.id]
        );
        if (!rows[0] || !rows[0].is_active) {
          return res.status(401).json({ success: false, message: "Account not found or deactivated" });
        }
        req.user = { id: payload.id, username: rows[0].username, role: "admin" };
      } else {
        const { rows } = await db.query(
          "SELECT id, email, is_active FROM voters WHERE id = $1",
          [payload.id]
        );
        if (!rows[0] || !rows[0].is_active) {
          return res.status(401).json({ success: false, message: "Account not found or deactivated" });
        }
        req.user = { id: payload.id, email: rows[0].email, role: "voter" };
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

const authenticateVoter = makeAuthMiddleware("voter");
const authenticateAdmin = makeAuthMiddleware("admin");

module.exports = { authenticateVoter, authenticateAdmin };
