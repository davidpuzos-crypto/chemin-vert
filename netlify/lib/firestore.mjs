/* ==========================================================================
   Chemin Vert — accès Firestore côté serveur (SDK Admin)
   --------------------------------------------------------------------------
   Le SDK Admin IGNORE les règles de sécurité Firestore. C'est précisément ce
   qu'on veut : les règles ferment désormais toute écriture depuis un
   navigateur, et ces fonctions sont le seul chemin d'écriture qui subsiste.

   Conséquence directe : la validation des données n'est plus assurée par les
   règles mais par ce code. Tout ce qui passe ici entre dans la base tel quel.

   La clé de service est lue dans la variable d'environnement
   FIREBASE_SERVICE_ACCOUNT (le contenu JSON entier, sur une seule valeur).
   Elle donne un accès total à la base : elle ne doit jamais être exposée au
   navigateur, d'où son usage exclusif dans les fonctions serverless.
   ========================================================================== */

import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

let cached = null;

/** Renvoie l'accès Firestore, ou null si la clé de service est absente ou
 *  illisible. Les fonctions appelantes répondent alors « not_configured »
 *  plutôt que de planter : le site bascule en mode démonstration. */
export function getDb() {
  if (cached) return cached;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error("firestore: FIREBASE_SERVICE_ACCOUNT absente");
    return null;
  }

  let creds;
  try {
    creds = JSON.parse(raw);
  } catch (err) {
    console.error("firestore: FIREBASE_SERVICE_ACCOUNT n'est pas un JSON valide");
    return null;
  }

  try {
    const app = getApps().length
      ? getApps()[0]
      : initializeApp({ credential: cert(creds), projectId: creds.project_id });
    cached = getFirestore(app);
    return cached;
  } catch (err) {
    console.error("firestore: initialisation impossible —", err.message);
    return null;
  }
}

export { FieldValue };
