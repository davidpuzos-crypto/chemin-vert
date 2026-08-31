/* ==========================================================================
   POST /api/create-checkout
   Crée une session Stripe Checkout et renvoie son URL.

   🔒 SÉCURITÉ — le navigateur n'envoie QUE des identifiants de variante et
   des quantités. Les PRIX sont toujours relus depuis Printful côté serveur :
   un client qui trafiquerait le prix dans la requête n'a aucun effet.
   ========================================================================== */

import Stripe from "stripe";
import { getStore } from "@netlify/blobs";
import { getCatalog, indexVariants } from "../lib/printful.mjs";

const MAX_QTY_PER_LINE = 20;
const MAX_LINES = 10;

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

  // --- 3. Livraison (tarif forfaitaire) -----------------------------------
  // Printful calcule ses frais réels à partir de l'adresse, or Stripe exige
  // le tarif AVANT que le client saisisse son adresse : on applique donc un
  // forfait, ajustable via la variable SHIPPING_FLAT_CENTS.
  const shippingCents = Math.max(0, parseInt(process.env.SHIPPING_FLAT_CENTS ?? "450", 10) || 0);
  const allowedCountries = (process.env.ALLOWED_COUNTRIES || "FR")
    .split(",").map(c => c.trim().toUpperCase()).filter(Boolean);

  const origin = process.env.SITE_URL?.replace(/\/$/, "") || new URL(req.url).origin;

  // --- 4. Création de la session ------------------------------------------
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      shipping_address_collection: { allowed_countries: allowedCountries },
      shipping_options: [{
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: "Livraison",
          fixed_amount: { amount: shippingCents, currency: "eur" }
        }
      }],
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
