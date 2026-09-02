/* ==========================================================================
   Chemin Vert — tests des règles de sécurité Firestore
   --------------------------------------------------------------------------
   Ces règles sont la SEULE protection de la base (la clé Firebase du site est
   publique par conception). Elles doivent donc être testées, pas relues.

   Pour les exécuter :
     npm install -g firebase-tools
     npm install --no-save firebase @firebase/rules-unit-testing
     firebase emulators:start --only firestore --project demo-cv   # port 8181
     node firebase/rules.test.mjs

   Le dernier test vérifie une limite ASSUMÉE, pas un bug : faute de comptes
   utilisateurs, la suppression d'une signature reste ouverte. Voir l'en-tête
   de firestore.rules.
   ========================================================================== */

import fs from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp, writeBatch, increment } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-cv",
  firestore: { host: "127.0.0.1", port: 8181, rules: fs.readFileSync(new URL("./firestore.rules", import.meta.url), "utf8") },
});

let pass = 0, fail = 0;
async function check(label, promise, expected /* 'ok' | 'refus' */) {
  try {
    if (expected === "ok") await assertSucceeds(promise); else await assertFails(promise);
    console.log(`  ✓ ${label}`); pass++;
  } catch (e) {
    console.log(`  ✗ ${label}  →  ${String(e.message).split("\n")[0].slice(0, 110)}`); fail++;
  }
}

await env.clearFirestore();   // repartir d'une base vide à chaque exécution

// État initial, écrit en contournant les règles
await env.withSecurityRulesDisabled(async ctx => {
  const d = ctx.firestore();
  await setDoc(doc(d, "stats/counter"), { count: 42 });
  await setDoc(doc(d, "signatures/victime@exemple.fr"), { email: "victime@exemple.fr", lang: "fr" });
});

const db = env.unauthenticatedContext().firestore();

console.log("\n— Compteur —");
await check("lecture du compteur autorisée", getDoc(doc(db, "stats/counter")), "ok");
await check("+1 autorisé", updateDoc(doc(db, "stats/counter"), { count: increment(1) }), "ok");
await check("saut à 99999 refusé", updateDoc(doc(db, "stats/counter"), { count: 99999 }), "refus");
await check("valeur négative refusée", updateDoc(doc(db, "stats/counter"), { count: -1 }), "refus");
await check("champ parasite refusé", updateDoc(doc(db, "stats/counter"), { count: 44, pirate: true }), "refus");
await check("suppression du compteur refusée", deleteDoc(doc(db, "stats/counter")), "refus");

console.log("\n— Confidentialité des e-mails —");
await check("lecture d'une signature refusée", getDoc(doc(db, "signatures/victime@exemple.fr")), "refus");
await check("listage des signatures refusé", getDocs(collection(db, "signatures")), "refus");

console.log("\n— Adhésion (le cas réel du site) —");
const signer = (email, extra = {}) => {
  const b = writeBatch(db);
  b.set(doc(db, "signatures/" + email), { email, lang: "fr", created: serverTimestamp(), ...extra });
  b.update(doc(db, "stats/counter"), { count: increment(1) });
  return b.commit();
};
await check("signature normale acceptée", signer("david.puzos@tisselia.com"), "ok");
await check("signature déjà présente refusée (→ « déjà signé »)", signer("victime@exemple.fr"), "refus");
await check("lang absent accepté", setDoc(doc(db, "signatures/sans.lang@exemple.fr"), { email: "sans.lang@exemple.fr", created: serverTimestamp() }), "ok");
await check("lang null accepté", setDoc(doc(db, "signatures/lang.null@exemple.fr"), { email: "lang.null@exemple.fr", lang: null, created: serverTimestamp() }), "ok");

console.log("\n— Tentatives d'abus sur les signatures —");
await check("identifiant sans arobase refusé", setDoc(doc(db, "signatures/pasunemail"), { email: "pasunemail" }), "refus");
await check("identifiant ≠ champ email refusé", setDoc(doc(db, "signatures/a@b.fr"), { email: "autre@c.fr" }), "refus");
await check("majuscules refusées (doublons de comptage)", setDoc(doc(db, "signatures/David@Exemple.FR"), { email: "David@Exemple.FR" }), "refus");
await check("champ arbitraire refusé", setDoc(doc(db, "signatures/x@y.fr"), { email: "x@y.fr", charge: "A".repeat(5000) }), "refus");
await check("lang surdimensionné refusé", setDoc(doc(db, "signatures/z@y.fr"), { email: "z@y.fr", lang: "A".repeat(400) }), "refus");
await check("modification d'une signature refusée", updateDoc(doc(db, "signatures/victime@exemple.fr"), { email: "pirate@x.fr" }), "refus");

console.log("\n— Collections hors périmètre —");
await check("création d'une collection inconnue refusée", setDoc(doc(db, "pirate/doc"), { x: 1 }), "refus");
await check("lecture d'une collection inconnue refusée", getDoc(doc(db, "pirate/doc")), "refus");

console.log("\n— Limite connue et assumée —");
await check("⚠ suppression de la signature d'autrui POSSIBLE", deleteDoc(doc(db, "signatures/victime@exemple.fr")), "ok");

await env.cleanup();
console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
