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
import { createProviderCache, projectListings } from './src/provider-cache.js';
import { createNaverProvider, getAirbnbGongjuSearchUrl, NAVER_POC_TARGET } from './src/providers.js';
import { resolvePublicFilePath } from './src/static-files.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT) || 4173;
const naverProvider = createNaverProvider({
  clientId: process.env.NAVER_API_HUB_CLIENT_ID ?? process.env.NAVER_CLIENT_ID ?? '',
  clientSecret: process.env.NAVER_API_HUB_CLIENT_SECRET ?? process.env.NAVER_CLIENT_SECRET ?? '',
});
const api = createApiService({
  naverProvider,
  airbnbSearchUrl: getAirbnbGongjuSearchUrl(),
});
const gongjuCache = createProviderCache({
  ttlMs: 10 * 60 * 1000,
  load: () => api.getGongjuListings({ target: NAVER_POC_TARGET }),
});

const sendJson = (response, status, body) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
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
      const requestedTarget = Number(requestUrl.searchParams.get('target')) || NAVER_POC_TARGET;
      const target = Math.min(NAVER_POC_TARGET, Math.max(1, requestedTarget));
      const result = await gongjuCache.get();
      sendJson(response, 200, projectListings(result.payload, target, result.cached));
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
