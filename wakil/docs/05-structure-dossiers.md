# 05 – Structure des dossiers

```
wakil/
├── index.html                 # page unique (PWA)
├── package.json               # dépendances et scripts
├── vite.config.ts             # build web / natif
├── vercel.json                # hébergement + fonctions
├── capacitor.config.json      # application Android
├── api/                       # fonctions serveur Vercel (gratuites)
│   ├── fetch.ts               #   lire une page web (anti-SSRF)
│   ├── search.ts              #   recherche web sans clé
│   └── _lib/guard.ts          #   sécurité réseau + HTML → texte
├── src/
│   ├── main.tsx               # démarrage, service worker
│   ├── App.tsx                # routeur, onboarding, verrouillage
│   ├── core/                  # cœur sans interface
│   │   ├── types.ts           #   modèles de données
│   │   ├── db.ts              #   IndexedDB
│   │   ├── store.ts           #   réglages, chats, tâches, fichiers, mémoire
│   │   ├── providers.ts       #   multi-fournisseurs IA
│   │   ├── defaults.ts        #   fournisseurs, agents intégrés
│   │   ├── cloud.ts           #   synchro Supabase
│   │   └── platform.ts        #   web / Android / Mac
│   ├── agent/
│   │   ├── engine.ts          #   moteur autonome (plan/exécution/vérification)
│   │   └── runtime.ts         #   liaison conversations ↔ moteur, approbations
│   ├── tools/
│   │   ├── registry.ts        #   outils intégrés + plugins
│   │   └── sandbox.ts         #   exécution JS isolée
│   ├── ui/                    # design system et composants
│   ├── pages/                 # écrans
│   └── styles/app.css         # jetons de design (clair/sombre)
├── public/                    # icônes, manifest, service worker
├── android/                   # projet Android (Capacitor)
├── desktop/                   # application Mac (Electron)
│   ├── main.cjs               #   fenêtre + moteur local sécurisé
│   └── preload.cjs            #   pont minimal
├── supabase/schema.sql        # base gratuite + sécurité par ligne
├── docs/                      # cette documentation (visible dans l’app)
├── tests/                     # tests unitaires + test navigateur
└── scripts/                   # génération d’icônes
.github/workflows/wakil-apps.yml   # fabrication APK + DMG + publication
```
