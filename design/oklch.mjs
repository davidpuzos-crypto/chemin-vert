/* Conversions sRGB <-> OKLCH (Björn Ottosson) + génération de gamme. */
const f=(c)=>c<=0.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-0.055;
const g=(c)=>c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);
export const hex2rgb=h=>{h=h.replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);};
export const rgb2hex=([r,gg,b])=>"#"+[r,gg,b].map(v=>Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,"0")).join("");
export function rgb2oklab([r,gg,b]){
  r=g(r);gg=g(gg);b=g(b);
  const l=Math.cbrt(0.4122214708*r+0.5363325363*gg+0.0514459929*b);
  const m=Math.cbrt(0.2119034982*r+0.6806995451*gg+0.1073969566*b);
  const s=Math.cbrt(0.0883024619*r+0.2817188376*gg+0.6299787005*b);
  return [0.2104542553*l+0.7936177850*m-0.0040720468*s,
          1.9779984951*l-2.4285922050*m+0.4505937099*s,
          0.0259040371*l+0.7827717662*m-0.8086757660*s];
}
export function oklab2rgb([L,a,b]){
  const l=(L+0.3963377774*a+0.2158037573*b)**3;
  const m=(L-0.1055613458*a-0.0638541728*b)**3;
  const s=(L-0.0894841775*a-1.2914855480*b)**3;
  return [f(+4.0767416621*l-3.3077115913*m+0.2309699292*s),
          f(-1.2684380046*l+2.6097574011*m-0.3413193965*s),
          f(-0.0041960863*l-0.7034186147*m+1.7076147010*s)];
}
export const oklab2lch=([L,a,b])=>[L, Math.hypot(a,b), (Math.atan2(b,a)*180/Math.PI+360)%360];
export const lch2oklab=([L,C,H])=>[L, C*Math.cos(H*Math.PI/180), C*Math.sin(H*Math.PI/180)];
const inGamut=rgb=>rgb.every(v=>v>=-0.001&&v<=1.001);
/** Réduit la chroma jusqu'à ce que la couleur soit affichable. */
export function lch2hex(L,C,H){
  let lo=0,hi=C;
  if(inGamut(oklab2rgb(lch2oklab([L,C,H])))) return rgb2hex(oklab2rgb(lch2oklab([L,C,H])));
  for(let i=0;i<40;i++){const mid=(lo+hi)/2;
    if(inGamut(oklab2rgb(lch2oklab([L,mid,H])))) lo=mid; else hi=mid;}
  return rgb2hex(oklab2rgb(lch2oklab([L,lo,H])));
}
