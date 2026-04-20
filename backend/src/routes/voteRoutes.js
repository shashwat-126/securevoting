const { Router } = require("express");
const { body, param } = require("express-validator");
const c = require("../controllers/voteController");
const { authenticateVoter } = require("../middleware/auth");
const { voteRateLimiter } = require("../middleware/rateLimiter");

const router = Router();

// List all open/ended elections (public)
router.get("/elections", c.listElections);

// Get candidates for an election (authenticated)
router.get(
  "/elections/:electionId/candidates",
  authenticateVoter,
  [param("electionId").isUUID().withMessage("Invalid election ID")],
  c.getCandidates
);

// Cast a vote (authenticated + strict rate limit)
router.post(
  "/cast",
  authenticateVoter,
  voteRateLimiter,
  [
    body("election_id").isUUID().withMessage("Valid election_id (UUID) is required"),
    body("candidate_id").isUUID().withMessage("Valid candidate_id (UUID) is required"),
  ],
  c.vote
);

// Get turnout stats for an election (public)
router.get(
  "/elections/:electionId/stats",
  [param("electionId").isUUID().withMessage("Invalid election ID")],
  c.stats
);

module.exports = router;
