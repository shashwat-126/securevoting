const db     = require("../config/db");
const logger = require("../config/logger");

/**
 * Write an entry to the audit_log table.
 * Fire-and-forget — never blocks the response.
 */
async function audit(params) {
  const { actorId, actorRole, action, entity, entityId, ip, userAgent, meta } = params;
  try {
    await db.query(
      `INSERT INTO audit_log
        (actor_id, actor_role, action, entity, entity_id, ip_address, user_agent, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [actorId || null, actorRole || null, action, entity || null,
       entityId || null, ip || null, userAgent || null, meta ? JSON.stringify(meta) : null]
    );
  } catch (err) {
    // Log failure but never crash the request
    logger.error("Audit log write failed", { error: err.message, action });
  }
}

module.exports = { audit };
