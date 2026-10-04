import { route, country, ownRegions, addEvent } from './world.js';
import { requireThat, purchase } from './commands.js';
import { orderAuthorized } from './military.js';
import { visibility } from './vision.js';

export function tradeCommand(m,c,a) {
  if(a.type==='reroute') {
    const s=m.shipments.find(s=>s.id===a.shipment&&(s.buyer===c.id||s.seller===c.id)&&['moving','delayed'].includes(s.status));
    requireThat(s,'Доставка недоступна');requireThat(Number.isInteger(a.via)&&visibility(m,c.id).has(a.via),'Точка маршрута должна наблюдаться');
    requireThat(route(m,s.region,a.via)&&route(m,a.via,s.destination),'Нет сухопутного маршрута');s.via=a.via;s.progress=0;return true;
  }
  if(a.type!=='buy')return false;
  const o=m.offers.find(o=>o.id===a.offer&&o.status==='open');
  requireThat(o&&o.seller!==c.id,'Предложение недоступно');
  const seller=country(m,o.seller), source=ownRegions(m,seller.id).find(r=>r.id===seller.capital)??ownRegions(m,seller.id)[0];
  const destination=ownRegions(m,c.id).find(r=>r.id===c.capital)??ownRegions(m,c.id)[0];
  requireThat(source&&destination,'Нужна область отправления и назначения');
  requireThat(seller.stock[o.resource]>=o.amount,'У продавца больше нет этого количества товара');
  requireThat(m.shipments.filter(s=>s.seller===seller.id&&['moving','delayed'].includes(s.status)).length<=6,'Транспорт продавца занят');
  const path=route(m,source.id,destination.id);requireThat(path,'Нет сухопутного маршрута');
  purchase(c,{money:o.amount*o.price});seller.stock[o.resource]-=o.amount;o.status='accepted';
  for(let i=0;i<3;i++)m.shipments.push({id:++m.sequence,order:o.id,seller:seller.id,buyer:c.id,resource:o.resource,amount:o.amount/3,price:o.price,escrow:o.amount/3*o.price,region:source.id,destination:destination.id,path,status:'moving',progress:-i*4,eta:(path.length-1)*8+i*4});
  addEvent(m,seller.id,`${c.name} заказала ${o.amount} ед. товара. Конвой отправлен.`);return true;
}
export function logisticsTick(m) {
  for(const s of m.shipments) {
    if(!['moving','delayed'].includes(s.status))continue;
    const buyer=country(m,s.buyer),seller=country(m,s.seller);
    const hostile=m.units.some(u=>u.region===s.region&&u.owner!==s.buyer&&u.order?.kind==='attack'&&orderAuthorized(m,u));
    const escorted=m.units.some(u=>u.region===s.region&&(u.owner===s.buyer||(u.owner===s.seller&&u.order?.kind!=='attack')));
    if(hostile&&escorted){s.status='delayed';s.reason='Бой на маршруте: сопровождение защищает груз';continue;}
    if(hostile) {buyer.stock.money+=s.escrow;s.escrow=0;s.status='destroyed';s.reason='Конвой перехвачен';addEvent(m,buyer.id,'Конвой потерян. Оплата недоставленного товара возвращена.','danger');addEvent(m,seller.id,'Конвой перехвачен: груз потерян.','danger');continue;}
    if(m.regions[s.destination].owner!==s.buyer) {
      const dest=ownRegions(m,s.buyer)[0];
      if(!dest){buyer.stock.money+=s.escrow;s.escrow=0;s.status='destroyed';s.reason='Получатель потерял все области';continue;}
      s.destination=dest.id;
    }
    if(s.region===s.destination) {buyer.stock[s.resource]+=s.amount;seller.stock.money+=s.escrow;s.escrow=0;s.status='delivered';addEvent(m,buyer.id,`Доставлена партия: ${Number(s.amount.toFixed(1))} ед.`,'success');continue;}
    if(s.region===s.via)s.via=null;
    const known=new Set([...visibility(m,s.buyer),...visibility(m,s.seller)]);
    const blocked=new Set(m.units.filter(u=>known.has(u.region)&&u.owner!==s.buyer&&u.order?.kind==='attack'&&orderAuthorized(m,u)).map(u=>u.region));
    const allowed=r=>!blocked.has(r.id);
    let path=route(m,s.region,s.via??s.destination,allowed);
    if(path&&s.via!=null){const tail=route(m,s.via,s.destination,allowed);path=tail?[...path,...tail.slice(1)]:null;}
    if(!path){s.status='delayed';s.reason='Сухопутный маршрут перекрыт';continue;}
    s.status='moving';s.reason=null;s.path=path;s.progress++;
    if(s.progress>=8){s.region=path[1];s.progress=0;}
    s.eta=(path.length-1)*8-s.progress;
  }
}
