/* ==========================================================================
   POST /api/create-checkout
   Crée une session Stripe Checkout et renvoie son URL.

   🔒 SÉCURITÉ — le navigateur n'envoie QUE des identifiants de variante et
   des quantités. Les PRIX sont toujours relus depuis Printful côté serveur :
   un client qui trafiquerait le prix dans la requête n'a aucun effet.
   ========================================================================== */

import Stripe from "stripe";
import { getStore } from "@netlify/blobs";
import { getCatalog, indexVariants, shippingRates } from "../lib/printful.mjs";

const MAX_QTY_PER_LINE = 20;
const MAX_LINES = 10;
// 20 × 10 permettrait 200 articles, or Printful durcit fortement son quota de
// frais de port au-delà de 100. On plafonne donc le total du panier.
const MAX_TOTAL_ITEMS = 60;
// Stripe n'accepte pas plus de 5 modes de livraison par session.
const MAX_SHIPPING_OPTIONS = 5;

/**
 * Modes de livraison proposés au client, au tarif réel de Printful.
 *
 * Si plusieurs pays sont ouverts à la vente, on retient le tarif le PLUS ÉLEVÉ
 * de chaque service : le pays de destination n'est pas encore connu à ce stade,
 * et mieux vaut surfacturer de quelques centimes que vendre à perte.
 *
 * Tout échec (Printful injoignable, catalogue sans identifiant catalogue,
 * quota dépassé) retombe sur le forfait SHIPPING_FLAT_CENTS : une commande ne
 * doit jamais être bloquée par le calcul des frais de port.
 */
async function buildShippingOptions({ countries, cart, variants, flatCents }) {
  const flat = [{
    shipping_rate_data: {
      type: "fixed_amount",
      display_name: "Livraison",
      fixed_amount: { amount: flatCents, currency: "eur" }
    }
  }];

  const items = cart.map(({ v, q }) => ({
    variant_id: variants.get(v)?.catalogVariantId,
    quantity: q
  }));
  // Catalogue mis en cache par une version antérieure : identifiants absents.
  if (items.some(i => !i.variant_id)) return flat;

  try {
    const byName = new Map();
    for (const country of countries.slice(0, 4)) {
      for (const rate of await shippingRates({ countryCode: country, items })) {
        const kept = byName.get(rate.name);
        if (!kept || rate.cents > kept.cents) byName.set(rate.name, rate);
      }
    }
    if (!byName.size) return flat;

    return [...byName.values()]
      .sort((a, b) => a.cents - b.cents)
      .slice(0, MAX_SHIPPING_OPTIONS)
      .map(rate => ({
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: rate.name,
          fixed_amount: { amount: rate.cents, currency: "eur" },
          ...(rate.minDays && rate.maxDays ? {
            delivery_estimate: {
              minimum: { unit: "business_day", value: rate.minDays },
              maximum: { unit: "business_day", value: rate.maxDays }
            }
          } : {})
        }
      }));
  } catch (err) {
    console.error("create-checkout: frais de port Printful indisponibles —", err.status, err.message);
    return flat;
  }
}

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("create-checkout: STRIPE_SECRET_KEY manquante");
    return Response.json({ error: "shop_not_configured" }, { status: 503 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  let body;
  try { body = await req.json(); } catch { body = null; }
  const requested = Array.isArray(body?.items) ? body.items.slice(0, MAX_LINES) : [];
  if (!requested.length) {
    return Response.json({ error: "empty_cart" }, { status: 400 });
  }

  // --- 1. Catalogue de référence (source de vérité pour les prix) ---------
  let variants;
  try {
    const { products } = await getCatalog();
    variants = indexVariants(products);
  } catch (err) {
    console.error("create-checkout: catalogue indisponible", err.message);
    return Response.json({ error: "catalog_unavailable" }, { status: 503 });
  }

  // --- 2. Validation stricte de chaque ligne ------------------------------
  const line_items = [];
  const cart = []; // panier validé, transmis au webhook
  for (const item of requested) {
    const id = String(item?.variantId ?? "");
    const v = variants.get(id);
    if (!v) {
      return Response.json({ error: "variant_unavailable", variantId: id }, { status: 409 });
    }
    const qty = Math.max(1, Math.min(MAX_QTY_PER_LINE, Math.floor(Number(item?.quantity) || 1)));
    const unit_amount = Math.round(parseFloat(v.price) * 100); // prix Printful, jamais celui du client
    if (!Number.isFinite(unit_amount) || unit_amount <= 0) {
      return Response.json({ error: "invalid_price", variantId: id }, { status: 500 });
    }

    line_items.push({
      quantity: qty,
      price_data: {
        currency: (v.currency || "EUR").toLowerCase(),
        unit_amount,
        product_data: {
          name: v.productName ? `${v.productName} — ${v.size}` : v.name,
          images: v.image ? [v.image] : undefined
        }
      }
    });
    cart.push({ v: id, q: qty });
  }

  // Au-delà de 100 articles, Printful abaisse le quota de calcul des frais de
  // port à 5 requêtes par minute, avec blocage de 60 s : quelques paniers
  // volumineux suffiraient à priver les vrais clients du tarif réel. On refuse
  // donc ces commandes, à traiter de la main à la main.
  const totalItems = cart.reduce((n, l) => n + l.q, 0);
  if (totalItems > MAX_TOTAL_ITEMS) {
    return Response.json({ error: "cart_too_large", max: MAX_TOTAL_ITEMS }, { status: 400 });
  }

  // --- 3. Livraison --------------------------------------------------------
  // Stripe exige les frais de port AVANT que le client saisisse son adresse,
  // alors que Printful les calcule à partir de cette adresse. On demande donc
  // à Printful ses tarifs réels pour ce panier au niveau du PAYS : exact pour
  // la France métropolitaine, et bien plus juste qu'un forfait puisque le
  // tarif suit le nombre d'articles.
  const flatCents = Math.max(0, parseInt(process.env.SHIPPING_FLAT_CENTS ?? "450", 10) || 0);
  const allowedCountries = (process.env.ALLOWED_COUNTRIES || "FR")
    .split(",").map(c => c.trim().toUpperCase()).filter(Boolean);

  const shipping_options = await buildShippingOptions({
    countries: allowedCountries,
    cart,
    variants,
    flatCents
  });

  const origin = process.env.SITE_URL?.replace(/\/$/, "") || new URL(req.url).origin;

  // --- 4. Création de la session ------------------------------------------
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      shipping_address_collection: { allowed_countries: allowedCountries },
      shipping_options,
      phone_number_collection: { enabled: false },
      success_url: `${origin}/merci.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/boutique.html`,
      // Panier validé : le webhook s'en sert pour créer la commande Printful.
      metadata: { cart: cart.map(c => `${c.v}:${c.q}`).join(",") }
    });

    // Copie de sauvegarde du panier (si jamais metadata était tronquée)
    try {
      const store = getStore("chemin-vert-shop");
      await store.setJSON(`cart/${session.id}`, { cart, createdAt: Date.now() });
    } catch { /* les Blobs ne sont pas indispensables ici */ }

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("create-checkout: Stripe", err.message);
    return Response.json({ error: "stripe_error" }, { status: 502 });
  }
};
