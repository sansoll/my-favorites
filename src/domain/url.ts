/**
 * 링크는 `http`·`https` 주소만 저장하고 엽니다(DESIGN 10장, U7-4).
 * 앞뒤 공백을 빼고, 다른 형식(`javascript:`, `data:` 등)이면 null.
 */
export function safeUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  let u: URL;
  try { u = new URL(text); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  return u.href;
}
