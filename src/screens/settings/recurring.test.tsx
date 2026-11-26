import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../app/App';
import { ToastProvider } from '../../components/Toast';
import type { FavoritesDB } from '../../data/db';
import { addTarget, listCategories, listDetails } from '../../data/repo/lists';
import { createBasePresets, listPresets, markBasePresetsAsked } from '../../data/repo/presets';
import { addRecurring, getNotify } from '../../data/repo/recurring';
import { parseDateStr, today } from '../../domain/date';
import { addDays } from '../../domain/recurring';
import { freshDb } from '../../test/db';

let db: FavoritesDB;
beforeEach(() => { db = freshDb(); });

async function seed() {
  await markBasePresetsAsked(db);
  await createBasePresets(db, ['가수용']);
  const a = await addTarget(db, '가수 A', (await listPresets(db))[0]);
  const mem = (await listCategories(db, a.id)).find((c) => c.name === '멤버십')!;
  const bubble = (await listDetails(db, mem.id)).find((d) => d.name === '버블')!;
  return { a, mem, bubble };
}

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><RouterProvider router={router} /></ToastProvider>);
  return router;
}

describe('정기 결제 화면 (U3-3)', () => {
  it('추가 창에서 대상 → 분류 → 세부를 고르고 금액·결제일로 추가', async () => {
    await seed();
    renderApp('/settings/recurring');
    await userEvent.click(await screen.findByRole('button', { name: '+ 정기 결제 추가' }));
    const sheet = await screen.findByRole('dialog', { name: '정기 결제 추가' });
    expect(within(sheet).queryByRole('radiogroup', { name: '분류' })).toBeNull();
    await userEvent.click(await within(sheet).findByRole('radio', { name: '가수 A' }));
    await userEvent.click(await within(sheet).findByRole('radio', { name: '멤버십' }));
    await userEvent.click(await within(sheet).findByRole('radio', { name: '버블' }));
    await userEvent.type(within(sheet).getByRole('textbox', { name: '금액' }), '4500');
    await userEvent.selectOptions(within(sheet).getByRole('combobox', { name: '결제일' }), '28');
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }));
    const list = await screen.findByRole('list', { name: '정기 결제' });
    await within(list).findByText('매달 28일');
    expect(list).toHaveTextContent('가수 A · 멤버십 › 버블');
    expect(list).toHaveTextContent('4,500원');
    const r = (await db.recurrings.toArray())[0];
    expect(r).toMatchObject({ amount: 4500, day: 28, enabled: true });
  });

  it('분류를 바꾸면 세부를 다시 고름', async () => {
    await seed();
    renderApp('/settings/recurring');
    await userEvent.click(await screen.findByRole('button', { name: '+ 정기 결제 추가' }));
    const sheet = await screen.findByRole('dialog', { name: '정기 결제 추가' });
    await userEvent.click(await within(sheet).findByRole('radio', { name: '가수 A' }));
    await userEvent.click(await within(sheet).findByRole('radio', { name: '멤버십' }));
    await userEvent.click(await within(sheet).findByRole('radio', { name: '버블' }));
    await userEvent.click(await within(sheet).findByRole('radio', { name: '행사' }));
    await waitFor(() => expect(within(sheet).queryByRole('radio', { name: '버블' })).toBeNull());
    expect(within(sheet).getAllByRole('radio', { checked: true }).map((x) => x.textContent)).toEqual(['가수 A', '행사']);
  });

  it('켜기·끄기, 수정, 삭제(이미 만든 기록은 남음)', async () => {
    const { a, mem, bubble } = await seed();
    const day = parseDateStr(addDays(today(), 3)).d;
    await addRecurring(db, { targetId: a.id, categoryId: mem.id, detailId: bubble.id, amount: 4500, day });
    const made = await db.records.count();
    renderApp('/settings/recurring');
    const sw = await screen.findByRole('switch', { name: /가수 A · 멤버십 › 버블 켜기/ });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(sw);
    await waitFor(async () => expect((await db.recurrings.toArray())[0].enabled).toBe(false));

    await userEvent.click(screen.getByRole('button', { name: /가수 A · 멤버십 › 버블/ }));
    const sheet = await screen.findByRole('dialog', { name: '정기 결제 수정' });
    const amt = within(sheet).getByRole('textbox', { name: '금액' });
    await userEvent.clear(amt);
    await userEvent.type(amt, '5000');
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }));
    await waitFor(async () => expect((await db.recurrings.toArray())[0].amount).toBe(5000));

    await userEvent.click(screen.getByRole('button', { name: /가수 A · 멤버십 › 버블/ }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '정기 결제 수정' })).getByRole('button', { name: '삭제' }));
    const dlg = await screen.findByRole('alertdialog');
    expect(dlg).toHaveTextContent('정기 결제를 삭제할까요?');
    expect(dlg).toHaveTextContent('이미 만든 기록은 그대로 남아요.');
    await userEvent.click(within(dlg).getByRole('button', { name: '삭제' }));
    await waitFor(async () => expect(await db.recurrings.count()).toBe(0));
    expect(await db.records.count()).toBe(made);
  });

  it('알림을 끄고 알림 시간을 바꿈', async () => {
    await seed();
    renderApp('/settings/recurring');
    await userEvent.click(await screen.findByRole('button', { name: /알림 시간/ }));
    const sheet = await screen.findByRole('dialog', { name: '알림 시간' });
    await userEvent.click(await within(sheet).findByRole('radio', { name: '이틀 전' }));
    await waitFor(async () => expect((await getNotify(db)).when).toBe('twoDaysBefore'));
    await userEvent.click(within(sheet).getByRole('button', { name: '완료' }));
    expect(await screen.findByRole('button', { name: /이틀 전 저녁 8시/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: '알림' }));
    await waitFor(async () => expect((await getNotify(db)).on).toBe(false));
  });
});

