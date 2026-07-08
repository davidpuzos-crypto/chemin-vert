/* ==========================================================================
   Chemin Vert — Signatures & compteur
   --------------------------------------------------------------------------
   - Enregistre l'e-mail d'un signataire dans la table `signatures` (Supabase)
   - Lit le nombre total de signatures pour le compteur public
   - Fonctionne en mode DÉMO tant que config.js n'est pas renseigné
   ========================================================================== */

const Signatures = (() => {
  const cfg = window.CHEMIN_VERT_CONFIG || {};
  const configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  let supabase = null;

  if (configured && window.supabase) {
    supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  const DEMO_KEY = "cv_demo_signatures";

  const emailValid = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim().toLowerCase());

  /* --- Lecture du compteur ---
     Passe par la fonction SECURITY DEFINER `signatures_count` : cela permet
     de connaître le total SANS exposer la liste des e-mails via l'API.   */
  async function getCount() {
    if (supabase) {
      const { data, error } = await supabase.rpc("signatures_count");
      if (error) throw error;
      return Number(data) || 0;
    }
    // Mode démo
    const demo = JSON.parse(localStorage.getItem(DEMO_KEY) || "[]");
    return (cfg.FALLBACK_COUNT || 0) + demo.length;
  }

  /* --- Enregistrement d'une signature ---
     Retourne : "ok" | "already" | lève une erreur                    */
  async function sign(rawEmail) {
    const email = String(rawEmail).trim().toLowerCase();
    if (!emailValid(email)) return "invalid";

    if (supabase) {
      const lang = (typeof I18nEngine !== "undefined" && I18nEngine.current) || null;
      const { error } = await supabase.from("signatures").insert({ email, lang });
      if (error) {
        // 23505 = violation de contrainte d'unicité (déjà signé)
        if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
          return "already";
        }
        throw error;
      }
      return "ok";
    }

    // Mode démo (stockage local uniquement)
    const demo = JSON.parse(localStorage.getItem(DEMO_KEY) || "[]");
    if (demo.includes(email)) return "already";
    demo.push(email);
    localStorage.setItem(DEMO_KEY, JSON.stringify(demo));
    return "ok";
  }

  return { getCount, sign, emailValid, configured };
})();
