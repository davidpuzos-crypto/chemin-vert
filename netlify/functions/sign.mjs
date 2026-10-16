/* ==========================================================================
   POST /api/sign
   Enregistre une signature et incrémente le compteur, en une seule
   transaction : les deux aboutissent, ou aucun des deux.

   C'est désormais le SEUL chemin d'écriture vers la collection
   « signatures ». Les règles Firestore refusent toute écriture venant d'un
   navigateur, donc un script qui s'adresserait directement à la base est
   rejeté avant même d'être lu.

   Réponses :
     200 {status:"ok"}        signature enregistrée
     200 {status:"already"}   cette adresse a déjà signé
     400 {error:"invalid_email"}
     429 {error:"rate_limited"}
     503 {error:"not_configured"}  clé de service absente → mode démonstration
   ========================================================================== */

import { getDb, FieldValue } from "../lib/firestore.mjs";
import { clientIp, emailValid, normalizeEmail, underRateLimit } from "../lib/guard.mjs";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("method_not_allowed", { status: 405 });
  }

  const db = getDb();
  if (!db) return Response.json({ error: "not_configured" }, { status: 503 });

  let corps;
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const email = normalizeEmail(corps?.email);
  if (!emailValid(email)) {
    return Response.json({ error: "invalid_email" }, { status: 400 });
  }

  // La langue n'est qu'une statistique : on la borne au lieu de la refuser.
  const lang = typeof corps?.lang === "string" && corps.lang.length <= 5
    ? corps.lang
    : null;

  if (!(await underRateLimit(`sign/${clientIp(req)}`))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    await db.runTransaction(async (tx) => {
      const signature = db.collection("signatures").doc(email);

      // La lecture doit précéder toute écriture dans une transaction.
      const existante = await tx.get(signature);
      if (existante.exists) {
        const e = new Error("already");
        e.dejaSignee = true;
        throw e;
      }

      tx.set(signature, {
        email,
        lang,
        created: FieldValue.serverTimestamp()
      });

      // merge : crée le document si le compteur n'existe pas encore.
      tx.set(
        db.collection("stats").doc("counter"),
        { count: FieldValue.increment(1) },
        { merge: true }
      );
    });
  } catch (err) {
    if (err.dejaSignee) return Response.json({ status: "already" });
    console.error("sign:", err.message);
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  return Response.json({ status: "ok" });
};
