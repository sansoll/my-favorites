/** 금액은 원 단위 정수입니다. */
export const MAX_DIGITS = 10;

export function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

/** 입력에서 숫자만 뽑아 정수로. 앞의 0은 무시하고, 숫자가 없으면 0. */
export function parseDigits(input: string): number {
  const digits = input.replace(/\D/g, '').replace(/^0+/, '');
  return digits ? Number(digits) : 0;
}

export type AmountCheck = { ok: true } | { ok: false; reason: 'zero' | 'negative' | 'tooLong' | 'notInteger' };

export function checkAmount(n: number): AmountCheck {
  if (!Number.isInteger(n)) return { ok: false, reason: 'notInteger' };
  if (n < 0) return { ok: false, reason: 'negative' };
  if (n === 0) return { ok: false, reason: 'zero' };
  if (String(n).length > MAX_DIGITS) return { ok: false, reason: 'tooLong' };
  return { ok: true };
}

export function isValidAmount(n: number): boolean {
  return checkAmount(n).ok;
}
