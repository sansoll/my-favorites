import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../app/App';
import { ToastProvider } from '../../components/Toast';
import type { FavoritesDB } from '../../data/db';
import { addTarget, ensureInitialData, listCategories } from '../../data/repo/lists';
import { markBasePresetsAsked } from '../../data/repo/presets';
import { saveRecord } from '../../data/repo/records';
import { activeFontId, activeTheme, categoryColorMap, listFonts } from '../../data/repo/theme';
import { setPaletteReader } from '../../services/palette';
import { freshDb } from '../../test/db';

vi.mock('../../services/photo', () => ({ resizePhoto: vi.fn(async () => ({ blob: new Blob(['p']), width: 10, height: 10 })), fitWithin: vi.fn() }));

let db: FavoritesDB;
beforeEach(async () => {
  db = freshDb();
  await ensureInitialData(db);
  await markBasePresetsAsked(db);
  setPaletteReader(async () => ({ url: 'blob:x', colors: ['#F7C6D9', '#8E7BE0', '#5A3E9E'], pick: () => '#00AA55', dispose: () => undefined }));
});
afterEach(() => setPaletteReader(null));

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><RouterProvider router={router} /></ToastProvider>);
  return router;
}
const cssVar = (n: string) => document.documentElement.style.getPropertyValue(n);

