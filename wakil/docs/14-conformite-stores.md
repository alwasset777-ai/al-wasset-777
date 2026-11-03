# 14 – Checklist de conformité App Store et Huawei AppGallery

## Commun
- [x] Nom et marque originaux (« Wakil »), aucun élément d’une autre application
- [x] Pas de contenu illégal : consigne système de refus des actions illégales ou dangereuses
- [x] Données stockées localement ; aucune collecte, aucune publicité, aucun traceur
- [x] Clés API saisies par l’utilisateur, jamais envoyées à nos serveurs
- [x] Suppression de toutes les données dans l’app (Réglages → Données)
- [x] Permissions minimales : Internet ; micro uniquement pour la dictée (texte d’explication fourni)
- [ ] Politique de confidentialité publiée (modèle ci-dessous à mettre en ligne)
- [ ] Captures d’écran par taille d’appareil, descriptions FR/AR
- [ ] Mention « contenu généré par IA, à vérifier » dans la description
- [ ] Signalement de contenu problématique (lien de contact) — à ajouter avant publication

## Apple App Store (si un jour publié — compte payant requis)
- [x] **4.1 Copycats** : nom/identité originaux
- [x] **2.5.2** : aucun code téléchargé exécuté pour changer les fonctions de l’app ; le bac à sable JS exécute du code produit pour une tâche de l’utilisateur, sans réseau ni accès système → à décrire dans les notes d’examen ; option : désactiver `run_javascript` sur iOS
- [x] **4.2 Fonctionnalité minimale** : vraie valeur native (fichiers, partage, hors-ligne)
- [x] **5.1.1 Confidentialité** : « Nutrition label » = aucune donnée collectée
- [x] **1.2 Contenu généré** : refus des demandes dangereuses ; ajouter un bouton « Signaler »
- [ ] **3.1** : aucun achat intégré (rien à vendre) — OK tant que l’app reste gratuite
- [ ] Compte de démonstration ou mode démo pour l’examinateur (clé fournie dans les notes)
- [ ] Classification 12+ (contenu généré non filtré par un tiers)

## Huawei AppGallery
- [x] Fonctionne sans HMS ni GMS (aucun SDK Google/Huawei)
- [x] `targetSdkVersion` 36, `minSdkVersion` 24
- [x] Package `ma.alwasset.wakil`, icône 512×512, nom localisé
- [ ] APK signé avec la **clé privée** (pas la clé de développement publique)
- [ ] Politique de confidentialité (URL) et déclaration des permissions
- [ ] Vérification d’identité développeur (gratuite)
- [ ] Classification d’âge et catégorie « Productivité »

## Modèle de politique de confidentialité (à publier)
> Wakil n’enregistre vos conversations, fichiers et réglages que sur votre appareil. Si vous activez la synchronisation, ces données (sans vos clés API) sont stockées dans **votre** projet Supabase. Les messages envoyés à l’IA sont transmis directement au fournisseur que vous avez choisi (Google, Groq, etc.) selon ses propres conditions. Les adresses web lues par l’agent passent par notre serveur Vercel uniquement pour en extraire le texte, sans conservation. Aucune publicité, aucun traceur. Contact : alwasset777@gmail.com.
