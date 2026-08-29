/* ==========================================================================
   Chemin Vert — Configuration Firebase
   --------------------------------------------------------------------------
   Ces clés sont CONÇUES pour être publiques (comme la clé anon de Supabase) :
   la sécurité est assurée par les règles Firestore (console Firebase →
   Firestore → Règles). Ne mettez ici que la config « Web app ».

   Tant que Firebase n'est pas joignable (ex. clés absentes), le site
   fonctionne en mode DÉMO : signature simulée, compteur local.
   ========================================================================== */

window.CHEMIN_VERT_CONFIG = {
  firebase: {
    apiKey: "AIzaSyCyCSybDEioondme6KD8DbN4EXP1xntZ80",
    authDomain: "chemin-vert-848b6.firebaseapp.com",
    projectId: "chemin-vert-848b6",
    storageBucket: "chemin-vert-848b6.firebasestorage.app",
    messagingSenderId: "514840713080",
    appId: "1:514840713080:web:214a3910adc26415105a8d",
    measurementId: "G-X7V86Q13BP"
  },

  // Chiffre affiché si le document stats/counter n'existe pas encore.
  FALLBACK_COUNT: 0
};
