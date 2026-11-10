(() => {
  "use strict";

  const art = window.ShapeArt;
  const tutorial = window.WordTutorial;
  const sfx = window.BakerySfx;
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
  const { levels, chapters, names, howTo, blocked } = window.WordLevels;
  const LAST_LEVEL = Object.keys(levels).length;
  const SAVE = "perfect-shape-letter-press-v1";
  const REFILL = 20 * 60 * 1000;
  const MAX_LIVES = 5;
  const BASE_WIN_COINS = 10;
  const SYRUP_SECONDS = 10;
  const mechanicTiming = {
    syrup: { impact:.66, fade:.66, end:1.21 },
    hammer: { impact:.35, fade:.45, end:1.06 },
    oven: { impact:.68, fade:1.07, end:1.72 }
  };
  const confettiColors = ["#ffdb68","#fff3c7","#ef7295","#a93f5e","#ff9961"];
  let game = null;
  let animation = 0;
  let modalKind = "";
  let priorFocus = null;
  let lastTime = 0;
  let celebration = [];
  let pressed = null;
  let homeDirty = true;
  const initial = { level:1, coins:100, lives:MAX_LIVES, refillAt:0, sound:true, haptics:true, best:{}, tutorials:{} };
  const params = new URLSearchParams(location.search);
  let save = { ...initial };
  try {
    const stored = JSON.parse(localStorage.getItem(SAVE));
    if (stored && levels[stored.level]) {
      save = { ...initial, ...stored, best:{ ...stored.best }, tutorials:{ ...stored.tutorials } };
    }
  } catch {}
  sfx.setEnabled(save.sound);

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
    $("life-clock").textContent = save.lives >= MAX_LIVES ? "Full" : clock((save.refillAt-Date.now())/1000);
    $("lives").textContent = save.lives;
    $("coins").textContent = save.coins;
    $("play").textContent = "Level "+save.level;
    $("home-progress").textContent = Object.keys(save.best).length+" / "+LAST_LEVEL+" levels";
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
    const stock = rows.map(row => row.map(kind => kind === blocked ? null : item(kind,{letter:true})));
    const hidden = rows.map((row,r) => row.map((_,c) => (config.foil ?? []).includes((r+1)*10+c+1)));
    const extract = cell => {
      const row = stock[Math.floor(cell/10)-1];
      const column = cell%10-1;
      const letter = row[column];
      row[column] = null;
      return letter;
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
      return ["Left","Right"].map(side => item(kind+side,{letter:true,pair:cell,whole:kind}));
    });

    // Earlier words start above later orders. The physics still determines what is exposed.
    const layers = [...stock].reverse().flatMap(row => shuffle(row.filter(Boolean),next));
    const cells = Array.from({length:24},(_,i) => [99+i%6*68,755+Math.floor(i/6)*77])
      .filter(([x,y]) => fixed.every(prop => Math.hypot(x-prop.x,y-prop.y) > 84));
    let positions = [];
    const tray = layers.map((piece,index) => {
      if (!positions.length) positions = shuffle([...cells],next);
      const [x,y] = positions.pop();
      return Object.assign(piece,{
        x:x+(next()-.5)*19, y:y+(next()-.5)*17, size:109+next()*24,
        angle:(next()-.5)*1.5, pose:Math.floor(next()*3), tier:Math.floor(index/cells.length)
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
      number, rows, hidden, columns:config.columns, alphabet:config.alphabet, row:0, filled:rows.map(row => row.map(() => 0)),
      tray, waiting:Array(5).fill(null), flights:[], mechanicFX:[], spin:null, flash:[], praise:null,
      physics:createTrayPhysics(tray), nextHitSync:0, nextAssist:0, assistStrength:3,
      time:config.time, seconds:config.time, elapsed:0, pausedAt:null, ended:false
    };
  }

  function updateWordClue() {
    $("word-clue").textContent = levels[game.number].clues[game.row];
    $("row-count").textContent = "Word "+(game.row+1)+" / "+game.rows.length;
  }

  function announceRow() {
    const {row,rows,filled} = game;
    const pattern = rows[row].filter(letter => letter !== blocked).map((letter,i) =>
      Number.isFinite(filled[row][i]) && filled[row][i] > 0 ? letter : "blank");
    speak(`Word ${row+1} of ${rows.length}. Clue: ${levels[game.number].clues[row]}. ${pattern.join(", ")}.`);
  }

  function startGame(number, replayTutorial = false) {
    refreshLives();
    if (save.lives <= 0) { showShop(true); return; }
    closeModal(false);
    tutorial.clear();
    game = makeGame(number);
    hits.replaceChildren();
    home.hidden = true;
    hud.hidden = false;
    hits.hidden = false;
    celebration = [];
    pressed = null;
    $("world").style.cursor = "";
    lastTime = performance.now();
    $("level-label").textContent = "Level "+number;
    $("chapter-label").textContent = chapters[levels[number].chapter];
    updateWordClue();
    $("timer").classList.toggle("untimed",game.time === null);
    $("timer").setAttribute("aria-label",game.time === null ? "No time limit" : "Time remaining");
    showTime();
    announceRow();
    game.tutorial = tutorial.start(game,save.tutorials,replayTutorial,(lesson,version) => {
      save.tutorials[lesson] = version;
      persist();
      game.tutorial = null;
      setTutorialControls(false);
      syncHits();
      announceRow();
      if (document.activeElement === document.body) $("game-settings").focus({ preventScroll:true });
    },speak);
    setTutorialControls(Boolean(game.tutorial));
    syncHits();
    (game.tutorial ? $("tutorial-skip") : $("game-settings")).focus({ preventScroll:true });
  }

  function goHome() {
    closeModal(false);
    tutorial.clear();
    setTutorialControls(false);
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
    const timed = game.time !== null;
    $("time").textContent = timed ? clock(game.seconds) : "∞";
    $("timer-fill").style.transform = `scaleX(${timed ? Math.max(0,game.seconds/game.time) : 1})`;
    $("timer").classList.toggle("danger",timed && game.seconds <= 10);
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

  function setTutorialControls(active) {
    stage.classList.toggle("guiding",active);
    $("game-settings").tabIndex = $("guide").tabIndex = active ? -1 : 0;
  }

  function syncTutorialHits() {
    if (!game.tutorial) return;
    const buttons = new Map(Array.from(hits.children,button => [Number(button.dataset.pieceId),button]));
    for (const piece of game.tray) {
      const button = buttons.get(piece.id);
      if (button) button.tabIndex = game.tutorial.allows(piece) ? 0 : -1;
    }
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
      button.tabIndex = !game.tutorial || game.tutorial.allows(piece) ? 0 : -1;
      button.dataset.kind = piece.kind;
      button.setAttribute("aria-label",names[piece.kind]+(piece.coatedUntil ? ", coated in ink" : ""));
      button.setAttribute("aria-disabled",String(Boolean(piece.coatedUntil)));
      const size = Math.max(46,piece.size*.67);
      Object.assign(button.style,{
        width:`${size}px`,height:`${size}px`,left:`${piece.x-size/2}px`,top:`${piece.y-size/2}px`
      });
    }
    for (const button of existing.values()) button.remove();
    if (active?.dataset.pieceId && !active.isConnected && !modal.open) {
      const fallback = game.tutorial ? $("tutorial-skip") : $("game-settings");
      (hits.querySelector('button[tabindex="0"]') ?? fallback).focus({ preventScroll:true });
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
      sfx.play("fit");
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
          speak("The letter press is opening.");
        }
      }
      if (revealed) {
        sfx.play("foil",.025);
        announceRow();
        drainWaiting(arrived);
      }
      if (game.filled[row].every((value,i) => game.rows[row][i] === blocked || (Number.isFinite(value) && value > 0))) completeRow();
      else if (!revealed) announceRow();
    });
  }

  function releaseContents(container, now) {
    remove(container);
    const oven = container.kind === "ovenOpen";
    const offsets = oven ? [[-62,42],[-19,64],[28,61]] : [[-22,-18],[24,18],[-15,33],[30,-28]];
    container.contents.forEach((letter,i) => {
      const [dx,dy] = offsets[i%offsets.length];
      const target = {
        x:Math.max(100,Math.min(438,container.x+dx)),
        y:Math.max(750,Math.min(992,container.y+dy)),
        size:116
      };
      const drop = () => {
        Object.assign(letter,target,{angle:(i-1)*.42,pose:i%2});
        game.tray.push(letter);
        game.physics.add(letter,oven ? 34 : Math.min(140,container.depth+31+i*20));
        game.physics.poke(letter,dx*.048,dy*.047,1.3);
        game.trayDirty = game.geometryDirty = game.hitsDirty = true;
      };
      if (oven) {
        const from = { ...letter, x:container.x+(i-1)*13, y:container.y+5, size:48 };
        launch(from,{...target,arc:13},now+i*(reduceMotion.matches ? 0 : 43),drop);
      } else {
        drop();
      }
    });
    flash(container.x,container.y,oven ? "#ffb267" : "#ffd5a4",oven ? 12 : 22);
    sfx.play(oven ? "oven" : "crack");
    speak(oven ? "The letter dropped out of the press." : "The type box broke and released its letters.");
    game.trayDirty = game.geometryDirty = game.hitsDirty = true;
  }

  function tapSyrup(candy) {
    const nearby = game.tray.filter(piece => piece.letter && exposed(piece))
      .map(piece => ({piece,distance:Math.hypot(piece.x-candy.x,piece.y-candy.y)}))
      .sort((a,b) => a.distance-b.distance || a.piece.id-b.piece.id);
    if (!nearby.length) {
      sfx.play("miss");
      speak("The ink needs an exposed letter in the tray.");
      return;
    }
    remove(candy);
    const targets = nearby.slice(0,candy.coatCount).map(({piece}) => piece);
    const effect = animateMechanic("syrup",candy,targets);
    for (const piece of targets) {
      piece.syrupSpread ??= 0;
      piece.coatedUntil = game.elapsed+effect.impact+SYRUP_SECONDS;
    }
    speak("The ink is spilling. You can pick coated letters again in 10 seconds.");
  }

  function revealNeeded() {
    const needed = game.rows[game.row].filter((letter,i) => letter !== blocked && !game.filled[game.row][i] && !game.hidden[game.row][i]);
    if (!needed.length) return;
    const candidate = piece => !piece.coatedUntil && (
      needed.includes(piece.whole ?? piece.kind) ||
      piece.kind === "hammer" && piece.box.contents.some(letter => needed.includes(letter.kind))
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
      sfx.play("wait");
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
    const whole = { id:first.id, kind:first.whole, letter:true, ...(still ? spot : center) };
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
      sfx.play("join");
      speak(names[first.whole]+" reassembled.");
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
    if (game.tutorial && !game.tutorial.allows(piece)) return;
    const now = performance.now();
    if (piece.coatedUntil) {
      speak(piece.syrupSpread ? "This letter is locked by ink." : "Ink is flowing toward this letter.");
      sfx.play("miss");
      return;
    }
    if (piece.kind === "syrupCandy") {
      tapSyrup(piece);
    } else if (piece.kind === "hammer") {
      const box = piece.box;
      remove(piece);
      sfx.play("lift");
      launch(piece,{x:box.x+29,y:box.y-8,size:117,arc:32},now,() => animateMechanic("hammer",box));
    } else if (piece.kind === "pastryBox" || piece.kind === "oven" || piece.kind === "ovenOpen") {
      speak(piece.kind === "pastryBox" ? "Pick up the mallet to break open the type box." :
        `Match ${piece.remaining} more ${piece.remaining === 1 ? "letter" : "letters"} to open the press.`);
      sfx.play("miss");
      return;
    } else {
      const partner = piece.pair ? game.waiting.findIndex(entry => halvesMatch(entry,piece)) : -1;
      if (partner >= 0) {
        sfx.play("lift");
        joinHalf(piece,partner,now);
      } else {
        const col = piece.pair ? -1 : missingIndex(piece.kind);
        const waiting = game.waiting.indexOf(null);
        if (col < 0 && waiting < 0) {
          sfx.play("miss");
          return;
        }
        remove(piece);
        sfx.play("lift");
        if (col >= 0) match(piece,col,now);
        else park(piece,waiting,now);
      }
    }
    if (!game.tray.includes(piece)) game.tutorial?.accept();
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
    let uncoated = false;
    for (const piece of game.tray) {
      if (piece.coatedUntil && game.elapsed >= piece.coatedUntil) {
        delete piece.coatedUntil;
        delete piece.syrupSpread;
        game.trayDirty = game.geometryDirty = game.hitsDirty = true;
        flash(piece.x,piece.y,"#ffdfb1",7);
        uncoated = true;
      }
    }
    if (uncoated) sfx.play("uncoat");
    game.mechanicFX = game.mechanicFX.filter(effect => {
      const age = game.elapsed-effect.start;
      if (age >= effect.impact) {
        if (effect.kind === "syrup") {
          if (!effect.fired) sfx.play("syrup");
          effect.fired = true;
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
    // Early levels have an 80% chance of any bonus, including the 50% jackpot.
    const [bonusChance,jackpotChance] = game.number <= 5 ? [.80,.50] : [.35,.05];
    const roll = Math.random();
    const multiplier = roll < jackpotChance ? 5 : roll < bonusChance ? 3 : 1;
    const matches = multiplier === 5 ? game.columns : multiplier === 3 ? 3 : 0;
    const pick = kinds => kinds[Math.floor(Math.random()*kinds.length)];
    const winner = matches ? pick(game.alphabet) : null;
    const stops = Array(matches).fill(winner);
    // At most two of each other kind can land, so only the chosen bonus can match.
    const fillers = game.alphabet.filter(kind => kind !== winner).flatMap(kind => [kind,kind]);
    while (stops.length < game.columns) {
      const index = Math.floor(Math.random()*fillers.length);
      stops.push(fillers.splice(index,1)[0] ?? blocked);
    }
    shuffle(stops,Math.random);

    // Leave the first visible tiles in place until the new strip rolls into view.
    const reels = stops.map(stop => Array.from({length:steps+3},(_,i) =>
      i < 3 ? undefined : i === steps ? stop : pick(game.alphabet)));
    const coins = BASE_WIN_COINS*multiplier;
    game.bonus = { steps, reels, winner, matches, multiplier, coins };

    const best = save.best[game.number] ?? 0;
    save.best[game.number] = game.time === null ? true : Math.max(best,Math.ceil(game.seconds));
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
    game.praise = { text:game.rows[game.row].join("")+"!", time:now };
    sfx.play("row",.065);
    vibrate(29);
  }

  function advance(now) {
    game.spin = null;
    if (game.finishing) {
      const { steps, reels, winner, multiplier } = game.bonus;
      game.praise = { text:`Bonus ×${multiplier}`, time:now };
      if (winner) {
        sfx.play("bonus");
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
    updateWordClue();
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
    if (game?.tutorial) $("tutorial").hidden = true;
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
    if (game?.tutorial) $("tutorial").hidden = false;
    if (restore && priorFocus?.isConnected) priorFocus.focus({ preventScroll:true });
  }

  const action = (id,label,alt = false) =>
    `<button class="action${alt?" alt":""}" id="${id}">${label}</button>`;

  function win() {
    game.ended = true;
    const { matches, multiplier, coins } = game.bonus;
    sfx.play("win");
    vibrate([24,43,34]);
    speak(`Level ${game.number} complete. ${multiplier} times the reward. You earned ${coins} coins.`);
    const next = game.number < LAST_LEVEL;
    const subtitle = matches ? `${matches} matches · Bonus ×${multiplier}` :
      next ? "Words Complete" : "Final Words Complete";
    showModal("win",`Level ${game.number}`,subtitle,
      `<div class="panel-copy reward">${art.rewardCoins()}<b>+${coins}</b></div><div class="actions">${next ? action("continue","Next Level") : ""}${action("win-home","Home",next)}</div>`);
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
    sfx.play("lose");
    const number = game.number;
    showModal("lose",title,`Level ${number}`,
      `<div class="panel-copy">${message}</div><div class="actions">${action("retry","Try Again")}${action("back","Home",true)}</div>`);
    $("retry").addEventListener("click",() => startGame(number));
    $("back").addEventListener("click",goHome);
  }

  function settings() {
    const toggle = (id,key,label) =>
      `<div class="setting-row"><span>${label}</span><button class="toggle" id="${id}" aria-label="${label}" aria-pressed="${save[key]}">${save[key]?"On":"Off"}</button></div>`;
    showModal("settings","Settings",game ? "Paused" : "",
      `<div class="panel-copy">${toggle("sound-toggle","sound","Sound")}${toggle("haptic-toggle","haptics","Vibration")}</div>
        <div class="actions">${action("resume",game?"Resume":"Done")}${game?action("quit","Home",true):""}</div>`);
    for (const [id,key] of [["sound-toggle","sound"],["haptic-toggle","haptics"]]) {
      const button = $(id);
      button.addEventListener("click",() => {
        save[key] = !save[key];
        button.textContent = save[key] ? "On" : "Off";
        button.setAttribute("aria-pressed",save[key]);
        persist();
        if (key === "sound") {
          sfx.setEnabled(save.sound);
          sfx.play("click");
        } else vibrate(20);
      });
    }
    $("resume").addEventListener("click",() => closeModal());
    $("quit")?.addEventListener("click",goHome);
  }

  function showShop(lives = false) {
    refreshLives();
    const canRefill = save.lives < MAX_LIVES && save.coins >= 100;
    showModal("shop",lives ? "Lives" : "Shop","",
      `<div class="panel-copy"><p><span class="coin"></span> ${save.coins} ${save.coins === 1 ? "coin" : "coins"}</p><p>${save.lives} / ${MAX_LIVES} lives</p></div>
        <div class="actions">${canRefill ? action("refill","Refill · 100 coins") : ""}${action("close-shop","Done",canRefill)}</div>`);
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
    const summary = chapters.map((title,chapter) => {
      const buttons = Array.from({length:5},(_,i) => {
        const number = chapter*5+i+1;
        const best = save.best[number];
        const label = !best ? `Level ${number}` : levels[number].time === null ? `Level ${number}, completed` :
          `Level ${number}, best time ${clock(best)}`;
        return `<button type="button" data-level="${number}" aria-label="${label}">${number}${best ? "<span>✓</span>" : ""}</button>`;
      }).join("");
      return `<section><h3>${title}</h3><div class="level-choices">${buttons}</div></section>`;
    }).join("");
    showModal("progress","Select Level",`${LAST_LEVEL} levels`,`<div class="level-list">${summary}</div>`);
    $("modal-body").querySelectorAll("[data-level]").forEach(button =>
      button.addEventListener("click",() => startGame(Number(button.dataset.level))));
  }

  function info(title,message) {
    showModal("info",title,"",`<div class="panel-copy guide-copy">${message}</div><div class="actions">${action("info-ok","Got It")}</div>`);
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
        const timed = game.time !== null;
        const before = timed ? Math.ceil(game.seconds) : 0;
        if (!document.hidden) {
          if (timed && !game.finishing && !game.tutorial) game.seconds = Math.max(0,game.seconds-delta);
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
        if (!game.tutorial && !game.finishing && !game.spin && !game.flights.length && now >= game.nextAssist) {
          revealNeeded();
          game.nextAssist = now+420;
        }
        if (timed && before !== Math.ceil(game.seconds) && game.seconds > 0 && game.seconds <= 9) sfx.play("tick");
        const done = game.flights.filter(flight => now >= flight.start+flight.duration);
        game.flights = game.flights.filter(flight => !done.includes(flight));
        for (const flight of done) flight.done?.(now);
        if (game.spin && now >= game.spin.started+game.spin.duration) advance(now);
        if (game.finishAt && game.elapsed >= game.finishAt) win();
        if (timed && game.seconds <= 0 && !game.finishing) lose("Time’s Up","The words are unfinished. Try this level again.");
        if (!game.finishing && !game.spin && !game.flights.length && game.waiting.every(Boolean) &&
            !game.ended && !canJoinWaitingHalf() && !game.mechanicFX.some(effect => effect.kind !== "syrup" && !effect.fired)) {
          lose("Slots Full","All 5 waiting slots are full.");
        }
        showTime();
      }
      art.drawPlay(game,game.pausedAt ?? now);
      const target = game.tutorial?.target;
      game.tutorial?.draw(now,modal.open);
      if (game.tutorial?.target !== target) syncTutorialHits();
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
    if (game.tutorial && !game.tutorial.allows(pressed)) pressed = null;
    if (pressed) {
      if (game.tutorial) tutorial.pressed(true);
      $("world").setPointerCapture(e.pointerId);
    }
  });
  $("world").addEventListener("pointermove",e => {
    if (!game || modal.open || e.pointerType !== "mouse") return;
    const {x,y} = position(e);
    const current = pickAt(x,y);
    const allowed = !game.tutorial || game.tutorial.allows(current);
    e.currentTarget.style.cursor = !allowed ? "" : current?.coatedUntil ? "not-allowed" : current ? "pointer" : "";
  });
  $("world").addEventListener("pointerup",() => {
    tutorial.pressed(false);
    if (pressed) choose(pressed);
    pressed = null;
  });
  $("world").addEventListener("pointercancel",() => { pressed = null; tutorial.pressed(false); });
  $("close-modal").addEventListener("click",() => closeModal());
  $("play").addEventListener("click",() => startGame(save.level));
  $("game-settings").addEventListener("click",settings);
  $("home-settings").addEventListener("click",settings);
  $("trophy-tab").addEventListener("click",progress);
  $("shop-tab").addEventListener("click",() => showShop());
  $("coin-shop").addEventListener("click",() => showShop());
  $("life-shop").addEventListener("click",() => showShop(true));
  $("profile").addEventListener("click",progress);
  $("guide").setAttribute("aria-label","How to Play");
  $("guide").addEventListener("click",() => {
    const config = levels[game.number];
    const active = ["foil","syrup","box","halves","oven"].flatMap((key,i) => config[key] ? [howTo[i+1]] : []);
    info("How to Play",[howTo[0],...active].map(([title,hint]) =>
      `<p><strong>${title}</strong><br>${hint}</p>`).join(""));
  });
  document.addEventListener("click",e => {
    const button = e.target.closest?.("button");
    if (button && button.id !== "sound-toggle" && !hits.contains(button)) sfx.play("click");
  },true);
  document.addEventListener("keydown",e => {
    if (e.key === "Escape") {
      if (modal.open || game && !game.ended) {
        sfx.play("click");
        if (modal.open) closeModal();
        else settings();
      }
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
    speak("Some images could not load.");
  });
  animation = requestAnimationFrame(frame);
  addEventListener("pagehide",() => cancelAnimationFrame(animation));
  addEventListener("pageshow",e => {
    if (e.persisted) {
      lastTime = performance.now();
      animation = requestAnimationFrame(frame);
    }
  });
  const direct = Number(params.get("level"));
  if (levels[direct]) startGame(direct,params.get("tutorial") === "1");
})();
