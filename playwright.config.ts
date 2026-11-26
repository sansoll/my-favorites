import { defineConfig, devices } from '@playwright/test';

// 갤럭시 화면 크기로 전체 흐름을 확인합니다(DESIGN 6장).
export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: 'http://localhost:4173/my-favorites/',
    ...devices['Galaxy S9+'],
    // 브라우저를 내려받을 수 없는 곳에서는 CHROME_PATH로 설치된 크롬을 씁니다.
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : undefined,
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/my-favorites/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
