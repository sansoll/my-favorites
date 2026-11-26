/** 화면 꺼짐 방지(U8-6). 지원하지 않는 브라우저에서는 null을 돌려주고 조용히 넘어갑니다. */
export async function keepScreenOn(): Promise<(() => void) | null> {
  const wl = typeof navigator !== 'undefined' ? (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock : undefined;
  if (!wl) return null;
  try {
    const sentinel = await wl.request('screen');
    return () => { void sentinel.release().catch(() => undefined); };
  } catch {
    return null;
  }
}
