import { generateCode, hashCode } from '../../src/lib/codes.js';

export const SECRET = 'test-secret-test-secret-test-secret-1234';

export const baseCfg = {
  codeSecret: SECRET,
  maxFailedClaims: 5,
  lockMinutes: 15,
  maxClaimsPerDay: 20,
};

/**
 * In-memory implementation of the `deps` interface (same contract as src/repo.js).
 * Each "atomic" method is synchronous inside, mirroring a single MongoDB findOneAndUpdate, so
 * tests that fire many concurrent calls exercise the real interleaving of the service logic.
 * What this can NOT prove is MongoDB itself - see docs/TEST_PLAN.md for the DB-level checks.
 */
export function createFakeStore() {
  let seq = 0;
  const id = (p) => `${p}${++seq}`;
  const clock = { t: Date.parse('2026-01-01T12:00:00Z') };
  const s = {
    clock,
    users: new Map(),
    codes: new Map(), // by hash
    ledger: [],
    attempts: [],
    rewards: new Map(),
    redemptions: new Map(),
    failOn: new Set(), // method names that should throw once, to test rollback paths
  };
  const maybeFail = (name) => {
    if (s.failOn.has(name)) {
      s.failOn.delete(name);
      throw new Error(`injected failure in ${name}`);
    }
  };
  const copy = (o) => (o ? { ...o } : o);

  // ---------- test helpers ----------
  s.advance = (ms) => { clock.t += ms; };
  s.addUser = (over = {}) => {
    const u = {
      _id: id('u'), status: 'active', points: 0, lifetimePoints: 0,
      failedClaims: 0, lastFailedAt: null, lockUntil: null, ...over,
    };
    s.users.set(u._id, u);
    return u;
  };
  s.addCode = ({ points = 10, status = 'active', expiresAt = null } = {}) => {
    const plain = generateCode(SECRET);
    s.codes.set(hashCode(plain, SECRET), { _id: id('c'), points, status, expiresAt });
    return plain;
  };
  s.addReward = (over = {}) => {
    const r = { _id: id('r'), name: 'Mug', pointsCost: 50, stock: null, active: true, ...over };
    s.rewards.set(r._id, r);
    return r;
  };

  // ---------- deps ----------
  s.deps = {
    now: () => new Date(clock.t),

    getUser: async (uid) => copy(s.users.get(uid)),
    setFailureState: async (uid, st) => { Object.assign(s.users.get(uid), st); },
    // Synchronous body = atomic, like the $inc-based version in repo.js.
    registerFailure: async (uid, { now, windowMs, max }) => {
      const u = s.users.get(uid);
      if (u.lastFailedAt && now - new Date(u.lastFailedAt) > windowMs) u.failedClaims = 0;
      u.failedClaims += 1;
      u.lastFailedAt = now;
      if (u.failedClaims < max) return { locked: false };
      u.failedClaims = 0;
      u.lockUntil = new Date(now.getTime() + windowMs);
      return { locked: true };
    },
    creditPoints: async (uid, pts) => {
      maybeFail('creditPoints');
      const u = s.users.get(uid);
      u.points += pts;
      u.lifetimePoints += pts;
      return u.points;
    },
    debitPoints: async (uid, cost) => {
      const u = s.users.get(uid);
      if (!u || u.status !== 'active' || u.points < cost) return null;
      u.points -= cost;
      return copy(u);
    },
    refundPoints: async (uid, cost) => { s.users.get(uid).points += cost; },

    claimCodeAtomic: async ({ codeHash, userId, now }) => {
      const c = s.codes.get(codeHash);
      if (!c || c.status !== 'active' || (c.expiresAt && c.expiresAt <= now)) return null;
      c.status = 'claimed';
      c.claimedBy = userId;
      return { _id: c._id, points: c.points };
    },
    diagnoseCode: async (codeHash, now) => {
      const c = s.codes.get(codeHash);
      if (!c) return 'not_found';
      if (c.status === 'void') return 'void';
      if (c.status === 'active' && c.expiresAt && c.expiresAt <= now) return 'expired';
      return 'claimed';
    },
    releaseCode: async (cid) => {
      for (const c of s.codes.values()) if (c._id === cid && c.status === 'claimed') { c.status = 'active'; delete c.claimedBy; }
    },

    addEarnLedger: async ({ userId, codeId, points }) => {
      if (s.ledger.some((l) => l.type === 'earn' && l.code === codeId)) throw new Error('duplicate earn entry');
      s.ledger.push({ user: userId, type: 'earn', points, code: codeId });
    },
    removeEarnLedger: async (codeId) => {
      s.ledger = s.ledger.filter((l) => !(l.type === 'earn' && l.code === codeId));
    },
    addLedger: async ({ userId, type, points, redemptionId }) => {
      s.ledger.push({ user: userId, type, points, redemption: redemptionId });
    },
    logAttempt: async ({ userId, outcome, now }) => { s.attempts.push({ user: userId, outcome, at: now.getTime() }); },
    countClaimsSince: async (uid, since) =>
      s.attempts.filter((a) => a.user === uid && a.outcome === 'success' && a.at >= since.getTime()).length,

    getReward: async (rid) => copy(s.rewards.get(rid)),
    takeStock: async (rid) => {
      const r = s.rewards.get(rid);
      if (!r || !(r.stock > 0)) return false;
      r.stock -= 1;
      return true;
    },
    returnStock: async (rid) => {
      const r = s.rewards.get(rid);
      if (r && r.stock !== null) r.stock += 1;
    },
    createRedemption: async ({ userId, rewardId, rewardName, pointsCost, deliveryNote }) => {
      const r = { _id: id('red'), user: userId, reward: rewardId, rewardName, pointsCost, deliveryNote, status: 'pending' };
      s.redemptions.set(r._id, r);
      return copy(r);
    },
    deleteRedemption: async (rid) => { s.redemptions.delete(rid); },
    resolveRedemptionAtomic: async ({ redemptionId, status, note, adminId }) => {
      const r = s.redemptions.get(redemptionId);
      if (!r || r.status !== 'pending') return null;
      Object.assign(r, { status, adminNote: note || '', resolvedBy: adminId });
      return copy(r);
    },
  };
  return s;
}
