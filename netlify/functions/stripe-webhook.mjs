/* ==========================================================================
   POST /api/stripe-webhook
   Stripe appelle cette URL quand un paiement est validé. C'est le SEUL
   déclencheur fiable : la page de retour du navigateur peut être fermée,
   rechargée ou falsifiée — elle ne doit jamais déclencher une commande.

   Étapes : vérifier la signature → ignorer les doublons → créer la commande
   chez Printful → journaliser.
   ========================================================================== */

import { createHash } from "node:crypto";
import Stripe from "stripe";
import { getStore } from "@netlify/blobs";
import { pf, buildRecipient, getCatalog, indexVariants } from "../lib/printful.mjs";

const HANDLED = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded"
]);

/* Espace de noms des marques « événement déjà traité » (Netlify Blobs).
   L'incrémenter invalide les marques posées par une version antérieure du
   code : c'est le moyen de rejouer depuis Stripe un événement qu'un bug avait
   marqué traité à tort. */
const IDEMPOTENCY_NS = "event3";

/* Printful impose un external_id d'au plus 32 caractères (chiffres, lettres
   latines, tirets, tirets bas). L'identifiant de session Stripe en fait 66 :
   on en dérive une empreinte stable, donc toujours identique pour une même
   session — c'est ce qui garantit qu'un renvoi du webhook ne crée pas une
   seconde commande. */
