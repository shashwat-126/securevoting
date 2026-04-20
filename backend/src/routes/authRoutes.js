const { Router } = require("express");
const { body } = require("express-validator");
const c = require("../controllers/authController");
const { authenticateVoter } = require("../middleware/auth");
const { authRateLimiter } = require("../middleware/rateLimiter");

const router = Router();

// ─── Voter register ───────────────────────────────────────────
router.post(
  "/register",
  authRateLimiter,
  [
    body("name").trim().notEmpty().withMessage("Name is required").isLength({ max: 100 }),
    body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters")
      .matches(/[A-Z]/).withMessage("Password must contain an uppercase letter")
      .matches(/[0-9]/).withMessage("Password must contain a number"),
  ],
  c.register
);

// ─── Voter login ──────────────────────────────────────────────
router.post(
  "/login",
  authRateLimiter,
  [
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  c.login
);

// ─── Admin login ──────────────────────────────────────────────
router.post(
  "/admin/login",
  authRateLimiter,
  [
    body("username").trim().notEmpty().withMessage("Username is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  c.adminLogin
);

// ─── Get own profile ──────────────────────────────────────────
router.get("/profile", authenticateVoter, c.profile);

module.exports = router;
