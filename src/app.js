import { amenityLabels, rawListings } from './data.js';
import { filterListings, normalizeListing, rankListings } from './domain.js';
import { getPurposeFromSearch } from './journey.js';

const sampleListings = rawListings.map(normalizeListing);
let listings = [...sampleListings];
const defaultOrigin = { lat: 37.5665, lng: 126.978 };
const currency = new Intl.NumberFormat('ko-KR');
const state = {
  purpose: getPurposeFromSearch(window.location.search),
  origin: defaultOrigin,
  originLabel: '서울 기준',
  sort: 'recommendation',
  favoritesOnly: false,
  favorites: loadFavorites(),
  dataMode: 'sample',
  providerMeta: null,
};

const elements = {
  form: document.querySelector('#filters'),
  grid: document.querySelector('#listing-grid'),
  empty: document.querySelector('#empty-state'),
  summary: document.querySelector('#result-summary'),
  price: document.querySelector('#max-price'),
  priceOutput: document.querySelector('#price-output'),
  sort: document.querySelector('#sort'),
  savedCount: document.querySelector('#saved-count'),
  savedSummary: document.querySelector('#saved-summary'),
  location: document.querySelector('#use-location'),
  dialog: document.querySelector('#detail-dialog'),
  dialogContent: document.querySelector('#dialog-content'),
  loadNaver: document.querySelector('#load-naver'),
  openAirbnb: document.querySelector('#open-airbnb'),
  providerStatus: document.querySelector('#provider-status'),
  noticeTitle: document.querySelector('#notice-title'),
  noticeCopy: document.querySelector('#notice-copy'),
};

function loadFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem('stay-curator-favorites') ?? '[]');
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}

function saveFavorites() {
  localStorage.setItem('stay-curator-favorites', JSON.stringify([...state.favorites]));
}

