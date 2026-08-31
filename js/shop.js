/* ==========================================================================
   Chemin Vert — Boutique
   Le catalogue est chargé automatiquement depuis Printful via la fonction
   serverless /api/get-products (la clé API reste côté serveur).
   Le paiement passe par Stripe Checkout : aucun numéro de carte ne transite
   par ce site.
   ========================================================================== */

(function () {
  "use strict";

  const grid = document.getElementById("shopGrid");
  if (!grid) return; // pas sur la page boutique

  const notice = document.getElementById("shopNotice");
  const CART_KEY = "cv_cart";

  /* ---------------- Utilitaires ---------------- */
  const t = (k) => (typeof I18nEngine !== "undefined" ? I18nEngine.get(k) : k);
  const money = (amount, currency = "EUR") =>
    new Intl.NumberFormat(typeof I18nEngine !== "undefined" ? I18nEngine.current : "fr", {
      style: "currency", currency
    }).format(amount);

  const esc = (s) => String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const getCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } };
  const saveCart = (c) => localStorage.setItem(CART_KEY, JSON.stringify(c));

  let CATALOG = [];
  const variantById = new Map();

  /* ---------------- Chargement du catalogue ---------------- */
  async function loadCatalog() {
    try {
      const res = await fetch("/api/get-products");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      CATALOG = Array.isArray(data.products) ? data.products : [];
    } catch (err) {
      console.warn("Boutique indisponible :", err.message);
      CATALOG = [];
    }

    variantById.clear();
    CATALOG.forEach(p => p.variants.forEach(v => variantById.set(v.id, { ...v, productName: p.name })));

    if (!CATALOG.length) {
      grid.innerHTML = "";
      grid.hidden = true;
      if (notice) notice.hidden = false;      // « la boutique ouvre bientôt »
      document.getElementById("cartFab")?.style.setProperty("display", "none");
      return;
    }
    if (notice) notice.hidden = true;
    grid.hidden = false;
    renderProducts();
    renderCart();
  }

  /* ---------------- Fiches produits ---------------- */
  function renderProducts() {
    grid.innerHTML = CATALOG.map((p, pi) => {
      const first = p.variants[0];
      const sizes = p.variants.map((v, i) => `
        <label class="size ${i === 0 ? "is-checked" : ""}">
          <input type="radio" name="size-${pi}" value="${esc(v.id)}" ${i === 0 ? "checked" : ""}>
          <span>${esc(v.size)}</span>
        </label>`).join("");

      return `
      <article class="product reveal" data-product="${pi}">
        <div class="product__visual product__visual--photo">
          ${first.image ? `<img src="${esc(first.image)}" alt="${esc(p.name)}" loading="lazy" class="product__img">` : ""}
          <span class="product__price js-price">${money(parseFloat(first.price), first.currency)}</span>
        </div>
        <div class="product__body">
          <h3>${esc(p.name)}</h3>
          <p class="product__sizelabel">${esc(t("shop.size"))}</p>
          <div class="sizes">${sizes}</div>
          <button class="btn btn--primary product__add js-add">
            <span>${esc(t("shop.add"))}</span>
          </button>
        </div>
      </article>`;
    }).join("");

    // Interactions : changement de taille + ajout au panier
    grid.querySelectorAll(".product").forEach(card => {
      const priceEl = card.querySelector(".js-price");
      const imgEl = card.querySelector(".product__img");
      const pi = Number(card.dataset.product);
      const product = CATALOG[pi];

      card.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener("change", () => {
          card.querySelectorAll(".size").forEach(l => l.classList.remove("is-checked"));
          radio.closest(".size").classList.add("is-checked");
          const v = variantById.get(radio.value);
          if (v) {
            priceEl.textContent = money(parseFloat(v.price), v.currency);
            if (imgEl && v.image) imgEl.src = v.image;
          }
        });
      });

      card.querySelector(".js-add").addEventListener("click", (e) => {
        const id = card.querySelector('input[type="radio"]:checked')?.value || product.variants[0].id;
        addToCart(id);
        flash(e.currentTarget);
      });
    });

    // Les cartes injectées après coup doivent aussi apparaître en fondu
    grid.querySelectorAll(".reveal").forEach(el => el.classList.add("in"));
  }

  function flash(btn) {
    const span = btn.querySelector("span");
    const prev = span.textContent;
    span.textContent = t("shop.added");
    btn.classList.add("added");
    setTimeout(() => { span.textContent = prev; btn.classList.remove("added"); }, 1200);
  }

  /* ---------------- Panier ---------------- */
  function addToCart(variantId) {
    const cart = getCart();
    const line = cart.find(l => l.id === variantId);
    if (line) line.qty = Math.min(20, line.qty + 1);
    else cart.push({ id: variantId, qty: 1 });
    saveCart(cart);
    renderCart();
    const fab = document.getElementById("cartFab");
    if (fab) { fab.classList.remove("bump"); void fab.offsetWidth; fab.classList.add("bump"); }
  }

  function renderCart() {
    const badge = document.getElementById("cartBadge");
    const itemsEl = document.getElementById("cartItems");
    const totalEl = document.getElementById("cartTotal");
    if (!itemsEl || !totalEl) return;

    // On ignore silencieusement les variantes disparues du catalogue
    const cart = getCart().filter(l => variantById.has(l.id));
    saveCart(cart);

    const count = cart.reduce((n, l) => n + l.qty, 0);
    if (badge) { badge.textContent = count; badge.classList.toggle("show", count > 0); }

    if (!cart.length) {
      itemsEl.innerHTML = `<p class="cart__empty">${esc(t("shop.cart_empty"))}</p>`;
      totalEl.textContent = money(0);
      return;
    }

    let total = 0;
    itemsEl.innerHTML = cart.map(l => {
      const v = variantById.get(l.id);
      total += parseFloat(v.price) * l.qty;
      return `
      <div class="cart__row">
        <div class="cart__thumb">${v.image ? `<img src="${esc(v.image)}" alt="">` : ""}</div>
        <div class="cart__info">
          <strong>${esc(v.productName)}</strong>
          <span>${esc(v.size)} · ${money(parseFloat(v.price), v.currency)}</span>
        </div>
        <div class="cart__qty">
          <button data-act="dec" data-id="${esc(l.id)}">−</button>
          <span>${l.qty}</span>
          <button data-act="inc" data-id="${esc(l.id)}">+</button>
        </div>
        <button class="cart__rm" data-act="rm" data-id="${esc(l.id)}" aria-label="${esc(t("shop.remove"))}">&times;</button>
      </div>`;
    }).join("");

    totalEl.textContent = money(total);
  }

  /* ---------------- Tiroir + commande ---------------- */
  function initCartUI() {
    const cart = document.getElementById("cart");
    const overlay = document.getElementById("cartOverlay");
    const fab = document.getElementById("cartFab");
    const itemsEl = document.getElementById("cartItems");
    const msgEl = document.getElementById("cartMsg");
    const checkout = document.getElementById("cartCheckout");
    if (!cart || !fab) return;

    const open = () => { cart.classList.add("open"); overlay.classList.add("open"); cart.setAttribute("aria-hidden", "false"); };
    const close = () => { cart.classList.remove("open"); overlay.classList.remove("open"); cart.setAttribute("aria-hidden", "true"); };
    fab.addEventListener("click", open);
    overlay.addEventListener("click", close);
    document.getElementById("cartClose")?.addEventListener("click", close);

    itemsEl?.addEventListener("click", e => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      let c = getCart();
      const line = c.find(l => l.id === btn.dataset.id);
      if (!line) return;
      if (btn.dataset.act === "inc") line.qty = Math.min(20, line.qty + 1);
      else if (btn.dataset.act === "dec") line.qty--;
      else if (btn.dataset.act === "rm") line.qty = 0;
      saveCart(c.filter(l => l.qty > 0));
      renderCart();
    });

    checkout?.addEventListener("click", async () => {
      const c = getCart();
      if (!c.length) { msgEl.textContent = t("shop.cart_empty"); return; }

      checkout.classList.add("is-loading");
      msgEl.textContent = "";
      try {
        const res = await fetch("/api/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: c.map(l => ({ variantId: l.id, quantity: l.qty })) })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.url) {
          window.location.href = data.url;   // redirection vers Stripe Checkout
          return;
        }
        msgEl.textContent = data.error === "variant_unavailable"
          ? t("shop.unavailable")
          : t("shop.checkout_error");
      } catch {
        msgEl.textContent = t("shop.checkout_error");
      } finally {
        checkout.classList.remove("is-loading");
      }
    });
  }

  /* ---------------- Démarrage ---------------- */
  initCartUI();
  loadCatalog();
  document.addEventListener("langchange", () => { if (CATALOG.length) { renderProducts(); renderCart(); } });
})();
