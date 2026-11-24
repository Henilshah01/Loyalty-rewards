import { AppError } from '../lib/errors.js';

/**
 * Spend points on a reward.
 * Points are debited with an atomic conditional update (points >= cost), so concurrent requests
 * can never push a balance below zero. Limited stock is taken the same way. If any later step
 * fails, earlier steps are compensated.
 */
export async function redeemReward({ userId, rewardId, deliveryNote }, deps) {
  const now = deps.now();
  const user = await deps.getUser(userId);
  if (!user) throw new AppError(401, 'unauthorized', 'Account not found.');
  if (user.status !== 'active') throw new AppError(403, 'account_suspended', 'Your account is suspended.');

  const reward = await deps.getReward(rewardId);
  if (!reward || !reward.active) throw new AppError(404, 'reward_not_found', 'Reward not available.');

  const cost = reward.pointsCost;
  const debited = await deps.debitPoints(userId, cost);
  if (!debited) throw new AppError(400, 'insufficient_points', 'Not enough points for this reward.');

  let stockTaken = false;
  let redemption = null;
  try {
    if (reward.stock !== null && reward.stock !== undefined) {
      if (!(await deps.takeStock(rewardId))) {
        throw new AppError(409, 'out_of_stock', 'This reward is out of stock.');
      }
      stockTaken = true;
    }
    redemption = await deps.createRedemption({
      userId, rewardId, rewardName: reward.name, pointsCost: cost, deliveryNote, now,
    });
    await deps.addLedger({
      userId, type: 'redeem', points: -cost, redemptionId: redemption._id, note: reward.name, now,
    });
    return { redemption, balance: debited.points };
  } catch (err) {
    await deps.refundPoints(userId, cost).catch(() => {});
    if (stockTaken) await deps.returnStock(rewardId).catch(() => {});
    if (redemption) await deps.deleteRedemption(redemption._id).catch(() => {});
    throw err;
  }
}

/** Admin decision on a pending redemption. Rejecting refunds the points (and restocks). */
export async function resolveRedemption({ redemptionId, action, note, adminId }, deps) {
  const status = action === 'fulfil' ? 'fulfilled' : 'rejected';
  const now = deps.now();
  const redemption = await deps.resolveRedemptionAtomic({ redemptionId, status, note, adminId, now });
  if (!redemption) {
    throw new AppError(409, 'already_resolved', 'This redemption is not pending (already handled or not found).');
  }
  if (status === 'rejected') {
    await deps.refundPoints(redemption.user, redemption.pointsCost);
    await deps.addLedger({
      userId: redemption.user, type: 'refund', points: redemption.pointsCost,
      redemptionId: redemption._id, note: `Refund: ${redemption.rewardName}`, now,
    });
    await deps.returnStock(redemption.reward);
  }
  return redemption;
}
