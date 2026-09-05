import test from 'node:test';
import assert from 'node:assert/strict';

import { createKeyedProviderCache, createProviderCache, projectListings } from '../src/provider-cache.js';

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
    airbnb: { searchUrl: 'https://example.com/original' },
  };

  const projected = projectListings(payload, 1, true);
  assert.deepEqual(projected, {
    listings: [{ id: 'a' }],
    meta: { target: 1, returnedCount: 1, uniqueCount: 3, cached: true },
    airbnb: { searchUrl: 'https://example.com/original' },
  });
  projected.airbnb.searchUrl = 'https://example.com/request-specific';
  assert.equal(payload.airbnb.searchUrl, 'https://example.com/original');
});

test('지역별 캐시는 같은 지역 요청만 합치고 다른 지역은 분리한다', async () => {
  const calls = [];
  const cache = createKeyedProviderCache({
    ttlMs: 1000,
    load: async (key) => {
      calls.push(key);
      return { listings: [{ id: key }] };
    },
  });

  const [jeju1, jeju2, gangneung] = await Promise.all([
    cache.get('제주 애월'), cache.get('제주 애월'), cache.get('강릉'),
  ]);

  assert.deepEqual(calls.sort(), ['강릉', '제주 애월']);
  assert.equal(jeju1.cached, false);
  assert.equal(jeju2.payload.listings[0].id, '제주 애월');
  assert.equal(gangneung.payload.listings[0].id, '강릉');
});

test('진행 중인 키는 캐시 상한 압력에도 퇴출하지 않는다', async () => {
  const resolvers = new Map();
  const calls = [];
  const cache = createKeyedProviderCache({
    ttlMs: 1000,
    maxEntries: 1,
    load: (key) => new Promise((resolve) => {
      calls.push(key);
      resolvers.set(key, resolve);
    }),
  });

  const firstA = cache.get('a');
  const firstB = cache.get('b');
  const secondA = cache.get('a');
  const secondB = cache.get('b');
  assert.deepEqual(calls, ['a', 'b']);

  resolvers.get('a')({ listings: [], meta: {} });
  resolvers.get('b')({ listings: [], meta: {} });
  await Promise.all([firstA, firstB, secondA, secondB]);
  assert.equal(cache.size(), 1);
});