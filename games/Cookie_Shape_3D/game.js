(() => {
  "use strict";

  const art = window.ShapeArt;
  const { create:createTrayPhysics, pieceSize } = window.ShapeTray;
  const $ = (id) => document.getElementById(id);
  const stage = $("stage");
  const viewport = $("viewport");
  const home = $("home");
  const hud = $("hud");
  const hits = $("pieces");
  const modal = $("modal");
  const panel = modal.querySelector(".panel");
  const effects = $("effects").getContext("2d");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const { levels, chapters, names, cookieKinds } = window.Bakery;
  const LAST_LEVEL = Object.keys(levels).length;
  const SAVE = "perfect-shape-bakery-v1";
  const REFILL = 20 * 60 * 1000;
  const MAX_LIVES = 5;
  const BASE_WIN_COINS = 10;
  const SYRUP_SECONDS = 10;
  const mechanicTiming = {
    syrup: { impact:.66, fade:.66, end:1.21 },
    hammer: { impact:.35, fade:.45, end:1.06 },
    oven: { impact:.68, fade:1.07, end:1.72 }
  };
  const praise = ["Chuẩn rồi!","Đẹp lắm!","Đủ một hàng!","Ngon lành!"];
  const confettiColors = ["#ffdb68","#fff3c7","#ef7295","#a93f5e","#ff9961"];
  let game = null;
  let animation = 0;
  let modalKind = "";
  let priorFocus = null;
  let audio = null;
  let lastTime = 0;
  let celebration = [];
  let pressed = null;
  let homeDirty = true;
  const initial = { level:1, coins:100, lives:MAX_LIVES, refillAt:0, sound:true, haptics:true, best:{} };
  let save = { ...initial };
  try {
    const stored = JSON.parse(localStorage.getItem(SAVE));
    if (stored && levels[stored.level]) {
      save = { ...initial, ...stored, best:{ ...stored.best } };
    } else {
      const legacy = JSON.parse(localStorage.getItem("perfect-shape-html5-v1"));
      for (const key of ["sound","haptics"]) {
        if (typeof legacy?.[key] === "boolean") save[key] = legacy[key];
      }
    }
  } catch {}

  function persist() {
    try { localStorage.setItem(SAVE, JSON.stringify(save)); } catch {}
  }

  function clock(seconds) {
    const whole = Math.max(0,Math.ceil(seconds));
    return `${String(Math.floor(whole/60)).padStart(2,"0")}:${String(whole%60).padStart(2,"0")}`;
  }

  function refreshLives() {
    if (save.lives < MAX_LIVES && !save.refillAt) save.refillAt = Date.now()+REFILL;
    while (save.lives < MAX_LIVES && Date.now() >= save.refillAt) {
      save.lives++;
      save.refillAt = save.lives < MAX_LIVES ? save.refillAt+REFILL : 0;
      persist();
    }
    $("life-clock").textContent = save.lives >= MAX_LIVES ? "Đầy" : clock((save.refillAt-Date.now())/1000);
    $("lives").textContent = save.lives;
    $("coins").textContent = save.coins;
    $("play").textContent = "Màn "+save.level;
    $("home-progress").textContent = Object.keys(save.best).length+" / "+LAST_LEVEL+" màn";
  }

  function fit() {
    stage.style.setProperty("--scale",Math.min(viewport.clientWidth/art.W,viewport.clientHeight/art.H));
  }

  function icon(id, name) { $(id).insertAdjacentHTML("afterbegin",art.icons[name]); }
  icon("profile","profile");
  icon("heart-token","heart");
  icon("home-tab","home");
  icon("shop-tab","shop");
  icon("trophy-tab","trophy");
  icon("home-settings","gear");
  icon("game-settings","gear");
  document.querySelector(".timer-clock").innerHTML = art.icons.clock;

  function random(seed) {
    return () => {
      seed = (Math.imul(1664525,seed) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function shuffle(items, next) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(next()*(i+1));
      [items[i],items[j]] = [items[j],items[i]];
    }
    return items;
  }

  function synth(kind) {
    if (!save.sound || navigator.userActivation?.hasBeenActive === false) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audio ??= new Audio();
    if (audio.state === "suspended") audio.resume().catch(() => {});
    const start = audio.currentTime;
    const notes = {
      click: [455], fit: [585,880], row: [660,830,990,1320], win: [523,660,784,1047,1319],
      wait: [270], miss: [234,177], crack: [146,82], unlock: [726,1109,1479], tick: [435], lose: [470,382,260]
    }[kind];
    const bright = ["row","win","unlock"].includes(kind);
    notes.forEach((hz, i) => {
      const when = start+i*(bright ? .083 : .043);
      const length = bright ? .25 : .10;
      const oscillator = audio.createOscillator();
      oscillator.type = bright || kind === "fit" ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(hz*1.13,when);
      oscillator.frequency.exponentialRampToValueAtTime(hz,when+.045);
      const gain = audio.createGain();
      gain.gain.setValueAtTime(.0001,when);
      gain.gain.exponentialRampToValueAtTime(i === 0 ? .16 : .095,when+.007);
      gain.gain.exponentialRampToValueAtTime(.0001,when+length);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(when);
      oscillator.stop(when+length+.01);
    });
    if (kind === "fit") {
      const noise = audio.createBuffer(1,Math.round(audio.sampleRate*.032),audio.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random()*2-1)*Math.pow(1-i/data.length,5)*.18;
      const sound = audio.createBufferSource();
      sound.buffer = noise;
      const filter = audio.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1900;
      sound.connect(filter).connect(audio.destination);
      sound.start(start);
    }
  }

  function vibrate(duration) {
    if (save.haptics) navigator.vibrate?.(duration);
  }

  function speak(message) { $("status").textContent = message; }

  function makeGame(number) {
    const config = levels[number];
    const rows = config.rows;
    const next = random(config.seed);
    let id = 0;
    const item = (kind, props = {}) => ({ id:++id, kind, ...props });
    const stock = rows.map(row => row.map(kind => item(kind,{cookie:true})));
    const hidden = rows.map((row,r) => row.map((_,c) => (config.foil ?? []).includes((r+1)*10+c+1)));
    const extract = cell => {
      const row = stock[Math.floor(cell/10)-1];
      const column = cell%10-1;
      const cookie = row[column];
      row[column] = null;
      return cookie;
    };
    const fixed = [];
    if (config.box) {
      fixed.push(item("pastryBox",{contents:config.box.map(extract),x:116,y:774,size:162,fixed:true}));
    }
    if (config.oven) {
      fixed.push(item("oven",{contents:config.oven.map(extract),x:418,y:929,size:169,fixed:true,remaining:3}));
    }
    const halves = (config.halves ?? []).flatMap(cell => {
      const { kind } = extract(cell);
      return ["Left","Right"].map(side => item(kind+side,{cookie:true,pair:cell,whole:kind}));
    });

    // Earlier orders start above later orders. The physics still determines what is exposed.
    const layers = [...stock].reverse().flatMap(row => shuffle(row.filter(Boolean),next));
    const cells = Array.from({length:24},(_,i) => [99+i%6*68,755+Math.floor(i/6)*77])
      .filter(([x,y]) => fixed.every(prop => Math.hypot(x-prop.x,y-prop.y) > 84));
    let positions = [];
    const tray = layers.map((piece,index) => {
      if (!positions.length) positions = shuffle([...cells],next);
      const [x,y] = positions.pop();
      return Object.assign(piece,{
        x:x+(next()-.5)*19, y:y+(next()-.5)*17, size:109+next()*24,
        angle:(next()-.5)*3.3, pose:Math.floor(next()*3), tier:Math.floor(index/cells.length)
      });
    });
    const topTier = Math.floor((layers.length-1)/cells.length);
    const top = (piece,x,y,size,angle = 0) =>
      Object.assign(piece,{x,y,size,angle,pose:0,tier:topTier+1});
    halves.forEach((piece,i) => {
      const x = 146+(i%4)*80;
      const y = [816,933,929,798][i%4] + Math.floor(i/4)*35;
      tray.push(top(piece,x,y,114,(i%3-1)*.43));
    });
    if (config.box) tray.push(top(item("hammer",{box:fixed[0]}),336,769,123,-.65));
    (config.syrup ?? []).forEach((coatCount,i) => {
      tray.push(top(item("syrupCandy",{coatCount}),207+i*153,867+i*35,108,.19));
    });
    tray.push(...fixed.map(piece => Object.assign(piece,{angle:0,pose:0,tier:0})));
    return {
      number, rows, hidden, columns:rows[0].length, row:0, filled:rows.map(row => row.map(() => 0)),
      tray, waiting:Array(5).fill(null), flights:[], mechanicFX:[], spin:null, flash:[], praise:null,
      physics:createTrayPhysics(tray), nextHitSync:0, nextAssist:0, assistStrength:3,
      time:config.time, seconds:config.time, elapsed:0, pausedAt:null, ended:false
    };
  }

  function announceRow() {
    const missing = game.rows[game.row].filter((_,i) => !game.filled[game.row][i] && !game.hidden[game.row][i]);
    if (missing.length) speak("Hàng "+(game.row+1)+" / "+game.rows.length+". Cần "+missing.map(kind => names[kind]).join(", ")+".");
  }

  function startGame(number) {
    refreshLives();
    if (save.lives <= 0) { showShop(true); return; }
    closeModal(false);
    synth("click");
    game = makeGame(number);
    hits.replaceChildren();
    home.hidden = true;
    hud.hidden = false;
    hits.hidden = false;
    celebration = [];
    pressed = null;
    $("world").style.cursor = "";
    lastTime = performance.now();
    $("level-label").textContent = "Màn "+number;
    const [chapter,,tip] = chapters[levels[number].chapter];
    $("chapter-label").textContent = chapter;
    $("chapter-tip").textContent = tip;
    $("row-count").textContent = "Hàng 1 / "+game.rows.length;
    showTime();
    syncHits();
    announceRow();
    $("game-settings").focus({ preventScroll:true });
  }

  function goHome() {
    closeModal(false);
    game = null;
    pressed = null;
    $("world").style.cursor = "";
    hits.replaceChildren();
    hud.hidden = true;
    home.hidden = false;
    homeDirty = true;
    refreshLives();
    $("play").focus({ preventScroll:true });
  }

  function showTime() {
    $("time").textContent = clock(game.seconds);
    $("timer-fill").style.transform = `scaleX(${Math.max(0,game.seconds/game.time)})`;
    $("timer").classList.toggle("danger",game.seconds <= 10);
  }

  function position(e) {
    const bounds = stage.getBoundingClientRect();
    return { x:(e.clientX-bounds.left)*art.W/bounds.width, y:(e.clientY-bounds.top)*art.H/bounds.height };
  }

  function pickAt(x,y) {
    return art.pieceAt(game,x,y);
  }

  function exposed(piece) {
    return art.exposed(game,piece);
  }

  function syncHits() {
    game.hitsDirty = false;
    const active = document.activeElement;
    const existing = new Map(Array.from(hits.children,button => [Number(button.dataset.pieceId),button]));
    for (let i = game.tray.length-1; i >= 0; i--) {
      const piece = game.tray[i];
      if (!exposed(piece)) continue;
      let button = existing.get(piece.id);
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "piece-hit";
        button.dataset.pieceId = piece.id;
        button.dataset.kind = piece.kind;
        button.addEventListener("click",() => choose(piece));
        hits.append(button);
      }
      existing.delete(piece.id);
      button.dataset.kind = piece.kind;
      button.setAttribute("aria-label",names[piece.kind]+(piece.coatedUntil ? ", đang phủ siro" : ""));
      button.setAttribute("aria-disabled",String(Boolean(piece.coatedUntil)));
      const size = Math.max(46,piece.size*.67);
      Object.assign(button.style,{
        width:`${size}px`,height:`${size}px`,left:`${piece.x-size/2}px`,top:`${piece.y-size/2}px`
      });
    }
    for (const button of existing.values()) button.remove();
    if (active?.dataset.pieceId && !active.isConnected && !modal.open) {
      (hits.querySelector("button") ?? $("game-settings")).focus({ preventScroll:true });
    }
  }

  function remove(piece) {
    const i = game.tray.indexOf(piece);
    if (i === -1) return;
    game.tray.splice(i,1);
    game.physics.remove(piece);
    game.trayDirty = game.geometryDirty = true;
  }

  function launch(piece,to,when,done,duration = to.seat ? 385 : 225) {
    const flight = { kind:piece.kind, from:piece, to, start:when, duration:reduceMotion.matches ? 15 : duration, done };
    game.flights.push(flight);
    return flight;
  }

  function missingIndex(kind) {
    return game.rows[game.row].findIndex((key,i) =>
      key === kind && !game.filled[game.row][i] && !game.hidden[game.row][i]);
  }

  function animateMechanic(kind, prop, targets = []) {
    const { impact, fade, end } = mechanicTiming[kind];
    const speed = reduceMotion.matches ? .42 : 1;
    const effect = {
      kind, prop, targets, start:game.elapsed,
      impact:impact*speed, fade:fade*speed, end:end*speed, fired:false
    };
    game.mechanicFX.push(effect);
    return effect;
  }

  function match(piece,col,now) {
    const row = game.row;
    game.filled[row][col] = Number.POSITIVE_INFINITY;
    const to = { ...art.target(game,col), seat:!reduceMotion.matches };
    launch(piece,to,now,() => {
      const arrived = performance.now();
      game.filled[row][col] = arrived;
      flash(to.x,to.y,"#fff4bd",8);
      synth("fit");
      vibrate(13);
      let revealed = false;
      for (const neighbor of [col-1,col+1]) {
        if (!game.hidden[row][neighbor]) continue;
        game.hidden[row][neighbor] = false;
        const slot = art.target(game,neighbor);
        flash(slot.x,slot.y,"#e1e9f5",17);
        revealed = true;
      }
      for (const oven of game.tray.filter(piece => piece.kind === "oven")) {
        oven.remaining--;
        if (oven.remaining === 0) {
          oven.kind = "ovenOpen";
          animateMechanic("oven",oven);
          game.trayDirty = game.geometryDirty = game.hitsDirty = true;
          speak("Cửa lò đang mở.");
        }
      }
      if (revealed) {
        announceRow();
        drainWaiting(arrived);
      }
      if (game.filled[row].every(value => Number.isFinite(value) && value > 0)) completeRow();
    });
  }

  function releaseContents(container, now) {
    remove(container);
    const oven = container.kind === "ovenOpen";
    const offsets = oven ? [[-62,42],[-19,64],[28,61]] : [[-22,-18],[24,18],[-15,33],[30,-28]];
    container.contents.forEach((cookie,i) => {
      const [dx,dy] = offsets[i%offsets.length];
      const target = {
        x:Math.max(100,Math.min(438,container.x+dx)),
        y:Math.max(750,Math.min(992,container.y+dy)),
        size:116
      };
      const drop = () => {
        Object.assign(cookie,target,{angle:(i-1)*.42,pose:i%2});
        game.tray.push(cookie);
        game.physics.add(cookie,oven ? 34 : Math.min(140,container.depth+31+i*20));
        game.physics.poke(cookie,dx*.048,dy*.047,1.3);
        game.trayDirty = game.geometryDirty = game.hitsDirty = true;
      };
      if (oven) {
        const from = { ...cookie, x:container.x+(i-1)*13, y:container.y+5, size:48 };
        launch(from,{...target,arc:13},now+i*(reduceMotion.matches ? 0 : 43),drop);
      } else {
        drop();
      }
    });
    flash(container.x,container.y,oven ? "#ffb267" : "#ffd5a4",oven ? 12 : 22);
    synth(oven ? "unlock" : "crack");
    speak(oven ? "Bánh đã ra lò." : "Hộp đã vỡ. Bánh rơi ra khay.");
    game.trayDirty = game.geometryDirty = game.hitsDirty = true;
  }

  function tapSyrup(candy) {
    const nearby = game.tray.filter(piece => piece.cookie && exposed(piece))
      .map(piece => ({piece,distance:Math.hypot(piece.x-candy.x,piece.y-candy.y)}))
      .sort((a,b) => a.distance-b.distance || a.piece.id-b.piece.id);
    if (!nearby.length) {
      speak("Cần có bánh lộ ra trong khay để siro bám vào.");
      return;
    }
    remove(candy);
    const targets = nearby.slice(0,candy.coatCount).map(({piece}) => piece);
    const effect = animateMechanic("syrup",candy,targets);
    for (const piece of targets) {
      piece.syrupSpread ??= 0;
      piece.coatedUntil = game.elapsed+effect.impact+SYRUP_SECONDS;
    }
    speak("Kẹo đang tan. Bánh dính siro sẽ được chọn lại sau 10 giây.");
  }

  function revealNeeded() {
    const needed = game.rows[game.row].filter((_,i) => !game.filled[game.row][i] && !game.hidden[game.row][i]);
    if (!needed.length) return;
    const candidate = piece => !piece.coatedUntil && (
      needed.includes(piece.whole ?? piece.kind) ||
      piece.kind === "hammer" && piece.box.contents.some(cookie => needed.includes(cookie.kind))
    );
    if (game.tray.some(piece => candidate(piece) && exposed(piece))) {
      game.assistStrength = 3;
      return;
    }
    let buried = null;
    for (const piece of game.tray) {
      if (candidate(piece) && (!buried || piece.depth > buried.depth)) buried = piece;
    }
    if (buried) {
      game.physics.uncover(buried,game.assistStrength);
      game.assistStrength = Math.min(6.5,game.assistStrength+.8);
    }
  }

  function park(piece,index,now) {
    const spot = art.slotCenter(index);
    const waiting = { ...piece };
    game.waiting[index] = waiting;
    waiting.pending = launch(piece,{...spot,size:84},now,time => {
      delete waiting.pending;
      game.trayDirty = true;
      if (!game.spin) drainWaiting(time);
    });
  }

  function halvesMatch(first,second) {
    return first?.pair && !first.joining && first.whole === second.whole && first.kind !== second.kind;
  }

  function joinHalf(piece,index,now) {
    const first = game.waiting[index];
    const spot = { ...art.slotCenter(index), size:84 };
    const firstPose = { kind:first.kind, ...(first.pending ? art.flightPose(first.pending,now) : spot) };
    if (first.pending) {
      game.flights = game.flights.filter(flight => flight !== first.pending);
      delete first.pending;
    }
    // Keep simultaneous joins centered horizontally, with room to see each pair.
    const y = [584,498,670,412,756].find(y => game.waiting.every(entry => entry?.joining !== y));
    first.joining = y;
    remove(piece);

    const still = reduceMotion.matches;
    const center = { x:art.W/2, y, size:132, arc:0 };
    const whole = { id:first.id, kind:first.whole, cookie:true, ...(still ? spot : center) };
    const route = time => {
      const col = game.spin ? -1 : missingIndex(whole.kind);
      if (col >= 0) {
        game.waiting[index] = null;
        match(whole,col,time);
      } else if (still) {
        game.waiting[index] = whole;
      } else {
        park(whole,index,time);
      }
      game.trayDirty = true;
    };
    const joined = time => {
      flash(whole.x,whole.y,"#ffd998",13);
      synth("fit");
      speak(names[first.whole]+" đã ráp xong.");
      if (still) route(time);
      else launch(whole,center,time,route,100);
    };
    if (still) {
      joined(now);
      return;
    }

    const halves = [firstPose,piece].map(half => {
      const side = half.kind.endsWith("Left") ? -1 : 1;
      return { half, side, staged:{...center,kind:half.kind,x:center.x+side*104} };
    });
    // The beveled top of each cut sits at 0.34 mesh units from its origin.
    const seam = pieceSize(center).radius*.34;
    const converge = time => {
      halves.forEach(({staged,side},i) =>
        launch(staged,{...center,x:center.x+side*seam},time,i === 0 ? joined : undefined,175));
    };
    halves.forEach(({half,staged},i) =>
      launch(half,{...staged,arc:20},now,i === 0 ? converge : undefined,210));
  }

  function choose(piece) {
    if (!game || game.pausedAt !== null || game.ended || game.finishing || game.spin || !game.tray.includes(piece)) return;
    const now = performance.now();
    if (piece.coatedUntil) {
      speak(piece.syrupSpread ? "Bánh dính siro, chưa thể chọn." : "Siro đang chảy tới bánh.");
      synth("miss");
      return;
    }
    if (piece.kind === "syrupCandy") {
      tapSyrup(piece);
    } else if (piece.kind === "hammer") {
      const box = piece.box;
      remove(piece);
      launch(piece,{x:box.x+29,y:box.y-8,size:117,arc:32},now,() => animateMechanic("hammer",box));
    } else if (piece.kind === "pastryBox" || piece.kind === "oven" || piece.kind === "ovenOpen") {
      speak(piece.kind === "pastryBox" ? "Nhặt búa để đập hộp." : "Lò còn "+piece.remaining+" lượt ghép.");
      synth("miss");
      return;
    } else {
      const partner = piece.pair ? game.waiting.findIndex(entry => halvesMatch(entry,piece)) : -1;
      if (partner >= 0) {
        joinHalf(piece,partner,now);
      } else {
        const col = piece.pair ? -1 : missingIndex(piece.kind);
        const waiting = game.waiting.indexOf(null);
        if (col < 0 && waiting < 0) return;
        remove(piece);
        if (col >= 0) match(piece,col,now);
        else {
          park(piece,waiting,now);
          synth("wait");
        }
      }
    }
    game.nextAssist = now+165;
    syncHits();
  }

  function drainWaiting(now) {
    game.waiting.forEach((piece,i) => {
      if (!piece || piece.pending || piece.pair) return;
      const col = missingIndex(piece.kind);
      if (col < 0) return;
      game.waiting[i] = null;
      game.trayDirty = true;
      match({ ...piece, ...art.slotCenter(i), orientation:undefined, size:84 },col,now);
    });
  }

  function canJoinWaitingHalf() {
    return game.waiting.some(entry => game.tray.some(piece => halvesMatch(entry,piece)));
  }

  function updateTrayStates(now) {
    for (const piece of game.tray) {
      if (piece.coatedUntil && game.elapsed >= piece.coatedUntil) {
        delete piece.coatedUntil;
        delete piece.syrupSpread;
        game.trayDirty = game.geometryDirty = game.hitsDirty = true;
        flash(piece.x,piece.y,"#ffdfb1",7);
      }
    }
    game.mechanicFX = game.mechanicFX.filter(effect => {
      const age = game.elapsed-effect.start;
      if (age >= effect.impact) {
        if (effect.kind === "syrup") {
          const spread = Math.min(1,(age-effect.impact)/(effect.end-effect.impact));
          for (const piece of effect.targets) {
            if (spread <= piece.syrupSpread || !piece.coatedUntil) continue;
            piece.syrupSpread = spread;
            game.trayDirty = game.geometryDirty = true;
          }
        } else if (!effect.fired) {
          effect.fired = true;
          releaseContents(effect.prop,now);
        }
      }
      return age < effect.end;
    });
  }

  function startBonus() {
    const steps = 26;
    // Leave the first visible tiles in place until the new strip rolls into view.
    const reels = Array.from({length:game.columns},() => Array.from({length:steps+3},(_,i) =>
      i < 3 ? null : cookieKinds[Math.floor(Math.random()*cookieKinds.length)]));
    const counts = new Map();
    for (const reel of reels) {
      const kind = reel[steps];
      counts.set(kind,(counts.get(kind) ?? 0)+1);
    }
    const [winner,matches] = [...counts].find(([,count]) => count >= 3) ?? [null,0];
    const multiplier = matches === game.columns ? 5 : winner ? 3 : 1;
    const coins = BASE_WIN_COINS*multiplier;
    game.bonus = { steps, reels, winner, matches, multiplier, coins };

    const best = save.best[game.number] ?? 0;
    save.best[game.number] = Math.max(best,Math.ceil(game.seconds));
    save.coins += coins;
    if (game.number === save.level && game.number < LAST_LEVEL) save.level++;
    persist();
  }

  function completeRow() {
    const now = performance.now();
    game.finishing = game.row+1 === game.rows.length;
    if (game.finishing) startBonus();
    const still = reduceMotion.matches;
    const delay = still ? 65 : game.finishing ? 160 : 280;
    const roll = still ? 0 : game.finishing ? 970 : 245;
    const stagger = still ? 0 : game.finishing ? 105 : 38;
    game.spin = { started:now, delay, roll, stagger, duration:delay+roll+stagger*(game.columns-1) };
    game.praise = { text:game.finishing ? "Hoàn tất!" : praise[game.row%praise.length], time:now };
    synth("row");
    vibrate(29);
  }

  function advance(now) {
    game.spin = null;
    if (game.finishing) {
      const { steps, reels, winner, multiplier } = game.bonus;
      game.praise = { text:`Thưởng ×${multiplier}`, time:now };
      if (winner) {
        synth("unlock");
        reels.forEach((reel,col) => {
          if (reel[steps] !== winner) return;
          const {x,y} = art.target(game,col);
          flash(x,y,"#fff2a8",9);
        });
      }
      game.finishAt = game.elapsed+.95;
      return;
    }
    game.row++;
    $("row-count").textContent = "Hàng "+(game.row+1)+" / "+game.rows.length;
    drainWaiting(now);
    revealNeeded();
    game.nextAssist = now+420;
    syncHits();
    announceRow();
  }

  function flash(x,y,color,count) {
    if (reduceMotion.matches) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random()*Math.PI*2;
      const speed = 28+Math.random()*88;
      game.flash.push({x,y,color,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:.27+Math.random()*.31});
    }
  }

  function showModal(kind,title,subtitle,html) {
    if (!modal.open) {
      priorFocus = document.activeElement;
      modal.show();
    }
    modalKind = kind;
    if (game) game.pausedAt ??= performance.now();
    home.inert = hud.inert = hits.inert = true;
    panel.classList.toggle("won",kind === "win");
    $("modal-title").textContent = title;
    $("modal-subtitle").textContent = subtitle;
    $("modal-body").innerHTML = html;
    ($("modal-body").querySelector("button") ?? $("close-modal")).focus({ preventScroll:true });
  }

  function closeModal(restore = true) {
    if (!modal.open) return;
    const kind = modalKind;
    modalKind = "";
    modal.close();
    home.inert = hud.inert = hits.inert = false;
    if (restore && ["win","lose"].includes(kind)) { goHome(); return; }
    if (game?.pausedAt != null && !game.ended) {
      const now = performance.now();
      const gap = now-game.pausedAt;
      for (const flight of game.flights) flight.start += gap;
      if (game.spin) game.spin.started += gap;
      if (game.praise) game.praise.time += gap;
      for (const row of game.filled) {
        row.forEach((time,i) => { if (time) row[i] += gap; });
      }
      game.pausedAt = null;
      lastTime = now;
    }
    if (restore && priorFocus?.isConnected) priorFocus.focus({ preventScroll:true });
  }

  const action = (id,label,alt = false) =>
    `<button class="action${alt?" alt":""}" id="${id}">${label}</button>`;

  function win() {
    game.ended = true;
    const { matches, multiplier, coins } = game.bonus;
    synth("win");
    vibrate([24,43,34]);
    speak(`Đã hoàn thành màn ${game.number}. Thưởng nhân ${multiplier}, nhận ${coins} xu.`);
    const next = game.number < LAST_LEVEL;
    const subtitle = matches ? `${matches} ô giống nhau · Thưởng ×${multiplier}` :
      next ? "Đơn bánh hoàn tất" : "Hoàn tất đơn bánh cuối";
    showModal("win",`Màn ${game.number}`,subtitle,
      `<div class="panel-copy reward">${art.rewardCoins()}<b>+${coins}</b></div><div class="actions">${next ? action("continue","Màn tiếp") : ""}${action("win-home","Tiệm bánh",next)}</div>`);
    $("continue")?.addEventListener("click",() => startGame(game.number+1));
    $("win-home").addEventListener("click",goHome);
    if (!reduceMotion.matches) {
      celebration = Array.from({length:170},(_,i) => ({
        x:Math.random()*art.W,y:100+Math.random()*690,
        vx:(Math.random()-.5)*170,vy:30+Math.random()*180,
        rotation:Math.random()*7,spin:(Math.random()-.5)*13,
        life:1.4+Math.random()*2.1, color:confettiColors[i%confettiColors.length]
      }));
    }
  }

  function lose(title,message) {
    if (game.ended) return;
    game.ended = true;
    save.lives = Math.max(0,save.lives-1);
    if (!save.refillAt) save.refillAt = Date.now()+REFILL;
    persist();
    synth("lose");
    const number = game.number;
    showModal("lose",title,`Màn ${number}`,
      `<div class="panel-copy">${message}</div><div class="actions">${action("retry","Thử lại")}${action("back","Tiệm bánh",true)}</div>`);
    $("retry").addEventListener("click",() => startGame(number));
    $("back").addEventListener("click",goHome);
  }

  function settings() {
    synth("click");
    const toggle = (id,key,label) =>
      `<div class="setting-row"><span>${label}</span><button class="toggle" id="${id}" aria-label="${label}" aria-pressed="${save[key]}">${save[key]?"Bật":"Tắt"}</button></div>`;
    showModal("settings","Cài đặt",game ? "Đang tạm dừng" : "",
      `<div class="panel-copy">${toggle("sound-toggle","sound","Âm thanh")}${toggle("haptic-toggle","haptics","Rung")}</div>
        <div class="actions">${action("resume",game?"Tiếp tục":"Xong")}${game?action("quit","Tiệm bánh",true):""}</div>`);
    for (const [id,key] of [["sound-toggle","sound"],["haptic-toggle","haptics"]]) {
      const button = $(id);
      button.addEventListener("click",() => {
        save[key] = !save[key];
        button.textContent = save[key] ? "Bật" : "Tắt";
        button.setAttribute("aria-pressed",save[key]);
        persist();
        if (key === "sound") synth("click");
        else vibrate(20);
      });
    }
    $("resume").addEventListener("click",() => closeModal());
    $("quit")?.addEventListener("click",goHome);
  }

  function showShop(lives = false) {
    synth("click");
    refreshLives();
    const canRefill = save.lives < MAX_LIVES && save.coins >= 100;
    showModal("shop",lives ? "Mạng" : "Cửa hàng","",
      `<div class="panel-copy"><p><span class="coin"></span> ${save.coins} xu</p><p>${save.lives} / ${MAX_LIVES} mạng</p></div>
        <div class="actions">${canRefill ? action("refill","Nạp · 100 xu") : ""}${action("close-shop","Xong",canRefill)}</div>`);
    $("refill")?.addEventListener("click",() => {
      save.coins -= 100;
      save.lives = MAX_LIVES;
      save.refillAt = 0;
      persist();
      refreshLives();
      if (game?.ended) goHome();
      else closeModal();
    });
    $("close-shop").addEventListener("click",() => game?.ended ? goHome() : closeModal());
  }

  function progress() {
    const summary = chapters.map(([title],chapter) => {
      const buttons = Array.from({length:5},(_,i) => {
        const number = chapter*5+i+1;
        const best = save.best[number];
        const label = best ? `Màn ${number}, kỷ lục ${clock(best)}` : `Màn ${number}`;
        return `<button type="button" data-level="${number}" aria-label="${label}">${number}${best ? "<span>✓</span>" : ""}</button>`;
      }).join("");
      return `<section><h3>${title}</h3><div class="level-choices">${buttons}</div></section>`;
    }).join("");
    showModal("progress","Chọn màn","30 đơn bánh",`<div class="level-list">${summary}</div>`);
    $("modal-body").querySelectorAll("[data-level]").forEach(button =>
      button.addEventListener("click",() => startGame(Number(button.dataset.level))));
  }

  function info(title,message) {
    showModal("info",title,"",`<div class="panel-copy guide-copy">${message}</div><div class="actions">${action("info-ok","Đã hiểu")}</div>`);
    $("info-ok").addEventListener("click",() => closeModal());
  }

  function drawEffects(now,dt) {
    effects.clearRect(0,0,art.W,art.H);
    if (game && (game.pausedAt === null || game.ended)) {
      game.flash = game.flash.filter(p => {
        p.life -= dt;
        if (p.life <= 0) return false;
        p.x += p.vx*dt;
        p.y += p.vy*dt;
        p.vy += 115*dt;
        effects.save();
        effects.translate(p.x,p.y);
        effects.rotate(p.life*7);
        effects.globalAlpha = Math.min(1,p.life*3);
        effects.fillStyle = p.color;
        effects.shadowColor = p.color;
        effects.shadowBlur = 9;
        effects.fillRect(-2,-2,4,4);
        effects.restore();
        return true;
      });
      if (game.praise && !game.ended) {
        const age = (now-game.praise.time)/1000;
        if (age < .9) {
          effects.save();
          effects.globalAlpha = Math.min(1,age*17,(.9-age)*6);
          const motion = reduceMotion.matches ? 0 : Math.sin(age*8)*.07;
          effects.translate(270,486-(reduceMotion.matches ? 0 : Math.sin(age*2.7)*21));
          effects.scale(1+motion,1+motion);
          effects.textAlign = "center";
          effects.font = '900 55px "Lilita One", "Arial Rounded MT Bold", system-ui, sans-serif';
          effects.lineJoin = "round";
          const fill = effects.createLinearGradient(-148,0,156,0);
          for (const [n,color] of ["#58ffe8","#80f321","#fff753","#ff7327"].entries()) fill.addColorStop(n/3,color);
          effects.strokeStyle = "#9b4810";
          effects.lineWidth = 15;
          effects.strokeText(game.praise.text,0,6);
          effects.strokeStyle = "#ffe95c";
          effects.lineWidth = 12;
          effects.strokeText(game.praise.text,0,0);
          effects.strokeStyle = "#3d240c";
          effects.lineWidth = 6;
          effects.strokeText(game.praise.text,0,0);
          effects.fillStyle = fill;
          effects.fillText(game.praise.text,0,0);
          effects.restore();
        }
      }
    }
    if (modalKind === "win") {
      celebration = celebration.filter(p => {
        p.life -= dt;
        if (p.life <= 0) return false;
        p.x += p.vx*dt;
        p.y += p.vy*dt;
        p.vy += 33*dt;
        p.rotation += p.spin*dt;
        effects.save();
        effects.translate(p.x,p.y);
        effects.rotate(p.rotation);
        effects.globalAlpha = Math.min(1,p.life*2);
        effects.fillStyle = p.color;
        effects.fillRect(-6,-2,12,4);
        effects.restore();
        return true;
      });
    }
  }

  function frame(now) {
    const delta = Math.max(0,(now-lastTime)/1000);
    const dt = Math.min(.05,delta);
    lastTime = now;
    if (game) {
      if (game.pausedAt === null && !game.ended) {
        const before = Math.ceil(game.seconds);
        if (!document.hidden) {
          if (!game.finishing) game.seconds = Math.max(0,game.seconds-delta);
          game.elapsed += delta;
          updateTrayStates(now);
        }
        if (game.physics.update(dt)) {
          game.trayDirty = game.geometryDirty = game.hitsDirty = true;
        }
        if (game.hitsDirty && now >= game.nextHitSync) {
          game.nextHitSync = now+90;
          syncHits();
        }
        if (!game.finishing && !game.spin && !game.flights.length && now >= game.nextAssist) {
          revealNeeded();
          game.nextAssist = now+420;
        }
        if (before !== Math.ceil(game.seconds) && game.seconds < 10) synth("tick");
        const done = game.flights.filter(flight => now >= flight.start+flight.duration);
        game.flights = game.flights.filter(flight => !done.includes(flight));
        for (const flight of done) flight.done?.(now);
        if (game.spin && now >= game.spin.started+game.spin.duration) advance(now);
        if (game.finishAt && game.elapsed >= game.finishAt) win();
        if (game.seconds <= 0 && !game.finishing) lose("Hết giờ","Đơn bánh chưa hoàn tất. Hãy thử lại màn này.");
        if (!game.finishing && !game.spin && !game.flights.length && game.waiting.every(Boolean) &&
            !game.ended && !canJoinWaitingHalf() && !game.mechanicFX.some(effect => effect.kind !== "syrup" && !effect.fired)) {
          lose("Đầy ô chờ","Cả 5 ô chờ đã đầy.");
        }
        showTime();
      }
      art.drawPlay(game,game.pausedAt ?? now);
    } else if (homeDirty) {
      art.drawHome();
      homeDirty = false;
    }
    drawEffects(now,dt);
    animation = requestAnimationFrame(frame);
  }

  $("world").addEventListener("pointerdown",e => {
    if (!game || modal.open || !e.isPrimary || e.button !== 0) return;
    const {x,y} = position(e);
    pressed = pickAt(x,y);
    if (pressed) $("world").setPointerCapture(e.pointerId);
  });
  $("world").addEventListener("pointermove",e => {
    if (!game || modal.open || e.pointerType !== "mouse") return;
    const {x,y} = position(e);
    const current = pickAt(x,y);
    e.currentTarget.style.cursor = current?.coatedUntil ? "not-allowed" : current ? "pointer" : "";
  });
  $("world").addEventListener("pointerup",() => {
    if (pressed) choose(pressed);
    pressed = null;
  });
  $("world").addEventListener("pointercancel",() => { pressed = null; });
  $("close-modal").addEventListener("click",() => closeModal());
  $("play").addEventListener("click",() => startGame(save.level));
  $("game-settings").addEventListener("click",settings);
  $("home-settings").addEventListener("click",settings);
  $("trophy-tab").addEventListener("click",progress);
  $("shop-tab").addEventListener("click",() => showShop());
  $("coin-shop").addEventListener("click",() => showShop());
  $("life-shop").addEventListener("click",() => showShop(true));
  $("home-tab").addEventListener("click",() => synth("click"));
  $("profile").addEventListener("click",progress);
  $("guide").setAttribute("aria-label","Cách chơi");
  $("guide").addEventListener("click",() => {
    const config = levels[game.number];
    const active = ["foil","syrup","box","halves","oven"].flatMap((key,i) => config[key] ? [chapters[i+1]] : []);
    info("Cách chơi",(active.length ? active : [chapters[0]]).map(([title,hint]) =>
      `<p><strong>${title}</strong><br>${hint}</p>`).join(""));
  });
  document.addEventListener("keydown",e => {
    if (e.key === "Escape") {
      if (modal.open) closeModal();
      else if (game && !game.ended) settings();
    }
    if (e.key !== "Tab" || !modal.open) return;
    const choices = [...modal.querySelectorAll("button:not([disabled])")];
    if (e.shiftKey && document.activeElement === choices[0]) {
      e.preventDefault();
      choices.at(-1).focus();
    } else if (!e.shiftKey && document.activeElement === choices.at(-1)) {
      e.preventDefault();
      choices[0].focus();
    }
  });
  document.addEventListener("visibilitychange",() => { lastTime = performance.now(); });
  new ResizeObserver(fit).observe(viewport);
  fit();
  refreshLives();
  persist();
  setInterval(() => { if (!game) refreshLives(); },1000);
  art.ready.then(() => {
    homeDirty = true;
    if (game) game.trayDirty = true;
  }).catch(() => {
    speak("Không tải được một số hình ảnh.");
  });
  animation = requestAnimationFrame(frame);
  addEventListener("pagehide",() => cancelAnimationFrame(animation));
  addEventListener("pageshow",e => {
    if (e.persisted) {
      lastTime = performance.now();
      animation = requestAnimationFrame(frame);
    }
  });
  const direct = Number(new URLSearchParams(location.search).get("level"));
  if (levels[direct]) startGame(direct);
})();
