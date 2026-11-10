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

// /iwasset (ancienne adresse /monymounir) : application « i.wasset » du gérant, installable à part,
// qui s'ouvre directement sur son agent IA. Couleurs : blanc, rouge, noir.
if (/^\/(iwasset|monymounir)/.test(window.location.pathname)) {
  document.title = 'i.wasset – الوسيط 777';
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', '/manifest-iwasset.webmanifest');
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', '/icons/iwasset-apple-touch.png');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#111111');
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', 'i.wasset');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isStudio ? <StudioApp /> : <App />}
  </StrictMode>,
);
