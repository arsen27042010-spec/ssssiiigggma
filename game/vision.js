import { ownRegions, tradeRoute } from './world.js';
export function visibility(m, id) {
  const seen=new Set();
  const reveal=(region, radius=1)=>{seen.add(region);if(radius)for(const n of m.regions[region].neighbors){seen.add(n);if(radius>1)reveal(n,radius-1);}};
  for(const r of ownRegions(m,id))reveal(r.id);
  for(const u of m.units.filter(u=>u.owner===id))reveal(u.region,u.type==='scout'?2:1);
  for(const s of (m.shipments||[]).filter(s=>s.buyer===id||s.seller===id))if(s.status==='moving')reveal(s.region,0);
  return seen;
}
export function updateObservations(m) {
  for(const c of m.countries)for(const id of visibility(m,c.id)) {
    const r=m.regions[id]; c.observations[id]={owner:r.owner,terrain:r.terrain,buildings:r.buildings.map(b=>({id:b.id,type:b.type})),time:m.time};
  }
}
export function playerSnapshot(m,id) {
  const c=m.countries.find(c=>c.id===id); if(!c)throw new Error('Страна не найдена');
  const visible=visibility(m,id);
  return {
    id:m.id, time:m.time, duration:m.duration, speed:m.speed, status:m.status, host:m.host, player:id, result:m.result,
    countries:m.countries.map(x=>x.id===id ? structuredClone(Object.fromEntries(Object.entries(x).filter(([k])=>!['observations','receipts','secret'].includes(k)))) : {id:x.id,name:x.name,color:x.color,eliminated:!ownRegions(m,x.id).length,estimate: m.status==='finished'?x.average:null}),
    regions:m.regions.map(r=>{
      const o=c.observations[r.id], base={id:r.id,name:r.name,q:r.q,r:r.r,neighbors:r.neighbors,known:!!o,visible:visible.has(r.id)};
      if(r.owner===id)return {...structuredClone(r),...base,lastSeen:m.time};
      if(!o)return base;
      return {...base,owner:o.owner,terrain:o.terrain,buildings:o.buildings,lastSeen:o.time,...(visible.has(r.id)&&r.construction?.kind==='expansion'?{construction:structuredClone(r.construction)}:{})};
    }),
    units:m.units.filter(u=>u.owner===id||visible.has(u.region)).map(u=>u.owner===id?structuredClone(u):{id:u.id,owner:u.owner,type:u.type,region:u.region,hp:u.hp}),
    offers:m.offers.filter(o=>o.status==='open').map(o=>({...o,delivery:o.seller===id?null:tradeRoute(m,o.seller,id)})),
    shipments:m.shipments.filter(s=>s.buyer===id||s.seller===id).map(s=>({...s})),
    events:m.events.filter(e=>e.owner===id||e.owner===null).slice(-40),
    messages:m.messages.filter(x=>x.from===id||x.to===id).slice(-40),
  };
}
