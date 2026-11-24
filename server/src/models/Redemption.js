import mongoose from 'mongoose';

// A customer's request to exchange points for a reward. The owner fulfils or rejects it.
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reward: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward', required: true },
    rewardName: { type: String, required: true }, // snapshots, so later catalogue edits don't rewrite history
    pointsCost: { type: Number, required: true },
    deliveryNote: { type: String, default: '', maxlength: 300 },
    status: { type: String, enum: ['pending', 'fulfilled', 'rejected'], default: 'pending', index: true },
    adminNote: { type: String, default: '' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

export const Redemption = mongoose.model('Redemption', schema);
