const { Router } = require("express");
const { body, param } = require("express-validator");
const c = require("../controllers/adminController");
const { authenticateAdmin } = require("../middleware/auth");

const router = Router();

// All admin routes require admin JWT
router.use(authenticateAdmin);

// ─── Elections ────────────────────────────────────────────────
router.get("/elections", c.listElections);

router.post(
  "/elections",
  [
    body("title").trim().notEmpty().withMessage("Title is required").isLength({ max: 200 }),
    body("description").optional().trim().isLength({ max: 1000 }),
    body("starts_at").optional().isISO8601().withMessage("starts_at must be a valid ISO 8601 date"),
    body("ends_at").optional().isISO8601().withMessage("ends_at must be a valid ISO 8601 date"),
  ],
  c.createElection
);

router.patch(
  "/elections/:electionId/status",
  [
    param("electionId").isUUID(),
    body("status").isIn(["pending", "active", "ended", "results_published"])
      .withMessage("Invalid status value"),
  ],
  c.updateElectionStatus
);

// ─── Candidates ───────────────────────────────────────────────
router.post(
  "/elections/:electionId/candidates",
  [
    param("electionId").isUUID(),
    body("name").trim().notEmpty().withMessage("Candidate name is required"),
    body("party").optional().trim(),
    body("bio").optional().trim().isLength({ max: 500 }),
    body("position").optional().isInt({ min: 0 }),
  ],
  c.addCandidate
);

// ─── Key Management ───────────────────────────────────────────
router.post(
  "/elections/:electionId/shares",
  [
    param("electionId").isUUID(),
    body("shares")
      .isArray({ min: 2 })
      .withMessage("Provide an array of at least 2 key shares"),
    body("shares.*").isString().notEmpty(),
  ],
  c.submitShares
);

// ─── Results Decryption ───────────────────────────────────────
router.get(
  "/elections/:electionId/results",
  [param("electionId").isUUID()],
  c.decryptResults
);



// ─── Audit Log ────────────────────────────────────────────────
router.get("/audit", c.getAuditLog);

module.exports = router;