describe('금액 화면의 매달 반복 (U3-3)', () => {
  it('켜면 설명이 보이고, 저장하면 정기 결제도 생김', async () => {
    const { a, mem, bubble } = await seed();
    renderApp(`/record/${a.id}/${mem.id}/${bubble.id}`);
    await userEvent.click(await screen.findByRole('button', { name: '4' }));
    await userEvent.click(screen.getByRole('button', { name: '5' }));
    await userEvent.click(screen.getByRole('button', { name: '0' }));
    await userEvent.click(screen.getByRole('button', { name: '0' }));
    await userEvent.click(screen.getByRole('switch', { name: '매달 반복' }));
    const d = parseDateStr(today()).d;
    expect(await screen.findByText(`매달 ${d}일 · 전날 저녁 8시에 알림`)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(async () => expect(await db.recurrings.count()).toBe(1));
    const r = (await db.recurrings.toArray())[0];
    expect(r).toMatchObject({ amount: 4500, day: d, detailId: bubble.id });
    const recs = await db.records.toArray();
    expect(recs).toHaveLength(1);
    expect(recs[0].recurringId).toBe(r.id);
  });
});

describe('기록 탭 안내 (U3-2)', () => {
  it('내일 결제가 있으면 안내가 보이고, 누르면 정기 결제 화면', async () => {
    const { a, mem, bubble } = await seed();
    await addRecurring(db, { targetId: a.id, categoryId: mem.id, detailId: bubble.id, amount: 4500, day: parseDateStr(addDays(today(), 1)).d });
    const router = renderApp('/');
    const link = await screen.findByRole('link', { name: /내일 정기 결제가 있어요/ });
    await userEvent.click(link);
    expect(router.state.location.pathname).toBe('/settings/recurring');
  });

  it('결제가 멀면 안내 없음', async () => {
    const { a, mem, bubble } = await seed();
    await addRecurring(db, { targetId: a.id, categoryId: mem.id, detailId: bubble.id, amount: 4500, day: parseDateStr(addDays(today(), 5)).d });
    renderApp('/');
    await screen.findByRole('heading', { name: '기록' });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/정기 결제가 있어요/)).toBeNull();
  });
});
