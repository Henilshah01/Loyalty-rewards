import { User, Code, LedgerEntry, Reward, Redemption, ClaimAttempt } from './models/index.js';

/**
 * MongoDB implementation of the `deps` interface used by claimService and redemptionService.
 * Every "atomic" method is a single findOneAndUpdate with the guard condition inside the filter.
 */
export function mongoDeps() {
  return {
    now: () => new Date(),

    // ---------- users ----------
    getUser: (id) => User.findById(id).lean(),
    setFailureState: (id, { failedClaims, lastFailedAt, lockUntil }) =>
      User.updateOne({ _id: id }, { $set: { failedClaims, lastFailedAt, lockUntil } }),
    // Atomic failure counting: $inc cannot lose updates when many guesses arrive in parallel.
    registerFailure: async (id, { now, windowMs, max }) => {
      const staleBefore = new Date(now.getTime() - windowMs);
      // 1. Forget old failures (only matches if the last failure is outside the window).
      await User.updateOne({ _id: id, lastFailedAt: { $lt: staleBefore } }, { $set: { failedClaims: 0 } });
      // 2. Count this one atomically.
      const u = await User.findOneAndUpdate(
        { _id: id },
        { $inc: { failedClaims: 1 }, $set: { lastFailedAt: now } },
        { new: true },
      ).lean();
      if (u.failedClaims < max) return { locked: false };
      // 3. Threshold reached: lock (idempotent if several parallel requests get here).
      await User.updateOne(
        { _id: id },
        { $set: { lockUntil: new Date(now.getTime() + windowMs), failedClaims: 0 } },
      );
      return { locked: true };
    },
    creditPoints: async (id, points) => {
      const u = await User.findByIdAndUpdate(id, { $inc: { points, lifetimePoints: points } }, { new: true });
      return u.points;
    },
    // Succeeds only if the balance covers the cost, so it can never go negative.
    debitPoints: (id, cost) =>
      User.findOneAndUpdate(
        { _id: id, status: 'active', points: { $gte: cost } },
        { $inc: { points: -cost } },
        { new: true },
      ).lean(),
    refundPoints: (id, cost) => User.updateOne({ _id: id }, { $inc: { points: cost } }),

    // ---------- codes ----------
    claimCodeAtomic: async ({ codeHash, userId, ip, now }) => {
      const doc = await Code.findOneAndUpdate(
        {
          codeHash,
          status: 'active',
          $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
        },
        { $set: { status: 'claimed', claimedBy: userId, claimedAt: now, claimedIp: ip } },
        { new: true },
      );
      return doc ? { _id: doc._id, points: doc.points } : null;
    },
    diagnoseCode: async (codeHash, now) => {
      const c = await Code.findOne({ codeHash }).select('status expiresAt').lean();
      if (!c) return 'not_found';
      if (c.status === 'void') return 'void';
      if (c.status === 'active' && c.expiresAt && c.expiresAt <= now) return 'expired';
      return 'claimed';
    },
    releaseCode: (id) =>
      Code.updateOne(
        { _id: id, status: 'claimed' },
        { $set: { status: 'active' }, $unset: { claimedBy: 1, claimedAt: 1, claimedIp: 1 } },
      ),

    // ---------- ledger / audit ----------
    addEarnLedger: ({ userId, codeId, points, now }) =>
      LedgerEntry.create({ user: userId, type: 'earn', points, code: codeId, note: 'Code claimed', createdAt: now }),
    removeEarnLedger: (codeId) => LedgerEntry.deleteOne({ code: codeId }),
    addLedger: ({ userId, type, points, redemptionId, note, now }) =>
      LedgerEntry.create({ user: userId, type, points, redemption: redemptionId, note, createdAt: now }),
    logAttempt: ({ userId, ip, outcome, codeHash, now }) =>
      ClaimAttempt.create({
        user: userId, ip, outcome, codeHashPrefix: codeHash ? codeHash.slice(0, 12) : '', createdAt: now,
      }),
    countClaimsSince: (userId, since) =>
      ClaimAttempt.countDocuments({ user: userId, outcome: 'success', createdAt: { $gte: since } }),

    // ---------- rewards / redemptions ----------
    getReward: (id) => Reward.findById(id).lean(),
    takeStock: async (id) => !!(await Reward.findOneAndUpdate({ _id: id, stock: { $gt: 0 } }, { $inc: { stock: -1 } })),
    returnStock: (id) => Reward.updateOne({ _id: id, stock: { $ne: null } }, { $inc: { stock: 1 } }),
    createRedemption: async ({ userId, rewardId, rewardName, pointsCost, deliveryNote }) => {
      const r = await Redemption.create({ user: userId, reward: rewardId, rewardName, pointsCost, deliveryNote });
      return r.toObject();
    },
    deleteRedemption: (id) => Redemption.deleteOne({ _id: id }),
    resolveRedemptionAtomic: ({ redemptionId, status, note, adminId, now }) =>
      Redemption.findOneAndUpdate(
        { _id: redemptionId, status: 'pending' },
        { $set: { status, adminNote: note || '', resolvedBy: adminId, resolvedAt: now } },
        { new: true },
      ).lean(),
  };
}
