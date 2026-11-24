import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALPHABET, CODE_LEN, checksum, formatCode, generateCode, hashCode, isWellFormed, normalizeCode,
} from '../src/lib/codes.js';
import { SECRET } from './helpers/fakeStore.js';

test('generated codes are XXXX-XXXX-XXXX-XXXX and pass their own check', () => {
  for (let i = 0; i < 200; i++) {
    const c = generateCode(SECRET);
    assert.match(c, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    assert.equal(isWellFormed(c, SECRET), true);
  }
});

test('10,000 generated codes are all distinct (sanity check on randomness)', () => {
  const seen = new Set();
  for (let i = 0; i < 10_000; i++) seen.add(generateCode(SECRET));
  assert.equal(seen.size, 10_000);
});

test('every single-character typo at every position is rejected (fixed code, deterministic)', () => {
  const random = '7K3M9XQ2TB4N'; // fixed so this test never flakes
  const code = random + checksum(random, SECRET);
  assert.equal(isWellFormed(code, SECRET), true);
  let rejected = 0;
  let tried = 0;
  for (let pos = 0; pos < CODE_LEN; pos++) {
    for (const ch of ALPHABET) {
      if (ch === code[pos]) continue;
      tried++;
      if (!isWellFormed(code.slice(0, pos) + ch + code.slice(pos + 1), SECRET)) rejected++;
    }
  }
  // Keyed 20-bit checksum: a random typo slips through with p = 2^-20. Expect all rejected here.
  assert.equal(rejected, tried);
});

test('well-formed check needs the secret: a code made with another secret is rejected', () => {
  const forged = generateCode('another-secret-another-secret-12345678');
  assert.equal(isWellFormed(forged, SECRET), false);
});

test('rejects wrong length, bad characters and non-strings', () => {
  assert.equal(isWellFormed('', SECRET), false);
  assert.equal(isWellFormed('ABCD-EFGH', SECRET), false);
  assert.equal(isWellFormed(null, SECRET), false);
  assert.equal(isWellFormed(12345, SECRET), false);
  assert.equal(isWellFormed('!!!!-!!!!-!!!!-!!!!', SECRET), false);
});

test('normalisation: case, spaces, hyphens and look-alike characters (O->0, I/L->1)', () => {
  assert.equal(normalizeCode(' ab-cd ef '), 'ABCDEF');
  assert.equal(normalizeCode('o0il'), '0011');
  const code = generateCode(SECRET);
  const messy = code.toLowerCase().replace(/-/g, ' ');
  assert.equal(isWellFormed(messy, SECRET), true);
  assert.equal(hashCode(messy, SECRET), hashCode(code, SECRET));
});

test('hash is deterministic, keyed, and never equals the code', () => {
  const c = generateCode(SECRET);
  assert.equal(hashCode(c, SECRET), hashCode(c, SECRET));
  assert.notEqual(hashCode(c, SECRET), hashCode(c, 'different-secret-different-secret-123456'));
  assert.match(hashCode(c, SECRET), /^[0-9a-f]{64}$/);
  assert.ok(!hashCode(c, SECRET).includes(c.replace(/-/g, '')));
});

test('formatCode groups in fours', () => {
  assert.equal(formatCode('ABCDEFGHJKMNPQRS'), 'ABCD-EFGH-JKMN-PQRS');
});
