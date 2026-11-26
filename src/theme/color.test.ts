import { BLACK, WHITE, bestText, contrast, extractColors, hexToRgb, mix, readability, resolveTheme, sampleSize, themeCombos, CONTRAST_OK } from './color';

const px = (hexes: [string, number][]) => {
  const out: number[] = [];
  for (const [h, n] of hexes) { const [r, g, b] = hexToRgb(h); for (let i = 0; i < n; i++) out.push(r, g, b, 255); }
  return out;
};

describe('대비 계산, 자동 글자색 (U9-1)', () => {
  it('대비 수치: 흰·검 21, 같은 색 1', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#777777')).toBe(1);
    expect(contrast('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
  });
  it('검정·흰색 중 대비 높은 쪽', () => {
    expect(bestText('#FFFFFF')).toBe(BLACK);
    expect(bestText('#FFE08A')).toBe(BLACK);
    expect(bestText('#0B3954')).toBe(WHITE);
    expect(bestText('#5B4CDB')).toBe(WHITE);
  });
  it('잘 보여요 / 조금 흐려요 / 잘 안 보여요', () => {
    expect(readability(4.5)).toBe('ok');
    expect(readability(3.2)).toBe('mid');
    expect(readability(1.5)).toBe('low');
  });
  it('테마 풀기: auto는 자동 글자색, 강조 위 글자색, 어두운 배경', () => {
    const r = resolveTheme({ bg: '#101014', surface: '#202024', accent: '#FFD84D', accent2: '#7CC4FF', text: 'auto' });
    expect(r.text).toBe(WHITE);
    expect(r.onAccent).toBe(BLACK);
    expect(r.dark).toBe(true);
    expect(resolveTheme({ bg: '#FFFFFF', surface: '#FFF', accent: '#000000', accent2: '#000000', text: '#EEEEEE' }).ratio).toBeLessThan(1.2);
  });
  it('섞기', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mix('#123456', '#FFFFFF', 0)).toBe('#123456');
  });
});

describe('사진 색 뽑기 (U9-2)', () => {
  it('한 가지 색 사진은 1색', () => {
    expect(extractColors(px([['#3A8FD6', 400]]))).toEqual(['#3A8FD6']);
  });
  it('비슷한 색은 합치고, 많은 순', () => {
    const cs = extractColors(px([['#F7C6D9', 300], ['#F5C4D7', 200], ['#8E7BE0', 250], ['#5A3E9E', 100], ['#FFFFFF', 50]]));
    expect(cs).toHaveLength(4);
    expect(contrast(cs[0], '#F6C5D8')).toBeLessThan(1.05);
    expect(cs[1]).toBe('#8E7BE0');
  });
  it('투명한 부분과 아주 적은 색은 빼고, 최대 5색', () => {
    const many = px([['#FF0000', 100], ['#00FF00', 100], ['#0000FF', 100], ['#FFFF00', 100], ['#00FFFF', 100], ['#FF00FF', 100], ['#000000', 1]]);
    many.push(0, 0, 0, 0);
    const cs = extractColors(many);
    expect(cs).toHaveLength(5);
    expect(cs).not.toContain('#000000');
  });
  it('큰 사진은 긴 변 64px로 줄여서', () => {
    expect(sampleSize(4000, 3000)).toEqual({ w: 64, h: 48 });
    expect(sampleSize(30, 20)).toEqual({ w: 30, h: 20 });
  });
});

describe('테마 조합 6가지 (U9-3)', () => {
  const photos = [
    ['#F7C6D9', '#FBE3EC', '#8E7BE0', '#5A3E9E'],
    ['#FFD9A0', '#F59E6B', '#B4433A', '#3B1F3A'],
    ['#D8F3EC', '#6CC3B0', '#1F6E7A', '#0B3954'],
    ['#FFFF00', '#FFFFAA'],
  ];
  it('조합마다 자동 글자색이 대비 기준(4.5) 충족, 강조 위 글자도 3 이상', () => {
    for (const p of photos) {
      const combos = themeCombos(p);
      expect(combos).toHaveLength(6);
      for (const c of combos) {
        const r = resolveTheme({ ...c, text: 'auto' });
        expect(r.ratio, `${c.label} ${c.bg}`).toBeGreaterThanOrEqual(CONTRAST_OK);
        expect(contrast(r.onAccent, c.accent), `${c.label} ${c.accent}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
  it('색이 한 가지뿐이면 전부 그 색, 조합은 하나', () => {
    expect(themeCombos(['#3A8FD6'])).toEqual([{ label: '사진 그대로', bg: '#3A8FD6', surface: '#3A8FD6', accent: '#3A8FD6', accent2: '#3A8FD6' }]);
    expect(themeCombos([])).toEqual([]);
  });
});
