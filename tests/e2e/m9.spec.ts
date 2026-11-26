import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { closePresetDialog } from './helpers';

const FONT = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'].find((f) => fs.existsSync(f));

test('사진으로 테마 만들기 → 적용, 글꼴 넣기 → 앱을 다시 열어도 유지 (S10)', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('./');
  await closePresetDialog(page);
  await page.getByRole('link', { name: '설정' }).click();
  await page.getByRole('link', { name: /테마와 꾸미기/ }).click();

  await page.getByRole('button', { name: /사진으로 만들기/ }).click();
  await page.getByLabel('테마 사진').setInputFiles(path.resolve('public/icons/icon-512.png'));
  await expect(page.getByRole('region', { name: '뽑은 색' })).toBeVisible();
  await page.getByRole('button', { name: '이 테마 적용' }).click();
  await expect(page.getByRole('status').filter({ hasText: '사진 테마 1을 적용했어요' })).toBeVisible();
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());

  if (FONT) {
    await page.getByRole('button', { name: /글꼴/ }).click();
    const dlg = page.getByRole('dialog', { name: '글꼴' });
    await dlg.getByLabel('글꼴 파일').setInputFiles(FONT);
    await expect(page.getByRole('status').filter({ hasText: '글꼴을 적용했어요' })).toBeVisible();
    await dlg.getByRole('button', { name: '닫기' }).click();
  }

  await page.reload();
  await expect(page.getByRole('heading', { name: '테마와 꾸미기' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())).toBe(accent);
  await expect(page.getByRole('radio', { name: /사진 테마 1.*사용 중/ })).toBeVisible();
  if (FONT) {
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(/UserFont-/);
  }
  expect(errors.filter((e) => /Content Security Policy/i.test(e))).toEqual([]);
});
