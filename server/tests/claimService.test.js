import test from 'node:test';
import assert from 'node:assert/strict';
import { claimCode } from '../src/services/claimService.js';
import { generateCode } from '../src/lib/codes.js';
import { baseCfg, createFakeStore, SECRET } from './helpers/fakeStore.js';

const claim = (s, user, rawCode, cfg = baseCfg) =>
  claimCode({ userId: user._id, rawCode, ip: '1.1.1.1' }, s.deps, cfg);
const rejects = (p, code, status) =>
  assert.rejects(p, (e) => e.code === code && (status === undefined || e.status === status));

test('valid code credits points, writes one ledger entry, marks the code claimed', async () => {
  const s = createFakeStore();
  const u = s.addUser();
  const code = s.addCode({ points: 25 });
  const res = await claim(s, u, code);
  assert.deepEqual(res, { points: 25, balance: 25 });
  assert.equal(s.users.get(u._id).points, 25);
  assert.equal(s.users.get(u._id).lifetimePoints, 25);
  assert.equal(s.ledger.filter((l) => l.type === 'earn').length, 1);
  assert.equal([...s.codes.values()][0].status, 'claimed');
});

test('messy input (lower-case, spaces) still claims', async () => {
  const s = createFakeStore();
  const u = s.addUser();
  const code = s.addCode();
  await claim(s, u, code.toLowerCase().replace(/-/g, ' '));
  assert.equal(s.users.get(u._id).points, 10);
});

test('a code can only be used once - second attempt by anyone is rejected 409', async () => {
  const s = createFakeStore();
  const a = s.addUser();
  const b = s.addUser();
  const code = s.addCode();
  await claim(s, a, code);
  await rejects(claim(s, a, code), 'already_claimed', 409);
  await rejects(claim(s, b, code), 'already_claimed', 409);
  assert.equal(s.users.get(b._id).points, 0);
});

test('RACE: 25 users submit the same code at the same instant -> exactly one wins', async () => {
  const s = createFakeStore();
  const code = s.addCode({ points: 40 });
  const users = Array.from({ length: 25 }, () => s.addUser());
  const results = await Promise.allSettled(users.map((u) => claim(s, u, code)));
  const wins = results.filter((r) => r.status === 'fulfilled');
  assert.equal(wins.length, 1);
  const totalPoints = [...s.users.values()].reduce((n, u) => n + u.points, 0);
  assert.equal(totalPoints, 40); // points were created exactly once
  assert.equal(s.ledger.filter((l) => l.type === 'earn').length, 1);
});

test('RACE: same user double-clicks -> one credit', async () => {
  const s = createFakeStore();
  const u = s.addUser();
  const code = s.addCode({ points: 10 });
  await Promise.allSettled([claim(s, u, code), claim(s, u, code), claim(s, u, code)]);
  assert.equal(s.users.get(u._id).points, 10);
});

test('typo -> 400 invalid_code and counts as a failed attempt', async () => {
  const s = createFakeStore();
  const u = s.addUser();
  const code = s.addCode();
  const typo = (code[0] === 'A' ? 'B' : 'A') + code.slice(1);
  await rejects(claim(s, u, typo), 'invalid_code', 400);
  assert.equal(s.users.get(u._id).failedClaims, 1);
  assert.equal(s.attempts.at(-1).outcome, 'invalid_format');
});

test('unknown (well-formed) code -> 404 code_not_found', async () => {
  const s = createFakeStore();
  const u = s.addUser();
  await rejects(claim(s, u, generateCode(SECRET)), 'code_not_found', 404);
});

test('voided and expired codes give 410 and no points', async () => {
  const s = createFakeStore();
  const u = s.addUser();
  const voided = s.addCode({ status: 'void' });
  const expired = s.addCode({ expiresAt: new Date(s.clock.t - 1000) });
  await rejects(claim(s, u, voided), 'code_void', 410);
  await rejects(claim(s, u, expired), 'code_expired', 410);
  assert.equal(s.users.get(u._id).points, 0);
});

