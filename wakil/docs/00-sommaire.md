# 00 – Sommaire

**Wakil** (« agent » en arabe) est une application d’agent IA autonome, originale et multiplateforme, qui offre les mêmes *types* de capacités qu’un agent comme Manus. Elle ne reprend ni son code, ni son interface, ni sa marque. Nom choisi à la place de « MONUS », trop proche de « MANUS » (risque de marque et de refus Apple, règle 4.1 « Copycats »).

| # | Livrable | Document |
|---|---|---|
| 1 | Analyse fonctionnelle de la référence | 01 – Analyse fonctionnelle |
| 2 | Cahier des charges | 02 – Cahier des charges |
| 3 | Fonctionnalités MVP, V1, V2, V3 | 03 – Versions |
| 4 | Architecture technique | 04 – Architecture |
| 5 | Structure des dossiers | 05 – Structure des dossiers |
| 6 | Modèles de données | 06 – Modèles de données |
| 7 | Design system | 07 – Design system |
| 8 | Écrans | 08 – Écrans |
| 9–10 | Code, dépendances, commandes | 09 – Commandes |
| 11 | Installation Mac | 11 – Installation Mac |
| 12 | Installation iPhone | 12 – Installation iPhone |
| 13 | Installation Huawei | 13 – Installation Huawei |
| 14 | Conformité App Store / AppGallery | 14 – Conformité des stores |
| 15 | Plan de tests QA | 15 – Plan QA |
| 16 | Feuille de route 90 jours | 16 – Roadmap 90 jours |

## Liens

- Application web (installable) : https://wakil-ia.vercel.app
- Téléchargements (APK, DMG) : https://github.com/alwasset777-ai/al-wasset-777/releases/tag/wakil-latest
- Code : dossier `wakil/` du dépôt `alwasset777-ai/al-wasset-777`

## Principes

1. **Gratuit** : aucun service payant requis (Gemini gratuit, Groq, OpenRouter `:free`, Ollama local, Vercel Hobby, GitHub Actions, Supabase Free).
2. **Privé** : données sur l’appareil (IndexedDB). Les clés IA vont directement de l’appareil au fournisseur.
3. **Une seule base de code** : web/PWA + Android (Capacitor) + Mac (Electron).
4. **Honnêteté** : ce qui n’est pas encore fait est indiqué dans « 03 – Versions » et « 16 – Roadmap ».
