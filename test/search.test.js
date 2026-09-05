import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeRegion, normalizeSearchCriteria, normalizeTarget } from '../src/search.js';

test('검색 조건은 지역 공백과 숫자 값을 정규화한다', () => {
  assert.deepEqual(normalizeSearchCriteria({
    region: '  제주   애월 ',
    checkin: '2026-09-10',
    checkout: '2026-09-12',
    guests: '2',
    minRating: '4.5',
  }), {
    region: '제주 애월',
    checkin: '2026-09-10',
    checkout: '2026-09-12',
    guests: 2,
    minRating: 4.5,
  });
});

test('체크아웃이 체크인과 같거나 빠르면 거부한다', () => {
  assert.throws(
    () => normalizeSearchCriteria({ region: '강릉', checkin: '2026-09-12', checkout: '2026-09-12' }),
    (error) => error.code === 'INVALID_DATE_RANGE',
  );
});

test('달력에 존재하지 않는 날짜는 거부한다', () => {
  assert.throws(
    () => normalizeSearchCriteria({ region: '강릉', checkin: '2026-02-30', checkout: '2026-03-02' }),
    (error) => error.code === 'INVALID_DATE',
  );
});

test('지역이 없으면 검색 API 호출 전에 거부한다', () => {
  assert.throws(
    () => normalizeSearchCriteria({ region: '   ' }),
    (error) => error.code === 'REGION_REQUIRED',
  );
});

test('체크인과 체크아웃은 모두 필수다', () => {
  assert.throws(
    () => normalizeSearchCriteria({ region: '강릉', checkin: '2026-09-12' }),
    (error) => error.code === 'DATE_REQUIRED',
  );
  assert.throws(
    () => normalizeSearchCriteria({ region: '강릉', checkout: '2026-09-13' }),
    (error) => error.code === 'DATE_REQUIRED',
  );
});

test('잘못된 인원과 최소 평점은 기본값으로 바꾸지 않고 거부한다', () => {
  assert.throws(
    () => normalizeSearchCriteria({ region: '강릉', checkin: '2026-09-12', checkout: '2026-09-13', guests: 'abc' }),
    (error) => error.code === 'INVALID_GUESTS',
  );
  assert.throws(
    () => normalizeSearchCriteria({ region: '강릉', checkin: '2026-09-12', checkout: '2026-09-13', minRating: '' }),
    (error) => error.code === 'INVALID_MIN_RATING',
  );
  assert.throws(
    () => normalizeSearchCriteria({ region: '강릉', checkin: '2026-09-12', checkout: '2026-09-13', guests: '0x2' }),
    (error) => error.code === 'INVALID_GUESTS',
  );
  assert.throws(
    () => normalizeSearchCriteria({ region: '강릉', checkin: '2026-09-12', checkout: '2026-09-13', minRating: '4.5e0' }),
    (error) => error.code === 'INVALID_MIN_RATING',
  );
});

test('행정 접미사만 있는 지역 입력은 거부한다', () => {
  assert.throws(() => normalizeRegion('시'), (error) => error.code === 'INVALID_REGION');
  assert.throws(() => normalizeRegion('구'), (error) => error.code === 'INVALID_REGION');
  assert.throws(() => normalizeRegion('!!'), (error) => error.code === 'INVALID_REGION');
  assert.throws(() => normalizeRegion('🏨🏨'), (error) => error.code === 'INVALID_REGION');
});

test('target은 1부터 30 사이 정수만 허용한다', () => {
  assert.equal(normalizeTarget(null), 30);
  assert.equal(normalizeTarget('5'), 5);
  assert.throws(() => normalizeTarget('0'), (error) => error.code === 'INVALID_TARGET');
  assert.throws(() => normalizeTarget('1.5'), (error) => error.code === 'INVALID_TARGET');
  assert.throws(() => normalizeTarget('31'), (error) => error.code === 'INVALID_TARGET');
  assert.throws(() => normalizeTarget('0x10'), (error) => error.code === 'INVALID_TARGET');
});