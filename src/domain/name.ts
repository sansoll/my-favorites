/** 앞뒤 공백을 지우고, 안쪽의 연속 공백은 하나로 줄입니다. */
export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** 같은 이름인지 비교할 때 쓰는 키: 공백을 모두 뺍니다(`팬 미팅` = `팬미팅`). */
export function nameKey(name: string): string {
  return name.replace(/\s+/g, '');
}

export function sameName(a: string, b: string): boolean {
  return nameKey(a) === nameKey(b);
}

export type NameCheck = { ok: true; name: string } | { ok: false; reason: 'empty' | 'duplicate' };

/** 빈 이름과 같은 목록 안의 중복(공백 무시)을 거부합니다. */
export function checkName(name: string, existing: string[] = []): NameCheck {
  const clean = cleanName(name);
  if (!clean) return { ok: false, reason: 'empty' };
  if (existing.some((e) => sameName(e, clean))) return { ok: false, reason: 'duplicate' };
  return { ok: true, name: clean };
}

type JosaPair = '을/를' | '이/가' | '과/와' | '은/는' | '으로/로';

/** 마지막 글자의 받침에 맞춰 조사를 붙입니다. 한글이 아니면 받침 없음으로 봅니다. */
export function josa(word: string, pair: JosaPair): string {
  const [withBatchim, without] = pair.split('/');
  const last = word.charCodeAt(word.length - 1);
  if (Number.isNaN(last) || last < 0xac00 || last > 0xd7a3) return word + without;
  const jong = (last - 0xac00) % 28;
  if (pair === '으로/로') return word + (jong === 0 || jong === 8 ? without : withBatchim); // ㄹ 받침은 '로'
  return word + (jong ? withBatchim : without);
}

const DIGIT_BATCHIM = [true, true, false, true, false, false, true, true, true, false];

/** 끝 글자에 받침이 있으면 true, 알 수 없으면 null(영문 등) */
function hasBatchim(word: string): boolean | null {
  const ch = word.trim().slice(-1);
  if (!ch) return null;
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (ch >= '0' && ch <= '9') return DIGIT_BATCHIM[Number(ch)];
  return null;
}

/** 이름 뒤 목적격 조사: 곡 1을, 노래를, Song을(를) */
export function withEulReul(word: string): string {
  const b = hasBatchim(word);
  return `${word}${b === null ? '을(를)' : b ? '을' : '를'}`;
}
