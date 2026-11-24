import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    pointsCost: { type: Number, required: true, min: 1 },
    stock: { type: Number, default: null, min: 0 }, // null = unlimited
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Reward = mongoose.model('Reward', schema);
