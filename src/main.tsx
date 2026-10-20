import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { StudioApp } from './StudioApp';
import './index.css';
import { registerServiceWorker } from './services/pwa';

registerServiceWorker();

// /studio : application séparée du gérant (installable à part sur le téléphone).
const isStudio = window.location.pathname.startsWith('/studio');
if (isStudio) {
  document.title = 'إعلانات الوسيط 777';
  document.documentElement.lang = 'ar';
  document.documentElement.dir = 'rtl';
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', '/manifest-studio.webmanifest');
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', '/icons/studio-apple-touch.png?v=3');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#111111');
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', 'إعلانات 777');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isStudio ? <StudioApp /> : <App />}
  </StrictMode>,
);
