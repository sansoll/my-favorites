import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import './theme/global.css';

// 새 버전이 올라오면 받아 두었다가 다음 실행 때 바꿉니다. 데이터(IndexedDB)는 그대로입니다.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
