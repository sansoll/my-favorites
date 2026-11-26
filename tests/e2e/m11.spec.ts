import { expect, test } from '@playwright/test';
import { closePresetDialog } from './helpers';

// 가짜 카카오(좌표 포함)와 빈 지도 타일
const FAKE_KAKAO = `window.kakao = { maps: { load: (cb) => cb(), services: {
  Status: { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT', ERROR: 'ERROR' },
  Places: function () { this.keywordSearch = (q, cb) => q.includes('KSPO')
    ? cb([{ id: '8', place_name: 'KSPO DOME', road_address_name: '서울 송파구 올림픽로 424', address_name: '', x: '127.1268', y: '37.5199' }], 'OK')
    : cb([], 'ZERO_RESULT'); } } } };`;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');

test('휴대폰 피드백: 메모 시트 → 저장, 다녀온 곳 지도에 핀, 보안 정책 위반 없음', async ({ page }) => {
  const violations: string[] = [];
  await page.exposeFunction('__csp', (v: string) => violations.push(v));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { __csp: (v: string) => void }).__csp(`${e.violatedDirective} ${e.blockedURI}`)));
  await page.route('https://dapi.kakao.com/**', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_KAKAO }));
  await page.route('https://tile.openstreetmap.org/**', (r) => r.fulfill({ contentType: 'image/png', body: PNG }));

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

  // 메모: 시트에서 쓰고 저장
  await page.getByRole('button', { name: /^메모/ }).click();
  const memo = page.getByRole('dialog', { name: '메모' });
  await memo.getByRole('textbox', { name: '메모' }).fill('첫콘');
  await memo.getByRole('button', { name: '메모 저장' }).click();
  await expect(page.getByRole('button', { name: /^메모\s*첫콘/ })).toBeVisible();
  // 저장 버튼은 스크롤 없이 화면 안에
  const box = await page.getByRole('button', { name: '저장', exact: true }).boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);

  await page.getByRole('button', { name: /^장소/ }).click();
  const sheet = page.getByRole('dialog', { name: '어디였나요?' });
  await sheet.getByRole('textbox', { name: '장소 검색어' }).fill('KSPO');
  await sheet.getByRole('button', { name: /^KSPO DOME/ }).click();
  await sheet.getByRole('button', { name: '이 장소로' }).click();
  await page.getByRole('button', { name: '저장', exact: true }).click();

  await page.getByRole('link', { name: '통계' }).click();
  await page.getByRole('link', { name: /다녀온 곳/ }).click();
  await expect(page.getByRole('region', { name: '다녀온 곳 지도' })).toBeVisible();
  const pin = page.getByTitle('KSPO DOME 1번');
  await expect(pin).toBeVisible();
  await pin.click();
  await expect(page.getByRole('list', { name: 'KSPO DOME 기록' })).toBeVisible();
  await expect(page.getByText('OpenStreetMap', { exact: false }).first()).toBeVisible();
  expect(violations).toEqual([]);
});

// 결과가 많은 카카오 검색
const MANY_KAKAO = `window.kakao = { maps: { load: (cb) => cb(), services: {
  Status: { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT', ERROR: 'ERROR' },
  Places: function () { this.keywordSearch = (q, cb) => cb(Array.from({ length: 15 }, (_, i) => ({ id: String(i + 1), place_name: '체조경기장 ' + (i + 1), road_address_name: '서울 송파구 올림픽로 ' + (i + 1), address_name: '' })), 'OK'); } } } };`;

test('휴대폰 피드백: 장소 결과가 길어도 `이 장소로`가 늘 보이고, 빈 곳을 누르면 키보드(입력)가 끝남', async ({ page }) => {
  await page.route('https://dapi.kakao.com/**', (r) => r.fulfill({ contentType: 'text/javascript', body: MANY_KAKAO }));
  await page.goto('./');
  await closePresetDialog(page);
  await page.getByRole('button', { name: '+ 대상 추가' }).click();
  const add = page.getByRole('dialog', { name: '새 대상' });
  await add.getByRole('textbox', { name: '이름' }).fill('가수 A');
  await add.getByRole('button', { name: '추가' }).click();
  await page.getByRole('list', { name: '대상' }).getByRole('button', { name: /가수 A/ }).click();
  await page.getByRole('button', { name: /^기타/ }).click();
  await page.getByRole('button', { name: /^기타/ }).click();
  await page.getByRole('button', { name: /^장소/ }).click();
  const sheet = page.getByRole('dialog', { name: '어디였나요?' });
  const input = sheet.getByRole('textbox', { name: '장소 검색어' });
  await input.fill('체조');
  await expect(input).toBeFocused();
  // 시트 제목(빈 곳)을 누르면 입력이 끝남
  await sheet.getByRole('heading', { name: '어디였나요?' }).click();
  await expect(input).not.toBeFocused();
  const last = sheet.getByRole('button', { name: /^체조경기장 15/ });
  await last.scrollIntoViewIfNeeded();
  await last.click();
  const ok = sheet.getByRole('button', { name: '이 장소로' });
  await expect(ok).toBeInViewport();
  await sheet.getByRole('button', { name: /^체조경기장 1\b/ }).scrollIntoViewIfNeeded();
  await expect(ok).toBeInViewport();
  await ok.click();
  await expect(page.getByRole('button', { name: /^장소\s*체조경기장 15/ })).toBeVisible();
});
