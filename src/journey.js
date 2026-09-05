const PURPOSES = new Set(['couple', 'family', 'friends']);

const normalizePurpose = (value) => (PURPOSES.has(value) ? value : 'couple');

export function buildExploreUrl(purpose) {
  return `./explore.html?purpose=${normalizePurpose(purpose)}`;
}

export function getPurposeFromSearch(search = '') {
  return normalizePurpose(new URLSearchParams(search).get('purpose'));
}

export function getProviderPresentation(provider = {}) {
  if (provider.configured && provider.mode === 'official-api') {
    return { state: 'connected', label: '공식 API 연결됨' };
  }
  if (provider.mode === 'outbound-search') {
    return { state: 'link-only', label: '공식 검색 링크' };
  }
  return { state: 'setup', label: '연결 준비 필요' };
}
