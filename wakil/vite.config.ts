import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// mode "native" = build pour Android (Capacitor) et Mac (Electron) :
// chemins relatifs + adresse absolue du serveur pour /api.
export default defineConfig(({ mode }) => ({
  base: mode === 'native' ? './' : '/',
  plugins: [react(), tailwindcss()],
  define: {
    __WAKIL_API_BASE__: JSON.stringify(
      mode === 'native' ? process.env.WAKIL_API_BASE || 'https://wakil-ia.vercel.app' : '',
    ),
    __WAKIL_VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'),
  },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 900 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
}));
