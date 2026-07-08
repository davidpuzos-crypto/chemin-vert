/* ==========================================================================
   Chemin Vert — Logique commune à toutes les pages
   ========================================================================== */

(function () {
  "use strict";

  /* ---------- Injecte l'en-tête et le pied de page partagés ---------- */
  Layout.inject();

  /* ---------- Navigation : ombre au scroll + menu mobile ---------- */
  const nav = document.getElementById("nav");
  const burger = document.getElementById("burger");
  const navLinks = document.getElementById("navLinks");

  if (nav) {
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }
  if (burger) burger.addEventListener("click", () => nav.classList.toggle("open"));
  if (navLinks) {
    navLinks.addEventListener("click", e => {
      if (e.target.tagName === "A") nav.classList.remove("open");
    });
  }

  /* ---------- Sélecteur de langue ---------- */
  const lang = document.getElementById("lang");
  const langBtn = document.getElementById("langBtn");
  const langMenu = document.getElementById("langMenu");
  const langFlag = document.getElementById("langFlag");
  const langCode = document.getElementById("langCode");

  Object.entries(I18N.languages).forEach(([code, meta]) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.dataset.lang = code;
    li.innerHTML = `<span class="flag">${meta.flag}</span><span>${meta.label}</span>`;
    li.addEventListener("click", () => {
      I18nEngine.apply(code);
      lang.classList.remove("open");
      langBtn.setAttribute("aria-expanded", "false");
    });
    langMenu.appendChild(li);
  });

  langBtn.addEventListener("click", e => {
    e.stopPropagation();
    const open = lang.classList.toggle("open");
    langBtn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", () => {
    lang.classList.remove("open");
    langBtn.setAttribute("aria-expanded", "false");
  });

  function refreshLangButton(code) {
    const meta = I18N.languages[code];
    langFlag.textContent = meta.flag;
    langCode.textContent = code.toUpperCase();
    langMenu.querySelectorAll("li").forEach(li =>
      li.classList.toggle("active", li.dataset.lang === code)
    );
  }

  /* ---------- Valeurs de la charte (rendu multilingue) ---------- */
  const valuesGrid = document.getElementById("valuesGrid");

  function renderValues(current) {
    if (!valuesGrid) return;
    const primary = I18N.values[current];
    const others = Object.keys(I18N.values).filter(l => l !== current).slice(0, 2);
    valuesGrid.innerHTML = "";
    primary.forEach((name, i) => {
      const alt = others.map(l => `<span>${I18N.values[l][i]}</span>`).join("");
      const card = document.createElement("article");
      card.className = "value";
      card.style.transitionDelay = (i % 5) * 60 + "ms";
      card.innerHTML =
        `<div class="value__idx">${String(i + 1).padStart(2, "0")}</div>` +
        `<div class="value__name">${name}</div>` +
        `<div class="value__alt">${alt}</div>`;
      valuesGrid.appendChild(card);
    });
    observeValues();
  }

  /* ---------- Compteur de signatures (générique : .js-counter) ---------- */
  const counterEls = () => document.querySelectorAll(".js-counter");
  const hasCounter = counterEls().length > 0;
  let currentCount = null;

  const MILESTONES = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
  function goalFor(count) {
    return MILESTONES.find(m => m > count) || Math.ceil((count + 1) / 1e6) * 1e6;
  }
  function lowerFor(count) {
    let low = 0;
    for (const m of MILESTONES) { if (m <= count) low = m; else break; }
    return low;
  }
  function renderMilestone(val) {
    const goal = goalFor(val);
    const low = lowerFor(val);
    const pct = Math.max(3, Math.min(100, Math.round(((val - low) / (goal - low)) * 100)));
    document.querySelectorAll("[data-milestone]").forEach(m => {
      const g = m.querySelector(".milestone__goal");
      const fill = m.querySelector(".milestone__fill");
      if (g) g.textContent = goal.toLocaleString(I18nEngine.current);
      if (fill) fill.style.width = pct + "%";
    });
  }

  function paintCount(val) {
    counterEls().forEach(el => (el.textContent = val.toLocaleString(I18nEngine.current)));
    renderMilestone(val);
  }

  function animateCount(target) {
    const from = currentCount ?? 0;
    const dur = 1400;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      paintCount(Math.round(from + (target - from) * eased));
      if (p < 1) requestAnimationFrame(tick);
      else {
        currentCount = target;
        document.querySelectorAll(".join-hero__num, .cband__num").forEach(el => {
          el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
        });
      }
    }
    requestAnimationFrame(tick);
  }

  async function refreshCount() {
    try {
      animateCount(await Signatures.getCount());
    } catch (err) {
      console.warn("Compteur indisponible :", err.message);
      if (currentCount === null) animateCount(0);
    }
  }

  /* ---------- Formulaire de signature ---------- */
  const form = document.getElementById("signForm");
  if (form) {
    const emailInput = document.getElementById("signEmail");
    const signBtn = document.getElementById("signBtn");
    const signMsg = document.getElementById("signMsg");

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const email = emailInput.value;
      signMsg.textContent = "";
      signMsg.className = "sign__msg";

      if (!Signatures.emailValid(email)) {
        signMsg.textContent = I18nEngine.get("sign.invalid");
        signMsg.classList.add("err");
        return;
      }

      signBtn.classList.add("is-loading");
      const label = signBtn.querySelector("span");
      const prev = label.textContent;
      label.textContent = I18nEngine.get("sign.sending");

      try {
        const res = await Signatures.sign(email);
        if (res === "ok") {
          signMsg.textContent = I18nEngine.get("sign.success");
          signMsg.classList.add("ok");
          emailInput.value = "";
          refreshCount();
          burstConfetti();
        } else if (res === "already") {
          signMsg.textContent = I18nEngine.get("sign.already");
          signMsg.classList.add("ok");
        } else {
          signMsg.textContent = I18nEngine.get("sign.invalid");
          signMsg.classList.add("err");
        }
      } catch (err) {
        console.error(err);
        signMsg.textContent = I18nEngine.get("sign.error");
        signMsg.classList.add("err");
      } finally {
        signBtn.classList.remove("is-loading");
        label.textContent = prev;
      }
    });
  }

  function burstConfetti() {
    const host = document.querySelector(".sign__card") || form;
    if (!host) return;
    host.style.position = "relative";
    for (let i = 0; i < 16; i++) {
      const s = document.createElement("span");
      s.textContent = "🌿";
      s.style.cssText =
        `position:absolute;left:${50 + (Math.random() * 40 - 20)}%;top:40%;` +
        `font-size:${12 + Math.random() * 16}px;pointer-events:none;z-index:5;`;
      host.appendChild(s);
      const dx = (Math.random() * 2 - 1) * 180;
      const dy = -(90 + Math.random() * 180);
      const rot = Math.random() * 720 - 360;
      s.animate(
        [
          { transform: "translate(0,0) rotate(0)", opacity: 1 },
          { transform: `translate(${dx}px,${dy}px) rotate(${rot}deg)`, opacity: 0 }
        ],
        { duration: 1300 + Math.random() * 700, easing: "cubic-bezier(.2,.7,.3,1)" }
      ).onfinish = () => s.remove();
    }
  }

  /* ---------- Bouton de téléchargement de la charte (PDF) ---------- */
  const downloadBtn = document.getElementById("downloadCharter");
  function refreshDownload(code) {
    if (!downloadBtn) return;
    downloadBtn.setAttribute("href", `assets/charte/charte-${code}.pdf`);
    downloadBtn.setAttribute("download", `charte-chemin-vert-${code}.pdf`);
  }

  /* ---------- Reveal au scroll ---------- */
  const revealObserver = new IntersectionObserver(
    entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add("in"); revealObserver.unobserve(en.target); }
    }),
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  function observeReveals() {
    document.querySelectorAll(".reveal:not(.in)").forEach(el => revealObserver.observe(el));
  }

  const valuesObserver = new IntersectionObserver(
    entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add("in"); valuesObserver.unobserve(en.target); }
    }),
    { threshold: 0.1 }
  );
  function observeValues() {
    document.querySelectorAll(".value:not(.in)").forEach(el => valuesObserver.observe(el));
  }

  /* ---------- Feuilles flottantes en fond ---------- */
  function spawnLeaves() {
    const host = document.getElementById("leaves");
    if (!host) return;
    const leafSvg =
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">' +
      '<path d="M12 2C7 4 3 8 3 14c0 4 3 8 9 8 0-6-1-9-4-12 4 1 7 4 9 9 1-9-2-14-5-17z"/></svg>';
    const count = window.innerWidth < 700 ? 7 : 14;
    for (let i = 0; i < count; i++) {
      const leaf = document.createElement("span");
      leaf.className = "leaf";
      leaf.innerHTML = leafSvg;
      leaf.style.left = Math.random() * 100 + "vw";
      leaf.style.animationDuration = 12 + Math.random() * 16 + "s";
      leaf.style.animationDelay = -(Math.random() * 20) + "s";
      leaf.style.transform = `scale(${0.5 + Math.random()})`;
      leaf.style.opacity = 0.15 + Math.random() * 0.25;
      host.appendChild(leaf);
    }
  }

  /* ---------- Parallaxe douce de l'emblème du hero ---------- */
  const heroEmblem = document.getElementById("heroEmblem");
  if (heroEmblem) {
    window.addEventListener("scroll", () => {
      const y = window.scrollY;
      if (y < window.innerHeight) heroEmblem.style.transform = `translateY(${y * 0.08}px)`;
    }, { passive: true });
  }

  /* ---------- Modale : une valeur dans les 7 langues (page Charte) ---------- */
  let vmodal = null;
  function initValueModal() {
    if (!valuesGrid) return;
    vmodal = document.createElement("div");
    vmodal.className = "vmodal";
    vmodal.innerHTML =
      '<div class="vmodal__box" role="dialog" aria-modal="true">' +
      '<button class="vmodal__close" aria-label="Fermer">&times;</button>' +
      '<p class="vmodal__kicker"></p><h3 class="vmodal__title"></h3>' +
      '<ul class="vmodal__list"></ul></div>';
    document.body.appendChild(vmodal);
    const close = () => vmodal.classList.remove("open");
    vmodal.addEventListener("click", e => { if (e.target === vmodal) close(); });
    vmodal.querySelector(".vmodal__close").addEventListener("click", close);
    document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
    valuesGrid.addEventListener("click", e => {
      const card = e.target.closest(".value");
      if (!card) return;
      openValue([...valuesGrid.children].indexOf(card));
    });
  }
  function openValue(idx) {
    if (!vmodal || idx < 0) return;
    const cur = I18nEngine.current;
    vmodal.querySelector(".vmodal__kicker").textContent = I18nEngine.get("value.all_title");
    vmodal.querySelector(".vmodal__title").textContent = I18N.values[cur][idx];
    vmodal.querySelector(".vmodal__close").setAttribute("aria-label", I18nEngine.get("value.close"));
    const list = vmodal.querySelector(".vmodal__list");
    list.innerHTML = "";
    Object.entries(I18N.languages).forEach(([code, meta]) => {
      const li = document.createElement("li");
      li.dir = meta.dir;
      li.className = code === cur ? "is-current" : "";
      li.innerHTML =
        `<span class="vmodal__flag">${meta.flag}</span>` +
        `<span class="vmodal__lang">${meta.label}</span>` +
        `<span class="vmodal__word">${I18N.values[code][idx]}</span>`;
      list.appendChild(li);
    });
    vmodal.classList.add("open");
  }

  /* ---------- Boutique : panier ---------- */
  const PRODUCTS = {
    sticker: { key: "shop.product1", price: 3 },
    badge:   { key: "shop.product2", price: 5 },
    tote:    { key: "shop.product3", price: 15 }
  };
  const CART_KEY = "cv_cart";
  const cartFab = document.getElementById("cartFab");
  const hasCart = !!cartFab;

  function getCart() { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } }
  function saveCart(c) { localStorage.setItem(CART_KEY, JSON.stringify(c)); }
  function fmt(n) { return n.toLocaleString(I18nEngine.current) + " €"; }

  function initCart() {
    const cart = document.getElementById("cart");
    const overlay = document.getElementById("cartOverlay");
    const badge = document.getElementById("cartBadge");
    const itemsEl = document.getElementById("cartItems");
    const totalEl = document.getElementById("cartTotal");
    const msgEl = document.getElementById("cartMsg");

    const open = () => { cart.classList.add("open"); overlay.classList.add("open"); cart.setAttribute("aria-hidden", "false"); };
    const close = () => { cart.classList.remove("open"); overlay.classList.remove("open"); cart.setAttribute("aria-hidden", "true"); };
    cartFab.addEventListener("click", open);
    overlay.addEventListener("click", close);
    document.getElementById("cartClose").addEventListener("click", close);

    function render() {
      const c = getCart();
      const count = c.reduce((n, i) => n + i.qty, 0);
      badge.textContent = count;
      badge.classList.toggle("show", count > 0);
      itemsEl.innerHTML = "";
      if (!c.length) {
        itemsEl.innerHTML = `<p class="cart__empty">${I18nEngine.get("shop.cart_empty")}</p>`;
      } else {
        c.forEach(item => {
          const p = PRODUCTS[item.id];
          const row = document.createElement("div");
          row.className = "cart__row";
          row.innerHTML =
            `<div class="cart__thumb cart__thumb--${item.id}"></div>` +
            `<div class="cart__info"><strong>${I18nEngine.get(p.key)}</strong><span>${fmt(p.price)}</span></div>` +
            `<div class="cart__qty"><button data-act="dec" data-id="${item.id}">−</button>` +
            `<span>${item.qty}</span><button data-act="inc" data-id="${item.id}">+</button></div>` +
            `<button class="cart__rm" data-act="rm" data-id="${item.id}" aria-label="${I18nEngine.get("shop.remove")}">&times;</button>`;
          itemsEl.appendChild(row);
        });
      }
      totalEl.textContent = fmt(c.reduce((s, i) => s + i.qty * PRODUCTS[i.id].price, 0));
    }

    itemsEl.addEventListener("click", e => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      let c = getCart();
      const id = btn.dataset.id;
      const it = c.find(x => x.id === id);
      if (!it) return;
      if (btn.dataset.act === "inc") it.qty++;
      else if (btn.dataset.act === "dec") it.qty--;
      else if (btn.dataset.act === "rm") it.qty = 0;
      c = c.filter(x => x.qty > 0);
      saveCart(c); render();
    });

    document.querySelectorAll(".product__add").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.product;
        const c = getCart();
        const it = c.find(x => x.id === id);
        if (it) it.qty++; else c.push({ id, qty: 1 });
        saveCart(c); render();
        cartFab.classList.remove("bump"); void cartFab.offsetWidth; cartFab.classList.add("bump");
        const span = btn.querySelector("span");
        const prev = span.textContent;
        span.textContent = I18nEngine.get("shop.added");
        btn.classList.add("added");
        setTimeout(() => { span.textContent = prev; btn.classList.remove("added"); }, 1200);
      });
    });

    document.getElementById("cartCheckout").addEventListener("click", () => {
      if (!getCart().length) { msgEl.textContent = I18nEngine.get("shop.cart_empty"); return; }
      msgEl.textContent = I18nEngine.get("shop.checkout_soon");
    });

    document.addEventListener("langchange", render);
    render();
  }

  /* ---------- Barre de progression de défilement ---------- */
  const progress = document.createElement("div");
  progress.className = "scroll-progress";
  document.body.appendChild(progress);
  window.addEventListener("scroll", () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${h > 0 ? window.scrollY / h : 0})`;
  }, { passive: true });

  /* ---------- Réagit aux changements de langue ---------- */
  document.addEventListener("langchange", e => {
    const code = e.detail.lang;
    refreshLangButton(code);
    renderValues(code);
    refreshDownload(code);
    if (currentCount !== null) paintCount(currentCount);
  });

  /* ---------- Démarrage ---------- */
  initValueModal();
  if (hasCart) initCart();

  const startLang = I18nEngine.detect();
  I18nEngine.apply(startLang);
  refreshLangButton(startLang);
  refreshDownload(startLang);
  spawnLeaves();
  observeReveals();
  if (hasCounter) refreshCount();
  setTimeout(observeReveals, 60);

  if (!Signatures.configured) {
    console.info("%cChemin Vert — mode DÉMO", "color:#14713c;font-weight:bold",
      "\nRenseignez config.js (clés Supabase) pour activer le compteur réel.");
  }
})();
