import { COLORS } from '../public/catalog.js';
import { createWorld, STARTS, ownRegions } from './world.js';
import { constructionTick, economicTick, capacities } from './economy.js';
import { updateObservations, playerSnapshot } from './vision.js';
import { economyCommand, requireThat } from './commands.js';
import { militaryCommand, militaryTick } from './military.js';
import { tradeCommand, logisticsTick } from './logistics.js';

export function createMatch({ id='LOCAL', speed=1, duration=1800 }={}) {
  return { id,speed,duration,time:0,status:'lobby',host:null,sequence:0,regions:createWorld(),countries:[],units:[],offers:[],shipments:[],messages:[],events:[],result:null };
}
export function joinMatch(m,name) {
  requireThat(m.status==='lobby','Матч уже начался');requireThat(m.countries.length<6,'Все шесть мест заняты');
  requireThat(typeof name==='string'&&name.trim().length>=1&&name.trim().length<=24,'Название страны: 1–24 символа');
  const i=m.countries.length, id=`c${i+1}`;
  const c={id,name:name.trim(),color:COLORS[i],capital:STARTS[i][0],capitalChoices:STARTS[i].slice(0,2),tax:'normal',stock:{money:900,food:150,materials:120,metal:40,fuel:40,weapons:20,tanks:2,ammo:60},gdp:0,average:0,history:[],delta:{},observations:{},receipts:{},generals:Array.from({length:3},(_,i)=>({id:i,name:['Север','Вектор','Рубеж'][i],mode:'manual',task:'hold',zone:[],targets:[],budget:0,status:'Ожидает назначения'}))};
  m.countries.push(c);if(!m.host)m.host=id;
  for(const region of STARTS[i]) {const r=m.regions[region];r.owner=id;r.population=100;}
  for(const type of ['infantry','scout'])m.units.push({id:++m.sequence,owner:id,type,region:c.capital,hp:100,supply:30,controller:'player',order:null,progress:0});
  c.capacity=capacities(m,c);updateObservations(m);return c;
}
export function command(m,id,a) {
  const c=m.countries.find(c=>c.id===id);requireThat(c,'Неизвестная страна');
  requireThat(a&&typeof a==='object'&&typeof a.id==='string'&&a.id.length>0&&a.id.length<=100,'Нужен идентификатор команды');
  const signature=JSON.stringify(a);
  if(Object.hasOwn(c.receipts,a.id)) {const prior=c.receipts[a.id];requireThat(prior.signature===signature,'Идентификатор уже использован для другой команды');return prior.result;}
  requireThat(m.status!=='finished','Матч завершён');
  requireThat(economyCommand(m,c,a)||militaryCommand(m,c,a)||tradeCommand(m,c,a),'Неизвестная команда');
  const result={ok:true};Object.defineProperty(c.receipts,a.id,{value:{signature,result},enumerable:true,writable:true,configurable:true});updateObservations(m);return result;
}
function finish(m,reason,winners) {
  const standings=m.countries.map(c=>({id:c.id,name:c.name,color:c.color,gdp:c.gdp,average:c.average,regions:ownRegions(m,c.id).length})).sort((a,b)=>b.average-a.average);
  m.status='finished';m.result={reason,winners,standings,time:m.time};
}
export function tick(m,seconds=1) {
  for(let i=0;i<seconds&&m.status==='playing';i++) {
    m.time++;constructionTick(m);militaryTick(m);logisticsTick(m);if(m.time%5===0)economicTick(m);updateObservations(m);
    const alive=m.countries.filter(c=>ownRegions(m,c.id).length>0);
    if(m.countries.length>1&&alive.length===1)finish(m,'conquest',[alive[0].id]);
    else if(m.time>=m.duration) {
      for(const c of m.countries){const hs=c.history.filter(h=>h.time>m.time-300);c.average=hs.reduce((n,h)=>n+h.value,0)/Math.max(1,hs.length);}
      const max=Math.max(...m.countries.map(c=>c.average));finish(m,'economy',m.countries.filter(c=>Math.abs(c.average-max)<.000001).map(c=>c.id));
    }
  }
}
export const snapshot=playerSnapshot;
