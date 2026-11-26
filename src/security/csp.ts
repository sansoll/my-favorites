/**
 * 앱이 불러올 수 있는 곳을 자기 자신, 카카오, OpenStreetMap으로만 제한합니다(DESIGN 10장, U7-4).
 * 배포 빌드의 index.html에 meta 태그로 넣습니다(vite.config.ts).
 */
export const CSP_DIRECTIVES: Record<string, string[]> = {
  'default-src': ["'self'"],
  // 카카오 지도 SDK는 dapi.kakao.com에서 시작해 t1.daumcdn.net의 파일을 더 불러옵니다.
  'script-src': ["'self'", 'https://dapi.kakao.com', 'https://t1.daumcdn.net'],
  'connect-src': ["'self'", 'https://dapi.kakao.com', 'https://nominatim.openstreetmap.org'],
  'img-src': ["'self'", 'blob:', 'data:', 'https://*.daumcdn.net'],
  'style-src': ["'self'", "'unsafe-inline'"],
  'font-src': ["'self'", 'blob:', 'data:'],
  'worker-src': ["'self'"],
  'manifest-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'none'"],
};

export function cspContent(): string {
  return Object.entries(CSP_DIRECTIVES).map(([k, v]) => `${k} ${v.join(' ')}`).join('; ');
}
