/* ==========================================================================
   Chemin Vert — générateur du camaïeu de verts
   --------------------------------------------------------------------------
   La palette du site n'est pas choisie à l'œil : elle est CALCULÉE en OKLCH,
   l'espace où les écarts de clarté sont perçus régulièrement, à partir d'une
   seule couleur d'ancrage (#17d978).

     node design/ramp.mjs

   Affiche la gamme et les contrastes. Pour changer l'identité du site, il
   suffit de changer ANCRE ci-dessous et de reporter les valeurs dans
   css/style.css (bloc :root).
   ========================================================================== */

import { lch2hex, hex2rgb, rgb2oklab, oklab2lch } from "./oklch.mjs";

/* Contraste WCAG, pour vérifier la gamme sans dépendance extérieure. */
const _hex=h=>{h=h.replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));};
const _lin=c=>{c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);};
const _L=h=>{const[r,g,b]=_hex(h);return 0.2126*_lin(r)+0.7152*_lin(g)+0.0722*_lin(b);};
const ratio=(a,b)=>{const l1=_L(a),l2=_L(b);const[hi,lo]=l1>l2?[l1,l2]:[l2,l1];return (hi+0.05)/(lo+0.05);};
const ANCRE = "#17d978";
const [La, Ca, Ha] = oklab2lch(rgb2oklab(hex2rgb(ANCRE)));

// Camaïeu : la teinte glisse doucement du vert printemps (clair) à l'émeraude
// profonde (foncé), en passant exactement par l'ancre. La chroma est poussée
// au maximum affichable, atténuée aux extrémités pour éviter le fluo.
const STEPS = [
  ["50", 0.985], ["100", 0.955], ["200", 0.905], ["300", 0.850],
  ["400", La],   ["500", 0.700], ["600", 0.620], ["700", 0.545],
  ["800", 0.455], ["900", 0.355], ["950", 0.285],
];
const hueAt = L => 146 + (1 - Math.min(1, Math.max(0, (L - 0.28) / 0.71))) * 18;  // 146° clair → 164° foncé
const chromaScale = L => L > 0.93 ? 0.5 : L > 0.88 ? 0.7 : L > 0.82 ? 0.88 : 1;

const P = {};
for (const [name, L] of STEPS) {
  const H = name === "400" ? Ha : hueAt(L);
  P[name] = name === "400" ? ANCRE : lch2hex(L, 0.33 * chromaScale(L), H);
}
console.log("CAMAÏEU ancré sur " + ANCRE + "  (OKLCH L " + La.toFixed(3) + " · C " + Ca.toFixed(3) + " · H " + Ha.toFixed(1) + "°)\n");
for (const [n] of STEPS) {
  const c = P[n];
  const [l,ch,h] = oklab2lch(rgb2oklab(hex2rgb(c)));
  console.log(`  ${n.padStart(3)}  ${c}   L ${l.toFixed(3)}  C ${ch.toFixed(3)}  H ${h.toFixed(1)}°   blanc/${ratio("#ffffff",c).toFixed(2)}  noir-vert/${ratio("#0d2417",c).toFixed(2)}` + (n==="400"?"   ← votre vert":""));
}
export default P;
