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

export function projectListings(payload, target, cached) {
  const listings = payload.listings.slice(0, target);
  return {
    ...payload,
    listings,
    meta: {
      ...payload.meta,
      target,
      returnedCount: listings.length,
      cached,
    },
  };
}
