/* ==========================================================================
   Chemin Vert — sauvegarde des signatures
   --------------------------------------------------------------------------
   Exporte la collection « signatures » et le compteur « stats/counter » dans
   un fichier daté, déposé dans backups/ (ignoré par git).

   POURQUOI. Les signatures sont des données personnelles réelles, conservées
   en un seul exemplaire. Faute de comptes utilisateurs, les règles laissent la
   suppression ouverte : n'importe qui connaissant une adresse peut retirer la
   signature correspondante. Une base vidée, par malveillance ou par erreur de
   manipulation, serait définitivement perdue.

   PRÉPARATION (une seule fois)
     1. Console Firebase → Paramètres du projet → Comptes de service
        → « Générer une nouvelle clé privée ».
        Enregistrer le fichier JSON HORS du dépôt, par exemple dans
        ~/chemin-vert-serviceAccount.json
        Ce fichier donne un accès total à la base : il ne se partage pas, ne
        se commite pas, ne s'envoie pas par e-mail.
     2. npm install --no-save firebase-admin

   UTILISATION
     GOOGLE_APPLICATION_CREDENTIALS=~/chemin-vert-serviceAccount.json \
       node scripts/backup-signatures.mjs

   Le fichier produit contient des adresses e-mail. Il ne doit jamais être
   committé (backups/ est dans .gitignore), ni déposé sur un espace partagé
   sans précaution.
   ========================================================================== */

import fs from "node:fs";
import path from "node:path";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "chemin-vert-848b6";
const OUT_DIR = path.join(process.cwd(), "backups");

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    "\nGOOGLE_APPLICATION_CREDENTIALS n'est pas défini.\n" +
    "Voir l'en-tête de ce fichier pour la marche à suivre.\n"
  );
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore();

/* Horodatage lisible et triable : 2026-10-11-1042 */
function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
         `-${p(d.getHours())}${p(d.getMinutes())}`;
}

const snap = await db.collection("signatures").get();
const signatures = snap.docs
  .map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      email: d.email ?? null,
      lang: d.lang ?? null,
      created: d.created?.toDate?.().toISOString() ?? null
    };
  })
  .sort((a, b) => (a.created || "").localeCompare(b.created || ""));

const counterDoc = await db.doc("stats/counter").get();
const counter = counterDoc.exists ? Number(counterDoc.data().count) : null;

const backup = {
  projet: PROJECT_ID,
  exporteLe: new Date().toISOString(),
  compteurPublic: counter,
  nombreDeSignatures: signatures.length,
  signatures
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const file = path.join(OUT_DIR, `signatures-${stamp()}.json`);
fs.writeFileSync(file, JSON.stringify(backup, null, 2), "utf8");

console.log(`\nSauvegarde écrite : ${file}`);
console.log(`  signatures enregistrées : ${signatures.length}`);
console.log(`  compteur public         : ${counter ?? "(absent)"}`);

/* Contrôle de cohérence. Un écart n'est pas anodin : le compteur et la
   collection sont censés bouger ensemble, dans la même opération atomique.
   Un décalage signale soit un incident, soit une manipulation du compteur. */
if (counter !== null && counter !== signatures.length) {
  const ecart = counter - signatures.length;
  console.warn(
    `\n  ⚠ Écart de ${ecart > 0 ? "+" : ""}${ecart} entre le compteur et le\n` +
    "    nombre réel de signatures. À surveiller : le compteur a pu être\n" +
    "    manipulé, ou une opération a échoué à mi-parcours."
  );
}

console.log("\nCe fichier contient des données personnelles : à conserver en lieu sûr.\n");
