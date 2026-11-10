(() => {
  "use strict";

  const art = window.ShapeArt;
  const $ = id => document.getElementById(id);
  const root = $("tutorial");
  const shade = $("tutorial-shade").getContext("2d");
  const hand = $("tutorial-hand");
  const skip = $("tutorial-skip");
  const next = $("tutorial-next");
  const title = $("tutorial-title");
  const copy = $("tutorial-copy");
  const progress = $("tutorial-progress");
  const card = $("tutorial-card");
  const firstLevels = {1:"basics", 2:"timer", 6:"foil", 11:"syrup", 16:"box", 21:"halves", 26:"oven"};
  const version = 2;
  const waiting = i => {
    const {x,y} = art.slotCenter(i);
    return {x:x-42,y:y-31,w:84,h:67};
  };
  const row = g => art.rowFocus(g);
  const clue = {x:59,y:554,w:422,h:49};
  const timer = {x:179,y:37,w:184,h:64};
  const kind = name => piece => piece.kind === name;
  const normal = piece => piece.letter && !piece.pair && !piece.coatedUntil;
  const open = (g,i) => !g.filled[g.row][i] && !g.hidden[g.row][i];
  const column = (g,name) => g.rows[g.row].findIndex((k,i) => k === name && open(g,i));
  const fits = (g,piece) => normal(piece) && column(g,piece.kind) >= 0;
  const mold = (g,i) => i >= 0 ? art.rowFocus(g,i) : null;
  const matchFocus = (g,piece) => piece ? mold(g,column(g,piece.kind)) : row(g);
  const body = p => p && {x:p.x-p.size*.37,y:p.y-p.size*.37,w:p.size*.74,h:p.size*.74};
  const pointAt = ({x,y,w,h}) => ({x:x+w*.76,y:y+h*.62});

  const lessons = {
    basics: () => [
      {title:"Build a word in the gold row", text:"Read the clue below the drum. Fill the open cells to form the word. Skip any × cells.",
        focus:g => [row(g),clue], point:g => pointAt(row(g)), button:"Next", cardPosition:"below-row"},
      {title:"Pick letters from the tray", text:"Tap a letter that belongs in this word. Letters for later words wait in the five small slots.",
        pick:fits, freePick:true, focus:() => [art.trayFrame,clue]}
    ],
    timer: () => [
      {title:"Beat the timer", text:"From this level on, fill all the rows before time runs out. The timer starts when you press Start.",
        focus:() => [timer], point:() => pointAt(timer), button:"Start", cardPosition:"below-timer"}
    ],
    foil: g => {
      const foil = g.hidden[0].findIndex(Boolean);
      const neighbor = foil > 0 ? foil-1 : foil+1;
      return [
        {title:"Peel the foil", text:"Tap the letter that belongs in the cell next to the foil.",
          pick:(g,p) => fits(g,p) && column(g,p.kind) === neighbor,
          focus:g => [mold(g,foil),mold(g,neighbor)]}
      ];
    },
    syrup: g => {
      const candy = g.tray.find(kind("syrupCandy"));
      return [
        {title:"Avoid the ink block", text:"Leave this block alone. Tapping it spills ink that locks nearby letters for 10 seconds.",
          focus:g => [art.pieceFocus(g,candy) ?? body(candy)], button:"Got it", warning:true}
      ];
    },
    box: g => {
      const box = g.tray.find(kind("pastryBox"));
      return [
        {title:"Crack the type box", text:"Tap the mallet. It flies over and breaks the type box open.",
          pick:(_,p) => p.kind === "hammer", focus:() => [body(box)]}
      ];
    },
    halves: g => {
      const pair = g.tray.find(p => p.pair);
      return [
        {title:"Pick half a letter", text:"Tap a half to put it in a waiting slot.",
          pick:(_,p) => p.pair === pair.pair && !p.coatedUntil, focus:() => [waiting(0)]},
        {title:"Join the two halves", text:"Tap the matching half to make a whole letter.",
          pick:(_,p) => p.pair === pair.pair && !p.coatedUntil, focus:g => [waiting(0),mold(g,0)]}
      ];
    },
    oven: g => {
      const oven = g.tray.find(kind("oven"));
      return [
        {title:"Open the letter press", text:"Each match lowers the count by one. At zero, the press opens. Try one match.",
          pick:fits, focus:(g,p) => [body(oven),matchFocus(g,p)]}
      ];
    }
  };

  let current = null;
  function clear() {
    current = null;
    root.hidden = hand.hidden = true;
    hand.classList.remove("pressed");
  }

  function start(game, seen, force, onFinish, announce) {
    const lesson = firstLevels[game.number];
    if (!lesson || (!force && seen[lesson] === version)) return null;
    const steps = lessons[lesson](game);
    let index = 0;
    let settling = false;
    let uncoverAt = 0;
    let stillAreas = [];
    const controller = {
      target:null,
      allows(piece) {
        const step = steps[index];
        return Boolean(piece && !settling && (step.freePick ? step.pick(game,piece) : piece === controller.target));
      },
      accept() {
        if (steps[index].freePick) { advance(); return; }
        settling = true;
        controller.target = null;
        hand.hidden = true;
      },
      finish() {
        if (current !== controller) return;
        clear();
        onFinish(lesson,version);
      },
      next() { if (steps[index]?.button) advance(); },
      draw(now, paused) {
        root.hidden = paused;
        if (paused) return;
        if (settling && !game.flights.length && !game.spin && !game.mechanicFX.length) {
          advance();
          if (current !== controller) return;
        }
        const step = steps[index];
        let focus = null;
        if (step.pick && !settling) {
          const candidates = game.tray.filter(piece => step.pick(game,piece));
          let piece = controller.target;
          focus = candidates.includes(piece) && art.pieceFocus(game,piece);
          if (!focus || focus.area < 150) {
            let best = 0;
            piece = null;
            focus = null;
            for (const candidate of candidates) {
              if (!art.exposed(game,candidate)) continue;
              const spot = art.pieceFocus(game,candidate);
              if (!spot || spot.area <= best) continue;
              best = spot.area;
              piece = candidate;
              focus = spot;
            }
          }
          controller.target = piece;
          if ((!focus || focus.area < 150) && now >= uncoverAt) {
            const candidate = piece ?? candidates.reduce((a,b) => !a || b.depth > a.depth ? b : a,null);
            if (candidate) game.physics.uncover(candidate,4.2);
            uncoverAt = now+490;
          }
        }
        const areas = step.focus?.(game,controller.target) ?? [];
        if (settling) {
          areas.push(...stillAreas);
          for (const flight of game.flights) {
            if (now >= flight.start) areas.push(body(art.flightPose(flight,now)));
          }
        } else {
          stillAreas = areas.slice();
        }
        if (focus && !step.freePick) areas.push(focus);
        drawShade(areas.filter(Boolean),step.warning);
        const point = focus?.point ?? step.point?.(game);
        hand.hidden = !point;
        hand.classList.toggle("point-only",!focus);
        if (point) {
          const {x,y} = point;
          hand.style.setProperty("--hand-x",`${x}px`);
          hand.style.setProperty("--hand-y",`${y}px`);
          hand.style.setProperty("--hand-side",x > 400 ? -1 : 1);
        }
      }
    };

    function enterStep() {
      const step = steps[index];
      settling = false;
      stillAreas = [];
      hand.hidden = true;
      title.textContent = step.title;
      card.dataset.position = step.cardPosition ?? "";
      copy.textContent = step.text;
      progress.textContent = `Level ${game.number} · Tutorial ${index+1}/${steps.length}`;
      if (!step.button && document.activeElement === next) skip.focus({ preventScroll:true });
      next.hidden = !step.button;
      next.textContent = step.button ?? "";
      announce(`${step.title}. ${copy.textContent}`);
    }

    function advance() {
      index++;
      if (index >= steps.length) controller.finish();
      else enterStep();
    }

    current = controller;
    enterStep();
    root.hidden = false;
    return controller;
  }

  function drawShade(areas, warning) {
    shade.clearRect(0,0,art.W,art.H);
    shade.fillStyle = "rgba(31,15,23,.74)";
    shade.fillRect(0,0,art.W,art.H);
    const outline = ({x,y,w,h,radius = 20}) => {
      shade.beginPath();
      shade.roundRect(x-6,y-6,w+12,h+12,Math.min(radius,(Math.min(w,h)+12)/2));
    };
    shade.strokeStyle = warning ? "#ff9e76" : "#ffe5a8";
    shade.lineWidth = 4;
    for (const area of areas) { outline(area); shade.stroke(); }
    shade.globalCompositeOperation = "destination-out";
    shade.fillStyle = "#000";
    for (const area of areas) { outline(area); shade.fill(); }
    shade.globalCompositeOperation = "source-over";
  }

  skip.addEventListener("click",() => current?.finish());
  next.addEventListener("click",() => current?.next());
  window.WordTutorial = {start,clear,pressed:on => hand.classList.toggle("pressed",on)};
})();