function printfulExternalId(sessionId) {
  return "cv_" + createHash("sha256").update(sessionId).digest("hex").slice(0, 24);
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("method_not_allowed", { status: 405 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!secret || !stripeKey) {
    console.error("stripe-webhook: variables Stripe manquantes");
    return new Response("not_configured", { status: 503 });
  }

  const stripe = new Stripe(stripeKey);

  // --- 1. Vérification de la signature (sur le corps BRUT) ----------------
  // Ne jamais parser le JSON avant : cela invaliderait la signature.
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    console.error("stripe-webhook: signature invalide —", err.message);
    return new Response("invalid_signature", { status: 400 });
  }

  if (!HANDLED.has(event.type)) return new Response("ignored", { status: 200 });

  const session = event.data.object;
  if (session.payment_status === "unpaid") {
    // Paiement différé pas encore encaissé : on attend l'événement suivant.
    return new Response("payment_pending", { status: 200 });
  }

  const store = safeStore();

  // --- 2. Idempotence : Stripe peut livrer le même événement plusieurs fois -
  // Le préfixe est versionné : le changer invalide les marques posées par une
  // version antérieure du code, afin qu'un « Renvoyer » depuis Stripe rejoue
  // réellement l'événement au lieu d'être court-circuité.
  const seenKey = `${IDEMPOTENCY_NS}/${event.id}`;
  if (store) {
    try {
      if (await store.get(seenKey)) {
        return new Response("duplicate", { status: 200 });
      }
    } catch { /* on continue : Printful dédoublonne aussi via external_id */ }
  }

  // --- 3. Reconstitution du panier ----------------------------------------
  let cart = [];
  if (store) {
    try {
      const saved = await store.get(`cart/${session.id}`, { type: "json" });
      if (saved?.cart?.length) cart = saved.cart;
    } catch { /* repli sur les metadata */ }
  }
  if (!cart.length && session.metadata?.cart) {
    cart = session.metadata.cart.split(",").filter(Boolean).map(pair => {
      const [v, q] = pair.split(":");
      return { v, q: parseInt(q, 10) || 1 };
    });
  }
  if (!cart.length) {
    console.error("stripe-webhook: panier introuvable pour", session.id);
    await record(store, session, { status: "failed", error: "panier introuvable" });
    return new Response("no_cart", { status: 200 }); // inutile de faire réessayer Stripe
  }

  // --- 4. Adresse de livraison --------------------------------------------
  const shipping = session.shipping_details || session.collected_information?.shipping_details;
  const address = shipping?.address;
  if (!address?.line1 || !address?.country) {
    console.error("stripe-webhook: adresse manquante pour", session.id);
    await record(store, session, { status: "failed", error: "adresse manquante" });
    return new Response("no_address", { status: 200 });
  }

  const recipient = buildRecipient({
    name: shipping?.name || session.customer_details?.name || "Client",
    email: session.customer_details?.email,
    phone: session.customer_details?.phone,
    address
  });

  // --- 5. Prix de vente (facultatif : sert au bon de livraison/douane) -----
  let priceOf = () => undefined;
  try {
    const { products } = await getCatalog();
    const variants = indexVariants(products);
    priceOf = id => variants.get(id)?.price;
  } catch { /* non bloquant */ }

  const items = cart.map(c => {
    const item = { sync_variant_id: Number(c.v), quantity: c.q };
    const price = priceOf(c.v);
    if (price) item.retail_price = String(price);
    return item;
  });

  // --- 6. Création de la commande Printful --------------------------------
  // Par défaut en BROUILLON : rien n'est imprimé ni débité tant que vous
  // n'avez pas confirmé dans Printful. Passez PRINTFUL_AUTO_CONFIRM=true
  // quand vous êtes prêt à automatiser complètement.
  const autoConfirm = String(process.env.PRINTFUL_AUTO_CONFIRM).toLowerCase() === "true";

  const externalId = printfulExternalId(session.id);

  try {
    const order = await pf(`/orders${autoConfirm ? "?confirm=1" : ""}`, {
      method: "POST",
      body: {
        external_id: externalId, // dédoublonnage côté Printful
        recipient,
        items,
        retail_costs: {
          currency: (session.currency || "eur").toUpperCase(),
          shipping: ((session.total_details?.amount_shipping ?? 0) / 100).toFixed(2)
        }
      }
    });

    if (store) {
      try { await store.setJSON(seenKey, { at: Date.now() }); } catch {}
    }
    await record(store, session, {
      status: autoConfirm ? "sent_to_printful" : "draft_created",
      printfulOrderId: order?.id,
      externalId
    });

    console.log(
      "stripe-webhook: commande Printful", order?.id,
      "| external_id:", externalId,
      "| session:", session.id
    );
    return new Response("ok", { status: 200 });
  } catch (err) {
    // Toute erreur Printful est journalisée, y compris celles traitées comme
    // des doublons : un paiement encaissé sans commande ne doit jamais rester
    // invisible.
    console.error(
      "stripe-webhook: Printful a refusé la commande —",
      "status:", err.status,
      "| code:", err.printfulCode,
      "| message:", err.message,
      "| réponse:", JSON.stringify(err.payload || {})
    );

    // Un doublon, c'est UNIQUEMENT Printful qui refuse un external_id DÉJÀ
    // UTILISÉ : la commande existe donc réellement. Le message doit porter les
    // deux idées à la fois — mentionner « external id » ne suffit pas, sans
    // quoi un refus de format (identifiant trop long, par exemple) passerait
    // pour un succès et le paiement resterait sans commande.
    const msg = err.message || "";
    const duplicate =
      err.printfulCode === "EXTERNAL_ID_IN_USE" ||
      (/external[_ ]id/i.test(msg) && /(already|exist|in use|duplicat|taken)/i.test(msg));
    if (duplicate) {
      if (store) { try { await store.setJSON(seenKey, { at: Date.now() }); } catch {} }
      await record(store, session, { status: "already_created" });
      return new Response("already_created", { status: 200 });
    }

    await record(store, session, {
      status: "failed",
      error: `${err.status} ${err.printfulCode || ""} ${err.message}`.trim()
    });

    // 500 → Stripe réessaiera automatiquement (jusqu'à 3 jours), et l'événement
    // apparaît en rouge dans le tableau de bord Stripe : l'échec est visible.
    return new Response("printful_error", { status: 500 });
  }
};

/* ---------------------------------------------------------------------- */

function safeStore() {
  try { return getStore("chemin-vert-shop"); } catch { return null; }
}

/** Journalise la commande : indispensable pour retrouver un paiement encaissé
 *  dont la commande n'est pas partie. */
async function record(store, session, extra) {
  if (!store) return;
  try {
    await store.setJSON(`order/${session.id}`, {
      stripeSessionId: session.id,
      paymentIntent: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
      email: session.customer_details?.email,
      amountTotal: session.amount_total,
      currency: session.currency,
      at: Date.now(),
      ...extra
    });
  } catch { /* la journalisation ne doit jamais casser le webhook */ }
}
