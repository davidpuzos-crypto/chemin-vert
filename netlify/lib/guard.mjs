/* ==========================================================================
   Chemin Vert — validation et garde-fous des fonctions de signature
   --------------------------------------------------------------------------
   Depuis que les règles Firestore refusent toute écriture venant d'un
   navigateur, ce fichier est le SEUL endroit où la forme d'une adresse est
   vérifiée avant d'entrer en base. Les règles ne jouent plus ce rôle.

   La règle de validation est volontairement identique à celle de
   js/signatures.js : le navigateur refuse tôt pour afficher un message utile,
   le serveur refuse pour de bon. Si vous modifiez l'une, modifiez l'autre.
   ========================================================================== */

import { getStore } from "@netlify/blobs";

export const EMAIL_MIN = 6;
export const EMAIL_MAX = 254;

/* Au moins deux caractères après le dernier point : « a@b.c » est refusé,
   comme le faisaient les anciennes règles Firestore. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normalizeEmail = (v) => String(v ?? "").trim().toLowerCase();

export function emailValid(email) {
  const e = normalizeEmail(email);
  return e.length >= EMAIL_MIN
    && e.length <= EMAIL_MAX
    && EMAIL_RE.test(e)
    // L'adresse sert d'identifiant de document : une barre oblique y
    // fabriquerait un chemin imbriqué au lieu d'un identifiant.
    && !e.includes("/");
}

/** Adresse IP de l'appelant. Netlify la fournit en clair ; on retombe sur
 *  l'en-tête standard si jamais l'en-tête maison manquait. */
export function clientIp(req) {
  return req.headers.get("x-nf-client-connection-ip")
    || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || "inconnue";
}

/* Fenêtre volontairement tolérante : plusieurs personnes peuvent partager une
   même IP (réseau d'entreprise, wifi public, partage de connexion). Un humain
   signe une fois ; un script, lui, bute très vite sur la limite. */
const LIMITE = 8;
const FENETRE_MS = 5 * 60 * 1000;

/** true si l'appel est autorisé, false s'il dépasse le quota.
 *  En cas de panne du stockage, on LAISSE PASSER : mieux vaut un quota
 *  temporairement inopérant qu'un formulaire de signature hors service. */
export async function underRateLimit(cle) {
  let store;
  try {
    store = getStore("chemin-vert-quota");
  } catch {
    return true;
  }

  const maintenant = Date.now();
  try {
    const actuel = await store.get(cle, { type: "json" });
    if (!actuel || actuel.expireLe <= maintenant) {
      await store.setJSON(cle, { n: 1, expireLe: maintenant + FENETRE_MS });
      return true;
    }
    if (actuel.n >= LIMITE) return false;
    await store.setJSON(cle, { n: actuel.n + 1, expireLe: actuel.expireLe });
    return true;
  } catch (err) {
    console.warn("quota: stockage indisponible —", err.message);
    return true;
  }
}
