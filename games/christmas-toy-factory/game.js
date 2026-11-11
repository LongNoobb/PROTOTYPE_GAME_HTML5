(() => {
  'use strict';
  const $=id=>document.getElementById(id), catalog=window.ToyCatalog, art=window.FactoryArt, sfx=window.BakerySfx;
  // Mirrored (left/right) and repeated (front/middle/rear) parts are one piece: any copy fits any matching slot.
  // Mirrored (left/right) and repeated (front/middle/rear) parts are one piece: any copy fits any matching slot.
  const partGroup=catalog.groups||{},groupName={};for(const [k,g] of Object.entries(partGroup))groupName[k]=catalog.groupNames[g];
  const samePart=(a,b)=>(partGroup[a]||a)===(partGroup[b]||b),partName=k=>groupName[k]||catalog.names[k];
  const ui=window.LetterPressUI;
  $('settings').innerHTML=ui.icons.gear;
  $('gift-icon').innerHTML=ui.icons.trophy;
  const missions=window.FactoryMissions;
  const kinds=Object.keys(catalog.toys), reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const state={phase:'ready',clock:0,batch:1,total:0,orders:[],tray:[],flights:[],particles:[],selected:null,highlight:null,drag:null,sound:true,mission:null,beltDistance:0,beltSpeed:26,cruiseSpeed:26,shippingBoost:false,holdBoost:false,stats:{fits:0,wrong:0,hints:0,shuffles:0},roundStart:0};
  const renderer=ShapeMeshes.create({left:40,top:690,width:460,height:350,round:17,picking:true});state.trayRenderer=renderer;
  let physics, dirty=true, last=performance.now(), hitAt=0, assistAt=0, toastUntil=0, pressed=null, id=0, paused=false;
  try{const save=JSON.parse(localStorage.getItem('christmas-toy-factory-v1'));if(save){state.total=Number(save.total)||0;state.batch=Math.min(missions.length,Math.max(1,Math.floor(Number(save.batch)||1)));state.sound=save.sound!==false;}}catch{}
  const requestedLevel=Number(new URLSearchParams(location.search).get('level'));
  if(Number.isInteger(requestedLevel)&&requestedLevel>=1&&requestedLevel<=missions.length)state.batch=requestedLevel;
  function persist(){try{localStorage.setItem('christmas-toy-factory-v1',JSON.stringify({total:state.total,batch:state.batch,sound:state.sound}));}catch{}}
  function fit(){const v=$('viewport');$('stage').style.setProperty('--scale',Math.min(v.clientWidth/540,v.clientHeight/1172));}
  function rand(a,b){return a+Math.random()*(b-a);}function pick(a){return a[Math.floor(Math.random()*a.length)];}function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  const ENTRY=-85, EXIT=625, SPACING=185;
  function order(kind,missing,i){return{kind,missing,filled:[],reserved:[],packageAt:null,credited:false,spawnAt:i*SPACING,x:ENTRY-i*SPACING,active:false,shipped:false};}
  function missionOrders(){return state.mission.orders.map((o,i)=>order(o.kind,[...o.missing],i));}
  function clearTray(){state.tray=[];physics=ShapeTray.create(state.tray);dirty=true;id=0;}
  function prepareParts(){
    const stock=state.orders.flatMap(o=>o.missing);
    shuffle(stock);
    const positions=shuffle(Array.from({length:18},(_,i)=>[99+(i%6)*67,759+Math.floor(i/6)*111]));
    return stock.map((kind,i)=>{const [x,y]=positions[i%18];return {id:++id,kind,x:x+rand(-17,17),y:y+rand(-22,22),size:rand(163,187),angle:rand(-2.5,2.5),pose:i%5===0?1:0,tier:Math.floor(i/18)};});
  }
  function status(message){$('instruction').textContent=message;}
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;toastUntil=state.clock+2.2;}
  function sound(kind){sfx.play(kind);}
  function setSound(){sfx.setEnabled(state.sound);$('sound').textContent=state.sound?'♫':'♪';$('sound').setAttribute('aria-label',state.sound?'Tắt âm thanh':'Bật âm thanh');$('sound').setAttribute('aria-pressed',String(!state.sound));}
  function reels(types){const container=document.querySelector('.reels');container.style.setProperty('--slots',types.length);container.style.setProperty('--reel-cols',Math.max(3,types.length));container.replaceChildren();for(const kind of types){const reel=document.createElement('div');reel.className='reel';reel.innerHTML='<canvas width="236" height="308" aria-hidden="true"></canvas>';container.append(reel);art.slotReel(reel.querySelector('canvas'),null);}}
  function updateStations(){
    const buttons=Array.from($('stations').children);
    state.orders.forEach((o,i)=>{let b=buttons[i];if(!b){b=document.createElement('button');b.className='station';b.dataset.index=i;b.innerHTML='<span class="toy-name"></span><span class="part-dots"></span><span class="deadline"></span>';b.addEventListener('click',()=>selectStation(i));$('stations').append(b);}b.classList.toggle('selected',state.selected===i);b.classList.toggle('ready',o.packageAt!==null);b.classList.toggle('urgent',o.packageAt===null&&o.x>425);b.querySelector('.toy-name').textContent=o.packageAt!==null?'ĐÃ GÓI QUÀ':catalog.toys[o.kind].name.toUpperCase();b.querySelector('.part-dots').innerHTML=o.missing.map(k=>'<i class="'+(o.filled.includes(k)?'done':'')+'"></i>').join('');b.setAttribute('aria-label',`${catalog.toys[o.kind].name}: ${o.packageAt!==null?'đã đóng gói':o.missing.filter(k=>!o.filled.includes(k)).map(k=>catalog.names[k]).join(', ')}`);b.disabled=paused||!canAssemble(o);});
    $('batch-label').textContent='LEVEL '+String(state.batch).padStart(2,'0')+' / '+missions.length;$('batch-count').innerHTML=state.orders.filter(o=>o.credited).length+' / '+state.mission.orders.length+' <i>QUÀ ĐÃ GÓI</i>';$('total-gifts').textContent=state.total;
    const remaining=state.orders.reduce((a,o)=>a+o.missing.length-o.filled.length-o.reserved.length,0);$('parts-count').textContent=state.phase==='playing'?`CÒN ${remaining} MẢNH CẦN TÌM`:'SẴN SÀNG LẮP RÁP';
    $('hint').disabled=$('shuffle').disabled=state.phase!=='playing';
    moveStations();
  }
  function moveStations(){for(const b of $('stations').children){const o=state.orders[+b.dataset.index];b.hidden=!o.active||o.shipped||o.x<-60||o.x>600;b.style.left=(o.x-78)+'px';b.classList.toggle('urgent',o.packageAt===null&&o.x>425);b.querySelector('.deadline').textContent=o.packageAt===null?Math.max(0,Math.ceil((EXIT-o.x)/state.beltSpeed))+'s':'';b.disabled=paused||!canAssemble(o);}}
  function canAssemble(o){return !!o&&state.phase==='playing'&&o.active&&!o.shipped&&o.x>=25&&o.x<=565&&o.packageAt===null;}
  function selectStation(i){const o=state.orders[i];if(paused||!canAssemble(o))return;state.selected=state.selected===i?null:i;status('Cần tìm: '+o.missing.filter(k=>!o.filled.includes(k)).map(k=>partName(k).toLowerCase()).join(' + '));sound('click');updateStations();}
  function reset(){
    state.phase='ready';state.clock=0;state.mission=missions[state.batch-1];state.orders=[];state.flights=[];state.particles=[];cancelDrag();state.selected=null;state.highlight=null;state.beltDistance=0;state.cruiseSpeed=26+Math.min(12,(state.batch-1)*.65);state.beltSpeed=state.cruiseSpeed;state.shippingBoost=false;setBoost(false);state.stats={fits:0,wrong:0,hints:0,shuffles:0};toastUntil=0;hitAt=0;
    state.pour=null;state.spinStart=0;state.reelsStopped=0;setLever(0);$('machine').classList.remove('spinning');
    $('stations').replaceChildren();$('piece-buttons').replaceChildren();$('toast').hidden=true;$('spin').disabled=false;$('spin').textContent='QUAY ĐỒ CHƠI';
    art.preload(state.mission.types);$('mission-title').textContent=state.mission.title;$('machine-caption').textContent='Cần ghép '+state.mission.toyCount+' đồ chơi trước khi ra hết chuyền';
    clearTray();reels(state.mission.types);
    status('Băng chuyền chạy liên tục. Sẵn sàng ghép đồ chơi!');updateStations();syncHits();spin();
  }
  function spin(){if(state.phase!=='ready')return;sound('spin');state.phase='spinning';state.spinStart=state.clock;state.reelsStopped=0;$('machine').classList.add('spinning');$('machine').setAttribute('aria-busy','true');$('spin').disabled=true;$('spin').textContent='ĐANG QUAY ĐỒ CHƠI…';$('machine-caption').textContent='Đang quay '+state.mission.types.length+' loại đồ chơi · Cần ghép '+state.mission.toyCount+' món';status('Gạt tay cầm! Chờ các ô dừng để nhận đồ chơi.');updateStations();updateSpin();}
  // pull 0 = handle up, 1 = pulled down toward the player (150deg). Drawn as a 2D projection so it reads on a flat cabinet.
  function setLever(pull){const a=pull*150*Math.PI/180,lever=$("lever");lever.style.setProperty("--c",Math.cos(a).toFixed(3));lever.style.setProperty("--s",Math.sin(a).toFixed(3));lever.classList.toggle("pulled",Math.cos(a)<0);}
  function updateSpin(){
    const elapsed=(state.clock-state.spinStart)/(reduce.matches?.3:1);
    // Pull down fast, hold, then spring back with a small overshoot.
    let pull;if(elapsed<.22)pull=1-Math.pow(1-elapsed/.22,3);else if(elapsed<.38)pull=1;else{const t=Math.min(1,(elapsed-.38)/.5),s=1.6;pull=1-(1+(s+1)*Math.pow(t-1,3)+s*Math.pow(t-1,2));}
    setLever(pull);
    let stopped=0;
    document.querySelectorAll('.reel').forEach((reel,i)=>{
      const kind=state.mission.types[i],types=state.mission.types.length,p=Math.min(1,Math.max(0,(elapsed-.25)/(1.05+i*.22))),travel=12+i*2,position=p===1?travel:travel*(1-Math.pow(1-p,3)),step=Math.floor(position);
      // One fixed strip per reel: item `travel` is the result, the item above the centre is always the next one to drop in.
      const item=j=>{if(j===travel)return kind;let k=kinds[((j+i*3)%kinds.length+kinds.length)%kinds.length];if(k===kind)k=kinds[(kinds.indexOf(k)+1)%kinds.length];return k;};
      const strip=[item(step+2),item(step+1),item(step),item(step-1),item(step-2)];
      const settled=p===1;reel.classList.toggle('settled',settled);
      art.slotReel(reel.querySelector('canvas'),strip,settled?0:(position%1)*84);
      if(settled&&reel.dataset.kind!==kind){reel.dataset.kind=kind;reel.setAttribute('aria-label','Loại đồ chơi '+(i+1)+' trên '+types+': '+catalog.toys[kind].name);}
      if(settled)stopped++;
    });
    if(stopped>state.reelsStopped){sound('click');state.reelsStopped=stopped;}
    if(elapsed>=.25+1.05+(state.mission.types.length-1)*.22+.45)startPour();
  }
  function startPour(){
    state.phase='pouring';state.orders=missionOrders();
    const parts=prepareParts();
    state.pour={start:state.clock,duration:reduce.matches?.08:2.15,reduced:reduce.matches,parts:parts.map((piece,i)=>({piece,at:reduce.matches?0:.3+i/Math.max(1,parts.length-1)*.9,duration:reduce.matches?.02:.5,landed:false}))};
    $('machine').classList.remove('spinning');$('machine').setAttribute('aria-busy','false');setLever(0);
    $('spin').textContent='ĐANG ĐỔ LINH KIỆN…';status('Hộp linh kiện đã tới! Đợi đổ xong rồi bắt đầu ghép.');updateStations();
  }
  function updatePour(){
    const elapsed=state.clock-state.pour.start;
    for(const drop of state.pour.parts){if(!drop.landed&&elapsed>=drop.at+drop.duration){drop.landed=true;state.tray.push(drop.piece);physics.add(drop.piece,12);dirty=true;}}
    if(elapsed>=state.pour.duration){state.pour=null;startConveyor();}
  }
  function startConveyor(){state.phase='playing';state.roundStart=state.clock;assistAt=state.clock+2.2;$('spin').textContent='BĂNG CHUYỀN ĐANG CHẠY →';$('machine-caption').textContent=state.mission.types.length+' loại · Cần ghép '+state.orders.length+' đồ chơi ('+state.mission.parts+' mảnh)';status('Đồ chơi đang tới! Chạm mảnh đúng hoặc kéo vào đồ chơi.');updateStations();}
  function openSlot(o,kind){if(!canAssemble(o))return null;const open=o.missing.filter(k=>samePart(k,kind)&&!o.filled.includes(k)&&!o.reserved.includes(k));return open.includes(kind)?kind:(open[0]??null);}
  function available(o,kind){return openSlot(o,kind)!==null;}
  function targetFor(kind,forced){if(forced!==undefined)return available(state.orders[forced],kind)?forced:-1;if(state.selected!==null&&available(state.orders[state.selected],kind))return state.selected;return state.orders.findIndex(o=>available(o,kind));}
  function burst(x,y,count=17){for(let i=0;i<count;i++){const a=rand(0,Math.PI*2),v=rand(30,140);state.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-50,age:0,life:rand(.45,1),size:rand(3,8),color:pick(['#fff0ad','#ffd061','#b0f1e4','#ffffff'])});}}
  function choose(piece,forced){if(paused||state.phase!=='playing'||!state.tray.includes(piece))return false;const i=targetFor(piece.kind,forced);if(i<0){state.stats.wrong++;sound('wait');toast(forced===undefined?'Tìm mảnh khớp với đồ chơi đang trên chuyền!':'Chưa đúng đồ chơi. Hãy nhìn đường viền còn thiếu.');return false;}
    $('toast').hidden=true;toastUntil=0;
    const o=state.orders[i],slotKind=openSlot(o,piece.kind),slot=catalog.toys[o.kind].slots.find(s=>s.kind===slotKind),r=166*.329,y=art.beltY(o.kind);
    const from=state.drag?{x:state.drag.x,y:state.drag.y}:{x:piece.x,y:piece.y};
    state.tray.splice(state.tray.indexOf(piece),1);physics.remove(piece);o.reserved.push(slotKind);state.flights.push({kind:slotKind,from,to:{x:o.x+slot.x*r,y:y-slot.y*r},offsetX:slot.x*r,fromSize:piece.size,toSize:166*slot.s,at:state.clock,duration:reduce.matches?.04:.48,order:i});state.highlight=null;dirty=true;sound('lift');syncHits();updateStations();return true;
  }
  function land(f){const o=state.orders[f.order];o.reserved=o.reserved.filter(k=>k!==f.kind);o.filled.push(f.kind);state.stats.fits++;sound('fit');burst(f.to.x,f.to.y,12);if(o.missing.every(k=>o.filled.includes(k))){o.packageAt=state.clock;status('Hoàn hảo! Gói một món quà Giáng sinh…');sound('row');if(state.selected===f.order)state.selected=null;}else status('Khớp rồi! Tìm tiếp mảnh còn thiếu nhé.');updateStations();}
  function neededPieces(){return state.tray.filter(p=>state.orders.some(o=>available(o,p.kind)));}
  function revealNeeded(force=false){const needed=neededPieces();if(!needed.length)return null;const visible=needed.filter(p=>renderer.exposed(p));if(visible.length&&!force)return pick(visible);const piece=visible.length?pick(visible):needed.sort((a,b)=>b.depth-a.depth)[0];physics.uncover(piece,force?3:2);dirty=true;return piece;}
  function hint(){if(paused)return;if(state.phase!=='playing')return;const p=revealNeeded(true);if(!p)return;state.stats.hints++;state.highlight={id:p.id,until:state.clock+4.5};status('Tìm '+partName(p.kind).toLowerCase()+' đang được đánh dấu trong hộp.');sound('click');}
  function shake(){if(paused)return;if(state.phase!=='playing')return;state.stats.shuffles++;for(const p of state.tray)physics.poke(p,rand(-2.8,2.8),rand(-1.9,1.9),rand(2,4));dirty=true;sound('lift');toast('Xóc nhẹ một chút, mảnh mới lộ ra!');}
  function syncHits(){const layer=$('piece-buttons'),existing=new Map(Array.from(layer.children,b=>[+b.dataset.id,b]));const active=document.activeElement;for(const p of state.tray){if(state.phase!=='playing'||!renderer.exposed(p))continue;let b=existing.get(p.id);if(!b){b=document.createElement('button');b.className='piece-hit';b.dataset.id=p.id;b.dataset.kind=p.kind;b.addEventListener('click',()=>choose(p));b.addEventListener('focus',()=>{state.highlight={id:p.id,until:state.clock+20};});layer.append(b);}existing.delete(p.id);const f=renderer.focus(p);b.setAttribute('aria-label',partName(p.kind));if(f)Object.assign(b.style,{left:f.x+'px',top:f.y+'px',width:f.w+'px',height:f.h+'px'});}for(const b of existing.values())b.remove();if(active?.classList.contains('piece-hit')&&!active.isConnected){(layer.firstElementChild||$('hint')).focus({preventScroll:true});}}
  function modalTitle(title,subtitle='Toy Factory'){$('modal-title').textContent=title;$('modal-subtitle').textContent=subtitle;}
  function showLevels(){
    paused=true;cancelDrag();modalTitle('Chọn level',kinds.length+' đồ chơi · '+missions.length+' mission');
    $('modal-content').innerHTML='<div class="level-list toy-level-list"><div class="level-choices">'+missions.map(m=>'<button class="level-choice '+(m.level===state.batch?'current':'')+'" data-level="'+m.level+'" aria-label="Level '+m.level+': '+m.title+'"><canvas width="118" height="84" aria-hidden="true"></canvas><b>LEVEL '+m.level+'</b><span>'+m.title+'</span></button>').join('')+'</div></div><div class="actions"><button class="action glossy" id="level-back">Quay lại</button></div>';
    $('modal').showModal();
    for(const button of $('modal-content').querySelectorAll('[data-level]')){const level=Number(button.dataset.level);art.reel(button.querySelector('canvas'),missions[level-1].orders[0].kind);button.onclick=()=>{state.batch=level;persist();$('modal').close();paused=false;reset();};}
    $('level-back').onclick=closeModal;
  }
  function complete(){state.phase='complete';cancelDrag();syncHits();persist();const seconds=Math.round(state.clock-state.roundStart);modalTitle('Mission hoàn thành!','Level '+state.batch+' · '+state.mission.title);$('modal-content').innerHTML='<div class="reward">'+ui.icons.trophy+'</div><div class="panel-copy"><p>'+state.orders.length+' món đồ chơi đã được lắp hoàn chỉnh, gói thật xinh và gửi tới ông già Noel.</p></div><div class="result"><span><b>'+state.orders.length+'</b>quà đã gửi</span><span><b>'+state.stats.fits+'</b>mảnh đã lắp</span><span><b>'+seconds+'s</b>thời gian</span></div><div class="actions"><button class="action glossy" id="next">'+(state.batch===missions.length?'CHƠI LẠI TỪ LEVEL 1':'LEVEL TIẾP THEO →')+'</button></div>';$('modal').showModal();$('next').onclick=()=>{state.batch=state.batch%missions.length+1;persist();$('modal').close();paused=false;reset();spin();};updateStations();}
  function showHelp(){paused=true;cancelDrag();modalTitle('Cách chơi','Nhanh tay trên băng chuyền');$('modal-content').innerHTML='<div class="panel-copy guide-copy"><p><b>1. Quay máy đồ chơi</b><br>Vào màn, tay cầm tự gạt và các ô slot quay rồi dừng lần lượt. Số ô cho biết màn có bao nhiêu loại đồ chơi; số đồ chơi phải ghép hiện dưới máy và ở mục QUÀ ĐÃ GÓI. Mỗi món cần ghép 1–4 mảnh. Quay xong, đồ chơi lần lượt xuất hiện từ bên trái. Băng chuyền luôn di chuyển sang phải, càng lên level càng nhanh.</p><p><b>2. Ghép trước cửa ra</b><br>Nhìn đường viền nét đứt trên đồ chơi. Chạm mảnh đúng trong khay để tự lắp, hoặc kéo thả vào đồ chơi đang chạy. Số giây dưới mỗi món là thời gian còn lại.</p><p><b>3. Đóng hộp quà</b><br>Ghép đủ mảnh, đồ chơi tự được đóng thành hộp có nơ và tiếp tục chạy ra cửa. Gửi đủ số hộp theo mục tiêu của màn để qua level. Nếu đồ chơi chưa hoàn chỉnh ra hết chuyền, hãy chơi lại!</p><p class="help-keyboard">Gợi ý đánh dấu mảnh cần tìm. Xóc hộp để lộ mảnh bên dưới.<br>Tab chọn mảnh, Enter để lắp. Mở hướng dẫn hoặc cài đặt để tạm dừng.</p></div><div class="actions"><button class="action glossy" id="understood">VÀO XƯỞNG NÀO!</button></div>';$('modal').showModal();$('understood').onclick=closeModal;}
  function showSettings(){paused=true;cancelDrag();modalTitle('Cài đặt');$('modal-content').innerHTML='<div class="setting-row"><span>Âm thanh</span><button class="toggle" id="sound-toggle" aria-pressed="'+state.sound+'">'+(state.sound?'BẬT':'TẮT')+'</button></div><p class="settings-help">Tìm linh kiện, lắp đồ chơi và chuẩn bị những món quà Giáng sinh.</p><div class="actions"><button class="action glossy" id="settings-guide">Cách chơi</button><button class="action glossy" id="resume">Tiếp tục</button></div>';$('modal').showModal();$('sound-toggle').onclick=()=>{state.sound=!state.sound;setSound();persist();$('sound-toggle').textContent=state.sound?'BẬT':'TẮT';$('sound-toggle').setAttribute('aria-pressed',String(state.sound));sound('click');};$('settings-guide').onclick=showHelp;$('resume').onclick=closeModal;}
  function closeModal(){if(state.phase==='failed'){reset();}else if(state.phase==='complete'){state.batch=state.batch%missions.length+1;persist();reset();}$('modal').close();paused=false;}
  function point(e){const rect=$('world').getBoundingClientRect();return{x:(e.clientX-rect.left)*540/rect.width,y:(e.clientY-rect.top)*1172/rect.height};}
  $('world').addEventListener('pointerdown',e=>{if(state.phase!=='playing'||paused)return;const p=point(e),piece=renderer.pick(p.x,p.y);if(!piece)return;pressed={piece,x:p.x,y:p.y,pointer:e.pointerId};$('world').setPointerCapture(e.pointerId);e.preventDefault();});
  $('world').addEventListener('pointermove',e=>{const p=point(e);if(pressed){if(!state.drag&&Math.hypot(p.x-pressed.x,p.y-pressed.y)>8){state.drag={piece:pressed.piece,x:p.x,y:p.y};sound('lift');dirty=true;}if(state.drag)Object.assign(state.drag,p);}else $('world').style.cursor=state.phase==='playing'&&renderer.pick(p.x,p.y)?'grab':'';});
  $('world').addEventListener('pointerup',e=>{if(!pressed||pressed.pointer!==e.pointerId)return;if(!paused&&state.phase==='playing'){if(state.drag){const p=point(e),candidates=state.orders.map((o,i)=>({o,i})).filter(({o})=>canAssemble(o)&&p.y>385&&p.y<593&&Math.abs(p.x-o.x)<83).sort((a,b)=>Math.abs(p.x-a.o.x)-Math.abs(p.x-b.o.x));if(candidates.length)choose(pressed.piece,candidates[0].i);else toast('Kéo mảnh lên đồ chơi đang chạy trên băng chuyền.');}else choose(pressed.piece);}cancelDrag();});
  $('world').addEventListener('pointercancel',cancelDrag);
  // Hold-to-speed-up: belt ramps to 3x cruise while pressed, eases back on release.
  function setBoost(on){on=!!on&&state.phase==='playing'&&!paused&&!state.shippingBoost;if(state.holdBoost===on)return;state.holdBoost=on;$('boost').classList.toggle('held',on);if(on)sound('lift');}
  {const b=$('boost');b.addEventListener('pointerdown',e=>{if(b.disabled)return;b.setPointerCapture(e.pointerId);setBoost(true);e.preventDefault();});for(const t of['pointerup','pointercancel','lostpointercapture'])b.addEventListener(t,()=>setBoost(false));b.addEventListener('contextmenu',e=>e.preventDefault());b.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){setBoost(true);e.preventDefault();}});b.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter')setBoost(false);});b.addEventListener('blur',()=>setBoost(false));addEventListener('blur',()=>setBoost(false));}
  $('world').addEventListener('lostpointercapture',cancelDrag);
  $('spin').onclick=spin;$('hint').onclick=hint;$('shuffle').onclick=shake;$('help').onclick=showHelp;$('settings').onclick=showSettings;$('batch-label').onclick=showLevels;$('close').onclick=closeModal;$('restart').onclick=()=>{if($('modal').open)$('modal').close();paused=false;reset();sound('click');};$('sound').onclick=()=>{state.sound=!state.sound;setSound();persist();sound('click');};
  $('modal').addEventListener('cancel',e=>{e.preventDefault();closeModal();});document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden)cancelDrag();});addEventListener('resize',fit);
  function fail(o){
    state.phase='failed';cancelDrag();state.highlight=null;syncHits();updateStations();
    status('Đồ chơi ra hết chuyền khi chưa ghép xong!');sound('wait');
    modalTitle('Chưa kịp rồi!','Level '+state.batch+' · Thử lại nhé');
    $('modal-content').innerHTML='<div class="panel-copy"><p>'+catalog.toys[o.kind].name+' đã ra hết băng chuyền khi còn thiếu mảnh. Hãy ưu tiên đồ chơi gần cửa ra trước!</p></div><div class="result"><span><b>'+state.orders.filter(o=>o.shipped).length+' / '+state.orders.length+'</b>quà đã gửi</span><span><b>'+state.stats.fits+'</b>mảnh đã lắp</span></div><div class="actions"><button class="action glossy" id="retry">CHƠI LẠI →</button></div>';
    $('modal').showModal();$('retry').onclick=()=>{$('modal').close();paused=false;reset();spin();};
  }
  function cancelDrag(){if(pressed&&$('world').hasPointerCapture(pressed.pointer))$('world').releasePointerCapture(pressed.pointer);pressed=null;state.drag=null;dirty=true;}
  function updateConveyor(dt){
    const target=state.shippingBoost?state.cruiseSpeed*6:state.holdBoost?state.cruiseSpeed*3:state.cruiseSpeed,rate=state.cruiseSpeed*(state.shippingBoost||state.holdBoost?10:6)*dt;state.beltSpeed+=Math.max(-rate,Math.min(rate,target-state.beltSpeed));
    state.beltDistance+=state.beltSpeed*dt;
    for(const o of state.orders){if(o.shipped)continue;o.active=state.beltDistance>=o.spawnAt;o.x=ENTRY+state.beltDistance-o.spawnAt;}
    // Follow the moving attachment slot until the part lands.
    for(let i=state.flights.length-1;i>=0;i--){const f=state.flights[i];f.to.x=state.orders[f.order].x+f.offsetX;if(state.clock-f.at>=f.duration){state.flights.splice(i,1);land(f);}}
    for(const o of state.orders){
      if(!o.active||o.shipped)continue;
      if(o.packageAt!==null&&!o.credited&&state.clock-o.packageAt>1.1){o.credited=true;state.total++;persist();burst(o.x,480,25);sound('coin');updateStations();}
      if(o.x>=EXIT){if(o.packageAt===null){fail(o);return;}if(o.credited){o.shipped=true;updateStations();}}
    }
    if(!state.shippingBoost&&state.orders.length&&state.orders.every(o=>o.credited)){
      state.shippingBoost=true;cancelDrag();state.highlight=null;
      $('spin').textContent='TĂNG TỐC GỬI QUÀ »';status('Đã gói đủ quà! Tăng tốc băng chuyền gửi quà đi!');sound('row');
    }
    if(state.selected!==null&&!canAssemble(state.orders[state.selected])){state.selected=null;updateStations();}
    moveStations();if(state.orders.every(o=>o.shipped))complete();
  }
  function frame(now){const dt=Math.min(.04,Math.max(0,(now-last)/1000));last=now;if(!paused&&!document.hidden){
      if(state.phase!=='complete'&&state.phase!=='failed')state.clock+=dt;
      if(state.phase==='spinning')updateSpin();
      if(state.phase==='pouring')updatePour();
      {const off=state.phase!=='playing'||state.shippingBoost;if($('boost').disabled!==off){$('boost').disabled=off;if(off)setBoost(false);}}
      if(state.phase==='playing')updateConveyor(dt);
      if(physics&&(state.phase==='playing'||state.phase==='pouring')){if(physics.update(dt))dirty=true;}
      if(dirty){renderer.render(state.drag?state.tray.filter(p=>p!==state.drag.piece):state.tray);dirty=false;}
      if(state.clock>hitAt){syncHits();hitAt=state.clock+.3;}
      if(state.phase==='playing'&&state.clock>assistAt&&!state.drag){revealNeeded();assistAt=state.clock+2.2;}
      for(const p of state.particles){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=90*dt;}state.particles=state.particles.filter(p=>p.age<p.life);if(toastUntil&&state.clock>toastUntil){$('toast').hidden=true;toastUntil=0;}
    }
    art.draw(state,now);requestAnimationFrame(frame);
  }
  // Read-only diagnostics for reproducible playtests; actions remain real UI inputs.
  window.FactoryDebug={snapshot:()=>({phase:state.phase,paused:paused||document.hidden,batch:state.batch,total:state.total,clock:state.clock,beltDistance:state.beltDistance,beltSpeed:state.beltSpeed,cruiseSpeed:state.cruiseSpeed,shippingBoost:state.shippingBoost,holdBoost:state.holdBoost,spinElapsed:state.phase==='spinning'?state.clock-state.spinStart:null,reelsStopped:state.reelsStopped,mission:{level:state.mission.level,title:state.mission.title,goal:state.mission.goal,parts:state.mission.parts,slotCount:state.mission.slotCount,types:[...state.mission.types],toyCount:state.mission.toyCount},orders:state.orders.map(o=>({kind:o.kind,x:o.x,active:o.active,canAssemble:canAssemble(o),shipped:o.shipped,secondsLeft:Math.max(0,(EXIT-o.x)/state.beltSpeed),missing:[...o.missing],filled:[...o.filled],reserved:[...o.reserved],packaging:o.packageAt!==null,packaged:o.credited})),tray:state.tray.map(p=>({id:p.id,kind:p.kind,x:p.x,y:p.y,depth:p.depth,focus:renderer.focus(p)?.point,exposed:renderer.exposed(p)})),stats:{...state.stats},flights:state.flights.length})};
  fit();setSound();reset();requestAnimationFrame(frame);
})();
