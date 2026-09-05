import { amenityLabels, rawListings } from './data.js';
import { filterListings, normalizeListing, rankListings } from './domain.js';
import { getPurposeFromSearch } from './journey.js';
import { formatMaxPrice, formatPrice } from './presentation.js';
import { getAirbnbSearchUrl } from './providers.js';
import { createLatestRequestGuard } from './request-guard.js';
import { normalizeSearchCriteria } from './search.js';

const sampleListings = rawListings.map(normalizeListing);
let listings = [...sampleListings];
const defaultOrigin = { lat: 37.5665, lng: 126.978 };
const state = {
  purpose: getPurposeFromSearch(window.location.search),
  origin: defaultOrigin,
  originLabel: '서울 기준',
  sort: 'recommendation',
  favoritesOnly: false,
  favorites: loadFavorites(),
  dataMode: 'sample',
  providerMeta: null,
  providerConfigured: null,
  activeMinRating: 4.5,
};

const SAMPLE_NOTICE_TITLE = 'PoC 데이터 안내';
const SAMPLE_NOTICE_COPY = '현재 화면은 기능 검증용 가상 숙소 데이터이며 평점 4.5 이상만 표시합니다. 네이버 실데이터의 별점·가격·욕실·인원·편의시설·사진은 지역 검색 API 제공 범위가 아니므로, 검색 후에는 평점 미검증 후보로 별도 안내합니다.';
const SEARCH_BUTTON_LABEL = '이 조건으로 네이버 검색';
const searchRequests = createLatestRequestGuard();

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
  region: document.querySelector('#region'),
  checkin: document.querySelector('#checkin'),
  checkout: document.querySelector('#checkout'),
  resultsTitle: document.querySelector('#results-title'),
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
  if (state.dataMode === 'live') {
    return { query: '', maxPrice: null, minBathrooms: 0, minGuests: 0, minRating: 0, amenities: [] };
  }
  return {
    query: formData.get('region'),
    maxPrice: Number(formData.get('maxPrice')) < 300000 ? formData.get('maxPrice') : null,
    minBathrooms: formData.get('minBathrooms'),
    minGuests: formData.get('guests'),
    minRating: formData.get('minRating'),
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
  const image = listing.image
    ? `<img src="${escapeHtml(listing.image)}" alt="${escapeHtml(listing.name)} 샘플 이미지" loading="lazy">`
    : '<div class="photo-unavailable" role="img" aria-label="사진 미제공"><span>사진 미제공</span><small>공식 원문에서 확인</small></div>';
  const distance = Number.isFinite(listing.distanceKm) ? `약 ${listing.distanceKm}km` : '거리 정보 없음';
  const rating = Number.isFinite(listing.rating) ? `평점 ${listing.rating}` : '평점 미제공';

  return `<article class="listing-card" data-id="${listing.id}">
    <div class="listing-visual">
      ${image}
      <span class="source-badge">${escapeHtml(listing.sourceLabel)}</span>
      <button class="save-button ${saved ? 'is-saved' : ''}" type="button" data-action="save" aria-label="${escapeHtml(listing.name)} ${saved ? '찜 취소' : '찜하기'}" aria-pressed="${saved}">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5 1.1-1.1a5.5 5.5 0 0 0 0-7.8Z"/></svg>
      </button>
      <span class="match-score">${basic ? '평점 미검증' : `<strong>${listing.recommendationScore}</strong>% match`}</span>
    </div>
    <div class="listing-body">
      <div class="listing-kicker"><span>${escapeHtml(listing.location)}</span><span>${rating} · ${distance}</span></div>
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
      ? `네이버 공식 API 후보 ${listings.length}곳입니다. 선택한 평점 ${state.activeMinRating} 이상 여부는 원문에서 확인해야 합니다.`
      : `5개 출처의 샘플 중 평점 기준과 조건에 맞는 ${visible.length}곳을 찾았어요.`;
  elements.savedCount.textContent = state.favorites.size;
  elements.savedSummary.classList.toggle('is-active', state.favoritesOnly);
  elements.savedSummary.setAttribute('aria-pressed', String(state.favoritesOnly));
}

function resetFilters() {
  invalidatePendingSearch();
  elements.form.reset();
  setDefaultDates();
  elements.price.value = '300000';
  elements.priceOutput.textContent = '제한 없음';
  state.favoritesOnly = false;
  restoreSampleView();
  updateAirbnbLink();
  render();
}

function setProviderStatus() {
  if (state.providerConfigured === true) {
    elements.providerStatus.textContent = '네이버 API 인증 완료 · 전국 지역 후보를 검색할 수 있습니다. 에어비앤비는 같은 지역·날짜의 공식 검색으로 연결됩니다.';
    elements.providerStatus.dataset.state = 'ready';
  } else if (state.providerConfigured === false) {
    elements.providerStatus.textContent = '네이버 API 키 설정 필요 · 에어비앤비는 파트너 승인 전까지 공식 검색 링크만 제공합니다.';
    elements.providerStatus.dataset.state = 'setup';
  }
}

function restoreSampleView({ restoreProvider = true } = {}) {
  state.dataMode = 'sample';
  state.providerMeta = null;
  state.activeMinRating = 4.5;
  listings = [...sampleListings];
  elements.resultsTitle.textContent = '지금 잘 맞는 숙소';
  elements.noticeTitle.textContent = SAMPLE_NOTICE_TITLE;
  elements.noticeCopy.textContent = SAMPLE_NOTICE_COPY;
  if (restoreProvider) setProviderStatus();
}

function invalidatePendingSearch() {
  searchRequests.invalidate();
  elements.loadNaver.disabled = false;
  elements.loadNaver.textContent = SEARCH_BUTTON_LABEL;
}

function currentSearchCriteria() {
  const formData = new FormData(elements.form);
  return normalizeSearchCriteria({
    region: formData.get('region'),
    checkin: formData.get('checkin'),
    checkout: formData.get('checkout'),
    guests: formData.get('guests'),
    minRating: formData.get('minRating'),
  });
}

function updateAirbnbLink(criteria = null) {
  try {
    const activeCriteria = criteria ?? currentSearchCriteria();
    elements.openAirbnb.href = getAirbnbSearchUrl({
      region: activeCriteria.region,
      checkin: activeCriteria.checkin,
      checkout: activeCriteria.checkout,
      adults: activeCriteria.guests,
    });
  } catch {
    elements.openAirbnb.href = 'https://www.airbnb.co.kr/';
  }
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
  const image = ranked.image
    ? `<img class="dialog-image" src="${escapeHtml(ranked.image)}" alt="${escapeHtml(ranked.name)} 샘플 이미지">`
    : '<div class="dialog-image photo-unavailable" role="img" aria-label="사진 미제공"><span>사진 미제공</span><small>공식 원문에서 확인</small></div>';
  const distance = Number.isFinite(ranked.distanceKm) ? `약 ${ranked.distanceKm}km` : '거리 정보 없음';

  elements.dialogContent.innerHTML = `${image}
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
    state.providerConfigured = providers.naver.configured;
    setProviderStatus();
  } catch {
    elements.providerStatus.textContent = '연동 상태를 확인하지 못했습니다. 서버 실행 상태를 확인하세요.';
    elements.providerStatus.dataset.state = 'error';
  }
}

