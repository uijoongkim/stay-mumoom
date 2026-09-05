const currency = new Intl.NumberFormat('ko-KR');

export function formatPrice(value) {
  return Number.isFinite(value) ? `${currency.format(value)}원` : '가격 미제공 · 원문 확인';
}

export function formatMaxPrice(value, unlimitedAt) {
  const amount = Number(value);
  if (amount >= Number(unlimitedAt)) return '제한 없음';
  return `${amount / 10000}만원 이하`;
}
