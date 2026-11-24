import crypto from 'node:crypto';

/**
 * Reward codes printed inside each box.
 *
 * Format: XXXX-XXXX-XXXX-CCCC
 *   - 12 random characters  = 60 bits of entropy (from crypto.randomBytes, unbiased: 256 % 32 === 0)
 *   - 4 checksum characters = first 20 bits of HMAC(secret, random part)
 *
 * Why a *keyed* checksum: a typo is rejected without touching the database, and an attacker who does
 * not know the secret cannot produce well-formed codes, so random guessing passes the check with
 * probability 2^-20 and then must still hit a real code (about 2^-60 per guess).
 *
 * The database stores only HMAC(secret, code) - never the code itself - so a database leak does not
 * reveal unclaimed codes.
 */
export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32: no I, L, O, U
const RANDOM_LEN = 12;
const CHECK_LEN = 4;
export const CODE_LEN = RANDOM_LEN + CHECK_LEN;

function toBase32(bytes, len) {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] & 31];
  return out;
}

export function checksum(random, secret) {
  const mac = crypto.createHmac('sha256', secret).update(`chk:${random}`).digest();
  return toBase32(mac, CHECK_LEN);
}

export function formatCode(compact) {
  return compact.match(/.{1,4}/g).join('-');
}

export function generateCode(secret) {
  const random = toBase32(crypto.randomBytes(RANDOM_LEN), RANDOM_LEN);
  return formatCode(random + checksum(random, secret));
}

/** Upper-cases, strips spaces/hyphens and maps look-alike characters (O->0, I/L->1). */
export function normalizeCode(input) {
  if (typeof input !== 'string') return '';
  return input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}

export function isWellFormed(input, secret) {
  const code = normalizeCode(input);
  if (code.length !== CODE_LEN) return false;
  for (const ch of code) if (!ALPHABET.includes(ch)) return false;
  const expected = Buffer.from(checksum(code.slice(0, RANDOM_LEN), secret));
  const actual = Buffer.from(code.slice(RANDOM_LEN));
  return crypto.timingSafeEqual(expected, actual);
}

export function hashCode(input, secret) {
  return crypto.createHmac('sha256', secret).update(`code:${normalizeCode(input)}`).digest('hex');
}