async function loadNaverListings() {
  invalidatePendingSearch();
  let criteria;
  try {
    criteria = currentSearchCriteria();
  } catch (error) {
    elements.providerStatus.textContent = error.message;
    elements.providerStatus.dataset.state = 'error';
    return;
  }
  const request = searchRequests.begin();
  updateAirbnbLink(criteria);
  restoreSampleView({ restoreProvider: false });
  render();
  elements.loadNaver.disabled = true;
  elements.loadNaver.textContent = `${criteria.region} 숙소 검색 중…`;
  elements.providerStatus.textContent = `${criteria.region}의 6개 제한 검색어로 후보를 요청하고 있습니다.`;

  try {
    const params = new URLSearchParams({ ...criteria, target: '30' });
    const response = await fetch(`/api/listings?${params}`, { signal: request.signal });
    const payload = await response.json();
    if (!request.isCurrent()) return;
    if (!response.ok) throw new Error(payload.message || '네이버 API 요청 실패');

    listings = payload.listings.map(normalizeListing);
    state.dataMode = 'live';
    state.providerMeta = payload.meta;
    state.activeMinRating = criteria.minRating;
    state.favoritesOnly = false;
    elements.openAirbnb.href = payload.airbnb.searchUrl;
    elements.resultsTitle.textContent = `${criteria.region} 네이버 후보`;
    render();
    elements.noticeTitle.textContent = '평점 미검증 NAVER 후보';
    elements.noticeCopy.textContent = `공식 NAVER API HUB 지역 검색을 ${payload.meta.queryCount}회 호출해 원본 ${payload.meta.rawCount}건을 찾고 중복 제거 후 ${payload.meta.returnedCount}곳을 표시합니다. NAVER 지역 검색 API에는 별점·가격·인원·욕실·편의시설·사진·날짜별 재고가 없어 ${criteria.minRating} 이상 추천 목록에는 포함하지 않았습니다. 각 원문에서 최신 정보를 확인하세요.`;
    elements.providerStatus.textContent = `네이버 인증 완료 · ${criteria.region} 후보 ${payload.meta.returnedCount}곳 수집${payload.meta.cached ? ' (캐시)' : ''}${payload.meta.partial ? ' (일부 검색 실패)' : ''}`;
    elements.providerStatus.dataset.state = 'ready';
  } catch (error) {
    if (error.name === 'AbortError' || !request.isCurrent()) return;
    elements.providerStatus.textContent = error.message;
    elements.providerStatus.dataset.state = 'error';
  } finally {
    if (request.isCurrent()) {
      elements.loadNaver.disabled = false;
      elements.loadNaver.textContent = SEARCH_BUTTON_LABEL;
      request.complete();
    }
  }
}

