# 🏢 Bureau Virtuel — Al Wasset 777

Votre entreprise virtuelle : **7 agents IA** dans un bureau en pixel art. Vous les voyez se réunir, retourner à leur bureau, taper au clavier et vous demander votre accord.
Tout est **gratuit**. Ça tourne sur **votre ordinateur**. Rien ne se publie, ne se dépense ou ne s'efface sans votre « ✅ Valider ».

| Agent | Ce qu'il fait vraiment | Ce qui attend votre validation |
|---|---|---|
| 1. Directeur | Réunit l'équipe, choisit qui travaille, fait le rapport (bureau + Telegram), garde la mémoire | — |
| 2. Créatif | Légendes FR/AR + **vidéo verticale** (Reels/TikTok) à partir des photos d'un bien (FFmpeg) | Rien (il ne publie pas) |
| 3. Community Manager | Lit les demandes du site, les commentaires Facebook/Instagram et Messenger, écrit les réponses dans la langue du client | Chaque réponse. Pour le site : un lien WhatsApp avec le message déjà écrit |
| 4. Media Buyer | Lit les résultats pub d'hier, propose campagnes et pauses | Chaque campagne, toujours créée **EN PAUSE**, avec un budget plafonné |
| 5. DB Manager | Compte les biens et les demandes, prépare ajouts et modifications | Chaque ajout ou modification |
| 6. Data Auditor | Sauvegarde chaque jour, trouve doublons, fiches incomplètes, téléphones faux | L'archivage des doublons (jamais d'effacement) |
| 7. R&D / QA | Contrôle la qualité des réponses, cherche chaque jour des outils sur GitHub | Les outils proposés. **Rien ne s'installe tout seul** |

---

## ⚡ Démarrage rapide (15 minutes)

### 1) Installer Python (une seule fois)
- **Windows** : https://www.python.org/downloads/ → cochez **« Add Python to PATH »** pendant l'installation.
- **Mac** : `brew install python` (ou le même site).

### 2) Récupérer le dossier
Téléchargez le dépôt (bouton vert « Code » → « Download ZIP » sur GitHub) et ouvrez le dossier `bureau-virtuel` dans un terminal.

### 3) Installer (une seule fois)
**Windows (PowerShell)** :
```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```
**Mac / Linux** :
```
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

### 4) Lancer
```
python server.py
```
Ouvrez **http://127.0.0.1:8000**, puis cliquez **« Lancer la routine du jour »**. Sans aucune clé, tout marche en **mode démo** (fausses données) : c'est parfait pour découvrir.

> Les jours suivants : ouvrez le terminal dans le dossier, activez `.venv` (étape 3, 2ᵉ ligne), puis `python server.py`.
> La routine automatique (08:00 par défaut) ne tourne que si le bureau est ouvert. Laissez la fenêtre ouverte.

### 5) Vérifier que tout va bien (facultatif)
```
python -m pytest -q tests
```
Vous devez voir **17 passed**.

---

## 🔌 Brancher les vrais outils (dans cet ordre, un par un)

Après chaque étape : enregistrez `.env`, arrêtez le bureau (Ctrl + C) puis relancez `python server.py`. En haut à droite du bureau, les pastilles passent au vert ● quand c'est branché.

### Étape A — Le cerveau : Gemini (gratuit)
1. https://aistudio.google.com/apikey → « Create API key » (la même clé que le site convient).
2. Dans `.env` : `GEMINI_API_KEY=votre_clé`.

Sans internet ou quand le quota est dépassé, il y a un secours gratuit : installez **Ollama** (https://ollama.com), faites `ollama pull qwen2.5:7b`, puis mettez `OLLAMA_URL=http://127.0.0.1:11434`.

