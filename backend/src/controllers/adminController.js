const { validationResult } = require("express-validator");
const db = require("../config/db");
const crypto = require("../services/cryptoService");
const shamir = require("../services/shamirService");
const { audit } = require("../middleware/audit");
const logger = require("../config/logger");

function validationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, errors: errors.array() });
    return true;
  }
  return false;
}

// ─── List all elections ───────────────────────────────────────
exports.listElections = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT e.*,
              (SELECT COUNT(*) FROM votes v WHERE v.election_id = e.id) AS vote_count,
              (SELECT COUNT(*) FROM candidates c WHERE c.election_id = e.id) AS candidate_count
       FROM elections e
       ORDER BY e.created_at DESC`
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// ─── Create election ──────────────────────────────────────────
exports.createElection = async (req, res, next) => {
  try {
    if (validationErrors(req, res)) return;

    const { title, description, starts_at, ends_at } = req.body;

    const { publicKeyPem, privateKeyPem } = crypto.generateKeys(null);
    const [share1, share2, share3] = shamir.splitKey(privateKeyPem);

    const { rows } = await db.query(
      `INSERT INTO elections
         (title, description, starts_at, ends_at, public_key_pem,
          key_share_1, key_share_2, key_share_3, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, title, status, starts_at, ends_at, created_at`,
      [
        title,
        description || null,
        starts_at || null,
        ends_at || null,
        publicKeyPem,
        share1,
        share2,
        share3,
        req.user.id,
      ]
    );

    const election = rows[0];
    crypto.setPublicKey(election.id, publicKeyPem);

    await audit({
      actorId: req.user.id,
      actorRole: "admin",
      action: "ELECTION_CREATED",
      entity: "elections",
      entityId: election.id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    logger.info("Election created", { id: election.id, title });

    res.status(201).json({
      success: true,
      message:
        "Election created. Distribute the key shares to key-holders immediately.",
      data: {
        election,
        keyShares: { share1, share2, share3 },
        note: `Any ${shamir.THRESHOLD} of ${shamir.TOTAL_SHARES} shares are needed to decrypt results.`,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Update election status ───────────────────────────────────
exports.updateElectionStatus = async (req, res, next) => {
  try {
    if (validationErrors(req, res)) return;

    const { electionId } = req.params;
    const { status } = req.body;

    const { rows } = await db.query(
      `UPDATE elections
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, title, status`,
      [status, electionId]
    );

    if (!rows[0]) {
      return res.status(404).json({ success: false, message: "Election not found" });
    }

    await audit({
      actorId: req.user.id,
      actorRole: "admin",
      action: "ELECTION_STATUS_UPDATED",
      entity: "elections",
      entityId: electionId,
      ip: req.ip,
      meta: { status },
    });

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─── Add candidate ────────────────────────────────────────────
exports.addCandidate = async (req, res, next) => {
  try {
    if (validationErrors(req, res)) return;

    const { electionId } = req.params;
    const { name, party, bio, position } = req.body;

    const elecRes = await db.query(
      "SELECT status FROM elections WHERE id = $1",
      [electionId]
    );

    if (!elecRes.rows[0]) {
      return res.status(404).json({ success: false, message: "Election not found" });
    }

    if (!["pending", "active"].includes(elecRes.rows[0].status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot add candidates to a closed election",
      });
    }

    const { rows } = await db.query(
      `INSERT INTO candidates (election_id, name, party, bio, position)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, election_id, name, party, bio, position`,
      [electionId, name, party || null, bio || null, position || 0]
    );

    await audit({
      actorId: req.user.id,
      actorRole: "admin",
      action: "CANDIDATE_ADDED",
      entity: "candidates",
      entityId: rows[0].id,
      ip: req.ip,
      meta: { electionId, name },
    });

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─── Submit key shares to restore private key ─────────────────
exports.submitShares = async (req, res, next) => {
  try {
    if (validationErrors(req, res)) return;

    const { electionId } = req.params;
    const { shares } = req.body;

    const elecRes = await db.query(
      "SELECT id, status FROM elections WHERE id = $1",
      [electionId]
    );

    const election = elecRes.rows[0];

    if (!election) {
      return res.status(404).json({ success: false, message: "Election not found" });
    }

    if (election.status === "active") {
      return res.status(400).json({
        success: false,
        message: "Cannot restore key while election is active",
      });
    }

    const privateKeyPem = shamir.combineKeys(shares);
    crypto.setPrivateKey(electionId, privateKeyPem);

    await audit({
      actorId: req.user.id,
      actorRole: "admin",
      action: "KEY_SHARES_SUBMITTED",
      entity: "elections",
      entityId: electionId,
      ip: req.ip,
    });

    logger.warn("Private key loaded into memory for decryption", {
      electionId,
      admin: req.user.id,
    });

    res.json({
      success: true,
      message: "Private key successfully reconstructed. You may now decrypt results.",
    });
  } catch (err) {
    next(err);
  }
};

// ─── Decrypt and tally results ────────────────────────────────
exports.decryptResults = async (req, res, next) => {
  try {
    const { electionId } = req.params;

    const elecRes = await db.query(
      `SELECT e.id, e.title, e.status,
              (SELECT COUNT(*) FROM voter_eligibility ve WHERE ve.election_id = e.id) AS total_eligible,
              (SELECT COUNT(*) FROM voter_eligibility ve WHERE ve.election_id = e.id AND ve.has_voted = true) AS total_voted
       FROM elections e
       WHERE e.id = $1`,
      [electionId]
    );

    const election = elecRes.rows[0];

    if (!election) {
      return res.status(404).json({ success: false, message: "Election not found" });
    }

    if (election.status === "active") {
      return res.status(400).json({
        success: false,
        message: "Cannot decrypt results while voting is active",
      });
    }

    const votesRes = await db.query(
      "SELECT id, encrypted_data FROM votes WHERE election_id = $1",
      [electionId]
    );

    const tally = {};
    let decryptErrors = 0;

    for (const vote of votesRes.rows) {
      try {
        const candidateId = crypto.decryptVote(electionId, vote.encrypted_data);
        tally[candidateId] = (tally[candidateId] || 0) + 1;
      } catch (err) {
        decryptErrors++;
        logger.error("Failed to decrypt vote", {
          voteId: vote.id,
          electionId,
          error: err.message,
        });
      }
    }

    const candRes = await db.query(
      `SELECT id, name, party, position
       FROM candidates
       WHERE election_id = $1 AND is_active = true
       ORDER BY position ASC, name ASC`,
      [electionId]
    );

    const totalVotes = votesRes.rows.length - decryptErrors;

    const results = candRes.rows
      .map((c) => ({
        candidate: {
          id: c.id,
          name: c.name,
          party: c.party,
          position: c.position,
        },
        votes: tally[c.id] || 0,
        percent:
          totalVotes > 0
            ? (((tally[c.id] || 0) / totalVotes) * 100).toFixed(2)
            : "0.00",
      }))
      .sort((a, b) => {
        if (b.votes !== a.votes) return b.votes - a.votes;
        return a.candidate.name.localeCompare(b.candidate.name);
      });

    const topVotes = results.length ? results[0].votes : 0;
    const winners = results.filter((r) => r.votes === topVotes && results.length > 0);
    const isTie = winners.length > 1;

    await db.query("DELETE FROM election_results WHERE election_id = $1", [electionId]);

    for (let i = 0; i < results.length; i++) {
      const r = results[i];

      let resultStatus = "loser";
      if (isTie && r.votes === topVotes) {
        resultStatus = "tie";
      } else if (!isTie && i === 0) {
        resultStatus = "winner";
      }

      await db.query(
        `INSERT INTO election_results
         (election_id, candidate_id, result_status, votes, percent, rank_position, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          electionId,
          r.candidate.id,
          resultStatus,
          r.votes,
          parseFloat(r.percent),
          i + 1,
        ]
      );
    }

    await db.query(
      `UPDATE elections
       SET status = 'results_published', updated_at = NOW()
       WHERE id = $1`,
      [electionId]
    );

    crypto.clearPrivateKey(electionId);

    await audit({
      actorId: req.user.id,
      actorRole: "admin",
      action: "RESULTS_DECRYPTED",
      entity: "elections",
      entityId: electionId,
      ip: req.ip,
      meta: { totalVotes, decryptErrors, isTie },
    });

    res.json({
      success: true,
      data: {
        election: {
          id: election.id,
          title: election.title,
          status: "results_published",
          totalEligible: parseInt(election.total_eligible, 10),
          totalVoted: parseInt(election.total_voted, 10),
          totalDecrypted: totalVotes,
          decryptErrors,
        },
        results,
        winner: isTie ? null : (winners[0] || null),
        winners,
        isTie,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Public results ───────────────────────────────────────────
exports.getPublicResults = async (req, res, next) => {
  try {
    const { electionId } = req.params;

    const electionRes = await db.query(
      `SELECT id, title, description, status, starts_at, ends_at
       FROM elections
       WHERE id = $1`,
      [electionId]
    );

    const election = electionRes.rows[0];

    if (!election) {
      return res.status(404).json({ success: false, message: "Election not found" });
    }

    if (election.status !== "results_published") {
      return res.status(403).json({
        success: false,
        message: "Results are not public yet",
      });
    }

    const resultsRes = await db.query(
      `SELECT
          er.result_status,
          er.votes,
          er.percent,
          er.rank_position,
          c.id AS candidate_id,
          c.name,
          c.party
       FROM election_results er
       JOIN candidates c ON c.id = er.candidate_id
       WHERE er.election_id = $1
       ORDER BY er.rank_position ASC, c.name ASC`,
      [electionId]
    );

    res.json({
      success: true,
      data: {
        election,
        results: resultsRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Get audit log ────────────────────────────────────────────
exports.getAuditLog = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "100", 10), 500);
    const offset = parseInt(req.query.offset || "0", 10);

    const { rows } = await db.query(
      `SELECT id, actor_id, actor_role, action, entity, entity_id,
              ip_address, meta, created_at
       FROM audit_log
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const count = await db.query("SELECT COUNT(*) FROM audit_log");

    res.json({
      success: true,
      data: rows,
      pagination: {
        limit,
        offset,
        total: parseInt(count.rows[0].count, 10),
      },
    });
  } catch (err) {
    next(err);
  }
};