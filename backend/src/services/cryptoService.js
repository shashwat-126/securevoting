/**
 * cryptoService.js
 *
 * RSA-OAEP-SHA256 encryption for vote data.
 *
 * Key lifecycle:
 *  1. Admin calls generateKeys() → returns PEM of private key.
 *  2. Private key is immediately split into Shamir shares (shamirService).
 *  3. Shares are stored in the elections table — private key itself is NOT stored.
 *  4. Public key PEM is stored in elections.public_key_pem.
 *  5. During voting, votes are encrypted with the public key.
 *  6. After election ends, two key-holders submit their shares.
 *  7. shamirService combines shares → private key PEM.
 *  8. setPrivateKey() loads it into memory for decryption session.
 *  9. After tallying, key is cleared from memory.
 */

const crypto = require("crypto");

// In-memory per-election key state (keyed by election id)
const electionKeys = new Map();

function generateKeys(electionId) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 4096,                         // 4096-bit for high security
    publicKeyEncoding:  { type: "spki",  format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  // Store public key in memory for this election
  electionKeys.set(electionId, { publicKey, privateKey: null });

  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}

function setPublicKey(electionId, publicKeyPem) {
  electionKeys.set(electionId, { publicKey: publicKeyPem, privateKey: null });
}

function setPrivateKey(electionId, privateKeyPem) {
  const entry = electionKeys.get(electionId) || {};
  electionKeys.set(electionId, { ...entry, privateKey: privateKeyPem });
}

function clearPrivateKey(electionId) {
  const entry = electionKeys.get(electionId);
  if (entry) {
    electionKeys.set(electionId, { publicKey: entry.publicKey, privateKey: null });
  }
}

function encryptVote(electionId, plaintext) {
  const entry = electionKeys.get(electionId);
  if (!entry?.publicKey) {
    throw new Error(`No public key available for election ${electionId}`);
  }

  const encrypted = crypto.publicEncrypt(
    {
      key: entry.publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(String(plaintext), "utf8")
  );

  return encrypted.toString("base64");
}

function decryptVote(electionId, ciphertext) {
  const entry = electionKeys.get(electionId);
  if (!entry?.privateKey) {
    throw new Error(`No private key loaded for election ${electionId}. Submit key shares first.`);
  }

  const decrypted = crypto.privateDecrypt(
    {
      key: entry.privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(ciphertext, "base64")
  );

  return decrypted.toString("utf8");
}

module.exports = {
  generateKeys,
  setPublicKey,
  setPrivateKey,
  clearPrivateKey,
  encryptVote,
  decryptVote,
};
