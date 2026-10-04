import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createMatch, joinMatch, command, tick, snapshot } from '../game/engine.js';
import { createStore } from './store.js';

const PUBLIC=fileURLToPath(new URL('../public/',import.meta.url));
const STATIC={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/map.js':['map.js','text/javascript; charset=utf-8'],'/catalog.js':['catalog.js','text/javascript; charset=utf-8'],'/styles.css':['styles.css','text/css; charset=utf-8']};
STATIC['/client-utils.js']=['client-utils.js','text/javascript; charset=utf-8'];
for(const file of ['world-model.js','world-sprites.js','world-view.js'])STATIC['/'+file]=[file,'text/javascript; charset=utf-8'];
class HTTPError extends Error {constructor(status,message){super(message);this.status=status;}}
async function readJSON(req) {
  if(!req.headers['content-type']?.startsWith('application/json'))throw new HTTPError(415,'Нужен JSON');
  let body='',length=0;
  for await(const chunk of req){length+=chunk.length;if(length>16384)throw new HTTPError(413,'Слишком большой запрос');body+=chunk;}
  try {const value=JSON.parse(body);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}
  catch {throw new HTTPError(400,'Некорректный JSON');}
}
export function createServer({dataDir=fileURLToPath(new URL('../data/',import.meta.url)),autoTick=true}={}) {
  const store=createStore(dataDir);
  const rates=new Map();
  function session(req) {const token=req.headers.authorization?.replace(/^Bearer /,'');const s=Object.hasOwn(store.data.sessions,token??'')&&store.data.sessions[token];if(!s)throw new HTTPError(401,'Сессия не найдена. Создайте матч или присоединитесь.');return s;}
  const server=http.createServer(async(req,res)=>{
    const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'");
    try {
      const path=new URL(req.url,'http://localhost').pathname;
      if(req.method==='GET'&&path==='/api/state'){const s=session(req);json(200,snapshot(store.data.matches[s.match],s.country));return;}
      if(req.method==='GET'&&path==='/api/health'){json(200,{ok:true});return;}
      if(req.method==='POST'&&path.startsWith('/api/')) {
        if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw new HTTPError(403,'Запрос с другого сайта запрещён');
        const key=req.socket.remoteAddress,now=Date.now();let rate=rates.get(key);
        if(!rate||now-rate.start>=60000){rate={start:now,count:0};rates.set(key,rate);}
        if(++rate.count>180)throw new HTTPError(429,'Слишком много команд. Подождите минуту.');
        const body=await readJSON(req);
        if(path==='/api/matches'||path==='/api/join') {
          const result=store.transaction(data=>{
            let m;
            if(path==='/api/matches') {
              if(![1,4].includes(body.speed??1))throw new HTTPError(400,'Скорость: 1 или 4');
              if(Object.keys(data.matches).length>=100)throw new HTTPError(400,'Лимит локальных матчей. Архивируйте файл data/matches.json.');
              let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(data.matches[code]);
              m=createMatch({id:code,speed:body.speed??1});data.matches[code]=m;
            }else {const code=typeof body.code==='string'?body.code.trim().toUpperCase():'';m=Object.hasOwn(data.matches,code)?data.matches[code]:null;if(!m)throw new HTTPError(404,'Матч с таким кодом не найден');}
            const c=joinMatch(m,body.name),token=randomBytes(32).toString('hex');data.sessions[token]={match:m.id,country:c.id};return {token,code:m.id,countryId:c.id};
          });json(201,result);return;
        }
        if(path==='/api/command') {const s=session(req);const result=store.transaction(data=>command(data.matches[s.match],s.country,body));json(200,result);return;}
      }
      if(req.method==='GET'&&Object.hasOwn(STATIC,path)) {const [file,type]=STATIC[path];res.writeHead(200,{'Content-Type':type});res.end(readFileSync(PUBLIC+file));return;}
      json(404,{error:'Не найдено'});
    }catch(error){if(error.code){console.error(error);json(500,{error:'Не удалось сохранить или прочитать данные сервера'});}else json(error.status||400,{error:error.message});}
  });
  const timer=autoTick?setInterval(()=>{
    if(!Object.values(store.data.matches).some(m=>m.status==='playing'))return;
    try{store.transaction(data=>{for(const m of Object.values(data.matches))if(m.status==='playing')tick(m,m.speed);});}
    catch(e){console.error('Simulation/save failed:',e);}
    for(const [ip,r]of rates)if(Date.now()-r.start>60000)rates.delete(ip);
  },1000):null;
  return {server,close:async()=>{if(timer)clearInterval(timer);server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));}};
}
