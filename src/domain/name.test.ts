import { checkName, cleanName, josa, sameName } from './name';

describe('이름 도구 (U0-6)', () => {
  it('앞뒤 공백 제거', () => {
    expect(cleanName('  가수 A  ')).toBe('가수 A');
    expect(cleanName('팬   미팅')).toBe('팬 미팅');
  });

  it('공백을 모두 뺀 비교', () => {
    expect(sameName('팬 미팅', '팬미팅')).toBe(true);
    expect(sameName('팬미팅', '팬싸인회')).toBe(false);
  });

  it('빈 이름 거부', () => {
    expect(checkName('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(checkName('')).toEqual({ ok: false, reason: 'empty' });
  });

  it('같은 목록의 중복 거부', () => {
    expect(checkName('팬 미팅', ['콘서트', '팬미팅'])).toEqual({ ok: false, reason: 'duplicate' });
    expect(checkName(' 굿즈 ', ['콘서트'])).toEqual({ ok: true, name: '굿즈' });
  });

  it('조사', () => {
    expect(josa('가수 A', '을/를')).toBe('가수 A를');
    expect(josa('콘서트', '을/를')).toBe('콘서트를');
    expect(josa('행사', '이/가')).toBe('행사가');
    expect(josa('곡', '이/가')).toBe('곡이');
    expect(josa('팬미팅', '과/와')).toBe('팬미팅과');
    expect(josa('굿즈', '과/와')).toBe('굿즈와');
    expect(josa('서울', '으로/로')).toBe('서울로');
    expect(josa('집', '으로/로')).toBe('집으로');
  });
});
