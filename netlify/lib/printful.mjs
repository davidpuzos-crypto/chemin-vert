/* ==========================================================================
   Chemin Vert — accès à l'API Printful (côté SERVEUR uniquement)
   --------------------------------------------------------------------------
   ⚠️  Ce fichier ne doit JAMAIS être importé par le navigateur : il utilise
       la clé privée PRINTFUL_API_KEY, disponible seulement côté serveur.

   API v1 (https://api.printful.com) : c'est la seule version qui expose les
   produits synchronisés de la boutique et les `sync_variant_id`.
   ========================================================================== */

import { getStore } from "@netlify/blobs";

const API = "https://api.printful.com";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Appel générique à l'API Printful. Lève une erreur enrichie si non-2xx. */
export async function pf(path, { method = "GET", body, token } = {}) {
  const key = token || process.env.PRINTFUL_API_KEY;
  if (!key) throw Object.assign(new Error("PRINTFUL_API_KEY manquante"), { status: 500 });

  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  let payload = {};
  try { payload = await res.json(); } catch { /* réponse vide */ }

  if (!res.ok) {
    const err = new Error(
      payload?.error?.message || payload?.result || `Printful ${res.status}`
    );
    err.status = res.status;
    err.printfulCode = payload?.error?.reason || payload?.code;
    err.payload = payload;
    throw err;
  }
  return payload.result;
}

/** Récupère le catalogue complet (produits + variantes) depuis Printful. */
export async function fetchCatalog() {
  const list = await pf("/store/products");
  const products = [];

  for (const p of list) {
    if (p.is_ignored) continue;
    const detail = await pf(`/store/products/${p.id}`);
    const sp = detail.sync_product || {};

    const variants = (detail.sync_variants || [])
      .filter(v => !v.is_ignored && v.availability_status === "active")
      .map(v => ({
        id: String(v.id),                       // sync_variant_id
        name: v.name,
        // "chemin vert / 3″×3″" -> "3″×3″"
        size: v.size || (v.name.includes(" / ") ? v.name.split(" / ").pop() : v.name),
        price: v.retail_price,                   // chaîne, ex. "3.00"
        currency: v.currency || "EUR",
        image:
          (v.files || []).find(f => f.type === "preview")?.preview_url ||
          sp.thumbnail_url ||
          null
      }));

    if (variants.length) {
      products.push({
        id: String(p.id),
        name: sp.name || p.name,
        thumbnail: sp.thumbnail_url || null,
        variants
      });
    }
  }
  return products;
}

/* -------------------------------------------------------------------------
   Cache du catalogue (Netlify Blobs)
   Évite de saturer le quota Printful (120 requêtes / 60 s) et permet de
   continuer à afficher la boutique si Printful est momentanément indisponible.
   ------------------------------------------------------------------------- */
function blobStore() {
  try { return getStore("chemin-vert-shop"); } catch { return null; }
}

export async function getCatalog({ force = false } = {}) {
  const store = blobStore();
  let cached = null;

  if (store && !force) {
    try { cached = await store.get("catalog", { type: "json" }); } catch { /* ignore */ }
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return { products: cached.products, stale: false };
    }
  }

  try {
    const products = await fetchCatalog();
    if (store) {
      try { await store.setJSON("catalog", { fetchedAt: Date.now(), products }); } catch { /* ignore */ }
    }
    return { products, stale: false };
  } catch (err) {
    // Printful KO : on sert la dernière version connue plutôt qu'une boutique vide.
    if (cached?.products?.length) return { products: cached.products, stale: true };
    throw err;
  }
}

/** Table { sync_variant_id -> variante } pour valider les paniers côté serveur. */
export function indexVariants(products) {
  const map = new Map();
  for (const p of products) {
    for (const v of p.variants) map.set(v.id, { ...v, productName: p.name });
  }
  return map;
}

/**
 * Construit le destinataire Printful depuis une adresse Stripe.
 * `state_code` n'est envoyé QUE pour les pays qui l'exigent : l'envoyer
 * (même vide) pour la France met la commande en attente chez Printful.
 */
export function buildRecipient({ name, email, phone, address }) {
  const r = {
    name,
    address1: address.line1,
    city: address.city,
    country_code: address.country,
    zip: address.postal_code
  };
  if (address.line2) r.address2 = address.line2;
  if (email) r.email = email;
  if (phone) r.phone = phone;
  if (["US", "CA", "AU"].includes(address.country) && address.state) {
    r.state_code = address.state;
  }
  return r;
}
