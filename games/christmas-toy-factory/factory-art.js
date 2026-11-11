(() => {
  'use strict';
  const W=540,H=1172, catalog=window.ToyCatalog;
  const ctx=document.getElementById('world').getContext('2d');
  const cache=new Map(),slotFrames=new WeakMap();
  // One atlas page per toy (its incomplete states + parts) plus an icon page of complete toys.
  // Pages load on demand; until then sprites fall back to the icon or part mesh and are not cached.
  const pages=new Map(),pageListeners=new Set();
  function redrawReels(){document.querySelectorAll('.reel canvas, .level-choice canvas').forEach(canvas=>{const frame=slotFrames.get(canvas);if(frame)slotReel(canvas,...frame);});pageListeners.forEach(f=>f());}
  function page(key){let img=pages.get(key);if(!img){const info=ToyAtlas.pages[key];if(!info)return null;img=new Image();img.onload=()=>{cache.clear();redrawReels();};img.src=info.src;pages.set(key,img);}return img;}
  const ready=img=>img&&img.complete&&img.naturalWidth>0;
  function preload(kinds){page('icons');for(const k of kinds)page(k);}
  function onPage(f){pageListeners.add(f);}
  page('icons');
  const giftAtlas=new Image();giftAtlas.onload=()=>cache.clear();giftAtlas.src='assets/gift-atlas.png';
  const BELT_DROP=28,beltY=kind=>(catalog.toys[kind].beltY??477)+BELT_DROP;
  const round=(c,x,y,w,h,r,fill,stroke)=>{c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}};
  const grad=(c,x,y,x1,y1,stops)=>{const g=c.createLinearGradient(x,y,x1,y1);stops.forEach(([p,s])=>g.addColorStop(p,s));return g;};
  function ellipse(c,x,y,rx,ry,fill){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();}
  function star(c,x,y,r,color){c.save();c.translate(x,y);c.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4-Math.PI/2;const d=i%2?r*.26:r;c.lineTo(Math.cos(a)*d,Math.sin(a)*d);}c.closePath();c.fillStyle=color;c.fill();c.restore();}
  function tree(c,x,y,size,color){c.fillStyle=color;c.beginPath();c.moveTo(x,y-size);c.lineTo(x-size*.45,y-size*.25);c.lineTo(x-size*.20,y-size*.25);c.lineTo(x-size*.57,y+size*.17);c.lineTo(x+size*.57,y+size*.17);c.lineTo(x+size*.20,y-size*.25);c.lineTo(x+size*.45,y-size*.25);c.closePath();c.fill();}
  const bg=document.createElement('canvas');bg.width=W;bg.height=H;const b=bg.getContext('2d');
  b.fillStyle=grad(b,0,0,0,H,[[0,'#c5ded0'],[.25,'#a9cbbf'],[.55,'#8fb8aa'],[1,'#6f9c93']]);b.fillRect(0,0,W,H);
  // Quiet workshop architecture: cold daylight behind warm, saturated toys.
  for(const x of [14,520]){round(b,x,80,7,497,4,'#75a9b9');round(b,x+4,80,3,497,2,'#c4e2e5');}
  b.save();b.beginPath();b.roundRect(112,88,316,460,[155,155,8,8]);b.clip();b.fillStyle=grad(b,0,90,0,550,[[0,'#6bc5e4'],[.8,'#d9f3f1']]);b.fillRect(110,88,320,460);
  ellipse(b,252,491,215,35,'#effbfa');ellipse(b,395,475,139,34,'#f6fffc');
  for(const [x,y,s] of [[162,484,62],[201,488,39],[375,490,73],[334,488,43]]){tree(b,x,y,s,'#9ed4ce');tree(b,x-1,y-7,s*.85,'#c1e7df');}
  for(let i=0;i<42;i++){const x=125+(i*89%296),y=96+(i*67%370);ellipse(b,x,y,1.3+(i%3)*.45,1.3+(i%3)*.45,'#f0ffff');}
  b.restore();b.lineWidth=11;b.strokeStyle='#e4f3e9';b.beginPath();b.roundRect(112,88,316,460,[155,155,8,8]);b.stroke();b.lineWidth=5;b.strokeStyle='#96c0c9';b.beginPath();b.moveTo(270,92);b.lineTo(270,543);b.moveTo(116,332);b.lineTo(425,332);b.stroke();
  // Peripheral shelves and packed parcels.
  for(const [x,w] of [[-19,121],[447,110]]){round(b,x,417,w,12,3,'#91b7c2');round(b,x,486,w,13,3,'#91b7c2');}
  for(const [x,y,w,h,c] of [[30,449,35,36,'#e2c199'],[65,458,28,27,'#e9cc9e'],[465,386,31,30,'#e0bc94'],[495,448,38,36,'#b8cfbd']]){round(b,x,y,w,h,3,c);b.fillStyle='#f6dfb6';b.fillRect(x+w*.44,y,5,h);}
  // Garland and tiny warm lights.
  b.lineWidth=9;b.strokeStyle='#428d82';b.beginPath();b.moveTo(-10,94);b.quadraticCurveTo(120,141,270,94);b.quadraticCurveTo(410,139,551,93);b.stroke();
  for(let i=0;i<16;i++){const x=i*36,y=98+Math.sin(i/15*Math.PI*4)*10;b.shadowColor='#ffe99b';b.shadowBlur=10;ellipse(b,x,y,3.3,4.5,i%3?'#fff0a8':'#ffd1a8');}b.shadowBlur=0;
  b.fillStyle=grad(b,0,603,0,1172,[[0,'#88664e'],[.35,'#705344'],[.75,'#59483b'],[1,'#48413a']]);b.fillRect(0,603,540,569);
  // Letter Press gameplay wallpaper on the workbench behind its gold tray.
  for(let y=603,row=0;y<1172+68;y+=68,row++){for(let x=(row%2)*68;x<608;x+=136){b.beginPath();b.moveTo(x,y-68);b.lineTo(x+68,y);b.lineTo(x,y+68);b.lineTo(x-68,y);b.closePath();b.fillStyle=row%2?'#30211f1a':'#f0c49910';b.fill();}}

  const tray=document.createElement('canvas');tray.width=W;tray.height=H;const t=tray.getContext('2d');
  // Exact tray frame geometry, gold stops and felt colors from Letter Press drawTray.
  round(t,41,697,454,353,33,'#361a1c');
  round(t,42,694,452,354,34,grad(t,52,695,465,1046,[[0,'#fff16a'],[.13,'#ffcd12'],[.53,'#ffb90b'],[.89,'#ffda1b'],[1,'#fff171']]));
  t.lineWidth=1.5;round(t,42,694,452,354,34,null,'#f7cc23');
  const felt=t.createRadialGradient(256,836,25,260,875,255);felt.addColorStop(0,'#353c48');felt.addColorStop(1,'#232a34');
  round(t,57,709,423,322,23,felt);t.lineWidth=3;round(t,57,709,423,322,23,null,'#cf7b10');
  t.save();t.beginPath();t.roundRect(57,709,423,322,23);t.clip();t.fillStyle=grad(t,0,707,0,1030,[[0,'#181d28af'],[.052,'#181d2830'],[.13,'#181d2800'],[.94,'#181d2800'],[1,'#181d2899']]);t.fillRect(57,709,423,322);t.restore();
  function sprite(kind,size=170){
    const key=kind+':'+Math.round(size*2)/2;if(cache.has(key))return cache.get(key);
    const isGift=window.GiftCatalog?.map[kind]!==undefined;
    let source=null,layout=null,index=0;
    if(isGift){source=giftAtlas;layout=GiftCatalog;index=GiftCatalog.map[kind];}
    else if(ToyAtlas.map[kind]){const [pageKey,i]=ToyAtlas.map[kind];source=page(pageKey);layout={cell:ToyAtlas.cell,columns:ToyAtlas.pages[pageKey].columns};index=i;}
    const canvas=document.createElement('canvas');canvas.width=canvas.height=230;
    if(ready(source)){
      const c=canvas.getContext('2d'),cell=layout.cell,scale=size/166;
      c.imageSmoothingQuality='high';c.translate(115,115);c.scale(scale,scale);
      c.drawImage(source,index%layout.columns*cell,Math.floor(index/layout.columns)*cell,cell,cell,-115,-115,230,230);cache.set(key,canvas);return canvas;
    }
    if(window.ShapeModels[kind]){const render=ShapeMeshes.create({width:230,height:230});render.render([{id:1,kind,x:115,y:115,size,depth:0,orientation:[0,0,0,1]}]);return render.canvas;}
    // A toy page still loading: show the complete toy icon meanwhile.
    const toy=Object.keys(catalog.toys).find(k=>kind.startsWith(k)&&/^d+$/.test(kind.slice(k.length)));
    if(toy&&kind!==toy+'0'&&ready(page('icons')))return sprite(toy+'0',size);
    return canvas;
  }
  function drawToy(c,order,x,y,size=166,alpha=1){let mask=0;catalog.toys[order.kind].slots.forEach((s,i)=>{if(order.missing.includes(s.kind)&&!order.filled.includes(s.kind))mask|=1<<i;});c.save();if(mask){c.globalAlpha=alpha*.32;c.filter='grayscale(.35) brightness(1.15)';c.drawImage(sprite(order.kind+'0',size),x-115,y-115);c.filter='none';}c.globalAlpha=alpha;c.drawImage(sprite(order.kind+mask,size),x-115,y-115);c.restore();}
  // Toys with maskGhosts (disco ball) get one merged, smoothed outline for all their
  // missing parts: the visible gap only, so the border never spills onto the tiers
  // around it and two missing neighbours share one border instead of two.
  function maskGhost(c,toy,order,x,y,size,glow){
    let mask=0;toy.slots.forEach((s,i)=>{if(order.missing.includes(s.kind)&&!order.filled.includes(s.kind))mask|=1<<i;});
    const polys=toy.maskGhosts[mask];if(!polys)return;
    const r=size*.329;c.save();c.translate(x,y);c.beginPath();
    // Smooth closed curve: start at an edge midpoint, bend through each vertex.
    for(const poly of polys){const n=poly.length,mid=i=>{const[a,b]=poly[i%n],[d,e]=poly[(i+1)%n];return[(a+d)/2*r,-(b+e)/2*r];};
      c.moveTo(...mid(0));for(let i=1;i<=n;i++){const[px,py]=poly[i%n];c.quadraticCurveTo(px*r,-py*r,...mid(i));}c.closePath();}
    c.fillStyle=glow?'#ffe58d55':'#244b6266';c.fill();
    // Stroke at double width inside a clip so the dashes sit just inside the gap's edge.
    c.clip();c.lineJoin=c.lineCap='round';c.setLineDash([5,6]);c.lineDashOffset=0;
    c.strokeStyle=glow?'#fff2aef2':'#f4fff9e0';c.lineWidth=4.6;c.stroke();c.restore();
  }
  function ghost(c,slot,x,y,size,glow){
    const r=size*.329;c.save();c.translate(x,y);c.beginPath();
    if(slot.ghost)slot.ghost.forEach(([px,py],i)=>i?c.lineTo(px*r,-py*r):c.moveTo(px*r,-py*r));
    else{c.translate(slot.x*r,-slot.y*r);c.scale(slot.s,slot.s);ShapeModels[slot.kind].outline.forEach(([px,py],i)=>i?c.lineTo(px*r,-py*r):c.moveTo(px*r,-py*r));}
    c.closePath();c.fillStyle=glow?'#ffe58d66':'#244b6275';c.fill();c.setLineDash([4,3]);c.strokeStyle=glow?'#fff2ae':'#f4fff9';c.lineWidth=2.2;c.stroke();c.restore();
  }
  function gift(c,x,y,scale=1,variant=0){const name=GiftCatalog.models[variant%GiftCatalog.models.length];c.save();c.translate(x,y);c.scale(scale,scale);c.drawImage(sprite(name,166),-115,-115);c.restore();}
  function belt(c,now,moving){round(c,-16,538,572,35,7,grad(c,0,538,0,573,[[0,'#f1f6ed'],[.25,'#a1c2cc'],[1,'#628d9e']]));c.save();c.beginPath();c.rect(0,540,540,30);c.clip();c.strokeStyle='#d2e5e6';c.lineWidth=2;for(let x=-100+(moving?now*.065%47:0);x<600;x+=47){c.beginPath();c.moveTo(x,541);c.lineTo(x-19,569);c.stroke();}c.restore();round(c,-9,568,558,48,7,grad(c,0,566,0,618,[[0,'#427c91'],[.5,'#2f627a'],[1,'#57899a']]));for(let i=0;i<5;i++){const x=21+i*124;ellipse(c,x,591,21,21,'#a9ced5');ellipse(c,x,590,17,17,'#6895a6');ellipse(c,x,590,11,11,'#f5cb65');ellipse(c,x-2,587,7,7,'#ffe18a');if(i<4){c.fillStyle='#b9eff2';c.font='bold 25px Arial';c.fillText('››',x+46,599);}}c.fillStyle='#e7f3e9';c.fillRect(0,612,540,4);}
  function pouring(c,game){
    const pour=game.pour,elapsed=game.clock-pour.start;
    // Airborne parts join the physics tray only after reaching their landing positions.
    if(!pour.reduced)for(const drop of pour.parts){
      const p=(elapsed-drop.at)/drop.duration;if(p<0||p>=1||drop.landed)continue;
      const piece=drop.piece,x=333+(piece.x-333)*p,y=734+(piece.y-734)*p*p;
      c.save();c.translate(x,y);c.rotate((1-p)*piece.angle);c.drawImage(sprite(piece.kind,piece.size),-115,-115);c.restore();
    }
    const enter=pour.reduced?1:Math.min(1,elapsed/.28),leave=pour.reduced?0:Math.max(0,(elapsed-1.75)/.4);
    c.save();c.translate(365+(1-enter)**2*220+leave**2*240,715-leave**2*90);c.rotate(pour.reduced?-.35:-.42+Math.sin(Math.min(1,elapsed/1.7)*Math.PI*4)*.035);c.scale(.86,.86);
    c.lineWidth=3;c.strokeStyle='#ad783b';c.lineJoin='round';
    const face=(points,fill)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();c.stroke();};
    face([[-92,-65],[-121,-110],[52,-110],[83,-65]],'#ffe0a0');
    face([[-92,-65],[-122,-25],[-122,40],[-92,65]],'#e7b56d');
    face([[-92,-65],[83,-65],[83,65],[-92,65]],'#8b5c31');
    face([[-92,65],[-121,103],[-72,124],[-43,65]],'#eac181');
    face([[-92,-65],[-43,-40],[-43,90],[-92,65]],'#d39d55');
    face([[-43,-40],[123,-40],[123,90],[-43,90]],grad(c,-43,-40,123,90,[[0,'#eec37d'],[1,'#c38b43']]));
    c.fillStyle='#ffe3a7';c.fillRect(27,-40,26,130);
    round(c,-17,-6,112,61,5,'#fff4d6');c.fillStyle='#315d53';c.textAlign='center';c.font='900 13px system-ui';c.fillText('LINH KIỆN',39,19);c.font='900 11px system-ui';c.fillText('LEVEL '+game.batch,39,39);
    c.restore();
  }
  function draw(game,now){ctx.clearRect(0,0,W,H);ctx.drawImage(bg,0,0);belt(ctx,game.beltDistance/.065,true);
    ctx.save();ctx.beginPath();ctx.rect(0,398,W,218);ctx.clip();
    for(let i=0;i<game.orders.length;i++){const order=game.orders[i];if(!order.active||order.shipped)continue;const x=order.x,y=beltY(order.kind),progress=order.packageAt===null?0:Math.max(0,game.clock-order.packageAt);ellipse(ctx,x,537+BELT_DROP,59,8,'#32687933');
      if(progress<.5){const scale=progress?1+Math.sin(progress/.5*Math.PI)*.1:1;ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);drawToy(ctx,order,0,0,166);const toy=catalog.toys[order.kind],glow=game.selected===i||x>425;if(toy.maskGhosts)maskGhost(ctx,toy,order,0,0,166,glow);else for(const slot of toy.slots)if(order.missing.includes(slot.kind)&&!order.filled.includes(slot.kind))ghost(ctx,slot,0,0,166,glow);ctx.restore();}
      else{const p=Math.min(1,(progress-.5)/.38),s=.25+.75*(1-Math.pow(1-p,3));const giftName=GiftCatalog.models[i%GiftCatalog.models.length],giftY=536+BELT_DROP+GiftCatalog.bottom[giftName]*166*.329;gift(ctx,x,giftY,s,i);if(progress<1.2){for(let j=0;j<5;j++){const a=j*1.256+game.clock*2;star(ctx,x+Math.cos(a)*78,480+BELT_DROP+Math.sin(a)*64,3+Math.sin(progress*5)*3,'#ffe391');}}}
    }
    ctx.restore();
    // Entrance and exit markers stay fixed while toys and gifts travel past.
    ctx.font='900 10px system-ui';ctx.textAlign='center';
    round(ctx,0,410,43,24,[0,7,7,0],'#235e59');ctx.fillStyle='#e4fff2';ctx.fillText('VÀO →',21,426);
    round(ctx,497,410,43,24,[7,0,0,7],'#ad5356');ctx.fillStyle='#fff0d6';ctx.fillText('RA →',519,426);
    ctx.drawImage(tray,0,0);ctx.save();ctx.beginPath();ctx.roundRect(57,709,423,322,23);ctx.clip();ctx.drawImage(game.trayRenderer.canvas,40,690);ctx.restore();
    if(!game.tray.length&&!game.pour){ctx.save();ctx.textAlign='center';ctx.fillStyle='#a6b9bc';ctx.font='800 17px system-ui';ctx.fillText(game.phase==='playing'||game.phase==='complete'?'ĐÃ GHÉP ĐỦ MẢNH':'KHAY ĐANG TRỐNG',270,862);ctx.font='13px system-ui';ctx.fillStyle='#7d959b';ctx.fillText(game.phase==='playing'?'Đang đóng gói và gửi quà…':game.phase==='complete'?'Tất cả quà đã được gửi đi':'Chờ máy quay để nhận linh kiện',270,889);ctx.restore();}
    if(game.highlight&&game.clock<game.highlight.until){const p=game.tray.find(p=>p.id===game.highlight.id);if(p){const focus=game.trayRenderer.focus(p);if(focus){ctx.save();ctx.strokeStyle='#fff7ba';ctx.lineWidth=3;ctx.setLineDash([7,5]);ctx.shadowColor='#ffed61';ctx.shadowBlur=14;ctx.beginPath();ctx.ellipse(p.x,p.y,44,44,now*.002,0,Math.PI*2);ctx.stroke();star(ctx,p.x+40,p.y-25,10,'#fff3a2');ctx.restore();}}}
    if(game.pour)pouring(ctx,game);
    if(game.drag){const {piece,x,y}=game.drag;ctx.save();ctx.shadowColor='#ffed8c';ctx.shadowBlur=18;ctx.drawImage(sprite(piece.kind,160),x-115,y-115);ctx.restore();}
    for(const f of game.flights){const p=Math.min(1,(game.clock-f.at)/f.duration),e=1-Math.pow(1-p,3),x=f.from.x+(f.to.x-f.from.x)*e,y=f.from.y+(f.to.y-f.from.y)*e-Math.sin(p*Math.PI)*75;ctx.drawImage(sprite(f.kind,f.fromSize+(f.toSize-f.fromSize)*e),x-115,y-115);star(ctx,x+30,y-20,6,'#fff3aa');}
    for(const p of game.particles){ctx.save();ctx.globalAlpha=Math.max(0,1-p.age/p.life);star(ctx,p.x,p.y,p.size,p.color);ctx.restore();}

  }
  function reel(canvas,kind,offset=0,nextKind=kind){const c=canvas.getContext('2d');c.clearRect(0,0,118,84);if(!kind){c.textAlign='center';c.fillStyle='#3b8a7f';c.font='900 64px "Lilita One",system-ui';c.shadowColor='#ffe7b8';c.shadowOffsetY=3;c.fillText('?',59,66);c.shadowOffsetY=0;return;}const icon=(toy,y)=>{c.save();c.translate(59,y);c.scale(.49,.49);c.drawImage(sprite(toy+'0',155),-115,-115);c.restore();};icon(kind,47+offset);if(offset)icon(nextKind,47+offset-84);}
  // The slot drum shows a front face and the foreshortened faces above/below it.
  // Its angle follows the same game clock as the reveal, including pause/restart.
  const slotColor=['#eee5d6','#d8ccba','#f6edde'];
  // Opaque bounds [x,y,w,h] of sprite(kind+'0',155), measured over http. Used when index.html is opened
  // from file:// (canvas tainted, getImageData throws). Re-measure if the toy atlas is re-rendered.
  const slotBounds={car:[49,82,132,66],robot:[65,43,99,129],rocket:[57,50,116,129],bear:[61,50,108,130],plane:[49,53,132,124],train:[49,65,132,100],bus:[49,62,132,106],iceCreamTruck:[49,55,132,120],ambulance:[49,62,132,106],sportsCar:[49,91,132,48],cadillac:[49,85,132,61],hotdogCart:[59,51,112,129],spaceship:[49,84,132,62],koala:[53,51,124,128],panda:[61,51,108,129],polarBear:[58,51,114,128],tiger:[69,50,92,129],penguin:[60,50,110,130],doll:[73,50,84,130],chicken:[94,51,42,128],cactus:[68,50,94,129],lego:[49,71,132,88],yoyo:[59,51,112,128],discoBall:[52,50,126,130],poolBall:[50,51,130,128],billiardBall:[50,51,130,128],easterEgg:[68,50,94,130],};
  // Trim atlas padding so every silhouette fills its window without stretching.
  function slotIcon(kind){
    const key='slot-icon:'+kind;if(cache.has(key))return cache.get(key);
    const canvas=sprite(kind+'0',155),{width,height}=canvas;
    let left=width,top=height,right=-1,bottom=-1;
    // Opened from file://, Chrome taints the canvas and getImageData throws; fall back to the untrimmed sprite.
    try{const data=canvas.getContext('2d').getImageData(0,0,width,height).data;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>12){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}}catch(e){}
    const known=slotBounds[kind]||[49,50,132,130];
    const icon=right<left?{canvas,x:known[0],y:known[1],w:known[2],h:known[3]}:{canvas,x:left,y:top,w:right-left+1,h:bottom-top+1};
    cache.set(key,icon);return icon;
  }
  function slotReel(canvas,kind,offset=0,nextKind=null){
    slotFrames.set(canvas,[kind,offset,nextKind]);
    // An array is the visible strip, top to bottom (rows -2..2), so neighbours stay continuous while spinning.
    const strip=Array.isArray(kind)?kind:null;if(strip)kind=strip[2];
    const c=canvas.getContext('2d'),keys=Object.keys(catalog.toys),index=Math.max(0,keys.indexOf(kind));
    c.setTransform(canvas.width/118,0,0,canvas.height/154,0,0);c.clearRect(0,0,118,154);
    c.fillStyle='#555563';c.fillRect(0,0,118,154);
    const R=122,FH=2*R*Math.sin(.4),project=a=>77+Math.sin(Math.max(-Math.PI/2,Math.min(Math.PI/2,a)))*R;
    for(let row=-2;row<=2;row++){
      const angle=(row+offset/84)*.8;if(Math.abs(angle)>1.9)continue;
      const top=project(angle-.4),bottom=project(angle+.4),height=bottom-top;
      if(height<1)continue;
      const toy=strip?strip[row+2]:row===0?kind:row===-1&&nextKind?nextKind:keys[(index+row+keys.length)%keys.length];
      const color=slotColor;
      const inset=1+Math.abs(Math.sin(angle))*6;
      c.save();c.translate(inset,top);c.scale((118-inset*2)/118,height/FH);
      c.lineWidth=1.6;
      round(c,0,0,118,FH,4,grad(c,0,0,0,FH,[[0,color[0]],[.82,color[1]],[1,color[0]]]),'#7f6d63');
      round(c,3,2,112,FH-4,6,color[2]);
      c.save();c.beginPath();c.roundRect(3,2,112,FH-4,6);c.clip();
      c.fillStyle=grad(c,0,2,0,FH-2,[[0,'#6a60451c'],[.16,'#6a604500'],[1,'#ffffff18']]);c.fillRect(3,2,112,FH-4);c.restore();
      c.lineWidth=1.5;round(c,3,2,112,FH-4,6,null,'#8d806b66');
      if(toy){const icon=slotIcon(toy),scale=.85*Math.min(108/icon.w,(FH-8)/icon.h),w=icon.w*scale,h=icon.h*scale;c.drawImage(icon.canvas,icon.x,icon.y,icon.w,icon.h,(118-w)/2,(FH-h)/2,w,h);}
      else{c.fillStyle='#84775e';c.font='900 56px "Lilita One",system-ui';c.textAlign='center';c.fillText('?',59,FH/2+20);}
      c.restore();
    }
    c.fillStyle=grad(c,0,0,0,154,[[0,'#25203366'],[.26,'#25203300'],[.74,'#25203300'],[1,'#25203380']]);c.fillRect(0,0,118,154);
  }
  window.FactoryArt={draw,reel,slotReel,sprite,drawToy,gift,beltY,preload,onPage};
})();
