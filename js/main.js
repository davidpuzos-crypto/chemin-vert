/* ==========================================================================
   Chemin Vert — Interactions
   ========================================================================== */

(function () {
  "use strict";

  /* ---------- Année du footer ---------- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Navigation : ombre au scroll + menu mobile ---------- */
  const nav = document.getElementById("nav");
  const burger = document.getElementById("burger");
  const navLinks = document.getElementById("navLinks");

  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 24);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  burger.addEventListener("click", () => nav.classList.toggle("open"));
  navLinks.addEventListener("click", e => {
    if (e.target.tagName === "A") nav.classList.remove("open");
  });

  /* ---------- Sélecteur de langue ---------- */
  const lang = document.getElementById("lang");
  const langBtn = document.getElementById("langBtn");
  const langMenu = document.getElementById("langMenu");
  const langFlag = document.getElementById("langFlag");
  const langCode = document.getElementById("langCode");

  // Construit la liste des langues
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

  function renderValues(lang) {
    const primary = I18N.values[lang];
    // Deux autres langues affichées en sous-titre, pour l'esprit universel
    const others = Object.keys(I18N.values).filter(l => l !== lang).slice(0, 2);
    valuesGrid.innerHTML = "";
    primary.forEach((name, i) => {
      const alt = others
        .map(l => `<span>${I18N.values[l][i]}</span>`)
        .join("");
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

  /* ---------- Compteur de signatures ---------- */
  const counterNum = document.getElementById("counterNum");
  const signCounterNum = document.getElementById("signCounterNum");
  let currentCount = null;

  function animateCount(target) {
    const els = [counterNum, signCounterNum].filter(Boolean);
    const from = currentCount ?? 0;
    const dur = 1100;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(from + (target - from) * eased);
      els.forEach(el => (el.textContent = val.toLocaleString(I18nEngine.current)));
      if (p < 1) requestAnimationFrame(tick);
      else currentCount = target;
    }
    requestAnimationFrame(tick);
  }

  async function refreshCount() {
    try {
      const c = await Signatures.getCount();
      animateCount(c);
    } catch (err) {
      console.warn("Compteur indisponible :", err.message);
      if (counterNum.textContent === "—") animateCount(0);
    }
  }

  /* ---------- Formulaire de signature ---------- */
  const form = document.getElementById("signForm");
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
      } else if (res === "invalid") {
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

  /* ---------- Petit "confetti" de feuilles à la signature ---------- */
  function burstConfetti() {
    const card = document.querySelector(".sign__card");
    if (!card) return;
    for (let i = 0; i < 14; i++) {
      const s = document.createElement("span");
      s.textContent = "🌿";
      s.style.cssText =
        `position:absolute;left:${50 + (Math.random() * 40 - 20)}%;top:40%;` +
        `font-size:${12 + Math.random() * 14}px;pointer-events:none;z-index:5;`;
      card.style.position = "relative";
      card.appendChild(s);
      const dx = (Math.random() * 2 - 1) * 160;
      const dy = -(80 + Math.random() * 160);
      const rot = Math.random() * 720 - 360;
      s.animate(
        [
          { transform: "translate(0,0) rotate(0)", opacity: 1 },
          { transform: `translate(${dx}px,${dy}px) rotate(${rot}deg)`, opacity: 0 }
        ],
        { duration: 1200 + Math.random() * 600, easing: "cubic-bezier(.2,.7,.3,1)" }
      ).onfinish = () => s.remove();
    }
  }

  /* ---------- Reveal au scroll ---------- */
  const revealObserver = new IntersectionObserver(
    entries => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          revealObserver.unobserve(en.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  function observeReveals() {
    document.querySelectorAll(".reveal:not(.in)").forEach(el => revealObserver.observe(el));
  }

  const valuesObserver = new IntersectionObserver(
    entries => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          valuesObserver.unobserve(en.target);
        }
      });
    },
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
      const sc = 0.5 + Math.random();
      leaf.style.transform = `scale(${sc})`;
      leaf.style.opacity = 0.15 + Math.random() * 0.25;
      host.appendChild(leaf);
    }
  }

  /* ---------- Parallaxe douce de l'emblème du hero ---------- */
  const heroEmblem = document.getElementById("heroEmblem");
  window.addEventListener(
    "scroll",
    () => {
      if (!heroEmblem) return;
      const y = window.scrollY;
      if (y < window.innerHeight) heroEmblem.style.transform = `translateY(${y * 0.08}px)`;
    },
    { passive: true }
  );

  /* ---------- Réagit aux changements de langue ---------- */
  document.addEventListener("langchange", e => {
    const code = e.detail.lang;
    refreshLangButton(code);
    renderValues(code);
    // Ré-affiche le compteur avec le bon format de nombre
    if (currentCount !== null) {
      [counterNum, signCounterNum].forEach(el => {
        if (el) el.textContent = currentCount.toLocaleString(code);
      });
    }
  });

  /* ---------- Démarrage ---------- */
  const startLang = I18nEngine.detect();
  I18nEngine.apply(startLang);   // déclenche langchange → renderValues + bouton
  refreshLangButton(startLang);
  spawnLeaves();
  observeReveals();
  refreshCount();

  // Ré-observe les nouveaux .reveal éventuels après le rendu des valeurs
  setTimeout(observeReveals, 50);

  if (!Signatures.configured) {
    console.info(
      "%cChemin Vert — mode DÉMO",
      "color:#14713c;font-weight:bold",
      "\nRenseignez config.js (clés Supabase) pour activer le compteur réel."
    );
  }
})();
