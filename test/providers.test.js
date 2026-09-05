import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRegionQueries,
  createNaverProvider,
  GONGJU_QUERIES,
  getAirbnbSearchUrl,
  getAirbnbGongjuSearchUrl,
  NAVER_POC_CONCURRENCY,
  NAVER_POC_TARGET,
  normalizeNaverItem,
} from '../src/providers.js';
import { createConcurrencyLimiter } from '../src/rate-limit.js';

test('전국 지역 입력으로 제한된 네이버 숙소 검색어를 만든다', () => {
  assert.deepEqual(buildRegionQueries('  제주   애월  '), [
    '제주 애월 감성 숙소',
    '제주 애월 가족 펜션',
    '제주 애월 한옥스테이',
    '제주 애월 풀빌라',
    '제주 애월 호텔',
    '제주 애월 숙박',
  ]);
});

test('에어비앤비 검색 링크에 사용자가 고른 지역 날짜 인원을 반영한다', () => {
  const url = new URL(getAirbnbSearchUrl({
    region: '제주 애월', checkin: '2026-09-10', checkout: '2026-09-12', adults: 2,
  }));

  assert.equal(url.hostname, 'www.airbnb.co.kr');
  assert.match(decodeURIComponent(url.pathname), /제주 애월/);
  assert.equal(url.searchParams.get('checkin'), '2026-09-10');
  assert.equal(url.searchParams.get('checkout'), '2026-09-12');
  assert.equal(url.searchParams.get('adults'), '2');
});

test('네이버 기본 수집은 무료 PoC 수준의 핵심 검색어 6개로 제한한다', () => {
  assert.equal(NAVER_POC_TARGET, 30);
  assert.equal(NAVER_POC_CONCURRENCY, 3);
  assert.equal(GONGJU_QUERIES.length, 6);
  assert.deepEqual(GONGJU_QUERIES, [
    '공주 감성 숙소',
    '공주 가족 펜션',
    '공주 한옥스테이',
    '공주 풀빌라',
    '계룡산 펜션',
    '공주 호텔',
  ]);
});

test('normalizeNaverItem은 HTML 강조 태그를 제거하고 공통 숙소 후보로 변환한다', () => {
  const result = normalizeNaverItem({
    title: '<b>공주</b> 숲 펜션',
    link: 'https://stay.example/pension',
    category: '숙박>펜션',
    description: '<b>계룡산</b> 가까운 숙소',
    address: '충청남도 공주시 반포면 1',
    roadAddress: '충청남도 공주시 반포면 숲길 1',
    mapx: '127.12',
    mapy: '36.45',
  });

  assert.match(result.id, /^naver:/);
  assert.equal(result.source, 'naver');
  assert.equal(result.title, '공주 숲 펜션');
  assert.equal(result.region, '충청남도 공주시 반포면 숲길 1');
  assert.equal(result.lat, 36.45);
  assert.equal(result.lng, 127.12);
  assert.equal(result.href, 'https://stay.example/pension');
  assert.deepEqual(result.features, []);
});

test('normalizeNaverItem은 HTML 엔티티로 인코딩된 태그도 제거한다', () => {
  const result = normalizeNaverItem({
    title: '&lt;img src=x onerror=alert(1)&gt;공주 펜션',
    roadAddress: '충청남도 공주시',
    mapx: '127.12',
    mapy: '36.45',
  });

  assert.equal(result.title, '공주 펜션');
});

test('normalizeNaverItem은 HTTP가 아닌 외부 링크를 네이버 검색 링크로 대체한다', () => {
  const result = normalizeNaverItem({
    title: '공주 펜션',
    roadAddress: '충청남도 공주시',
    mapx: '127.12',
    mapy: '36.45',
    link: 'javascript:alert(1)',
  });

  assert.equal(new URL(result.href).hostname, 'search.naver.com');
});

test('네이버 제공자는 API HUB 인증 헤더와 최대 display 값을 사용한다', async () => {
  let captured;
  const provider = createNaverProvider({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    fetchImpl: async (url, options) => {
      captured = { url: String(url), options };
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    },
  });

  await provider.searchLocal('공주 펜션');

  const url = new URL(captured.url);
  assert.equal(url.origin + url.pathname, 'https://naverapihub.apigw.ntruss.com/search/v1/local');
  assert.equal(url.searchParams.get('query'), '공주 펜션');
  assert.equal(url.searchParams.get('display'), '5');
  assert.equal(url.searchParams.get('start'), '1');
  assert.equal(captured.options.headers['X-NCP-APIGW-API-KEY-ID'], 'client-id');
  assert.equal(captured.options.headers['X-NCP-APIGW-API-KEY'], 'client-secret');
});

