# 🌱 Chemin Vert

Site du mouvement humaniste **Chemin Vert** : une charte de valeurs universelles
que chacun peut **signer** (une simple adresse e-mail), un **compteur** public de
signataires, et une **boutique** vitrine.

Le site est **multilingue** (7 langues, dont l'arabe en RTL), avec détection
automatique de la langue du navigateur, un design vert « nature » et des
animations soignées (fonds animés, transparences, révélations au scroll).

> Site 100 % statique (HTML / CSS / JavaScript, sans étape de build).
> Les signatures sont stockées dans **Firebase / Firestore** (offre gratuite).

---

## 🗂️ Structure

```
.
├── index.html            Pré-page : choix de la langue (la « fleur »)
├── accueil.html          Accueil (hero, ruban des valeurs, bandeau compteur, cartes)
├── charte.html           La Charte (préambule, 15 valeurs, téléchargement PDF)
├── adherer.html          Adhérer (grand compteur + formulaire de signature)
├── boutique.html         Boutique (vitrine)
├── charte-print.html     Gabarit servant à générer les PDF de la charte
├── config.js             ⚙️  Votre config Firebase (déjà renseignée)
├── css/style.css         Styles, animations, RTL, responsive
├── js/
│   ├── i18n.js           Traductions des 7 langues + moteur i18n
│   ├── welcome.js        Logique de la pré-page « fleur » (choix de langue)
│   ├── layout.js         En-tête + pied de page partagés (injectés)
│   ├── signatures.js     Signatures + compteur (Firebase / mode démo)
│   └── app.js            Interactions communes à toutes les pages
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

## 🚀 Mise en ligne (GitHub Pages)

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

## 🛍️ Boutique

La section boutique est une **vitrine** (« Bientôt disponible ») prête à
recevoir un système de paiement (Stripe, print-on-demand…) dans un second temps.

---

## 🧪 Aperçu en local

```bash
# depuis la racine du projet
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

---

*Fait avec soin, en partenariat avec la Zawia.*
