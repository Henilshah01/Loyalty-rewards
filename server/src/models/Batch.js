import mongoose from 'mongoose';

// One print run of codes. Voiding a batch kills every unclaimed code in it.
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    productName: { type: String, required: true, trim: true, maxlength: 80 },
    quantity: { type: Number, required: true, min: 1 },
    pointsPerCode: { type: Number, required: true, min: 1 },
    expiresAt: { type: Date, default: null },
    status: { type: String, enum: ['active', 'voided'], default: 'active' },
    voidedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const Batch = mongoose.model('Batch', schema);
