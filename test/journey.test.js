import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildExploreUrl,
  getProviderPresentation,
  getPurposeFromSearch,
} from '../src/journey.js';

test('메인 화면의 여행 목적을 탐색 URL에 안전하게 반영한다', () => {
  assert.equal(buildExploreUrl('couple'), './explore.html?purpose=couple');
  assert.equal(buildExploreUrl('family'), './explore.html?purpose=family');
  assert.equal(buildExploreUrl('unknown'), './explore.html?purpose=couple');
});

test('탐색 화면은 허용된 여행 목적만 URL에서 복원한다', () => {
  assert.equal(getPurposeFromSearch('?purpose=family'), 'family');
  assert.equal(getPurposeFromSearch('?purpose=friends'), 'friends');
  assert.equal(getPurposeFromSearch('?purpose=admin'), 'couple');
});

test('공급자 연결 상태는 API 인증과 외부 링크 모드를 구분한다', () => {
  assert.deepEqual(getProviderPresentation({ configured: true, mode: 'official-api' }), {
    state: 'connected',
    label: '공식 API 연결됨',
  });
  assert.deepEqual(getProviderPresentation({ configured: false, mode: 'outbound-search' }), {
    state: 'link-only',
    label: '공식 검색 링크',
  });
});
