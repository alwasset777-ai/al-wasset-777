# 07 – Design system Wakil

## Identité
- **Nom** : Wakil — « l’agent, celui à qui l’on confie ».
- **Logo** : étoile à huit branches (motif géométrique d’inspiration marocaine) safran sur encre de nuit, cœur menthe = l’agent au travail.
- **Ton** : clair, rassurant, direct ; vouvoiement ; jamais de jargon.

## Couleurs (jetons CSS, `src/styles/app.css`)
| Jeton | Clair | Sombre | Usage |
|---|---|---|---|
| `bg` | #F7F5F0 | #0D121C | Fond |
| `surface` / `surface-2` / `surface-3` | #FFF / #F0EDE6 / #E8E4DA | #141A27 / #1B2232 / #242C3F | Cartes, survols, actifs |
| `line` | #E3DED3 | #283048 | Bordures |
| `ink` / `muted` | #171A21 / #646976 | #ECEBE6 / #9AA1B0 | Texte |
| `accent` (safran) | #B97C14 | #E8AE4A | Action principale, mode agent |
| `mint` | #23857A | #55C7B9 | Liens, succès, « gratuit » |
| `danger` | #C2453D | #EF7A72 | Erreurs, arrêt |

## Typographie
Police système (SF Pro sur Apple, Roboto sur Android, Noto Sans Arabic pour l’arabe) — aucune police à télécharger, rendu natif. Titres 20–30 px semi-gras, texte 15 px, interligne 1.65 pour la lecture.

## Composants (`src/ui/primitives.tsx`, `widgets.tsx`)
Button (primary/secondary/ghost/danger), IconButton, Input, Textarea, Select, Field, Badge, Toggle, Modal (feuille en bas sur mobile), Empty, PageHeader, Spinner, Toast, Logo, ModelPicker, ModeToggle, Composer, TaskCard, StatusBadge, FilePreview.

## Règles
- Rayon 14 px (cartes), 12 px (boutons) ; ombre douce unique.
- Mobile : navigation basse 4 onglets + menu ; marges 16 px ; aucune barre de défilement horizontale (vérifié par test).
- Bureau : barre latérale 248 px ; listes à deux colonnes pour les conversations.
- Mouvement réduit respecté ; zones tactiles ≥ 36 px ; focus visible au clavier.
- Texte arabe détecté → affichage de droite à gauche.
