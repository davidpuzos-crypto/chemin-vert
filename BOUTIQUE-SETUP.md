# Boutique Chemin Vert — guide de configuration

Ce guide explique, étape par étape, comment mettre la boutique en ligne.
Aucune ligne de code à écrire : tout se fait dans trois interfaces web
(**Printful**, **Stripe**, **Netlify**).

Comptez **45 minutes** la première fois.

---

## 0. À lire en premier : la sécurité de la clé Printful

> ⚠️ **La clé Printful qui a circulé par message est compromise.**
> Elle a été visible en clair dans une conversation : il faut la **révoquer**
> et en générer une nouvelle (étape 1). Elle n'a été écrite dans **aucun
> fichier** de ce dépôt.

Règle générale, valable pour toujours :

| ❌ Jamais | ✅ Toujours |
|---|---|
| La clé dans un fichier `.html`, `.js` ou `config.js` | La clé dans les *Environment variables* de Netlify |
| La clé dans un message, une capture d'écran, un ticket | La clé lue par le serveur via `process.env.PRINTFUL_API_KEY` |
| La clé dans un commit Git (même supprimé ensuite) | Une clé **révoquée immédiatement** si elle a fuité |

Tout ce qui part sur GitHub est public et permanent. Les fonctions
serverless (dossier `netlify/functions/`) sont le **seul** endroit qui voit
la clé : leur code s'exécute sur les serveurs de Netlify, jamais dans le
navigateur du visiteur.

---

## 1. Structure des fichiers

```
chemin-vert/
│
├── netlify.toml                 ← configuration Netlify (redirections /api/*)
├── package.json                 ← dépendances des fonctions (stripe, blobs)
├── .env.example                 ← MODÈLE des variables (aucun secret réel)
├── .gitignore                   ← empêche de commiter .env par accident
│
├── netlify/
│   ├── lib/
│   │   └── printful.mjs         ← 🔒 accès API Printful (SERVEUR uniquement)
│   └── functions/
│       ├── get-products.mjs     ← GET  /api/get-products   → catalogue
│       ├── create-checkout.mjs  ← POST /api/create-checkout → session Stripe
│       └── stripe-webhook.mjs   ← POST /api/stripe-webhook  → commande Printful
│
├── boutique.html                ← page boutique (grille vide au chargement)
├── merci.html                   ← page de retour après paiement réussi
├── js/
│   └── shop.js                  ← charge le catalogue, panier, redirection Stripe
└── css/style.css                ← styles des fiches produit
```

**Le navigateur ne connaît que deux URL** : `/api/get-products` et
`/api/create-checkout`. Il ne voit jamais `api.printful.com`, ni aucune clé.

### Le trajet d'une commande

```
Visiteur                 Netlify (serveur)              Printful / Stripe
   │
   │ ouvre boutique.html
   ├──── GET /api/get-products ───────►  get-products.mjs
   │                                     │ clé Printful (env)
   │                                     ├──► GET api.printful.com/store/products
   │◄──── liste des produits (JSON) ─────┤     (mise en cache 10 min)
   │
   │ clique « Commander »
   ├──── POST /api/create-checkout ───►  create-checkout.mjs
   │                                     │ recalcule les prix chez Printful
   │                                     ├──► crée une session Stripe Checkout
   │◄──── url de paiement ───────────────┤
   │
   ├──── paie sur checkout.stripe.com ──────────────►  Stripe
   │                                                     │
   │                                     stripe-webhook.mjs ◄── « paiement validé »
   │                                     │ vérifie la signature
   │                                     ├──► POST api.printful.com/orders
   │◄──── redirigé vers /merci.html
```

Point clé : **la commande Printful n'est créée que par le webhook Stripe**,
c'est-à-dire uniquement après un paiement réellement encaissé. Un visiteur
ne peut pas déclencher une impression sans payer.

---

## 2. Créer un jeton privé Printful

1. Allez sur **https://developers.printful.com/tokens**
2. **Révoquez** (poubelle) l'ancien jeton s'il existe.
3. **Add token** :
   - **Name** : `chemin-vert-netlify`
   - **Access level** : **Store** → sélectionnez votre boutique *Chemin Vert*
   - **Scopes** :
     - `Orders` → **Read & Write** (créer les commandes)
     - `Sync products` → **Read** (lire le catalogue)
     - laissez le reste décoché
   - **Expiration** : la plus longue proposée
