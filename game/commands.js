import { BUILDINGS, PRIORITIES, RESOURCES } from '../public/catalog.js';
import { ownRegions, country, addEvent } from './world.js';
import { canPay, pay } from './economy.js';
import { visibility } from './vision.js';
export function requireThat(condition,message) { if(!condition)throw new Error(message); }
export const positive = (n,max=1000000) => typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=max;
export function owned(m,c,id) { const r=m.regions[id]; requireThat(Number.isInteger(id)&&r?.owner===c.id,'Выберите свою область'); return r; }
export function purchase(c,cost) { requireThat(canPay(c.stock,cost),'Недостаточно ресурсов');pay(c.stock,cost); }
export function economyCommand(m,c,a) {
  if(a.type==='start') {requireThat(m.status==='lobby'&&m.host===c.id,'Матч запускает организатор');m.status='playing';addEvent(m,null,'Матч начался. Развивайте страну и исследуйте соседние земли.','success');return true;}
  if(a.type==='capital') {requireThat(m.status==='lobby'&&c.capitalChoices.includes(a.region),'Столицу выбирают до старта');c.capital=a.region;return true;}
  requireThat(m.status==='playing','Матч ещё не начался или уже завершён');
  if(a.type==='tax') {requireThat(['low','normal','high'].includes(a.level),'Неизвестный налоговый режим');c.tax=a.level;return true;}
  if(a.type==='priority') {const r=owned(m,c,a.region);requireThat(Object.hasOwn(PRIORITIES,a.priority),'Неизвестный приоритет');r.priority=a.priority;return true;}
  if(a.type==='build') {
    const r=owned(m,c,a.region), d=BUILDINGS[a.building];requireThat(d&&Object.hasOwn(BUILDINGS,a.building),'Неизвестная постройка');
    requireThat(!r.construction,'В области уже идёт строительство');requireThat(r.buildings.length<4,'В области нет свободной земли (4 объекта)');
    requireThat(!d.terrain||d.terrain.includes(r.terrain),'Неподходящая местность');requireThat(!r.buildings.some(b=>b.type===a.building),'Этот объект уже построен');
    purchase(c,d.cost);r.construction={kind:'building',owner:c.id,building:a.building,finish:m.time+d.seconds};return true;
  }
  if(a.type==='expand') {
    const r=m.regions[a.region];requireThat(Number.isInteger(a.region)&&r&&visibility(m,c.id).has(r.id),'Область не наблюдается');
    requireThat(r.owner===null&&!r.construction,'Область уже занята');requireThat(r.neighbors.some(n=>m.regions[n].owner===c.id),'Нужна общая граница');
    purchase(c,{money:60,materials:30});r.construction={kind:'expansion',owner:c.id,finish:m.time+20};return true;
  }
  if(a.type==='transfer') {
    const to=country(m,a.to);requireThat(to&&to.id!==c.id&&positive(a.amount),'Укажите страну и положительную сумму');purchase(c,{money:a.amount});to.stock.money+=a.amount;addEvent(m,to.id,`${c.name}: перевод ${a.amount} ₽`);return true;
  }
  if(a.type==='offer') {
    requireThat(Object.hasOwn(RESOURCES,a.resource)&&a.resource!=='money'&&positive(a.amount,10000)&&positive(a.price,100000),'Проверьте товар, количество и цену');
    requireThat(c.stock[a.resource]>=a.amount,'Недостаточно товара');requireThat(m.offers.filter(o=>o.seller===c.id&&o.status==='open').length<12,'Не больше 12 открытых предложений');
    m.offers.push({id:++m.sequence,seller:c.id,resource:a.resource,amount:a.amount,price:a.price,status:'open'});return true;
  }
  if(a.type==='cancelOffer') {const o=m.offers.find(o=>o.id===a.offer&&o.seller===c.id&&o.status==='open');requireThat(o,'Предложение недоступно');o.status='cancelled';return true;}
  if(a.type==='chat') {requireThat(country(m,a.to)&&a.to!==c.id&&typeof a.text==='string'&&a.text.trim().length>0&&a.text.length<=400,'Сообщение: от 1 до 400 символов');m.messages.push({id:++m.sequence,from:c.id,to:a.to,text:a.text.trim(),time:m.time});if(m.messages.length>500)m.messages.shift();return true;}
  return false;
}
