/* Le panier a été payé : on le vide au retour de Stripe. */
try { localStorage.removeItem("cv_cart"); } catch (e) {}
