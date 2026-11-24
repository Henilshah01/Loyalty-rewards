import { AppError } from '../lib/errors.js';
import { isWellFormed, hashCode } from '../lib/codes.js';

/**
 * Claim a box code. All persistence goes through `deps` so the business rules can be unit-tested
 * with an in-memory store (tests/helpers/fakeStore.js) and run on MongoDB in production (src/repo.js).
 *
 * The single-use guarantee comes from deps.claimCodeAtomic: ONE conditional update
 * ("set claimed WHERE status = active AND not expired"). Two simultaneous requests for the same code
 * cannot both succeed, because the database applies the condition and the write as one operation.
 */
export async function claimCode({ userId, rawCode, ip }, deps, cfg) {
  const now = deps.now();
  const user = await deps.getUser(userId);
  if (!user) throw new AppError(401, 'unauthorized', 'Account not found.');
  if (user.status !== 'active') {
    throw new AppError(403, 'account_suspended', 'Your account is suspended. Please contact support.');
  }

  if (user.lockUntil && new Date(user.lockUntil) > now) {
    await deps.logAttempt({ userId, ip, outcome: 'locked', now });
    const mins = Math.ceil((new Date(user.lockUntil) - now) / 60000);
    throw new AppError(429, 'locked', `Too many failed attempts. Try again in ${mins} minute(s).`);
  }

  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if ((await deps.countClaimsSince(userId, since)) >= cfg.maxClaimsPerDay) {
    await deps.logAttempt({ userId, ip, outcome: 'daily_limit', now });
    throw new AppError(429, 'daily_limit', 'Daily claim limit reached. Please try again tomorrow.');
  }

  const windowMs = cfg.lockMinutes * 60 * 1000;
  // Every failed attempt (typo, unknown code, reused code...) counts toward a temporary lock.
  // The counter is bumped by deps.registerFailure, an ATOMIC increment: computing "old count + 1"
  // here from the snapshot above would let parallel guesses overwrite each other and never lock.
  const fail = async (outcome, status, code, message, codeHash) => {
    const { locked } = await deps.registerFailure(userId, { now, windowMs, max: cfg.maxFailedClaims });
    await deps.logAttempt({ userId, ip, outcome, codeHash, now });
    if (locked) {
      throw new AppError(429, 'locked', `Too many failed attempts. Locked for ${cfg.lockMinutes} minutes.`);
    }
    throw new AppError(status, code, message);
  };

  if (!isWellFormed(rawCode, cfg.codeSecret)) {
    return fail('invalid_format', 400, 'invalid_code', 'That code does not look right. Check for typos and try again.');
  }

  const codeHash = hashCode(rawCode, cfg.codeSecret);
  const claimed = await deps.claimCodeAtomic({ codeHash, userId, ip, now });

  if (!claimed) {
    const state = await deps.diagnoseCode(codeHash, now);
    if (state === 'not_found') return fail('not_found', 404, 'code_not_found', "We couldn't find that code.", codeHash);
    if (state === 'void') return fail('void', 410, 'code_void', 'This code is no longer valid.', codeHash);
    if (state === 'expired') return fail('expired', 410, 'code_expired', 'This code has expired.', codeHash);
    return fail('already_claimed', 409, 'already_claimed', 'This code has already been used.', codeHash);
  }

  let balance;
  try {
    await deps.addEarnLedger({ userId, codeId: claimed._id, points: claimed.points, now });
    balance = await deps.creditPoints(userId, claimed.points);
  } catch (err) {
    // Undo so the customer is not left with a burned code and no points.
    await deps.removeEarnLedger(claimed._id).catch(() => {});
    await deps.releaseCode(claimed._id).catch(() => {});
    throw err;
  }

  await deps.setFailureState(userId, { failedClaims: 0, lastFailedAt: null, lockUntil: null });
  await deps.logAttempt({ userId, ip, outcome: 'success', codeHash, now });
  return { points: claimed.points, balance };
}
