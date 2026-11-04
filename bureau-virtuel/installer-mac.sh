#!/bin/bash
# Installation / mise à jour du Bureau Virtuel sur Mac, en UNE commande :
#   curl -fsSL https://raw.githubusercontent.com/alwasset777-ai/al-wasset-777/main/bureau-virtuel/installer-mac.sh | bash
# Ce script : télécharge le bureau, installe tout (gratuit), le lance automatiquement à chaque
# démarrage du Mac, met un raccourci sur le Bureau et ouvre la page des réglages.
# Vos clés (.env), votre fichier Firebase et vos données (data/) ne sont jamais écrasés.
set -euo pipefail

DEST="$HOME/BureauVirtuel"
REPO_ZIP="https://github.com/alwasset777-ai/al-wasset-777/archive/refs/heads/main.zip"
LABEL="ma.alwasset777.bureau"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
URL="http://127.0.0.1:8000"

say() { printf "\n\033[1;32m▶ %s\033[0m\n" "$1"; }
fail() { printf "\n\033[1;31m✖ %s\033[0m\n" "$1"; exit 1; }

# 1) Python 3.10 ou plus récent
say "1/6 Vérification de Python…"
PY=""
for cand in python3.13 python3.12 python3.11 python3.10 \
            /Library/Frameworks/Python.framework/Versions/3.1{3,2,1,0}/bin/python3 \
            /opt/homebrew/bin/python3 /usr/local/bin/python3 python3; do
  if command -v "$cand" >/dev/null 2>&1 && "$cand" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
    PY="$(command -v "$cand")"; break
  fi
done
if [ -z "$PY" ]; then
  say "Python 3.12 n'est pas installé : je télécharge l'installateur officiel (gratuit)…"
  PKG="/tmp/python-3.12.8-macos11.pkg"
  if curl -fL -o "$PKG" "https://www.python.org/ftp/python/3.12.8/python-3.12.8-macos11.pkg"; then
    open "$PKG"
  else
    open "https://www.python.org/downloads/macos/"
    fail "Téléchargez « macOS 64-bit universal2 installer » sur la page qui vient de s'ouvrir, installez-le, puis recollez la même commande."
  fi
  fail "Une fenêtre d'installation de Python vient de s'ouvrir : cliquez Continuer → Installer (mot de passe du Mac). Ensuite, recollez la même commande dans le Terminal."
fi
echo "   Python trouvé : $("$PY" --version)"

# 2) Téléchargement de la dernière version
say "2/6 Téléchargement du Bureau Virtuel…"
TMP="$(mktemp -d)"
curl -fsSL -o "$TMP/repo.zip" "$REPO_ZIP" || fail "Téléchargement impossible. Vérifiez internet."
unzip -q "$TMP/repo.zip" -d "$TMP"
SRC="$(find "$TMP" -maxdepth 2 -type d -name bureau-virtuel | head -n 1)"
[ -n "$SRC" ] || fail "Dossier bureau-virtuel introuvable dans le téléchargement."
mkdir -p "$DEST"
KEEP="$TMP/garder"   # vos fichiers personnels sont mis de côté pendant la mise à jour
mkdir -p "$KEEP"
for f in .env data .venv service-account.json; do
  if [ -e "$DEST/$f" ]; then mv "$DEST/$f" "$KEEP/"; fi
done
find "$DEST" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -R "$SRC/." "$DEST/"
for f in .env data .venv service-account.json; do
  if [ -e "$KEEP/$f" ]; then rm -rf "${DEST:?}/$f"; mv "$KEEP/$f" "$DEST/"; fi
done
rm -rf "$TMP"
[ -f "$DEST/.env" ] || cp "$DEST/.env.example" "$DEST/.env"
chmod 600 "$DEST/.env"

# 3) Installation des modules (gratuits)
say "3/6 Installation des modules (2 à 5 minutes la première fois)…"
[ -x "$DEST/.venv/bin/python" ] || "$PY" -m venv "$DEST/.venv"
"$DEST/.venv/bin/python" -m pip install -q --upgrade pip
# --prefer-binary : toujours prendre une version déjà prête (jamais de compilation sur le Mac)
PIP_ARGS=(-q --prefer-binary -r "$DEST/requirements.txt")
if [ "$(uname -m)" = "x86_64" ]; then
  echo "   Mac Intel détecté : versions compatibles Intel."
  PIP_ARGS+=(-c "$DEST/constraints-mac-intel.txt")
fi
"$DEST/.venv/bin/python" -m pip install "${PIP_ARGS[@]}" || \
  fail "L'installation des modules a échoué. Envoyez une photo de cet écran à Claude."

# 4) Démarrage automatique (le bureau tourne en arrière-plan, même après redémarrage du Mac)
say "4/6 Démarrage automatique…"
mkdir -p "$HOME/Library/LaunchAgents" "$DEST/data"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array>
    <string>$DEST/.venv/bin/python</string><string>$DEST/server.py</string>
  </array>
  <key>WorkingDirectory</key><string>$DEST</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>$DEST/data/bureau.log</string>
  <key>StandardErrorPath</key><string>$DEST/data/bureau.log</string>
</dict></plist>
EOF
launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

# 5) Raccourcis sur le Bureau du Mac
say "5/6 Raccourcis sur le Bureau…"
for pair in "Bureau Virtuel|$URL/" "Réglages Bureau Virtuel|$URL/reglages"; do
  name="${pair%%|*}"; link="${pair#*|}"
  cat > "$HOME/Desktop/$name.webloc" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>URL</key><string>$link</string></dict></plist>
EOF
done

# 6) Ouverture
say "6/6 Démarrage du bureau…"
for _ in $(seq 1 40); do
  curl -fs "$URL/api/statut" >/dev/null 2>&1 && break
  sleep 1
done
if curl -fs "$URL/api/statut" >/dev/null 2>&1; then
  open "$URL/reglages"
  printf "\n\033[1;32m✅ C'est prêt ! La page des réglages vient de s'ouvrir.\033[0m\n"
  printf "   Raccourcis sur votre Bureau : « Bureau Virtuel » et « Réglages Bureau Virtuel ».\n"
  printf "   Pour mettre à jour plus tard : recollez la même commande.\n\n"
else
  fail "Le bureau n'a pas démarré. Regardez le journal : $DEST/data/bureau.log"
fi
