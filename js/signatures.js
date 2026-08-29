/* ==========================================================================
   Chemin Vert — Signatures & compteur (Firebase / Firestore)
   --------------------------------------------------------------------------
   - Adhésion  : crée signatures/{email} + incrémente stats/counter (atomique)
   - Compteur  : lit stats/counter (public, sans exposer les e-mails)
   - Désinscr. : supprime signatures/{email} + décrémente stats/counter
   Fonctionne en mode DÉMO si Firebase n'est pas joignable.
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
  const configured = !!db;

  const DEMO_KEY = "cv_demo_signatures";
  const emailValid = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim().toLowerCase());
  const norm = (email) => String(email).trim().toLowerCase();

  const counterRef = () => db.collection("stats").doc("counter");
  const signRef = (email) => db.collection("signatures").doc(email);

  /* --- Lecture du compteur --- */
  async function getCount() {
    if (db) {
      const snap = await counterRef().get();
      return snap.exists ? Number(snap.data().count) || 0 : (cfg.FALLBACK_COUNT || 0);
    }
    const demo = JSON.parse(localStorage.getItem(DEMO_KEY) || "[]");
    return (cfg.FALLBACK_COUNT || 0) + demo.length;
  }

  /* --- Adhésion : "ok" | "already" | "invalid" | lève une erreur --- */
  async function sign(rawEmail) {
    const email = norm(rawEmail);
    if (!emailValid(email)) return "invalid";

    if (db) {
      const lang = (typeof I18nEngine !== "undefined" && I18nEngine.current) || null;
      const inc = firebase.firestore.FieldValue.increment(1);
      const batch = db.batch();
      // set() sur un e-mail déjà présent devient une "update" → refusée par les
      // règles → on l'interprète comme "déjà signé".
      batch.set(signRef(email), {
        email,
        lang,
        created: firebase.firestore.FieldValue.serverTimestamp()
      });
      batch.update(counterRef(), { count: inc });
      try {
        await batch.commit();
        return "ok";
      } catch (err) {
        if (err && err.code === "permission-denied") return "already";
        throw err;
      }
    }

    const demo = JSON.parse(localStorage.getItem(DEMO_KEY) || "[]");
    if (demo.includes(email)) return "already";
    demo.push(email);
    localStorage.setItem(DEMO_KEY, JSON.stringify(demo));
    return "ok";
  }

  /* --- Désinscription : "ok" | "invalid" | lève une erreur --- */
  async function unsubscribe(rawEmail) {
    const email = norm(rawEmail);
    if (!emailValid(email)) return "invalid";

    if (db) {
      const dec = firebase.firestore.FieldValue.increment(-1);
      const batch = db.batch();
      batch.delete(signRef(email));
      batch.update(counterRef(), { count: dec });
      await batch.commit();
      return "ok";
    }

    const demo = JSON.parse(localStorage.getItem(DEMO_KEY) || "[]");
    const i = demo.indexOf(email);
    if (i === -1) return "notfound";
    demo.splice(i, 1);
    localStorage.setItem(DEMO_KEY, JSON.stringify(demo));
    return "ok";
  }

  return { getCount, sign, unsubscribe, emailValid, configured };
})();
