import { expect, test } from '@playwright/test';
import { closePresetDialog } from './helpers';

// 실제 카카오·OSM 대신 가짜 응답을 씁니다(키·인터넷 없이 확인).
const FAKE_KAKAO = `window.kakao = { maps: { load: (cb) => cb(), services: {
  Status: { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT', ERROR: 'ERROR' },
  Places: function () { this.keywordSearch = (q, cb) => q.includes('KSPO')
    ? cb([{ id: '8', place_name: 'KSPO DOME', road_address_name: '서울 송파구 올림픽로 424', address_name: '' }], 'OK')
    : cb([], 'ZERO_RESULT'); } } } };`;

test('장소: 국내 검색 → 기록 → 상세에서 지도 링크, 해외 검색 (S1·U5)', async ({ page }) => {
  await page.route('https://dapi.kakao.com/**', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_KAKAO }));
  let osmCalls = 0;
  await page.route('https://nominatim.openstreetmap.org/**', (r) => {
    osmCalls++;
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify([{ osm_type: 'way', osm_id: 1, name: 'Tokyo Dome', display_name: 'Tokyo Dome, Bunkyo, Tokyo, Japan' }]) });
  });

  await page.goto('./');
  await closePresetDialog(page);
  await page.getByRole('button', { name: '+ 대상 추가' }).click();
  const add = page.getByRole('dialog', { name: '새 대상' });
  await add.getByRole('textbox', { name: '이름' }).fill('가수 A');
  await add.getByRole('button', { name: '추가' }).click();
  await page.getByRole('list', { name: '대상' }).getByRole('button', { name: /가수 A/ }).click();
  await page.getByRole('button', { name: /^기타/ }).click();
  await page.getByRole('button', { name: /^기타/ }).click();
  for (const k of ['5', '0', '00']) await page.getByRole('button', { name: k, exact: true }).click();

  await page.getByRole('button', { name: /^장소/ }).click();
  const sheet = page.getByRole('dialog', { name: '어디였나요?' });
  await sheet.getByRole('textbox', { name: '장소 검색어' }).fill('KSPO');
  await sheet.getByRole('button', { name: /^KSPO DOME/ }).click();
  await sheet.getByRole('button', { name: '이 장소로' }).click();
  await page.getByRole('button', { name: '저장' }).click();

  await page.getByRole('list', { name: '최근 기록' }).getByRole('link').first().click();
  await expect(page.getByRole('link', { name: 'KSPO DOME 지도에서 열기' })).toHaveAttribute('href', 'https://place.map.kakao.com/8');

  await page.getByRole('button', { name: '수정' }).click();
  await page.getByRole('button', { name: /^장소/ }).click();
  await sheet.getByRole('tab', { name: '해외' }).click();
  await sheet.getByRole('textbox', { name: '장소 검색어' }).fill('Tokyo Dome');
  expect(osmCalls).toBe(0);
  await sheet.getByRole('button', { name: '검색', exact: true }).click();
  await sheet.getByRole('button', { name: /^Tokyo Dome/ }).click();
  await sheet.getByRole('button', { name: '이 장소로' }).click();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('link', { name: 'Tokyo Dome 지도에서 열기' })).toHaveAttribute('href', /google\.com\/maps\/search/);
  expect(osmCalls).toBe(1);
});
