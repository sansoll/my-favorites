/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { cspContent } from './src/security/csp';
import pkg from './package.json' with { type: 'json' };

// GitHub Pages 주소: https://sansoll.github.io/my-favorites/
// 미리보기(PREVIEW=1)는 /my-favorites/preview/에 올리고, 저장소 이름도 따로 씁니다.
const PREVIEW = process.env.PREVIEW === '1';
const BASE = PREVIEW ? '/my-favorites/preview/' : '/my-favorites/';

export default defineConfig({
  base: BASE,
  define: { __PREVIEW__: JSON.stringify(PREVIEW), __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    {
      // 배포 빌드에만 보안 정책(CSP)을 넣습니다. 개발 서버는 HMR 때문에 넣지 않습니다.
      name: 'csp-meta',
      apply: 'build',
      transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: cspContent() }, injectTo: 'head-prepend' }],
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        id: BASE,
        name: PREVIEW ? '내가 좋아하는 것들 (미리보기)' : '내가 좋아하는 것들',
        short_name: PREVIEW ? '미리보기' : '좋아하는 것들',
        description: '좋아하는 것에 쓴 돈을 기록하고 응원법을 모아 외우는 앱',
        lang: 'ko',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFFFFF',
        theme_color: '#5B4CDB',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 자기 파일만 저장해 둡니다(DESIGN 10장).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        // 본 앱은 미리보기 주소를 가로채지 않습니다.
        navigateFallbackDenylist: PREVIEW ? [] : [/^\/my-favorites\/preview\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
