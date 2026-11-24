import mongoose from 'mongoose';

// One row per code-entry attempt, good or bad. Feeds the daily cap and the owner's security view.
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    ip: { type: String, default: '' },
    // success | invalid_format | not_found | void | expired | already_claimed | locked | daily_limit
    outcome: { type: String, required: true },
    codeHashPrefix: { type: String, default: '' }, // enough to correlate, useless to redeem
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

schema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // keep 90 days
schema.index({ ip: 1, createdAt: -1 });

export const ClaimAttempt = mongoose.model('ClaimAttempt', schema);
