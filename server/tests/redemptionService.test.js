import test from 'node:test';
import assert from 'node:assert/strict';
import { redeemReward, resolveRedemption } from '../src/services/redemptionService.js';
import { createFakeStore } from './helpers/fakeStore.js';

const redeem = (s, user, reward) => redeemReward({ userId: user._id, rewardId: reward._id, deliveryNote: 'hi' }, s.deps);
const resolve = (s, redemptionId, action) => resolveRedemption({ redemptionId, action, note: 'n', adminId: 'admin1' }, s.deps);
const rejects = (p, code, status) => assert.rejects(p, (e) => e.code === code && (status === undefined || e.status === status));

test('redeeming debits points, takes stock, creates a pending request and a ledger row', async () => {
  const s = createFakeStore();
  const u = s.addUser({ points: 120 });
  const r = s.addReward({ pointsCost: 100, stock: 3 });
  const out = await redeem(s, u, r);
  assert.equal(out.balance, 20);
  assert.equal(out.redemption.status, 'pending');
  assert.equal(s.rewards.get(r._id).stock, 2);
  assert.deepEqual(s.ledger.map((l) => [l.type, l.points]), [['redeem', -100]]);
});

test('not enough points -> 400 and nothing changes', async () => {
  const s = createFakeStore();
  const u = s.addUser({ points: 99 });
  const r = s.addReward({ pointsCost: 100, stock: 3 });
  await rejects(redeem(s, u, r), 'insufficient_points', 400);
  assert.equal(s.users.get(u._id).points, 99);
  assert.equal(s.rewards.get(r._id).stock, 3);
  assert.equal(s.redemptions.size, 0);
});

test('inactive or unknown reward -> 404', async () => {
  const s = createFakeStore();
  const u = s.addUser({ points: 500 });
  await rejects(redeem(s, u, s.addReward({ active: false })), 'reward_not_found', 404);
  await rejects(redeemReward({ userId: u._id, rewardId: 'nope', deliveryNote: '' }, s.deps), 'reward_not_found', 404);
});

test('out of stock -> 409 and the points are given back', async () => {
  const s = createFakeStore();
  const u = s.addUser({ points: 100 });
  const r = s.addReward({ pointsCost: 100, stock: 0 });
  await rejects(redeem(s, u, r), 'out_of_stock', 409);
  assert.equal(s.users.get(u._id).points, 100);
  assert.equal(s.ledger.length, 0);
});

test('null stock means unlimited', async () => {
  const s = createFakeStore();
  const u = s.addUser({ points: 300 });
  const r = s.addReward({ pointsCost: 100, stock: null });
  await redeem(s, u, r);
  await redeem(s, u, r);
  assert.equal(s.users.get(u._id).points, 100);
});

test('RACE: one customer fires 6 redemptions with only enough points for one -> balance never negative', async () => {
  const s = createFakeStore();
  const u = s.addUser({ points: 100 });
  const r = s.addReward({ pointsCost: 100, stock: null });
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => redeem(s, u, r)));
  assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(s.users.get(u._id).points, 0);
  assert.equal(s.redemptions.size, 1);
});

test('RACE: two customers compete for the last item -> one wins, loser keeps their points', async () => {
  const s = createFakeStore();
  const a = s.addUser({ points: 100 });
  const b = s.addUser({ points: 100 });
  const r = s.addReward({ pointsCost: 100, stock: 1 });
  const results = await Promise.allSettled([redeem(s, a, r), redeem(s, b, r)]);
  assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(s.rewards.get(r._id).stock, 0);
  assert.equal(s.users.get(a._id).points + s.users.get(b._id).points, 100);
});

test('ROLLBACK: failure while recording the ledger refunds points, restores stock, removes the request', async () => {
  const s = createFakeStore();
  const u = s.addUser({ points: 100 });
  const r = s.addReward({ pointsCost: 100, stock: 2 });
  const orig = s.deps.addLedger;
  s.deps.addLedger = async () => { throw new Error('db down'); };
  await assert.rejects(redeem(s, u, r), /db down/);
  s.deps.addLedger = orig;
  assert.equal(s.users.get(u._id).points, 100);
  assert.equal(s.rewards.get(r._id).stock, 2);
  assert.equal(s.redemptions.size, 0);
});

test('suspended customers cannot redeem', async () => {
  const s = createFakeStore();
  const u = s.addUser({ points: 500, status: 'suspended' });
  await rejects(redeem(s, u, s.addReward()), 'account_suspended', 403);
});

test('fulfil keeps the points spent', async () => {
  const s = createFakeStore();
  const u = s.addUser({ points: 100 });
  const r = s.addReward({ pointsCost: 100, stock: 1 });
  const { redemption } = await redeem(s, u, r);
  const done = await resolve(s, redemption._id, 'fulfil');
  assert.equal(done.status, 'fulfilled');
  assert.equal(s.users.get(u._id).points, 0);
  assert.equal(s.rewards.get(r._id).stock, 0);
});

test('reject refunds the points, restocks and writes a refund ledger row', async () => {
  const s = createFakeStore();
  const u = s.addUser({ points: 100 });
  const r = s.addReward({ pointsCost: 100, stock: 1 });
  const { redemption } = await redeem(s, u, r);
  await resolve(s, redemption._id, 'reject');
  assert.equal(s.users.get(u._id).points, 100);
  assert.equal(s.rewards.get(r._id).stock, 1);
  assert.deepEqual(s.ledger.map((l) => l.type), ['redeem', 'refund']);
  assert.equal(s.ledger.reduce((n, l) => n + l.points, 0), 0); // ledger nets to zero
});

test('RACE: resolving the same request twice (e.g. two admin tabs) refunds only once', async () => {
  const s = createFakeStore();
  const u = s.addUser({ points: 100 });
  const r = s.addReward({ pointsCost: 100, stock: 1 });
  const { redemption } = await redeem(s, u, r);
  const results = await Promise.allSettled([resolve(s, redemption._id, 'reject'), resolve(s, redemption._id, 'reject')]);
  assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(s.users.get(u._id).points, 100);
  await rejects(resolve(s, redemption._id, 'fulfil'), 'already_resolved', 409);
});
