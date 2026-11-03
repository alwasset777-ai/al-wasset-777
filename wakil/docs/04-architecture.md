# 04 – Architecture technique

```
┌──────────────────────── Appareil (Mac / iPhone / Huawei / navigateur) ────────────────────────┐
│  Interface React (écrans, design system)                                                      │
│      │                                                                                        │
│  Moteur d’agent (src/agent)  ── PLANIFIER → EXÉCUTER (boucle d’outils) → VÉRIFIER → LIVRER    │
│      │                                │                                                       │
│  Couche modèles (src/core/providers)  │  Registre d’outils (src/tools)                        │
│   Gemini · OpenAI · Anthropic ·       │   web_search · read_webpage · run_javascript ·        │
│   Groq · OpenRouter · Mistral ·       │   fichiers · mémoire · plugins HTTP ·                 │
│   Ollama · compatible OpenAI          │   [Mac] shell_exec · export_to_mac                    │
│      │                                │                                                       │
│  Données locales IndexedDB (src/core/db) ── synchro optionnelle ──► Supabase (gratuit, RLS)   │
└───────┼───────────────────────────────┼───────────────────────────────────────────────────────┘
        │ HTTPS direct (clé de l’utilisateur)      │ /api/fetch, /api/search
        ▼                                          ▼
   Fournisseurs IA                       Fonctions Vercel (gratuites) : proxy web anti-SSRF
```

## Choix et justifications

### Une seule base de code web + Capacitor + Electron (au lieu de React Native/Expo)
- **Réutilisation 100 %** : le même code React sert le web, l’iPhone (PWA), Android/Huawei (Capacitor) et le Mac (Electron). Avec Expo, l’interface mobile serait différente de celle du Mac et du web (deux interfaces à maintenir).
- **Huawei sans Google** : Capacitor n’utilise que la WebView système ; aucune dépendance aux services Google. Expo/EAS fonctionne aussi, mais EAS Build demande un compte et une file d’attente ; ici l’APK est fabriqué gratuitement par GitHub Actions.
- **iPhone gratuit** : la PWA s’installe sans compte développeur Apple. Le projet Capacitor peut ajouter iOS plus tard (`npx cap add ios`) si un compte Apple (payant) est pris.

### Mac : Electron plutôt que Tauri
| Critère | Electron | Tauri |
|---|---|---|
| Taille | ~110 Mo | ~10 Mo |
| Langage du moteur local | **JavaScript/TypeScript** (le même que l’app) | Rust |
| Outils d’agent (terminal, Playwright, fichiers) | Natifs dans Node.js | Nécessitent un « sidecar » Node ou du Rust |
| Rendu identique Intel/Apple Silicon | Chromium embarqué : identique au web | WebKit système : différences possibles |
| Build gratuit | GitHub Actions macOS | GitHub Actions macOS |

Le rôle du Mac est d’être **le moteur d’exécution** (terminal, navigateur piloté en V2) : Electron permet de l’écrire dans le même langage, avec moins de risques de bugs. Tauri reste une option si la taille devient prioritaire.

### Supabase plutôt que Firebase
Firebase dépend des services Google (absents sur Huawei récents) et sa messagerie push (FCM) ne marche pas sans eux. Supabase fonctionne partout via HTTPS, a une offre gratuite, et la sécurité par ligne (RLS) isole les données de chaque utilisateur. La synchro est **optionnelle** : l’app fonctionne entièrement en local.

## Moteur d’agent (src/agent/engine.ts)
1. **Planification** : appel JSON → `{title, steps[]}` (2–7 étapes) ; plan de secours si JSON invalide.
2. **Exécution** : pour chaque étape, boucle « modèle ↔ outils » (max N actions configurable), avec le plan, les résultats précédents et l’étape courante dans le contexte.
3. **Vérification** : un « contrôleur qualité » compare objectif, notes et fichiers produits → `{ok, notes, fixes[]}`.
4. **Correction** : si `ok=false`, ajout d’étapes « Correction : … » puis re-vérification (tours configurables).
5. **Livraison** : réponse finale Markdown (résultat, fichiers, sources, limites).
6. Chaque événement est journalisé (`Task.logs`) et sauvegardé en direct → affichage temps réel et reprise après fermeture.

Spécificités fournisseurs gérées : signatures de pensée Gemini renvoyées telles quelles, `tool_use`/`tool_result` Anthropic, `tool_calls` OpenAI, balises `<think>` retirées, erreurs traduites en français, nouvelles tentatives automatiques sur quota (429) et erreurs 5xx.

## Sécurité
- Proxy `/api/fetch` : http(s) uniquement, ports limités, DNS résolu et IP privées/métadonnées refusées à chaque redirection, 3 Mo max, 15 s max, texte seulement.
- Bac à sable JS : Web Worker sans `fetch`/`XMLHttpRequest`/`WebSocket`/`importScripts`, arrêt à 15 s.
- Aperçu HTML : `iframe sandbox="allow-scripts"` sans même-origine.
- Markdown : DOMPurify ; liens en `noopener`.
- Mac : `contextIsolation`, `sandbox`, pas de `nodeIntegration`, pont IPC minimal, fichiers limités à `~/Wakil`, chaque commande confirmée par une boîte de dialogue native.
- Clés : stockées localement, jamais synchronisées ni exportées, refus de mémoriser des secrets.
- Contenus web traités comme des données (consigne anti-injection dans le prompt système).
