import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { StudioApp } from './StudioApp';
import './index.css';
import { registerServiceWorker } from './services/pwa';

registerServiceWorker();

// /studio : application « صانع الإعلانات » (installable à part sur le téléphone), nom générique pour toutes les agences.
const isStudio = window.location.pathname.startsWith('/studio');
if (isStudio) {
  document.title = 'صانع الإعلانات العقارية';
  document.documentElement.lang = 'ar';
  document.documentElement.dir = 'rtl';
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', '/manifest-studio.webmanifest');
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', '/icons/studio-apple-touch.png?v=4');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#111111');
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', 'إعلانات عقارية');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isStudio ? <StudioApp /> : <App />}
  </StrictMode>,
);
