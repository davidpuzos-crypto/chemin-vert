/* ==========================================================================
   Chemin Vert — Signatures & compteur
   --------------------------------------------------------------------------
   LECTURE   : directement dans Firestore. Le compteur est public, c'est un
               entier dans un document, et les règles autorisent sa lecture.
   ÉCRITURE  : jamais depuis ce fichier. Les règles Firestore refusent toute
               écriture venant d'un navigateur. Signature et désinscription
               passent par /api/sign et /api/unsubscribe, deux fonctions
               serverless qui s'authentifient avec une clé de service.

   POURQUOI. La clé Firebase du site est publique par conception : tant que le
   navigateur écrivait en base, rien ne distinguait un visiteur d'un script,
   et n'importe qui pouvait gonfler le compteur, le vider, ou supprimer la
   signature d'autrui. App Check aurait répondu à ce problème, mais Google l'a
   rendu inaccessible sans activer la facturation. Déplacer les écritures
   côté serveur protège davantage : la base n'accepte plus personne depuis le
   web, quel que soit le navigateur.

   Le mode DÉMONSTRATION (signature simulée, compteur en mémoire locale) prend
   le relais si Firebase n'est pas joignable ou si la clé de service manque
   côté serveur.
   ========================================================================== */

const Signatures = (() => {
  const cfg = window.CHEMIN_VERT_CONFIG || {};
  const fb = cfg.firebase || {};
  const ready = !!(fb.projectId && window.firebase && firebase.firestore);
  let db = null;

  if (ready) {
    try { firebase.initializeApp(fb); } catch (e) { /* déjà initialisé */ }
    db = firebase.firestore();
  }
  let configured = !!db;

  const DEMO_KEY = "cv_demo_signatures";

  /* Cette règle doit rester IDENTIQUE à celle de netlify/lib/guard.mjs : ici
     pour afficher un message utile sans aller-retour réseau, là-bas pour
     refuser pour de bon. Si vous modifiez l'une, modifiez l'autre. */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const norm = (email) => String(email ?? "").trim().toLowerCase();
  const emailValid = (email) => {
    const e = norm(email);
    return e.length >= 6 && e.length <= 254 && EMAIL_RE.test(e) && !e.includes("/");
  };

  const counterRef = () => db.collection("stats").doc("counter");

  const demoLire = () => JSON.parse(localStorage.getItem(DEMO_KEY) || "[]");
  const demoEcrire = (l) => localStorage.setItem(DEMO_KEY, JSON.stringify(l));

  /* --- Lecture du compteur --- */
  async function getCount() {
    if (db) {
      const snap = await counterRef().get();
      return snap.exists ? Number(snap.data().count) || 0 : (cfg.FALLBACK_COUNT || 0);
    }
    return (cfg.FALLBACK_COUNT || 0) + demoLire().length;
  }

  /* Appel d'une fonction serverless. Renvoie null si le serveur annonce que
     la clé de service manque : l'appelant bascule alors en démonstration. */
  async function appeler(chemin, email) {
    const lang = (typeof I18nEngine !== "undefined" && I18nEngine.current) || null;
    const res = await fetch(chemin, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, lang })
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 503 && data.error === "not_configured") {
      configured = false;
      return null;
    }
    if (res.status === 429) {
      // Message générique côté interface : c'est un garde-fou anti-script,
      // un signataire légitime ne le rencontre pas.
      throw new Error("trop de tentatives depuis cette connexion");
    }
    if (data.error === "invalid_email") return "invalid";
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    return data.status || "ok";
  }

  /* --- Adhésion : "ok" | "already" | "invalid" | lève une erreur --- */
  async function sign(rawEmail) {
    const email = norm(rawEmail);
    if (!emailValid(email)) return "invalid";

    const resultat = await appeler("/api/sign", email);
    if (resultat !== null) return resultat;

    // Mode démonstration
    const demo = demoLire();
    if (demo.includes(email)) return "already";
    demo.push(email);
    demoEcrire(demo);
    return "ok";
  }

  /* --- Désinscription : "ok" | "notfound" | "invalid" | lève une erreur --- */
  async function unsubscribe(rawEmail) {
    const email = norm(rawEmail);
    if (!emailValid(email)) return "invalid";

    const resultat = await appeler("/api/unsubscribe", email);
    if (resultat !== null) return resultat;

    // Mode démonstration
    const demo = demoLire();
    const i = demo.indexOf(email);
    if (i === -1) return "notfound";
    demo.splice(i, 1);
    demoEcrire(demo);
    return "ok";
  }

  return { getCount, sign, unsubscribe, emailValid, get configured() { return configured; } };
})();
