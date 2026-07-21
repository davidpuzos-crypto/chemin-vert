/* ==========================================================================
   Chemin Vert — Pré-page : sélection de la langue (la fleur)
   7 pétales (une langue chacun) autour d'un cœur = la langue choisie.
   ========================================================================== */

(function () {
  "use strict";
  const KEY = "cv_lang";
  const langs = Object.keys(I18N.languages);

  function detect() {
    const saved = localStorage.getItem(KEY);
    if (saved && I18N.languages[saved]) return saved;
    const nav = (navigator.language || "fr").slice(0, 2).toLowerCase();
    return I18N.languages[nav] ? nav : "fr";
  }

  const flower = document.getElementById("flower");
  const bloom = document.getElementById("bloom");
  const bloomFlag = document.getElementById("bloomFlag");
  const bloomLang = document.getElementById("bloomLang");
  const bloomEnter = document.getElementById("bloomEnter");
  const chooseEl = document.getElementById("wChoose");
  const skipEl = document.getElementById("wSkip");

  let current = detect();

  // Construit les pétales, répartis en cercle
  const N = langs.length;
  langs.forEach((code, i) => {
    const meta = I18N.languages[code];
    const pet = document.createElement("button");
    pet.className = "pet";
    pet.type = "button";
    pet.style.setProperty("--a", (360 / N) * i + "deg");
    pet.style.setProperty("--i", i);
    pet.dataset.lang = code;
    pet.setAttribute("aria-label", meta.label);
    pet.innerHTML =
      '<span class="pet__shape"></span>' +
      '<span class="pet__label"><span class="pet__flag">' + meta.flag + '</span>' +
      '<span class="pet__name">' + meta.label + '</span></span>';
    pet.addEventListener("click", () => select(code));
    flower.appendChild(pet);
  });

  function applyUI(code) {
    const meta = I18N.languages[code];
    const t = I18N.t[code];
    document.documentElement.lang = code;
    document.documentElement.dir = meta.dir;
    document.body.classList.toggle("rtl", meta.dir === "rtl");
    if (chooseEl) chooseEl.textContent = t["welcome.choose"];
    if (bloomEnter) bloomEnter.textContent = t["welcome.enter"];
    if (skipEl) skipEl.textContent = t["welcome.skip"];
    bloomFlag.textContent = meta.flag;
    bloomLang.textContent = meta.label;
  }

  function select(code) {
    current = code;
    applyUI(code);
    flower.querySelectorAll(".pet").forEach(p =>
      p.classList.toggle("is-active", p.dataset.lang === code)
    );
    bloom.classList.remove("pulse");
    void bloom.offsetWidth;
    bloom.classList.add("pulse");
  }

  function enter() {
    localStorage.setItem(KEY, current);
    location.href = "accueil.html";
  }

  bloom.addEventListener("click", enter);
  if (skipEl) skipEl.addEventListener("click", enter);

  select(current);
})();
