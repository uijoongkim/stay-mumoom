import { normalizeRegion } from './search.js';

const NAVER_LOCAL_ENDPOINT = 'https://naverapihub.apigw.ntruss.com/search/v1/local';
export const NAVER_POC_TARGET = 30;
export const NAVER_POC_CONCURRENCY = 3;

export const GONGJU_QUERIES = [
  '공주 감성 숙소',
  '공주 가족 펜션',
  '공주 한옥스테이',
  '공주 풀빌라',
  '계룡산 펜션',
  '공주 호텔',
];

export function buildRegionQueries(regionInput) {
  const region = normalizeRegion(regionInput);
  return ['감성 숙소', '가족 펜션', '한옥스테이', '풀빌라', '호텔', '숙박']
    .map((term) => `${region} ${term}`);
}

const decodeEntities = (value) => String(value ?? '')
  .replaceAll('&amp;', '&')
  .replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'")
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')
  .replace(/<[^>]*>/g, '')
  .trim();

const stableHash = (value) => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const parseCoordinate = (value, max) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return Number.NaN;
  return Math.abs(number) > max ? number / 10_000_000 : number;
};

const naverSearchUrl = (name, address) => {
  const url = new URL('https://search.naver.com/search.naver');
  url.searchParams.set('query', `${name} ${address}`.trim());
  return url.toString();
};

const safeHttpUrl = (value, fallback) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : fallback;
  } catch {
    return fallback;
  }
};

const ACCOMMODATION_CATEGORY_TERMS = [
  '숙박', '펜션', '호텔', '모텔', '게스트하우스', '전통숙소',
  '민박', '캠핑', '야영장', '리조트', '호스텔', '휴양림',
];

const regionTokens = (region) => region.split(' ')
  .map((token) => token.replace(/(특별자치도|특별자치시|광역시|특별시|도|시|군|구|읍|면|동)$/u, ''))
  .filter((token) => token.length >= 2);

const isRegionAccommodation = (rawItem, region) => {
  const address = decodeEntities(rawItem.roadAddress || rawItem.address || '');
  const title = decodeEntities(rawItem.title || '');
  const category = decodeEntities(rawItem.category || '');
  const location = `${address} ${title}`.replace(/\s+/g, '');
  return regionTokens(region).every((token) => location.includes(token))
    && ACCOMMODATION_CATEGORY_TERMS.some((term) => category.includes(term));
};

export function normalizeNaverItem(item) {
  const title = decodeEntities(item.title) || '이름 없는 숙소';
  const roadAddress = decodeEntities(item.roadAddress);
  const address = roadAddress || decodeEntities(item.address) || '주소 정보 없음';
  const lat = parseCoordinate(item.mapy, 90);
  const lng = parseCoordinate(item.mapx, 180);
  const fingerprint = `${title.toLocaleLowerCase('ko-KR')}|${lat}|${lng}|${address}`;

  const listingId = stableHash(fingerprint);
  const fallbackUrl = naverSearchUrl(title, address);

  return {
    id: `naver:${listingId}`,
    source: 'naver',
    listingId,
    platform: 'naver',
    title,
    region: address,
    lat,
    lng,
    nightlyPrice: null,
    maxGuests: null,
    bathCount: null,
    roomCount: null,
    features: [],
    themes: [],
    category: decodeEntities(item.category),
    description: decodeEntities(item.description),
    image: '',
    rating: null,
    reviews: null,
    isVerified: true,
    href: safeHttpUrl(decodeEntities(item.link), fallbackUrl),
    lastUpdated: new Date().toISOString(),
    dataCompleteness: 'basic',
  };
}