test('5 failed attempts lock the account; even a valid code is refused while locked', async () => {
  const s = createFakeStore();
  const u = s.addUser();
  for (let i = 0; i < 4; i++) await rejects(claim(s, u, generateCode(SECRET)), 'code_not_found');
  await rejects(claim(s, u, generateCode(SECRET)), 'locked', 429); // 5th failure triggers the lock
  const good = s.addCode();
  await rejects(claim(s, u, good), 'locked', 429);
  assert.equal(s.users.get(u._id).points, 0);
  assert.equal(s.attempts.at(-1).outcome, 'locked');
});

test('lock expires after lockMinutes and the valid code then works', async () => {
  const s = createFakeStore();
  const u = s.addUser();
  for (let i = 0; i < 5; i++) await claim(s, u, generateCode(SECRET)).catch(() => {});
  const good = s.addCode({ points: 7 });
  await rejects(claim(s, u, good), 'locked');
  s.advance(16 * 60 * 1000);
  const res = await claim(s, u, good);
  assert.equal(res.points, 7);
});

test('failures older than the window do not accumulate toward a lock', async () => {
  const s = createFakeStore();
  const u = s.addUser();
  for (let i = 0; i < 4; i++) await claim(s, u, generateCode(SECRET)).catch(() => {});
  s.advance(20 * 60 * 1000);
  await rejects(claim(s, u, generateCode(SECRET)), 'code_not_found', 404); // counter restarted, no lock
  assert.equal(s.users.get(u._id).failedClaims, 1);
});

test('a successful claim resets the failure counter', async () => {
  const s = createFakeStore();
  const u = s.addUser();
  for (let i = 0; i < 3; i++) await claim(s, u, generateCode(SECRET)).catch(() => {});
  await claim(s, u, s.addCode());
  assert.equal(s.users.get(u._id).failedClaims, 0);
});

test('daily claim cap stops bulk claiming', async () => {
  const s = createFakeStore();
  const u = s.addUser();
  const cfg = { ...baseCfg, maxClaimsPerDay: 3 };
  for (let i = 0; i < 3; i++) await claim(s, u, s.addCode(), cfg);
  await rejects(claim(s, u, s.addCode(), cfg), 'daily_limit', 429);
  s.advance(25 * 60 * 60 * 1000);
  await claim(s, u, s.addCode(), cfg); // next day is fine
});

test('suspended users cannot claim', async () => {
  const s = createFakeStore();
  const u = s.addUser({ status: 'suspended' });
  await rejects(claim(s, u, s.addCode()), 'account_suspended', 403);
});

test('ROLLBACK: if crediting points fails, the code is released and no ledger row remains', async () => {
  const s = createFakeStore();
  const u = s.addUser();
  const code = s.addCode();
  s.failOn.add('creditPoints');
  await assert.rejects(claim(s, u, code), /injected failure/);
  assert.equal([...s.codes.values()][0].status, 'active'); // customer can retry
  assert.equal(s.ledger.length, 0);
  assert.equal(s.users.get(u._id).points, 0);
  const res = await claim(s, u, code); // and the retry works
  assert.equal(res.points, 10);
});

test('attempt log never stores the plaintext code', async () => {
  const s = createFakeStore();
  const u = s.addUser();
  const code = s.addCode();
  await claim(s, u, code);
  assert.ok(!JSON.stringify(s.attempts).includes(code.replace(/-/g, '')));
});

test('RACE: 10 wrong guesses fired in parallel still trip the lockout (counter must not lose updates)', async () => {
  const s = createFakeStore();
  const u = s.addUser();
  await Promise.allSettled(Array.from({ length: 10 }, () => claim(s, u, generateCode(SECRET))));
  const user = s.users.get(u._id);
  assert.ok(user.lockUntil && new Date(user.lockUntil) > s.deps.now(), 'account should be locked');
  await rejects(claim(s, u, s.addCode()), 'locked', 429);
});
