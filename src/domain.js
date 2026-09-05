const SOURCE_LABELS = {
  airbnb: '에어비앤비',
  yanolja: '야놀자',
  yeogi: '여기어때',
  naver: '네이버',
  direct: '개인 호스팅',
};

const PURPOSE_RULES = {
  couple: {
    tags: ['romantic', 'nature', 'private'],
    amenities: ['bathtub', 'hinoki', 'sauna'],
    tagReason: '둘만의 휴식에 어울리는 분위기',
    amenityReason: '프라이빗 스파 편의시설',
  },
  family: {
    tags: ['family', 'nature'],
    amenities: ['pool', 'bbq', 'kitchen'],
    tagReason: '가족 여행에 편안한 구성',
    amenityReason: '함께 즐기기 좋은 편의시설',
  },
  friends: {
    tags: ['group', 'activity'],
    amenities: ['bbq', 'pool', 'sauna'],
    tagReason: '여럿이 머물기 좋은 공간',
    amenityReason: '모임에 어울리는 즐길 거리',
  },
};

const pick = (input, ...keys) => {
  for (const key of keys) {
    if (input[key] !== undefined && input[key] !== null) return input[key];
  }
  return undefined;
};

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export function normalizeListing(input) {
  const source = pick(input, 'source', 'platform') ?? 'direct';
  const sourceId = String(pick(input, 'sourceId', 'listingId', 'id'));
  const lat = Number(pick(input, 'lat', 'latitude'));
  const lng = Number(pick(input, 'lng', 'longitude'));

  return {
    id: `${source}:${sourceId}`,
    source,
    sourceLabel: SOURCE_LABELS[source] ?? source,
    sourceUrl: pick(input, 'sourceUrl', 'href', 'url') ?? '#',
    name: pick(input, 'name', 'title') ?? '이름 없는 숙소',
    location: pick(input, 'location', 'region', 'address') ?? '지역 정보 없음',
    coordinates: { lat, lng },
    pricePerNight: toNullableNumber(pick(input, 'pricePerNight', 'nightlyPrice', 'price')),
    capacity: toNullableNumber(pick(input, 'capacity', 'maxGuests', 'guests')),
    bathrooms: toNullableNumber(pick(input, 'bathrooms', 'bathCount')),
    bedrooms: toNullableNumber(pick(input, 'bedrooms', 'roomCount')),
    amenities: [...(pick(input, 'amenities', 'features') ?? [])],
    tags: [...(pick(input, 'tags', 'themes') ?? [])],
    image: pick(input, 'image', 'imageUrl') ?? '',
    rating: toNullableNumber(pick(input, 'rating', 'score')),
    reviewCount: toNullableNumber(pick(input, 'reviewCount', 'reviews')),
    verified: Boolean(pick(input, 'verified', 'isVerified') ?? false),
    updatedAt: pick(input, 'updatedAt', 'lastUpdated') ?? null,
    category: pick(input, 'category') ?? '',
    description: pick(input, 'description') ?? '',
    dataCompleteness: pick(input, 'dataCompleteness') ?? 'full',
  };
}

export function filterListings(listings, filters = {}) {
  const query = String(filters.query ?? '').trim().toLocaleLowerCase('ko-KR');
  const maxPrice = Number(filters.maxPrice) || Number.POSITIVE_INFINITY;
  const minBathrooms = Number(filters.minBathrooms) || 0;
  const minGuests = Number(filters.minGuests) || 0;
  const minRating = Number(filters.minRating) || 0;
  const amenities = filters.amenities ?? [];

  return listings.filter((listing) => {
    const searchable = `${listing.name} ${listing.location} ${listing.category} ${listing.description} ${listing.tags.join(' ')}`.toLocaleLowerCase('ko-KR');
    const matchesPrice = maxPrice === Number.POSITIVE_INFINITY
      || (Number.isFinite(listing.pricePerNight) && listing.pricePerNight <= maxPrice);
    const matchesBathrooms = minBathrooms === 0
      || (Number.isFinite(listing.bathrooms) && listing.bathrooms >= minBathrooms);
    const matchesGuests = minGuests === 0
      || (Number.isFinite(listing.capacity) && listing.capacity >= minGuests);
    const matchesRating = minRating === 0
      || (Number.isFinite(listing.rating) && listing.rating >= minRating);
    return (!query || searchable.includes(query))
      && matchesPrice
      && matchesBathrooms
      && matchesGuests
      && matchesRating
      && amenities.every((amenity) => listing.amenities.includes(amenity));
  });
}

export function calculateDistanceKm(origin, destination) {
  if (!origin || !destination) return Number.NaN;
  const values = [origin.lat, origin.lng, destination.lat, destination.lng];
  if (values.some((value) => !Number.isFinite(value))) return Number.NaN;

  const toRadians = (degrees) => degrees * (Math.PI / 180);
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(destination.lat - origin.lat);
  const deltaLng = toRadians(destination.lng - origin.lng);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(origin.lat)) * Math.cos(toRadians(destination.lat))
    * Math.sin(deltaLng / 2) ** 2;
  const directDistance = earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(directDistance * 1.2);
}

export function rankListings(listings, purpose = 'couple', origin) {
  const rules = PURPOSE_RULES[purpose] ?? PURPOSE_RULES.couple;

  return listings.map((listing) => {
    let score = 42;
    const reasons = [];
    const matchedTags = rules.tags.filter((tag) => listing.tags.includes(tag));
    const matchedAmenities = rules.amenities.filter((amenity) => listing.amenities.includes(amenity));

    if (matchedTags.length) {
      score += matchedTags.length * 9;
      reasons.push(rules.tagReason);
    }
    if (matchedAmenities.length) {
      score += matchedAmenities.length * 7;
      reasons.push(rules.amenityReason);
    }
    if (purpose === 'family' && listing.capacity >= 6) {
      score += 10;
      reasons.push(`${listing.capacity}명까지 넉넉하게`);
    }
    if (purpose === 'friends' && listing.capacity >= 5) {
      score += 10;
      reasons.push('그룹 숙박에 충분한 정원');
    }
    if (listing.rating >= 4.7 && listing.reviewCount >= 20) {
      score += 8;
      reasons.push('후기로 확인된 높은 만족도');
    }
    if (listing.verified) score += 4;

    const distanceKm = calculateDistanceKm(origin, listing.coordinates);
    if (Number.isFinite(distanceKm) && distanceKm <= 150) score += 5;

    return {
      ...listing,
      distanceKm,
      recommendationScore: Math.min(100, score),
      recommendationReasons: reasons.slice(0, 3),
    };
  }).sort((a, b) => b.recommendationScore - a.recommendationScore);
}
