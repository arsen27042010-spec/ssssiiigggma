export const TILE_W = 48, TILE_H = 24, REGION_SIZE = 10, MARGIN = 4;
export const WORLD_W = 88, WORLD_H = 68;
export const WORLD_PIXELS = { width: (WORLD_W + WORLD_H) * TILE_W / 2, height: (WORLD_W + WORLD_H) * TILE_H / 2 + 100 };
export const project = (x,y) => ({ x: (x-y)*TILE_W/2+WORLD_H*TILE_W/2, y: (x+y)*TILE_H/2+60 });
export const unproject = (x,y) => { const a=(x-WORLD_H*TILE_W/2)/(TILE_W/2),b=(y-60)/(TILE_H/2);return {x:(a+b)/2,y:(b-a)/2}; };
export const regionCenter = id => ({x:MARGIN+(id%8)*10+5.5,y:MARGIN+Math.floor(id/8)*10+5.5});
export function regionAt(x,y) {
 const q=Math.floor((x-MARGIN)/10),r=Math.floor((y-MARGIN)/10);
 return q>=0&&q<8&&r>=0&&r<6?r*8+q:null;
}
export function noise(x,y,seed=0) {let n=(Math.imul(x+313,374761393)^Math.imul(y+701,668265263)^Math.imul(seed+91,1274126177))>>>0;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
export function previewState() {
 const names=['Ветроград','Берёзовка','Озёрный край','Каменск','Сосновый бор','Заречье','Приморье','Белый мыс'];
 const regions=Array.from({length:48},(_,id)=>({id,q:id%8,r:Math.floor(id/8),name:names[id%8],known:true,visible:true,owner:[0,1,8,9].includes(id)?'preview':null,population:120,terrain:id%5===3?'mountain':id%4===2?'forest':'plain',buildings:[],neighbors:[]}));
 regions[0].buildings=[{id:1,type:'power',status:'Работает'},{id:2,type:'warehouse',status:'Работает'}];
 regions[8].buildings=[{id:3,type:'mine',status:'Работает'}];
 return {id:'preview',time:0,player:'preview',countries:[{id:'preview',color:'#d0aa61',capital:0,generals:[]}],regions,units:[],shipments:[]};
}
export function buildScene(state) {
 const regions=state.regions,tiles=[],objects=[];
 for(let y=0;y<WORLD_H;y++)for(let x=0;x<WORLD_W;x++){
  const id=regionAt(x,y),r=id===null?null:regions[id],lx=(x-MARGIN)%10,ly=(y-MARGIN)%10;
  const sea=!r||(x<6&&noise(0,y,1)>.35)||(y<6&&noise(x,0,2)>.3)||(x>81&&noise(0,y,3)>.35)||(y>61&&noise(x,0,4)>.35);
  let kind=sea?'water':!r.known?'fog':'grass';
  if(r?.known&&!sea){
   if(x<7||y<7||x>80||y>60)kind='sand';
   else if(r.terrain==='mountain'&&noise(x,y,7)>.38)kind='gravel';
   if(r.owner&&(lx===5||ly===5))kind='road';
   if(r.owner&&lx>=1&&lx<=3&&ly>=1&&ly<=3)kind='field';
  }
  tiles.push({x,y,region:id,kind,variant:Math.floor(noise(x,y)*5),visible:r?.visible??true});
  if(r?.known&&!sea&&kind==='grass'){
   const density=r.owner ? .06 : r.terrain==='forest' ? .6 : .14;
   const reserved=r.owner&&((lx>=2&&lx<=8&&ly>=2&&ly<=8));
   if(!reserved&&noise(x,y,9)<density)objects.push({id:`tree-${x}-${y}`,type:noise(x,y,10)>.55?'pine':'tree',x:x+.5,y:y+.5,region:id,variant:Math.floor(noise(x,y,11)*3)});
   else if(!r.owner&&r.terrain==='mountain'&&noise(x,y,12)>.63)objects.push({id:`rock-${x}-${y}`,type:'rock',x:x+.5,y:y+.5,region:id,variant:Math.floor(noise(x,y,14)*3)});
  }
 }
 for(const r of regions){
  if(!r.known)continue;
  const ox=MARGIN+r.q*10,oy=MARGIN+r.r*10;
  if(r.owner){
   const homes=[[3,4],[4,3],[6,3],[7,4],[3,6],[4,7],[6,6],[2,7],[7,2]];
   const count=Math.min(homes.length,Math.max(4,Math.floor((r.population??100)/20)));
   homes.slice(0,count).forEach(([x,y],i)=>objects.push({id:`house-${r.id}-${i}`,type:i%3===0?'house2':'house',x:ox+x+.5,y:oy+y+.5,region:r.id,variant:(r.id+i)%4}));
   objects.push({id:`barn-${r.id}`,type:'barn',x:ox+2,y:oy+3.8,region:r.id,variant:r.id%3});
   objects.push({id:`flag-${r.id}`,type:'flag',x:ox+5.1,y:oy+4.6,region:r.id,owner:r.owner});
   if(state.countries.find(c=>c.id===r.owner)?.capital===r.id)objects.push({id:`hall-${r.id}`,type:'hall',x:ox+7.8,y:oy+3.8,region:r.id,variant:0});
  }
  const plots=[[7.7,8],[2.1,8.4],[8.4,1.7],[8.5,6.1]];
  (r.buildings??[]).forEach((b,i)=>objects.push({id:`building-${b.id}`,type:b.type,x:ox+plots[i%4][0],y:oy+plots[i%4][1],region:r.id,active:b.status==='Работает',variant:0}));
  if(r.construction)objects.push({id:`construction-${r.id}`,type:'construction',x:ox+plots[(r.buildings?.length??0)%4][0],y:oy+plots[(r.buildings?.length??0)%4][1],region:r.id,variant:0});
 }
 return {tiles,objects:objects.sort((a,b)=>(a.x+a.y)-(b.x+b.y)),regions};
}
export function knownRoute(state,from,to,allowed=()=>true) {
 const seen=new Set([from]),queue=[[from]];
 while(queue.length){const p=queue.shift(),id=p.at(-1);if(id===to)return p;
  for(const n of state.regions[id]?.neighbors??[])if(!seen.has(n)&&state.regions[n].known&&allowed(state.regions[n])){seen.add(n);queue.push([...p,n]);}
 }
 return [from];
}
export function unitRoute(state,u){
 if(!u.order||u.owner!==state.player)return [u.region];
 const owner=state.countries.find(c=>c.id===u.owner),g=u.controller==='player'?null:owner?.generals.find(g=>g.id===u.controller);
 if(g&&g.mode!=='manual'&&!g.zone.includes(u.order.target)&&!(g.task==='attack'&&g.targets.includes(u.order.target)))return [u.region];
 const permitted=g?.mode==='auto'?new Set([...g.zone,...(g.task==='attack'?g.targets:[])]):null;
 return knownRoute(state,u.region,u.order.target,r=>(!permitted||permitted.has(r.id))&&([null,u.owner].includes(r.owner)||(r.id===u.order.target&&u.order.kind==='attack')));
}