function formatPrice(value) {
  return Number.isFinite(value) ? `${currency.format(value)}원` : '가격 정보 없음';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

function compareNullable(a, b, key) {
  const left = a[key];
  const right = b[key];
  if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : 0;
  if (!Number.isFinite(right)) return -1;
  return left - right;
}

function getFilters() {
  const formData = new FormData(elements.form);
  return {
    query: formData.get('query'),
    maxPrice: Number(formData.get('maxPrice')) < 300000 ? formData.get('maxPrice') : null,
    minBathrooms: formData.get('minBathrooms'),
    minGuests: formData.get('minGuests'),
    amenities: formData.getAll('amenities'),
  };
}

function sortListings(items) {
  const sorted = [...items];
  if (state.sort === 'price') sorted.sort((a, b) => compareNullable(a, b, 'pricePerNight'));
  if (state.sort === 'distance') sorted.sort((a, b) => compareNullable(a, b, 'distanceKm'));
  return sorted;
}

function listingCard(listing) {
  const saved = state.favorites.has(listing.id);
  const basic = listing.dataCompleteness === 'basic';
  const reasons = listing.recommendationReasons.length
    ? listing.recommendationReasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')
    : `<li>${basic ? '네이버 공식 지역 검색에서 발견' : '선택 조건과 고르게 맞아요'}</li>`;
  const amenities = listing.amenities.slice(0, 4)
    .map((amenity) => `<span>${escapeHtml(amenityLabels[amenity] ?? amenity)}</span>`).join('');
  const facts = basic
    ? `<span>${escapeHtml(listing.category || '숙박 업체')}</span><span>상세 조건 원문 확인</span>`
    : `<span>최대 ${listing.capacity}명</span><span>욕실 ${listing.bathrooms}</span><span>침실 ${listing.bedrooms}</span>`;
  const image = listing.image || './assets/stay-hanok.svg';
  const distance = Number.isFinite(listing.distanceKm) ? `약 ${listing.distanceKm}km` : '거리 정보 없음';

  return `<article class="listing-card" data-id="${listing.id}">
    <div class="listing-visual">
      <img src="${image}" alt="숙소 유형을 나타내는 자체 제작 일러스트" loading="lazy">
      <span class="source-badge">${escapeHtml(listing.sourceLabel)}</span>
      <button class="save-button ${saved ? 'is-saved' : ''}" type="button" data-action="save" aria-label="${escapeHtml(listing.name)} ${saved ? '찜 취소' : '찜하기'}" aria-pressed="${saved}">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5 1.1-1.1a5.5 5.5 0 0 0 0-7.8Z"/></svg>
      </button>
      <span class="match-score">${basic ? '기본 정보' : `<strong>${listing.recommendationScore}</strong>% match`}</span>
    </div>
    <div class="listing-body">
      <div class="listing-kicker"><span>${escapeHtml(listing.location)}</span><span>${distance}</span></div>
      <h3>${escapeHtml(listing.name)}</h3>
      <ul class="reasons">${reasons}</ul>
      <div class="amenity-tags">${amenities}</div>
      <div class="facts">${facts}</div>
      <div class="card-bottom">
        <p><strong>${formatPrice(listing.pricePerNight)}</strong>${Number.isFinite(listing.pricePerNight) ? '<span> / 1박</span>' : ''}</p>
        <button type="button" class="detail-button" data-action="detail">자세히 보기</button>
      </div>
    </div>
  </article>`;
}

function render() {
  const ranked = rankListings(listings, state.purpose, state.origin);
  const filtered = filterListings(ranked, getFilters());
  const favoritesFiltered = state.favoritesOnly
    ? filtered.filter((listing) => state.favorites.has(listing.id))
    : filtered;
  const visible = sortListings(favoritesFiltered);

  elements.grid.innerHTML = visible.map(listingCard).join('');
  elements.grid.hidden = visible.length === 0;
  elements.empty.hidden = visible.length !== 0;
  elements.summary.textContent = state.favoritesOnly
    ? `찜한 숙소 ${visible.length}곳을 보고 있어요.`
    : state.dataMode === 'live'
      ? `네이버 공식 API에서 수집한 ${listings.length}곳 중 조건에 맞는 ${visible.length}곳입니다.`
      : `5개 출처의 샘플에서 조건에 맞는 ${visible.length}곳을 찾았어요.`;
  elements.savedCount.textContent = state.favorites.size;
  elements.savedSummary.classList.toggle('is-active', state.favoritesOnly);
  elements.savedSummary.setAttribute('aria-pressed', String(state.favoritesOnly));
}

function resetFilters() {
  elements.form.reset();
  elements.price.value = '300000';
  elements.priceOutput.textContent = '30만원';
  state.favoritesOnly = false;
  render();
}

function findListingFromEvent(event) {
  const card = event.target.closest('[data-id]');
  return card ? listings.find((listing) => listing.id === card.dataset.id) : null;
}

function showDetails(listing) {
  const ranked = rankListings([listing], state.purpose, state.origin)[0];
  const basic = ranked.dataCompleteness === 'basic';
  const amenityList = ranked.amenities.length
    ? ranked.amenities.map((item) => amenityLabels[item] ?? item).join(' · ')
    : 'API에서 제공하지 않음 — 원문에서 확인';
  const updatedAt = ranked.updatedAt
    ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ranked.updatedAt))
    : '정보 없음';
  const image = ranked.image || './assets/stay-hanok.svg';
  const distance = Number.isFinite(ranked.distanceKm) ? `약 ${ranked.distanceKm}km` : '거리 정보 없음';

  elements.dialogContent.innerHTML = `<img class="dialog-image" src="${image}" alt="숙소 유형을 나타내는 자체 제작 일러스트">
    <div class="dialog-body">
      <p class="dialog-source">${escapeHtml(ranked.sourceLabel)} · ${distance}</p>
      <h2 id="dialog-title">${escapeHtml(ranked.name)}</h2>
      <p class="dialog-location">${escapeHtml(ranked.location)}</p>
      <dl class="detail-facts">
        <div><dt>1박 비교가</dt><dd>${formatPrice(ranked.pricePerNight)}</dd></div>
        <div><dt>수용 인원</dt><dd>${Number.isFinite(ranked.capacity) ? `최대 ${ranked.capacity}명` : '원문 확인'}</dd></div>
        <div><dt>공간</dt><dd>${Number.isFinite(ranked.bedrooms) ? `침실 ${ranked.bedrooms} · 욕실 ${ranked.bathrooms}` : '원문 확인'}</dd></div>
        <div><dt>분류/평점</dt><dd>${basic ? escapeHtml(ranked.category || '숙박 업체') : `${ranked.rating || '-'} (${ranked.reviewCount}개)`}</dd></div>
      </dl>
      <div class="dialog-amenities"><strong>편의시설</strong><p>${escapeHtml(amenityList)}</p></div>
      <p class="updated">${basic ? 'API 수집' : '샘플 데이터 갱신'}: ${updatedAt}</p>
      <a class="source-link" href="${ranked.sourceUrl}" target="_blank" rel="noopener noreferrer">원문에서 최신 정보 확인 <span aria-hidden="true">↗</span></a>
      <p class="external-note">${basic ? '가격, 인원, 욕실, 편의시설과 사진은 네이버 지역 검색 API 제공 범위가 아니므로 원문에서 확인하세요.' : '샘플 데이터의 링크는 안전한 데모 페이지입니다.'}</p>
    </div>`;
  elements.dialog.showModal();
}

