import test from 'node:test';
import assert from 'node:assert/strict';

import { createLatestRequestGuard } from '../src/request-guard.js';

test('새 요청이나 입력 변경은 이전 요청을 중단하고 응답을 무효화한다', () => {
  const guard = createLatestRequestGuard();
  const first = guard.begin();

  guard.invalidate();

  assert.equal(first.signal.aborted, true);
  assert.equal(first.isCurrent(), false);

  const second = guard.begin();
  assert.equal(second.signal.aborted, false);
  assert.equal(second.isCurrent(), true);

  const third = guard.begin();
  assert.equal(second.signal.aborted, true);
  assert.equal(second.isCurrent(), false);
  assert.equal(third.isCurrent(), true);
});
