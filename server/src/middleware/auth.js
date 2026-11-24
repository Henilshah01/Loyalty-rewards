import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';

export function requireAuth(cfg) {
  return asyncHandler(async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new AppError(401, 'unauthorized', 'Please sign in.');
    let payload;
    try {
      payload = jwt.verify(token, cfg.jwtSecret);
    } catch {
      throw new AppError(401, 'unauthorized', 'Session expired. Please sign in again.');
    }
    // Load fresh on every request so a suspended user is cut off immediately, not when the token expires.
    const user = await User.findById(payload.sub);
    if (!user) throw new AppError(401, 'unauthorized', 'Account not found.');
    if (user.status !== 'active') throw new AppError(403, 'account_suspended', 'Your account is suspended.');
    req.user = user;
    next();
  });
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return next(new AppError(403, 'forbidden', 'Admin access required.'));
  next();
}
