export function createConcurrencyLimiter(maxConcurrent) {
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) throw new TypeError('maxConcurrent must be a positive integer');
  let active = 0;
  const queue = [];

  function drain() {
    while (active < maxConcurrent && queue.length > 0) {
      const entry = queue.shift();
      active += 1;
      Promise.resolve()
        .then(entry.task)
        .then(entry.resolve, entry.reject)
        .finally(() => {
          active -= 1;
          drain();
        });
    }
  }

  function run(task) {
    return new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      drain();
    });
  }

  return { run };
}

export function createFixedWindowRateLimiter({ limit, windowMs, now = Date.now, maxKeys = 1000 }) {
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError('limit must be a positive integer');
  const windows = new Map();

  function consume(key) {
    const currentTime = now();
    let entry = windows.get(key);
    if (!entry || currentTime - entry.startedAt >= windowMs) {
      entry = { startedAt: currentTime, count: 0 };
      windows.set(key, entry);
    }
    if (windows.size > maxKeys) {
      const staleKey = [...windows].find(([, value]) => currentTime - value.startedAt >= windowMs)?.[0];
      if (staleKey !== undefined) windows.delete(staleKey);
    }
    if (entry.count >= limit) {
      return { allowed: false, retryAfterMs: Math.max(1, windowMs - (currentTime - entry.startedAt)) };
    }
    entry.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  return { consume };
}
