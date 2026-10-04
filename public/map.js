import { COLORS } from './catalog.js';
export const center = r => [142 + r.q * 87 + (r.r % 2) * 43.5, 117 + r.r * 75];
const points = (r,dy=0) => {const [x,y]=center(r);return Array.from({length:6},(_,i)=>{const a=(i*60-30)*Math.PI/180;return `${x+50*Math.cos(a)},${y+dy+50*Math.sin(a)}`;}).join(' ');};
export function previewRegions(){return Array.from({length:48},(_,id)=>({id,q:id%8,r:Math.floor(id/8),name:'',known:true,visible:true,owner:null,terrain:(id%8===0||id%8===7||id<8||id>39)?'coast':id%5===0?'mountain':id%3===0?'forest':'plain',buildings:[]}));}
const defs=`<defs>
 <pattern id="water" width="42" height="38" patternUnits="userSpaceOnUse"><path d="M6 15q8-4 16 0m5 18q6-3 12 0" stroke="#a9cbd1" stroke-width=".7" fill="none" opacity=".65"/></pattern>
 <pattern id="fog" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" stroke="#93a7a5" stroke-width=".5" opacity=".25"/></pattern>
 <filter id="land-shadow" x="-15%" y="-15%" width="130%" height="145%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#406575" flood-opacity=".2"/></filter>
 <symbol id="tree" viewBox="0 0 22 32"><path d="M10 22v9h3V21" fill="#7c8060"/><path d="M11 0L1 18h4L0 25h22l-5-7h4z" fill="#63856b"/><path d="M11 0v25h11l-5-7h4z" fill="#527761"/></symbol>
 <symbol id="mountain" viewBox="0 0 48 38"><path d="M1 36L24 1l23 35z" fill="#9ba99d"/><path d="M24 1L20 36h27z" fill="#7f9289"/><path d="M24 1l-8 12 7-2 4 6 4-4z" fill="#f3f4e9"/></symbol>
 <symbol id="town" viewBox="0 0 50 46"><path d="M2 27l22-12 25 12-23 14z" fill="#b4b7a0" opacity=".5"/><path d="M10 18l12-7 13 7v17l-13 7-12-7z" fill="#ded5b9"/><path d="M22 25l13-7v17l-13 7z" fill="#acb4a6"/><path d="M10 18l12-14 13 14-13 7z" fill="#718c89"/><path d="M22 4v21l13-7z" fill="#4f6f72"/><path d="M14 26v5m5-2v5" stroke="#6e8a8b" stroke-width="2"/><path d="M27 29v8" stroke="#567474" stroke-width="3"/></symbol>
 <symbol id="factory" viewBox="0 0 52 46"><path d="M4 24l22-13 23 13v12L26 48 4 36z" fill="#bbc3b4"/><path d="M26 36l23-12v12L26 48z" fill="#8c9e96"/><path d="M4 24l22-13 23 13-23 12z" fill="#e1e4d5"/><path d="M12 23V5l7-4v19z" fill="#7d928e"/><path d="M19 1l5 3v18l-5-2z" fill="#a6b4aa"/><path d="M30 35v5m7-9v5m7-9v5" stroke="#52716e" stroke-width="3"/></symbol>
 </defs>`;
