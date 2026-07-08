/* ==========================================================================
   Chemin Vert — Configuration
   --------------------------------------------------------------------------
   Renseignez ici les deux clés PUBLIQUES de votre projet Supabase.
   (Menu Supabase : Project Settings → API)

   ⚠️  La clé « anon / public » est CONÇUE pour être publique : elle peut
       apparaître dans le code du site. La sécurité est assurée côté base
       par les règles RLS (voir supabase/schema.sql).
       Ne mettez JAMAIS ici la clé « service_role ».

   Tant que ces valeurs ne sont pas remplies, le site fonctionne en mode
   DÉMO : le formulaire simule une signature et le compteur reste local.
   ========================================================================== */

window.CHEMIN_VERT_CONFIG = {
  SUPABASE_URL: "https://ohjtqxeaqaohlobymcmd.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable__3n6E9aOsxbdWCLvx9Y2KA_kXPCwKOu",

  // Chiffre affiché au démarrage si la base n'est pas encore branchée
  // (utile pour lancer le site avant Supabase, ou pour amorcer le compteur).
  FALLBACK_COUNT: 1
};
