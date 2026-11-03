#!/bin/bash
# Arrête le Bureau Virtuel et retire le démarrage automatique.
# Vos données et vos clés restent dans ~/BureauVirtuel (supprimez ce dossier vous-même si vous voulez tout effacer).
PLIST="$HOME/Library/LaunchAgents/ma.alwasset777.bureau.plist"
launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
rm -f "$PLIST" "$HOME/Desktop/Bureau Virtuel.webloc" "$HOME/Desktop/Réglages Bureau Virtuel.webloc"
echo "✅ Bureau Virtuel arrêté (données conservées dans ~/BureauVirtuel)."