elements.form.addEventListener('input', () => {
  invalidatePendingSearch();
  elements.priceOutput.textContent = formatMaxPrice(elements.price.value, elements.price.max);
  restoreSampleView();
  updateAirbnbLink();
  render();
});
elements.form.addEventListener('change', () => {
  invalidatePendingSearch();
  restoreSampleView();
  updateAirbnbLink();
  render();
});
elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  loadNaverListings();
});
elements.loadNaver.addEventListener('click', () => {
  if (elements.form.reportValidity()) loadNaverListings();
});
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

function toDateInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function setDefaultDates() {
  const checkin = new Date();
  checkin.setDate(checkin.getDate() + 7);
  const checkout = new Date(checkin);
  checkout.setDate(checkout.getDate() + 1);
  const today = toDateInputValue(new Date());
  elements.checkin.min = today;
  elements.checkin.value = toDateInputValue(checkin);
  elements.checkout.min = toDateInputValue(new Date(checkin.getFullYear(), checkin.getMonth(), checkin.getDate() + 1));
  elements.checkout.value = toDateInputValue(checkout);
}

elements.checkin.addEventListener('change', () => {
  if (!elements.checkin.value) return;
  const nextDay = new Date(`${elements.checkin.value}T00:00:00`);
  nextDay.setDate(nextDay.getDate() + 1);
  elements.checkout.min = toDateInputValue(nextDay);
  if (!elements.checkout.value || elements.checkout.value <= elements.checkin.value) {
    elements.checkout.value = toDateInputValue(nextDay);
  }
});

setDefaultDates();
updateAirbnbLink();
render();
initializeProviders();
