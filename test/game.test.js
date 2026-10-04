import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, joinMatch, command, tick, snapshot } from '../game/engine.js';
import { route } from '../game/world.js';

let seq = 0;
export const send = (m, c, type, data = {}) => command(m, c.id ?? c, { id: `test-${++seq}`, type, ...data });
export function setup(players = 2) {
  const m = createMatch({ id: 'TEST', duration: 1800 });
  const cs = Array.from({ length: players }, (_, i) => joinMatch(m, `Страна ${i+1}`));
  send(m, cs[0], 'start');
  return [m, ...cs];
}
test('48 regions; six countries each have three connected regions and two capital choices', () => {
  const m = createMatch({ id: 'MAP' });
  assert.equal(m.regions.length, 48);
  for (let i = 0; i < 6; i++) {
    const c = joinMatch(m, `Игрок ${i}`);
    const owned = m.regions.filter(r => r.owner === c.id);
    assert.equal(owned.length, 3);
    assert.equal(c.capitalChoices.length, 2);
    assert.ok(route(m, owned[0].id, owned[2].id, r => r.owner === c.id));
  }
  assert.throws(() => joinMatch(m, 'Лишний'));
});
test('lobby waits for host; joining a running match fails', () => {
  const m = createMatch({ id: 'A' }); const a = joinMatch(m, 'А'); const b = joinMatch(m, 'Б');
  assert.throws(() => send(m, b, 'start'));
  tick(m, 10); assert.equal(m.time, 0);
  send(m, a, 'start'); assert.throws(() => joinMatch(m, 'В'));
});
test('same command reserves construction cost exactly once, including replay after serialization', () => {
  const [m, a] = setup(); const before = a.stock.money;
  const cmd = { id: 'same', type: 'build', region: a.capital, building: 'power' };
  command(m, a.id, cmd); const cost = before - a.stock.money; assert.ok(cost > 0);
  command(m, a.id, cmd); assert.equal(a.stock.money, before - cost);
  const restored = JSON.parse(JSON.stringify(m)); command(restored, a.id, cmd);
  assert.equal(restored.countries[0].stock.money, before - cost);
  tick(m, 35); assert.ok(m.regions[a.capital].buildings.some(b => b.type === 'power'));
});
test('invalid numbers, чужая область and insufficient funds cannot mutate match', () => {
  const [m, a, b] = setup();
  for (const amount of [NaN, Infinity, -1, 0, '100']) {
    assert.throws(() => send(m, a, 'transfer', { to: b.id, amount }));
  }
  assert.throws(() => send(m, a, 'build', { region: b.capital, building: 'power' }));
  a.stock.money = 0;
  assert.throws(() => send(m, a, 'build', { region: a.capital, building: 'power' }));
  assert.equal(m.regions[a.capital].construction, null);
});
test('transfers and market prices do not add GDP', () => {
  const [m, a, b] = setup(); tick(m, 5);
  const before = a.gdp;
  send(m, a, 'transfer', { to: b.id, amount: 100 });
  send(m, a, 'offer', { resource: 'food', amount: 5, price: 10000 });
  assert.equal(a.gdp, before);
});
test('base economy survives without trading and food grows for a normal-tax start', () => {
  const [m, a] = setup(1); const food = a.stock.food;
  tick(m, 120); assert.ok(a.stock.food > food); assert.ok(a.gdp > 0);
  assert.ok(m.regions[a.capital].population >= 100);
});
test('snapshots hide enemy stock, unseen buildings and troops, and session tokens', () => {
  const [m, a, b] = setup();
  b.secret = 'never-expose';
  const s = snapshot(m, a.id);
  const enemy = s.countries.find(c => c.id === b.id);
  assert.equal(enemy.stock, undefined);
  assert.equal(enemy.gdp, undefined);
  assert.equal(JSON.stringify(s).includes('never-expose'), false);
  assert.equal(s.regions[b.capital].buildings, undefined);
  assert.ok(!s.units.some(u => u.owner === b.id));
});
test('GDP at timeout uses last 300 seconds and immutable standings', () => {
  const [m, a, b] = setup();
  m.duration = 1801; m.time = 1800;
  a.history = [{ time: 1200, value: 99999 }, { time: 1500, value: 10 }, { time: 1795, value: 20 }];
  b.history = [{ time: 1795, value: 1 }];
  tick(m, 1); assert.equal(m.status, 'finished'); assert.equal(m.result.reason, 'economy');
  assert.deepEqual(m.result.winners, [a.id]);
  const result = JSON.stringify(m.result); tick(m, 100);
  assert.equal(JSON.stringify(m.result), result);
  assert.throws(() => send(m, a, 'tax', { level: 'high' }));
});
test('special object keys cannot bypass persisted command idempotency',()=>{
 const [m,a,b]=setup();const money=a.stock.money;
 const cmd={id:'__proto__',type:'transfer',to:b.id,amount:10};command(m,a.id,cmd);command(m,a.id,cmd);
 assert.equal(a.stock.money,money-10);
 const restored=JSON.parse(JSON.stringify(m));command(restored,a.id,cmd);assert.equal(restored.countries[0].stock.money,money-10);
});
test('displayed resource flow includes ammunition used continuously by supplied troops',()=>{
 const [m,a]=setup();tick(m,5);assert.ok(Math.abs(a.delta.ammo+3.6)<.00001);
});
test('neutral expansion is visible while underway and completes exactly once',()=>{
 const [m,a]=setup();send(m,a,'expand',{region:9});
 const view=snapshot(m,a.id).regions[9];assert.equal(view.construction.kind,'expansion');assert.equal(view.construction.owner,a.id);
 const money=a.stock.money;assert.throws(()=>send(m,a,'expand',{region:9}));assert.equal(a.stock.money,money);
 tick(m,20);assert.equal(m.regions[9].owner,a.id);assert.equal(m.regions[9].construction,null);
});
