import mongoose from 'mongoose';

// The plaintext code is NEVER stored - only its keyed hash. The unique index on codeHash is what
// guarantees no two boxes share a code.
const schema = new mongoose.Schema(
  {
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    codeHash: { type: String, required: true, unique: true },
    points: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['active', 'claimed', 'void'], default: 'active' },
    expiresAt: { type: Date, default: null },
    claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    claimedAt: { type: Date },
    claimedIp: { type: String },
  },
  { timestamps: true },
);

export const Code = mongoose.model('Code', schema);
