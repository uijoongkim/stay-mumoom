import { join, normalize, relative } from 'node:path';

export function resolvePublicFilePath(root, pathname) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const segments = relativePath.split('/');

  if (segments.some((segment) => !segment || segment.startsWith('.'))) return null;

  const filePath = normalize(join(root, relativePath));
  const pathFromRoot = relative(root, filePath);
  if (pathFromRoot.startsWith('..') || pathFromRoot === '') return null;

  return filePath;
}
