import { WORLD_PIXELS,MARGIN,project,unproject,regionCenter,regionAt,noise,buildScene,unitRoute,previewState } from './world-model.js';
import { sprite,polygon } from './world-sprites.js';
import { UNIT_TYPES } from './catalog.js';

const GRASS=['#718449','#74874b','#6d8046','#77884e','#6e8249'];
const SAND=['#ab9867','#b09e6c','#a89565','#b5a273','#ad9b6a'];
const GRAVEL=['#858973','#7f846d','#8e8f78','#96937e','#868971'];
function diamond(c,x,y,color){polygon(c,[[x,y],[x+24,y+12],[x,y+24],[x-24,y+12]],color);}
function paintTile(c,t){
 const p=project(t.x,t.y),n=t.variant;
 let fill=t.kind==='water'?['#365c66','#375e68','#355b64','#395f69','#375e65'][n]:t.kind==='fog'?['#242c27','#252e28','#27302a','#252e29','#28312a'][n]:t.kind==='sand'?SAND[n]:t.kind==='gravel'?GRAVEL[n]:GRASS[n];
 diamond(c,p.x,p.y,fill);
 if(t.kind==='fog'){c.fillStyle='#303930';c.fillRect(p.x-5+n*2,p.y+8,2,1);return;}
 if(t.kind==='water'){c.fillStyle='#6e929033';c.fillRect(p.x-9+n*2,p.y+10,9-n,1);return;}
 for(let i=0;i<5;i++){const a=noise(t.x,t.y,i+50);c.fillStyle=i%2?'#c3be792b':'#2e461c28';c.fillRect(Math.round(p.x-13+a*26),Math.round(p.y+7+noise(t.x,t.y,i+60)*10),2,1);}
 if(t.kind==='road'){
  diamond(c,p.x,p.y,'#868575');diamond(c,p.x,p.y+1,'#727467');
  const vertical=(t.x-MARGIN)%10===5,horizontal=(t.y-MARGIN)%10===5;
  c.strokeStyle='#b5ad7d';c.lineWidth=1;c.setLineDash([3,5]);c.beginPath();
  if(vertical){c.moveTo(p.x+12,p.y+6);c.lineTo(p.x-12,p.y+18);}
  if(horizontal){c.moveTo(p.x-12,p.y+6);c.lineTo(p.x+12,p.y+18);}
  c.stroke();c.setLineDash([]);
 }
 if(t.kind==='field'){
  diamond(c,p.x,p.y,'#847245');for(let j=0;j<5;j++){const a=j*4;c.strokeStyle=j%2?'#b8aa54':'#c8b863';c.lineWidth=2;c.beginPath();c.moveTo(p.x-18+a,p.y+11-a*.5);c.lineTo(p.x+a,p.y+20-a*.5);c.stroke();}
 }
 if(!t.visible){diamond(c,p.x,p.y,'#16222040');}
}
export class WorldView {
 constructor(canvas,{onRegion=()=>{},onUnit=()=>{},preview=false}={}){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.onRegion=onRegion;this.onUnit=onUnit;this.preview=preview;
  this.camera={x:0,y:0,zoom:preview?1.4:1.45};this.state=null;this.selected=null;this.hover=null;this.unitHits=[];this.motions=new Map();this.disposed=false;
  this.reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.base=document.createElement('canvas');this.base.width=WORLD_PIXELS.width;this.base.height=WORLD_PIXELS.height;
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();
  this.handlers={};this.bind();
  if(preview){this.update(previewState(),{});this.focus(0);this.camera.x+=160;this.camera.y+=130;}
  this.frame=requestAnimationFrame(t=>this.draw(t));
 }
 resize(){const b=this.canvas.getBoundingClientRect();this.width=b.width;this.height=b.height;const dpr=Math.min(2,window.devicePixelRatio||1);this.dpr=dpr;this.canvas.width=Math.round(b.width*dpr);this.canvas.height=Math.round(b.height*dpr);}
 bind(){
  const on=(name,fn,opts)=>{this.handlers[name]=fn;this.canvas.addEventListener(name,fn,opts);};
  on('contextmenu',e=>e.preventDefault());
  on('pointerdown',e=>{if(this.preview)return;this.canvas.focus({preventScroll:true});this.drag={x:e.clientX,y:e.clientY,cx:this.camera.x,cy:this.camera.y,moved:false,button:e.button};this.canvas.setPointerCapture(e.pointerId);});
  on('pointermove',e=>{
   const b=this.canvas.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top;
   if(this.drag){const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;if(Math.abs(dx)+Math.abs(dy)>5)this.drag.moved=true;if(this.drag.moved){this.camera.x=this.drag.cx-dx/this.camera.zoom;this.camera.y=this.drag.cy-dy/this.camera.zoom;this.clamp();this.canvas.classList.add('dragging');}}
   const w=this.screenWorld(x,y),p=unproject(w.x,w.y);this.hover=regionAt(p.x,p.y);
   this.pointer={x,y};
  });
  on('pointerleave',()=>{if(!this.drag)this.hover=null;});
  on('pointerup',e=>{if(!this.drag)return;const moved=this.drag.moved;this.drag=null;this.canvas.classList.remove('dragging');if(moved||e.button!==0)return;const b=this.canvas.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top;
   if(this.miniRect&&x>=this.miniRect.x&&y>=this.miniRect.y&&x<=this.miniRect.x+this.miniRect.w&&y<=this.miniRect.y+this.miniRect.h){this.camera.x=(x-this.miniRect.x)/this.miniRect.scale;this.camera.y=(y-this.miniRect.y)/this.miniRect.scale;this.clamp();return;}
   const hit=this.unitHits.find(h=>Math.hypot(h.x-x,h.y-y)<15);if(hit){this.onUnit(hit.id);return;}
   const w=this.screenWorld(x,y),p=unproject(w.x,w.y),id=regionAt(p.x,p.y);if(id!==null)this.onRegion(id);
  });
  on('pointercancel',()=>{this.drag=null;this.canvas.classList.remove('dragging');});
  on('wheel',e=>{if(this.preview)return;e.preventDefault();const b=this.canvas.getBoundingClientRect();this.zoom(Math.exp(-e.deltaY*.0015),e.clientX-b.left,e.clientY-b.top);},{passive:false});
  on('keydown',e=>{const keys={ArrowLeft:[-70,0],a:[-70,0],ArrowRight:[70,0],d:[70,0],ArrowUp:[0,-70],w:[0,-70],ArrowDown:[0,70],s:[0,70]};if(keys[e.key]){e.preventDefault();this.camera.x+=keys[e.key][0]/this.camera.zoom;this.camera.y+=keys[e.key][1]/this.camera.zoom;this.clamp();}if(e.key==='+'||e.key==='=')this.zoom(1.2);if(e.key==='-')this.zoom(1/1.2);if(e.key==='Home'){e.preventDefault();this.focus(this.selected??0);}if(e.key==='Enter'&&this.hover!==null)this.onRegion(this.hover);});
 }
 viewCenter(){return {x:this.width*.43,y:this.height*.46};}
 screenWorld(x,y){const v=this.viewCenter();return {x:(x-v.x)/this.camera.zoom+this.camera.x,y:(y-v.y)/this.camera.zoom+this.camera.y};}
 worldScreen(x,y){const v=this.viewCenter();return {x:(x-this.camera.x)*this.camera.zoom+v.x,y:(y-this.camera.y)*this.camera.zoom+v.y};}
 clamp(){this.camera.x=Math.max(0,Math.min(WORLD_PIXELS.width,this.camera.x));this.camera.y=Math.max(0,Math.min(WORLD_PIXELS.height,this.camera.y));}
 focus(id){const p=regionCenter(id),v=project(p.x,p.y);this.camera.x=v.x;this.camera.y=v.y+25;}
 zoom(factor,x=this.viewCenter().x,y=this.viewCenter().y){const before=this.screenWorld(x,y);this.camera.zoom=Math.max(.32,Math.min(3.5,this.camera.zoom*factor));const after=this.screenWorld(x,y);this.camera.x+=before.x-after.x;this.camera.y+=before.y-after.y;this.clamp();}
 update(state,{selected=null,layer='territory',orderUnit=null}={}){
  const first=!this.state;this.state=state;this.selected=selected;this.layer=layer;this.orderUnit=orderUnit;this.receivedAt=performance.now();
  const key=JSON.stringify([state.countries.map(c=>[c.id,c.capital,c.color]),state.regions.map(r=>[r.known,r.visible,r.owner,r.terrain,Math.floor((r.population??100)/20),r.buildings,r.construction?.kind,r.construction?.building])]);
  if(key!==this.sceneKey){this.sceneKey=key;this.scene=buildScene(state);this.paintBase();}
  if(first&&!this.preview)this.focus(state.countries.find(c=>c.id===state.player)?.capital??0);
 }
 paintBase(){
  const c=this.base.getContext('2d');c.clearRect(0,0,this.base.width,this.base.height);
  for(const t of this.scene.tiles)paintTile(c,t);
  for(const o of this.scene.objects){const p=project(o.x,o.y),color=this.state.countries.find(c=>c.id===o.owner)?.color;
   c.globalAlpha=this.state.regions[o.region].visible?1:.65;
   // Directional ground shadows give tiny sprites depth without blurring pixels.
   if(!['flag','construction'].includes(o.type)){c.fillStyle='#202a2340';polygon(c,[[p.x-10,p.y],[p.x+22,p.y+6],[p.x+39,p.y-4],[p.x+4,p.y-12]],'#1f2a222d');}
   c.drawImage(sprite(o.type,o.variant,color),Math.round(p.x-56),Math.round(p.y-86));
  }c.globalAlpha=1;
 }
 outline(c,id,color,width=1,fill=null){
  const r=this.state.regions[id];if(!r)return;const x=MARGIN+r.q*10,y=MARGIN+r.r*10;
  const p=[[x,y],[x+10,y],[x+10,y+10],[x,y+10]].map(([x,y])=>project(x,y));
  c.beginPath();p.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}c.strokeStyle=color;c.lineWidth=width;c.stroke();
 }
 draw(now){
  if(this.disposed)return;this.frame=requestAnimationFrame(t=>this.draw(t));if(!this.state||!this.width)return;
  const c=this.ctx,z=this.camera.zoom,v=this.viewCenter();c.setTransform(this.dpr,0,0,this.dpr,0,0);c.imageSmoothingEnabled=false;
  c.fillStyle='#365c66';c.fillRect(0,0,this.width,this.height);
  c.save();c.translate(v.x,v.y);c.scale(z,z);c.translate(-this.camera.x,-this.camera.y);c.drawImage(this.base,0,0);
  const player=this.state.countries.find(c=>c.id===this.state.player);
  if(!this.preview){
   for(const r of this.state.regions){
    if(!r.known||!r.owner)continue;
    let tint=null,color=this.state.countries.find(c=>c.id===r.owner)?.color??'#8b9e64';
    if(this.layer==='economy'&&r.owner===this.state.player)tint=r.buildings.some(b=>b.status&&b.status!=='Работает')?'#c182342e':'#96c55b22';
    if(this.layer==='supply'&&r.owner===this.state.player)tint=r.buildings.some(b=>b.type==='warehouse')||player.capital===r.id?'#67c5b94d':'#587f8a22';
    const g=player.generals.find(g=>g.zone.includes(r.id));if(this.layer==='generals'&&g)tint=['#748cc255','#aa82ad55','#d9af5955'][g.id];
    c.setLineDash([3,6]);this.outline(c,r.id,color+'88',1/z,tint);c.setLineDash([]);
   }
   if(this.selected!==null)this.outline(c,this.selected,'#ddc174',1.5/z,'#ebd99c0a');
   if(this.hover!==null&&this.hover!==this.selected)this.outline(c,this.hover,'#d2cfab99',1/z);
  }
  this.drawMovers(c,now);
  if(!this.reducedMotion){for(const o of this.scene.objects)if(o.active&&['power','refinery','arms','armor'].includes(o.type)){const p=project(o.x,o.y);for(let i=0;i<4;i++){const age=((now/1100+i*.65)%2.8),size=3+age*3;c.globalAlpha=(1-age/2.8)*.22;c.fillStyle='#d1c9a9';c.fillRect(Math.round(p.x-13+age*7),Math.round(p.y-64-age*16),size,size);}c.globalAlpha=1;}}
  c.restore();
  if(!this.preview){this.drawLabels(c);this.drawMiniMap(c);this.drawHover(c);}
 }
 drawMovers(c,now){
  this.unitHits=[];const elapsed=this.state.status==='playing'?Math.min(1,(now-this.receivedAt)/1000)*(this.state.speed??1):0,stacks={};
  for(const u of this.state.units){
   const start=regionCenter(u.region),path=unitRoute(this.state,u);let x=start.x,y=start.y;
   if(path.length>1&&u.owner===this.state.player){const next=regionCenter(path[1]),f=this.reducedMotion?0:Math.min(.97,((u.progress??0)+elapsed)/(UNIT_TYPES[u.type].seconds*(u.supply>0?1:2)));x+=(next.x-x)*f;y+=(next.y-y)*f;}
   const offset=(stacks[u.region]??0);stacks[u.region]=offset+1;x+=(offset%3)*.42;y+=Math.floor(offset/3)*.5;
   const p=project(x,y),color=this.state.countries.find(c=>c.id===u.owner)?.color??'#b86445';
   if(u.id===this.orderUnit){c.strokeStyle='#ebd782';c.lineWidth=1.5/this.camera.zoom;c.beginPath();c.ellipse(p.x,p.y+1,19,9,0,0,Math.PI*2);c.stroke();}
   if(u.id===this.orderUnit&&u.order){const target=regionCenter(u.order.target),end=project(target.x,target.y);c.strokeStyle=u.order.kind==='attack'?'#dc9670':'#d2c788';c.setLineDash([4,5]);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(end.x,end.y);c.stroke();c.setLineDash([]);}
   c.drawImage(sprite(u.type,0,color),Math.round(p.x-56),Math.round(p.y-86));
   if(u.hp<100){c.fillStyle='#28332b';c.fillRect(p.x-11,p.y-26,22,3);c.fillStyle='#9fa865';c.fillRect(p.x-11,p.y-26,22*Math.max(0,u.hp)/100,3);}
   const screen=this.worldScreen(p.x,p.y-8);this.unitHits.push({id:u.id,x:screen.x,y:screen.y});
  }
  for(const s of this.state.shipments){if(!['moving','delayed'].includes(s.status))continue;const from=regionCenter(s.region),index=s.path?.indexOf(s.region)??-1,next=index>=0?s.path[index+1]:undefined;let x=from.x,y=from.y;
   if(next!==undefined&&s.status==='moving'&&!this.reducedMotion){const to=regionCenter(next),f=Math.max(0,Math.min(.97,((s.progress??0)+elapsed)/8));x+=(to.x-x)*f;y+=(to.y-y)*f;}
   const p=project(x+.22,y+.22);c.drawImage(sprite('truck',0,'#d2ae64'),Math.round(p.x-56),Math.round(p.y-86));
  }
 }
 drawLabels(c){
  if(this.camera.zoom<.55)return;c.font='11px "Segoe UI", sans-serif';c.textAlign='center';
  for(const r of this.state.regions){if(!r.known||(!r.owner&&this.camera.zoom<1.2))continue;const tile=regionCenter(r.id),p=project(tile.x,tile.y),screen=this.worldScreen(p.x,p.y+72);
   if(screen.x<0||screen.x>this.width||screen.y<0||screen.y>this.height)continue;
   const age=Math.max(0,this.state.time-(r.lastSeen??0));
   const text=this.layer==='intelligence'?`${r.name} · ${r.visible?'наблюдается':age<60?`${Math.floor(age)} с назад`:`${Math.floor(age/60)} мин назад`}`:r.name,w=c.measureText(text).width+16;c.fillStyle=r.id===this.selected?'#5c553bf0':'#252e25d9';c.fillRect(screen.x-w/2,screen.y-11,w,19);
   c.strokeStyle=r.id===this.selected?'#d0ae68':'#636d4f';c.lineWidth=1;c.strokeRect(Math.round(screen.x-w/2)+.5,Math.round(screen.y-11)+.5,w,19);c.fillStyle='#ded9bf';c.fillText(text,screen.x,screen.y+2);
  }
 }
 drawMiniMap(c){
  const w=184,h=105,x=18,y=this.height-160,scale=Math.min((w-12)/WORLD_PIXELS.width,(h-12)/WORLD_PIXELS.height);
  this.miniRect={x:x+6,y:y+6,w:WORLD_PIXELS.width*scale,h:WORLD_PIXELS.height*scale,scale};
  c.fillStyle='#262d28ee';c.fillRect(x-1,y-20,w+2,h+22);c.strokeStyle='#737964';c.lineWidth=1;c.strokeRect(x-.5,y-20.5,w+1,h+22);c.font='10px Consolas';c.textAlign='left';c.fillStyle='#c3c8a9';c.fillText('КАРТА МИРА',x+8,y-6);
  c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.translate(x+6,y+6);c.scale(scale,scale);
  for(const r of this.state.regions){const col=!r.known?'#384237':r.owner?this.state.countries.find(c=>c.id===r.owner)?.color:'#7e8b52';this.outline(c,r.id,col,1/scale,col);}
  const tl=this.screenWorld(0,0);c.strokeStyle='#efe0a8';c.lineWidth=1/scale;c.strokeRect(tl.x,tl.y,this.width/this.camera.zoom,this.height/this.camera.zoom);c.restore();
  c.fillStyle='#252c25dd';c.fillRect(x,this.height-46,184,22);c.fillStyle='#b9c1a4';c.font='10px Consolas';c.fillText(`${Math.round(this.camera.zoom*100)}%   КОЛЕСО: МАСШТАБ`,x+7,this.height-31);
 }
 drawHover(c){if(this.hover===null||!this.pointer||this.drag)return;const r=this.state.regions[this.hover];if(!r)return;const text=r.known?`${r.name} · ${r.owner?this.state.countries.find(c=>c.id===r.owner)?.name:'Нейтральная земля'}`:'Неизведанная территория';c.font='11px "Segoe UI"';const w=c.measureText(text).width+18,x=Math.min(this.width-w-8,this.pointer.x+15),y=Math.min(this.height-30,this.pointer.y+24);c.fillStyle='#222b24ed';c.fillRect(x,y,w,25);c.strokeStyle='#737b58';c.strokeRect(x+.5,y+.5,w,25);c.textAlign='left';c.fillStyle='#dedcc6';c.fillText(text,x+9,y+16);}
 destroy(){this.disposed=true;cancelAnimationFrame(this.frame);this.observer.disconnect();for(const [name,fn]of Object.entries(this.handlers))this.canvas.removeEventListener(name,fn);}
}
