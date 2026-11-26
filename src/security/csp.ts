/**
 * 앱이 불러올 수 있는 곳을 자기 자신, 카카오, OpenStreetMap으로만 제한합니다(DESIGN 10장, U7-4).
 * 배포 빌드의 index.html에 meta 태그로 넣습니다(vite.config.ts).
 */
export const CSP_DIRECTIVES: Record<string, string[]> = {
  'default-src': ["'self'"],
  // 카카오 지도 SDK는 dapi.kakao.com에서 시작해 daumcdn.net·kakaocdn.net의 파일을 더 불러오고,
  // 검색 결과는 dapi.kakao.com에서 스크립트(JSONP)로 받습니다.
  'script-src': ["'self'", 'https://*.kakao.com', 'https://*.daumcdn.net', 'https://*.kakaocdn.net'],
  'connect-src': ["'self'", 'https://*.kakao.com', 'https://nominatim.openstreetmap.org'],
  // 지도 타일: OpenStreetMap(다녀온 곳 지도)
  'img-src': ["'self'", 'blob:', 'data:', 'https://*.daumcdn.net', 'https://tile.openstreetmap.org'],
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
