import test from 'node:test';
import assert from 'node:assert/strict';
import { project, unproject, regionAt, regionCenter, buildScene, unitRoute } from '../public/world-model.js';
import { createMatch,joinMatch,snapshot } from '../game/engine.js';

test('isometric projection and picking identify all 48 country regions',()=>{
 for(let id=0;id<48;id++){
  const p=regionCenter(id),screen=project(p.x,p.y),world=unproject(screen.x,screen.y);
  assert.ok(Math.abs(p.x-world.x)<.00001);assert.ok(Math.abs(p.y-world.y)<.00001);
  assert.equal(regionAt(world.x,world.y),id);
 }
 assert.equal(regionAt(-5,0),null);assert.equal(regionAt(1000,1000),null);
});
test('visual scene uses only observed land and never fabricates foreign buildings',()=>{
 const m=createMatch();const a=joinMatch(m,'А');const b=joinMatch(m,'Б');
 m.regions[b.capital].buildings.push({id:99,type:'armor'});
 const s=snapshot(m,a.id),scene=buildScene(s);
 assert.equal(scene.regions.length,48);
 assert.ok(scene.objects.some(o=>o.type==='house'&&o.region===a.capital));
 assert.ok(!scene.objects.some(o=>o.region===b.capital));
 assert.ok(scene.tiles.some(t=>t.kind==='fog'));
});
test('constructed factories keep their type and fixed position across economy updates',()=>{
 const m=createMatch();const a=joinMatch(m,'А');
 m.regions[a.capital].buildings.push({id:99,type:'refinery',status:'Работает'});
 const s=snapshot(m,a.id),scene=buildScene(s),building=scene.objects.find(o=>o.id==='building-99');
 assert.equal(building.type,'refinery');
 s.time=200;s.countries[0].stock.money+=20;s.regions[a.capital].population+=.3;
 const after=buildScene(s).objects.find(o=>o.id==='building-99');
 assert.deepEqual(after,building);
});

test('animated units avoid hostile transit and obey general permissions',()=>{
 const regions=[
  {id:0,known:true,owner:'a',neighbors:[1,2]},
  {id:1,known:true,owner:'b',neighbors:[0,3]},
  {id:2,known:true,owner:null,neighbors:[0,4]},
  {id:3,known:true,owner:null,neighbors:[1,4]},
  {id:4,known:true,owner:null,neighbors:[2,3]},
 ];
 const general={id:0,mode:'auto',task:'attack',zone:[0,2],targets:[4]};
 const state={player:'a',regions,countries:[{id:'a',generals:[general]}]};
 const unit={owner:'a',region:0,controller:'player',order:{kind:'move',target:3}};
 assert.deepEqual(unitRoute(state,unit),[0,2,4,3]);
 unit.order={kind:'attack',target:1};assert.deepEqual(unitRoute(state,unit),[0,1]);
 unit.controller=0;unit.order={kind:'attack',target:4};assert.deepEqual(unitRoute(state,unit),[0,2,4]);
 general.targets=[];assert.deepEqual(unitRoute(state,unit),[0]);
 unit.controller='player';regions[2].known=false;unit.order={kind:'move',target:3};assert.deepEqual(unitRoute(state,unit),[0]);
});
