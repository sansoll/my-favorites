import { checkAmount, formatWon, parseDigits } from './money';

describe('금액 도구 (U0-5)', () => {
  it('콤마 표시', () => {
    expect(formatWon(154000)).toBe('154,000원');
    expect(formatWon(0)).toBe('0원');
    expect(formatWon(2166880)).toBe('2,166,880원');
  });

  it('입력에서 숫자만 뽑기', () => {
    expect(parseDigits('154,000원')).toBe(154000);
    expect(parseDigits('00123')).toBe(123);
    expect(parseDigits('abc')).toBe(0);
    expect(parseDigits('')).toBe(0);
  });

  it('0과 음수 거부', () => {
    expect(checkAmount(0)).toEqual({ ok: false, reason: 'zero' });
    expect(checkAmount(-500)).toEqual({ ok: false, reason: 'negative' });
    expect(checkAmount(1).ok).toBe(true);
  });

  it('10자리 넘으면 거부', () => {
    expect(checkAmount(9_999_999_999).ok).toBe(true);
    expect(checkAmount(10_000_000_000)).toEqual({ ok: false, reason: 'tooLong' });
  });

  it('소수 거부', () => {
    expect(checkAmount(1.5)).toEqual({ ok: false, reason: 'notInteger' });
  });
});
