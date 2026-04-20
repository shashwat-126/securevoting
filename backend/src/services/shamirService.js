/**
 * shamirService.js
 *
 * Splits the RSA private key PEM into N shares using Shamir's Secret Sharing.
 * Any K-of-N shares can reconstruct the key (default: 2-of-3).
 *
 * shares are base64 strings safe for JSON transport and DB storage.
 */

const secrets = require("secrets.js-grempe");

const TOTAL_SHARES    = 3;
const THRESHOLD       = 2;   // minimum shares needed to reconstruct

function pemToHex(pem) {
  return Buffer.from(pem, "utf8").toString("hex");
}

function hexToPem(hex) {
  return Buffer.from(hex, "hex").toString("utf8");
}

/**
 * Split a private key PEM into TOTAL_SHARES shares.
 * Returns array of share strings (hex-encoded by secrets.js).
 */
function splitKey(privateKeyPem) {
  if (!privateKeyPem || !privateKeyPem.includes("PRIVATE KEY")) {
    throw new Error("Invalid PEM provided to splitKey");
  }
  const hex    = pemToHex(privateKeyPem);
  const shares = secrets.share(hex, TOTAL_SHARES, THRESHOLD);
  return shares;   // [ share1, share2, share3 ]
}

/**
 * Reconstruct the private key from an array of at least THRESHOLD shares.
 * Returns the PEM string.
 */
function combineKeys(sharesArray) {
  if (!Array.isArray(sharesArray) || sharesArray.length < THRESHOLD) {
    throw new Error(`At least ${THRESHOLD} shares are required to reconstruct the key`);
  }
  const hex = secrets.combine(sharesArray);
  const pem = hexToPem(hex);
  if (!pem.includes("PRIVATE KEY")) {
    throw new Error("Key reconstruction failed — shares may be invalid or mismatched");
  }
  return pem;
}

module.exports = { splitKey, combineKeys, TOTAL_SHARES, THRESHOLD };