### Étape B — Telegram : rapport + boutons ✅/❌ sur le téléphone (gratuit)
1. Dans Telegram, ouvrez **@BotFather** → `/newbot` → choisissez un nom → copiez le **jeton**.
2. Dans `.env` : `TELEGRAM_BOT_TOKEN=le_jeton` (laissez `TELEGRAM_CHAT_ID` vide pour l'instant).
3. Relancez le bureau, puis envoyez `/start` à votre bot. Il vous répond **« Votre TELEGRAM_CHAT_ID est : 123… »**.
4. Mettez ce numéro dans `TELEGRAM_CHAT_ID=` et relancez.

Ensuite, depuis votre téléphone :
- un message simple (ou `/ordre …`) donne un ordre à l'équipe ;
- `/routine` lance la routine ;
- `/attente` renvoie les actions à valider avec leurs boutons ;
- `/rapport` affiche le dernier rapport.

**Seul votre compte** peut valider ou donner des ordres : les autres sont ignorés.

### Étape C — La base du site (Firebase) : vrais biens et vraies demandes clients
1. https://console.firebase.google.com → votre projet → ⚙️ **Paramètres du projet** → onglet **Comptes de service** → **Générer une nouvelle clé privée**.
2. Renommez le fichier téléchargé `service-account.json` et mettez-le dans le dossier `bureau-virtuel`. Il ne partira jamais sur GitHub : il est exclu.
3. Dans `.env` : `FIREBASE_CREDENTIALS=service-account.json`.

⚠️ **Ce fichier donne un accès complet à la base. Ne l'envoyez à personne.**
Les agents lisent `registry` (biens et propriétaires) et `inbox` (demandes du site). Ils n'écrivent qu'après votre validation et n'effacent jamais rien : un doublon est seulement marqué « archivé ».

### Étape D — Meta : Facebook, Instagram, Messenger, publicité (gratuit, sauf le budget pub)
1. **Créer l'application** : https://developers.facebook.com/apps → « Créer une app » → cas d'usage **Autre** → type **Business** → donnez un nom (ex. « Bureau Al Wasset »).
2. **Créer un « utilisateur système »** (un jeton qui n'expire pas) : https://business.facebook.com/settings → **Utilisateurs → Utilisateurs système** → Ajouter (rôle Admin) → **Attribuer des éléments** : votre Page, votre compte Instagram, votre compte publicitaire et l'app.
3. **Générer un jeton** pour cet utilisateur système (choisissez votre app) en cochant :
   `pages_show_list, pages_read_engagement, pages_read_user_content, pages_manage_engagement, pages_messaging, instagram_basic, instagram_manage_comments, ads_management, ads_read, business_management`
4. **Trouver les identifiants** avec l'Explorateur : https://developers.facebook.com/tools/explorer (collez le jeton) :
   - `me/accounts` → `id` de la page = `META_PAGE_ID`, `access_token` = `META_PAGE_TOKEN`
   - `VOTRE_PAGE_ID?fields=instagram_business_account` → `id` = `META_IG_USER_ID`
   - le jeton de l'utilisateur système = `META_ADS_TOKEN`
   - le compte publicitaire : dans le Gestionnaire de publicités, l'adresse contient `act=123…` → `META_AD_ACCOUNT_ID=act_123…`
5. **Réglez votre plafond** : `BUDGET_MAX_JOUR=100` (dans la devise du compte pub). L'IA ne peut jamais le dépasser.

À savoir, honnêtement :
- L'app en mode « Développement » suffit pour tester sur **votre** Page.
- Pour répondre aux **vrais clients** sur Messenger et Instagram, Meta peut demander la **vérification de l'entreprise** et une **App Review**. C'est gratuit, mais ça prend quelques jours.
- Les réponses Messenger ne sont permises que dans les **24 h** qui suivent le message du client (règle de Meta).
- Les campagnes sont créées **en pause**, dans la catégorie spéciale « Logement » (rayon minimum 25 km, 18-65 ans). Vous ajoutez le visuel et vous activez vous-même dans le Gestionnaire de publicités.

### Étape E — Allumer les agents un par un
Dans `.env`, la ligne `AGENTS_ACTIFS` décide qui travaille. Conseil :
1. Semaine 1 : `community,db_manager,auditor,rnd` (réglage par défaut)
2. Semaine 2 : ajoutez `creatif` (installez d'abord FFmpeg : Windows `winget install Gyan.FFmpeg`, Mac `brew install ffmpeg`)
3. Quand Meta pub est branché et que vous faites confiance aux propositions : ajoutez `media_buyer`

Pour la vidéo : mettez les photos d'un bien dans `data/photos/`, ou ajoutez-les au registre du site, puis donnez l'ordre « Fais une vidéo de la villa route d'Agouraï ».

---

## 🎨 Personnaliser le bureau
- **Couleurs et coiffures** des agents : tableau `LOOK` en haut de `static/office.js`.
- **Place des bureaux** : tableau `DESKS` (x, y) dans le même fichier.
- **Ton des réponses** : modifiez `marque.md` (lu avant chaque réponse).
- **Vitesse de marche** : `RYTHME_ANIMATION` dans `.env`.
- **Vrais décors pixel art** (plus tard) : les packs de **Kenney.nl** sont gratuits et libres de droits, et l'éditeur de cartes **Tiled** (https://www.mapeditor.org) est gratuit. Le décor actuel est dessiné par le code, il ne demande aucune image.

## 🔐 Sécurité (déjà en place)
- Le bureau n'est visible que sur votre ordinateur (`HOST=127.0.0.1`). Ne mettez pas `0.0.0.0` sans protection.
- Une action ne s'exécute **qu'une fois**, même si vous cliquez sur l'écran et sur Telegram en même temps.
- Toutes les campagnes sont créées en pause, avec un budget plafonné ; aucune suppression de données ; aucun code GitHub installé automatiquement.
- Tout est noté dans `data/bureau.db` (journal), et les sauvegardes sont dans `data/sauvegardes/` (30 dernières).
- Ne publiez jamais `.env` ni `service-account.json` : ils sont déjà exclus de GitHub.

## 🧩 Comment c'est construit (pour un développeur)
- `server.py` : FastAPI, avec l'écran, la connexion en direct, les boutons, l'horaire de la routine et Telegram.
- `company.py` : le graphe LangGraph (Directeur → agents en parallèle → rapport), avec une mémoire sur disque (`data/memoire.db`).
- `agents.py` : les 6 agents spécialisés.
- `actions.py` : la file des validations et l'exécution une seule fois.
- `tools_meta.py`, `tools_firestore.py`, `tools_media.py`, `tools_telegram.py` : les outils.
- `scout.py` : la veille GitHub.
- `llm.py` : Gemini → Ollama → démo.
- `static/` : le bureau (Phaser 3, pixel art généré par le code).
- `tests/` : 17 tests qui tournent toujours en mode démo (aucun envoi réel).
