import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { loadConfig } from '../config.js';
import { User, Reward, Batch } from '../models/index.js';
import { createBatch } from '../services/batchService.js';

// Creates the factory-owner admin, a starter rewards catalogue and one demo batch (codes printed to the console).
const cfg = loadConfig();
const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
if (!email || password.length < 8) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars) in server/.env');
  process.exit(1);
}

await mongoose.connect(cfg.mongoUri);

let admin = await User.findOne({ email });
if (!admin) {
  admin = await User.create({
    name: 'Factory Owner', email, passwordHash: await bcrypt.hash(password, 10), role: 'admin',
  });
  console.log(`Created admin ${email}`);
} else {
  console.log(`Admin ${email} already exists`);
}

if ((await Reward.countDocuments()) === 0) {
  await Reward.insertMany([
    { name: 'Branded tote bag', description: 'Cotton tote with our logo', pointsCost: 100, stock: 50 },
    { name: '10% off next order', description: 'Voucher sent by email', pointsCost: 200, stock: null },
    { name: 'Factory tour for two', description: 'Guided visit, booked by our team', pointsCost: 1000, stock: 5 },
  ]);
  console.log('Created 3 sample rewards');
}

if ((await Batch.countDocuments()) === 0) {
  const { codes } = await createBatch(
    { name: 'Demo batch', productName: 'Demo product', quantity: 10, pointsPerCode: 25, expiresAt: null, adminId: admin.id },
    cfg.codeSecret,
  );
  console.log('\nDemo codes (shown once - they are stored hashed):');
  codes.forEach((c) => console.log('  ' + c));
}

await mongoose.disconnect();
