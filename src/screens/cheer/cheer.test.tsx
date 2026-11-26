import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../app/App';
import { ToastProvider } from '../../components/Toast';
import type { FavoritesDB } from '../../data/db';
import { addTarget, ensureInitialData } from '../../data/repo/lists';
import { markBasePresetsAsked } from '../../data/repo/presets';
import { addExtra, addSong, paintWord, recordOpen } from '../../data/repo/songs';
import { freshDb } from '../../test/db';

let db: FavoritesDB;
let tid: string;
beforeEach(async () => {
  db = freshDb();
  await ensureInitialData(db);
  await markBasePresetsAsked(db);
  tid = (await addTarget(db, '가수 A')).id;
});

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><RouterProvider router={router} /></ToastProvider>);
  return router;
}

const Y = '#FFE08A';
async function seedSong() {
  const s = await addSong(db, { targetId: tid, title: '곡 1', lyrics: '첫 줄 가사\n다 같이 불러요\n\n마지막 줄' });
  await paintWord(db, s.id, 1, 0, Y);
  await paintWord(db, s.id, 1, 1, Y);
  await addExtra(db, s.id, { line: 0, word: 2, position: 'after', text: '어이', color: '#FFD3DE' });
  await addExtra(db, s.id, { line: 1, word: 2, position: 'below', text: '하나 둘 셋', color: '#FFD3DE' });
  return s;
}

describe('곡 목록 (U8-5)', () => {
  it('곡 추가 → 편집 모드로 열림, 대상별 묶음, 제목 검색, 펼친 횟수', async () => {
    await addSong(db, { targetId: tid, title: 'Love Song', lyrics: 'a b' });
    const router = renderApp('/cheer');
    await userEvent.click(await screen.findByRole('button', { name: '+ 곡 추가' }));
    const dlg = screen.getByRole('dialog', { name: '곡 추가' });
    const save = within(dlg).getByRole('button', { name: '저장하고 응원법 표시하기' });
    expect(save).toBeDisabled();
    await userEvent.type(within(dlg).getByRole('textbox', { name: '제목' }), '곡 1');
    await userEvent.type(within(dlg).getByRole('textbox', { name: '가사 붙여넣기' }), '첫 줄{enter}둘째 줄');
    await userEvent.click(save);
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/cheer\/.+/));
    expect(await screen.findByRole('button', { name: '완료' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: '편집 도구' })).toBeInTheDocument();

    await router.navigate('/cheer');
    const group = await screen.findByRole('region', { name: '가수 A 곡' });
    expect(within(group).getAllByRole('link').map((a) => a.textContent)).toEqual(['곡 1펼침 1번 ›', 'Love Song펼침 0번 ›']);
    await userEvent.type(screen.getByRole('searchbox', { name: '곡 제목 검색' }), 'love');
    expect(within(screen.getByRole('region', { name: '가수 A 곡' })).getAllByRole('link')).toHaveLength(1);
    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), '없는 곡');
    expect(screen.getByText('찾는 곡이 없어요.')).toBeInTheDocument();
  });
});

describe('보기 세 가지 (U8-2)', () => {
  it('응원법: 색과 추가 응원 / 원본: 일반 가사, 추가 응원 숨김 / 외우기: 가림, 눌러서 열기, 모두 보기·가리기', async () => {
    const s = await seedSong();
    renderApp(`/cheer/${s.id}`);
    const lyrics = await screen.findByLabelText('가사');
    expect(within(lyrics).getByText('다').tagName).toBe('MARK');
    expect(within(lyrics).getByText('「어이」')).toBeInTheDocument();
    expect(within(lyrics).getByText('「 하나 둘 셋 」')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: '원본' }));
    expect(within(lyrics).getByText('다').tagName).toBe('SPAN');
    expect(within(lyrics).queryByText(/어이/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /공연장 모드/ })).toBeDisabled();
    expect(screen.getByText('공연장 모드는 응원법 보기에서만 쓸 수 있어요')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: '외우기' }));
    expect(screen.getAllByRole('button', { name: '가린 단어 열기' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: '가린 추가 응원 열기' })).toHaveLength(2);
    await userEvent.click(screen.getAllByRole('button', { name: '가린 단어 열기' })[0]);
    expect(screen.getAllByRole('button', { name: '가린 단어 열기' })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: '모두 보기' }));
    expect(screen.queryByRole('button', { name: /가린/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '모두 가리기' }));
    expect(screen.getAllByRole('button', { name: /가린/ })).toHaveLength(4);
    expect(screen.getByRole('button', { name: /공연장 모드/ })).toBeDisabled();
  });
});

