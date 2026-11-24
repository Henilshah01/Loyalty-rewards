import 'dotenv/config';

const REQUIRED = ['MONGO_URI', 'JWT_SECRET', 'CODE_SECRET'];

export function loadConfig(env = process.env) {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(', ')} (see .env.example)`);
  if (env.JWT_SECRET.length < 32 || env.CODE_SECRET.length < 32) {
    throw new Error('JWT_SECRET and CODE_SECRET must each be at least 32 characters');
  }
  return {
    port: Number(env.PORT || 4000),
    mongoUri: env.MONGO_URI,
    jwtSecret: env.JWT_SECRET,
    jwtExpires: env.JWT_EXPIRES || '7d',
    codeSecret: env.CODE_SECRET,
    clientOrigin: env.CLIENT_ORIGIN || 'http://localhost:5173',
    trustProxy: env.TRUST_PROXY === 'true',
    maxFailedClaims: Number(env.MAX_FAILED_CLAIMS || 5),
    lockMinutes: Number(env.LOCK_MINUTES || 15),
    maxClaimsPerDay: Number(env.MAX_CLAIMS_PER_DAY || 20),
  };
}
