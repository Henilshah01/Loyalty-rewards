import { Router } from 'express';
import { z } from 'zod';
import { Reward, LedgerEntry, Redemption } from '../models/index.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { rateLimit } from '../lib/rateLimit.js';
import { claimCode } from '../services/claimService.js';
import { redeemReward } from '../services/redemptionService.js';
import { mongoDeps } from '../repo.js';

export function customerRoutes(cfg, auth) {
  const r = Router();
  const deps = mongoDeps();
  const claimLimiter = rateLimit({ windowMs: 60_000, max: 20 });

  r.post('/claims', auth, claimLimiter, asyncHandler(async (req, res) => {
    const { code } = z.object({ code: z.string().min(1).max(40) }).parse(req.body);
    const result = await claimCode({ userId: req.user.id, rawCode: code, ip: req.ip }, deps, cfg);
    res.json(result);
  }));

  r.get('/me/ledger', auth, asyncHandler(async (req, res) => {
    const entries = await LedgerEntry.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50)
      .select('type points note createdAt').lean();
    res.json({ entries });
  }));

  r.get('/me/redemptions', auth, asyncHandler(async (req, res) => {
    const items = await Redemption.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ items });
  }));

  r.get('/rewards', auth, asyncHandler(async (req, res) => {
    const rewards = await Reward.find({ active: true }).sort({ pointsCost: 1 }).lean();
    res.json({ rewards });
  }));

  r.post('/rewards/:id/redeem', auth, asyncHandler(async (req, res) => {
    const { deliveryNote } = z.object({ deliveryNote: z.string().trim().max(300).default('') }).parse(req.body ?? {});
    const out = await redeemReward({ userId: req.user.id, rewardId: req.params.id, deliveryNote }, deps);
    res.status(201).json({ redemption: out.redemption, balance: out.balance });
  }));

  return r;
}
