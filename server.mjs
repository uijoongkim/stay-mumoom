const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

import { createServer } from 'node:http';
import { extname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { createApiService } from './src/api.js';
import { createKeyedProviderCache, createProviderCache, projectListings } from './src/provider-cache.js';
import { createNaverProvider, getAirbnbGongjuSearchUrl, getAirbnbSearchUrl, NAVER_POC_TARGET } from './src/providers.js';
import { createConcurrencyLimiter, createFixedWindowRateLimiter } from './src/rate-limit.js';
import { normalizeSearchCriteria, normalizeTarget } from './src/search.js';
import { resolvePublicFilePath } from './src/static-files.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT) || 4173;
const naverRequestLimiter = createConcurrencyLimiter(3);
const searchRateLimiter = createFixedWindowRateLimiter({ limit: 10, windowMs: 60 * 1000 });
const naverProvider = createNaverProvider({
  clientId: process.env.NAVER_API_HUB_CLIENT_ID ?? process.env.NAVER_CLIENT_ID ?? '',
  clientSecret: process.env.NAVER_API_HUB_CLIENT_SECRET ?? process.env.NAVER_CLIENT_SECRET ?? '',
  requestLimiter: naverRequestLimiter,
});
const api = createApiService({
  naverProvider,
  airbnbSearchUrl: getAirbnbGongjuSearchUrl(),
});
const gongjuCache = createProviderCache({
  ttlMs: 10 * 60 * 1000,
  load: () => api.getGongjuListings({ target: NAVER_POC_TARGET }),
});
const regionCache = createKeyedProviderCache({
  ttlMs: 10 * 60 * 1000,
  load: (region) => api.getRegionCandidates({ region, target: NAVER_POC_TARGET }),
});

const sendJson = (response, status, body, headers = {}) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  response.end(JSON.stringify(body));
};

createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, 'http://localhost');
    const pathname = decodeURIComponent(requestUrl.pathname);

    if (pathname === '/api/providers') {
      sendJson(response, 200, api.getProviderStatus());
      return;
    }

    if (pathname === '/api/gongju-listings') {
      const target = normalizeTarget(requestUrl.searchParams.get('target'));
      const result = await gongjuCache.get();
      sendJson(response, 200, projectListings(result.payload, target, result.cached));
      return;
    }

    if (pathname === '/api/listings') {
      const rate = searchRateLimiter.consume(request.socket.remoteAddress ?? 'local');
      if (!rate.allowed) {
        sendJson(response, 429, {
          error: 'SEARCH_RATE_LIMITED',
          message: '검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
        }, { 'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)) });
        return;
      }
      const target = normalizeTarget(requestUrl.searchParams.get('target'));
      const criteria = normalizeSearchCriteria({
        region: requestUrl.searchParams.get('region'),
        checkin: requestUrl.searchParams.get('checkin'),
        checkout: requestUrl.searchParams.get('checkout'),
        guests: requestUrl.searchParams.get('guests'),
        minRating: requestUrl.searchParams.get('minRating'),
      });
      const result = await regionCache.get(criteria.region);
      const projected = projectListings(result.payload, target, result.cached);
      const payload = {
        ...projected,
        meta: {
          ...projected.meta,
          requestedCheckin: criteria.checkin,
          requestedCheckout: criteria.checkout,
          requestedGuests: criteria.guests,
          requestedMinRating: criteria.minRating,
          ratingFilterApplied: false,
          ratingUnavailableReason: projected.meta.ratingUnavailableReason
            ?? 'NAVER 지역 검색 API는 별점 필드를 제공하지 않습니다.',
        },
        airbnb: {
          mode: 'outbound-search',
          searchUrl: getAirbnbSearchUrl({
            region: criteria.region,
            checkin: criteria.checkin,
            checkout: criteria.checkout,
            adults: criteria.guests,
          }),
          listingsCollected: 0,
        },
      };
      sendJson(response, 200, payload);
      return;
    }

    const filePath = resolvePublicFilePath(root, pathname);
    if (!filePath) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    const content = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(content);
  } catch (error) {
    if (error.publicMessage) {
      sendJson(response, error.status ?? 500, { error: error.code, message: error.publicMessage });
      return;
    }
    response.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(error.code === 'ENOENT' ? 'Not Found' : 'Internal Server Error');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`머무름 PoC: http://127.0.0.1:${port}`);
});