export function renderMap(state,{selected,layer='territory',zoom=1,orderUnit=null}={}) {
 const regions=state?.regions??previewRegions(),countries=state?.countries??[],player=state?.player;
 const me=countries.find(c=>c.id===player), byId=Object.fromEntries(countries.map(c=>[c.id,c]));
 const terrainColor={plain:'#e4ead8',forest:'#c8d8be',mountain:'#d5ddce',coast:'#e8e5d0'};
 let html=`<svg id="world-map" viewBox="0 0 1020 660" role="group" aria-label="Карта областей. Нажмите область для выбора.">${defs}<rect width="1020" height="660" fill="#c9dfe3"/><rect width="1020" height="660" fill="url(#water)"/><g class="map-geography" transform="translate(${510*(1-zoom)},${330*(1-zoom)}) scale(${zoom})"><g fill="#edf2e7" stroke="#e6eee4" stroke-width="18" stroke-linejoin="round" opacity=".8">${regions.map(r=>`<polygon points="${points(r,5)}"/>`).join('')}</g><g filter="url(#land-shadow)">${regions.map(r=>`<polygon points="${points(r,6)}" fill="#a8bca9"/>`).join('')}</g>`;
 for(const r of regions){
  const [x,y]=center(r),owner=byId[r.owner],isSelected=selected===r.id;
  let fill=r.known?terrainColor[r.terrain]:'#b3c4bf';
  if(layer==='economy'&&r.owner===player)fill=r.buildings?.some(b=>b.status&&b.status!=='Работает')?'#e3ceb0':'#bfd8b7';
  if(layer==='supply'&&r.owner===player)fill=r.buildings?.some(b=>b.type==='warehouse')||me.capital===r.id?'#a5d7d0':'#d7e0d4';
  const general=me?.generals.find(g=>g.zone.includes(r.id));
  if(layer==='generals'&&general)fill=['#c6d9e8','#d8d1e7','#e4d6af'][general.id];
  html+=`<g class="region ${isSelected?'selected':''} ${r.visible?'':'unseen'}" data-region="${r.id}" role="button" tabindex="${state?0:-1}" aria-label="${r.name||'Область'}${r.known?'':', не разведана'}" aria-pressed="${isSelected}"><polygon class="region-shape" points="${points(r)}" fill="${fill}" stroke="${isSelected?'#d49d42':owner?.color??'#a7b9a1'}" stroke-width="${isSelected?3.5:owner?1.8:.8}"/>`;
  if(r.known&&owner)html+=`<polygon points="${points(r)}" fill="${owner.color}" opacity=".13" pointer-events="none"/>`;
  if(!r.known){html+=`<polygon points="${points(r)}" fill="url(#fog)"/><text x="${x}" y="${y+5}" class="fog-mark">· · ·</text>`;}
  else {
   if(r.terrain==='forest')for(const [dx,dy,h]of[[-25,-20,28],[-12,-30,31],[15,-22,24]])html+=`<use href="#tree" x="${x+dx}" y="${y+dy}" width="${h*.7}" height="${h}" pointer-events="none"/>`;
   if(r.terrain==='mountain')html+=`<use href="#mountain" x="${x-24}" y="${y-29}" width="48" height="38" pointer-events="none"/>`;
   if(r.owner)html+=`<use href="#town" x="${x-21}" y="${y-28}" width="38" height="36" pointer-events="none"/>`;
   if(r.buildings?.length)html+=`<use href="#factory" x="${x+5}" y="${y-22}" width="28" height="30" pointer-events="none"/>`;
   if(r.owner===player&&me.capital===r.id)html+=`<text x="${x}" y="${y-34}" class="capital-mark">★</text>`;
   if(r.construction)html+=`<circle cx="${x+29}" cy="${y-15}" r="7" fill="#d8a85b"/><text x="${x+29}" y="${y-12}" class="construction-mark">+</text>`;
   if(layer==='generals'&&general)html+=`<text x="${x}" y="${y+8}" class="region-label">${general.name}</text>`;
   else if(r.name)html+=`<text x="${x}" y="${y+26}" class="region-label">${r.name.length>15?r.name.slice(0,14)+'…':r.name}</text>`;
   if(layer==='intelligence'&&!r.visible)html+=`<text x="${x}" y="${y+11}" class="age-label">${state.time-r.lastSeen} с назад</text>`;
  }
  html+='</g>';
 }
 for(const s of state?.shipments??[])if(['moving','delayed'].includes(s.status)){
  const [x,y]=center(regions[s.region]);
  if(s.path?.length>1)html+=`<polyline points="${s.path.map(id=>center(regions[id]).join(',')).join(' ')}" class="trade-route"/>`;
  html+=`<g class="convoy"><rect x="${x-7}" y="${y+5}" width="14" height="9" rx="2" fill="#9e773d"/><circle cx="${x-4}" cy="${y+16}" r="2" fill="#3a4f52"/><circle cx="${x+4}" cy="${y+16}" r="2" fill="#3a4f52"/></g>`;
 }
 const count={};for(const u of state?.units??[]){const [x,y]=center(regions[u.region]);const offset=(count[u.region]??0)*19;count[u.region]=(count[u.region]??0)+1;
  if(u.owner===player&&u.order){const [tx,ty]=center(regions[u.order.target]);html+=`<path d="M${x},${y}L${tx},${ty}" class="unit-route ${u.order.kind==='attack'?'attack-route':''}"/>`;}
  html+=`<g class="unit-marker" data-unit="${u.id}" role="button" tabindex="0" aria-label="Отряд ${u.id}"><rect x="${x-24+offset}" y="${y+2}" width="18" height="17" rx="4" fill="${byId[u.owner]?.color??'#777'}" stroke="${orderUnit===u.id?'#eac077':'#f8faf7'}" stroke-width="${orderUnit===u.id?3:1.5}"/><path d="M${x-20+offset} ${y+6}l10 9m0-9l-10 9" stroke="white" stroke-width="1.2"/></g>`;
 }
 html+=`<text x="850" y="455" class="sea-label" transform="rotate(-90 850 455)">ВОСТОЧНОЕ МОРЕ</text><text x="345" y="589" class="sea-label">ЛАЗУРНЫЙ ЗАЛИВ</text><g transform="translate(900 92)" class="compass"><path d="M0-30l8 30-8-7-8 7z" fill="#5d7d87"/><path d="M0 30l8-30-8 7-8-7z" fill="#96b3b9"/><text y="-39" text-anchor="middle">С</text></g></g><text x="38" y="624" class="map-scale">0 ─────── 100 км</text></svg>`;
 return html;
}
