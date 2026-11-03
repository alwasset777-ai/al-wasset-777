# 01 – Analyse fonctionnelle de la référence

Analyse fondée **uniquement sur des informations publiques** (présentations, articles et démos publiques des agents autonomes généralistes de type Manus, 2025–2026). Aucun code, texte ou visuel n’a été repris.

## Ce que fait un agent autonome généraliste

| Capacité | Description publique | Équivalent Wakil |
|---|---|---|
| Objectif → plan | L’utilisateur donne un objectif ; l’agent le découpe en sous-tâches visibles | Planificateur JSON (2–7 étapes) affiché en direct |
| Exécution en boucle | L’agent enchaîne actions et observations jusqu’à la fin | Boucle d’outils par étape (limite configurable) |
| Ordinateur virtuel | Navigateur, terminal, système de fichiers dans le cloud | Navigateur : lecture de pages et recherche ; terminal : app Mac (moteur local) ; fichiers : espace de travail |
| Recherche web | Recherche multi-sources avec citations | `web_search` (Recherche Google via Gemini, puis DuckDuckGo, puis Wikipédia) + `read_webpage` |
| Code | Écrit et exécute du code | `run_javascript` (bac à sable) ; Python/Node/shell sur Mac via `shell_exec` |
| Livrables | Rapports, sites, présentations, tableaux, fichiers téléchargeables | `write_file` + aperçu HTML/Markdown/CSV + export ZIP/PDF |
| Suivi transparent | Fil d’actions consultable, relecture de la tâche | Journal horodaté de chaque appel d’outil + page Tâche |
| Vérification | Relecture et correction avant livraison | Contrôle qualité + tours de correction automatiques |
| Exécution asynchrone | Tâches longues, notification à la fin | Tâches indépendantes de la conversation (V2 : exécution serveur/Mac + notifications) |
| Mémoire / connaissances | Préférences et contexte persistants | Mémoire persistante + consignes par projet |
| Projets | Regroupement de tâches et fichiers | Projets (conversations, tâches, fichiers, consignes) |
| Multi-modèles | Plusieurs modèles sous le capot | Sélecteur : Gemini, Groq, OpenRouter, Mistral, Ollama, OpenAI, Anthropic, compatible OpenAI |
| Partage / reprise | Partage de résultats, relance | Export fichiers, relance de tâche, sauvegarde JSON |

## Différences assumées

- **Exécution dans le cloud** : la référence fournit une machine virtuelle par tâche (payant à opérer). Wakil, pour rester gratuit, exécute dans l’appareil (bac à sable) et sur **votre Mac** (moteur local). Résultat : même logique, puissance d’exécution liée au Mac.
- **Navigateur piloté (clics, formulaires)** : prévu en V2 sur Mac (Playwright local), pas dans la version web/mobile.
- **iPhone** : Apple interdit l’exécution de code téléchargé dans une app (règle 2.5.2) ; l’iPhone sert donc d’interface et d’agent « léger ».
