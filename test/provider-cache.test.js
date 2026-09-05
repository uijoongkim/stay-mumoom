import test from 'node:test';
import assert from 'node:assert/strict';

import { createProviderCache, projectListings } from '../src/provider-cache.js';

test('동시 캐시 미스는 하나의 공급자 요청으로 합쳐진다', async () => {
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const cache = createProviderCache({
    ttlMs: 1000,
    load: async () => {
      calls += 1;
      await pending;
      return { listings: [{ id: 'a' }, { id: 'b' }], meta: { returnedCount: 2 } };
    },
  });

  const first = cache.get();
  const second = cache.get();
  release();
  const [a, b] = await Promise.all([first, second]);

  assert.equal(calls, 1);
  assert.deepEqual(a.payload, b.payload);
});

test('캐시 원본과 무관하게 요청 target만큼 결과를 투영한다', () => {
  const payload = {
    listings: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    meta: { target: 30, returnedCount: 3, uniqueCount: 3 },
  };

  assert.deepEqual(projectListings(payload, 1, true), {
    listings: [{ id: 'a' }],
    meta: { target: 1, returnedCount: 1, uniqueCount: 3, cached: true },
  });
});