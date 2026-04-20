const { validationResult } = require("express-validator");
const db      = require("../config/db");
const crypto  = require("../services/cryptoService");
const { audit } = require("../middleware/audit");
const logger  = require("../config/logger");

function validationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, errors: errors.array() });
    return true;
  }
  return false;
}

// ─── List active elections ────────────────────────────────────
exports.listElections = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT e.id, e.title, e.description, e.status, e.starts_at, e.ends_at,
              (SELECT COUNT(*) FROM candidates c WHERE c.election_id = e.id AND c.is_active = true)
                AS candidate_count
       FROM elections e
       WHERE e.status IN ('active', 'ended', 'results_published')
       ORDER BY e.starts_at DESC`
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// ─── Get candidates for an election ──────────────────────────
exports.getCandidates = async (req, res, next) => {
  try {
    const { electionId } = req.params;

    const electionRes = await db.query(
      "SELECT id, title, status FROM elections WHERE id = $1",
      [electionId]
    );
    if (!electionRes.rows[0]) {
      return res.status(404).json({ success: false, message: "Election not found" });
    }

    const { rows } = await db.query(
      `SELECT id, name, party, bio, position
       FROM candidates
       WHERE election_id = $1 AND is_active = true
       ORDER BY position ASC, name ASC`,
      [electionId]
    );

    // Check if this voter has already voted in this election
    let hasVoted = false;
    if (req.user) {
      const eligRes = await db.query(
        "SELECT has_voted FROM voter_eligibility WHERE voter_id = $1 AND election_id = $2",
        [req.user.id, electionId]
      );
      hasVoted = eligRes.rows[0]?.has_voted || false;
    }

    res.json({
      success: true,
      data: {
        election: electionRes.rows[0],
        candidates: rows,
        hasVoted,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Cast a vote ──────────────────────────────────────────────
exports.vote = async (req, res, next) => {
  try {
    if (validationErrors(req, res)) return;

    const voterId     = req.user.id;
    const { election_id, candidate_id } = req.body;

    await db.withTransaction(async (client) => {
      // Lock the eligibility row to prevent race conditions
      const eligRes = await client.query(
        `SELECT has_voted FROM voter_eligibility
         WHERE voter_id = $1 AND election_id = $2
         FOR UPDATE`,
        [voterId, election_id]
      );

      // Auto-enroll voter in election if not yet eligible (open elections)
      if (eligRes.rows.length === 0) {
        await client.query(
          "INSERT INTO voter_eligibility (voter_id, election_id) VALUES ($1, $2)",
          [voterId, election_id]
        );
      } else if (eligRes.rows[0].has_voted) {
        // Already voted — throw to trigger rollback
        const err = new Error("You have already cast your vote in this election");
        err.statusCode = 409;
        throw err;
      }

      // Confirm election is active
      const elecRes = await client.query(
        "SELECT status, public_key_pem FROM elections WHERE id = $1",
        [election_id]
      );
      const election = elecRes.rows[0];
      if (!election) {
        const err = new Error("Election not found"); err.statusCode = 404; throw err;
      }
      if (election.status !== "active") {
        const err = new Error(`Voting is not open — election is '${election.status}'`);
        err.statusCode = 400; throw err;
      }

      // Confirm candidate belongs to this election
      const candRes = await client.query(
        "SELECT id FROM candidates WHERE id = $1 AND election_id = $2 AND is_active = true",
        [candidate_id, election_id]
      );
      if (!candRes.rows[0]) {
        const err = new Error("Invalid candidate for this election");
        err.statusCode = 400; throw err;
      }

      // Load public key if not yet in memory
      crypto.setPublicKey(election_id, election.public_key_pem);

      // Encrypt the vote
      const encryptedData = crypto.encryptVote(election_id, candidate_id);

      // Store encrypted vote (NO link back to voter — anonymity preserved)
      await client.query(
        "INSERT INTO votes (election_id, encrypted_data) VALUES ($1, $2)",
        [election_id, encryptedData]
      );

      // Mark voter as voted
      await client.query(
        `UPDATE voter_eligibility
         SET has_voted = true, voted_at = NOW()
         WHERE voter_id = $1 AND election_id = $2`,
        [voterId, election_id]
      );
    });

    await audit({
      actorId: voterId, actorRole: "voter",
      action: "VOTE_CAST",
      entity: "votes",
      ip: req.ip, userAgent: req.headers["user-agent"],
      meta: { election_id },   // No candidate_id in audit — maintain ballot secrecy
    });

    logger.info("Vote cast", { voter: voterId, election: election_id });

    res.json({ success: true, message: "Your vote has been cast successfully" });
  } catch (err) {
    next(err);
  }
};

// ─── Turnout stats (public) ───────────────────────────────────
exports.stats = async (req, res, next) => {
  try {
    const { electionId } = req.params;

    const elecRes = await db.query(
      "SELECT id, title, status FROM elections WHERE id = $1",
      [electionId]
    );
    if (!elecRes.rows[0]) {
      return res.status(404).json({ success: false, message: "Election not found" });
    }

    const total  = await db.query(
      "SELECT COUNT(*) FROM voter_eligibility WHERE election_id = $1", [electionId]
    );
    const voted  = await db.query(
      "SELECT COUNT(*) FROM voter_eligibility WHERE election_id = $1 AND has_voted = true", [electionId]
    );
    const totalVotes  = parseInt(total.rows[0].count);
    const votedCount  = parseInt(voted.rows[0].count);

    res.json({
      success: true,
      data: {
        election: elecRes.rows[0],
        totalEligible: totalVotes,
        totalVoted: votedCount,
        turnoutPercent: totalVotes > 0 ? ((votedCount / totalVotes) * 100).toFixed(2) : "0.00",
      },
    });
  } catch (err) {
    next(err);
  }
};
