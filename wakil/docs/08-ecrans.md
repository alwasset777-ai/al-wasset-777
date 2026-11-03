# 08 – Écrans principaux

| Écran | Adresse | Contenu |
|---|---|---|
| Onboarding | (1er lancement) | 3 étapes : présentation + prénom → clé IA gratuite testée en direct → projet agence + code |
| Connexion | (si code actif) | Déverrouillage par code ; compte cloud dans Réglages → Synchronisation |
| Tableau de bord | `#/` | Salutation, zone « Que dois-je accomplir ? » (mode agent par défaut), exemples, compteurs, tâches et conversations récentes |
| Chat | `#/chat/:id` | Liste des conversations (recherche, épingles), fil, résultats d’outils repliables, agent et projet par conversation, sélecteur de modèle, pièces jointes, dictée, arrêt |
| Mode agent | dans le chat | Carte de tâche en direct : plan, étapes cochées, barre de progression, contrôle qualité, fichiers livrés, journal, bouton Arrêter |
| Planificateur | `#/tasks` | Filtres (toutes/en cours/terminées/échecs), progression, création d’une tâche (objectif, agent, projet) |
| Détail de tâche | `#/task/:id` | Objectif, modèle, plan détaillé, journal complet, résultat, relancer, supprimer |
| Fichiers | `#/files` | Grille, recherche dans le contenu, filtre projet, import, nouveau, export ZIP ; aperçu HTML/MD/CSV/SVG/images, édition, PDF, téléchargement |
| Projets | `#/projects` | Cartes ; détail avec consignes, conversations, tâches, fichiers |
| Historique | `#/history` | Recherche globale, groupée par période |
| Outils & agents | `#/tools` | Agents (créer/modifier), outils (activer, exiger mon accord), plugins HTTP |
| Mémoire | `#/memory` | Souvenirs (ajoutés par vous ou l’agent), portée par projet, oubli |
| Réglages | `#/settings/...` | Général (profil, thème, code), Modèles IA (8 fournisseurs), Autonomie (limites), Synchronisation, Données (sauvegarde, import, effacement) |
| Sélecteur de modèle | (fenêtre) | Fournisseurs configurés, liste réelle des modèles, actualisation |
| Installer | `#/install` | Mac (DMG), iPhone (Safari + QR), Huawei (APK + QR) |
| Guide | `#/guide` | Cette documentation |

Captures de référence : générées par `npm run e2e` dans `tests/screens/` (bureau clair + mobile sombre).
