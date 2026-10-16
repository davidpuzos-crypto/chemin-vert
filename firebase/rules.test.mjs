/* ==========================================================================
   Chemin Vert — tests des règles de sécurité Firestore
   --------------------------------------------------------------------------
   Les règles ferment toute écriture venant d'un navigateur : ces tests
   vérifient que la porte est bien close, y compris pour les opérations que
   le site lui-même effectuait auparavant.

   Ce qui n'est PAS testé ici : la validation du format des adresses. Elle a
   quitté les règles pour netlify/lib/guard.mjs, puisque les écritures
   clientes sont refusées avant d'être examinées, et que le SDK Admin des
   fonctions serverless n'évalue pas ces règles.

   Pour les exécuter :
     npm install --no-save firebase@12 @firebase/rules-unit-testing@5 firebase-tools@15
     npx firebase emulators:exec --only firestore --project demo-cv \
       "node firebase/rules.test.mjs"

   firebase@12 n'est pas un caprice : @firebase/rules-unit-testing@5 exige
   cette version en dépendance de pair, et npm refuse l'installation avec la 13.
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

await env.clearFirestore();

// État initial, écrit en contournant les règles (comme le font les fonctions).
await env.withSecurityRulesDisabled(async ctx => {
  const d = ctx.firestore();
  await setDoc(doc(d, "stats/counter"), { count: 42 });
  await setDoc(doc(d, "signatures/victime@exemple.fr"), { email: "victime@exemple.fr", lang: "fr" });
});

const db = env.unauthenticatedContext().firestore();

console.log("\n— Compteur : lecture publique, écriture fermée —");
await check("lecture du compteur autorisée", getDoc(doc(db, "stats/counter")), "ok");
await check("+1 refusé", updateDoc(doc(db, "stats/counter"), { count: increment(1) }), "refus");
await check("-1 refusé (c'était la dérive du compteur)", updateDoc(doc(db, "stats/counter"), { count: increment(-1) }), "refus");
await check("saut à 99999 refusé", updateDoc(doc(db, "stats/counter"), { count: 99999 }), "refus");
await check("champ parasite refusé", updateDoc(doc(db, "stats/counter"), { count: 43, charge: "A".repeat(5000) }), "refus");
await check("suppression du compteur refusée", deleteDoc(doc(db, "stats/counter")), "refus");

console.log("\n— Confidentialité des signatures —");
await check("lecture d'une signature refusée", getDoc(doc(db, "signatures/victime@exemple.fr")), "refus");
await check("listage des signatures refusé", getDocs(collection(db, "signatures")), "refus");

console.log("\n— Écritures sur les signatures : toutes fermées —");
await check("création refusée, même bien formée", setDoc(doc(db, "signatures/neuf@exemple.fr"), { email: "neuf@exemple.fr", lang: "fr", created: serverTimestamp() }), "refus");
await check("modification refusée", updateDoc(doc(db, "signatures/victime@exemple.fr"), { lang: "en" }), "refus");
await check("⚠ suppression de la signature d'autrui désormais REFUSÉE", deleteDoc(doc(db, "signatures/victime@exemple.fr")), "refus");
await check("champ arbitraire refusé", setDoc(doc(db, "signatures/x@y.fr"), { email: "x@y.fr", charge: "A".repeat(5000) }), "refus");

console.log("\n— L'ancien parcours du site ne passe plus —");
await check("lot signature + incrément refusé", (() => {
  const b = writeBatch(db);
  b.set(doc(db, "signatures/lot@exemple.fr"), { email: "lot@exemple.fr", lang: "fr", created: serverTimestamp() });
  b.update(doc(db, "stats/counter"), { count: increment(1) });
  return b.commit();
})(), "refus");

console.log("\n— Collections hors périmètre —");
await check("création d'une collection inconnue refusée", setDoc(doc(db, "pirate/doc"), { x: 1 }), "refus");
await check("lecture d'une collection inconnue refusée", getDoc(doc(db, "pirate/doc")), "refus");

console.log("\n— Le serveur, lui, garde la main —");
await check("écriture autorisée en contournant les règles (SDK Admin)", env.withSecurityRulesDisabled(async ctx => {
  await setDoc(doc(ctx.firestore(), "signatures/serveur@exemple.fr"), { email: "serveur@exemple.fr", lang: "fr" });
}), "ok");

await env.cleanup();
console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
