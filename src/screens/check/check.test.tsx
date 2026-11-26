import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../app/App';
import { ToastProvider } from '../../components/Toast';
import type { FavoritesDB } from '../../data/db';
import { addCheckItem, checkedDates, setCover } from '../../data/repo/checks';
import { addTarget } from '../../data/repo/lists';
import { markBasePresetsAsked } from '../../data/repo/presets';
import { monthOf, parseDateStr, today } from '../../domain/date';
import { freshDb } from '../../test/db';

let db: FavoritesDB;
beforeEach(async () => { db = freshDb(); await markBasePresetsAsked(db); });

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><RouterProvider router={router} /></ToastProvider>);
  return router;
}

describe('기록 탭 오늘 체크 (U4-3)', () => {
  it('칩을 누르면 오늘 체크·해제하고 알림', async () => {
    const a = await addTarget(db, '가수 A');
    const x = await addCheckItem(db, a.id, '버블');
    renderApp('/');
    const chip = await screen.findByRole('button', { name: /가수 A · 버블/ });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(chip);
    expect(await screen.findByRole('status')).toHaveTextContent('가수 A · 버블 오늘 체크했어요 ✓');
    await waitFor(() => expect(screen.getByRole('button', { name: /가수 A · 버블/ })).toHaveAttribute('aria-pressed', 'true'));
    expect((await checkedDates(db, x.id)).has(today())).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: /가수 A · 버블/ }));
    await waitFor(async () => expect((await checkedDates(db, x.id)).size).toBe(0));
  });

  it('꺼진 항목은 안 보이고, 항목이 없으면 만들기 안내', async () => {
    await addTarget(db, '가수 A');
    renderApp('/');
    expect(await screen.findByRole('link', { name: '체크 항목 만들기' })).toHaveAttribute('href', '/check');
  });
});

describe('체크 달력 (U4-3)', () => {
  it('날짜를 누르면 체크, 미래 날짜는 못 누르고 다음 달로 안 넘어감', async () => {
    const a = await addTarget(db, '가수 A');
    const x = await addCheckItem(db, a.id, '버블');
    renderApp('/check');
    const { m, d } = parseDateStr(today());
    const btn = await screen.findByRole('button', { name: new RegExp(`^${m}월 ${d}일 오늘`) });
    await userEvent.click(btn);
    expect(await screen.findByRole('status')).toHaveTextContent(`${m}월 ${d}일 체크했어요 ✓`);
    await waitFor(async () => expect((await checkedDates(db, x.id)).has(today())).toBe(true));
    expect(await screen.findByText('1일 체크했어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음 달' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '이전 달' }));
    expect(screen.getByRole('button', { name: '다음 달' })).toBeEnabled();
    expect(screen.getByText('0일 체크했어요')).toBeInTheDocument();
    expect(screen.getByText('지난달 0일')).toBeInTheDocument();
  });

  it('미래 날짜 칸은 꺼져 있음', async () => {
    const a = await addTarget(db, '가수 A');
    await addCheckItem(db, a.id, '버블');
    renderApp('/check');
    await screen.findByRole('button', { name: '항목 관리' });
    const ym = monthOf(today());
    const last = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5)), 0).getDate();
    const { m, d } = parseDateStr(today());
    if (d < last) expect(await screen.findByRole('button', { name: `${m}월 ${d + 1}일` })).toBeDisabled();
  });

  it('항목 관리: 새 항목 만들기, 중복 거부, 켜기·끄기', async () => {
    const a = await addTarget(db, '가수 A');
    await addTarget(db, '그룹 C');
    await addCheckItem(db, a.id, '버블');
    renderApp('/check');
    await userEvent.click(await screen.findByRole('button', { name: '항목 관리' }));
    const sheet = await screen.findByRole('dialog', { name: '체크 항목' });
    await userEvent.click(await within(sheet).findByRole('radio', { name: /그룹 C/ }));
    await userEvent.type(within(sheet).getByRole('textbox', { name: '체크 항목 이름' }), '연재');
    await userEvent.click(within(sheet).getByRole('button', { name: '추가' }));
    expect(await screen.findByRole('status')).toHaveTextContent('그룹 C · 연재 항목을 만들었어요');
    await userEvent.click(within(sheet).getByRole('radio', { name: /가수 A/ }));
    await userEvent.type(within(sheet).getByRole('textbox', { name: '체크 항목 이름' }), ' 버 블');
    await userEvent.click(within(sheet).getByRole('button', { name: '추가' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('이미 있는 항목이에요.');
    await userEvent.click(within(sheet).getByRole('switch', { name: '가수 A · 버블 체크' }));
    await userEvent.click(within(sheet).getByRole('button', { name: '닫기' }));
    await waitFor(() => expect(screen.queryByRole('tab', { name: /가수 A · 버블/ })).toBeNull());
    expect(screen.getByRole('tab', { name: /그룹 C · 연재/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('표지: 없으면 넣기 버튼, 고르면 적용 범위대로 저장하고 창문 보기 켜고 끄기', async () => {
    const a = await addTarget(db, '가수 A');
    const x = await addCheckItem(db, a.id, '버블');
    await db.blobs.add({ id: 'p1', kind: 'photo', name: 'a', data: new Blob(['x']), width: 800, height: 520 });
    renderApp('/check');
    await userEvent.click(await screen.findByRole('button', { name: '+ 달력 표지 사진 넣기' }));
    const sheet = await screen.findByRole('dialog', { name: '가수 A · 버블 달력 표지' });
    const { m } = parseDateStr(today());
    await userEvent.click(within(sheet).getByRole('radio', { name: `${m}월만` }));
    await userEvent.click(within(sheet).getByRole('button', { name: '넣은 사진' }));
    await waitFor(async () => expect((await db.checkItems.get(x.id))!.cover?.months[monthOf(today())]).toBe('p1'));
    expect((await db.checkItems.get(x.id))!.cover?.all).toBeNull();
    await userEvent.click(within(sheet).getByRole('switch', { name: '사진 창문으로 보기' }));
    await waitFor(async () => expect((await db.checkItems.get(x.id))!.cover?.bg).toBe(false));
    await setCover(db, x.id, null, 'all', monthOf(today()));
  });
});
