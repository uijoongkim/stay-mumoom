import test from 'node:test';
import assert from 'node:assert/strict';

import { createConcurrencyLimiter, createFixedWindowRateLimiter } from '../src/rate-limit.js';

test('동시성 제한기는 서로 다른 작업을 합쳐 설정한 수만 실행한다', async () => {
  const limiter = createConcurrencyLimiter(2);
  const releases = [];
  let active = 0;
  let maximumActive = 0;
  const tasks = Array.from({ length: 4 }, () => limiter.run(async () => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => releases.push(resolve));
    active -= 1;
  }));

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(active, 2);
  releases.splice(0).forEach((resolve) => resolve());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(active, 2);
  releases.splice(0).forEach((resolve) => resolve());
  await Promise.all(tasks);
  assert.equal(maximumActive, 2);
});

test('고정 창 요청률 제한기는 키별 상한과 재시도 시간을 반환한다', () => {
  let now = 1000;
  const limiter = createFixedWindowRateLimiter({ limit: 2, windowMs: 1000, now: () => now });

  assert.deepEqual(limiter.consume('client-a'), { allowed: true, retryAfterMs: 0 });
  assert.deepEqual(limiter.consume('client-a'), { allowed: true, retryAfterMs: 0 });
  assert.deepEqual(limiter.consume('client-a'), { allowed: false, retryAfterMs: 1000 });
  assert.deepEqual(limiter.consume('client-b'), { allowed: true, retryAfterMs: 0 });
  now = 2001;
  assert.deepEqual(limiter.consume('client-a'), { allowed: true, retryAfterMs: 0 });
});
