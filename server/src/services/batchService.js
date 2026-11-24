import { Batch, Code } from '../models/index.js';
import { generateCode, hashCode } from '../lib/codes.js';

const CHUNK = 1000;

/**
 * Creates a batch and its codes. Returns the PLAINTEXT codes exactly once (for the printer);
 * only their hashes are persisted. If anything fails midway the batch is rolled back.
 */
export async function createBatch({ name, productName, quantity, pointsPerCode, expiresAt, adminId }, codeSecret) {
  const batch = await Batch.create({
    name, productName, quantity, pointsPerCode, expiresAt: expiresAt || null, createdBy: adminId,
  });
  const codes = [];
  try {
    while (codes.length < quantity) {
      const need = Math.min(CHUNK, quantity - codes.length);
      const fresh = new Map(); // hash -> plaintext (also de-duplicates inside the chunk)
      while (fresh.size < need) {
        const code = generateCode(codeSecret);
        fresh.set(hashCode(code, codeSecret), code);
      }
      const docs = [...fresh.keys()].map((codeHash) => ({
        batch: batch._id, codeHash, points: pointsPerCode, expiresAt: expiresAt || null,
      }));
      await Code.insertMany(docs, { ordered: true });
      codes.push(...fresh.values());
    }
  } catch (err) {
    await Code.deleteMany({ batch: batch._id });
    await Batch.deleteOne({ _id: batch._id });
    throw err;
  }
  return { batch, codes };
}

/** Voids every unclaimed code in a batch (e.g. a misprint or a stolen pallet). Claimed codes stay claimed. */
export async function voidBatch(batchId) {
  const batch = await Batch.findOneAndUpdate(
    { _id: batchId, status: 'active' },
    { $set: { status: 'voided', voidedAt: new Date() } },
    { new: true },
  );
  if (!batch) return null;
  const res = await Code.updateMany({ batch: batchId, status: 'active' }, { $set: { status: 'void' } });
  return { batch, voidedCodes: res.modifiedCount };
}
