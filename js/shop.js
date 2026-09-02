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
  const trust = document.getElementById("shopTrust");
  const fab = document.getElementById("cartFab");
  const CART_KEY = "cv_cart";
  const MAX_QTY = 20;

  /* ---------------- Utilitaires ---------------- */
  const t = (k) => (typeof I18nEngine !== "undefined" ? I18nEngine.get(k) : k);
  const money = (amount, currency = "EUR") =>
    new Intl.NumberFormat(typeof I18nEngine !== "undefined" ? I18nEngine.current : "fr", {
      style: "currency", currency
    }).format(amount);

  const esc = (s) => String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const clamp = (n) => Math.max(1, Math.min(MAX_QTY, n));
  const getCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } };
  const saveCart = (c) => { try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch {} };

  let CATALOG = [];
  const variantById = new Map();

  /* ---------------- Message éphémère ---------------- */
  const toastEl = document.getElementById("shopToast");
  let toastTimer;
  function hideToast() {
    if (!toastEl) return;
    clearTimeout(toastTimer);
    toastEl.classList.remove("show");
    toastEl.hidden = true;
  }
  function toast(message) {
    if (!toastEl) return;
    // Inutile — et gênant — quand le tiroir est ouvert : il recouvrirait le
    // bouton « Commander », alors que le panier affiche déjà la modification.
    if (document.getElementById("cart")?.classList.contains("open")) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    // Forcer un reflow pour rejouer l'animation si un message est déjà affiché
    void toastEl.offsetWidth;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("show");
      setTimeout(() => { toastEl.hidden = true; }, 300);
    }, 2200);
  }

  /* ---------------- Chargement du catalogue ---------------- */
  function skeletons(n) {
    grid.innerHTML = Array.from({ length: n }, () => `
      <article class="product product--skeleton" aria-hidden="true">
        <div class="sk sk--visual"></div>
        <div class="product__body">
          <div class="sk sk--line sk--title"></div>
          <div class="sk sk--line sk--short"></div>
          <div class="sk sk--pills"></div>
          <div class="sk sk--btn"></div>
        </div>
      </article>`).join("");
  }

  async function loadCatalog() {
    skeletons(3);
    grid.setAttribute("aria-busy", "true");

    try {
      const res = await fetch("/api/get-products");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      CATALOG = Array.isArray(data.products) ? data.products : [];
    } catch (err) {
      console.warn("Boutique indisponible :", err.message);
      CATALOG = [];
    }

    grid.removeAttribute("aria-busy");
    variantById.clear();
    CATALOG.forEach(p => p.variants.forEach(v => variantById.set(v.id, { ...v, productName: p.name })));

    if (!CATALOG.length) {
      grid.innerHTML = "";
      grid.hidden = true;
      if (notice) notice.hidden = false;      // « la boutique ouvre bientôt »
      if (trust) trust.hidden = true;
      if (fab) fab.style.display = "none";
      return;
    }

    if (notice) notice.hidden = true;
    if (trust) trust.hidden = false;
    grid.hidden = false;
    // Une seule fiche ne doit pas s'étirer sur toute la largeur.
    grid.classList.toggle("shop__grid--few", CATALOG.length < 3);
    renderProducts();
    renderCart();
  }

  /* ---------------- Fiches produits ---------------- */
  function renderProducts() {
    grid.innerHTML = CATALOG.map((p, pi) => {
      const first = p.variants[0];
      const multi = p.variants.length > 1;
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
          ${multi ? `
          <p class="product__sizelabel" id="sizelabel-${pi}">${esc(t("shop.size"))}</p>
          <div class="sizes" role="radiogroup" aria-labelledby="sizelabel-${pi}">${sizes}</div>` : `
          <p class="product__sizelabel">${esc(first.size)}</p>
          <div class="sizes" hidden>${sizes}</div>`}
          <div class="product__buy">
            <div class="qty" role="group" aria-label="${esc(t("shop.qty"))}">
              <button type="button" class="js-q" data-step="-1" aria-label="${esc(t("shop.decrease"))}">&minus;</button>
              <output class="js-qval">1</output>
              <button type="button" class="js-q" data-step="1" aria-label="${esc(t("shop.increase"))}">+</button>
            </div>
            <button class="btn btn--primary product__add js-add">
              <span>${esc(t("shop.add"))}</span>
            </button>
          </div>
        </div>
      </article>`;
    }).join("");

    grid.querySelectorAll(".product").forEach(card => {
      const priceEl = card.querySelector(".js-price");
      const imgEl = card.querySelector(".product__img");
      const qtyEl = card.querySelector(".js-qval");
      const pi = Number(card.dataset.product);
      const product = CATALOG[pi];

      // Changement de taille : prix et visuel suivent
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

      // Sélecteur de quantité
      card.querySelectorAll(".js-q").forEach(btn => {
        btn.addEventListener("click", () => {
          qtyEl.value = clamp(Number(qtyEl.value) + Number(btn.dataset.step));
        });
      });

      card.querySelector(".js-add").addEventListener("click", (e) => {
        const id = card.querySelector('input[type="radio"]:checked')?.value || product.variants[0].id;
        addToCart(id, clamp(Number(qtyEl.value)));
        qtyEl.value = 1;
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
  function addToCart(variantId, qty = 1) {
    const cart = getCart();
    const line = cart.find(l => l.id === variantId);
    if (line) line.qty = clamp(line.qty + qty);
    else cart.push({ id: variantId, qty: clamp(qty) });
    saveCart(cart);
    renderCart();

    const v = variantById.get(variantId);
    toast(`${v ? v.productName + " · " + v.size : ""} — ${t("shop.added")}`.trim());
    if (fab) { fab.classList.remove("bump"); void fab.offsetWidth; fab.classList.add("bump"); }
  }

  function renderCart() {
    const badge = document.getElementById("cartBadge");
    const itemsEl = document.getElementById("cartItems");
    const totalEl = document.getElementById("cartTotal");
    const countEl = document.getElementById("cartCount");
    if (!itemsEl || !totalEl) return;

    // On ignore silencieusement les variantes disparues du catalogue
    const cart = getCart().filter(l => variantById.has(l.id));
    saveCart(cart);

    const count = cart.reduce((n, l) => n + l.qty, 0);
    if (badge) { badge.textContent = count; badge.classList.toggle("show", count > 0); }
    if (countEl) countEl.textContent = count ? `(${count})` : "";

    if (!cart.length) {
      itemsEl.innerHTML = `
        <div class="cart__empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>
          <p>${esc(t("shop.cart_empty"))}</p>
          <button type="button" class="btn btn--ghost" id="cartContinue">${esc(t("shop.continue"))}</button>
        </div>`;
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
          <button data-act="dec" data-id="${esc(l.id)}" aria-label="${esc(t("shop.decrease"))}">&minus;</button>
          <span>${l.qty}</span>
          <button data-act="inc" data-id="${esc(l.id)}" aria-label="${esc(t("shop.increase"))}">+</button>
        </div>
        <button class="cart__rm" data-act="rm" data-id="${esc(l.id)}" aria-label="${esc(t("shop.remove"))}">&times;</button>
      </div>`;
    }).join("");

    totalEl.textContent = money(total);
  }

  /* ---------------- Tiroir + commande ---------------- */
  function initCartUI() {
    const drawer = document.getElementById("cart");
    const overlay = document.getElementById("cartOverlay");
    const itemsEl = document.getElementById("cartItems");
    const msgEl = document.getElementById("cartMsg");
    const checkout = document.getElementById("cartCheckout");
    const closeBtn = document.getElementById("cartClose");
    if (!drawer || !fab) return;

    let lastFocused = null;

    const open = () => {
      hideToast();
      lastFocused = document.activeElement;
      drawer.classList.add("open");
      overlay.classList.add("open");
      drawer.setAttribute("aria-hidden", "false");
      document.body.classList.add("no-scroll");
      closeBtn?.focus();
    };
    const close = () => {
      drawer.classList.remove("open");
      overlay.classList.remove("open");
      drawer.setAttribute("aria-hidden", "true");
      document.body.classList.remove("no-scroll");
      lastFocused?.focus();
    };

    fab.addEventListener("click", open);
    overlay.addEventListener("click", close);
    closeBtn?.addEventListener("click", close);

    document.addEventListener("keydown", e => {
      if (!drawer.classList.contains("open")) return;
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "Tab") return;
      // Le focus reste dans le tiroir tant qu'il est ouvert
      const f = [...drawer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter(el => !el.disabled && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    itemsEl?.addEventListener("click", e => {
      if (e.target.closest("#cartContinue")) { close(); return; }
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      let c = getCart();
      const line = c.find(l => l.id === btn.dataset.id);
      if (!line) return;
      if (btn.dataset.act === "inc") line.qty = clamp(line.qty + 1);
      else if (btn.dataset.act === "dec") line.qty--;
      else if (btn.dataset.act === "rm") line.qty = 0;
      saveCart(c.filter(l => l.qty > 0));
      renderCart();
    });

    checkout?.addEventListener("click", async () => {
      const c = getCart();
      if (!c.length) { msgEl.textContent = t("shop.cart_empty"); return; }

      checkout.classList.add("is-loading");
      checkout.disabled = true;
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
          return;                            // on laisse le bouton désactivé
        }
        msgEl.textContent = data.error === "variant_unavailable"
          ? t("shop.unavailable")
          : t("shop.checkout_error");
      } catch {
        msgEl.textContent = t("shop.checkout_error");
      }
      checkout.classList.remove("is-loading");
      checkout.disabled = false;
    });
  }

  /* ---------------- Démarrage ---------------- */
  initCartUI();
  loadCatalog();
  document.addEventListener("langchange", () => { if (CATALOG.length) { renderProducts(); renderCart(); } });
})();
