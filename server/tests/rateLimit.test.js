import test from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter } from '../src/lib/rateLimit.js';

test('allows up to max hits per window, then blocks with a retry hint', () => {
  let t = 0;
  const l = createLimiter({ windowMs: 1000, max: 3, now: () => t });
  assert.deepEqual([1, 2, 3].map(() => l.hit('ip').allowed), [true, true, true]);
  const blocked = l.hit('ip');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 1000);
});

test('keys are independent and the window resets', () => {
  let t = 0;
  const l = createLimiter({ windowMs: 1000, max: 1, now: () => t });
  assert.equal(l.hit('a').allowed, true);
  assert.equal(l.hit('a').allowed, false);
  assert.equal(l.hit('b').allowed, true);
  t = 1001;
  assert.equal(l.hit('a').allowed, true);
});
