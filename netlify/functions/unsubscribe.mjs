/* ==========================================================================
   POST /api/unsubscribe
   Retire une signature et décrémente le compteur, en une seule transaction.

   CE QUE CETTE FONCTION CORRIGE. Auparavant, la suppression partait du
   navigateur : Firestore accepte sans broncher la suppression d'un document
   inexistant, si bien qu'une adresse jamais inscrite faisait tout de même
   baisser le compteur, sans rien supprimer. Un écart d'une unité constaté le
   16 octobre 2026 venait très probablement de là. Ici l'existence est
   vérifiée dans la transaction : le compteur ne peut plus dériver.

   LIMITE QUI SUBSISTE. Connaître une adresse suffit encore pour retirer la
   signature correspondante. La fermer demande un lien de confirmation envoyé
   par e-mail, donc un service d'envoi que le projet n'a pas encore. Le quota
   par IP empêche au moins qu'on le fasse en masse.

   Réponses :
     200 {status:"ok"}        signature retirée
     200 {status:"notfound"}  cette adresse n'était pas inscrite
     400 {error:"invalid_email"}
     429 {error:"rate_limited"}
     503 {error:"not_configured"}
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

  if (!(await underRateLimit(`unsub/${clientIp(req)}`))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    await db.runTransaction(async (tx) => {
      const signature = db.collection("signatures").doc(email);

      const existante = await tx.get(signature);
      if (!existante.exists) {
        const e = new Error("notfound");
        e.introuvable = true;
        throw e;
      }

      tx.delete(signature);
      tx.set(
        db.collection("stats").doc("counter"),
        { count: FieldValue.increment(-1) },
        { merge: true }
      );
    });
  } catch (err) {
    if (err.introuvable) return Response.json({ status: "notfound" });
    console.error("unsubscribe:", err.message);
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  return Response.json({ status: "ok" });
};
