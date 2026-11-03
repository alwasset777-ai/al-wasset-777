# 13 – Installation sur Huawei

## 1. Vérifier la version du système
Paramètres → À propos du téléphone → **Version HarmonyOS / EMUI**.
- **EMUI ou HarmonyOS 2, 3, 4** → l’APK fonctionne (méthode A).
- **HarmonyOS NEXT / HarmonyOS 5+** (sans compatibilité Android) → méthode B.

## Méthode A — APK (fonctionne sans services Google)
1. Ouvrez Wakil → **Installer** → **Télécharger l’APK**, ou scannez le QR code, ou :
   https://github.com/alwasset777-ai/al-wasset-777/releases/download/wakil-latest/Wakil-android.apk
2. Ouvrez le fichier téléchargé (notification ou application **Fichiers → Téléchargements**).
3. Le téléphone demande d’autoriser l’installation depuis cette source : **Paramètres → Autoriser** (pour le navigateur ou Fichiers).
4. Si « Installation bloquée / analyse de sécurité » : choisissez **« Installer quand même »** (l’app n’est pas encore dans AppGallery).
5. Ouvrez **Wakil**, suivez l’accueil (clé Gemini gratuite).

Mises à jour : téléchargez le nouvel APK et installez-le par-dessus (les données sont conservées, même signature).

## Méthode B — application web (HarmonyOS NEXT ou sans APK)
1. Ouvrez le **navigateur Huawei** (ou un autre navigateur) à https://wakil-ia.vercel.app
2. Menu (⋮ ou ☰) → **Ajouter à l’écran d’accueil**.

## Préparer la publication sur Huawei AppGallery (gratuit)
1. Créez un compte développeur sur https://developer.huawei.com (vérification d’identité gratuite).
2. Créez une **clé de signature privée** (une seule fois, à garder précieusement) :
   `keytool -genkeypair -keystore wakil-release.keystore -alias wakil -keyalg RSA -keysize 2048 -validity 10000`
3. Sur GitHub → Settings → Secrets → Actions, ajoutez : `WAKIL_KEYSTORE_B64` (`base64 -i wakil-release.keystore`), `WAKIL_KEYSTORE_PASSWORD`, `WAKIL_KEY_ALIAS`, `WAKIL_KEY_PASSWORD`. Le prochain build signera avec cette clé.
4. AppGallery Connect → Mes applications → Nouvelle app (Android, Productivité) → nom « Wakil », package `ma.alwasset.wakil`.
5. Téléversez l’APK, captures (tests/screens), icône 512 px (`public/icons/icon-512.png`), description FR/AR, **politique de confidentialité** (voir 14), classification d’âge.
6. Soumettez à l’examen (quelques jours).

⚠️ Changer de clé de signature oblige à désinstaller l’ancienne version : décidez la clé privée avant la publication.
