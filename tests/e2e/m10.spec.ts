import { expect, test } from '@playwright/test';

test('첫 실행 → 튜토리얼 13단계 → 시작하기 → 기본 프리셋 창 → 고른 것만 생기고 예시는 안 남음 (S12)', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveURL(/#\/tutorial$/);
  await expect(page.getByText('1 / 13')).toBeVisible();
  await page.getByRole('region', { name: /예시 화면/ }).locator('[data-hl]').click();
  for (let k = 2; k < 13; k++) {
    await expect(page.getByText(`${k} / 13`)).toBeVisible();
    await page.getByRole('button', { name: '다음' }).click();
  }
  await expect(page.getByText('13 / 13')).toBeVisible();
  await page.getByRole('button', { name: '시작하기' }).click();

  const dlg = page.getByRole('dialog', { name: '자주 쓰는 프리셋을 만들어 둘까요?' });
  await dlg.getByRole('checkbox', { name: /배우용/ }).click();
  await dlg.getByRole('button', { name: /개 만들기/ }).click();
  await expect(page.getByRole('status').filter({ hasText: '가수용 프리셋을 만들었어요' })).toBeVisible();
  // 튜토리얼 예시(가수 A, 154,000원)는 남지 않음
  await expect(page.getByRole('list', { name: '대상' })).not.toContainText('가수 A');
  await page.getByRole('link', { name: '내역' }).click();
  await expect(page.getByText('154,000원')).toHaveCount(0);

  await page.reload();
  await expect(page).not.toHaveURL(/tutorial/);
  await expect(page.getByRole('dialog', { name: '자주 쓰는 프리셋을 만들어 둘까요?' })).toHaveCount(0);
});

test('기록 → 통계의 결산 → 카드 숫자가 통계와 같음 → 공유 이미지 (S11)', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await page.getByRole('dialog', { name: '자주 쓰는 프리셋을 만들어 둘까요?' }).getByRole('button', { name: '나중에' }).click();
  await page.getByRole('button', { name: '+ 대상 추가' }).click();
  const add = page.getByRole('dialog', { name: '새 대상' });
  await add.getByRole('textbox', { name: '이름' }).fill('가수 A');
  await add.getByRole('button', { name: '추가' }).click();
  await page.getByRole('list', { name: '대상' }).getByRole('button', { name: /가수 A/ }).click();
  await page.getByRole('button', { name: /^기타/ }).click();
  await page.getByRole('button', { name: /^기타/ }).click();
  for (const k of ['4', '5', '00']) await page.getByRole('button', { name: k, exact: true }).click();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('status').filter({ hasText: '저장했어요' })).toBeVisible();

  await page.getByRole('link', { name: '통계' }).click();
  await page.getByRole('radio', { name: '연' }).click();
  await expect(page.getByText('4,500원').first()).toBeVisible();
  await page.getByRole('link', { name: /년 결산/ }).click();
  await page.getByRole('button', { name: '열어 보기' }).click();
  const card = page.locator('article[aria-hidden="false"]');
  await expect(card).toContainText('4,500원');
  await page.getByRole('button', { name: '다음 카드' }).click();
  await page.getByRole('button', { name: '다음 카드' }).click();
  await expect(card).toContainText('가수 A');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '이 카드 이미지로 공유' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^my-favorites-recap-\d{4}-3\.png$/);
  await page.getByRole('button', { name: '닫기' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '통계' })).toBeVisible();
});
