import { allCoverKeys, cleanLyrics, extraShow, lineKey, markShow, matchTitle, OPEN_GAP_MS, relayout, shouldCountOpen, splitLyrics, toggleMark, type Layer } from './cheer';

describe('가사 나누기 (U8-1)', () => {
  it('빈 줄 유지, 공백 여러 개는 하나로, 줄 번호·단어 번호', () => {
    const ls = splitLyrics('하나  둘\t셋\n\n  넷 다섯 \r\n여섯');
    expect(ls.map((l) => l.index)).toEqual([0, 1, 2, 3]);
    expect(ls[0].words).toEqual(['하나', '둘', '셋']);
    expect(ls[1].words).toEqual([]);
    expect(ls[2].words).toEqual(['넷', '다섯']);
    expect(ls[3].words).toEqual(['여섯']);
    expect(lineKey('  a   b ')).toBe('a b');
  });
  it('붙여넣은 가사 정리: 앞뒤 빈 줄과 줄 끝 공백만 뺌', () => {
    expect(cleanLyrics('\n\n가 나  \n\n다\n\n')).toBe('가 나\n\n다');
  });
});

describe('보기별 표시 (U8-2)', () => {
  it('README 표대로', () => {
    expect([markShow('cheer'), extraShow('cheer')]).toEqual(['color', 'show']);
    expect([markShow('orig'), extraShow('orig')]).toEqual(['plain', 'hidden']);
    expect([markShow('memo'), extraShow('memo')]).toEqual(['covered', 'covered']);
    expect([markShow('memo', true), extraShow('memo', true)]).toEqual(['color', 'show']);
  });
  it('모두 보기용 열쇠: 떼창 단어와 추가 응원 모두', () => {
    const l: Layer = { marks: [{ line: 0, word: 1, color: 'c' }], extras: [{ id: 'e', line: 0, word: 0, position: 'below', text: 't', color: 'c' }] };
    expect(allCoverKeys(l)).toEqual(['m0-1', 'xe']);
  });
});

describe('떼창 색칠', () => {
  it('칠하기, 같은 색 다시 누르면 지움, 다른 색은 바꿈, null은 지움', () => {
    let l: Layer = { marks: [], extras: [] };
    l = toggleMark(l, 1, 2, 'Y');
    expect(l.marks).toEqual([{ line: 1, word: 2, color: 'Y' }]);
    l = toggleMark(l, 1, 2, 'P');
    expect(l.marks).toEqual([{ line: 1, word: 2, color: 'P' }]);
    l = toggleMark(l, 1, 2, 'P');
    expect(l.marks).toEqual([]);
    l = toggleMark(toggleMark(l, 0, 0, 'Y'), 0, 0, null);
    expect(l.marks).toEqual([]);
  });
});

describe('가사 고친 뒤 응원법 유지 (U8-3)', () => {
  const layer: Layer = {
    marks: [{ line: 0, word: 0, color: 'Y' }, { line: 1, word: 1, color: 'P' }, { line: 3, word: 0, color: 'Y' }],
    extras: [{ id: 'a', line: 1, word: 0, position: 'after', text: '어이', color: 'P' }, { id: 'b', line: 3, word: 0, position: 'below', text: '하나 둘', color: 'Y' }],
  };
  const old = '첫 줄\n둘째 줄 가사\n\n넷째 줄';

  it('안 바뀐 줄은 유지(줄 번호가 밀려도 따라감), 바뀐 줄은 표시하고 응원법은 지움', () => {
    const r = relayout(old, '새로 넣은 줄\n첫 줄\n둘째 줄 고침\n\n넷째   줄', layer);
    expect(r.changed).toEqual([0, 2]);
    expect(r.layer.marks).toEqual([{ line: 1, word: 0, color: 'Y' }, { line: 4, word: 0, color: 'Y' }]);
    expect(r.layer.extras.map((x) => [x.id, x.line])).toEqual([['b', 4]]);
    expect(r.dropped).toBe(2);
  });

  it('그대로 저장하면 바뀐 것 없음', () => {
    const r = relayout(old, old, layer);
    expect(r).toEqual({ layer, changed: [], dropped: 0 });
  });

  it('줄을 지우면 그 줄 응원법만 빠짐', () => {
    const r = relayout(old, '첫 줄\n\n넷째 줄', layer);
    expect(r.changed).toEqual([]);
    expect(r.layer.marks).toEqual([{ line: 0, word: 0, color: 'Y' }, { line: 2, word: 0, color: 'Y' }]);
    expect(r.dropped).toBe(2);
  });
});

describe('펼친 횟수 (U8-7)', () => {
  it('30분 안 다시 열면 안 셈', () => {
    expect(shouldCountOpen(null, 0)).toBe(true);
    expect(shouldCountOpen(1000, 1000 + OPEN_GAP_MS - 1)).toBe(false);
    expect(shouldCountOpen(1000, 1000 + OPEN_GAP_MS)).toBe(true);
  });
});

it('제목 검색은 공백·대소문자 무시', () => {
  expect(matchTitle('Love  Song', 'lovesong')).toBe(true);
  expect(matchTitle('곡 1', '곡1')).toBe(true);
  expect(matchTitle('곡 1', '곡 2')).toBe(false);
});