export function createNaverProvider({
  clientId = '',
  clientSecret = '',
  fetchImpl = globalThis.fetch,
  requestLimiter = { run: (task) => task() },
  queries,
} = {}) {
  const configured = Boolean(clientId && clientSecret);

  async function searchLocal(query) {
    if (!configured) {
      const error = new Error('NAVER API HUB Client ID와 Client Secret 설정이 필요합니다.');
      error.code = 'NAVER_NOT_CONFIGURED';
      throw error;
    }

    const url = new URL(NAVER_LOCAL_ENDPOINT);
    url.searchParams.set('query', query);
    url.searchParams.set('display', '5');
    url.searchParams.set('start', '1');
    url.searchParams.set('sort', 'comment');
    url.searchParams.set('format', 'json');

    const response = await requestLimiter.run(() => fetchImpl(url, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    }));

    if (!response.ok) {
      const body = await response.text();
      const error = new Error(`NAVER 지역 검색 실패 (${response.status})`);
      error.code = 'NAVER_API_ERROR';
      error.status = response.status;
      error.detail = body.slice(0, 300);
      throw error;
    }

    const payload = await response.json();
    return Array.isArray(payload.items) ? payload.items : [];
  }

  async function collectRegion({ region: regionInput, target = NAVER_POC_TARGET } = {}) {
    const region = normalizeRegion(regionInput);
    const activeQueries = queries ?? buildRegionQueries(region);
    const rawItems = [];
    const errors = [];
    const concurrency = NAVER_POC_CONCURRENCY;

    for (let index = 0; index < activeQueries.length; index += concurrency) {
      const batch = activeQueries.slice(index, index + concurrency);
      const results = await Promise.all(batch.map(async (query) => {
        try {
          return await searchLocal(query);
        } catch (error) {
          if (error.code === 'NAVER_NOT_CONFIGURED') throw error;
          errors.push({ query, code: error.code ?? 'NAVER_API_ERROR', status: error.status ?? 500 });
          return [];
        }
      }));
      rawItems.push(...results.flat());
    }

    if (activeQueries.length > 0 && errors.length === activeQueries.length) {
      const error = new Error('NAVER 지역 검색 전체 질의 실패');
      error.code = 'NAVER_ALL_QUERIES_FAILED';
      throw error;
    }

    const unique = new Map();
    let rejectedCount = 0;
    for (const rawItem of rawItems) {
      if (!isRegionAccommodation(rawItem, region)) {
        rejectedCount += 1;
        continue;
      }
      const item = normalizeNaverItem(rawItem);
      const key = `${item.title.toLocaleLowerCase('ko-KR')}|${item.lat}|${item.lng}`;
      if (!unique.has(key)) unique.set(key, item);
    }

    const items = [...unique.values()].slice(0, Math.max(1, target));
    return {
      items,
      meta: {
        provider: 'naver-api-hub',
        region,
        queryCount: activeQueries.length,
        rawCount: rawItems.length,
        rejectedCount,
        uniqueCount: unique.size,
        returnedCount: items.length,
        target,
        selectionStrategy: 'naver-comment-sort',
        ratingFilterApplied: false,
        ratingUnavailableReason: 'NAVER 지역 검색 API는 별점 필드를 제공하지 않습니다.',
        partial: errors.length > 0,
        errors,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  const collectGongju = (options = {}) => collectRegion({ ...options, region: '공주' });
  return { configured, searchLocal, collectRegion, collectGongju };
}

export function getAirbnbSearchUrl({ region: regionInput, checkin = '', checkout = '', adults = 2 }) {
  const region = normalizeRegion(regionInput);
  const url = new URL(`https://www.airbnb.co.kr/s/${encodeURIComponent(`${region} 대한민국`)}/homes`);
  url.searchParams.set('tab_id', 'home_tab');
  url.searchParams.set('refinement_paths[]', '/homes');
  if (checkin) url.searchParams.set('checkin', checkin);
  if (checkout) url.searchParams.set('checkout', checkout);
  url.searchParams.set('adults', String(Math.max(1, Number(adults) || 1)));
  return url.toString();
}

export function getAirbnbGongjuSearchUrl() {
  return getAirbnbSearchUrl({ region: '공주시 충청남도' });
}
