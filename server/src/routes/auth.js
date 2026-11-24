import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/index.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { rateLimit } from '../lib/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';

// Compared against when the email is unknown so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(8).max(100),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(100) });

export function authRoutes(cfg) {
  const r = Router();
  const limiter = rateLimit({ windowMs: 60_000, max: 10 });
  const sign = (u) => jwt.sign({ sub: u.id }, cfg.jwtSecret, { expiresIn: cfg.jwtExpires });
  const view = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, points: u.points });

  r.post('/register', limiter, asyncHandler(async (req, res) => {
    const { name, email, password } = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(password, 10);
    // role is never taken from the request body: public sign-up always creates a customer.
    const user = await User.create({ name, email, passwordHash, role: 'customer' });
    res.status(201).json({ token: sign(user), user: view(user) });
  }));

  r.post('/login', limiter, asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await User.findOne({ email }).select('+passwordHash');
    const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
    if (!user || !ok) throw new AppError(401, 'bad_credentials', 'Incorrect email or password.');
    if (user.status !== 'active') throw new AppError(403, 'account_suspended', 'Your account is suspended.');
    res.json({ token: sign(user), user: view(user) });
  }));

  r.get('/me', requireAuth(cfg), (req, res) => res.json({ user: view(req.user) }));

  return r;
}
