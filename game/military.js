import { BUILDINGS, UNIT_TYPES } from '../public/catalog.js';
import { route, ownRegions, country, addEvent } from './world.js';
import { canPay, pay, capacities } from './economy.js';
import { visibility } from './vision.js';
import { requireThat, owned, purchase, positive } from './commands.js';

function getUnit(m,c,id){const u=m.units.find(u=>u.id===id&&u.owner===c.id);requireThat(u,'Отряд не найден');return u;}
export function orderAuthorized(m,u) {
  if(!u.order)return false;
  if(u.controller==='player')return true;
  const g=country(m,u.owner).generals[u.controller];
  return g.mode==='manual'||g.zone.includes(u.order.target)||(g.task==='attack'&&g.targets.includes(u.order.target));
}
function recruitsAvailable(m,c,type) {
  const cap=capacities(m,c), civilians=ownRegions(m,c.id).reduce((n,r)=>n+r.population*.2,0);
  return cap.workers-civilians>=UNIT_TYPES[type].people;
}
function recruit(m,c,region,type) {
  const u={id:++m.sequence,owner:c.id,type,region,hp:100,supply:30,controller:'player',order:null,progress:0};m.units.push(u);return u;
}
export function militaryCommand(m,c,a) {
  if(a.type==='recruit') {
    owned(m,c,a.region);requireThat(Object.hasOwn(UNIT_TYPES,a.unitType),'Неизвестный тип отряда');
    requireThat(recruitsAvailable(m,c,a.unitType),'Недостаточно свободных людей');requireThat(m.units.filter(u=>u.owner===c.id).length<40,'Лимит 40 отрядов');
    purchase(c,UNIT_TYPES[a.unitType].cost);recruit(m,c,a.region,a.unitType);return true;
  }
  if(a.type==='order') {
    const u=getUnit(m,c,a.unit);requireThat(['move','attack','stop'].includes(a.kind),'Неизвестный приказ');
    if(a.kind==='stop'){u.order=null;u.controller='player';u.progress=0;return true;}
    requireThat(Number.isInteger(a.target)&&m.regions[a.target]&&visibility(m,c.id).has(a.target),'Цель сейчас не наблюдается');
    requireThat(a.kind==='attack'||[null,c.id].includes(m.regions[a.target].owner),'В чужую область нужен приказ атаки');
    const path=route(m,u.region,a.target,r=>!!c.observations[r.id]&&([null,c.id].includes(c.observations[r.id].owner)||(r.id===a.target&&a.kind==='attack')));
    requireThat(path,'Нет известного доступного пути');u.controller='player';u.order={kind:a.kind,target:a.target};u.progress=0;return true;
  }
  if(a.type==='assign') {
    const u=getUnit(m,c,a.unit);requireThat(a.general==='player'||(Number.isInteger(a.general)&&c.generals[a.general]),'Генерал не найден');
    if(a.general!=='player')requireThat(c.generals[a.general].zone.includes(u.region),'Отряд должен находиться в зоне генерала');u.controller=a.general;return true;
  }
  if(a.type==='general') {
    const g=c.generals[a.general];requireThat(Number.isInteger(a.general)&&g,'Генерал не найден');
    requireThat(['manual','auto'].includes(a.mode)&&['hold','protect','attack'].includes(a.task),'Проверьте задачу генерала');
    requireThat(Array.isArray(a.zone)&&a.zone.length<=48&&a.zone.every(id=>Number.isInteger(id)&&m.regions[id]?.owner===c.id),'Зона должна состоять из ваших областей');
    requireThat(!a.zone.some(id=>c.generals.some(x=>x!==g&&x.zone.includes(id))),'Область уже назначена другому генералу');
    const seen=visibility(m,c.id);
    requireThat(Array.isArray(a.targets)&&a.targets.length<=48&&a.targets.every(id=>Number.isInteger(id)&&seen.has(id)),'Цель наступления должна наблюдаться');
    requireThat(typeof a.budget==='number'&&Number.isFinite(a.budget)&&a.budget>=0&&a.budget<=10000,'Бюджет от 0 до 10 000');
    requireThat(c.stock.money+g.budget>=a.budget,'Недостаточно средств для бюджета');
    c.stock.money+=g.budget-a.budget;Object.assign(g,{mode:a.mode,task:a.task,zone:[...new Set(a.zone)],targets:[...new Set(a.targets)],budget:a.budget,status:'Приказ принят'});return true;
  }
  return false;
}
export function isSupplied(m,u) {
  const c=country(m,u.owner);
  const sources=ownRegions(m,u.owner).filter(r=>r.id===c.capital||r.buildings.some(b=>b.type==='warehouse'));
  return sources.some(s=>route(m,s.id,u.region,r=>r.owner===u.owner || (r.id===u.region&&r.neighbors.some(n=>m.regions[n].owner===u.owner))));
}
function generalsTick(m) {
  for(const c of m.countries)for(const g of c.generals) {
    if(g.mode!=='auto')continue;
    const seen=visibility(m,c.id), us=m.units.filter(u=>u.owner===c.id&&u.controller===g.id);
    const permitted=new Set([...g.zone,...(g.task==='attack'?g.targets:[])]);
    const threat=m.units.find(u=>u.owner!==c.id&&seen.has(u.region)&&g.zone.includes(u.region));
    const target=threat?.region??(g.task==='attack'?g.targets.find(id=>seen.has(id)&&m.regions[id].owner!==c.id):undefined);
    g.status=target!==undefined?'Выполняет приказ в разрешённой зоне':'Удерживает зону';
    for(const u of us) {
      if(!permitted.has(u.region)){g.status='Нужен приказ: отряд вне зоны';continue;}
      if(!u.order&&target!==undefined&&route(m,u.region,target,r=>permitted.has(r.id)&&seen.has(r.id)))u.order={kind:'attack',target};
      else if(!u.order&&g.task==='protect'&&g.zone.length&&u.region!==g.zone[0])u.order={kind:'move',target:g.zone[0]};
    }
    if(m.time%20===0&&us.length<2&&g.zone.length) {
      const region=g.zone.find(id=>m.regions[id].owner===c.id),d=UNIT_TYPES.infantry;
      if(region!==undefined&&g.budget>=d.cost.money&&canPay(c.stock,{weapons:5})&&recruitsAvailable(m,c,'infantry')&&m.units.filter(u=>u.owner===c.id).length<40) {
        g.budget-=d.cost.money;pay(c.stock,{weapons:5});const u=recruit(m,c,region,'infantry');u.controller=g.id;g.status='Пополнение заказано из бюджета';
      }else if(!us.length)g.status='Нужны войска или бюджет 60 ₽ и 5 оружия';
    }
    if(m.time%30===0&&g.task==='protect'&&g.budget>=100) {
      const r=m.regions[g.zone[0]];
      if(r?.owner===c.id&&!r.construction&&r.buildings.length<4&&!r.buildings.some(b=>b.type==='fort')&&canPay(c.stock,{materials:30})) {
        g.budget-=100;pay(c.stock,{materials:30});r.construction={kind:'building',owner:c.id,building:'fort',finish:m.time+BUILDINGS.fort.seconds};g.status='Строит укрепление из бюджета';
      }
    }
  }
}
export function militaryTick(m) {
  generalsTick(m);
  for(const u of m.units) {
    const c=country(m,u.owner), fuel=u.type==='tank'?.03:0;
    const supplied=isSupplied(m,u)&&c.stock.ammo>=.03&&c.stock.fuel>=fuel;
    if(supplied){u.supply=Math.min(30,u.supply+3);c.stock.ammo-=.03;c.stock.fuel-=fuel;c.supplyConsumption??={ammo:0,fuel:0};c.supplyConsumption.ammo+=.03;c.supplyConsumption.fuel+=fuel;}else u.supply=Math.max(0,u.supply-1);
    u.supplied=supplied;
    if(!u.order)continue;
    if(!orderAuthorized(m,u)){u.note='Приказ приостановлен: цель вне полномочий генерала';continue;}
    if(u.region===u.order.target)continue;
    const g=u.controller==='player'?null:c.generals[u.controller];
    const allowed=g&&g.mode==='auto'?new Set([...g.zone,...(g.task==='attack'?g.targets:[])]):null;
    const p=route(m,u.region,u.order.target,r=>!!c.observations[r.id]&&(!allowed||allowed.has(r.id))&&([null,c.id].includes(c.observations[r.id].owner)||(r.id===u.order.target&&u.order.kind==='attack')));
    if(!p||p.length<2){u.note='Маршрут недоступен';continue;}
    u.note=null;u.progress++;
    if(u.progress>=UNIT_TYPES[u.type].seconds*(u.supply>0?1:2)) {
      u.region=p[1];u.progress=0;
      if(u.order.kind==='attack'&&m.regions[u.region].owner&&m.regions[u.region].owner!==u.owner)addEvent(m,m.regions[u.region].owner,`${m.regions[u.region].name}: вторжение ${c.name}`,'danger');
      if(u.region===u.order.target&&u.order.kind==='move')u.order=null;
    }
  }
  const damage=new Map();
  for(const u of m.units) {
    const targets=m.units.filter(v=>v.owner!==u.owner&&v.region===u.region);
    if(!targets.length)continue;
    if(![u,...targets].some(v=>v.order?.kind==='attack'&&orderAuthorized(m,v)))continue;
    const d=UNIT_TYPES[u.type], strength=d.attack*(u.hp/100)*(u.supply>0?1:.3)*(country(m,u.owner).stock.money>0?1:.7);
    for(const v of targets) {
      const r=m.regions[v.region],defence=r.owner===v.owner?(r.terrain==='mountain'?1.4:1)*(r.buildings.some(b=>b.type==='fort')?1.6:1):1;
      damage.set(v.id,(damage.get(v.id)||0)+strength/targets.length/defence*.35);
    }
  }
  for(const u of m.units)u.hp-=damage.get(u.id)||0;
  for(const u of m.units.filter(u=>u.hp<=0))addEvent(m,u.owner,`${UNIT_TYPES[u.type].name}: отряд потерян в области ${m.regions[u.region].name}`,'danger');
  m.units=m.units.filter(u=>u.hp>0);
  const sieges=new Map();
  for(const u of m.units)if(u.order?.kind==='attack'&&orderAuthorized(m,u)&&u.region===u.order.target&&!m.units.some(v=>v.owner!==u.owner&&v.region===u.region)) {
    const r=m.regions[u.region];if(r.owner===u.owner){u.order=null;continue;}
    if(!sieges.has(r.id))sieges.set(r.id,u);
  }
  for(const [id,u] of sieges) {
    const r=m.regions[id];r.siege=(r.siege?.owner===u.owner?r.siege:{owner:u.owner,progress:0});r.siege.progress++;
    if(r.siege.progress>=12){const old=r.owner;r.owner=u.owner;r.population=Math.max(35,r.population);r.recovery=m.time+45;r.construction=null;r.siege=null;u.order=null;addEvent(m,u.owner,`${r.name}: область под вашим контролем. Восстановление 45 сек.`, 'success');if(old)addEvent(m,old,`${r.name}: область захвачена`,'danger');}
  }
  for(const r of m.regions)if(r.siege&&!sieges.has(r.id))r.siege=null;
}
