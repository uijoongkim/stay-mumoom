import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { resolvePublicFilePath } from '../src/static-files.js';

test('정적 파일 경로는 dotfile과 저장소 메타데이터를 차단한다', () => {
  const root = '/tmp/stay-curator';

  assert.equal(resolvePublicFilePath(root, '/.env'), null);
  assert.equal(resolvePublicFilePath(root, '/.git/config'), null);
  assert.equal(resolvePublicFilePath(root, '/docs/.draft.md'), null);
  assert.equal(resolvePublicFilePath(root, '/src/app.js'), join(root, 'src/app.js'));
  assert.equal(resolvePublicFilePath(root, '/'), join(root, 'index.html'));
});
