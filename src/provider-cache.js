export function createProviderCache({ ttlMs, load, now = Date.now }) {
  let cached = null;
  let inFlight = null;

  async function get() {
    const fresh = cached && now() - cached.createdAt < ttlMs;
    if (fresh) return { payload: cached.payload, cached: true };
    if (inFlight) return inFlight;

    inFlight = (async () => {
      const payload = await load();
      cached = { createdAt: now(), payload };
      return { payload, cached: false };
    })();

    try {
      return await inFlight;
    } finally {
      inFlight = null;
    }
  }

  return { get };
}

export function createKeyedProviderCache({ ttlMs, load, now = Date.now, maxEntries = 50 }) {
  const entries = new Map();

  function enforceBound() {
    while (entries.size > maxEntries) {
      const evictable = [...entries].find(([, entry]) => !entry.inFlight);
      if (!evictable) return;
      entries.delete(evictable[0]);
    }
  }

  function get(key) {
    let entry = entries.get(key);
    const fresh = entry?.payload && now() - entry.createdAt < ttlMs;
    if (fresh) return Promise.resolve({ payload: entry.payload, cached: true });
    if (entry?.inFlight) return entry.inFlight;

    if (!entry) {
      entry = { createdAt: 0, payload: null, inFlight: null };
      entries.set(key, entry);
    }

    const loadPromise = (async () => {
      const payload = await load(key);
      entry.payload = payload;
      entry.createdAt = now();
      return { payload, cached: false };
    })();
    entry.inFlight = loadPromise.finally(() => {
      entry.inFlight = null;
      enforceBound();
    });
    enforceBound();
    return entry.inFlight;
  }

  return { get, size: () => entries.size };
}

export function projectListings(payload, target, cached) {
  const listings = payload.listings.slice(0, target);
  return {
    ...payload,
    ...(payload.airbnb ? { airbnb: { ...payload.airbnb } } : {}),
    listings,
    meta: {
      ...payload.meta,
      target,
      returnedCount: listings.length,
      cached,
    },
  };
}