test('네이버 제공자는 서로 다른 검색의 전체 fetch 동시성을 제한한다', async () => {
  const releases = [];
  let active = 0;
  let maximumActive = 0;
  const provider = createNaverProvider({
    clientId: 'id',
    clientSecret: 'x',
    requestLimiter: createConcurrencyLimiter(2),
    fetchImpl: async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => releases.push(resolve));
      active -= 1;
      return { ok: true, json: async () => ({ items: [] }) };
    },
  });

  const requests = ['a', 'b', 'c', 'd'].map((query) => provider.searchLocal(query));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(active, 2);
  releases.splice(0).forEach((resolve) => resolve());
  await new Promise((resolve) => setImmediate(resolve));
  releases.splice(0).forEach((resolve) => resolve());
  await Promise.all(requests);
  assert.equal(maximumActive, 2);
});

test('네이버 제공자는 여러 검색 결과를 좌표와 이름 기준으로 중복 제거한다', async () => {
  const responses = {
    '공주 펜션': [
      { title: '숲 펜션', category: '숙박>펜션', roadAddress: '공주시 숲길 1', mapx: '127.1', mapy: '36.4' },
      { title: '강 펜션', category: '숙박>펜션', roadAddress: '공주시 강길 2', mapx: '127.2', mapy: '36.5' },
    ],
    '공주 호텔': [
      { title: '<b>숲</b> 펜션', category: '숙박>펜션', roadAddress: '공주시 숲길 1', mapx: '127.1', mapy: '36.4' },
      { title: '공주 호텔', category: '숙박>호텔', roadAddress: '공주시 시청길 3', mapx: '127.3', mapy: '36.6' },
    ],
  };
  const provider = createNaverProvider({
    clientId: 'id',
    clientSecret: 'secret',
    queries: Object.keys(responses),
    fetchImpl: async (url) => {
      const query = new URL(url).searchParams.get('query');
      return new Response(JSON.stringify({ items: responses[query] }), { status: 200 });
    },
  });

  const result = await provider.collectGongju({ target: 100 });

  assert.equal(result.items.length, 3);
  assert.equal(result.meta.queryCount, 2);
  assert.equal(result.meta.rawCount, 4);
  assert.equal(result.meta.uniqueCount, 3);
  assert.equal(result.meta.selectionStrategy, 'naver-comment-sort');
  assert.equal(result.meta.ratingFilterApplied, false);
  assert.match(result.meta.ratingUnavailableReason, /별점/);
});

test('네이버 제공자는 공주시 밖 결과와 숙박이 아닌 업종을 제외한다', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    items: [
      { title: '공주 숲 펜션', category: '숙박>펜션', roadAddress: '충청남도 공주시 숲길 1', mapx: '127.1', mapy: '36.4' },
      { title: '공주 감성 카페', category: '음식점>카페', roadAddress: '충청남도 공주시 카페길 2', mapx: '127.2', mapy: '36.5' },
      { title: '대전 펜션', category: '숙박>펜션', roadAddress: '대전광역시 유성구 대학로 1', mapx: '127.3', mapy: '36.6' },
    ],
  }), { status: 200 });
  const provider = createNaverProvider({
    clientId: 'id', clientSecret: 'secret', fetchImpl, queries: ['공주 숙박'],
  });

  const result = await provider.collectGongju({ target: 10 });

  assert.equal(result.items.length, 1);
  assert.equal(result.meta.rawCount, 3);
  assert.equal(result.meta.rejectedCount, 2);
});

test('네이버 제공자는 자격 증명이 없으면 비밀 값을 노출하지 않는 설정 오류를 낸다', async () => {
  const provider = createNaverProvider({ clientId: '', clientSecret: '' });

  await assert.rejects(
    provider.searchLocal('공주 숙박'),
    (error) => error.code === 'NAVER_NOT_CONFIGURED' && !error.message.includes('undefined'),
  );
});

test('네이버 모든 질의가 실패하면 빈 성공 결과 대신 오류를 반환한다', async () => {
  const provider = createNaverProvider({
    clientId: 'id',
    clientSecret: 'secret',
    queries: ['공주 펜션', '공주 호텔'],
    fetchImpl: async () => new Response('upstream unavailable', { status: 503 }),
  });

  await assert.rejects(
    provider.collectGongju({ target: 30 }),
    (error) => error.code === 'NAVER_ALL_QUERIES_FAILED',
  );
});

test('에어비앤비는 수집 대신 공주 공식 검색 링크만 제공한다', () => {
  const url = new URL(getAirbnbGongjuSearchUrl());

  assert.equal(url.hostname, 'www.airbnb.co.kr');
  assert.match(decodeURIComponent(url.pathname), /공주/);
  assert.equal(url.searchParams.get('tab_id'), 'home_tab');
});
