import { expect, test } from '@playwright/test';
import { closePresetDialog } from './helpers';

test('통계: 기록 두 개 → 총액·랭킹 → 다녀온 곳 (S5·U6)', async ({ page }) => {
  await page.goto('./');
  await closePresetDialog(page);
  await page.getByRole('button', { name: '+ 대상 추가' }).click();
  const add = page.getByRole('dialog', { name: '새 대상' });
  await add.getByRole('textbox', { name: '이름' }).fill('가수 A');
  await add.getByRole('button', { name: '추가' }).click();

  for (const amount of [['5', '0', '00'], ['3', '00', '0']]) {
    await page.getByRole('list', { name: '대상' }).getByRole('button', { name: /가수 A/ }).click();
    await page.getByRole('button', { name: /^기타/ }).click();
    await page.getByRole('button', { name: /^기타/ }).click();
    for (const k of amount) await page.getByRole('button', { name: k, exact: true }).click();
    if (amount[0] === '5') {
      await page.getByRole('button', { name: /^장소/ }).click();
      const sheet = page.getByRole('dialog', { name: '어디였나요?' });
      await sheet.getByRole('tab', { name: '해외' }).click();
      await sheet.getByRole('textbox', { name: '장소 검색어' }).fill('우리 동네 카페');
      await sheet.getByRole('button', { name: /이름만 남기기/ }).click();
    }
    await page.getByRole('button', { name: '저장' }).click();
    await expect(page.getByRole('status').filter({ hasText: '저장했어요' })).toBeVisible();
  }

  await page.getByRole('link', { name: '통계' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '통계' })).toBeVisible();
  await expect(page.getByText('8,000원').first()).toBeVisible();
  await expect(page.getByRole('region', { name: '대상 랭킹' })).toContainText('가수 A');
  await expect(page.getByRole('button', { name: '다음 기간' })).toBeDisabled();
  await page.getByRole('button', { name: '이전 기간' }).click();
  await expect(page.getByText('이 기간에는 기록이 없어요.')).toBeVisible();

  await page.getByRole('link', { name: '다녀온 곳' }).click();
  await page.getByRole('button', { name: /우리 동네 카페/ }).click();
  await expect(page.getByRole('list', { name: '우리 동네 카페 기록' })).toContainText('5,000원');
});
