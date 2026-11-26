import type { PresetItem } from '../data/types';
import { josa } from './name';

/** 첫 실행 때 묻는 기본 프리셋. `기타`는 어느 프리셋에나 항상 있어서 적지 않습니다. */
export const BASE_PRESETS: { name: string; hint: string; items: PresetItem[]; checked: boolean }[] = [
  {
    name: '가수용',
    hint: '행사, 경비, 상품, 멤버십, 서포트',
    checked: true,
    items: [
      { name: '행사', details: ['콘서트', '팬콘서트', '팬미팅', '팬싸인회', '팝업', '생일카페'] },
      { name: '경비', details: ['교통', '숙박'] },
      { name: '상품', details: ['앨범', '굿즈', '포토카드', '비공굿'] },
      { name: '멤버십', details: ['팬클럽', '버블', '유튜브 멤버십'] },
      { name: '서포트', details: [] },
    ],
  },
  {
    name: '배우용',
    hint: '행사, 경비, 상품, 멤버십',
    checked: true,
    items: [
      { name: '행사', details: ['팬미팅', '무대인사'] },
      { name: '경비', details: ['교통', '숙박'] },
      { name: '상품', details: ['굿즈', '화보'] },
      { name: '멤버십', details: ['팬클럽'] },
    ],
  },
  {
    name: '취미용',
    hint: '체험, 재료, 도구, 책',
    checked: false,
    items: [
      { name: '체험', details: ['원데이 클래스', 'DIY'] },
      { name: '재료', details: [] },
      { name: '도구', details: [] },
      { name: '책', details: ['만화책'] },
    ],
  },
];

export function presetSummary(items: PresetItem[]): string {
  if (!items.length) return '분류 없이 기타만 넣고 직접 만들어요.';
  const names = items.map((i) => i.name);
  const last = names.pop()!;
  return `${[...names, josa(last, '과/와')].join(', ')} 각 세부 버튼이 들어가요.`;
}