4. Copiez le jeton (il commence par `smk_`).
   **Il n'est affiché qu'une seule fois.** Rangez-le dans un gestionnaire de
   mots de passe, pas dans un mail.

> ℹ️ Les jetons Printful **expirent**. Notez la date dans votre agenda : le
> jour où la boutique affichera « la boutique ouvre bientôt » sans raison,
> c'est probablement le jeton. Il suffira d'en créer un nouveau et de mettre
> à jour la variable dans Netlify.

Vos produits doivent être **synchronisés** dans Printful (onglet *Stores* →
votre boutique) avec un **prix de vente** renseigné : c'est ce prix que le
site affiche et facture.

---

## 3. Créer le compte Stripe et récupérer les clés

1. Créez un compte sur **https://dashboard.stripe.com**
2. Renseignez les informations de l'association (nécessaire pour encaisser
   réellement ; en attendant, le **mode test** fonctionne tout de suite).
3. Restez en **mode test** pour commencer : l'interrupteur *Test mode* en
   haut à droite du tableau de bord.
4. **Developers → API keys** → copiez la **Secret key** :
   - mode test : `sk_test_...`
   - production : `sk_live_...`

> Ne copiez pas la « Publishable key » : ce site n'en a pas besoin, tout se
> passe côté serveur.

---

## 4. Déployer sur Netlify

GitHub Pages ne sait pas exécuter de code serveur : il faut Netlify (offre
gratuite suffisante).

1. **https://app.netlify.com** → *Sign up* avec votre compte GitHub.
2. **Add new site → Import an existing project → GitHub**.
3. Choisissez le dépôt `chemin-vert`, branche `main`.
4. Réglages de build — laissez tout **vide** :
   - *Build command* : (vide)
   - *Publish directory* : `.`
   - *Functions directory* : `netlify/functions` (déjà dans `netlify.toml`)
5. **Deploy**. Netlify vous donne une adresse type
   `https://chemin-vert-xyz.netlify.app`.
6. *Site configuration → Site details → Change site name* pour la simplifier.

> ✅ **Déjà fait** : le site existe et s'appelle **`cheminvert1.netlify.app`**.
> C'est cette adresse qui est reprise partout dans la suite du guide.

Plus tard, pour votre vrai nom de domaine : *Domain management → Add a
domain*. Le HTTPS est automatique et gratuit.

---

## 5. Où configurer les variables d'environnement ⭐

**C'est l'étape la plus importante.**

Dans Netlify :

> **Site configuration** → **Environment variables** → **Add a variable** →
> *Add a single variable* → laissez « **Same value for all deploy contexts** »

Ajoutez ces variables, une par une :

| Clé | Valeur | Obligatoire |
|---|---|---|
| `PRINTFUL_API_KEY` | le jeton `smk_...` de l'étape 2 | **oui** |
| `STRIPE_SECRET_KEY` | `sk_test_...` puis `sk_live_...` | **oui** |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (étape 6, à faire après) | **oui** |
| `SITE_URL` | `https://cheminvert1.netlify.app` (sans `/` final) | **oui** |
| `PRINTFUL_AUTO_CONFIRM` | `false` | recommandé |
| `SHIPPING_FLAT_CENTS` | `450` (= 4,50 € de port) | optionnel |
| `ALLOWED_COUNTRIES` | `FR` (ou `FR,BE,CH,LU`) | optionnel |

⚠️ **Après avoir ajouté ou modifié une variable, il faut redéployer** :
*Deploys → Trigger deploy → **Clear cache and deploy site***.
Les fonctions ne relisent pas les variables toutes seules.

Dans le formulaire Netlify : cochez **« Contains secret values »** pour les
trois clés (Printful, Stripe, webhook), laissez **All scopes**, et gardez
**« Same value for all deploy contexts »**. La case « secret » ne change rien
au fonctionnement : elle empêche seulement de relire la valeur ensuite dans
l'interface.

Ces valeurs restent chez Netlify. Elles ne sont **jamais** envoyées au
navigateur, jamais écrites dans le dépôt Git. Le fichier `.env.example`
présent dans le dépôt ne sert que de mémo : il ne contient aucune vraie clé.

