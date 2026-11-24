import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    points: { type: Number, default: 0, min: 0 }, // spendable balance (ledger is the audit trail)
    lifetimePoints: { type: Number, default: 0, min: 0 }, // total ever earned, for "top customers"
    // Brute-force protection state (see claimService)
    failedClaims: { type: Number, default: 0 },
    lastFailedAt: { type: Date, default: null },
    lockUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

export const User = mongoose.model('User', schema);
