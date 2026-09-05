import test from 'node:test';
import assert from 'node:assert/strict';

import { createApiService } from '../src/api.js';

test('제공자 상태는 네이버 설정 여부와 에어비앤비 링크 모드를 공개한다', () => {
  const service = createApiService({
    naverProvider: { configured: true },
    airbnbSearchUrl: 'https://www.airbnb.co.kr/s/test/homes',
  });

  const result = service.getProviderStatus();

  assert.deepEqual(result.naver, { configured: true, mode: 'official-api' });
  assert.equal(result.airbnb.mode, 'outbound-search');
  assert.equal(result.airbnb.searchUrl, 'https://www.airbnb.co.kr/s/test/homes');
});

test('공주 숙소 조회는 네이버 수집 결과와 에어비앤비 검색 링크를 함께 반환한다', async () => {
  const service = createApiService({
    naverProvider: {
      configured: true,
      collectGongju: async ({ target }) => ({ items: [{ id: 'naver:1' }], meta: { target } }),
    },
    airbnbSearchUrl: 'https://www.airbnb.co.kr/s/test/homes',
  });

  const result = await service.getGongjuListings({ target: 100 });

  assert.deepEqual(result.listings, [{ id: 'naver:1' }]);
  assert.equal(result.meta.target, 100);
  assert.equal(result.airbnb.searchUrl, 'https://www.airbnb.co.kr/s/test/homes');
  assert.equal(result.airbnb.listingsCollected, 0);
});

test('전국 숙소 조회는 지역을 네이버에 전달하고 날짜와 인원을 에어비앤비 링크에 반영한다', async () => {
  let captured;
  const service = createApiService({
    naverProvider: {
      configured: true,
      collectRegion: async (criteria) => {
        captured = criteria;
        return { items: [{ id: 'naver:jeju' }], meta: { region: criteria.region } };
      },
    },
  });

  const result = await service.getListings({
    region: '제주 애월', checkin: '2026-09-10', checkout: '2026-09-12', guests: 2, minRating: 4.5, target: 20,
  });

  assert.deepEqual(captured, { region: '제주 애월', target: 20 });
  assert.deepEqual(result.listings, [{ id: 'naver:jeju' }]);
  const airbnbUrl = new URL(result.airbnb.searchUrl);
  assert.match(decodeURIComponent(airbnbUrl.pathname), /제주 애월/);
  assert.equal(airbnbUrl.searchParams.get('checkin'), '2026-09-10');
  assert.equal(airbnbUrl.searchParams.get('checkout'), '2026-09-12');
  assert.equal(airbnbUrl.searchParams.get('adults'), '2');
  assert.equal(result.meta.ratingFilterApplied, false);
});

test('지역 후보 수집은 날짜 없이 NAVER 데이터만 반환한다', async () => {
  const regions = [];
  const service = createApiService({
    naverProvider: {
      configured: true,
      collectRegion: async ({ region }) => {
        regions.push(region);
        return { items: [{ id: 'naver:1' }], meta: { region } };
      },
    },
  });

  const result = await service.getRegionCandidates({ region: '강릉', target: 5 });
  assert.deepEqual(regions, ['강릉']);
  assert.deepEqual(result.listings, [{ id: 'naver:1' }]);
  assert.equal(result.meta.region, '강릉');
});

test('네이버 미설정 오류는 503으로 변환되고 자격 증명을 포함하지 않는다', async () => {
  const service = createApiService({
    naverProvider: {
      configured: false,
      collectGongju: async () => {
        const error = new Error('설정 필요');
        error.code = 'NAVER_NOT_CONFIGURED';
        throw error;
      },
    },
    airbnbSearchUrl: 'https://www.airbnb.co.kr/s/test/homes',
  });

  await assert.rejects(
    service.getGongjuListings({ target: 100 }),
    (error) => error.status === 503 && error.code === 'NAVER_NOT_CONFIGURED' && error.publicMessage === '네이버 API 인증 설정이 필요합니다.',
  );
});
