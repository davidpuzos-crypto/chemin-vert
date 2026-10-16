/* ==========================================================================
   Chemin Vert — tests des fonctions de signature
   --------------------------------------------------------------------------
   Depuis que les règles Firestore refusent toute écriture venant d'un
   navigateur, sign.mjs et unsubscribe.mjs sont le SEUL chemin d'écriture de
   la base. Leur comportement doit donc être éprouvé, pas relu.

   Ces tests tournent contre l'émulateur Firestore, jamais contre la vraie
   base. La clé de service est fabriquée à la volée : l'émulateur ne vérifie
   pas la signature, mais cert() exige une clé privée bien formée.

   Pour les exécuter :
     npm install --no-save firebase-tools@15
     npx firebase emulators:exec --only firestore --project demo-cv \
       "node netlify/functions.test.mjs"
   ========================================================================== */

import { generateKeyPairSync } from "node:crypto";

const PROJET = "demo-cv";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8181";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" }
});
process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
  type: "service_account",
  project_id: PROJET,
  private_key: privateKey,
  client_email: `test@${PROJET}.iam.gserviceaccount.com`,
  client_id: "0"
});

const { default: sign } = await import("./functions/sign.mjs");
const { default: unsubscribe } = await import("./functions/unsubscribe.mjs");
const { getDb } = await import("./lib/firestore.mjs");
const db = getDb();

let pass = 0, fail = 0;
function check(label, obtenu, attendu) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  console.log(`  ${ok ? "✓" : "✗"} ${label}${ok ? "" : `  →  obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`}`);
  ok ? pass++ : fail++;
}

const poster = (fn, corps) => fn(new Request("https://cheminvert.org/api/x", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-nf-client-connection-ip": "203.0.113.7" },
  body: JSON.stringify(corps)
}));

const lire = async (fn, corps) => {
  const res = await poster(fn, corps);
  return { code: res.status, ...(await res.json().catch(() => ({}))) };
};

const compteur = async () => {
  const s = await db.collection("stats").doc("counter").get();
  return s.exists ? s.data().count : null;
};

/* Remise à zéro */
for (const c of ["signatures", "stats"]) {
  const snap = await db.collection(c).get();
  await Promise.all(snap.docs.map(d => d.ref.delete()));
}
await db.collection("stats").doc("counter").set({ count: 10 });

console.log("\n— Signature —");
check("adresse valide acceptée", await lire(sign, { email: "david@exemple.fr", lang: "fr" }), { code: 200, status: "ok" });
check("compteur incrémenté", await compteur(), 11);
check("deuxième signature de la même adresse refusée", await lire(sign, { email: "david@exemple.fr" }), { code: 200, status: "already" });
check("compteur inchangé après un doublon", await compteur(), 11);
check("majuscules normalisées, donc doublon détecté", await lire(sign, { email: "DAVID@Exemple.FR" }), { code: 200, status: "already" });

console.log("\n— Adresses refusées —");
for (const [libelle, email] of [
  ["sans arobase", "pasunemail"],
  ["extension d'une lettre", "a@b.c"],
  ["trop courte", "a@b.f"],
  ["contenant une barre oblique", "a/b@exemple.fr"],
  ["vide", ""],
  ["trop longue", "a".repeat(250) + "@exemple.fr"]
]) {
  check(libelle, await lire(sign, { email }), { code: 400, error: "invalid_email" });
}
check("compteur intact après les refus", await compteur(), 11);

console.log("\n— Champs inattendus —");
const res = await lire(sign, { email: "champs@exemple.fr", lang: "fr", charge: "A".repeat(5000), admin: true });
check("charge arbitraire ignorée, signature acceptée", res, { code: 200, status: "ok" });
const doc = await db.collection("signatures").doc("champs@exemple.fr").get();
check("seuls email, lang et created sont stockés", Object.keys(doc.data()).sort(), ["created", "email", "lang"]);
check("lang surdimensionné ramené à null", (await (async () => {
  await lire(sign, { email: "lang@exemple.fr", lang: "A".repeat(400) });
  return (await db.collection("signatures").doc("lang@exemple.fr").get()).data().lang;
})()), null);

console.log("\n— Désinscription —");
check("adresse inscrite retirée", await lire(unsubscribe, { email: "david@exemple.fr" }), { code: 200, status: "ok" });
check("compteur décrémenté", await compteur(), 12);
check("adresse jamais inscrite : compteur NON touché", await lire(unsubscribe, { email: "jamais@exemple.fr" }), { code: 200, status: "notfound" });
check("compteur inchangé (c'était la dérive)", await compteur(), 12);

console.log("\n— Méthode et corps —");
check("GET refusé", await (async () => {
  const r = await sign(new Request("https://cheminvert.org/api/sign", { method: "GET" }));
  return r.status;
})(), 405);

console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