async function initializeProviders() {
  try {
    const response = await fetch('/api/providers');
    const providers = await response.json();
    elements.openAirbnb.href = providers.airbnb.searchUrl;
    elements.providerStatus.textContent = providers.naver.configured
      ? '네이버 API 인증 완료 · 공주 숙소를 가져올 수 있습니다. 에어비앤비는 공식 검색 링크로 연결됩니다.'
      : '네이버 API 키 설정 필요 · 에어비앤비는 파트너 승인 전까지 공식 검색 링크만 제공합니다.';
    elements.providerStatus.dataset.state = providers.naver.configured ? 'ready' : 'setup';
  } catch {
    elements.providerStatus.textContent = '연동 상태를 확인하지 못했습니다. 서버 실행 상태를 확인하세요.';
    elements.providerStatus.dataset.state = 'error';
  }
}

async function loadNaverListings() {
  const originalLabel = elements.loadNaver.textContent;
  elements.loadNaver.disabled = true;
  elements.loadNaver.textContent = '공주 숙소 수집 중…';
  elements.providerStatus.textContent = '6개 핵심 검색어의 리뷰 활동 기반 후보를 요청하고 있습니다.';

  try {
    const response = await fetch('/api/gongju-listings?target=30');
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || '네이버 API 요청 실패');

    listings = payload.listings.map(normalizeListing);
    state.dataMode = 'live';
    state.providerMeta = payload.meta;
    state.favoritesOnly = false;
    resetFilters();
    elements.noticeTitle.textContent = '네이버 실데이터 안내';
    elements.noticeCopy.textContent = `공식 NAVER API HUB 지역 검색을 ${payload.meta.queryCount}회 호출해 원본 ${payload.meta.rawCount}건을 찾고 중복 제거 후 ${payload.meta.returnedCount}곳을 표시합니다. 리뷰 활동 기반 정렬 후보이며 네이버 별점 필터가 아닙니다. 가격·인원·욕실·편의시설·사진은 API 미제공 정보입니다.`;
    elements.providerStatus.textContent = `네이버 인증 완료 · 공주 숙소 후보 ${payload.meta.returnedCount}곳 수집${payload.meta.partial ? ' (일부 검색 실패)' : ''}`;
    elements.providerStatus.dataset.state = 'ready';
  } catch (error) {
    elements.providerStatus.textContent = error.message;
    elements.providerStatus.dataset.state = 'error';
  } finally {
    elements.loadNaver.disabled = false;
    elements.loadNaver.textContent = originalLabel;
  }
}

elements.form.addEventListener('input', () => {
  elements.priceOutput.textContent = `${Number(elements.price.value) / 10000}만원`;
  render();
});
elements.form.addEventListener('change', render);
elements.sort.addEventListener('change', () => { state.sort = elements.sort.value; render(); });
document.querySelectorAll('[data-purpose]').forEach((button) => {
  const initiallyActive = button.dataset.purpose === state.purpose;
  button.classList.toggle('is-active', initiallyActive);
  button.setAttribute('aria-checked', String(initiallyActive));
  button.addEventListener('click', () => {
    state.purpose = button.dataset.purpose;
    document.querySelectorAll('[data-purpose]').forEach((item) => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-checked', String(active));
    });
    render();
  });
});
elements.grid.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  const listing = findListingFromEvent(event);
  if (!action || !listing) return;
  if (action === 'save') {
    if (state.favorites.has(listing.id)) state.favorites.delete(listing.id);
    else state.favorites.add(listing.id);
    saveFavorites();
    render();
  }
  if (action === 'detail') showDetails(listing);
});
elements.savedSummary.addEventListener('click', () => { state.favoritesOnly = !state.favoritesOnly; render(); });
elements.loadNaver.addEventListener('click', loadNaverListings);
document.querySelector('#reset-filters').addEventListener('click', resetFilters);
document.querySelector('#empty-reset').addEventListener('click', resetFilters);
document.querySelector('#dialog-close').addEventListener('click', () => elements.dialog.close());
elements.dialog.addEventListener('click', (event) => {
  if (event.target === elements.dialog) elements.dialog.close();
});
elements.location.addEventListener('click', () => {
  if (!navigator.geolocation) {
    elements.location.querySelector('span').textContent = '위치 사용 불가';
    return;
  }
  elements.location.disabled = true;
  elements.location.querySelector('span').textContent = '위치 확인 중';
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      state.origin = { lat: coords.latitude, lng: coords.longitude };
      state.originLabel = '현재 위치 기준';
      elements.location.disabled = false;
      elements.location.querySelector('span').textContent = state.originLabel;
      render();
    },
    () => {
      elements.location.disabled = false;
      elements.location.querySelector('span').textContent = '서울 기준';
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
  );
});

render();
initializeProviders();