Pour tester en local (facultatif) : `npm i -g netlify-cli`, créez un fichier
`.env` à la racine sur le modèle de `.env.example`, puis `netlify dev`.
Le `.gitignore` empêche `.env` de partir sur GitHub.

---

## 6. Brancher le webhook Stripe

C'est le mécanisme qui prévient votre site qu'un paiement a été encaissé.
**Sans lui, aucune commande n'est transmise à Printful.**

1. Stripe → **Developers → Webhooks → Add endpoint**
2. **Endpoint URL** :
   ```
   https://cheminvert1.netlify.app/api/stripe-webhook
   ```
   (remplacez par votre adresse réelle)
3. **Select events** → cochez exactement :
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
4. **Add endpoint**.
5. Sur la page de l'endpoint : **Signing secret → Reveal**. Copiez le
   `whsec_...` et mettez-le dans la variable `STRIPE_WEBHOOK_SECRET`
   (étape 5), puis **redéployez**.

> Le secret de signature est **différent en test et en production**. Quand
> vous passerez en live, il faudra recréer l'endpoint en mode live et
> remplacer la variable.

Ce secret sert à vérifier que la notification vient bien de Stripe :
n'importe qui peut appeler l'URL, seule une requête réellement signée par
Stripe est acceptée. C'est ce qui empêche de commander gratuitement.

---

## 7. Comment fonctionne le bouton d'achat (Stripe Checkout)

Il n'y a **pas** de bouton Stripe à copier-coller depuis leur site : la
session de paiement est créée par notre fonction, ce qui est plus sûr.

Dans `boutique.html`, le bouton est simplement :

```html
<button class="btn btn--primary btn--lg" id="cartCheckout">Commander</button>
```

`js/shop.js` envoie le contenu du panier à notre fonction, puis redirige :

```js
const res  = await fetch("/api/create-checkout", {
  method : "POST",
  headers: { "Content-Type": "application/json" },
  body   : JSON.stringify({ items: [{ variantId: "4903", quantity: 2 }] })
});
const data = await res.json();
window.location.href = data.url;   // → checkout.stripe.com
```

Le navigateur envoie **uniquement des identifiants et des quantités**.
Il n'envoie **aucun prix**. Côté serveur, `create-checkout.mjs` :

1. rappelle Printful pour obtenir le vrai prix de chaque variante,
2. refuse la commande si une variante n'existe plus (`variant_unavailable`),
3. limite à 20 exemplaires par ligne et 10 lignes,
4. ajoute les frais de port et les pays de livraison autorisés,
5. crée la session Stripe avec **les prix recalculés**.

C'est la protection essentielle : même en modifiant la page dans son
navigateur, un visiteur ne peut pas s'offrir un sticker à 0,01 €.

Après paiement, Stripe renvoie le client sur `merci.html` (`SITE_URL` +
`/merci.html`) et prévient `stripe-webhook.mjs`, qui crée la commande
Printful.

---

## 8. Le catalogue se met à jour tout seul

Il n'y a **rien à modifier dans le code** pour ajouter ou changer un produit :

1. Vous créez / modifiez / synchronisez le produit dans Printful ;
2. vous vérifiez qu'il a bien un prix de vente ;
3. le site se met à jour **en 10 minutes maximum** (durée du cache serveur),
   puis jusqu'à 1 minute de plus pour un visiteur qui a la page déjà ouverte.

Se met à jour automatiquement :

| Ce que vous changez dans Printful | Effet sur le site |
|---|---|
| Nouveau produit synchronisé | il apparaît dans la grille |
| Prix de vente modifié | nouveau prix affiché **et facturé** |
| Nouvelle taille / variante | elle apparaît dans le sélecteur |
| Visuel du produit changé | nouvelle image |
| Produit supprimé ou *ignored* | il disparaît de la boutique |
| Variante en rupture (statut ≠ *active*) | elle disparaît du sélecteur |

Le prix est relu chez Printful **au moment du paiement** aussi : il est donc
impossible qu'un client paie un ancien prix resté affiché dans son navigateur.
Si un article disparaît du catalogue, il est retiré silencieusement des paniers
en cours.

