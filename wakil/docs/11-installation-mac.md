# 11 – Installation sur Mac (Apple Silicon et Intel)

## Option A — Application Mac complète (recommandée)
1. Ouvrez Wakil → **Installer**, ou directement :
   - Mac M1/M2/M3/M4 : `Wakil-mac-apple-silicon.dmg`
   - Mac Intel : `Wakil-mac-intel.dmg`
   (page https://github.com/alwasset777-ai/al-wasset-777/releases/tag/wakil-latest)
   Pour savoir quel Mac vous avez : menu  → À propos de ce Mac → « Puce Apple » ou « Processeur Intel ».
2. Ouvrez le `.dmg`, glissez **Wakil** dans **Applications**.
3. Premier lancement : l’app n’est pas signée par Apple (signature payante). macOS affiche un avertissement.
   - Ouvrez **Réglages Système → Confidentialité et sécurité**, descendez, cliquez **« Ouvrir quand même »**, confirmez.
   - Ou dans le Terminal : `xattr -dr com.apple.quarantine /Applications/Wakil.app`
4. Wakil crée le dossier **~/Wakil** : c’est là que l’agent travaille sur votre Mac (export de fichiers, commandes).

Avantages : outils « Terminal du Mac » et « Exporter vers le Mac » (chaque commande vous est demandée).

## Option B — Application web installée (30 secondes)
- **Safari** (macOS Sonoma ou plus récent) : ouvrez https://wakil-ia.vercel.app → menu **Fichier → Ajouter au Dock**.
- **Chrome / Edge** : icône « Installer » dans la barre d’adresse.

## IA locale gratuite (optionnel)
1. Installez Ollama : https://ollama.com/download
2. Terminal : `ollama pull llama3.2`
3. Wakil → Réglages → Modèles IA → **Ollama** → Enregistrer et tester.
   (L’app Mac est autorisée par défaut. Pour la version web : `launchctl setenv OLLAMA_ORIGINS "https://wakil-ia.vercel.app"` puis relancer Ollama.)

## Mettre à jour
Retéléchargez le dernier `.dmg` et remplacez l’app. Vos données sont conservées.
