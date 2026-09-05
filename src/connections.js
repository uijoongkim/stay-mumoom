import { getProviderPresentation } from './journey.js';

const status = document.querySelector('[data-provider="naver"] .connection-status');
const airbnbLink = document.querySelector('#connection-airbnb');

async function initializeConnections() {
  try {
    const response = await fetch('/api/providers');
    if (!response.ok) throw new Error('provider status unavailable');
    const providers = await response.json();
    const naver = getProviderPresentation(providers.naver);
    status.dataset.state = naver.state;
    status.textContent = naver.label;
    airbnbLink.href = providers.airbnb.searchUrl;
  } catch {
    status.dataset.state = 'error';
    status.textContent = '서버 확인 필요';
  }
}

initializeConnections();
