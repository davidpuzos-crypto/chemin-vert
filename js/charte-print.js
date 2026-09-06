/* ==========================================================================
   Chemin Vert — gabarit d'impression de la charte
   Extrait de charte-print.html pour permettre une CSP sans 'unsafe-inline'.
   ========================================================================== */

(function () {
  const params = new URLSearchParams(location.search);
  const lang = I18N.languages[params.get("lang")] ? params.get("lang") : "fr";
  const meta = I18N.languages[lang];
  const t = I18N.t[lang];
  document.documentElement.setAttribute("lang", lang);
  document.body.setAttribute("dir", meta.dir);

  const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  set("kicker", t["charter.preamble_tag"]);
  set("title", t["charter.preamble_title"]);
  set("p1", t["charter.preamble_p1"]);
  set("p2", t["charter.preamble_p2"]);
  set("valuesTitle", t["charter.values_title"]);

  // Tableau : deux colonnes, une valeur par cellule
  const values = I18N.values[lang];
  const body = document.getElementById("values");
  const rows = Math.ceil(values.length / 2);
  const cellHtml = (i) => {
    if (i >= values.length) return '<td></td>';
    return '<td><div class="cell"><span class="n">' + String(i + 1).padStart(2, "0") +
           '</span><span class="t">' + values[i] + '</span></div></td>';
  };
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement("tr");
    tr.innerHTML = cellHtml(r) + cellHtml(r + rows);
    body.appendChild(tr);
  }

  set("foot", " — " + t["footer.tagline"]);
  document.title = "Charte — Chemin Vert (" + lang + ")";
  document.body.dataset.ready = "1";
})();