**Ne se met pas à jour automatiquement** : le **nom** du produit s'affiche tel
qu'il est écrit dans Printful, dans cette langue-là, pour tous les visiteurs —
il n'est pas traduit dans les 7 langues du site (seuls les textes du site le
sont). Écrivez donc des noms courts et compréhensibles, ou dites-moi si vous
voulez une table de traduction des noms de produits.

**Forcer un rafraîchissement immédiat** : *Deploys → Trigger deploy* dans
Netlify. Le cache est marqué avec l'identifiant du déploiement, donc chaque
déploiement repart d'un catalogue neuf.

Le cache existe pour deux raisons : ne pas saturer le quota Printful
(120 requêtes/minute) et pouvoir continuer à afficher la dernière version
connue si Printful est momentanément injoignable. Dans ce cas la boutique reste
en ligne et vendable, simplement figée jusqu'au retour de Printful.

Si le catalogue est vide ou injoignable et qu'aucune version connue n'existe,
la page affiche le bandeau « La boutique ouvre bientôt » au lieu d'une page
cassée.

---

## 9. Recette : votre première commande de test

Avec les clés **de test** (`sk_test_`, webhook en mode test) :

1. Ouvrez `https://cheminvert1.netlify.app/boutique.html` — les produits
   Printful doivent s'afficher avec leurs vraies photos et leurs vrais prix.
2. Ajoutez un article, cliquez **Commander**.
3. Sur Stripe, payez avec la carte de test :
   - numéro **`4242 4242 4242 4242`**
   - date : n'importe quelle date future — CVC : n'importe quels 3 chiffres
   - adresse : une vraie adresse française
4. Vous devez arriver sur la page **Merci**, panier vidé.
5. Vérifiez dans **Stripe → Payments** : paiement `Succeeded`.
6. Vérifiez dans **Stripe → Webhooks → votre endpoint** : la ligne doit être
   en `200 OK` (si elle est en rouge, le `whsec_` est faux ou le redéploiement
   n'a pas été fait).
7. Vérifiez dans **Printful → Orders** : une commande en **Draft** vous
   attend. Ouvrez-la, vérifiez l'adresse, puis **Confirm** pour lancer la
   production.

Quand tout est vert, passez en production :
- Stripe : quitter *Test mode*, recréer le webhook en live,
- Netlify : remplacer `STRIPE_SECRET_KEY` par `sk_live_...` et
  `STRIPE_WEBHOOK_SECRET` par le nouveau `whsec_...`,
- **redéployer**.

### Brouillon ou confirmation automatique ?

- `PRINTFUL_AUTO_CONFIRM=false` (**recommandé au début**) : la commande
  arrive en brouillon dans Printful. Rien n'est imprimé, rien n'est débité
  tant que vous n'avez pas cliqué *Confirm*. Vous gardez le contrôle.
- `PRINTFUL_AUTO_CONFIRM=true` : Printful lance la production et débite
  votre moyen de paiement Printful automatiquement. Ne passez à `true`
  qu'une fois plusieurs commandes réelles validées à la main.

Dans les deux cas, pensez à enregistrer un moyen de paiement dans
**Printful → Billing**, sinon les commandes resteront bloquées.

---

## 10. En cas de problème

| Symptôme | Cause la plus probable |
|---|---|
| « La boutique ouvre bientôt » alors qu'il y a des produits | `PRINTFUL_API_KEY` absente, expirée, ou pas redéployée |
| Erreur au clic sur *Commander* | `STRIPE_SECRET_KEY` absente ou invalide |
| Paiement OK mais rien dans Printful | webhook non créé, mauvais `whsec_`, ou pas de redéploiement |
| Webhook en rouge dans Stripe | `STRIPE_WEBHOOK_SECRET` ne correspond pas au mode (test/live) |
| Commande Printful « on hold » | moyen de paiement manquant dans *Printful → Billing* |
| Produit absent de la boutique | non synchronisé, ignoré, ou sans prix de vente dans Printful |

Les journaux d'exécution sont dans **Netlify → Logs → Functions** :
choisissez la fonction concernée, l'erreur y est datée et lisible. Les
messages techniques n'apparaissent jamais côté visiteur.
