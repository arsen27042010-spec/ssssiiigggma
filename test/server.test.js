import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../server/app.js';

async function launch(dir){const app=createServer({dataDir:dir,autoTick:false});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));return {...app,url:`http://127.0.0.1:${app.server.address().port}`};}
const post=(app,path,body,token)=>fetch(app.url+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
test('HTTP creation, lobby, authorization, repeated commands and durable reconnect',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'country-test-'));let app=await launch(dir);
 try {
  let r=await post(app,'/api/matches',{name:'Тест',speed:1});assert.equal(r.status,201);const a=await r.json();
  r=await post(app,'/api/join',{code:a.code,name:'Сосед'});assert.equal(r.status,201);const b=await r.json();assert.notEqual(a.token,b.token);
  r=await fetch(app.url+'/api/state');assert.equal(r.status,401);
  r=await post(app,'/api/command',{id:'go',type:'start'},b.token);assert.equal(r.status,400);
  r=await post(app,'/api/command',{id:'go',type:'start'},a.token);assert.equal(r.status,200);
  const cmd={id:'tax-once',type:'tax',level:'high'};
  await post(app,'/api/command',cmd,a.token);await app.close();app=await launch(dir);
  r=await post(app,'/api/command',cmd,a.token);assert.equal(r.status,200);
  r=await fetch(app.url+'/api/state',{headers:{Authorization:`Bearer ${a.token}`}});const s=await r.json();
  assert.equal(s.countries.find(c=>c.id===s.player).tax,'high');assert.equal(s.countries.length,2);
  assert.ok(!JSON.stringify(s).includes(a.token));
 } finally {await app.close();await rm(dir,{recursive:true,force:true});}
});
test('HTTP rejects malformed JSON, bad speed, cross-origin commands and oversized requests',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'country-test-'));const app=await launch(dir);
 try {
  assert.equal((await post(app,'/api/matches',{name:'А',speed:100})).status,400);
  assert.equal((await fetch(app.url+'/api/matches',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
  assert.equal((await fetch(app.url+'/api/matches',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://elsewhere.test'},body:'{}'})).status,403);
  assert.equal((await post(app,'/api/matches',{name:'a'.repeat(20000)})).status,413);
  assert.equal((await fetch(app.url+'/server/store.js')).status,404);
 } finally {await app.close();await rm(dir,{recursive:true,force:true});}
});
