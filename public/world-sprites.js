// Original, code-drawn pixel sprites. All positions share a ground anchor.
const cache=new Map();
export function polygon(c,points,color,stroke=null){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}}
function box(c,x,y,w,d,h,top='#a7a48c',left='#8a846f',right='#656756'){
 polygon(c,[[x-w,y-d],[x,y],[x,y-h],[x-w,y-d-h]],left);
 polygon(c,[[x,y],[x+w,y-d],[x+w,y-d-h],[x,y-h]],right);
 polygon(c,[[x-w,y-d-h],[x,y-2*d-h],[x+w,y-d-h],[x,y-h]],top);
}
function window(c,x,y,side=1,light=true){polygon(c,[[x,y],[x+5*side,y-2.5],[x+5*side,y+3.5],[x,y+6]],light?'#d3c289':'#293d40');c.fillStyle='#787b64';c.fillRect(x+2*side,y,1,4);}
function roof(c,w,d,h,variant){
 const roofs=[['#a66949','#794331','#b87b53'],['#657e86','#475d67','#809299'],['#9c7958','#725c43','#b99565'],['#777965','#555d51','#9a9d83']][variant%4];
 polygon(c,[[-w,-d-h],[0,-2*d-h],[0,-d-h-13]],roofs[2]);
 polygon(c,[[0,-2*d-h],[w,-d-h],[0,-d-h-13]],roofs[1]);
 polygon(c,[[-w,-d-h],[0,-h],[0,-d-h-13]],roofs[0]);
 polygon(c,[[0,-h],[w,-d-h],[0,-d-h-13]],roofs[1]);
 c.strokeStyle='#493e31';c.lineWidth=1;c.beginPath();c.moveTo(-w,-d-h);c.lineTo(0,-h);c.lineTo(w,-d-h);c.stroke();
}
function house(c,type,v){const tall=type==='house2'||type==='hall',w=type==='hall'?24:16,d=w*.5,h=tall?24:15;
 box(c,0,0,w,d,h,'#c8b698',v%2?'#c3b48e':'#d3c5a4','#999579');roof(c,w+2,d,h,v);
 window(c,-w+4,-d-h+6,-1);window(c,5,-h+1,1);if(tall){window(c,-w+4,-d-h+16,-1);window(c,5,-h+12,1);}
 polygon(c,[[-9,-9],[-3,-6],[-3,0],[-9,-3]],'#4e493a');
 box(c,-7,-h-14,3,1.5,8,'#a9987d','#86745f','#625d4b');
 if(type==='hall'){box(c,0,-h-14,5,3,18,'#d3c7a5','#b8b291','#8b8f7a');c.fillStyle='#344247';c.fillRect(-2,-h-32,4,5);roof(c,6,3,h+30,1);}
}
function tree(c,pine,v){
 c.fillStyle='#25382455';c.fillRect(-4,0,22,4);c.fillStyle='#604e32';c.fillRect(-2,-12,4,15);
 if(pine){for(let i=0;i<3;i++){const y=-9-i*10,w=14-i*3;polygon(c,[[-w,y],[-w+3,y-5],[-w+7,y-7],[0,y-22],[w-7,y-7],[w-3,y-5],[w,y]],['#3d6039','#4b703f','#557b46'][i]);polygon(c,[[0,y-22],[w-7,y-7],[w-3,y-5],[w,y],[0,y-1]],'#2d4d35');}}
 else {for(const [x,y,w,h,col]of[[-12,-28,24,18,'#385c34'],[-16,-24,30,13,'#426a37'],[-10,-35,20,22,'#56803c'],[-4,-39,14,21,'#638d46'],[3,-28,14,16,'#3c6336'],[-12,-26,9,9,'#74964a']]){c.fillStyle=col;c.fillRect(x+(v%2)*2,y,w,h);}c.fillStyle='#7b9a50';c.fillRect(-4,-33,7,4);c.fillRect(-10,-23,4,3);}
}
function chimney(c,x,y,h=30){box(c,x,y,4,2,h,'#c2b091','#8d795d','#625b49');c.fillStyle='#353a35';c.fillRect(x-2,y-h-3,4,2);}
function factory(c,type){
 if(type==='mine'){
  polygon(c,[[-32,-5],[-28,-22],[-10,-29],[6,-22],[22,-15],[30,0],[0,14]],'#7c8074');
  polygon(c,[[-25,-10],[-14,-31],[2,-36],[14,-18],[8,4]],'#999b85');
  box(c,3,8,13,7,20,'#8e7c54','#746044','#504d3c');polygon(c,[[-6,3],[-6,-8],[3,-13],[11,-5],[11,9]],'#282f2d');
  c.strokeStyle='#655640';c.lineWidth=3;c.beginPath();c.moveTo(-7,22);c.lineTo(0,7);c.moveTo(6,26);c.lineTo(13,11);c.stroke();
  for(let y=15;y<25;y+=4){c.strokeStyle='#a0946c';c.lineWidth=2;c.beginPath();c.moveTo(-5,y);c.lineTo(8,y+5);c.stroke();}return;
 }
 if(type==='refinery'){
  box(c,-13,5,18,9,4,'#909181','#6b6b55','#4e594e');
  for(const [x,y]of[[-16,-4],[10,10]]){box(c,x,y,12,6,22,'#b9bdac','#9da38e','#727e70');c.strokeStyle='#d0ceb3';c.lineWidth=2;c.strokeRect(x-3,y-29,6,2);}
  chimney(c,15,-7,49);c.strokeStyle='#8d8d6b';c.lineWidth=4;c.beginPath();c.moveTo(-15,4);c.lineTo(9,17);c.lineTo(24,8);c.stroke();c.fillStyle='#d0ab53';c.fillRect(13,-38,5,4);return;
 }
 if(type==='fort'){
  for(const [x,y]of[[-18,-3],[0,7],[18,-3]]){box(c,x,y,11,5,12,'#a7a08a','#817d67','#616655');for(let j=-1;j<=1;j++){c.fillStyle='#a9a28d';c.fillRect(x+j*6-2,y-20,4,6);}}return;
 }
 box(c,0,5,28,14,type==='warehouse'?19:23,'#aaa18b','#8f8e78','#636f61');
 if(type==='warehouse'){roof(c,29,14,15,3);polygon(c,[[3,-7],[17,-14],[17,1],[3,8]],'#424f46');for(let i=0;i<4;i++){c.strokeStyle='#7f8b76';c.beginPath();c.moveTo(4,-3+i*3);c.lineTo(16,-9+i*3);c.stroke();}box(c,-22,9,6,3,6,'#c1a261','#937948','#75623f');return;}
 for(let i=0;i<3;i++){window(c,-23+i*7,-17+i*3,-1,false);window(c,4+i*7,-15-i*3,1,false);}
 if(type==='power'){
  chimney(c,-14,-12,43);chimney(c,8,-17,50);box(c,15,12,13,7,9,'#838f7f','#596b5a','#425649');
  c.strokeStyle='#adad89';c.lineWidth=2;for(let i=0;i<4;i++){c.beginPath();c.moveTo(5+i*5,2-i*2);c.lineTo(5+i*5,11-i*2);c.stroke();}
 }else{
  box(c,0,-19,11,6,6,'#a3b0a6','#727f75','#526257');chimney(c,-17,-8,27);
  for(let i=0;i<3;i++)box(c,-14+i*10,-12-i*3,5,3,5,'#b6b49a','#8a8f77','#666d5b');
  if(type==='armor'){box(c,17,13,10,5,5,'#718164','#4b6048','#374b39');c.strokeStyle='#303d2c';c.lineWidth=3;c.beginPath();c.moveTo(21,4);c.lineTo(35,-2);c.stroke();}
  if(type==='arms'){c.fillStyle='#bba757';c.fillRect(-20,-7,4,6);c.fillRect(-10,-2,4,6);}
 }
}
export function sprite(type,variant=0,color='#bdad70'){
 const key=`${type}-${variant}-${color}`;if(cache.has(key))return cache.get(key);
 const canvas=document.createElement('canvas');canvas.width=112;canvas.height=112;const c=canvas.getContext('2d');c.translate(56,86);
 if(type==='tree'||type==='pine')tree(c,type==='pine',variant);
 else if(type==='rock'){polygon(c,[[-19,0],[-23,-11],[-12,-25],[1,-29],[19,-11],[15,5]],'#7e8575');polygon(c,[[-23,-11],[-12,-25],[1,-29],[4,-10],[-3,3]],'#a4a891');polygon(c,[[1,-29],[19,-11],[15,5],[4,-10]],'#646e62');}
 else if(['house','house2','hall'].includes(type))house(c,type,variant);
 else if(type==='barn'){box(c,0,0,20,10,11,'#b09b69','#9b8050','#766c44');roof(c,22,10,11,0);box(c,16,3,7,4,15,'#b4b19c','#949d83','#6e7e68');}
 else if(type==='flag'){c.fillStyle='#302f23';c.fillRect(0,-28,2,31);polygon(c,[[2,-28],[15,-25],[15,-17],[2,-20]],color);box(c,1,3,4,2,3,'#a7ab91','#717e65','#5a6652');}
 else if(type==='construction'){
  polygon(c,[[-30,-10],[0,-25],[30,-10],[0,5]],'#877754');for(let i=0;i<3;i++){box(c,-18+i*16,-2-i*4,5,3,5,'#c5a064','#927844','#6e633e');}
  c.strokeStyle='#ceaf69';c.lineWidth=2;for(const [x,y]of[[-20,-10],[0,0],[22,-10]]){c.beginPath();c.moveTo(x,y);c.lineTo(x,y-28);c.stroke();}c.beginPath();c.moveTo(-20,-38);c.lineTo(0,-28);c.lineTo(22,-38);c.stroke();
 }else if(type==='truck'){
  box(c,-5,0,14,7,8,'#d0b679','#a48750','#746a40');box(c,13,1,7,5,10,color,'#687757','#425742');window(c,14,-12,1,false);c.fillStyle='#242b28';for(const [x,y]of[[-12,-2],[0,5],[15,1]])c.fillRect(x,y,5,5);
 }else if(type==='tank'||type==='artillery'){
  box(c,0,1,16,8,6,'#889371','#546d50','#40513d');c.fillStyle='#30382d';c.fillRect(-13,-3,8,6);c.fillRect(6,2,8,5);box(c,0,-3,9,5,6,color,'#667c55','#425840');c.strokeStyle='#303c30';c.lineWidth=3;c.beginPath();c.moveTo(3,-12);c.lineTo(24,-22);c.stroke();
 }else if(type==='infantry'||type==='scout'){
  for(const [x,y]of(type==='infantry'?[[-6,0],[5,4],[2,-5]]:[[0,0]])){c.fillStyle='#292f28';c.fillRect(x-2,y-3,2,6);c.fillRect(x+1,y-3,2,6);c.fillStyle=color;c.fillRect(x-3,y-12,7,9);c.fillStyle='#c4ad7e';c.fillRect(x-2,y-16,5,5);c.fillStyle='#5c6e42';c.fillRect(x-3,y-18,7,4);c.fillStyle='#292f28';c.fillRect(x+4,y-12,2,8);}
 }else factory(c,type);
 cache.set(key,canvas);return canvas;
}
const icons=new Map();
export function icon(type){
 if(icons.has(type))return icons.get(type);
 const source=sprite(type),pixels=source.getContext('2d').getImageData(0,0,112,112).data;
 let left=112,top=112,right=0,bottom=0;
 for(let y=0;y<112;y++)for(let x=0;x<112;x++)if(pixels[(y*112+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 const canvas=document.createElement('canvas');canvas.width=48;canvas.height=48;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
 const w=right-left+1,h=bottom-top+1,scale=Math.min(40/w,40/h);
 c.drawImage(source,left,top,w,h,Math.round((48-w*scale)/2),Math.round((48-h*scale)/2),Math.round(w*scale),Math.round(h*scale));
 const url=canvas.toDataURL();icons.set(type,url);return url;
}
