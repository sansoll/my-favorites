import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../app/App';
import type { FavoritesDB } from '../data/db';
import { addTarget, listCategories, listDetails } from '../data/repo/lists';
import { namePlace } from '../data/repo/places';
import { markBasePresetsAsked } from '../data/repo/presets';
import { saveRecord } from '../data/repo/records';
import { setPlaceServices, SearchError, type PlaceResult } from '../services/places';
import { freshDb } from '../test/db';
import { ToastProvider } from './Toast';

let db: FavoritesDB;
let domesticCalls: string[];
let overseasCalls: string[];
let domestic: (q: string) => Promise<PlaceResult[]>;
let overseas: (q: string) => Promise<PlaceResult[]>;

beforeEach(async () => {
  db = freshDb();
  await markBasePresetsAsked(db);
  domesticCalls = [];
  overseasCalls = [];
  domestic = async (q) => (q.includes('KSPO') ? [{ source: 'kakao', externalId: '8', name: 'KSPO DOME', sub: '서울 송파구 올림픽로 424' }] : []);
  overseas = async (q) => (q === 'Tokyo Dome' ? [{ source: 'osm', externalId: 'W1', name: 'Tokyo Dome', sub: 'Bunkyo, Tokyo' }] : []);
  setPlaceServices({
    domestic: { search: (q) => { domesticCalls.push(q); return domestic(q); } },
    overseas: { search: (q) => { overseasCalls.push(q); return overseas(q); } },
  });
});
afterEach(() => setPlaceServices(null));

async function amountScreen() {
  const t = await addTarget(db, '가수 A');
  const c = (await listCategories(db, t.id))[0];
  const d = (await listDetails(db, c.id))[0];
  const router = createMemoryRouter(routes, { initialEntries: [`/record/${t.id}/${c.id}/${d.id}`] });
  render(<ToastProvider><RouterProvider router={router} /></ToastProvider>);
  await userEvent.click(await screen.findByRole('button', { name: '1' }));
  return { t, c, d };
}

describe('장소 창 (U5-2·U5-4)', () => {
  it('국내: 입력을 멈춘 뒤에만 찾고, 고르면 번호·이름만 저장해 기록에 붙음', async () => {
    await amountScreen();
    await userEvent.click(screen.getByRole('button', { name: /^장소/ }));
    const sheet = await screen.findByRole('dialog', { name: '어디였나요?' });
    await userEvent.type(within(sheet).getByRole('textbox', { name: '장소 검색어' }), 'KSPO');
    await waitFor(() => expect(domesticCalls).toEqual(['KSPO']));
    await userEvent.click(await within(sheet).findByRole('button', { name: /^KSPO DOME/ }));
    expect(within(sheet).getByText('서울 송파구 올림픽로 424')).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: '이 장소로' }));
    expect(await screen.findByRole('button', { name: /^장소\s*KSPO DOME/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(async () => expect((await db.records.toArray())[0]?.placeId).toBeDefined());
    const p = await db.places.get((await db.records.toArray())[0].placeId!);
    expect(p).toMatchObject({ source: 'kakao', externalId: '8', name: 'KSPO DOME' });
  });

  it('결과가 없으면 해외 탭 안내, 인터넷이 없으면 이름만 남기기 안내', async () => {
    await amountScreen();
    await userEvent.click(screen.getByRole('button', { name: /^장소/ }));
    const sheet = await screen.findByRole('dialog', { name: '어디였나요?' });
    const input = within(sheet).getByRole('textbox', { name: '장소 검색어' });
    await userEvent.type(input, '없는곳');
    expect(await within(sheet).findByText(/해외 탭에서 찾아보세요/)).toBeInTheDocument();
    domestic = async () => { throw new SearchError('offline'); };
    await userEvent.type(input, '2');
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('인터넷이 없어서');
    await userEvent.click(within(sheet).getByRole('button', { name: /없는곳2.*이름만 남기기/ }));
    expect(await screen.findByRole('button', { name: /^장소\s*없는곳2/ })).toBeInTheDocument();
    expect(await db.places.toArray()).toMatchObject([{ source: 'name', name: '없는곳2' }]);
  });

  it('해외: `검색` 버튼에서만 찾고, 한글로 없으면 영어·현지어 안내', async () => {
    await amountScreen();
    await userEvent.click(screen.getByRole('button', { name: /^장소/ }));
    const sheet = await screen.findByRole('dialog', { name: '어디였나요?' });
    await userEvent.click(within(sheet).getByRole('tab', { name: '해외' }));
    const input = within(sheet).getByRole('textbox', { name: '장소 검색어' });
    await userEvent.type(input, '도쿄돔');
    await act(() => new Promise((r) => setTimeout(r, 500)));
    expect(overseasCalls).toEqual([]);
    await userEvent.click(within(sheet).getByRole('button', { name: '검색' }));
    expect(await within(sheet).findByText(/영어나 현지어로 찾아보세요/)).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, 'Tokyo Dome{Enter}');
    await userEvent.click(await within(sheet).findByRole('button', { name: /^Tokyo Dome/ }));
    await userEvent.click(within(sheet).getByRole('button', { name: '이 장소로' }));
    expect(await screen.findByRole('button', { name: /^장소\s*Tokyo Dome/ })).toBeInTheDocument();
    expect(overseasCalls).toEqual(['도쿄돔', 'Tokyo Dome']);
  });

  it('전에 간 곳을 다시 고르고, 장소 빼기', async () => {
    const { t, c } = await amountScreen();
    const p = await namePlace(db, '성수 팝업스토어');
    await saveRecord(db, { targetId: t.id, categoryId: c.id, paid: 1, placeId: p.id });
    await userEvent.click(screen.getByRole('button', { name: /^장소/ }));
    let sheet = await screen.findByRole('dialog', { name: '어디였나요?' });
    await userEvent.click(await within(sheet).findByRole('button', { name: /^성수 팝업스토어/ }));
    await userEvent.click(within(sheet).getByRole('button', { name: '이 장소로' }));
    await userEvent.click(await screen.findByRole('button', { name: /^장소\s*성수 팝업스토어/ }));
    sheet = await screen.findByRole('dialog', { name: '어디였나요?' });
    await userEvent.click(within(sheet).getByRole('button', { name: '장소 빼기' }));
    expect(await screen.findByRole('button', { name: /^장소\s*선택/ })).toBeInTheDocument();
  });
});

