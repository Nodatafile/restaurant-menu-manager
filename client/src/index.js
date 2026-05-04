// client/src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// PWA 서비스 워커 등록
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 서비스 워커 등록 (PWA 지원)
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    // 새로운 버전이 있으면 알림
    if (window.confirm('새로운 버전이 있습니다. 업데이트하시겠습니까?')) {
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  },
});
