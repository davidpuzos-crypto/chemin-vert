/* ==========================================================================
   Chemin Vert — En-tête & pied de page partagés
   Injectés sur chaque page dans #site-header / #site-footer.
   La page active est indiquée par <body data-page="home|charter|join|shop">.
   ========================================================================== */

const Layout = {
  header() {
    return `
    <header class="nav" id="nav">
      <a href="index.html" class="nav__brand" aria-label="Chemin Vert">
        <img class="nav__logo" id="navLogo" src="assets/logo.png" alt="" onerror="this.style.display='none'" />
        <span class="nav__name">Chemin&nbsp;Vert</span>
      </a>

      <nav class="nav__links" id="navLinks">
        <a href="index.html"    data-nav="home"    data-i18n="nav.home">Accueil</a>
        <a href="charte.html"   data-nav="charter" data-i18n="nav.charter">La charte</a>
        <a href="adherer.html"  data-nav="join"    data-i18n="nav.join">Adhérer</a>
        <a href="boutique.html" data-nav="shop"    data-i18n="nav.shop">Boutique</a>
      </nav>

      <div class="nav__actions">
        <div class="lang" id="lang">
          <button class="lang__btn" id="langBtn" aria-haspopup="listbox" aria-expanded="false">
            <span class="lang__flag" id="langFlag">🇫🇷</span>
            <span class="lang__code" id="langCode">FR</span>
            <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <ul class="lang__menu" id="langMenu" role="listbox"></ul>
        </div>

        <a href="adherer.html" class="btn btn--sm btn--primary nav__cta">
          <span data-i18n="nav.join">Adhérer</span>
          <span class="nav__cta-count js-counter" aria-hidden="true">—</span>
        </a>

        <button class="nav__burger" id="burger" aria-label="Menu">
          <span></span><span></span><span></span>
        </button>
      </div>
    </header>`;
  },

  footer() {
    return `
    <footer class="footer">
      <div class="container footer__inner">
        <div class="footer__brand">
          <img class="footer__logo" id="footerLogo" src="assets/logo.png" alt="" onerror="this.style.display='none'" />
          <div>
            <strong>Chemin Vert</strong>
            <p data-i18n="footer.tagline">Reprenons le chemin des valeurs qui nous unissent.</p>
          </div>
        </div>
        <nav class="footer__nav">
          <a href="index.html"    data-i18n="nav.home">Accueil</a>
          <a href="charte.html"   data-i18n="nav.charter">La charte</a>
          <a href="adherer.html"  data-i18n="nav.join">Adhérer</a>
          <a href="boutique.html" data-i18n="nav.shop">Boutique</a>
        </nav>
        <div class="footer__meta">
          <p class="footer__rights">© <span id="year"></span> Chemin Vert — <span data-i18n="footer.rights">Tous droits réservés.</span></p>
        </div>
      </div>
    </footer>`;
  },

  inject() {
    const h = document.getElementById("site-header");
    if (h) h.innerHTML = this.header();
    const f = document.getElementById("site-footer");
    if (f) f.innerHTML = this.footer();

    // Lien de navigation actif (+ aria-current pour l'accessibilité)
    const page = document.body.dataset.page;
    document.querySelectorAll("[data-nav]").forEach(a => {
      const on = a.dataset.nav === page;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    // Année du pied de page
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  }
};