describe('기록 상세의 장소 (U5-4)', () => {
  it('지도 열기 링크와 이름만 장소 연결하기', async () => {
    const t = await addTarget(db, '가수 A');
    const c = (await listCategories(db, t.id))[0];
    const p = await namePlace(db, '도쿄돔');
    const r = await saveRecord(db, { targetId: t.id, categoryId: c.id, paid: 1000, placeId: p.id });
    const router = createMemoryRouter(routes, { initialEntries: [`/records/${r.id}`] });
    render(<ToastProvider><RouterProvider router={router} /></ToastProvider>);
    const link = await screen.findByRole('link', { name: '도쿄돔 지도에서 열기' });
    expect(link).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=%EB%8F%84%EC%BF%84%EB%8F%94');
    await userEvent.click(screen.getByRole('button', { name: '장소 연결하기' }));
    const sheet = await screen.findByRole('dialog', { name: '장소 연결하기' });
    await userEvent.click(within(sheet).getByRole('tab', { name: '해외' }));
    await userEvent.type(within(sheet).getByRole('textbox', { name: '장소 검색어' }), 'Tokyo Dome{Enter}');
    await userEvent.click(await within(sheet).findByRole('button', { name: /^Tokyo Dome/ }));
    await userEvent.click(within(sheet).getByRole('button', { name: '이 장소로 연결' }));
    expect(await screen.findByRole('link', { name: 'Tokyo Dome 지도에서 열기' })).toBeInTheDocument();
    expect(await db.places.get(p.id)).toBeUndefined();
  });

  it('수정할 때 장소를 바꿀 수 있음', async () => {
    const t = await addTarget(db, '가수 A');
    const c = (await listCategories(db, t.id))[0];
    const r = await saveRecord(db, { targetId: t.id, categoryId: c.id, paid: 1000 });
    const router = createMemoryRouter(routes, { initialEntries: [`/records/${r.id}`] });
    render(<ToastProvider><RouterProvider router={router} /></ToastProvider>);
    await userEvent.click(await screen.findByRole('button', { name: '수정' }));
    await userEvent.click(screen.getByRole('button', { name: /^장소/ }));
    const sheet = await screen.findByRole('dialog', { name: '어디였나요?' });
    await userEvent.type(within(sheet).getByRole('textbox', { name: '장소 검색어' }), 'KSPO');
    await userEvent.click(await within(sheet).findByRole('button', { name: /^KSPO DOME/ }));
    await userEvent.click(within(sheet).getByRole('button', { name: '이 장소로' }));
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(async () => expect((await db.records.get(r.id))!.placeId).toBeDefined());
  });
});
