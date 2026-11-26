/** 대상 색. 통계와 내역 표시에만 쓰입니다. 색이 서로 밝기도 달라서 색을 구분하기 어려워도 알아볼 수 있게 골랐습니다. */
export const TARGET_COLORS = ['#D9487A', '#3A8FD6', '#2E9E6B', '#E08A1E', '#8E5BD6', '#C94F4F', '#1F8FA0', '#6B7A2E'];
export const ETC_COLOR = '#8A8A94';

export function nextTargetColor(used: string[]): string {
  const free = TARGET_COLORS.find((c) => !used.includes(c));
  return free ?? TARGET_COLORS[used.length % TARGET_COLORS.length];
}
