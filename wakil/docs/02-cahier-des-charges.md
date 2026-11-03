# 02 – Cahier des charges

## Objectif
Une application d’agent IA autonome, installable sur Mac (Apple Silicon + Intel), iPhone et Huawei, gratuite à utiliser, capable de recevoir un objectif complexe, de le planifier, de l’exécuter avec des outils, de vérifier et de livrer des fichiers.

## Utilisateurs
- **Principal** : dirigeant de PME (agence immobilière Al Wasset 777, Meknès), non technique, francophone/arabophone.
- **Secondaire** : équipe de l’agence, puis usage général.

## Exigences fonctionnelles
| ID | Exigence | Priorité | État |
|---|---|---|---|
| F1 | Chat multi-conversations (créer, renommer, épingler, supprimer, rechercher) | MVP | ✅ |
| F2 | Mode agent autonome : plan → exécution → vérification → correction → livraison | MVP | ✅ |
| F3 | Outils : recherche web, lecture de page, code en bac à sable, fichiers, mémoire, date | MVP | ✅ |
| F4 | Espace de fichiers : aperçu, édition, import, export unitaire, ZIP, PDF | MVP | ✅ |
| F5 | Projets avec consignes permanentes | MVP | ✅ |
| F6 | Mémoire persistante (ajout manuel ou par l’agent) | MVP | ✅ |
| F7 | Historique et recherche plein texte | MVP | ✅ |
| F8 | Outils/plugins extensibles (plugins HTTP, agents personnalisés) | MVP | ✅ |
| F9 | Sélection du modèle (global, par conversation, par agent) multi-fournisseurs | MVP | ✅ |
| F10 | Thème clair/sombre/auto | MVP | ✅ |
| F11 | Approbation des actions sensibles | MVP | ✅ |
| F12 | Dictée vocale (navigateur) | MVP | ✅ (selon appareil) |
| F13 | Pièces jointes (texte, images pour la vision) | MVP | ✅ |
| F14 | Synchronisation multi-appareils (Supabase gratuit) | V1 | ✅ code / ⚠️ à valider avec un vrai projet |
| F15 | Terminal et dossier local sur Mac | V1 | ✅ code / ⚠️ build CI |
| F16 | Verrouillage par code | MVP | ✅ |
| F17 | Navigateur piloté (clics) sur Mac | V2 | ⏳ |
| F18 | Tâches planifiées / notifications push | V2 | ⏳ |
| F19 | Télécommande : lancer une tâche depuis le téléphone, exécutée sur le Mac | V2 | ⏳ |

## Exigences non fonctionnelles
- **Coût** : 0 € (services gratuits uniquement).
- **Confidentialité** : stockage local ; clés jamais synchronisées ; pas de télémétrie.
- **Sécurité** : proxy web anti-SSRF, bac à sable sans réseau, rendu Markdown nettoyé, aperçu HTML isolé (iframe sandbox), approbation des commandes Mac (double confirmation).
- **Performance** : premier affichage < 2 s en 4G ; bundle ≈ 150 Ko gzip.
- **Accessibilité** : navigation clavier, libellés ARIA, contrastes, mouvement réduit respecté.
- **Hors-ligne** : l’interface et les données s’ouvrent sans réseau (l’IA nécessite internet sauf Ollama).
- **Langue** : interface française ; réponses dans la langue de l’utilisateur (FR/AR/darija), mise en page RTL automatique.
