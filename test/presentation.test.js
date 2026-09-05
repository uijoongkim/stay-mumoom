import test from 'node:test';
import assert from 'node:assert/strict';

import { formatMaxPrice, formatPrice } from '../src/presentation.js';

test('가격은 원 단위 천 단위 구분자로 표시한다', () => {
  assert.equal(formatPrice(198000), '198,000원');
  assert.equal(formatPrice(null), '가격 미제공 · 원문 확인');
});

test('가격 슬라이더 최댓값은 제한 없음으로 표시한다', () => {
  assert.equal(formatMaxPrice(300000, 300000), '제한 없음');
  assert.equal(formatMaxPrice(190000, 300000), '19만원 이하');
});