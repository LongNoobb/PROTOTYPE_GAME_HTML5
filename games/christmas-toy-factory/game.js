(() => {
  'use strict';
  const $=id=>document.getElementById(id), catalog=window.ToyCatalog, art=window.FactoryArt, sfx=window.BakerySfx;
  // Mirrored (left/right) and repeated (front/middle/rear) parts are one piece: any copy fits any matching slot.
  // Mirrored (left/right) and repeated (front/middle/rear) parts are one piece: any copy fits any matching slot.
  const partGroup=catalog.groups||{},groupName={};for(const [k,g] of Object.entries(partGroup))groupName[k]=catalog.groupNames[g];
  const samePart=(a,b)=>(partGroup[a]||a)===(partGroup[b]||b),partName=k=>groupName[k]||catalog.names[k];
  const ui=window.LetterPressUI;
  const settingsIcon=(paths)=>'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg>';
  const settingsIcons={
    music:settingsIcon('<path d="M20 33V11l19-4v22M20 18l19-4"/><ellipse cx="14" cy="34" rx="6" ry="5" fill="currentColor"/><ellipse cx="33" cy="30" rx="6" ry="5" fill="currentColor"/>'),
    sound:settingsIcon('<path d="M9 18h8L28 9v30L17 30H9Z" fill="currentColor" fill-opacity=".18"/><path d="M34 17a10 10 0 0 1 0 14m5-20a18 18 0 0 1 0 26"/>'),
    vibration:settingsIcon('<rect x="15" y="6" width="18" height="36" rx="4" fill="currentColor" fill-opacity=".18"/><path d="M22 11h4m-3 26h2M8 14l-4 6 4 8-4 6m36-20 4 6-4 8 4 6"/>'),
    help:settingsIcon('<path d="M24 12C18 8 10 8 4 11v27c7-3 13-3 20 1 7-4 13-4 20-1V11c-6-3-14-3-20 1Zm0 0v27" fill="currentColor" fill-opacity=".18"/><path d="M10 17h8m-8 7h8m13-6c0-5 8-5 8 0 0 3-4 3-4 6m0 6h.1"/>'),
    play:settingsIcon('<path d="m17 10 20 14-20 14Z" fill="currentColor"/>'),
    restart:settingsIcon('<path d="M9 18a16 16 0 1 1 1 16M9 7v12h12"/>'),
    home:settingsIcon('<path d="m5 22 19-16 19 16M10 20v21h10V28h8v13h10V20"/>'),
    arrow:settingsIcon('<path d="M38 24H10m12-12L10 24l12 12"/>')
  };
  $('settings').innerHTML=ui.icons.gear;
  $('gift-icon').innerHTML=ui.icons.trophy;
  $('home-settings').innerHTML=ui.icons.gear;
  $('home-profile').innerHTML='<svg viewBox="0 0 72 72" fill="none" aria-hidden="true"><path d="M8 71v-7c0-13 12-21 28-21s28 8 28 21v7" fill="#cd6e7b" stroke="#773e4b" stroke-width="2.5"/><path d="m26 47 10 8 10-8 2 24H24Z" fill="#fff0d6"/><rect x="29" y="39" width="14" height="15" rx="6" fill="#e5ac7f"/><ellipse cx="15" cy="31" rx="5" ry="7" fill="#f5c89b" stroke="#86503d" stroke-width="2"/><ellipse cx="57" cy="31" rx="5" ry="7" fill="#f5c89b" stroke="#86503d" stroke-width="2"/><rect x="17" y="10" width="38" height="39" rx="18" fill="#ffdbab" stroke="#86503d" stroke-width="2.5"/><path d="M17 27V21C17 8 26 3 38 4c12 1 18 9 17 23l-9-10c-8 7-18 8-29 10Z" fill="#704b36" stroke="#593d31" stroke-width="2.5" stroke-linejoin="round"/><path d="M17 17C16 6 27 1 39 3c10 1 16 6 17 16-11-4-27-4-39-2Z" fill="#408576" stroke="#255c50" stroke-width="2.5"/><path d="M14 18c14-4 30-4 44 1" stroke="#a3d7b9" stroke-width="5" stroke-linecap="round"/><path d="M28 31v3m16-3v3" stroke="#624734" stroke-width="3" stroke-linecap="round"/><path d="M31 40q5 4 10 0" stroke="#a35c4e" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="24" cy="38" rx="4" ry="2" fill="#efac92"/><ellipse cx="48" cy="38" rx="4" ry="2" fill="#efac92"/><circle cx="36" cy="63" r="2" fill="#dba94f"/></svg>';
  $('home-collection').innerHTML=ui.icons.shop;
  $('home-tab').innerHTML=ui.icons.home+'Toy Factory';
  $('home-levels').innerHTML=ui.icons.trophy;
  const missions=window.FactoryMissions;
  const kinds=Object.keys(catalog.toys), reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const state={phase:'ready',clock:0,batch:1,total:0,orders:[],tray:[],flights:[],particles:[],selected:null,highlight:null,drag:null,sound:true,music:true,vibration:true,mission:null,beltDistance:0,beltSpeed:26,cruiseSpeed:26,shippingBoost:false,holdBoost:false,stats:{fits:0,wrong:0,hints:0,shuffles:0},roundStart:0};
  const renderer=ShapeMeshes.create({left:40,top:690,width:460,height:350,round:17,picking:true});state.trayRenderer=renderer;
  let physics, dirty=true, last=performance.now(), hitAt=0, assistAt=0, toastUntil=0, pressed=null, id=0, paused=false;
  let screen='home';
  try{const save=JSON.parse(localStorage.getItem('christmas-toy-factory-v1'));if(save){state.total=Number(save.total)||0;state.batch=Math.min(missions.length,Math.max(1,Math.floor(Number(save.batch)||1)));state.sound=save.sound!==false;state.music=save.music!==false;state.vibration=save.vibration!==false;}}catch{}
  const requestedLevel=Number(new URLSearchParams(location.search).get('level'));
  if(Number.isInteger(requestedLevel)&&requestedLevel>=1&&requestedLevel<=missions.length)state.batch=requestedLevel;
  function persist(){try{localStorage.setItem('christmas-toy-factory-v1',JSON.stringify({total:state.total,batch:state.batch,sound:state.sound,music:state.music,vibration:state.vibration}));}catch{}}
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
  function toast(message,seconds=2.2){$('toast').textContent=message;$('toast').hidden=false;toastUntil=state.clock+seconds;}
  function sound(kind){sfx.play(kind);}
  function setSound(){sfx.setEnabled(state.sound);}
  function setMusic(){
    const music=$('background-music');
    music.volume=.24;
    if(!state.music||document.hidden)music.pause();
    else if(music.getAttribute('src')||music.querySelector('source'))music.play().catch(()=>{});
  }
  // Browser audio starts after a gesture. Assign a track to #background-music to enable it.
  document.addEventListener('pointerdown',setMusic);
  document.addEventListener('keydown',setMusic);
  function reels(types){const container=document.querySelector('.reels');container.style.setProperty('--slots',types.length);container.style.setProperty('--reel-cols',Math.max(3,types.length));container.replaceChildren();const cell=(container.offsetWidth||438)/Math.max(3,types.length),height=container.offsetHeight||166;for(const kind of types){const reel=document.createElement('div');reel.className='reel';reel.innerHTML='<canvas width="'+Math.round(cell*2)+'" height="'+Math.round(height*2)+'" aria-hidden="true"></canvas>';container.append(reel);art.slotReel(reel.querySelector('canvas'),null);}}
  function updateStations(){
    const buttons=Array.from($('stations').children);
    state.orders.forEach((o,i)=>{let b=buttons[i];if(!b){b=document.createElement('button');b.className='station';b.dataset.index=i;b.innerHTML='<span class="toy-name"></span><span class="part-dots"></span><span class="deadline"></span>';b.addEventListener('click',()=>selectStation(i));$('stations').append(b);}b.classList.toggle('selected',state.selected===i);b.classList.toggle('ready',o.packageAt!==null);b.classList.toggle('urgent',o.packageAt===null&&o.x>425);b.querySelector('.toy-name').textContent=o.packageAt!==null?'ĐÃ GÓI QUÀ':catalog.toys[o.kind].name.toUpperCase();b.querySelector('.part-dots').innerHTML=o.missing.map(k=>'<i class="'+(o.filled.includes(k)?'done':'')+'"></i>').join('');b.setAttribute('aria-label',`${catalog.toys[o.kind].name}: ${o.packageAt!==null?'đã đóng gói':o.missing.filter(k=>!o.filled.includes(k)).map(k=>catalog.names[k]).join(', ')}`);b.disabled=paused||!canAssemble(o);});
    const unpacked=state.mission.orders.length-state.orders.filter(o=>o.credited).length;
    $('batch-label').setAttribute('aria-label','Chọn level · Level '+state.batch+' / '+missions.length+' · '+unpacked+' quà chưa gói');$('batch-count').textContent=unpacked;$('total-gifts').textContent=state.total;
    $('total-gifts').style.fontSize=String(state.total).length>5?Math.max(14,Math.floor(140/String(state.total).length))+'px':'';
    const remaining=state.orders.reduce((a,o)=>a+o.missing.length-o.filled.length-o.reserved.length,0);$('parts-count').textContent=state.phase==='playing'?`CÒN ${remaining} MẢNH CẦN TÌM`:'SẴN SÀNG LẮP RÁP';
    $('hint').disabled=$('shuffle').disabled=state.phase!=='playing'||!!state.tutorial.kind;
    moveStations();
  }
  function moveStations(){for(const b of $('stations').children){const o=state.orders[+b.dataset.index];b.hidden=!o.active||o.shipped||o.x<-60||o.x>600;b.style.left=(o.x-78)+'px';b.classList.toggle('urgent',o.packageAt===null&&o.x>425);b.querySelector('.deadline').textContent=o.packageAt===null?Math.max(0,Math.ceil((EXIT-o.x)/state.beltSpeed))+'s':'';b.disabled=paused||!canAssemble(o);}}
  function canAssemble(o){return !!o&&state.phase==='playing'&&o.active&&!o.shipped&&o.x>=25&&o.x<=565&&o.packageAt===null;}
  function selectStation(i){const o=state.orders[i];if(paused||!canAssemble(o))return;state.selected=state.selected===i?null:i;status('Cần tìm: '+o.missing.filter(k=>!o.filled.includes(k)).map(k=>partName(k).toLowerCase()).join(' + '));sound('click');updateStations();}
  function reset({autostart=true}={}){
    state.tutorial={pending:state.batch<=2,kind:null,piece:null};$('tutorial').hidden=true;
    state.phase='ready';state.clock=0;state.mission=missions[state.batch-1];state.orders=[];state.flights=[];state.queue=Array(art.QUEUE_SLOTS).fill(null);state.particles=[];cancelDrag();state.selected=null;state.highlight=null;state.beltDistance=0;state.cruiseSpeed=state.mission.speed||26+Math.min(12,(state.batch-1)*.65);state.beltSpeed=state.cruiseSpeed;state.shippingBoost=false;setBoost(false);state.stats={fits:0,wrong:0,hints:0,shuffles:0};toastUntil=0;hitAt=0;
    state.pour=null;state.spinStart=0;state.reelsStopped=0;setLever(0);$('machine').classList.remove('spinning');
    $('stations').replaceChildren();$('piece-buttons').replaceChildren();$('toast').hidden=true;$('spin').disabled=false;$('spin').textContent='QUAY ĐỒ CHƠI';
    art.preload(state.mission.types);$('mission-title').textContent=state.mission.title;$('machine-caption').textContent='Cần ghép '+state.mission.toyCount+' đồ chơi trước khi ra hết chuyền';
    clearTray();reels(state.mission.types);
    status('Băng chuyền chạy liên tục. Sẵn sàng ghép đồ chơi!');updateStations();syncHits();if(autostart)spin();
  }
  function updateHome(){
    const mission=missions[state.batch-1],resuming=['spinning','pouring','playing'].includes(state.phase);
    $('home-play').textContent=resuming?'Tiếp tục':'Level '+state.batch;
    $('home-play').setAttribute('aria-label',(resuming?'Tiếp tục':'Chơi')+' level '+state.batch+': '+mission.title);
  }
  function showGame(){
    screen='game';$('home').hidden=true;$('home').inert=true;$('game-screen').hidden=false;$('game-screen').inert=false;
    paused=false;last=performance.now();if(state.phase==='ready')spin();updateStations();$('settings').focus({preventScroll:true});
  }
  function showHome(){
    if($('modal').open)$('modal').close();
    paused=true;cancelDrag();setBoost(false);sfx.setEnabled(false);sfx.setEnabled(state.sound);
    if(state.phase==='complete'){state.batch=state.batch%missions.length+1;persist();reset({autostart:false});}
    else if(state.phase==='failed')reset({autostart:false});
    screen='home';$('game-screen').hidden=true;$('game-screen').inert=true;$('home').hidden=false;$('home').inert=false;
    updateHome();art.home();$('home-play').focus({preventScroll:true});
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
  function startConveyor(){state.phase='playing';state.roundStart=state.clock;assistAt=state.clock+2.2;$('spin').textContent='BĂNG CHUYỀN ĐANG CHẠY →';$('machine-caption').textContent=state.mission.types.length+' loại · Cần ghép '+state.orders.length+' đồ chơi ('+state.mission.parts+' mảnh)';status('Đồ chơi đang tới! Chạm mảnh đúng hoặc kéo vào đồ chơi.');if(state.mission.tip&&!state.tutorial.pending)toast('Kỹ năng · '+state.mission.skillName+' — '+state.mission.tip,5);updateStations();}
  function openSlot(o,kind){if(!canAssemble(o))return null;const open=o.missing.filter(k=>samePart(k,kind)&&!o.filled.includes(k)&&!o.reserved.includes(k));return open.includes(kind)?kind:(open[0]??null);}
  function finishTutorial(){
    state.tutorial.pending=false;state.tutorial.kind=null;state.tutorial.piece=null;$('tutorial').hidden=true;state.highlight=null;
    updateStations();syncHits();last=performance.now();
  }
  function showTutorial(kind,piece=null){
    cancelDrag();setBoost(false);state.tutorial.kind=kind;state.tutorial.piece=piece?.id??null;$('boost').disabled=true;
    const layer=$('tutorial'),assembly=kind==='assemble';layer.dataset.kind=kind;layer.hidden=false;
    $('tutorial-level').textContent='LEVEL '+state.batch+' · CÁCH CHƠI';
    $('tutorial-title').textContent=assembly?'Chạm để lắp':'Đừng để đầy hàng đợi!';
    $('tutorial-copy').innerHTML=assembly?'Chọn mảnh được đánh dấu.<br>Mảnh sẽ tự lắp vào chỗ còn thiếu trên đồ chơi.':'Mảnh chưa có đồ chơi cần sẽ vào hàng đợi và tự lắp khi đồ chơi tới.<br><strong>Đầy cả 5 ô, bạn sẽ thua!</strong>';
    const f=assembly?renderer.focus(piece):null;
    const r=assembly?{x:Math.max(12,f.x-10),y:Math.max(700,f.y-10),w:Math.min(170,f.w+20),h:Math.min(170,f.h+20)}:{x:57,y:614,w:426,h:68};
    const rect=`M${r.x} ${r.y}h${r.w}v${r.h}h${-r.w}Z`;
    const toy=state.orders.find(o=>available(o,piece?.kind));
    $('tutorial-mask').setAttribute('d','M0 110H540V1172H0Z '+rect+(assembly?` M${toy.x-83} 416h166v166h-166Z`:''));
    const style={left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px'};
    Object.assign($('tutorial-outline').style,style);Object.assign($('tutorial-piece').style,style);
    $('tutorial-piece').hidden=!assembly;$('tutorial-continue').hidden=assembly;
    if(assembly){state.highlight={id:piece.id,until:Infinity};$('tutorial-piece').setAttribute('aria-label','Chọn '+partName(piece.kind)+' để lắp');}
    updateStations();syncHits();(assembly?$('tutorial-piece'):$('tutorial-continue')).focus({preventScroll:true});
  }
  function tryTutorial(){
    if(!state.tutorial.pending||state.tutorial.kind||state.phase!=='playing')return;
    if(state.batch===2){showTutorial('queue');return;}
    if(!state.orders.some(o=>canAssemble(o)&&o.x>=115))return;
    const piece=state.tray.find(p=>targetFor(p.kind)>=0&&renderer.exposed(p)&&renderer.focus(p));
    if(piece)showTutorial('assemble',piece);else revealNeeded(true);
  }
  $('tutorial-continue').onclick=finishTutorial;
  $('tutorial-piece').onclick=()=>{const piece=state.tray.find(p=>p.id===state.tutorial.piece);if(piece)choose(piece);};
  function available(o,kind){return openSlot(o,kind)!==null;}
  function targetFor(kind,forced){if(forced!==undefined)return available(state.orders[forced],kind)?forced:-1;if(state.selected!==null&&available(state.orders[state.selected],kind))return state.selected;return state.orders.findIndex(o=>available(o,kind));}
  function burst(x,y,count=17){for(let i=0;i<count;i++){const a=rand(0,Math.PI*2),v=rand(30,140);state.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-50,age:0,life:rand(.45,1),size:rand(3,8),color:pick(['#fff0ad','#ffd061','#b0f1e4','#ffffff'])});}}
  function choose(piece,forced){if(paused||state.phase!=='playing'||!state.tray.includes(piece))return false;const i=targetFor(piece.kind,forced);
    if(state.batch===1&&state.tutorial.pending&&!state.tutorial.kind)return false;
    if(state.tutorial.kind&&(state.tutorial.kind!=='assemble'||piece.id!==state.tutorial.piece||i<0))return false;
    if(state.tutorial.kind==='assemble')finishTutorial();
    if(i<0){if(forced===undefined)return enqueue(piece);state.stats.wrong++;sound('wait');toast('Chưa đúng đồ chơi. Hãy nhìn đường viền còn thiếu.');return false;}
    $('toast').hidden=true;toastUntil=0;
    const from=state.drag?{x:state.drag.x,y:state.drag.y}:{x:piece.x,y:piece.y};
    takeFromTray(piece);launch(piece.kind,from,piece.size,i);return true;
  }
  function takeFromTray(piece){state.tray.splice(state.tray.indexOf(piece),1);physics.remove(piece);state.highlight=null;dirty=true;syncHits();}
  function launch(kind,from,fromSize,i){const o=state.orders[i],slotKind=openSlot(o,kind),slot=catalog.toys[o.kind].slots.find(s=>s.kind===slotKind),r=166*.329,y=art.beltY(o.kind);
    o.reserved.push(slotKind);state.flights.push({kind:slotKind,from,to:{x:o.x+slot.x*r,y:y-slot.y*r},offsetX:slot.x*r,fromSize,toSize:166*slot.s,at:state.clock,duration:reduce.matches?.04:.48,order:i});sound('lift');updateStations();}
  // Waiting queue: parts with no toy on the belt yet wait here, then jump in as soon as a matching toy can take them.
  function enqueue(piece){const s=state.queue.indexOf(null);
    if(paused||state.phase!=='playing'||state.tutorial.kind||(state.batch===1&&state.tutorial.pending)||!state.tray.includes(piece))return false;
    if(s<0){fail(null);return false;}
    $('toast').hidden=true;toastUntil=0;
    const from=state.drag?{x:state.drag.x,y:state.drag.y}:{x:piece.x,y:piece.y};
    takeFromTray(piece);state.queue[s]={kind:piece.kind,size:piece.size,from,at:state.clock};
    status('Chưa có đồ chơi cần '+partName(piece.kind).toLowerCase()+' · đã cất vào hàng chờ.');sound('lift');updateStations();if(state.queue.every(Boolean))fail(null);return true;
  }
  function releaseQueue(){for(let s=0;s<state.queue.length;s++){const q=state.queue[s];if(!q||state.clock-q.at<.32)continue;const i=targetFor(q.kind);if(i<0)continue;state.queue[s]=null;launch(q.kind,art.queueSlot(s),art.QUEUE_SIZE,i);}}
  function land(f){const o=state.orders[f.order];o.reserved=o.reserved.filter(k=>k!==f.kind);o.filled.push(f.kind);state.stats.fits++;sound('fit');burst(f.to.x,f.to.y,12);if(o.missing.every(k=>o.filled.includes(k))){o.packageAt=state.clock;status('Hoàn hảo! Gói một món quà Giáng sinh…');sound('row');if(state.selected===f.order)state.selected=null;}else status('Khớp rồi! Tìm tiếp mảnh còn thiếu nhé.');updateStations();}
  function neededPieces(){return state.tray.filter(p=>state.orders.some(o=>available(o,p.kind)));}
  function revealNeeded(force=false){const needed=neededPieces();if(!needed.length)return null;const visible=needed.filter(p=>renderer.exposed(p));if(visible.length&&!force)return pick(visible);const piece=visible.length?pick(visible):needed.sort((a,b)=>b.depth-a.depth)[0];physics.uncover(piece,force?3:2);dirty=true;return piece;}
  function hint(){if(paused||state.tutorial.kind)return;if(state.phase!=='playing')return;const p=revealNeeded(true);if(!p)return;state.stats.hints++;state.highlight={id:p.id,until:state.clock+4.5};status('Tìm '+partName(p.kind).toLowerCase()+' đang được đánh dấu trong hộp.');sound('click');}
  function shake(){if(paused||state.tutorial.kind)return;if(state.phase!=='playing')return;state.stats.shuffles++;for(const p of state.tray)physics.poke(p,rand(-2.8,2.8),rand(-1.9,1.9),rand(2,4));dirty=true;sound('lift');toast('Xóc nhẹ một chút, mảnh mới lộ ra!');}
  function syncHits(){const layer=$('piece-buttons'),existing=new Map(Array.from(layer.children,b=>[+b.dataset.id,b]));const active=document.activeElement;for(const p of state.tray){if(state.phase!=='playing'||!renderer.exposed(p))continue;let b=existing.get(p.id);if(!b){b=document.createElement('button');b.className='piece-hit';b.dataset.id=p.id;b.dataset.kind=p.kind;b.addEventListener('click',()=>choose(p));b.addEventListener('focus',()=>{state.highlight={id:p.id,until:state.clock+20};});layer.append(b);}existing.delete(p.id);const f=renderer.focus(p);b.setAttribute('aria-label',partName(p.kind));b.disabled=!!state.tutorial.kind&&(state.tutorial.kind!=='assemble'||state.tutorial.piece!==p.id);if(f)Object.assign(b.style,{left:f.x+'px',top:f.y+'px',width:f.w+'px',height:f.h+'px'});}for(const b of existing.values())b.remove();if(active?.classList.contains('piece-hit')&&!active.isConnected){(layer.firstElementChild||$('hint')).focus({preventScroll:true});}}
  function modalTitle(title,subtitle='Toy Factory',kind='default'){const panel=document.querySelector('#modal .panel');panel.classList.remove('settings-panel');panel.dataset.kind=kind;$('modal-title').textContent=title;$('modal-subtitle').textContent=subtitle;}
  function drawCollection(){for(const canvas of $('modal-content').querySelectorAll('#toy-collection canvas'))art.reel(canvas,canvas.dataset.kind);}
  art.onPage(drawCollection);
  function showCollection(){
    paused=true;cancelDrag();modalTitle('Bộ đồ chơi',kinds.length+' đồ chơi trong xưởng');
    $('modal-content').innerHTML='<div class="toy-collection-grid" id="toy-collection">'+kinds.map(kind=>'<div class="toy-collection-item"><canvas width="118" height="84" data-kind="'+kind+'" aria-hidden="true"></canvas><span>'+catalog.toys[kind].name+'</span></div>').join('')+'</div><div class="actions"><button class="action glossy" id="collection-back">Quay lại</button></div>';
    drawCollection();$('modal').showModal();$('collection-back').onclick=closeModal;
  }
  function showLevels(){
    paused=true;cancelDrag();modalTitle('Chọn level',kinds.length+' đồ chơi · '+missions.length+' mission');
    $('modal-content').innerHTML='<div class="level-list toy-level-list"><div class="level-choices">'+missions.map(m=>'<button class="level-choice '+(m.level===state.batch?'current':'')+'" data-level="'+m.level+'"'+(m.level===state.batch?' aria-current="true"':'')+' aria-label="Level '+m.level+': '+m.title+(m.level===state.batch?', đang chọn':'')+'">'+(m.level===state.batch?'<i class="level-current-marker" aria-hidden="true">✓</i>':'')+'<canvas width="118" height="84" aria-hidden="true"></canvas><b>LEVEL '+m.level+'</b><span>'+m.title+'</span></button>').join('')+'</div></div><div class="actions"><button class="action glossy" id="level-back">Quay lại</button></div>';
    $('modal').showModal();
    for(const button of $('modal-content').querySelectorAll('[data-level]')){const level=Number(button.dataset.level);art.reel(button.querySelector('canvas'),missions[level-1].orders[0].kind);button.onclick=()=>{state.batch=level;persist();$('modal').close();reset({autostart:false});showGame();};}
    $('level-back').onclick=closeModal;
  }
  function complete(){state.phase='complete';cancelDrag();syncHits();persist();const seconds=Math.round(state.clock-state.roundStart);modalTitle('Mission hoàn thành!','Level '+state.batch+' · '+state.mission.title,'success');$('modal-content').innerHTML='<div class="reward">'+ui.icons.trophy+'</div><div class="panel-copy"><p>'+state.orders.length+' món đồ chơi đã được lắp hoàn chỉnh, gói thật xinh và gửi tới ông già Noel.</p></div><div class="result"><span><b>'+state.orders.length+'</b>quà đã gửi</span><span><b>'+state.stats.fits+'</b>mảnh đã lắp</span><span><b>'+seconds+'s</b>thời gian</span></div><div class="actions"><button class="action glossy" id="next">'+(state.batch===missions.length?'CHƠI LẠI TỪ LEVEL 1':'LEVEL TIẾP THEO →')+'</button></div>';addHomeAction();$('modal').showModal();$('next').onclick=()=>{state.batch=state.batch%missions.length+1;persist();$('modal').close();paused=false;reset();spin();};updateStations();}
  function showHelp(){paused=true;cancelDrag();modalTitle('Cách chơi','Nhanh tay trên băng chuyền');$('modal-content').innerHTML='<div class="panel-copy guide-copy"><p><b>1. Quay máy đồ chơi</b><br>Vào màn, tay cầm tự gạt và các ô slot quay rồi dừng lần lượt. Số ô cho biết màn có bao nhiêu loại đồ chơi; số đồ chơi phải ghép hiện dưới máy và ở mục QUÀ ĐÃ GÓI. Mỗi món cần ghép 1–4 mảnh. Quay xong, đồ chơi lần lượt xuất hiện từ bên trái. Băng chuyền luôn di chuyển sang phải, càng lên level càng nhanh.</p><p><b>2. Ghép trước cửa ra</b><br>Nhìn đường viền nét đứt trên đồ chơi. Chạm mảnh đúng trong khay để tự lắp, hoặc kéo thả vào đồ chơi đang chạy. Số giây dưới mỗi món là thời gian còn lại. Mảnh chưa có đồ chơi cần sẽ vào 5 ô hàng chờ và tự nhảy vào đồ chơi khi nó tới. Đầy cả 5 ô hàng đợi sẽ thua màn chơi.</p><p><b>3. Đóng hộp quà</b><br>Ghép đủ mảnh, đồ chơi tự được đóng thành hộp có nơ và tiếp tục chạy ra cửa. Gửi đủ số hộp theo mục tiêu của màn để qua level. Nếu đồ chơi chưa hoàn chỉnh ra hết chuyền, hãy chơi lại!</p><p class="help-keyboard">Gợi ý đánh dấu mảnh cần tìm. Xóc hộp để lộ mảnh bên dưới.<br>Tab chọn mảnh, Enter để lắp. Mở hướng dẫn hoặc cài đặt để tạm dừng.</p></div><div class="actions"><button class="action glossy" id="understood">VÀO XƯỞNG NÀO!</button></div>';$('modal').showModal();$('understood').textContent=screen==='home'?'QUAY LẠI':'VÀO XƯỞNG NÀO!';$('understood').onclick=closeModal;}
  function showSettings(){
    paused=true;cancelDrag();setBoost(false);modalTitle('Cài đặt');
    document.querySelector('#modal .panel').classList.add('settings-panel');
    const badge=settingsIcon('<path class="state-on" d="m12 24 8 8 16-17"/><path class="state-off" d="m15 15 18 18m0-18L15 33"/>');
    const tile=(id,key,label)=>'<button class="setting-tile" id="'+id+'" aria-label="'+label+'" aria-pressed="'+state[key]+'" title="'+label+'"><span class="setting-state" aria-hidden="true">'+badge+'</span><span class="setting-icon">'+settingsIcons[key]+settingsIcon('<path class="setting-slash" d="m6 6 36 36"/>')+'</span><span class="setting-label">'+label+'</span></button>';
    $('modal-content').innerHTML='<div class="settings-grid" aria-label="Tuỳ chọn">'+tile('music-toggle','music','Nhạc nền')+tile('sound-toggle','sound','SFX')+tile('vibration-toggle','vibration','Rung')+'<button class="setting-tile setting-guide" id="settings-guide" aria-label="Cách chơi" title="Cách chơi"><span class="setting-state" aria-hidden="true">'+settingsIcon('<path d="M12 24h24m-10-10 10 10-10 10"/>')+'</span><span class="setting-icon">'+settingsIcons.help+'</span><span class="setting-label">Cách chơi</span></button></div><div class="actions settings-primary"><button class="action glossy" id="resume">'+settingsIcons[screen==='home'?'arrow':'play']+'<span>'+(screen==='home'?'Quay lại':'Tiếp tục')+'</span></button></div>'+(screen==='game'?'<nav class="settings-navigation" aria-label="Điều hướng"><button id="settings-restart">'+settingsIcons.restart+'<span>Chơi lại</span></button><button id="return-home">'+settingsIcons.home+'<span>Trang chủ</span></button></nav>':'');
    $('modal').showModal();
    for(const [id,key] of [['music-toggle','music'],['sound-toggle','sound'],['vibration-toggle','vibration']]){
      const button=$(id);
      button.onclick=()=>{state[key]=!state[key];button.setAttribute('aria-pressed',String(state[key]));setSound();setMusic();persist();sound('click');};
    }
    $('settings-guide').onclick=()=>{showHelp();$('understood').textContent='VỀ CÀI ĐẶT';$('understood').onclick=showSettings;};
    if($('settings-restart'))$('settings-restart').onclick=()=>restartLevel();
    if($('return-home'))$('return-home').onclick=showHome;
    $('resume').onclick=closeModal;
  }
  function addHomeAction(){const button=document.createElement('button');button.className='home-action';button.id='return-home';button.textContent='Về màn hình chính';button.onclick=showHome;$('modal-content').append(button);}
  function closeModal(){if(state.phase==='failed'){reset();}else if(state.phase==='complete'){state.batch=state.batch%missions.length+1;persist();reset();}$('modal').close();paused=screen==='home';last=performance.now();}
  function point(e){const rect=$('world').getBoundingClientRect();return{x:(e.clientX-rect.left)*540/rect.width,y:(e.clientY-rect.top)*1172/rect.height};}
  $('world').addEventListener('pointerdown',e=>{if(state.phase!=='playing'||paused||state.tutorial.kind==='queue')return;const p=point(e),piece=renderer.pick(p.x,p.y);if(!piece||(state.tutorial.kind&&piece.id!==state.tutorial.piece))return;pressed={piece,x:p.x,y:p.y,pointer:e.pointerId};$('world').setPointerCapture(e.pointerId);e.preventDefault();});
  $('world').addEventListener('pointermove',e=>{const p=point(e);if(pressed){if(!state.drag&&Math.hypot(p.x-pressed.x,p.y-pressed.y)>8){state.drag={piece:pressed.piece,x:p.x,y:p.y};sound('lift');dirty=true;}if(state.drag)Object.assign(state.drag,p);}else $('world').style.cursor=state.phase==='playing'&&renderer.pick(p.x,p.y)?'grab':'';});
  $('world').addEventListener('pointerup',e=>{if(!pressed||pressed.pointer!==e.pointerId)return;if(!paused&&state.phase==='playing'){if(state.drag){const p=point(e),candidates=state.orders.map((o,i)=>({o,i})).filter(({o})=>canAssemble(o)&&p.y>385&&p.y<593&&Math.abs(p.x-o.x)<83).sort((a,b)=>Math.abs(p.x-a.o.x)-Math.abs(p.x-b.o.x));if(candidates.length)choose(pressed.piece,candidates[0].i);else if(p.y>612&&p.y<684)enqueue(pressed.piece);else toast('Kéo mảnh lên đồ chơi đang chạy trên băng chuyền.');}else choose(pressed.piece);}cancelDrag();});
  $('world').addEventListener('pointercancel',cancelDrag);
  // Hold-to-speed-up: belt ramps to 3x cruise while pressed, eases back on release.
  function setBoost(on){on=!!on&&state.phase==='playing'&&!paused&&!state.tutorial.kind&&!state.shippingBoost;if(state.holdBoost===on)return;state.holdBoost=on;$('boost').classList.toggle('held',on);if(on)sound('lift');}
  {const b=$('boost');b.addEventListener('pointerdown',e=>{if(b.disabled)return;b.setPointerCapture(e.pointerId);setBoost(true);e.preventDefault();});for(const t of['pointerup','pointercancel','lostpointercapture'])b.addEventListener(t,()=>setBoost(false));b.addEventListener('contextmenu',e=>e.preventDefault());b.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){setBoost(true);e.preventDefault();}});b.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter')setBoost(false);});b.addEventListener('blur',()=>setBoost(false));addEventListener('blur',()=>setBoost(false));}
  $('world').addEventListener('lostpointercapture',cancelDrag);
  $('spin').onclick=spin;$('hint').onclick=hint;$('shuffle').onclick=shake;$('settings').onclick=showSettings;$('batch-label').onclick=showLevels;$('close').onclick=closeModal;const restartLevel=()=>{if($('modal').open)$('modal').close();paused=false;reset();sound('click');};
  $('home-play').onclick=showGame;$('home-settings').onclick=showSettings;$('home-levels').onclick=showLevels;
  $('home-collection').onclick=showCollection;$('home-tab').onclick=()=>{$('home-play').focus({preventScroll:true});};
  $('modal').addEventListener('cancel',e=>{e.preventDefault();closeModal();});document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden)cancelDrag();setMusic();});addEventListener('resize',fit);
  function fail(o){
    state.tutorial.pending=false;state.tutorial.kind=null;$('tutorial').hidden=true;state.phase='failed';cancelDrag();state.highlight=null;syncHits();updateStations();
    status(o?'Đồ chơi ra hết chuyền khi chưa ghép xong!':'Hàng đợi đã đầy cả 5 ô!');sound('wait');
    modalTitle(o?'Chưa kịp rồi!':'Hàng đợi đã đầy!','Level '+state.batch+' · Thử lại nhé','failure');
    $('modal-content').innerHTML='<div class="panel-copy"><div class="failure-symbol" aria-hidden="true">'+settingsIcon('<path d="m24 5 21 37H3Z" fill="currentColor" fill-opacity=".12"/><path d="M24 18v11m0 6h.1"/>')+'</div><p>'+(o?catalog.toys[o.kind].name+' đã ra hết băng chuyền khi còn thiếu mảnh. Hãy ưu tiên đồ chơi gần cửa ra trước!':'Cả 5 ô hàng đợi đã kín. Hãy chọn mảnh mà đồ chơi trên băng chuyền đang cần để tránh đầy hàng đợi!')+'</p></div><div class="result"><span><b>'+state.orders.filter(o=>o.shipped).length+' / '+state.orders.length+'</b>quà đã gửi</span><span><b>'+state.stats.fits+'</b>mảnh đã lắp</span></div><div class="actions"><button class="action glossy" id="retry">CHƠI LẠI →</button></div>';
    addHomeAction();$('modal').showModal();$('retry').onclick=()=>{$('modal').close();paused=false;reset();spin();};
  }
  function cancelDrag(){if(pressed&&$('world').hasPointerCapture(pressed.pointer))$('world').releasePointerCapture(pressed.pointer);pressed=null;state.drag=null;dirty=true;}
  function updateConveyor(dt){
    const target=state.shippingBoost?state.cruiseSpeed*6:state.holdBoost?state.cruiseSpeed*3:state.cruiseSpeed,rate=state.cruiseSpeed*(state.shippingBoost||state.holdBoost?10:6)*dt;state.beltSpeed+=Math.max(-rate,Math.min(rate,target-state.beltSpeed));
    state.beltDistance+=state.beltSpeed*dt;
    for(const o of state.orders){if(o.shipped)continue;o.active=state.beltDistance>=o.spawnAt;o.x=ENTRY+state.beltDistance-o.spawnAt;}
    // Follow the moving attachment slot until the part lands.
    releaseQueue();
    for(let i=state.flights.length-1;i>=0;i--){const f=state.flights[i];f.to.x=state.orders[f.order].x+f.offsetX;if(state.clock-f.at>=f.duration){state.flights.splice(i,1);land(f);}}
    for(const o of state.orders){
      if(!o.active||o.shipped)continue;
      if(o.packageAt!==null&&!o.credited&&state.clock-o.packageAt>art.PACK_DONE){o.credited=true;state.total++;persist();burst(o.x,480,25);sound('coin');updateStations();}
      if(o.x>=EXIT){if(o.packageAt===null){fail(o);return;}if(o.credited){o.shipped=true;updateStations();}}
    }
    if(!state.shippingBoost&&state.orders.length&&state.orders.every(o=>o.credited)){
      state.shippingBoost=true;cancelDrag();state.highlight=null;
      $('spin').textContent='TĂNG TỐC GỬI QUÀ »';status('Đã gói đủ quà! Tăng tốc băng chuyền gửi quà đi!');sound('row');
    }
    if(state.selected!==null&&!canAssemble(state.orders[state.selected])){state.selected=null;updateStations();}
    moveStations();if(state.orders.every(o=>o.shipped))complete();
  }
  function frame(now){const dt=Math.min(.04,Math.max(0,(now-last)/1000));last=now;if(!paused&&!document.hidden&&!state.tutorial.kind){
      if(state.phase!=='complete'&&state.phase!=='failed')state.clock+=dt;
      if(state.phase==='spinning')updateSpin();
      if(state.phase==='pouring')updatePour();
      {const off=state.phase!=='playing'||state.shippingBoost||!!state.tutorial.kind;if($('boost').disabled!==off){$('boost').disabled=off;if(off)setBoost(false);}}
      if(state.phase==='playing')updateConveyor(dt);
      if(physics&&(state.phase==='playing'||state.phase==='pouring')){if(physics.update(dt))dirty=true;}
      if(dirty){renderer.render(state.drag?state.tray.filter(p=>p!==state.drag.piece):state.tray);dirty=false;}
      if(state.clock>hitAt){syncHits();hitAt=state.clock+.3;}
      if(state.phase==='playing'&&state.clock>assistAt&&!state.drag){revealNeeded();assistAt=state.clock+2.2;}
      for(const p of state.particles){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=90*dt;}state.particles=state.particles.filter(p=>p.age<p.life);if(toastUntil&&state.clock>toastUntil){$('toast').hidden=true;toastUntil=0;}
    }
    if(screen==='game'&&!paused){tryTutorial();}if(screen==='game')art.draw(state,now);requestAnimationFrame(frame);
  }
  // Read-only diagnostics for reproducible playtests; actions remain real UI inputs.
  window.FactoryDebug={snapshot:()=>({phase:state.phase,paused:paused||document.hidden,batch:state.batch,total:state.total,tutorial:{...state.tutorial},clock:state.clock,beltDistance:state.beltDistance,beltSpeed:state.beltSpeed,cruiseSpeed:state.cruiseSpeed,shippingBoost:state.shippingBoost,holdBoost:state.holdBoost,spinElapsed:state.phase==='spinning'?state.clock-state.spinStart:null,reelsStopped:state.reelsStopped,mission:{level:state.mission.level,title:state.mission.title,goal:state.mission.goal,parts:state.mission.parts,slotCount:state.mission.slotCount,types:[...state.mission.types],toyCount:state.mission.toyCount},orders:state.orders.map(o=>({kind:o.kind,x:o.x,active:o.active,canAssemble:canAssemble(o),shipped:o.shipped,secondsLeft:Math.max(0,(EXIT-o.x)/state.beltSpeed),missing:[...o.missing],filled:[...o.filled],reserved:[...o.reserved],packaging:o.packageAt!==null,packaged:o.credited})),tray:state.tray.map(p=>({id:p.id,kind:p.kind,x:p.x,y:p.y,depth:p.depth,focus:renderer.focus(p)?.point,exposed:renderer.exposed(p)})),queue:state.queue.map(q=>q&&q.kind),stats:{...state.stats},flights:state.flights.length})};
  fit();setSound();setMusic();reset({autostart:false});art.home();
  if(Number.isInteger(requestedLevel)&&requestedLevel>=1&&requestedLevel<=missions.length)showGame();else showHome();
  requestAnimationFrame(frame);
})();
