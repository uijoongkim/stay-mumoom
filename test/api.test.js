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
