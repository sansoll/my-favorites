import { expect, test } from '@playwright/test';
import path from 'node:path';
import { closePresetDialog } from './helpers';

test('체크 항목 만들기 → 오늘 체크 → 표지 사진 넣기 → 사진 창문 보기 (S4 일부)', async ({ page }) => {
  await page.goto('./');
  await closePresetDialog(page);
  await page.getByRole('button', { name: '+ 대상 추가' }).click();
  const add = page.getByRole('dialog', { name: '새 대상' });
  await add.getByRole('textbox', { name: '이름' }).fill('가수 A');
  await add.getByRole('button', { name: '추가' }).click();

  await page.getByRole('link', { name: '체크 항목 만들기' }).click();
  await page.getByRole('button', { name: '항목 관리' }).click();
  const sheet = page.getByRole('dialog', { name: '체크 항목' });
  await sheet.getByRole('textbox', { name: '체크 항목 이름' }).fill('버블');
  await sheet.getByRole('button', { name: '추가' }).click();
  await sheet.getByRole('button', { name: '닫기' }).click();

  await page.getByRole('link', { name: '뒤로' }).click();
  await page.getByRole('button', { name: /가수 A · 버블/ }).click();
  await expect(page.getByRole('status')).toContainText('가수 A · 버블 오늘 체크했어요 ✓');

  await page.getByRole('link', { name: '달력' }).click();
  await expect(page.getByText('1일 체크했어요')).toBeVisible();
  await page.getByRole('button', { name: '+ 달력 표지 사진 넣기' }).click();
  const cover = page.getByRole('dialog', { name: /달력 표지/ });
  await cover.getByLabel('사진 넣기').setInputFiles(path.resolve('public/icons/icon-512.png'));
  await expect(page.getByRole('status')).toContainText('표지 사진을 넣었어요');
  await cover.getByRole('button', { name: '닫기' }).click();

  await expect(page.getByRole('button', { name: '표지 바꾸기' })).toBeVisible();
  const win = page.getByRole('button', { name: /오늘 체크함/ }).locator('span').first();
  await expect(win).toHaveCSS('background-image', /^url\("blob:/);
  // 저장한 사진은 긴 변 900px 이하
  const size = await page.evaluate(async () => {
    const req = indexedDB.open('my-favorites');
    const db: IDBDatabase = await new Promise((res) => { req.onsuccess = () => res(req.result); });
    return new Promise<{ w: number; h: number; type: string }>((res) => {
      const r = db.transaction('blobs').objectStore('blobs').getAll();
      r.onsuccess = () => res({ w: r.result[0].width, h: r.result[0].height, type: r.result[0].data.type });
    });
  });
  expect(Math.max(size.w, size.h)).toBeLessThanOrEqual(900);
  expect(size.type).toBe('image/jpeg');
  await page.getByRole('button', { name: /오늘 체크함/ }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'test-results/m4-check.png' });
});
