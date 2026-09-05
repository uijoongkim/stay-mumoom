const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const searchError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  error.status = 400;
  error.publicMessage = message;
  return error;
};

export function normalizeRegion(value) {
  const region = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ');
  if (!region) throw searchError('REGION_REQUIRED', '검색할 지역을 입력해 주세요.');
  if (region.length > 40) throw searchError('REGION_TOO_LONG', '지역은 40자 이내로 입력해 주세요.');
  if (!/^[\p{L}\p{N}\s.-]+$/u.test(region) || !/[\p{L}\p{N}]/u.test(region)) {
    throw searchError('INVALID_REGION', '한글·영문·숫자로 된 지역명을 입력해 주세요.');
  }
  const meaningful = region.split(' ')
    .map((token) => token.replace(/(특별자치도|특별자치시|광역시|특별시|도|시|군|구|읍|면|동)$/u, ''))
    .some((token) => token.length >= 2);
  if (!meaningful) throw searchError('INVALID_REGION', '시·군·구보다 구체적인 지역명을 입력해 주세요.');
  return region;
}

export function normalizeTarget(value, fallback = 30, maximum = 30) {
  if (value === null || value === undefined || value === '') return fallback;
  const rawTarget = String(value).trim();
  const target = Number(rawTarget);
  if (!/^[1-9]\d*$/.test(rawTarget) || !Number.isInteger(target) || target > maximum) {
    throw searchError('INVALID_TARGET', `target은 1부터 ${maximum} 사이 정수여야 합니다.`);
  }
  return target;
}

const normalizeDate = (value, label) => {
  const date = String(value ?? '').trim();
  if (!date) return '';
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const validCalendarDate = DATE_PATTERN.test(date)
    && year >= 1000
    && parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
  if (!validCalendarDate) {
    throw searchError('INVALID_DATE', `${label} 날짜를 확인해 주세요.`);
  }
  return date;
};

export function normalizeSearchCriteria(input = {}) {
  const region = normalizeRegion(input.region);
  const checkin = normalizeDate(input.checkin, '체크인');
  const checkout = normalizeDate(input.checkout, '체크아웃');
  if (!checkin || !checkout) {
    throw searchError('DATE_REQUIRED', '체크인과 체크아웃 날짜를 모두 선택해 주세요.');
  }
  if (checkin && checkout && checkout <= checkin) {
    throw searchError('INVALID_DATE_RANGE', '체크아웃은 체크인 다음 날 이후로 선택해 주세요.');
  }

  const guestsInput = input.guests ?? 2;
  const minRatingInput = input.minRating ?? 4.5;
  const guestsText = String(guestsInput).trim();
  const minRatingText = String(minRatingInput).trim();
  const guestsValue = Number(guestsText);
  const minRatingValue = Number(minRatingText);
  if (!/^[1-9]\d*$/.test(guestsText) || !Number.isInteger(guestsValue) || guestsValue > 16) {
    throw searchError('INVALID_GUESTS', '숙박 인원은 1명부터 16명 사이 정수여야 합니다.');
  }
  if (!/^\d+(?:\.\d+)?$/.test(minRatingText) || !Number.isFinite(minRatingValue) || minRatingValue < 0 || minRatingValue > 5) {
    throw searchError('INVALID_MIN_RATING', '최소 평점은 0부터 5 사이 숫자여야 합니다.');
  }
  return {
    region,
    checkin,
    checkout,
    guests: guestsValue,
    minRating: minRatingValue,
  };
}