describe('응원법 편집 (U8-4)', () => {
  it('떼창 색칠·지우개, 추가 응원은 넣기 전 미리보기, 넣은 응원 고치기·지우기', async () => {
    const s = await addSong(db, { targetId: tid, title: '곡 2', lyrics: '하나 둘 셋' });
    renderApp(`/cheer/${s.id}?edit=1`);
    const lyrics = await screen.findByLabelText('가사');
    await userEvent.click(within(lyrics).getByRole('button', { name: '둘' }));
    await waitFor(async () => expect((await db.songs.get(s.id))?.layer.marks).toEqual([{ line: 0, word: 1, color: Y }]));
    await userEvent.click(screen.getByRole('radio', { name: '지우개' }));
    await userEvent.click(within(lyrics).getByRole('button', { name: '둘' }));
    await waitFor(async () => expect((await db.songs.get(s.id))?.layer.marks).toEqual([]));

    await userEvent.click(screen.getByRole('radio', { name: '추가 응원 넣기' }));
    expect(screen.queryByRole('radio', { name: '지우개' })).not.toBeInTheDocument();
    await userEvent.click(within(lyrics).getByRole('button', { name: '둘' }));
    const dlg = screen.getByRole('dialog', { name: '추가 응원 넣기' });
    await userEvent.type(within(dlg).getByRole('textbox', { name: '구호' }), '어이');
    expect(within(dlg).getByLabelText('미리보기')).toHaveTextContent('… 둘 「어이」');
    await userEvent.click(within(dlg).getByRole('radio', { name: '단어 앞' }));
    expect(within(dlg).getByLabelText('미리보기')).toHaveTextContent('「어이」 둘 …');
    await userEvent.click(within(dlg).getByRole('radio', { name: '줄 아래' }));
    expect(within(dlg).getByLabelText('미리보기')).toHaveTextContent('「 어이 」');
    await userEvent.click(within(dlg).getByRole('radio', { name: '단어 앞' }));
    await userEvent.click(within(dlg).getByRole('button', { name: '넣기' }));
    expect(await screen.findByText('둘 앞에 추가 응원을 넣었어요')).toBeInTheDocument();
    const btn = await within(lyrics).findByRole('button', { name: '추가 응원 어이 고치기' });
    expect(btn.nextElementSibling).toHaveTextContent('둘');

    await userEvent.click(btn);
    const ed = screen.getByRole('dialog', { name: '추가 응원 고치기' });
    await userEvent.clear(within(ed).getByRole('textbox', { name: '구호' }));
    await userEvent.type(within(ed).getByRole('textbox', { name: '구호' }), '짝짝');
    await userEvent.click(within(ed).getByRole('button', { name: '고치기' }));
    await userEvent.click(await within(lyrics).findByRole('button', { name: '추가 응원 짝짝 고치기' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '이 추가 응원 지우기' }));
    await waitFor(async () => expect((await db.songs.get(s.id))?.layer.extras).toEqual([]));
  });

  it('가사 수정: 안 바뀐 줄 응원법 유지, 바뀐 줄 표시와 알림 / 초기화 / 곡 삭제', async () => {
    const s = await seedSong();
    const router = renderApp(`/cheer/${s.id}?edit=1`);
    await userEvent.click(await screen.findByRole('button', { name: '가사 수정' }));
    const dlg = screen.getByRole('dialog', { name: '가사 수정' });
    const ta = within(dlg).getByRole('textbox');
    expect(ta).toHaveValue('첫 줄 가사\n다 같이 불러요\n\n마지막 줄');
    await userEvent.clear(ta);
    await userEvent.type(ta, '첫 줄 고침{enter}다 같이 불러요{enter}{enter}마지막 줄');
    await userEvent.click(within(dlg).getByRole('button', { name: '가사 저장' }));
    expect(await screen.findByText('가사를 저장했어요. 고친 줄 1개는 응원법을 다시 표시해 주세요')).toBeInTheDocument();
    const got = await db.songs.get(s.id);
    expect(got?.layer.marks).toHaveLength(2);
    expect(got?.layer.extras.map((x) => x.text)).toEqual(['하나 둘 셋']);
    expect(document.querySelectorAll('[data-changed]')).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: '초기화' }));
    await userEvent.click(within(screen.getByRole('alertdialog', { name: '응원법을 초기화할까요?' })).getByRole('button', { name: '초기화' }));
    await waitFor(async () => expect((await db.songs.get(s.id))?.layer).toEqual({ marks: [], extras: [] }));
    expect((await db.songs.get(s.id))?.lyrics).toContain('첫 줄 고침');

    await userEvent.click(screen.getByRole('button', { name: '곡 삭제' }));
    await userEvent.click(within(screen.getByRole('alertdialog', { name: '곡 1을 삭제할까요?' })).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/cheer'));
    expect(await db.songs.count()).toBe(0);
  });

  it('링크는 http·https만 넣고 새 창으로 엶', async () => {
    const s = await seedSong();
    renderApp(`/cheer/${s.id}?edit=1`);
    const links = await screen.findByRole('region', { name: '링크' });
    await userEvent.type(within(links).getByRole('textbox', { name: '링크 주소' }), 'javascript:alert(1)');
    await userEvent.click(within(links).getByRole('button', { name: '+ 링크 추가' }));
    expect(await within(links).findByRole('alert')).toHaveTextContent('https://');
    await userEvent.clear(within(links).getByRole('textbox', { name: '링크 주소' }));
    await userEvent.type(within(links).getByRole('textbox', { name: '링크 이름' }), '응원법 영상');
    await userEvent.type(within(links).getByRole('textbox', { name: '링크 주소' }), 'https://youtu.be/x');
    await userEvent.click(within(links).getByRole('button', { name: '+ 링크 추가' }));
    expect(await within(links).findByText('응원법 영상')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '완료' }));
    const a = await screen.findByRole('link', { name: '▸ 응원법 영상' });
    expect(a).toHaveAttribute('href', 'https://youtu.be/x');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('공연장 모드 (U8-6)', () => {
  it('응원법 보기에서 켜고, 화면 꺼짐 방지를 요청하고, 닫으면 풀어 줌', async () => {
    const release = vi.fn(() => Promise.resolve());
    const request = vi.fn(() => Promise.resolve({ release }));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    const s = await seedSong();
    renderApp(`/cheer/${s.id}`);
    await userEvent.click(await screen.findByRole('button', { name: /공연장 모드/ }));
    const st = screen.getByRole('dialog', { name: '공연장 모드' });
    expect(await within(st).findByText('보는 동안 화면이 꺼지지 않아요')).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith('screen');
    expect(within(st).getByText('「 하나 둘 셋 」')).toBeInTheDocument();
    await userEvent.click(within(st).getByRole('button', { name: '닫기' }));
    expect(release).toHaveBeenCalled();
    delete (navigator as { wakeLock?: unknown }).wakeLock;
  });

  it('지원하지 않으면 안내만', async () => {
    const s = await seedSong();
    renderApp(`/cheer/${s.id}`);
    await userEvent.click(await screen.findByRole('button', { name: /공연장 모드/ }));
    expect(await screen.findByText('이 브라우저는 화면 꺼짐 방지를 지원하지 않아요')).toBeInTheDocument();
  });
});

it('곡을 열면 펼친 횟수, 30분 안 다시 열면 안 셈 (U8-7)', async () => {
  const s = await seedSong();
  await recordOpen(db, s.id, Date.now() - 10 * 60 * 1000);
  renderApp(`/cheer/${s.id}`);
  await screen.findByLabelText('가사');
  await new Promise((r) => setTimeout(r, 50));
  expect(await db.songOpens.count()).toBe(1);
});
