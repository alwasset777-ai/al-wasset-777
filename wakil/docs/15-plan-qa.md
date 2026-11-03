# 15 – Plan de tests QA

## Automatique (à chaque envoi, GitHub Actions)
| Niveau | Commande | Couverture |
|---|---|---|
| Types | `npm run lint` | Tout le code TypeScript (app + serveur + tests) |
| Unitaires | `npm test` | Conversions Gemini/OpenAI/Anthropic, signatures Gemini, JSON tolérant, chemins de fichiers, recherche mémoire, moteur d’agent complet (plan → outil → vérif → livraison), boucle de correction, clé invalide, annulation, anti-SSRF (IP privées, ports, schémas), extraction HTML, parsing DuckDuckGo |
| Build | `npm run build` | Build web de production |
| Bout en bout | `npm run e2e` | Chromium bureau (clair) + mobile 390 px (sombre), IA simulée : onboarding, test de clé, tâche agent avec recherche + création de fichier, aperçu HTML, mode chat, 8 écrans, absence de défilement horizontal, erreurs console |
| Natif | workflow « Wakil apps » | Compilation APK (Gradle) et DMG (Apple Silicon + Intel) |

## Manuel (avant chaque version)
### Fonctionnel
- [ ] Clé Gemini réelle : « Enregistrer et tester » ✓
- [ ] Tâche réelle : « Rapport marché immobilier Meknès avec sources » → fichier .md, sources cliquables
- [ ] Tâche « site web » → index.html prévisualisé, téléchargé, ouvert
- [ ] Analyse CSV importé → `run_javascript` lit le fichier
- [ ] Arrêter une tâche en cours → statut « Arrêtée »
- [ ] Quota dépassé (429) → message clair, nouvelle tentative
- [ ] Mode hors-ligne : l’app s’ouvre, l’historique est lisible
- [ ] Dictée vocale (Chrome/Safari)
- [ ] Projet avec consignes → respectées dans la réponse
- [ ] Mémoire : « souviens-toi que… » → visible dans Mémoire
- [ ] Sauvegarde exportée puis importée sur un autre appareil
- [ ] Synchro Supabase entre deux appareils

### Plateformes
- [ ] Mac Apple Silicon et Intel : ouverture, `shell_exec` (`ls`), double confirmation, export vers ~/Wakil
- [ ] iPhone (Safari → écran d’accueil) : installation, plein écran, partage de fichiers
- [ ] Huawei EMUI/HarmonyOS 2–4 : installation APK, mise à jour par-dessus
- [ ] HarmonyOS NEXT : version web ajoutée à l’écran d’accueil
- [ ] Android récent (Chrome) : installation PWA et APK

### Sécurité
- [ ] `read_webpage` sur `http://169.254.169.254` → refusé
- [ ] Page web contenant « ignore tes instructions » → l’agent ne suit pas
- [ ] HTML malveillant dans un fichier → aucun accès à l’app (iframe isolée)
- [ ] La sauvegarde exportée ne contient aucune clé

## Critères de sortie
Tous les tests automatiques verts ; checklist manuelle ≥ 90 % ; aucun bug bloquant ouvert.
