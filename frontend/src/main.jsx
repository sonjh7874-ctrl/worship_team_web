import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

// "홈 화면에 추가"(PWA 설치) 조건을 만족시키기 위한 최소 서비스워커 등록.
// public/sw.js는 아무것도 캐싱하지 않으므로 개발 중 HMR 동작에 영향을 주지 않는다.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // 설치 배너가 안 뜨는 것 외에 사용자 경험에 영향이 없으므로 조용히 무시한다.
    });
  });
}
