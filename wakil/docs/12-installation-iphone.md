# 12 – Installation sur iPhone

## Méthode gratuite (recommandée) — application web installée
1. Sur l’iPhone, ouvrez **Safari** à l’adresse https://wakil-ia.vercel.app (ou scannez le QR code de la page Installer).
2. Touchez **Partager** (carré avec une flèche).
3. Choisissez **« Sur l’écran d’accueil »** → **Ajouter**.
4. Ouvrez Wakil depuis l’icône : plein écran, hors-ligne, comme une app.

Ce qui marche : tout le chat, le mode agent, la recherche web, les fichiers, la mémoire, la dictée (Safari), le partage des fichiers.
Limite : pas de terminal (réservé au Mac — règle Apple sur l’exécution de code).

Vos données restent dans l’iPhone ; pour les retrouver sur le Mac : Réglages → Synchronisation (Supabase gratuit) ou Données → Exporter/Importer.

## App native via TestFlight / App Store (option payante — non nécessaire)
Apple exige le **Apple Developer Program (99 $/an)** pour TestFlight et l’App Store. Si vous le décidez un jour :
1. Sur un Mac avec Xcode : `cd wakil && npm i @capacitor/ios && npx cap add ios && npm run build:native && npx cap sync ios`
2. `npx cap open ios` → Xcode → Signing (votre équipe) → Product → Archive → Distribute → App Store Connect.
3. Dans App Store Connect → TestFlight → ajoutez-vous comme testeur → installez l’app **TestFlight** sur l’iPhone.

Alternative gratuite technique : Xcode avec un identifiant Apple gratuit installe l’app sur votre iPhone, mais elle expire tous les 7 jours (à réinstaller). Déconseillé au quotidien.
