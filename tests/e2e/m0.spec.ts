import { expect, test } from '@playwright/test';

test('하단 탭으로 화면 이동 (U0-12)', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: '기록' })).toBeVisible();
  for (const name of ['내역', '통계', '응원법', '설정']) {
    await page.getByRole('navigation', { name: '하단 탭' }).getByRole('link', { name }).click();
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  }
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: '응원법' })).toBeVisible();
});

test('설치 조건과 오프라인 (U0-2)', async ({ page, context }) => {
  await page.goto('./');
  const manifest = await page.request.get('manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  const m = await manifest.json();
  expect(m.display).toBe('standalone');
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));

  // 서비스 워커가 준비될 때까지 기다린 뒤 인터넷을 끊고 다시 엽니다.
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: '기록' })).toBeVisible();
  await page.goto('./#/stats');
  await expect(page.getByRole('heading', { level: 1, name: '통계' })).toBeVisible();
  await context.setOffline(false);
});
