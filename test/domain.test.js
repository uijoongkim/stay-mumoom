import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateDistanceKm,
  filterListings,
  normalizeListing,
  rankListings,
} from '../src/domain.js';

const rawListing = {
  listingId: 'air-1',
  platform: 'airbnb',
  title: '숲속 스테이',
  region: '강원 평창',
  lat: 37.65,
  lng: 128.68,
  nightlyPrice: 180000,
  maxGuests: 4,
  bathCount: 2,
  roomCount: 2,
  features: ['bathtub', 'sauna'],
  themes: ['romantic', 'nature'],
  href: 'https://example.com/stay',
  lastUpdated: '2026-08-29T08:00:00+09:00',
};

const listings = [
  {
    ...rawListing,
    listingId: 'a',
    title: '평창 편백 스테이',
    nightlyPrice: 180000,
    bathCount: 2,
    maxGuests: 4,
    features: ['bathtub', 'hinoki', 'sauna'],
    themes: ['romantic', 'nature'],
    rating: 4.9,
  },
  {
    ...rawListing,
    listingId: 'b',
    title: '제주 패밀리 하우스',
    region: '제주 애월',
    nightlyPrice: 260000,
    bathCount: 1,
    maxGuests: 8,
    features: ['pool', 'bbq'],
    themes: ['family'],
    rating: 4.7,
  },
].map(normalizeListing);

test('normalizeListing은 플랫폼별 원본 필드를 공통 모델로 변환한다', () => {
  const result = normalizeListing(rawListing);

  assert.equal(result.id, 'airbnb:air-1');
  assert.equal(result.sourceLabel, '에어비앤비');
  assert.equal(result.pricePerNight, 180000);
  assert.equal(result.bathrooms, 2);
  assert.deepEqual(result.coordinates, { lat: 37.65, lng: 128.68 });
});

test('normalizeListing은 제공되지 않은 가격과 객실 조건을 임의 값으로 만들지 않는다', () => {
  const result = normalizeListing({
    listingId: 'naver-basic',
    platform: 'naver',
    title: '공주 숙소 후보',
    region: '충청남도 공주시',
    lat: 36.45,
    lng: 127.12,
  });

  assert.equal(result.pricePerNight, null);
  assert.equal(result.capacity, null);
  assert.equal(result.bathrooms, null);
  assert.equal(result.bedrooms, null);
});

test('filterListings는 검색어와 모든 필수 조건을 함께 적용한다', () => {
  const result = filterListings(listings, {
    query: '평창',
    maxPrice: 200000,
    minBathrooms: 2,
    minGuests: 3,
    amenities: ['bathtub', 'sauna'],
  });

  assert.deepEqual(result.map((listing) => listing.id), ['airbnb:a']);
});

test('filterListings는 선택한 편의시설이 하나라도 빠지면 제외한다', () => {
  const result = filterListings(listings, {
    query: '',
    maxPrice: 300000,
    minBathrooms: 1,
    minGuests: 1,
    amenities: ['bathtub', 'pool'],
  });

  assert.equal(result.length, 0);
});

test('filterListings는 상세 정보가 없는 후보를 조건 미지정 때만 포함한다', () => {
  const basicListing = normalizeListing({
    listingId: 'basic', platform: 'naver', title: '공주 숙소', region: '공주', lat: 36.45, lng: 127.12,
  });

  assert.equal(filterListings([basicListing], { query: '공주' }).length, 1);
  assert.equal(filterListings([basicListing], { minBathrooms: 2 }).length, 0);
  assert.equal(filterListings([basicListing], { maxPrice: 200000 }).length, 0);
});

test('filterListings는 실제 평점이 기준 이상인 숙소만 포함한다', () => {
  const result = filterListings(listings, { minRating: 4.8 });

  assert.deepEqual(result.map((listing) => listing.id), ['airbnb:a']);
  const unknownRating = normalizeListing({
    listingId: 'basic-rating', platform: 'naver', title: '평점 미제공 숙소', region: '제주',
  });
  assert.equal(filterListings([unknownRating], { minRating: 4.5 }).length, 0);
});

test('calculateDistanceKm는 동일 좌표 사이 거리를 0으로 계산한다', () => {
  assert.equal(calculateDistanceKm({ lat: 37.5, lng: 127 }, { lat: 37.5, lng: 127 }), 0);
});

test('rankListings는 커플 목적에서 감성·욕조·사우나 숙소를 우선한다', () => {
  const ranked = rankListings(listings, 'couple', { lat: 37.5665, lng: 126.978 });

  assert.equal(ranked[0].id, 'airbnb:a');
  assert.ok(ranked[0].recommendationScore > ranked[1].recommendationScore);
  assert.ok(ranked[0].recommendationReasons.includes('둘만의 휴식에 어울리는 분위기'));
  assert.ok(Number.isFinite(ranked[0].distanceKm));
});

test('rankListings는 입력 배열을 변경하지 않는다', () => {
  const originalIds = listings.map((listing) => listing.id);

  rankListings(listings, 'family', { lat: 37.5665, lng: 126.978 });

  assert.deepEqual(listings.map((listing) => listing.id), originalIds);
  assert.equal(listings[0].recommendationScore, undefined);
});
