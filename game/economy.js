import { BUILDINGS, RESOURCES, UNIT_TYPES } from '../public/catalog.js';
import { ownRegions, addEvent } from './world.js';
export const canPay = (stock, cost) => Object.entries(cost).every(([key,value]) => stock[key] >= value);
export function pay(stock, cost, multiplier = 1) { for (const [key,value] of Object.entries(cost)) stock[key] -= value * multiplier; }
export const valueOf = amounts => Object.entries(amounts).reduce((n,[k,v]) => n + RESOURCES[k].value * v, 0);
export function capacities(m, c) {
  const rs = ownRegions(m,c.id);
  const army = m.units.filter(u=>u.owner===c.id).reduce((n,u)=>n+UNIT_TYPES[u.type].people,0);
  return { workers: Math.max(0,rs.reduce((n,r)=>n+r.population*.6,0)-army), energy: rs.length*3, employed: 0, usedEnergy: 0 };
}
export function economicTick(m) {
  for (const c of m.countries) {
    let output = 0; const rs = ownRegions(m,c.id), cap = capacities(m,c);
    const before = { ...c.stock };
    const capitalFactor = rs.some(r=>r.id===c.capital) ? 1 : .75;
    for (const r of rs) {
      const shortage = c.stock.food < r.population*.012;
      const target = shortage ? 25 : c.tax === 'high' ? 48 : c.tax === 'low' ? 90 : 75;
      r.happiness += Math.sign(target-r.happiness)*Math.min(.5,Math.abs(target-r.happiness));
      const growth = shortage || r.happiness<50 ? -.15 : (c.tax==='low'?.22:.1);
      if (growth<0 || (r.population<180 && c.stock.materials >= .1)) { r.population = Math.max(10,Math.min(180,r.population+growth)); if(growth>0)c.stock.materials-=.1; }
      for(const key of Object.keys(r.specialization)) r.specialization[key] = Math.max(0,Math.min(1,r.specialization[key]+(r.priority===key?.02:-.01)));
      r.development = Math.min(2.5,r.development+(r.happiness>=60?.001:0));
      const efficiency = (r.recovery>m.time?.4:1)*capitalFactor * Math.min(1,cap.workers / Math.max(1,rs.reduce((n,x)=>n+x.population*.6,0)));
      const food = (r.terrain==='plain'?3.6:2.6)*(1+r.specialization.agriculture)*r.development*efficiency;
      const materials = (r.terrain==='forest'?2:1)*(1+r.specialization.industry)*r.development*efficiency;
      c.stock.food += food; c.stock.materials += materials;
      output += food*2+materials*3+(2+r.specialization.trade*5)*efficiency;
      c.stock.food = Math.max(0,c.stock.food-r.population*.012);
      cap.employed += r.population*.2;
    }
    const plants = rs.flatMap(r=>r.buildings.map(b=>({r,b}))).sort((x,y)=>(y.b.type==='power')-(x.b.type==='power'));
    for (const {r,b} of plants) {
      const d=BUILDINGS[b.type]; b.status='Работает';
      if (cap.employed+d.workers>cap.workers) b.status='Не хватает работников';
      else if (cap.usedEnergy+d.energy>cap.energy) b.status='Не хватает электроэнергии';
      else if (!canPay(c.stock,d.input)) b.status='Не хватает сырья: '+Object.keys(d.input).filter(k=>c.stock[k]<d.input[k]).map(k=>RESOURCES[k].name.toLowerCase()).join(', ');
      if(b.status!=='Работает')continue;
      cap.employed+=d.workers; cap.usedEnergy+=d.energy;
      pay(c.stock,d.input);
      const eff=(r.recovery>m.time?.4:1)*capitalFactor;
      for(const [key,amount] of Object.entries(d.output)) c.stock[key]+=amount*eff;
      cap.energy+=(d.power||0)*eff;
      output += valueOf(d.output)*eff-valueOf(d.input);
    }
    c.gdp=output*12;
    c.stock.money+=Math.max(0,output)*({low:.15,normal:.25,high:.4}[c.tax]);
    for(const u of m.units.filter(u=>u.owner===c.id)) c.stock.money=Math.max(0,c.stock.money-UNIT_TYPES[u.type].upkeep);
    c.history.push({time:m.time,value:c.gdp}); c.history=c.history.filter(h=>h.time>m.time-300);
    c.average=c.history.reduce((n,h)=>n+h.value,0)/Math.max(1,c.history.length);
    c.capacity=cap; c.delta=Object.fromEntries(Object.keys(c.stock).map(k=>[k,(c.stock[k]-before[k]-(c.supplyConsumption?.[k]||0))*12]));c.supplyConsumption={ammo:0,fuel:0};
  }
}
export function constructionTick(m) {
  for(const r of m.regions) if(r.construction && r.construction.finish<=m.time) {
    const x=r.construction; r.construction=null;
    if(x.kind==='expansion') { if(r.owner!==null) continue; r.owner=x.owner; r.population=45; r.recovery=m.time+20; addEvent(m,x.owner,`${r.name}: область освоена`,'success'); }
    else if(r.owner===x.owner) {r.buildings.push({id:++m.sequence,type:x.building,status:'Запуск'});addEvent(m,r.owner,`${r.name}: ${BUILDINGS[x.building].name} построен`,'success');}
  }
}
