/* ==========================================================================
   GET /api/get-products
   Renvoie le catalogue Printful au navigateur, SANS jamais exposer la clé.
   Tout nouveau produit ajouté dans Printful apparaît automatiquement.
   ========================================================================== */

import { getCatalog } from "../lib/printful.mjs";

export default async (req) => {
  if (req.method !== "GET") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  try {
    const { products, stale } = await getCatalog();
    return Response.json(
      { products, stale },
      {
        headers: {
          // Le CDN Netlify absorbe le trafic ; on tolère une version un peu
          // ancienne le temps de rafraîchir en arrière-plan.
          "Cache-Control": "public, max-age=300, stale-while-revalidate=86400"
        }
      }
    );
  } catch (err) {
    console.error("get-products:", err.status, err.message);
    // On ne renvoie jamais le détail de l'erreur Printful au navigateur.
    return Response.json(
      { error: "catalog_unavailable", products: [] },
      { status: 503 }
    );
  }
};
