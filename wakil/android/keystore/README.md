# Clé de signature Android

`wakil-dev.keystore` (mot de passe `wakil-dev`) est une clé **publique de développement** :
elle permet d'installer les mises à jour de l'APK sans désinstaller l'app (même signature à chaque build).

⚠️ Comme elle est dans un dépôt public, n'importe qui peut signer un APK avec. N'installez donc
l'APK **que depuis les liens officiels** (page « Installer » de Wakil / GitHub Releases).

Pour Huawei AppGallery ou une diffusion publique, créez une clé privée et donnez-la à GitHub
sous forme de secrets (jamais dans le code) : `WAKIL_KEYSTORE_B64`, `WAKIL_KEYSTORE_PASSWORD`,
`WAKIL_KEY_ALIAS`, `WAKIL_KEY_PASSWORD`. Voir `docs/13-installation-huawei.md`.
