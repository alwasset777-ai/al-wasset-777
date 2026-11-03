# 09 – Code, dépendances et commandes

Tout le code est dans le dossier `wakil/` (fichiers complets, pas d’extraits).

## Dépendances (gratuites, open source)
- **Application** : React 19, Vite 6, Tailwind CSS 4, lucide-react (icônes), marked + DOMPurify (Markdown sûr), fflate (ZIP), qrcode-generator.
- **Natif** : Capacitor 8 (Android), Electron 38 + electron-builder 26 (Mac).
- **Tests** : Vitest, fake-indexeddb, Playwright (navigateur).
- **Serveur** : fonctions Vercel (Node 22).

## Installer
```bash
cd wakil
npm install
```

## Développer
```bash
npm run dev            # http://localhost:5173 (les outils web /api fonctionnent via `vercel dev`)
```

## Vérifier
```bash
npm run lint           # types TypeScript
npm test               # 14 tests unitaires (fournisseurs, moteur d'agent, sécurité)
npm run build          # build web de production (dist/)
npm run e2e            # test complet dans Chromium, bureau + mobile, avec captures
```

## Android / Huawei (APK)
Automatique : chaque envoi sur GitHub lance « Wakil apps » qui publie `Wakil-android.apk`.
En local (Android Studio + SDK 36 installés) :
```bash
npm run cap:sync
cd android && ./gradlew assembleRelease
```

## Mac (DMG)
Automatique via GitHub Actions (runner macOS). En local sur un Mac :
```bash
npm run build:native
cd desktop && npm install && npm start          # lancer
npm run dist:mac                                 # fabriquer l'app (release/)
```

## Web (Vercel)
Projet Vercel `wakil-ia`, dossier racine `wakil/`. Chaque fusion sur `main` met le site à jour.

## Icônes
```bash
npm run icons                       # PWA + Mac
node scripts/make-android-assets.mjs  # Android
```