describe('테마 화면 (U9-4)', () => {
  it('설정에서 들어가 테마 카드를 누르면 미리 바뀌고, 적용하면 저장·유지', async () => {
    const router = renderApp('/settings');
    await userEvent.click(await screen.findByRole('link', { name: /테마와 꾸미기.*라이트/ }));
    expect(router.state.location.pathname).toBe('/settings/theme');
    await userEvent.click(await screen.findByRole('radio', { name: /다크 모드/ }));
    await waitFor(() => expect(cssVar('--accent')).toBe('#9187FF'));
    expect((await activeTheme(db)).id).toBe('light');
    await userEvent.click(screen.getByRole('button', { name: '‘다크 모드’ 테마로 적용' }));
    await waitFor(async () => expect((await activeTheme(db)).id).toBe('dark'));
    expect(await screen.findByRole('button', { name: '지금 쓰는 테마예요' })).toBeDisabled();
  });

  it('미리 보기만 하고 나가면 쓰던 테마로 되돌림', async () => {
    const router = renderApp('/settings/theme');
    await userEvent.click(await screen.findByRole('radio', { name: /다크 모드/ }));
    await waitFor(() => expect(cssVar('--accent')).toBe('#9187FF'));
    await router.navigate('/settings');
    await waitFor(() => expect(cssVar('--accent')).toBe('#5B4CDB'));
  });

  it('글자색: 자동 추천, 대비가 낮으면 알리기만 함', async () => {
    renderApp('/settings/theme');
    expect(await screen.findByRole('button', { name: /글자색.*잘 보여요.*자동 · 검정/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /글자색/ }));
    const dlg = screen.getByRole('dialog', { name: '글자색' });
    await userEvent.click(within(dlg).getByRole('radio', { name: '흰색' }));
    expect(await within(dlg).findByText(/글자가 잘 안 보일 수 있어요/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /글자색.*잘 안 보여요.*흰색/ })).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('radio', { name: '자동 (추천)' }));
    expect(await screen.findByRole('button', { name: /글자색.*잘 보여요/ })).toBeInTheDocument();
  });

  it('사진으로 만들기: 뽑은 색·미리보기 → 하나씩 바꾸기 → 다른 조합 → 스포이드 → 적용하면 사진 테마 1', async () => {
    renderApp('/settings/theme');
    await userEvent.click(await screen.findByRole('button', { name: /사진으로 만들기/ }));
    await userEvent.upload(screen.getByLabelText('테마 사진'), new File(['x'], 'a.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByRole('region', { name: '뽑은 색' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '이렇게 보여요 · 추천' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^강조/ }));
    const roleDlg = screen.getByRole('dialog', { name: '어디에 쓸 색인가요?' });
    await userEvent.click(within(roleDlg).getByRole('radio', { name: '#5A3E9E' }));
    expect(screen.getByRole('button', { name: /^강조.*#5A3E9E/ })).toBeInTheDocument();
    await userEvent.click(within(roleDlg).getByRole('button', { name: '닫기' }));

    await userEvent.click(screen.getByRole('button', { name: '다른 조합 5개 보기' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: '다른 조합' })).getByRole('button', { name: /어둡게/ }));
    expect(screen.getByRole('heading', { name: '이렇게 보여요 · 어둡게' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '스포이드로 찍기' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '사진에서 스포이드로 찍기' }));
    await userEvent.click(screen.getByRole('img', { name: '사진에서 원하는 곳을 눌러요' }));
    expect(screen.getByRole('button', { name: /^강조.*#00AA55/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '이 테마 적용' }));
    expect(await screen.findByText('사진 테마 1을 적용했어요')).toBeInTheDocument();
    const t = await activeTheme(db);
    expect(t).toMatchObject({ name: '사진 테마 1', accent: '#00AA55' });
    await waitFor(() => expect(screen.getByRole('radio', { name: /사진 테마 1/ })).toBeChecked());
  });

  it('색이 한 가지뿐인 사진은 전부 그 색, 다른 조합 없음', async () => {
    setPaletteReader(async () => ({ url: 'blob:x', colors: ['#3A8FD6'], pick: () => '#3A8FD6', dispose: () => undefined }));
    renderApp('/settings/theme');
    await userEvent.click(await screen.findByRole('button', { name: /사진으로 만들기/ }));
    await userEvent.upload(screen.getByLabelText('테마 사진'), new File(['x'], 'a.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByText(/색이 한 가지뿐이라 전부 그 색으로/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /다른 조합/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^배경.*#3A8FD6/ })).toBeInTheDocument();
  });
});

describe('글꼴 (U9-5)', () => {
  it('글꼴이 아닌 파일 거부, 넣으면 적용, 지우면 기본 글꼴', async () => {
    renderApp('/settings/theme');
    await userEvent.click(await screen.findByRole('button', { name: /글꼴.*기본 글꼴/ }));
    const dlg = screen.getByRole('dialog', { name: '글꼴' });
    const input = within(dlg).getByLabelText('글꼴 파일');
    await userEvent.upload(input, new File(['<html>'], 'evil.ttf'), { applyAccept: false });
    expect(await within(dlg).findByRole('alert')).toHaveTextContent('글꼴 파일');
    const bytes = new Uint8Array(64); bytes.set(new TextEncoder().encode('wOF2'));
    await userEvent.upload(input, new File([bytes], '손글씨.woff2'), { applyAccept: false });
    expect(await screen.findByText('손글씨 글꼴을 적용했어요')).toBeInTheDocument();
    await waitFor(() => expect(within(dlg).getByRole('radio', { name: /손글씨/ })).toBeChecked());
    const id = (await listFonts(db))[0].id;
    expect(await activeFontId(db)).toBe(id);
    await userEvent.click(within(dlg).getByRole('button', { name: '손글씨 글꼴 지우기' }));
    await waitFor(async () => expect(await activeFontId(db)).toBeNull());
    await waitFor(() => expect(within(dlg).getByRole('radio', { name: /기본 글꼴/ })).toBeChecked());
  });
});

describe('대상 꾸미기·분류 색 (U9-6)', () => {
  it('대상 색과 사진, 분류 색', async () => {
    const a = await addTarget(db, '가수 A');
    const cat = (await listCategories(db, a.id))[0];
    await saveRecord(db, { targetId: a.id, categoryId: cat.id, paid: 1000 });
    renderApp('/settings/theme');
    await userEvent.click(await screen.findByRole('button', { name: /가수 A.*색 · 사진/ }));
    const dlg = screen.getByRole('dialog', { name: '가수 A' });
    await userEvent.click(within(dlg).getByRole('radio', { name: '#2E9E6B' }));
    await waitFor(async () => expect((await db.targets.get(a.id))?.color).toBe('#2E9E6B'));
    await userEvent.upload(within(dlg).getByLabelText('대상 사진'), new File(['x'], 'a.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByText('가수 A에 사진을 넣었어요')).toBeInTheDocument();
    expect((await db.targets.get(a.id))?.photoId).toBeTruthy();
    await userEvent.click(within(dlg).getByRole('button', { name: '사진 빼기' }));
    await waitFor(async () => expect((await db.targets.get(a.id))?.photoId).toBeUndefined());
    await userEvent.click(within(dlg).getByRole('button', { name: '닫기' }));

    await userEvent.click(within(screen.getByRole('region', { name: '분류별 색' })).getByRole('button', { name: '기타' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: '기타' })).getByRole('radio', { name: '#C94F4F' }));
    await waitFor(async () => expect((await categoryColorMap(db)).get('기타')).toBe('#C94F4F'));
  });

  it('대상 사진은 분류 화면 위쪽과 내역 아이콘에 쓰임', async () => {
    const orig = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:photo');
    URL.revokeObjectURL = vi.fn();
    try {
      const a = await addTarget(db, '가수 A');
      await db.blobs.add({ id: 'p1', kind: 'photo', name: 'a', data: new Blob(['x']), width: 10, height: 10 });
      await db.targets.update(a.id, { photoId: 'p1' });
      const cat = (await listCategories(db, a.id))[0];
      await saveRecord(db, { targetId: a.id, categoryId: cat.id, paid: 1000 });
      const router = renderApp(`/record/${a.id}`);
      expect(await screen.findByRole('img', { name: '가수 A 사진' })).toHaveStyle({ backgroundImage: 'url("blob:photo")' });
      await router.navigate('/history');
      await waitFor(() => expect(document.querySelector('[data-photo]')).not.toBeNull());
    } finally {
      URL.createObjectURL = orig;
    }
  });
});
