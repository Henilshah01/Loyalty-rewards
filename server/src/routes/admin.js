import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { User, Batch, Code, LedgerEntry, Reward, Redemption, ClaimAttempt } from '../models/index.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { createBatch, voidBatch } from '../services/batchService.js';
import { resolveRedemption } from '../services/redemptionService.js';
import { mongoDeps } from '../repo.js';

const DAY = 24 * 60 * 60 * 1000;

function checkId(id) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'bad_id', 'Invalid id.');
  return id;
}

const batchSchema = z.object({
  name: z.string().trim().min(1).max(80),
  productName: z.string().trim().min(1).max(80),
  quantity: z.coerce.number().int().min(1).max(10000),
  pointsPerCode: z.coerce.number().int().min(1).max(100000),
  expiresAt: z.string().optional().nullable().transform((v) => (v ? new Date(v) : null))
    .refine((d) => d === null || !Number.isNaN(d.getTime()), 'invalid date'),
});

const rewardSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).default(''),
  pointsCost: z.coerce.number().int().min(1),
  stock: z.coerce.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
});

export function adminRoutes(cfg) {
  const r = Router();
  const deps = mongoDeps();

  // ---------- dashboard ----------
  r.get('/stats', asyncHandler(async (req, res) => {
    const since14 = new Date(Date.now() - 14 * DAY);
    const since24 = new Date(Date.now() - DAY);
    const [codeAgg, customers, ledgerAgg, outstanding, pending, perDay, failed24h, top] = await Promise.all([
      Code.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      User.countDocuments({ role: 'customer' }),
      LedgerEntry.aggregate([{ $group: { _id: '$type', total: { $sum: '$points' } } }]),
      User.aggregate([{ $match: { role: 'customer' } }, { $group: { _id: null, total: { $sum: '$points' } } }]),
      Redemption.countDocuments({ status: 'pending' }),
      ClaimAttempt.aggregate([
        { $match: { outcome: 'success', createdAt: { $gte: since14 } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      ClaimAttempt.countDocuments({ outcome: { $nin: ['success'] }, createdAt: { $gte: since24 } }),
      User.find({ role: 'customer' }).sort({ lifetimePoints: -1 }).limit(5).select('name email lifetimePoints points').lean(),
    ]);
    const codes = { active: 0, claimed: 0, void: 0 };
    for (const c of codeAgg) codes[c._id] = c.n;
    const sum = (t) => ledgerAgg.find((l) => l._id === t)?.total || 0;
    res.json({
      customers,
      codes: { ...codes, total: codes.active + codes.claimed + codes.void },
      points: { issued: sum('earn'), redeemed: -(sum('redeem') + sum('refund')), outstanding: outstanding[0]?.total || 0 },
      pendingRedemptions: pending,
      failedAttempts24h: failed24h,
      claimsPerDay: perDay.map((d) => ({ date: d._id, count: d.n })),
      topCustomers: top,
    });
  }));

  // ---------- batches ----------
  r.get('/batches', asyncHandler(async (req, res) => {
    const batches = await Batch.find().sort({ createdAt: -1 }).limit(100).lean();
    const counts = await Code.aggregate([{ $group: { _id: { b: '$batch', s: '$status' }, n: { $sum: 1 } } }]);
    const byBatch = {};
    for (const c of counts) (byBatch[c._id.b] ||= {})[c._id.s] = c.n;
    res.json({
      batches: batches.map((b) => ({
        ...b,
        claimed: byBatch[b._id]?.claimed || 0,
        active: byBatch[b._id]?.active || 0,
        void: byBatch[b._id]?.void || 0,
      })),
    });
  }));

  r.post('/batches', asyncHandler(async (req, res) => {
    const input = batchSchema.parse(req.body);
    const { batch, codes } = await createBatch({ ...input, adminId: req.user.id }, cfg.codeSecret);
    // Plaintext codes are returned ONCE, here. They are not recoverable afterwards.
    res.status(201).json({ batch, codes });
  }));

  r.post('/batches/:id/void', asyncHandler(async (req, res) => {
    const out = await voidBatch(checkId(req.params.id));
    if (!out) throw new AppError(409, 'cannot_void', 'Batch not found or already voided.');
    res.json(out);
  }));

  // ---------- rewards catalogue ----------
  r.get('/rewards', asyncHandler(async (req, res) => {
    res.json({ rewards: await Reward.find().sort({ createdAt: -1 }).lean() });
  }));

  r.post('/rewards', asyncHandler(async (req, res) => {
    const data = rewardSchema.parse(req.body);
    const reward = await Reward.create({ ...data, stock: data.stock ?? null });
    res.status(201).json({ reward });
  }));

  r.patch('/rewards/:id', asyncHandler(async (req, res) => {
    const data = rewardSchema.partial().parse(req.body);
    const reward = await Reward.findByIdAndUpdate(checkId(req.params.id), { $set: data }, { new: true });
    if (!reward) throw new AppError(404, 'not_found', 'Reward not found.');
    res.json({ reward });
  }));

  // ---------- redemptions queue ----------
  r.get('/redemptions', asyncHandler(async (req, res) => {
    const status = z.enum(['pending', 'fulfilled', 'rejected']).optional().parse(req.query.status);
    const items = await Redemption.find(status ? { status } : {}).sort({ createdAt: -1 }).limit(100)
      .populate('user', 'name email').lean();
    res.json({ items });
  }));

  r.post('/redemptions/:id/resolve', asyncHandler(async (req, res) => {
    const { action, note } = z.object({
      action: z.enum(['fulfil', 'reject']),
      note: z.string().trim().max(300).optional(),
    }).parse(req.body);
    const redemption = await resolveRedemption(
      { redemptionId: checkId(req.params.id), action, note, adminId: req.user.id }, deps,
    );
    res.json({ redemption });
  }));

  // ---------- customers ----------
  r.get('/users', asyncHandler(async (req, res) => {
    const users = await User.find({ role: 'customer' }).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ users });
  }));

  r.patch('/users/:id/status', asyncHandler(async (req, res) => {
    const { status } = z.object({ status: z.enum(['active', 'suspended']) }).parse(req.body);
    const user = await User.findOneAndUpdate(
      { _id: checkId(req.params.id), role: 'customer' }, // admins cannot be suspended through this route
      { $set: { status, ...(status === 'active' ? { lockUntil: null, failedClaims: 0 } : {}) } },
      { new: true },
    ).lean();
    if (!user) throw new AppError(404, 'not_found', 'Customer not found.');
    res.json({ user });
  }));

  // ---------- security monitoring ----------
  r.get('/security', asyncHandler(async (req, res) => {
    const since = new Date(Date.now() - DAY);
    const [byUser, byIp, recent] = await Promise.all([
      ClaimAttempt.aggregate([
        { $match: { createdAt: { $gte: since }, outcome: { $ne: 'success' } } },
        { $group: { _id: '$user', failures: { $sum: 1 }, lastAt: { $max: '$createdAt' } } },
        { $match: { failures: { $gte: cfg.maxFailedClaims } } },
        { $sort: { failures: -1 } },
        { $limit: 50 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
        { $unwind: '$u' },
        { $project: { failures: 1, lastAt: 1, name: '$u.name', email: '$u.email', status: '$u.status' } },
      ]),
      ClaimAttempt.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$ip', users: { $addToSet: '$user' }, attempts: { $sum: 1 } } },
        { $project: { attempts: 1, userCount: { $size: '$users' } } },
        { $match: { userCount: { $gte: 3 } } },
        { $sort: { userCount: -1 } },
        { $limit: 50 },
      ]),
      ClaimAttempt.find({ outcome: { $ne: 'success' } }).sort({ createdAt: -1 }).limit(50)
        .populate('user', 'name email').lean(),
    ]);
    res.json({ repeatFailures: byUser, sharedIps: byIp, recentFailures: recent });
  }));

  return r;
}
