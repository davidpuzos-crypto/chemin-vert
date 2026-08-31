# 🌱 Chemin Vert

Site du mouvement humaniste **Chemin Vert** : une charte de valeurs universelles
que chacun peut **signer** (une simple adresse e-mail), un **compteur** public de
signataires, et une **boutique** vitrine.

Le site est **multilingue** (7 langues, dont l'arabe en RTL), avec détection
automatique de la langue du navigateur, un design vert « nature » et des
animations soignées (fonds animés, transparences, révélations au scroll).

> Site 100 % statique (HTML / CSS / JavaScript, sans étape de build).
> Les signatures sont stockées dans **Firebase / Firestore** (offre gratuite).
> La boutique est alimentée par **Printful** et encaissée par **Stripe**, via
> des fonctions serverless **Netlify** → voir [`BOUTIQUE-SETUP.md`](BOUTIQUE-SETUP.md).

---

## 🗂️ Structure

```
.
├── index.html            Pré-page : choix de la langue (la « fleur »)
├── accueil.html          Accueil (hero, ruban des valeurs, bandeau compteur, cartes)
├── charte.html           La Charte (préambule, 15 valeurs, téléchargement PDF)
├── adherer.html          Adhérer (grand compteur + formulaire de signature)
├── boutique.html         Boutique (catalogue Printful chargé automatiquement)
├── merci.html            Page de retour après un paiement Stripe réussi
├── charte-print.html     Gabarit servant à générer les PDF de la charte
├── config.js             ⚙️  Votre config Firebase (déjà renseignée)
├── css/style.css         Styles, animations, RTL, responsive
├── js/
│   ├── i18n.js           Traductions des 7 langues + moteur i18n
│   ├── welcome.js        Logique de la pré-page « fleur » (choix de langue)
│   ├── layout.js         En-tête + pied de page partagés (injectés)
│   ├── signatures.js     Signatures + compteur (Firebase / mode démo)
│   ├── shop.js           Boutique : catalogue, panier, redirection Stripe
│   └── app.js            Interactions communes à toutes les pages
├── netlify/
│   ├── lib/printful.mjs        🔒 Accès API Printful (serveur uniquement)
│   └── functions/
│       ├── get-products.mjs    GET  /api/get-products
│       ├── create-checkout.mjs POST /api/create-checkout
│       └── stripe-webhook.mjs  POST /api/stripe-webhook
├── netlify.toml          Configuration Netlify (redirections /api/*)
├── .env.example          Modèle des variables d'environnement (sans secret)
├── BOUTIQUE-SETUP.md     📖 Guide pas à pas Printful + Stripe + Netlify
├── assets/
│   ├── logo.png          ⚠️  Pas encore ajouté — voir section « Logo »
│   └── charte/           PDF de la charte, un par langue (A4)
├── firebase/firestore.rules  Règles de sécurité Firestore
└── .github/workflows/    Déploiement automatique GitHub Pages
```

> **Régénérer les PDF de la charte** (après modification du texte dans `i18n.js`) :
> servir le dossier en local puis imprimer `charte-print.html?lang=xx` en PDF
> pour chaque langue vers `assets/charte/charte-xx.pdf`.

---

## 🚀 Mise en ligne

**Pour un site avec boutique : utilisez Netlify.** GitHub Pages ne sait pas
exécuter de code serveur, donc les fonctions `/api/*` (Printful, Stripe) n'y
fonctionnent pas — la boutique y reste en mode vitrine
(« la boutique ouvre bientôt »), le reste du site est parfaitement normal.

Marche à suivre complète : [`BOUTIQUE-SETUP.md`](BOUTIQUE-SETUP.md) (étape 4).
En résumé : Netlify → *Import from GitHub* → aucune commande de build →
*Publish directory* `.`.

### Variante sans boutique (GitHub Pages)

1. Sur GitHub : **Settings → Pages**.
2. Section *Build and deployment*, choisir **Source : GitHub Actions**.
3. Fusionner cette branche dans `main` (ou pousser sur `main`).
   Le workflow `.github/workflows/deploy.yml` publie le site automatiquement.
4. L'URL apparaît dans **Settings → Pages** (ex. `https://<compte>.github.io/chemin-vert/`).

> Nom de domaine personnalisé (ex. `chemin-vert.org`) : ajoutez-le dans
> **Settings → Pages → Custom domain**.

Le site fonctionne **immédiatement en mode démo** (le formulaire et le compteur
tournent en local) tant que Firebase n'est pas joignable.

---

## 🔗 Activer les signatures réelles (Firebase / Firestore — gratuit)

1. Créez un projet sur **https://console.firebase.google.com**.
2. **Build → Firestore Database → Créer** (mode *Production*, région proche).
3. **Firestore → onglet Règles** : collez le contenu de
   [`firebase/firestore.rules`](firebase/firestore.rules) puis **Publier**.
4. Créez le document du compteur : collection `stats`, document `counter`,
   champ `count` de type **int64** = `0`.
5. **Paramètres du projet → Vos applications → Web `</>`** : copiez l'objet
   `firebaseConfig` et collez-le dans [`config.js`](config.js).
6. Poussez : le compteur devient réel. ✅

### 🔒 Confidentialité (important)

- Les clés Firebase sont **conçues** pour être publiques ; la sécurité vient
  des **règles Firestore** ([`firebase/firestore.rules`](firebase/firestore.rules)).
- Les visiteurs peuvent **signer** (créer `signatures/{email}`) mais **personne
  ne peut lire ni lister les e-mails** : le compteur passe par un document
  public dédié `stats/counter` (uniquement +1 / -1).
- Pour consulter/exporter les e-mails, utilisez la **console Firebase**
  (Firestore Database), accessible à vous seul.

---

## 🌍 Langues

Français · English · Español · Italiano · Deutsch · Türkçe · العربية (RTL).

Textes et traductions centralisés dans [`js/i18n.js`](js/i18n.js)
(objet `I18N`). Pour ajuster un texte, modifiez la valeur correspondante.

---

## 🖼️ Logo

En attendant votre logo définitif, le site affiche une forme organique
abstraite en dégradé vert (animée en CSS pur, aucune image requise).

Pour l'installer, déposez simplement votre fichier ici :

```
assets/logo.png
```

Il apparaîtra automatiquement dans l'en-tête et le pied de page — aucune
modification de code n'est nécessaire. (Format carré, fond transparent
recommandé.)

---

## 🛍️ Boutique (Printful + Stripe)

Le catalogue est **chargé automatiquement** depuis Printful : un produit
synchronisé dans Printful apparaît sur le site dans les 10 minutes, sans
toucher au code. Le paiement passe par **Stripe Checkout**, et la commande
n'est transmise à Printful qu'une fois le paiement réellement encaissé
(webhook signé).

🔒 **La clé API Printful ne se trouve dans aucun fichier de ce dépôt.** Elle
est lue par le serveur via `process.env.PRINTFUL_API_KEY`, définie dans
*Netlify → Site configuration → Environment variables*. Ne la collez jamais
dans un fichier HTML/JS, ni dans un commit.

👉 Configuration détaillée (jeton Printful, clés Stripe, webhook, variables
d'environnement, commande de test) : **[`BOUTIQUE-SETUP.md`](BOUTIQUE-SETUP.md)**.

---

## 🧪 Aperçu en local

```bash
# depuis la racine du projet
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Pour tester **aussi les fonctions de la boutique** (nécessite un fichier `.env`
local, jamais commité — cf. `.env.example`) :

```bash
npm install -g netlify-cli
netlify dev        # sert le site ET les fonctions /api/*
```

---

*Fait avec soin, en partenariat avec la Zawia.*
