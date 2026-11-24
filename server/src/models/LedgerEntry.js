import mongoose from 'mongoose';

// Append-only points history. `points` is signed: earn > 0, redeem < 0, refund > 0.
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['earn', 'redeem', 'refund'], required: true },
    points: { type: Number, required: true },
    // unique + sparse: a code can produce at most ONE earn entry, a second line of defence
    // behind the atomic status flip on Code. Entries without a code (redeem/refund) are ignored.
    code: { type: mongoose.Schema.Types.ObjectId, ref: 'Code', unique: true, sparse: true },
    redemption: { type: mongoose.Schema.Types.ObjectId, ref: 'Redemption' },
    note: { type: String, default: '' },
  },
  { timestamps: true },
);

export const LedgerEntry = mongoose.model('LedgerEntry', schema);
