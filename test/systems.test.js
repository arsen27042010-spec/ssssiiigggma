import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, joinMatch, command, tick, snapshot } from '../game/engine.js';
import { logisticsTick } from '../game/logistics.js';
import { militaryTick } from '../game/military.js';
import { updateObservations, visibility } from '../game/vision.js';
let n=0;
const send=(m,c,type,data={})=>command(m,c.id,{id:`sys-${++n}`,type,...data});
function setup(){const m=createMatch();const a=joinMatch(m,'А');const b=joinMatch(m,'Б');send(m,a,'start');return [m,a,b];}
test('trade escrows stock and funds, then pays seller only after delivery',()=>{
 const [m,a,b]=setup();send(m,a,'offer',{resource:'food',amount:12,price:3});const moneyA=a.stock.money,moneyB=b.stock.money,foodA=a.stock.food,foodB=b.stock.food;
 send(m,b,'buy',{offer:m.offers[0].id});assert.equal(a.stock.money,moneyA);assert.equal(b.stock.money,moneyB-36);assert.equal(a.stock.food,foodA-12);
 for(let i=0;i<500;i++){m.time++;logisticsTick(m);}
 assert.equal(a.stock.money,moneyA+36);assert.equal(b.stock.food,foodB+12);assert.ok(m.shipments.every(s=>s.status==='delivered'));
});
test('partially delivered order refunds only intercepted remaining parcels',()=>{
 const [m,a,b]=setup();send(m,a,'offer',{resource:'metal',amount:12,price:5});const ma=a.stock.money,mb=b.stock.money;
 send(m,b,'buy',{offer:m.offers[0].id});assert.equal(m.shipments.length,3);
 const first=m.shipments[0];first.region=first.destination;first.path=[first.destination];logisticsTick(m);
 assert.equal(a.stock.money,ma+20);
 for(const s of m.shipments.filter(s=>s.status==='moving')) {s.region=2;m.units.push({id:++m.sequence,owner:a.id,type:'infantry',region:2,hp:100,supply:30,controller:'player',order:{kind:'attack',target:2},progress:0});}
 logisticsTick(m);assert.equal(a.stock.money,ma+20);assert.equal(b.stock.money,mb-20);
 assert.equal(m.shipments.filter(s=>s.status==='destroyed').length,2);
});
test('blocked convoy pauses and automatically resumes on an available route',()=>{
 const [m,a,b]=setup();send(m,a,'offer',{resource:'food',amount:3,price:2});send(m,b,'buy',{offer:m.offers[0].id});
 const s=m.shipments[0];const original=m.regions[s.region].neighbors;m.regions[s.region].neighbors=[];m.time=10;logisticsTick(m);assert.equal(s.status,'delayed');
 m.regions[s.region].neighbors=original;for(let i=0;i<300;i++){m.time++;logisticsTick(m);}assert.equal(s.status,'delivered');
});
test('manual order takes control from general and general cannot replace it',()=>{
 const [m,a]=setup();const u=m.units.find(u=>u.owner===a.id);
 send(m,a,'general',{general:0,zone:[0,1,8],targets:[],task:'hold',budget:40,mode:'auto'});
 send(m,a,'assign',{unit:u.id,general:0});assert.equal(u.controller,0);
 send(m,a,'order',{unit:u.id,target:1,kind:'move'});assert.equal(u.controller,'player');
 militaryTick(m);assert.equal(u.order.target,1);
});
test('general budgets and zones validated atomically, territory cannot belong to two generals',()=>{
 const [m,a]=setup();send(m,a,'general',{general:0,zone:[0,1],targets:[],task:'hold',budget:40,mode:'auto'});
 const money=a.stock.money;assert.throws(()=>send(m,a,'general',{general:1,zone:[1],targets:[],task:'hold',budget:20,mode:'auto'}));assert.equal(a.stock.money,money);
 assert.throws(()=>send(m,a,'general',{general:1,zone:[8],targets:[47],task:'attack',budget:20,mode:'auto'}));
});
test('hidden attack target rejected and enemy units disappear after observation is lost',()=>{
 const [m,a,b]=setup();const u=m.units.find(u=>u.owner===a.id);assert.throws(()=>send(m,a,'order',{unit:u.id,target:b.capital,kind:'attack'}));
 const enemy=m.units.find(u=>u.owner===b.id);enemy.region=2;tick(m,1);assert.ok(snapshot(m,a.id).units.some(x=>x.id===enemy.id));
 enemy.region=47;tick(m,1);assert.ok(!snapshot(m,a.id).units.some(x=>x.id===enemy.id));
});
test('cut supply drains local reserves gradually',()=>{
 const [m,a]=setup();const u=m.units.find(u=>u.owner===a.id);u.region=35;u.supply=30;
 militaryTick(m);assert.equal(u.supply,29);for(let i=0;i<40;i++)militaryTick(m);assert.equal(u.supply,0);assert.ok(m.units.includes(u));
});
test('unopposed invasion takes time then captures territory with recovery',()=>{
 const [m,a,b]=setup();const r=m.regions[2];r.owner=b.id;const u=m.units.find(u=>u.owner===a.id);u.region=1;
 send(m,a,'order',{unit:u.id,target:2,kind:'attack'});tick(m,1);assert.equal(r.owner,b.id);tick(m,35);assert.equal(r.owner,a.id);assert.ok(r.recovery>m.time);
});
test('capital loss does not eliminate country; total conquest ignores neutral territory',()=>{
 const [m,a,b]=setup();m.regions[b.capital].owner=a.id;tick(m,1);assert.equal(m.status,'playing');
 for(const r of m.regions)if(r.owner===b.id)r.owner=a.id;tick(m,1);assert.equal(m.status,'finished');assert.equal(m.result.reason,'conquest');assert.deepEqual(m.result.winners,[a.id]);
});
test('recruitment consumes equipment and respects population capacity',()=>{
 const [m,a]=setup();const before=a.stock.tanks;send(m,a,'recruit',{region:a.capital,unitType:'tank'});assert.equal(a.stock.tanks,before-1);assert.ok(m.units.some(u=>u.type==='tank'));
 a.stock.money=100000;a.stock.weapons=100000;for(const r of m.regions)if(r.owner===a.id)r.population=10;
 assert.throws(()=>send(m,a,'recruit',{region:a.capital,unitType:'infantry'}));
});
test('identical observations produce identical route acceptance despite hidden ownership changes',()=>{
 const [m,a,b]=setup();const scout=m.units.find(u=>u.owner===a.id&&u.type==='scout');scout.region=47;
 for(const r of m.regions)a.observations[r.id]={owner:r.owner,terrain:r.terrain,buildings:[],time:0};updateObservations(m);
 const clone=structuredClone(m),seen=visibility(m,a.id);
 for(const r of clone.regions)if(!seen.has(r.id))r.owner=b.id;
 assert.deepEqual(snapshot(m,a.id),snapshot(clone,a.id));
 const cmd={id:'route-proof',type:'order',unit:m.units.find(u=>u.owner===a.id&&u.type==='infantry').id,kind:'move',target:47};
 assert.doesNotThrow(()=>command(m,a.id,cmd));assert.doesNotThrow(()=>command(clone,a.id,cmd));
});
test('revoking a general target prevents an already started capture',()=>{
 const [m,a]=setup();const u=m.units.find(u=>u.owner===a.id&&u.type==='infantry');
 send(m,a,'general',{general:0,zone:[0,1,8],targets:[9],task:'attack',budget:0,mode:'auto'});send(m,a,'assign',{unit:u.id,general:0});
 tick(m,16);assert.equal(u.region,9);
 send(m,a,'general',{general:0,zone:[0,1,8],targets:[],task:'hold',budget:0,mode:'auto'});tick(m,20);
 assert.equal(m.regions[9].owner,null);
});
test('escorts protect cargo while battle is unresolved',()=>{
 const [m,a,b]=setup();send(m,a,'offer',{resource:'food',amount:12,price:3});send(m,b,'buy',{offer:m.offers[0].id});
 for(const s of m.shipments)s.region=2;
 m.units.push({id:++m.sequence,owner:a.id,type:'scout',region:2,hp:100,supply:30,controller:'player',order:{kind:'attack',target:2},progress:0});
 m.units.push({id:++m.sequence,owner:b.id,type:'tank',region:2,hp:100,supply:30,controller:'player',order:null,progress:0});
 militaryTick(m);logisticsTick(m);assert.ok(m.shipments.every(s=>s.status==='delayed'&&s.escrow>0));
});
test('buyer sees route estimate before buying and can reroute an active shipment via observed land',()=>{
 const [m,a,b]=setup();send(m,a,'offer',{resource:'food',amount:12,price:3});
 const offer=snapshot(m,b.id).offers[0];assert.ok(offer.delivery.eta>0);assert.equal(offer.delivery.path[0],a.capital);
 send(m,b,'buy',{offer:m.offers[0].id});const s=m.shipments[0];
 send(m,a,'reroute',{shipment:s.id,via:8});
 for(let i=0;i<9;i++){m.time++;logisticsTick(m);}assert.equal(s.region,8);
 assert.throws(()=>send(m,a,'reroute',{shipment:s.id,via:47}));
});
