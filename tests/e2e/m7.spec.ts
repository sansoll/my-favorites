import { expect, test } from '@playwright/test';
import { closePresetDialog } from './helpers';

test('내보내기 → 모든 데이터 지우기 → 불러오기 → 그대로 (S7), 보안 정책 위반 없음', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) violations.push(m.text()); });
  await page.goto('./');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("default-src 'self'");
  await closePresetDialog(page);

  await page.getByRole('button', { name: '+ 대상 추가' }).click();
  const add = page.getByRole('dialog', { name: '새 대상' });
  await add.getByRole('textbox', { name: '이름' }).fill('가수 A');
  await add.getByRole('button', { name: '추가' }).click();
  await page.getByRole('list', { name: '대상' }).getByRole('button', { name: /가수 A/ }).click();
  await page.getByRole('button', { name: /^기타/ }).click();
  await page.getByRole('button', { name: /^기타/ }).click();
  for (const k of ['7', '00', '0']) await page.getByRole('button', { name: k, exact: true }).click();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('status').filter({ hasText: '저장했어요' })).toBeVisible();

  await page.getByRole('link', { name: '설정' }).click();
  await page.getByRole('button', { name: /내보내기/ }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('dialog', { name: '내보내기' }).getByRole('button', { name: '파일로 저장' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^my-favorites-.*\.json$/);
  const file = await download.path();

  await page.getByRole('button', { name: /모든 데이터 지우기/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '모두 지우기' }).click();
  await expect(page.getByRole('list', { name: '대상' })).not.toContainText('가수 A');

  await page.getByRole('link', { name: '설정' }).click();
  await page.getByLabel('불러올 파일').setInputFiles(file);
  await page.getByRole('alertdialog', { name: '지금 데이터를 덮어쓸까요?' }).getByRole('button', { name: '덮어쓰기' }).click();
  await expect(page.getByRole('status').filter({ hasText: '불러왔어요' })).toBeVisible();

  await page.getByRole('link', { name: '기록', exact: true }).click();
  await expect(page.getByRole('list', { name: '대상' })).toContainText('가수 A');
  await page.getByRole('link', { name: '내역' }).click();
  await expect(page.getByText('7,000원').first()).toBeVisible();
  expect(violations).toEqual([]);
});
