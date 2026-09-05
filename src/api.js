export function createApiService({ naverProvider, airbnbSearchUrl }) {
  function getProviderStatus() {
    return {
      naver: {
        configured: naverProvider.configured,
        mode: 'official-api',
      },
      airbnb: {
        configured: false,
        mode: 'outbound-search',
        searchUrl: airbnbSearchUrl,
        reason: '공식 파트너 API 승인 전에는 검색 결과 수집을 하지 않습니다.',
      },
    };
  }

  async function getGongjuListings({ target = 30 } = {}) {
    try {
      const result = await naverProvider.collectGongju({ target });
      return {
        listings: result.items,
        meta: result.meta,
        airbnb: {
          mode: 'outbound-search',
          searchUrl: airbnbSearchUrl,
          listingsCollected: 0,
        },
      };
    } catch (error) {
      if (error.code === 'NAVER_NOT_CONFIGURED') {
        const publicError = new Error('네이버 API 인증 설정이 필요합니다.');
        publicError.status = 503;
        publicError.code = error.code;
        publicError.publicMessage = '네이버 API 인증 설정이 필요합니다.';
        throw publicError;
      }

      const publicError = new Error('네이버 숙소 후보를 가져오지 못했습니다.');
      publicError.status = 502;
      publicError.code = error.code ?? 'NAVER_API_ERROR';
      publicError.publicMessage = '네이버 숙소 후보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.';
      throw publicError;
    }
  }

  return { getProviderStatus, getGongjuListings };
}
