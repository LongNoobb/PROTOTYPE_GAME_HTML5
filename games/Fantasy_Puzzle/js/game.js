// FANTASY PUZZLE — presentation layer (UI, rendering, input, animation, save). Rules live in sim.js.
(function () {
  'use strict';
  const S = window.SIM, D = window.DATA, LEVELS = window.LEVELS, CHAPTERS = window.CHAPTERS;
  const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  const COLS = 'ABCD';
  const SHORT = { sword: 'Kiếm', archer: 'Cung', mage: 'Pháp', lancer: 'Thương', assassin: 'Sát', ice: 'Băng' };
  const hname = h => (G.level && G.level.heroes.length > 3 ? SHORT[h] : S.HEROES[h].name);
  const cellName = (c, r) => COLS[c] + (r + 1);
  const now = () => performance.now();
  const nextFrame = cb => setTimeout(cb, 16); // logic timers: independent of rAF (works in background panes)
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const CFONT = "'Be Vietnam Pro', system-ui, sans-serif"; // same family as the HTML UI, for all canvas text
  const IC = window.ICONS, ic = IC.icon, STAR = ic('star', { cls: 'ic-star' }), stars3 = n => [1, 2, 3].map(i => i <= n ? STAR : ic('star', { cls: 'ic-star off' })).join('');
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  // ================= SAVE SYSTEM =================
  const CAT_IC = { normal: 'sword', push: 'push', rage: 'rage' }, KIND_IC = { slime: 'skull', skel: 'skull', armor: 'shield', anchor: 'anchor', boss: 'trophy' };
  const SAVE_KEY = 'fantasyPuzzle.save', SAVE_VERSION = 2;
  const defaultSave = () => ({ version: SAVE_VERSION, progress: {}, hintsUsed: {}, drafts: {}, skins: {}, tutorialsSeen: {},
    settings: { music: 35, sfx: 70, vibe: true, speed: 1, reduce: false, finalPreview: false, lang: 'vi' } });
  let SAVE = defaultSave();
  function loadSave() {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return; }
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      if (!s || typeof s !== 'object' || typeof s.progress !== 'object') throw new Error('shape');
      if (s.version !== SAVE_VERSION) { // migrate: keep progress & settings
        const d = defaultSave(); d.progress = s.progress || {}; d.settings = Object.assign(d.settings, s.settings || {}); SAVE = d; persist(); return;
      }
      const d = defaultSave();
      SAVE = Object.assign(d, s); SAVE.settings = Object.assign(defaultSave().settings, s.settings || {});
    } catch (e) {
      try { localStorage.setItem(SAVE_KEY + '.corrupt', raw); } catch (_) { }
      SAVE = defaultSave(); persist();
      setTimeout(() => toast('Dữ liệu lưu bị lỗi đã được khôi phục về mặc định (bản lỗi được giữ lại).'), 600);
    }
  }
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { } }
  const totalStars = () => Object.values(SAVE.progress).reduce((a, p) => a + (p.stars || 0), 0);
  const cleared = id => !!(SAVE.progress[id] && SAVE.progress[id].stars > 0);
  const unlocked = id => !!SAVE.unlockAll || id === 1 || cleared(id - 1) || cleared(id);
  const heroFirstLevel = h => (LEVELS.find(l => l.heroes.includes(h)) || {}).id || 999;
  const heroUnlocked = h => unlocked(heroFirstLevel(h));
  function skinOf(h) { const list = D.SKINS[h]; const i = SAVE.skins[h] || 0; return list[i] && totalStars() >= list[i].unlock ? list[i] : list[0]; }

  // ================= ASSETS =================
  const IMG = {};
  function loadImg(src) {
    if (IMG[src]) return IMG[src].p;
    const img = new Image(); const rec = { img, ok: false };
    rec.p = new Promise(res => { img.onload = () => { rec.ok = true; res(); }; img.onerror = () => res(); });
    img.src = src; IMG[src] = rec; return rec.p;
  }
  function sheet(name, anim) {
    const c = D.META.chars[name]; if (!c) return null;
    let a = c.anims[anim]; if (!a) { anim = c.anims.Idle ? 'Idle' : 'Flying'; a = c.anims[anim]; }
    const src = D.charPath(name, anim); const rec = IMG[src];
    return rec && rec.ok ? { img: rec.img, frames: a.frames, box: c.box } : null;
  }
  function fxSheet(name) { const f = D.META.fx[name]; if (!f) return null; const rec = IMG[D.fxPath(name)]; return rec && rec.ok ? { img: rec.img, frames: f.frames, box: f.box } : null; }
  const idleOf = name => D.META.chars[name].anims.Idle ? 'Idle' : 'Flying';
  async function preload() {
    const list = [];
    for (const [name, c] of Object.entries(D.META.chars)) for (const anim of Object.keys(c.anims)) {
      if (/With magic|No beam|No spike|_Effect|Beam$|Spike$|Summon/.test(anim)) continue; list.push(D.charPath(name, anim));
    }
    for (const n of Object.keys(D.META.fx)) list.push(D.fxPath(n));
    let done = 0;
    await Promise.all(list.map(src => loadImg(src).then(() => { done++; $('#load-bar').style.width = (done / list.length * 100) + '%'; })));
  }
  // draw a 100x100-frame sprite anchored at its feet. sc = device px per source px
  function spr(ctx, sh, frame, cx, footY, sc, flip, alpha, filter, dpr) {
    if (!sh) return;
    const box = sh.box || [40, 40, 60, 57];
    const ax = (box[0] + box[2] + 1) / 2, ay = box[3] + 1;
    ctx.save();
    ctx.setTransform(flip ? -1 : 1, 0, 0, 1, Math.round(cx * dpr), Math.round(footY * dpr));
    if (alpha != null) ctx.globalAlpha = alpha;
    if (filter && !SAVE.settings.reduce) ctx.filter = filter; else if (filter) ctx.filter = filter;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sh.img, (frame % sh.frames) * 100, 0, 100, 100, Math.round(-ax * sc), Math.round(-ay * sc), 100 * sc, 100 * sc);
    ctx.restore();
  }
  const FRAME_MS = 95;
  function frameAt(t0, frames, loop, speed) {
    const f = Math.floor((now() - t0) * (speed || 1) / FRAME_MS);
    return loop ? f % frames : Math.min(f, frames - 1);
  }

  // ================= SCREENS =================
  let screen = 'loading', prevScreen = 'home';
  function show(id) {
    $$('.screen').forEach(s => s.classList.remove('active'));
    $('#scr-' + id).classList.add('active');
    if (id !== 'settings') prevScreen = screen === 'settings' ? prevScreen : screen;
    screen = id;
    if (id === 'home') renderHome();
    if (id === 'levels') renderLevels();
    if (id === 'collection') renderCollection();
    if (id === 'settings') renderSettings();
    if (id === 'game') requestAnimationFrame(resizeBoard);
  }
  function toast(msg, ms) {
    const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add('hidden'), ms || 2200);
  }
  function modal(html, onBind) {
    $('#modal-box').innerHTML = html; $('#modal').classList.remove('hidden');
    if (onBind) onBind($('#modal-box'));
  }
  const closeModal = () => $('#modal').classList.add('hidden');
  function vibrate(ms) { if (SAVE.settings.vibe && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { } }

  // ================= GAME STATE =================
  const G = {
    level: null, placement: {}, order: [], actions: {}, sel: null, hist: [], fut: [],
    pv: 0, sim: null, mode: 'plan', drag: null, ptr: null, tutStep: 0, tut: null,
  };
  const snapshot = () => JSON.stringify({ placement: G.placement, order: G.order, actions: G.actions });
  function restore(js) { const o = JSON.parse(js); G.placement = o.placement; G.order = o.order; G.actions = o.actions; }
  function commit(fn, sfx) {
    const before = snapshot(); fn(); const after = snapshot();
    if (before === after) return;
    G.hist.push(before); if (G.hist.length > 200) G.hist.shift(); G.fut = [];
    if (sfx) AUDIO.play(sfx);
    planChanged();
  }
  const pushDir = h => S.SKILLS[S.HEROES[h].skills.push].dir; // fixed per hero
  function planOf() { return G.order.map(h => ({ heroId: h, cat: G.actions[h].cat, dir: pushDir(h) })); }
  function planChanged() {
    G.sim = S.simulate(G.level, G.placement, planOf());
    SAVE.drafts[G.level.id] = JSON.parse(snapshot()); persist();
    if (G.sel) G.pv = G.order.indexOf(G.sel);
    G.pv = clamp(G.pv, 0, G.order.length);
    renderPlanUI(); tutCheck();
  }
  function startLevel(id, keepPlan) {
    const lv = LEVELS.find(l => l.id === id); if (!lv) return;
    G.level = lv; G.mode = 'plan'; G.hist = []; G.fut = []; G.drag = null;
    if (!keepPlan) {
      const d = SAVE.drafts[id];
      if (d && d.order && d.order.length === lv.heroes.length && lv.heroes.every(h => d.placement[h] && d.actions[h])) {
        G.placement = d.placement; G.order = d.order; G.actions = d.actions;
      } else resetPlan();
    }
    G.sel = G.order[0]; G.pv = 0; G.solo = true;
    $('#g-name').textContent = 'MÀN ' + String(id).padStart(2, '0') + ' · ' + lv.name.toUpperCase();
    $('#g-goal').textContent = 'Hạ hết quái trong 1 lượt · ' + lv.goal;
    setExecUI(false);
    show('game'); resizeBoard(); fitTitle();
    G.sim = S.simulate(lv, G.placement, planOf());
    renderPlanUI();
    buildActorsFromState(previewState());
    startTutorial();
    AUDIO.setMusic(SAVE.settings.music > 0);
  }
  function resetPlan() {
    const lv = G.level;
    G.placement = JSON.parse(JSON.stringify(lv.initial));
    G.order = lv.heroes.slice();
    G.actions = {}; lv.heroes.forEach(h => { G.actions[h] = { cat: 'normal', dir: 2 }; });
  }
  const heroAt = (c, r) => G.order.find(h => G.placement[h][0] === c && G.placement[h][1] === r);
  const isLocked = (c, r) => (G.level.locked || []).some(p => p[0] === c && p[1] === r);
  const pushLocked = () => !!G.level.pushLocked;

  // ================= BOARD GEOMETRY =================
  const board = $('#board'); const bctx = board.getContext('2d');
  let GEO = null;
  function resizeBoard() {
    const wrap = $('#board-wrap'); const W = wrap.clientWidth - 8;
    if (W <= 0) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const lab = 14, gap = 12, top = 22;
    // fit by width, but also by available height
    const availH = Math.max(160, window.innerHeight * 0.36);
    let cell = Math.floor((W - 2 * lab - gap) / 8);
    cell = Math.min(cell, Math.floor((availH - top - 6) / 4), 62);
    const used = 2 * lab + gap + 8 * cell; const ox = Math.floor((W - used) / 2);
    const H = top + 4 * cell + 6;
    board.style.height = H + 'px'; board.width = Math.round(W * dpr); board.height = Math.round(H * dpr);
    const sc = Math.max(1, Math.round(cell * dpr / 22 * 2) / 2); // integer device-px scale for crisp pixels
    GEO = { W, H, dpr, cell, lab, gap, top, ax: ox + lab, ex: ox + lab + 4 * cell + gap + lab, sc };
  }
  // long level names (e.g. "Không Thể Lay Chuyển") shrink to fit narrow phones instead of being cut with "…"
  function fitTitle() {
    const el = $('#g-name'); if (!el) return;
    el.style.fontSize = '';
    for (let fs = 16; fs > 11 && el.scrollWidth > el.clientWidth + 1; fs -= 0.5) el.style.fontSize = fs + 'px';
  }
  window.addEventListener('resize', () => { if (screen === 'game') { resizeBoard(); fitTitle(); } });
  function cellXY(side, c, r) { const x0 = side === 'ally' ? GEO.ax : GEO.ex; return { x: x0 + c * GEO.cell, y: GEO.top + r * GEO.cell }; }
  function cellCenter(side, c, r) { const p = cellXY(side, c, r); return { x: p.x + GEO.cell / 2, y: p.y + GEO.cell / 2 }; }
  function hitCell(x, y) {
    if (!GEO) return null;
    const r = Math.floor((y - GEO.top) / GEO.cell); if (r < 0 || r > 3) return null;
    let c = Math.floor((x - GEO.ax) / GEO.cell); if (c >= 0 && c < 4) return { side: 'ally', c, r };
    c = Math.floor((x - GEO.ex) / GEO.cell); if (c >= 0 && c < 4) return { side: 'enemy', c, r };
    return null;
  }

  // ================= ACTORS (display) =================
  let ENEMY_ACT = {}; // uid -> actor
  let FX = [], POP = [], SHAKE = 0;
  function buildActorsFromState(st) {
    ENEMY_ACT = {};
    for (const e of st.enemies) {
      ENEMY_ACT[e.uid] = { uid: e.uid, sprite: e.sprite, kind: e.kind, c: e.c, r: e.r, x: e.c, y: e.r, hp: e.hp, maxHp: e.maxHp, armor: e.armor, pushImmune: e.pushImmune,
        anim: idleOf(e.sprite), t0: now() - Math.random() * 600, loop: true, alpha: e.hp > 0 ? 1 : 0, dead: e.hp <= 0 };
    }
  }
  const HERO_ACT = {}; // heroId -> {anim,t0,loop}
  function heroActor(h) { if (!HERO_ACT[h]) HERO_ACT[h] = { anim: null, t0: now() - Math.random() * 500, loop: true }; return HERO_ACT[h]; }
  function setAnim(a, anim, loop) { a.anim = anim; a.t0 = now(); a.loop = !!loop; }

  // Solo preview: selected hero's action alone on the untouched board (no earlier actions applied)
  function soloStep() {
    const h = G.sel, p = G.placement[h], s = S.makeState(G.level), before = S.cloneState(s);
    const res = S.doAction(s, { id: h, c: p[0], r: p[1] }, { cat: G.actions[h].cat, dir: pushDir(h) }, G.level.rageBudget || 0);
    res.before = before; res.state = S.cloneState(s); return res;
  }
  const isSolo = () => G.solo && G.sel && G.mode === 'plan';
  function curStep() { if (isSolo()) return soloStep(); return G.pv < G.sim.steps.length ? G.sim.steps[G.pv] : null; }
  function previewState() {
    if (isSolo()) return S.makeState(G.level);
    const steps = G.sim.steps;
    if (G.pv < steps.length) return steps[G.pv].before;
    return G.sim.finalState;
  }

  // ================= BOARD RENDER =================
  function drawBoard() {
    if (!GEO) resizeBoard(); if (!GEO) return;
    const ctx = bctx, { dpr, cell } = GEO;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, GEO.W, GEO.H);
    let sx = 0, sy = 0;
    if (SHAKE > 0 && !SAVE.settings.reduce) { sx = (Math.random() - .5) * SHAKE; sy = (Math.random() - .5) * SHAKE; SHAKE *= 0.88; if (SHAKE < .3) SHAKE = 0; }
    ctx.translate(sx, sy);
    const plan = G.mode === 'plan';
    const st = plan ? previewState() : null;
    for (const side of ['ally', 'enemy']) {
      const x0 = side === 'ally' ? GEO.ax : GEO.ex;
      // frame
      ctx.fillStyle = side === 'ally' ? '#1d3346' : '#3d1d22';
      roundRect(ctx, x0 - 3, GEO.top - 3, cell * 4 + 6, cell * 4 + 6, 6); ctx.fill();
      ctx.strokeStyle = side === 'ally' ? '#6aa1d4' : '#d46a75'; ctx.lineWidth = 1.5; ctx.stroke();
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) drawCell(ctx, side, c, r, st);
    }
    // range hint for selected hero
    if (plan && G.sel && !G.drag) drawRange(ctx, st);
    // overlays under sprites
    let step = null;
    if (plan) step = curStep();
    if (step) drawStepUnder(ctx, step);
    // sprites sorted by row
    const items = [];
    for (const h of G.order) {
      const p = G.placement[h];
      if (G.drag && G.drag.moved && G.drag.hero === h) { items.push({ y: p[1] + 0.001, f: () => drawHero(ctx, h, p[0], p[1], 0.3) }); continue; }
      items.push({ y: p[1] + (heroActor(h).ox ? 0.01 : 0), f: () => drawHero(ctx, h, p[0], p[1], 1) });
    }
    if (plan) {
      for (const e of st.enemies) if (e.hp > 0) {
        const a = ENEMY_ACT[e.uid] || {}; items.push({ y: e.r, f: () => drawEnemy(ctx, Object.assign({}, a, e, { x: e.c, y: e.r, alpha: 1 }), step) });
      }
    } else {
      for (const a of Object.values(ENEMY_ACT)) if (a.alpha > 0.01) items.push({ y: a.y, f: () => drawEnemy(ctx, a, null) });
    }
    items.sort((a, b) => a.y - b.y).forEach(i => i.f());
    if (step) drawStepOver(ctx, step, st);
    if (plan && !isSolo() && G.pv >= G.sim.steps.length) drawFinalOver(ctx);
    drawAxisLabels(ctx);
    drawFx(ctx); drawPops(ctx);
    if (G.drag && G.drag.moved) {
      const h = G.drag.hero; const sk = skinOf(h);
      const sh = sheet(sk.sprite, idleOf(sk.sprite));
      spr(ctx, sh, frameAt(heroActor(h).t0, sh ? sh.frames : 1, true), G.drag.x, G.drag.y + cell * 0.35, GEO.sc * 1.15, false, 0.95, sk.filter, dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (G.tut && G.tut.cells && G.mode === 'plan') { // tutorial highlight
      const pulse = 0.5 + 0.5 * Math.sin(now() / 200);
      ctx.strokeStyle = `rgba(63,227,255,${0.5 + pulse * 0.5})`; ctx.lineWidth = 3; ctx.setLineDash([5, 4]);
      for (const t of G.tut.cells) { const p = cellXY(t[0], t[1], t[2]); ctx.strokeRect(p.x + 2, p.y + 2, cell - 4, cell - 4); }
      ctx.setLineDash([]);
    }
    if (G.mode === 'plan') drawHandGuide(ctx);
  }
  // Column letters / row numbers for both grids. Drawn after sprites & aim lines so nothing covers them,
  // and the font is set here every time (other drawing changes ctx.font).
  function drawAxisLabels(ctx) {
    const { cell } = GEO;
    ctx.setTransform(GEO.dpr, 0, 0, GEO.dpr, 0, 0);
    ctx.font = '800 11px ' + CFONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = '#0b1411';
    for (const side of ['ally', 'enemy']) {
      const x0 = side === 'ally' ? GEO.ax : GEO.ex;
      ctx.fillStyle = side === 'ally' ? '#cfe2ee' : '#f0d3cc';
      const put = (t, x, y) => { ctx.strokeText(t, x, y); ctx.fillText(t, x, y); };
      for (let c = 0; c < 4; c++) put(COLS[c], x0 + c * cell + cell / 2, (GEO.top - 3) / 2 + 0.5);
      for (let r = 0; r < 4; r++) put(String(r + 1), x0 - 3 - (GEO.lab - 3) / 2, GEO.top + r * cell + cell / 2 + 0.5);
    }
  }
  // Board label pill: measured width, game font, always kept inside the given side's 4x4 grid.
  function tag(ctx, text, cx, cy, o) {
    const size = o.size || 9, side = o.side || 'enemy';
    ctx.font = `800 ${size}px ${CFONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const isz = o.icon ? size + 1 : 0, w = Math.ceil(ctx.measureText(text).width) + 10 + (isz ? isz + 3 : 0), h = size + 6;
    const x0 = side === 'ally' ? GEO.ax : GEO.ex, x1 = x0 + 4 * GEO.cell, y0 = GEO.top, y1 = y0 + 4 * GEO.cell;
    const x = clamp(o.left ? cx : cx - w / 2, x0 + 2, x1 - 2 - w), y = clamp(cy - h / 2, y0 + 2, y1 - 2 - h);
    ctx.fillStyle = o.bg; roundRect(ctx, x, y, w, h, 5); ctx.fill();
    if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = 1; ctx.stroke(); }
    if (isz) IC.drawIcon(ctx, o.icon, x + 5 + isz / 2, y + h / 2, isz, o.fg, { lw: 2.6 });
    ctx.fillStyle = o.fg; ctx.fillText(text, x + (w + (isz ? isz + 3 : 0)) / 2, y + h / 2 + 0.5);
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function drawCell(ctx, side, c, r, st) {
    const { cell } = GEO; const p = cellXY(side, c, r);
    const wall = side === 'enemy' && (G.level.walls || []).some(w => w[0] === c && w[1] === r);
    const locked = side === 'ally' && isLocked(c, r);
    if (wall) {
      ctx.fillStyle = '#4a4f4d'; ctx.fillRect(p.x + 1, p.y + 1, cell - 2, cell - 2);
      ctx.strokeStyle = '#2a2d2c'; ctx.lineWidth = 1.5;
      const bh = (cell - 2) / 4;
      for (let i = 0; i < 4; i++) {
        const y = p.y + 1 + i * bh; ctx.beginPath(); ctx.moveTo(p.x + 1, y); ctx.lineTo(p.x + cell - 1, y); ctx.stroke();
        const off = i % 2 ? cell / 2 : cell / 4;
        for (let x = p.x + off; x < p.x + cell - 1; x += cell / 2) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + bh); ctx.stroke(); }
      }
      ctx.fillStyle = '#7d8582'; ctx.fillRect(p.x + 1, p.y + 1, cell - 2, 2);
      return;
    }
    const base = side === 'ally' ? '#a9c6d6' : '#d9b2aa';
    const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + cell);
    g.addColorStop(0, side === 'ally' ? '#c3dbe7' : '#ead0c9'); g.addColorStop(1, base);
    ctx.fillStyle = g; ctx.fillRect(p.x + 1, p.y + 1, cell - 2, cell - 2);
    ctx.strokeStyle = side === 'ally' ? '#7f9fb2' : '#b48a83'; ctx.lineWidth = 1; ctx.strokeRect(p.x + 1.5, p.y + 1.5, cell - 3, cell - 3);
    // corner ticks
    ctx.strokeStyle = '#00000030'; const k = cell * 0.18;
    [[p.x + 4, p.y + 4, 1, 1], [p.x + cell - 4, p.y + 4, -1, 1], [p.x + 4, p.y + cell - 4, 1, -1], [p.x + cell - 4, p.y + cell - 4, -1, -1]].forEach(([x, y, dx, dy]) => {
      ctx.beginPath(); ctx.moveTo(x + dx * k, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * k); ctx.stroke(); });
    if (locked) {
      ctx.fillStyle = '#1b2228cc'; ctx.fillRect(p.x + 1, p.y + 1, cell - 2, cell - 2);
      ctx.strokeStyle = '#5c6a75'; ctx.lineWidth = 2;
      ctx.save(); ctx.beginPath(); ctx.rect(p.x + 1, p.y + 1, cell - 2, cell - 2); ctx.clip();
      for (let i = -cell; i < cell; i += 7) { ctx.beginPath(); ctx.moveTo(p.x + i, p.y + cell); ctx.lineTo(p.x + i + cell, p.y); ctx.stroke(); }
      ctx.restore();
      IC.drawIcon(ctx, 'lock', p.x + cell / 2, p.y + cell / 2, Math.round(cell * 0.4), '#aeb9c2');
    }
    if (side === 'ally' && G.mode === 'plan') {
      const h = heroAt(c, r);
      if (h && h === G.sel) { ctx.strokeStyle = '#3fe3ff'; ctx.lineWidth = 2.5; ctx.strokeRect(p.x + 2, p.y + 2, cell - 4, cell - 4); ctx.fillStyle = '#3fe3ff22'; ctx.fillRect(p.x + 2, p.y + 2, cell - 4, cell - 4); }
      if (G.drag && G.drag.moved) { const hc = hitCell(G.drag.x, G.drag.y); if (hc && hc.side === 'ally' && hc.c === c && hc.r === r) { ctx.fillStyle = isLocked(c, r) ? '#e5484d55' : '#3fe3ff44'; ctx.fillRect(p.x + 1, p.y + 1, cell - 2, cell - 2); } }
    }
  }
  function drawRange(ctx, st) {
    const h = G.sel, p = G.placement[h]; const { cell } = GEO;
    // row guide: the hero hits along its whole row, whatever column it stands in
    const a = cellXY('ally', p[0], p[1]);
    ctx.fillStyle = '#3fe3ff14'; ctx.fillRect(a.x + cell, a.y + 2, GEO.ex + 4 * cell - a.x - cell, cell - 4);
  }
  function drawHero(ctx, h, c, r, alpha) {
    const sk = skinOf(h); const a = heroActor(h);
    const anim = a.anim || idleOf(sk.sprite);
    const sh = sheet(sk.sprite, anim);
    const c0 = cellCenter('ally', c, r);
    const ce = { x: c0.x + (a.ox || 0) * GEO.cell, y: c0.y + (a.oy || 0) * GEO.cell }; // ox/oy: melee dash offset (cell units)
    if (!sh) return;
    let fr = frameAt(a.t0, sh.frames, a.loop);
    if (!a.loop && fr >= sh.frames - 1 && now() - a.t0 > sh.frames * FRAME_MS + 80) { a.anim = null; a.loop = true; }
    // shadow
    ctx.setTransform(GEO.dpr, 0, 0, GEO.dpr, 0, 0);
    ctx.fillStyle = '#00000033'; ctx.beginPath(); ctx.ellipse(ce.x, ce.y + GEO.cell * 0.33, GEO.cell * 0.28, GEO.cell * 0.08, 0, 0, 7); ctx.fill();
    spr(ctx, sh, fr, ce.x, ce.y + GEO.cell * 0.36, GEO.sc, !!a.flip, alpha, sk.filter, GEO.dpr);
    ctx.setTransform(GEO.dpr, 0, 0, GEO.dpr, 0, 0);
    // order badge
    if (G.mode === 'plan' || G.mode === 'exec') {
      const i = G.order.indexOf(h); const p = cellXY('ally', c, r);
      ctx.fillStyle = '#f2c45a'; ctx.beginPath(); ctx.arc(p.x + 8, p.y + 8, 7, 0, 7); ctx.fill();
      ctx.fillStyle = '#2a1c06'; ctx.font = '800 10px ' + CFONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(i + 1, p.x + 8, p.y + 8.5);
      const cat = G.actions[h].cat; const col = cat === 'normal' ? '#5d8dbd' : cat === 'push' ? '#c9a33c' : '#c94a64';
      ctx.fillStyle = col; roundRect(ctx, p.x + GEO.cell - 15, p.y + 2, 13, 13, 3); ctx.fill(); ctx.strokeStyle = '#140f0a'; ctx.lineWidth = 1; ctx.stroke();
      IC.drawIcon(ctx, cat === 'normal' ? 'sword' : cat === 'push' ? 'arrow' : 'rage', p.x + GEO.cell - 8.5, p.y + 8.5, 11, '#fff8e6', { rot: cat === 'push' ? pushDir(h) * 45 : 0, lw: 2.6 });
    }
  }
  function drawEnemy(ctx, a, step) {
    const { cell, dpr } = GEO;
    const x0 = GEO.ex + a.x * cell + cell / 2, y0 = GEO.top + a.y * cell + cell / 2;
    const anim = a.anim || idleOf(a.sprite);
    const sh = sheet(a.sprite, anim) || sheet(a.sprite, idleOf(a.sprite));
    if (!sh) return;
    const fr = frameAt(a.t0 || 0, sh.frames, a.loop !== false);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#00000033'; ctx.beginPath(); ctx.ellipse(x0, y0 + cell * 0.33, cell * 0.28, cell * 0.08, 0, 0, 7); ctx.fill();
    const boss = a.kind === 'boss';
    spr(ctx, sh, fr, x0, y0 + cell * 0.36, boss ? Math.round(GEO.sc * 1.15 * 2) / 2 : GEO.sc, true, a.alpha, a.flash && now() < a.flash ? 'brightness(2.2)' : null, dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (a.alpha < 0.5) return;
    const p = { x: GEO.ex + a.x * cell, y: GEO.top + a.y * cell };
    // HP diamond (red) bottom-right
    const hx = p.x + cell - 9, hy = p.y + cell - 9;
    ctx.fillStyle = '#e5484d'; ctx.beginPath(); ctx.moveTo(hx, hy - 8); ctx.lineTo(hx + 8, hy); ctx.lineTo(hx, hy + 8); ctx.lineTo(hx - 8, hy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3a0c10'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '800 10px ' + CFONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(Math.max(0, a.hp), hx, hy + 0.5);
    // armor shield top-left
    if (a.armor) {
      const sx = p.x + 8, sy = p.y + 8;
      ctx.fillStyle = '#9aa7b0'; ctx.beginPath(); ctx.moveTo(sx - 6, sy - 6); ctx.lineTo(sx + 6, sy - 6); ctx.lineTo(sx + 6, sy); ctx.quadraticCurveTo(sx + 6, sy + 6, sx, sy + 8); ctx.quadraticCurveTo(sx - 6, sy + 6, sx - 6, sy); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2b3338'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.fillStyle = '#1b2228'; ctx.font = '800 8px ' + CFONT; ctx.fillText(a.armor, sx, sy);
    }
    // anchor (push immune) top-right
    if (a.pushImmune) {
      const ax = p.x + cell - 9, ay = p.y + 9;
      ctx.fillStyle = '#20262b'; ctx.beginPath(); ctx.arc(ax, ay, 7, 0, 7); ctx.fill();
      ctx.strokeStyle = '#f2c45a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(ax, ay - 4); ctx.lineTo(ax, ay + 4); ctx.moveTo(ax - 3, ay - 2); ctx.lineTo(ax + 3, ay - 2);
      ctx.moveTo(ax - 4, ay + 1); ctx.quadraticCurveTo(ax, ay + 7, ax + 4, ay + 1); ctx.stroke();
    }
    if (boss) { ctx.fillStyle = '#f2c45a'; const bx = p.x + cell / 2, by = p.y + 3; ctx.beginPath(); ctx.moveTo(bx - 7, by + 6); ctx.lineTo(bx - 7, by); ctx.lineTo(bx - 3, by + 3); ctx.lineTo(bx, by - 1); ctx.lineTo(bx + 3, by + 3); ctx.lineTo(bx + 7, by); ctx.lineTo(bx + 7, by + 6); ctx.closePath(); ctx.fill(); }
  }
  function arrow(ctx, x1, y1, x2, y2, color, w) {
    const ang = Math.atan2(y2 - y1, x2 - x1), hl = 7;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w || 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(ang) * hl * 0.6, y2 - Math.sin(ang) * hl * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - hl * Math.cos(ang - 0.45), y2 - hl * Math.sin(ang - 0.45)); ctx.lineTo(x2 - hl * Math.cos(ang + 0.45), y2 - hl * Math.sin(ang + 0.45)); ctx.closePath(); ctx.fill();
  }
  function hatch(ctx, x, y, s, color) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, s, s); ctx.clip(); ctx.strokeStyle = color; ctx.lineWidth = 1;
    for (let i = -s; i < s; i += 6) { ctx.beginPath(); ctx.moveTo(x + i, y + s); ctx.lineTo(x + i + s, y); ctx.stroke(); }
    ctx.restore();
  }
  function drawStepUnder(ctx, step) {
    const { cell } = GEO; const pos = G.placement[step.heroId];
    const hp = cellXY('ally', pos[0], pos[1]);
    ctx.strokeStyle = '#3fe3ff'; ctx.lineWidth = 2; ctx.strokeRect(hp.x + 2, hp.y + 2, cell - 4, cell - 4);
    if (step.ok && step.cells) {
      const pulse = 0.55 + 0.2 * Math.sin(now() / 260);
      for (const [c, r] of step.cells) {
        const p = cellXY('enemy', c, r);
        ctx.fillStyle = `rgba(242,196,90,${0.35 * pulse + 0.1})`; ctx.fillRect(p.x + 1, p.y + 1, cell - 2, cell - 2);
        hatch(ctx, p.x + 1, p.y + 1, cell - 2, '#f2c45a55');
        ctx.strokeStyle = '#f2c45a'; ctx.lineWidth = 2; ctx.strokeRect(p.x + 2, p.y + 2, cell - 4, cell - 4);
      }
    }
  }
  function drawStepOver(ctx, step, st) {
    const { cell } = GEO; const pos = G.placement[step.heroId];
    const from = cellCenter('ally', pos[0], pos[1]);
    ctx.font = '800 10px ' + CFONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (step.target) {
      const to = cellCenter('enemy', step.target.c, step.target.r);
      ctx.setLineDash([5, 4]); ctx.strokeStyle = step.ok ? '#3fe3ff' : '#e5484d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(from.x + cell * 0.3, from.y); ctx.lineTo(to.x - cell * 0.32, to.y); ctx.stroke(); ctx.setLineDash([]);
      // reticle
      ctx.strokeStyle = step.ok ? '#3fe3ff' : '#e5484d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(to.x, to.y, cell * 0.3, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(to.x - cell * .42, to.y); ctx.lineTo(to.x - cell * .18, to.y); ctx.moveTo(to.x + cell * .18, to.y); ctx.lineTo(to.x + cell * .42, to.y); ctx.stroke();
      // policy label
      // right edge of the hero's row; drop to the cell bottom when the hero itself stands in column D (keeps its badges clear)
      const lbl = D.POLICY_TXT[step.skill.policy].short;
      const ly = pos[0] === 3 ? from.y + cell * 0.5 - 10 : from.y - cell * 0.5 + 10;
      tag(ctx, lbl, GEO.ax + 4 * cell, ly, { side: 'ally', size: 10, fg: '#bff6ff', bg: '#0e1d22ee', border: '#3fe3ff' });
    }
    if (!step.ok) {
      const p = cellXY('enemy', 0, pos[1]);
      const txt = D.FAIL_TXT[step.reason];
      tag(ctx, txt, p.x + 3, p.y + 11, { left: true, size: 10, fg: '#ffb3ad', bg: '#2a0b0de6', border: '#e5484d', icon: 'cross' });
      return;
    }
    const dmgAt = {};
    for (const ev of step.events) {
      if (ev.t === 'move') {
        const a = cellCenter('enemy', ev.from[0], ev.from[1]), b = cellCenter('enemy', ev.to[0], ev.to[1]);
        const e = st.enemies.find(x => x.uid === ev.uid);
        const sh = sheet(e.sprite, idleOf(e.sprite));
        spr(ctx, sh, 0, b.x, b.y + cell * 0.36, GEO.sc, true, 0.42, null, GEO.dpr); ctx.setTransform(GEO.dpr, 0, 0, GEO.dpr, 0, 0);
        const q = cellXY('enemy', ev.to[0], ev.to[1]); ctx.setLineDash([4, 3]); ctx.strokeStyle = '#f2c45a'; ctx.lineWidth = 2; ctx.strokeRect(q.x + 3, q.y + 3, cell - 6, cell - 6); ctx.setLineDash([]);
        arrow(ctx, a.x, a.y, b.x, b.y, '#f2c45a', 3.5);
      } else if (ev.t === 'bump' || ev.t === 'collide') {
        const a = cellCenter('enemy', ev.c, ev.r);
        const b = { x: a.x + (ev.to[0] - ev.c) * cell * 0.48, y: a.y + (ev.to[1] - ev.r) * cell * 0.48 };
        arrow(ctx, a.x, a.y, b.x, b.y, '#9aa7b0', 3.5);
        tag(ctx, 'BỊ CHẶN', a.x, a.y - cell * 0.5 + 9, { fg: '#c9d3da', bg: '#0e1418ee', border: '#9aa7b0', icon: 'shield' });
      } else if (ev.t === 'immune') {
        const a = cellCenter('enemy', ev.c, ev.r);
        tag(ctx, 'MIỄN ĐẨY', a.x, a.y - cell * 0.5 + 9, { fg: '#f2c45a', bg: '#0e1418ee', border: '#f2c45a', icon: 'anchor' });
      } else if (ev.t === 'hit') {
        dmgAt[ev.uid] = (dmgAt[ev.uid] || 0) + ev.dmg;
        if (ev.dmg < ev.raw) { const a = cellCenter('enemy', ev.c, ev.r); const sx = a.x - cell * 0.3, sy = a.y - cell * 0.32; IC.drawIcon(ctx, 'shield', sx, sy, 12, '#9fb3c4', { acc: '#dfe8ef' }); ctx.font = '800 9px ' + CFONT; ctx.textAlign = 'left'; ctx.lineWidth = 2.5; ctx.strokeStyle = '#0b1411'; ctx.strokeText('-' + (ev.raw - ev.dmg), sx + 7, sy + 1); ctx.fillStyle = '#dfe8ef'; ctx.fillText('-' + (ev.raw - ev.dmg), sx + 7, sy + 1); ctx.textAlign = 'center'; }
      }
    }
    // damage numbers & death marks on positions after the step
    for (const e of step.state.enemies) {
      const d = dmgAt[e.uid]; if (d == null) continue;
      const before = step.before.enemies.find(x => x.uid === e.uid);
      if (!before || before.hp <= 0) continue;
      const c = cellCenter('enemy', e.c, e.r);
      const txt = '-' + d; ctx.font = '800 13px ' + CFONT;
      ctx.lineWidth = 3; ctx.strokeStyle = '#2a0608'; ctx.strokeText(txt, c.x + cell * 0.18, c.y - cell * 0.28); ctx.fillStyle = '#ff6a6a'; ctx.fillText(txt, c.x + cell * 0.18, c.y - cell * 0.28);
      if (e.hp <= 0) {
        ctx.fillStyle = '#000a'; ctx.beginPath(); ctx.arc(c.x - cell * 0.22, c.y - cell * 0.26, 9, 0, 7); ctx.fill();
        IC.drawIcon(ctx, 'skull', c.x - cell * 0.22, c.y - cell * 0.26, 14, '#efe6cf');
      }
    }
  }
  function drawFinalOver(ctx) {
    const { cell } = GEO;
    for (const e of G.sim.remaining) {
      const p = cellXY('enemy', e.c, e.r);
      ctx.strokeStyle = '#e5484d'; ctx.lineWidth = 2.5; ctx.setLineDash([4, 3]); ctx.strokeRect(p.x + 3, p.y + 3, cell - 6, cell - 6); ctx.setLineDash([]);
    }
    if (G.sim.outcome === 'win') {
      ctx.fillStyle = '#0d2a17dd'; const x = GEO.ex, y = GEO.top + cell * 1.6;
      roundRect(ctx, x + 6, y, cell * 4 - 12, cell * 0.8, 8); ctx.fill(); ctx.strokeStyle = '#6fd884'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#9ff2b0'; ctx.font = '800 12px ' + CFONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Sạch sân!', x + cell * 2 + 9, y + cell * 0.4); IC.drawIcon(ctx, 'check', x + cell * 2 - ctx.measureText('Sạch sân!').width / 2 - 3, y + cell * 0.4, 14, '#9ff2b0');
    }
  }
  // ---- effects ----
  function drawFx(ctx) {
    const t = now(), { cell, dpr } = GEO;
    FX = FX.filter(f => t < f.t0 + f.dur);
    for (const f of FX) {
      const k = clamp((t - f.t0) / f.dur, 0, 1);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (t < f.t0) continue;
      if (f.type === 'sprite') {
        const sh = fxSheet(f.fx); if (!sh) continue;
        const fr = Math.min(sh.frames - 1, Math.floor(k * sh.frames));
        const s = f.sc || GEO.sc, bx = sh.box || [40, 40, 60, 57];
        // centred fx: f.y is the body centre -> convert to the foot line spr() anchors on
        const fy = f.center ? f.y + (bx[3] - bx[1] + 1) / 2 * s / dpr : f.y;
        spr(ctx, sh, fr, f.x, fy, s, f.flip, 1, f.tint, dpr);
      } else if (f.type === 'proj') {
        const sh = fxSheet(f.fx); if (!sh) continue;
        const x = f.x1 + (f.x2 - f.x1) * k, y = f.y1 + (f.y2 - f.y1) * k - Math.sin(k * Math.PI) * (f.arc || 0);
        const fr = Math.floor((t - f.t0) / FRAME_MS) % sh.frames;
        spr(ctx, sh, fr, x, y + cell * 0.1, GEO.sc, f.flip, 1, f.tint, dpr);
      } else if (f.type === 'slash') {
        ctx.strokeStyle = f.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 4 * (1 - k) + 1;
        ctx.beginPath(); ctx.arc(f.x - cell * 0.2, f.y, cell * 0.45, -1.2 + k * 0.6, 1.2 + k * 0.6); ctx.stroke(); ctx.globalAlpha = 1;
      } else if (f.type === 'wave') {
        ctx.strokeStyle = f.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(f.x, f.y, cell * (0.2 + k * 0.6), 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
      } else if (f.type === 'beam') {
        const sh = fxSheet(f.fx); if (!sh) continue;
        const fr = Math.min(sh.frames - 1, Math.floor(k * sh.frames));
        const s = GEO.sc, bx = sh.box || [40, 40, 60, 57];
        for (let i = 0; i < f.cells.length; i++) {
          const c = f.cells[i];
          if (f.center) { // c = body centre: put the beam's right tip on it, line vertically centred
            const x = c.x - ((bx[2] + 1) - (bx[0] + bx[2] + 1) / 2) * s / dpr + cell * 0.12;
            spr(ctx, sh, fr, x, c.y + (bx[3] - bx[1] + 1) / 2 * s / dpr, s, false, 1, f.tint, dpr);
          } else spr(ctx, sh, fr, c.x, c.y + cell * 0.12, s, false, 1, f.tint, dpr);
        }
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function drawPops(ctx) {
    const t = now();
    POP = POP.filter(p => t < p.t0 + p.dur);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of POP) {
      if (t < p.t0) continue;
      const k = (t - p.t0) / p.dur;
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = `800 ${p.size || 15}px ${CFONT}`;
      const y = p.y - k * 18;
      let tx = p.x; if (p.icon) { const isz = (p.size || 15) + 2, tw = ctx.measureText(p.text).width; tx = p.x + isz / 2 + 1; IC.drawIcon(ctx, p.icon, tx - tw / 2 - isz / 2 - 2, y, isz, p.color); }
      ctx.lineWidth = 3.5; ctx.strokeStyle = '#1a0606'; ctx.strokeText(p.text, tx, y); ctx.fillStyle = p.color; ctx.fillText(p.text, tx, y);
    }
    ctx.globalAlpha = 1;
  }
  function pop(side, c, r, text, color, delay, size, icon) { const p = cellCenter(side, c, r); POP.push({ x: p.x, y: p.y - GEO.cell * 0.2, text, color, t0: now() + (delay || 0), dur: 900 / speedMul(), size, icon }); }

  // ================= PLANNING UI =================
  function renderPlanUI() {
    if (!G.level) return;
    const lv = G.level;
    // cards
    const cards = $('#cards'); cards.classList.toggle('compact', lv.heroes.length > 3);
    const cardKey = lv.id + ':' + G.order.join(',');
    if (!G.cardDrag && cards.dataset.key !== cardKey) { // cards follow action order (drag to reorder)
      cards.dataset.key = cardKey; cards.innerHTML = '';
      for (const h of G.order) {
        const b = document.createElement('button'); b.className = 'card'; b.dataset.hero = h;
        b.innerHTML = `<span class="ord"></span><span class="act"></span><canvas width="96" height="80"></canvas><span class="nm">${hname(h)}</span><span class="tg">${S.HEROES[h].tag} · ${IC.dirIcon(pushDir(h))}</span>`;
        cards.appendChild(b);
      }
    }
    for (const b of cards.children) {
      const h = b.dataset.hero; b.classList.toggle('sel', h === G.sel);
      b.querySelector('.ord').textContent = G.order.indexOf(h) + 1;
      const cat = G.actions[h].cat; const act = b.querySelector('.act');
      act.innerHTML = ic(CAT_IC[cat]) + (cat === 'push' ? 'Đẩy ' + IC.dirIcon(pushDir(h)) : cat === 'rage' ? 'Nộ' : 'Thường');
      act.className = 'act cat-' + cat;
    }
    // order chips
    const ord = $('#order'); ord.classList.toggle('many', lv.heroes.length > 3);
    if (!G.chipDrag) {
      ord.innerHTML = '';
      G.order.forEach((h, i) => {
        const st = G.sim.steps[i]; const fail = st && st.ok === false;
        const el = document.createElement('div'); el.className = 'chip' + (h === G.sel ? ' sel' : '') + (fail ? ' fail' : ''); el.dataset.hero = h;
        el.innerHTML = `<b>${i + 1}</b><span>${hname(h)}</span>`;
        ord.appendChild(el);
      });
    }
    // skills
    const h = G.sel; const hd = S.HEROES[h];
    $('#skill-h').textContent = 'KỸ NĂNG ' + hd.name.toUpperCase();
    for (const b of $$('#skills .skill')) {
      const cat = b.dataset.cat; b.classList.toggle('on', G.actions[h].cat === cat);
      let lock = false, why = '';
      if (cat === 'push' && pushLocked()) { lock = true; why = 'Mở ở màn ' + ((LEVELS.find(l => !l.pushLocked) || {}).id || ''); }
      if (cat === 'rage' && !lv.rageBudget) { lock = true; why = 'Màn này không cấp nộ'; }
      b.disabled = lock; b.title = why;
      let l = b.querySelector('.lock'); if (lock && !l) { l = document.createElement('span'); l.className = 'lock'; l.innerHTML = ic('lock'); b.appendChild(l); } if (!lock && l) l.remove();
      b.querySelector('span').textContent = D.CAT_TXT[cat];    }
    const sk = S.SKILLS[hd.skills[G.actions[h].cat]];
    const pol = D.POLICY_TXT[sk.policy];
    const pos = G.placement[h];
    $('#skill-info').innerHTML = `${miniAoe(sk)}<div class="txt"><b>${sk.name}</b> · <span class="pol" title="${esc(pol.tip)}">${pol.short}</span><br>
      ${sk.cat === 'push' ? `Đẩy 1 ô hướng ${S.DIRS[sk.dir].name} ${IC.dirIcon(sk.dir)}` + (sk.damage ? ` + ${sk.damage} sát thương` : '') : `Sát thương ${sk.damage} · ${D.AOE_TXT[sk.aoe]}`}${sk.ignoresArmor ? ' · <b>bỏ qua giáp</b>' : ''}<br>
      <small style="color:var(--mut)">${pol.tip} Đứng cột nào trong hàng cũng đánh tới.</small></div>`;
    // push panel
    const pp = $('#push-panel');
    pp.classList.toggle('hidden', G.actions[h].cat !== 'push');
    if (G.actions[h].cat === 'push') renderDirpad();
    // preview steps
    const pvs = $('#pv-steps'); pvs.innerHTML = '';
    G.order.forEach((hh, i) => {
      const st = G.sim.steps[i];
      const b = document.createElement('button'); b.textContent = (i + 1) + '. ' + hname(hh);
      if (st && !st.ok) b.className = 'bad'; if (!st) { b.className = 'win'; b.textContent = (i + 1) + ' —'; }
      if (G.pv === i && !G.solo) b.classList.add('on');
      b.onclick = () => { G.pv = i; G.sel = hh; G.solo = false; AUDIO.play('tap'); renderPlanUI(); };
      pvs.appendChild(b);
    });
    const fb = document.createElement('button'); fb.textContent = 'Kết quả';
    fb.className = G.sim.outcome === 'win' && SAVE.settings.finalPreview ? 'win' : '';
    if (G.pv >= G.order.length && !G.solo) fb.classList.add('on');
    fb.onclick = () => { G.pv = G.order.length; G.solo = false; AUDIO.play('tap'); renderPlanUI(); };
    pvs.appendChild(fb);
    $('#pv-log').innerHTML = pvText();
    $('#pv-note').textContent = isSolo() ? 'đang xem riêng ' + S.HEROES[G.sel].name + ' · bấm số để xem theo thứ tự' : 'theo thứ tự, không đổi bàn thật';
    // footer
    const rageSel = G.order.filter(x => G.actions[x].cat === 'rage').length;
    $('#f-rage').innerHTML = ic('rage') + `Nộ ${rageSel}/${lv.rageBudget}` + (lv.rageBudget ? ` (chuẩn ${lv.parRageUsed})` : '');
    $('#f-rage').style.color = rageSel > lv.rageBudget ? '#ff6a6a' : '';
    const helper = $('#helper');
    if (rageSel > lv.rageBudget) { helper.textContent = 'Vượt ngân sách nộ — hành động nộ thừa sẽ thất bại'; helper.classList.add('warn'); }
    else { helper.textContent = 'Kéo thả hoặc chạm nhân vật rồi chạm ô để đổi vị trí'; helper.classList.remove('warn'); }
    $('[data-act=attack]').classList.toggle('pulse', SAVE.settings.finalPreview && G.sim.outcome === 'win');
  }
  function pvText() {
    if (!isSolo() && (G.pv >= G.order.length || G.pv >= G.sim.steps.length)) {
      const r = G.sim.remaining.length;
      if (!SAVE.settings.finalPreview && G.pv >= G.order.length) {
        return r === 0 ? '<span class="good">Bàn sau lượt: không còn quái.</span>' : `Bàn sau lượt: còn <span class="bad">${r} quái</span> (viền đỏ).`;
      }
      return r === 0 ? '<span class="good">' + ic('check') + ' Kế hoạch này hạ toàn bộ quái.</span>' : `<span class="bad">Còn ${r} quái sống.</span>`;
    }
    const st = curStep(); const hn = S.HEROES[st.heroId].name;
    if (!st.ok) return `<span class="k">${hn}</span> · ${st.skill.name}: <span class="bad">${D.FAIL_TXT[st.reason]}</span> — hành động vẫn bị tiêu tốn.`;
    const parts = [];
    for (const e of st.events) {
      const en = st.before.enemies.find(x => x.uid === e.uid);
      if (e.t === 'move') parts.push(`đẩy ${cellName(e.from[0], e.from[1])}→${cellName(e.to[0], e.to[1])}`);
      if (e.t === 'bump') parts.push(`bị ${e.why === 'edge' ? 'biên' : 'tường'} chặn, đứng yên`);
      if (e.t === 'collide') parts.push(`bị quái ở ${cellName(e.to[0], e.to[1])} chặn, đứng yên`);
      if (e.t === 'immune') parts.push('miễn đẩy');
      if (e.t === 'hit') parts.push(`${cellName(e.c, e.r)} −${e.dmg}`);
      if (e.t === 'die') parts.push(`<span class="good">hạ ${cellName(e.c, e.r)}</span>`);
    }
    return `<span class="k">${hn}</span> · ${st.skill.name} → mục tiêu <span class="k">${cellName(st.target.c, st.target.r)}</span>: ${parts.join(', ') || 'không gây hiệu ứng'}`;
  }
  function rangeTxt(sk, pos) {
    const maxC = Math.min(3, sk.range - (3 - pos[0]) - 1);
    return `Từ ${cellName(pos[0], pos[1])}: ` + (maxC < 0 ? '<b style="color:#ff9a8e">không với tới cột nào</b>' : maxC >= 3 ? 'với tới mọi cột A–D.' : `với tới cột A–${COLS[maxC]}.`);
  }
  function miniAoe(sk) {
    // 3x3 mini, target always in the centre. Push: arrow on the cell the target gets pushed into.
    const isPush = sk.cat === 'push';
    const offs = isPush ? [] : (S.AOE[sk.aoe] || [[0, 0]]);
    const set = new Set(offs.map(([dc, dr]) => dc + ',' + dr));
    const cont = !isPush && offs.some(([dc, dr]) => Math.abs(dc) > 1 || Math.abs(dr) > 1); // AoE runs past the mini (pierce)
    const pd = isPush ? S.DIRS[sk.dir] : null;
    let h = '<div class="mini">';
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dc && !dr) { h += '<i class="c"></i>'; continue; }
      if (pd && pd.dc === dc && pd.dr === dr) { h += `<i class="p">${IC.dirIcon(S.DIRS.indexOf(pd))}</i>`; continue; }
      const on = set.has(dc + ',' + dr);
      h += `<i class="${on ? 'a' : ''}">${on && cont && dc === 1 && !dr ? ic('chev') : ''}</i>`;
    }
    return h + '</div>';
  }
  function renderDirpad() {
    const h = G.sel; const pad = $('#dirpad');
    const order = [7, 0, 1, 6, -1, 2, 5, 4, 3];
    if (!pad.children.length) {
      order.forEach(d => {
        if (d < 0) { const c = document.createElement('div'); c.className = 'ctr'; c.innerHTML = '<canvas width="72" height="72"></canvas>'; pad.appendChild(c); return; }
        const b = document.createElement('button'); b.dataset.dir = d; b.innerHTML = IC.dirIcon(d); b.title = S.DIRS[d].name; b.setAttribute('aria-label', S.DIRS[d].name);
        pad.appendChild(b);
      });
    }
    for (const b of pad.querySelectorAll('button')) {
      const d = +b.dataset.dir; b.classList.toggle('on', pushDir(h) === d);
      b.disabled = pushDir(h) !== d; b.tabIndex = -1;
    }
    const idx = G.order.indexOf(h); const st = isSolo() ? soloStep() : G.sim.steps[idx];
    const d = S.DIRS[pushDir(h)];
    let txt = `<div>Hướng đẩy cố định của ${S.HEROES[h].name}: <span class="k">${d.name} ${IC.dirIcon(pushDir(h))}</span></div>`;
    if (st && st.ok) {
      const mv = st.events.find(e => e.t === 'move' || e.t === 'bump' || e.t === 'collide' || e.t === 'immune');
      txt += `<div>Mục tiêu ở bước này: <span class="k">${cellName(st.target.c, st.target.r)}</span>${mv ? (mv.t === 'move' ? ` → ${cellName(mv.to[0], mv.to[1])}` : mv.t === 'immune' ? ' (miễn đẩy)' : ' (bị chặn, đứng yên)') : ''}</div>`;
    } else if (st) txt += `<div style="color:#ff9a8e">${D.FAIL_TXT[st.reason]}</div>`;
    txt += '<div style="color:var(--mut)">Đẩy trước rồi gây sát thương. Bị biên, tường hoặc quái khác chặn thì đứng yên, va chạm không gây thêm sát thương.</div>';
    $('#push-txt').innerHTML = txt;
    pad.dataset.target = st && st.target ? st.target.uid : '';
  }
  function selectHero(h) {
    if (G.mode !== 'plan') return;
    G.sel = h; G.pv = G.order.indexOf(h); G.solo = true; AUDIO.play('select'); renderPlanUI(); tutCheck();
  }
  $('#skills').addEventListener('click', e => {
    const b = e.target.closest('.skill'); if (!b || b.disabled || G.mode !== 'plan') return;
    commit(() => { G.actions[G.sel].cat = b.dataset.cat; }, 'skill');
  });

  // hero card drag = reorder action order (pointer events, works on touch); tap = select
  $('#cards').addEventListener('pointerdown', e => {
    const card = e.target.closest('.card'); if (!card || G.mode !== 'plan') return;
    const cs = Array.from($('#cards').children);
    G.cardDrag = { hero: card.dataset.hero, el: card, x0: e.clientX, moved: false, rects: cs.map(c => c.getBoundingClientRect()), from: cs.indexOf(card), to: cs.indexOf(card) };
    card.setPointerCapture(e.pointerId);
  });
  $('#cards').addEventListener('pointermove', e => {
    const d = G.cardDrag; if (!d) return;
    const dx = e.clientX - d.x0; if (Math.abs(dx) > 8) d.moved = true;
    if (!d.moved) return;
    d.el.classList.add('dragging'); d.el.style.transform = `translateX(${dx}px)`;
    const cx = d.rects[d.from].left + d.rects[d.from].width / 2 + dx;
    let to = d.rects.findIndex(r => cx < r.right); if (to < 0) to = d.rects.length - 1;
    d.to = to;
    Array.from($('#cards').children).forEach((c, i) => {
      if (c === d.el) return; let shift = 0; const w = d.rects[d.from].width + 6;
      if (d.from < to && i > d.from && i <= to) shift = -w; if (d.from > to && i >= to && i < d.from) shift = w;
      c.style.transform = shift ? `translateX(${shift}px)` : '';
    });
  });
  function endCard() {
    const d = G.cardDrag; if (!d) return; G.cardDrag = null;
    for (const c of $('#cards').children) { c.style.transform = ''; c.classList.remove('dragging'); }
    if (!d.moved) { selectHero(d.hero); return; }
    if (d.to !== d.from) commit(() => { const o = G.order.slice(); o.splice(d.from, 1); o.splice(d.to, 0, d.hero); G.order = o; }, 'order');
    else renderPlanUI();
  }
  $('#cards').addEventListener('pointerup', endCard);
  $('#cards').addEventListener('pointercancel', endCard);

  // order chip drag (pointer events, works on touch)
  $('#order').addEventListener('pointerdown', e => {
    const chip = e.target.closest('.chip'); if (!chip || G.mode !== 'plan') return;
    const chips = Array.from($('#order').children);
    G.chipDrag = { hero: chip.dataset.hero, el: chip, x0: e.clientX, moved: false, rects: chips.map(c => c.getBoundingClientRect()), from: chips.indexOf(chip), to: chips.indexOf(chip) };
    chip.setPointerCapture(e.pointerId);
  });
  $('#order').addEventListener('pointermove', e => {
    const d = G.chipDrag; if (!d) return;
    const dx = e.clientX - d.x0; if (Math.abs(dx) > 6) d.moved = true;
    if (!d.moved) return;
    d.el.classList.add('dragging'); d.el.style.transform = `translateX(${dx}px)`;
    const cx = d.rects[d.from].left + d.rects[d.from].width / 2 + dx;
    let to = d.rects.findIndex(r => cx < r.right); if (to < 0) to = d.rects.length - 1;
    d.to = to;
    Array.from($('#order').children).forEach((c, i) => {
      if (c === d.el) return; let shift = 0; const w = d.rects[d.from].width + 6;
      if (d.from < to && i > d.from && i <= to) shift = -w; if (d.from > to && i >= to && i < d.from) shift = w;
      c.style.transform = shift ? `translateX(${shift}px)` : '';
    });
  });
  function endChip() {
    const d = G.chipDrag; if (!d) return; G.chipDrag = null;
    if (!d.moved) { selectHero(d.hero); renderPlanUI(); return; }
    if (d.to !== d.from) commit(() => { const o = G.order.slice(); o.splice(d.from, 1); o.splice(d.to, 0, d.hero); G.order = o; }, 'order');
    else renderPlanUI();
  }
  $('#order').addEventListener('pointerup', endChip);
  $('#order').addEventListener('pointercancel', endChip);

  // board input
  let pressTimer = null;
  function boardPt(e) { const r = board.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  board.addEventListener('pointerdown', e => {
    AUDIO.ensure();
    const p = boardPt(e); const hc = hitCell(p.x, p.y); hideTip();
    if (!hc) return;
    board.setPointerCapture(e.pointerId);
    if (hc.side === 'enemy') {
      G.ptr = { enemy: hc, x: p.x, y: p.y };
      return;
    }
    if (G.mode !== 'plan') return;
    const h = heroAt(hc.c, hc.r);
    if (h) G.drag = { hero: h, x0: p.x, y0: p.y, x: p.x, y: p.y, moved: false };
    else G.ptr = { ally: hc };
    clearTimeout(pressTimer);
    if (h) pressTimer = setTimeout(() => { if (G.drag && !G.drag.moved) showHeroTip(h, p); }, 550);
  });
  board.addEventListener('pointermove', e => {
    const p = boardPt(e);
    if (G.drag) { G.drag.x = p.x; G.drag.y = p.y; if (Math.hypot(p.x - G.drag.x0, p.y - G.drag.y0) > 6) { G.drag.moved = true; clearTimeout(pressTimer); hideTip(); } }
  });
  board.addEventListener('pointerup', e => {
    clearTimeout(pressTimer);
    const p = boardPt(e); const hc = hitCell(p.x, p.y);
    if (G.drag) {
      const d = G.drag; G.drag = null;
      if (!d.moved) { selectHero(d.hero); return; }
      if (hc && hc.side === 'ally') placeHero(d.hero, hc.c, hc.r);
      return;
    }
    if (G.ptr && G.ptr.enemy) { if (hc && hc.side === 'enemy' && hc.c === G.ptr.enemy.c && hc.r === G.ptr.enemy.r) showEnemyTip(hc, p); G.ptr = null; return; }
    if (G.ptr && G.ptr.ally && hc && hc.side === 'ally' && G.mode === 'plan' && G.sel) placeHero(G.sel, hc.c, hc.r);
    G.ptr = null;
  });
  board.addEventListener('pointercancel', () => { G.drag = null; G.ptr = null; clearTimeout(pressTimer); });
  function placeHero(h, c, r) {
    if (isLocked(c, r)) { toast('Ô này bị khóa — không thể đặt nhân vật'); AUDIO.play('fail'); return; }
    const other = heroAt(c, r); const from = G.placement[h];
    if (other === h) return;
    commit(() => {
      G.placement[h] = [c, r]; if (other) G.placement[other] = from.slice();
      G.sel = h;
    }, other ? 'swap' : 'swap');
    vibrate(10);
  }
  function showTip(html, x, y) {
    const t = $('#tip'); t.innerHTML = html; t.classList.remove('hidden');
    const w = $('#board-wrap').clientWidth; const tw = Math.min(230, w - 16);
    t.style.left = clamp(x - tw / 2, 6, w - tw - 6) + 'px'; t.style.top = (y + 18) + 'px';
    clearTimeout(showTip.h); showTip.h = setTimeout(hideTip, 3500);
  }
  function hideTip() { $('#tip').classList.add('hidden'); }
  function showEnemyTip(hc, p) {
    const wall = (G.level.walls || []).some(w => w[0] === hc.c && w[1] === hc.r);
    if (wall) { showTip('<b>Tường</b><br>Chặn đường ngắm và tia xuyên. Không thể đẩy quái vào; quái bị đẩy vào tường sẽ đứng yên.', p.x, p.y); return; }
    let e;
    if (G.mode === 'plan') e = previewState().enemies.find(x => x.hp > 0 && x.c === hc.c && x.r === hc.r);
    else { const a = Object.values(ENEMY_ACT).find(x => !x.dead && Math.round(x.x) === hc.c && Math.round(x.y) === hc.r); e = a; }
    if (!e) { showTip(`Ô <b>${cellName(hc.c, hc.r)}</b> trống. Ô trống không được tính khi nhắm mục tiêu.`, p.x, p.y); return; }
    const ki = D.KIND_INFO[e.kind];
    showTip(`<b>${ki.name}</b> · ${cellName(e.c != null ? e.c : hc.c, e.r != null ? e.r : hc.r)}<br>HP ${e.hp}/${e.maxHp}${e.armor ? ' · Giáp ' + e.armor : ''}${e.armor ? ' ' + ic('shield') : ''}${e.pushImmune ? ' · Miễn đẩy ' + ic('anchor') : ''}<br><span style="color:var(--mut)">${ki.desc}</span><br><small>Chạm xem thông tin không đổi mục tiêu — mục tiêu do luật quyết định.</small>`, p.x, p.y);
    AUDIO.play('tap');
  }
  function showHeroTip(h, p) {
    const hd = S.HEROES[h]; const lines = ['normal', 'push', 'rage'].map(c => { const s = S.SKILLS[hd.skills[c]]; return `• ${D.CAT_TXT[c]}: <b>${s.name}</b> (${D.POLICY_TXT[s.policy].short})`; });
    showTip(`<b>${hd.name}</b><br>${lines.join('<br>')}`, p.x, p.y);
  }

  // ================= EXECUTION =================
  let EX = null;
  const speedMul = () => (EX && EX.speed) || SAVE.settings.speed || 1;
  function setExecUI(on) {
    $('#plan-ui').classList.toggle('hidden', on); $('#exec-ui').classList.toggle('hidden', !on);
    $('#foot-plan').classList.toggle('hidden', on); $('#foot-exec').classList.toggle('hidden', !on);
  }
  function wait(ms) {
    return new Promise(res => {
      let left = ms; let last = now();
      function tick() {
        if (!EX || EX.skip) return res();
        const t = now(); if (!EX.paused) left -= (t - last) * EX.speed; last = t;
        if (left <= 0) res(); else nextFrame(tick);
      }
      tick();
    });
  }
  function logExec(html, cur) {
    const box = $('#exec-log'); box.querySelectorAll('.cur').forEach(x => x.classList.remove('cur'));
    const d = document.createElement('div'); d.innerHTML = html; if (cur) d.className = 'cur'; box.appendChild(d); box.scrollTop = box.scrollHeight;
    $('#g-scroll').scrollTop = 1e6;
  }
  async function execute(replay) {
    if (G.mode === 'exec') return;
    closeModal(); hideTip();
    G.mode = 'exec'; G.pv = 0;
    const sim = S.simulate(G.level, G.placement, planOf()); // same rules as preview
    EX = { speed: SAVE.settings.speed || 1, paused: false, skip: false, sim };
    $('#b-exec-speed').innerHTML = ic('bolt') + '×' + EX.speed; $('#b-exec-pause').innerHTML = ic('pause') + 'Dừng';
    setExecUI(true); $('#exec-log').innerHTML = '';
    buildActorsFromState(S.makeState(G.level));
    tutCheck(); $('#tut').classList.add('hidden');
    AUDIO.play('select');
    await wait(250);
    for (const step of sim.steps) {
      if (!EX) return;
      if (EX.skip) break;
      await animateStep(step);
      await wait(260);
    }
    if (!EX) return;
    resetHeroOffsets();
    // sync to final state (also after skip — logic never skipped)
    for (const e of sim.finalState.enemies) {
      const a = ENEMY_ACT[e.uid]; a.x = a.c = e.c; a.y = a.r = e.r; a.hp = e.hp;
      if (e.hp <= 0 && !a.dead) { a.dead = true; a.alpha = 0; }
    }
    await wait(300);
    finishExec(sim, replay);
  }
  function resetHeroOffsets() { for (const a of Object.values(HERO_ACT)) { a.ox = 0; a.oy = 0; a.flip = false; } }
  // tween a hero's dash offset (cell units) with an optional hop; respects exec speed / skip
  function dashHero(ha, tx, dur, hop) {
    const x0 = ha.ox || 0, t0 = now();
    return new Promise(res => {
      (function tw() {
        if (!EX) { ha.ox = 0; ha.oy = 0; return res(); }
        const k = EX.skip ? 1 : clamp((now() - t0) * EX.speed / dur, 0, 1);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        ha.ox = x0 + (tx - x0) * e; ha.oy = hop ? -Math.sin(Math.PI * k) * hop : 0;
        if (k >= 1) { ha.oy = 0; res(); } else nextFrame(tw);
      })();
    });
  }
  async function animateStep(step) {
    const h = step.heroId, hd = S.HEROES[h], sk = step.skill, sp = skinOf(h).sprite;
    const pos = G.placement[h];
    logExec(`<b>${G.order.indexOf(h) + 1}. ${hd.name}</b> — ${sk.name}${sk.cat === 'push' ? ' ' + IC.dirIcon(sk.dir) : ''}` + (step.ok ? ` → ${cellName(step.target.c, step.target.r)}` : ` · <span style="color:#ff9a8e">${D.FAIL_TXT[step.reason]}</span>`), true);
    const anim = D.heroAnim(sp, step.act.cat); const ha = heroActor(h);
    const melee = D.MELEE[h] && step.ok;
    if (melee) { // run up to the target (hop over the skipped monster for SKIP heroes)
      const from = cellCenter('ally', pos[0], pos[1]).x, to = cellCenter('enemy', step.target.c, step.target.r).x - GEO.cell * 0.62;
      const dist = (to - from) / GEO.cell;
      const skipped = sk.policy === 'SKIP' && step.before.enemies.some(e => e.hp > 0 && e.r === step.target.r && e.c < step.target.c);
      ha.flip = false; setAnim(ha, D.walkOf(sp), true); AUDIO.play('select');
      await dashHero(ha, dist, 140 + dist * 55, skipped ? 0.45 : 0.08);
    }
    setAnim(ha, anim, false);
    if (sk.cat === 'rage') { AUDIO.play('rage'); SHAKE = 4; pop('ally', pos[0], pos[1], 'NỘ!', '#ff8fb0', 0, 14); vibrate(30); }
    const aFrames = (D.META.chars[sp].anims[anim] || { frames: 6 }).frames;
    await wait(Math.min(aFrames * FRAME_MS * 0.55, 420));
    if (!step.ok) {
      AUDIO.play('fail');
      const fm = $('#float-msg'); fm.textContent = D.FAIL_TXT[step.reason]; fm.classList.remove('hidden');
      await wait(700); fm.classList.add('hidden'); return;
    }
    await playSkillFx(step, pos, melee);
    // events
    const evs = step.events;
    for (const ev of evs) {
      const a = ENEMY_ACT[ev.uid];
      if (ev.t === 'move') {
        AUDIO.play('push'); setAnim(a, D.META.chars[a.sprite].anims.Walk ? 'Walk' : idleOf(a.sprite), true);
        const x0 = a.x, y0 = a.y, t0 = now(), dur = 260;
        await new Promise(res => { (function tw() { if (!EX) return res(); const k = EX.skip ? 1 : clamp((now() - t0) * EX.speed / dur, 0, 1); const e = 1 - Math.pow(1 - k, 3); a.x = x0 + (ev.to[0] - x0) * e; a.y = y0 + (ev.to[1] - y0) * e; if (k >= 1) res(); else nextFrame(tw); })(); });
        a.c = ev.to[0]; a.r = ev.to[1]; setAnim(a, idleOf(a.sprite), true);
      } else if (ev.t === 'bump' || ev.t === 'collide') {
        AUDIO.play('collide'); SHAKE = 3; vibrate(15);
        const dx = (ev.to[0] - ev.c) * 0.25, dy = (ev.to[1] - ev.r) * 0.25;
        a.x += dx; a.y += dy; await wait(90); a.x -= dx; a.y -= dy;
        const p = cellCenter('enemy', ev.c, ev.r);
        FX.push({ type: 'sprite', fx: D.BUMP_FX, x: p.x + dx * GEO.cell * 2, y: p.y + GEO.cell * 0.36, t0: now(), dur: 420 / EX.speed });
        pop('enemy', ev.c, ev.r, 'Bị chặn', '#c9d3da', 0, 12, 'shield');
        await wait(300);
      } else if (ev.t === 'immune') {
        pop('enemy', ev.c, ev.r, 'Miễn đẩy', '#f2c45a', 0, 12, 'anchor'); await wait(400);
      } else if (ev.t === 'hit') {
        hurt(a, ev.dmg, ev.raw);
      } else if (ev.t === 'die') {
        await wait(120); AUDIO.play('die');
        const da = D.META.chars[a.sprite].anims.Death || D.META.chars[a.sprite].anims.DEATH ? (D.META.chars[a.sprite].anims.Death ? 'Death' : 'DEATH') : null;
        if (da) setAnim(a, da, false);
        a.dead = true;
        const frames = da ? D.META.chars[a.sprite].anims[da].frames : 4;
        fadeOut(a, frames * FRAME_MS + 150);
      }
    }
    if (evs.some(e => e.t === 'hit')) { AUDIO.play('hit'); await wait(360); }
    if (evs.some(e => e.t === 'die')) await wait(380);
    if (melee) { // run back to the original cell
      ha.flip = true; setAnim(ha, D.walkOf(sp), true);
      await dashHero(ha, 0, 140 + (ha.ox || 0) * 55, 0.08);
      ha.flip = false; setAnim(ha, idleOf(sp), true);
    }
  }
  function hurt(a, dmg, raw) {
    if (!a) return;
    a.hp -= dmg; a.flash = now() + 120;
    if (!a.dead) setAnim(a, 'Hurt', false);
    setTimeout(() => { if (!a.dead && a.anim === 'Hurt') setAnim(a, idleOf(a.sprite), true); }, 420);
    pop('enemy', Math.round(a.x), Math.round(a.y), dmg > 0 ? '-' + dmg : '0', dmg > 0 ? '#ff6a6a' : '#c9d3da', 0, 0, dmg > 0 ? null : raw ? 'shield' : null);
  }
  function fadeOut(a, delay) {
    const t0 = now() + delay / speedMul();
    (function f() { const k = (now() - t0) / 300; if (k < 0) return nextFrame(f); a.alpha = clamp(1 - k, 0, 1); if (k < 1) nextFrame(f); })();
  }
  async function playSkillFx(step, pos, melee) {
    let fx = D.SKILL_FX[step.skill.id] || { kind: 'slash', color: '#fff' };
    if (melee && fx.kind === 'proj') fx = { kind: 'slash', color: '#d8b4ff' }; // already in contact: strike, don't shoot
    const from = cellCenter('ally', pos[0], pos[1]);
    const t = cellCenter('enemy', step.target.c, step.target.r);
    const cells = (step.cells || []).map(([c, r]) => cellCenter('enemy', c, r));
    // oversized sprites (e.g. the 2.5-cell fire pillar) are drawn smaller so they fit one cell
    const FX_SCALE = { 'Black Knight_C_Beam': 0.5 };
    const fxSc = n => FX_SCALE[n] ? Math.max(1, Math.round(GEO.sc * FX_SCALE[n] * 2) / 2) : undefined;
    // body centre of the enemy standing on a cell (same anchoring as drawEnemy), for centred bursts
    const bodyAt = p => {
      const c = Math.floor((p.x - GEO.ex) / GEO.cell), r = Math.floor((p.y - GEO.top) / GEO.cell);
      const a = Object.values(ENEMY_ACT).find(e => !e.dead && Math.round(e.x) === c && Math.round(e.y) === r);
      const box = (a && D.META.chars[a.sprite].box) || [40, 40, 60, 57];
      const s = a && a.kind === 'boss' ? Math.round(GEO.sc * 1.15 * 2) / 2 : GEO.sc;
      return { x: p.x, y: p.y + GEO.cell * 0.36 - (box[3] - box[1] + 1) / 2 * s / GEO.dpr };
    };
    const sp = speedMul();
    if (fx.kind === 'proj') {
      AUDIO.play('shoot');
      const dur = 260 / sp;
      FX.push({ type: 'proj', fx: fx.fx, x1: from.x, y1: from.y, x2: t.x, y2: t.y, t0: now(), dur, arc: 6, tint: fx.tint });
      await wait(260);
    } else if (fx.kind === 'rain') {
      AUDIO.play('shoot');
      cells.forEach((c, i) => FX.push({ type: 'proj', fx: i % 2 ? fx.fx2 : fx.fx, x1: c.x - GEO.cell * 0.6, y1: c.y - GEO.cell * 1.4, x2: c.x, y2: c.y, t0: now() + i * 40 / sp, dur: 280 / sp }));
      await wait(320 + cells.length * 30);
    } else if (fx.kind === 'beam') {
      AUDIO.play('magic');
      // push: the step's cells are the post-push cell, so aim at the (pre-push) target instead
      // centred: a single beam whose tip ends on the last cell hit, at the target's body height
      const aim = step.skill.cat === 'push' || !cells.length ? [t] : cells;
      const bcells = fx.center ? [{ x: aim[aim.length - 1].x, y: bodyAt(t).y }] : cells;
      FX.push({ type: 'beam', fx: fx.fx, cells: bcells, center: !!fx.center, t0: now(), dur: 420 / sp, tint: fx.tint });
      // fx2 = ground effect on every cell hit, anchored at the feet like 'cells'
      if (fx.fx2) cells.forEach((c, i) => FX.push({ type: 'sprite', fx: fx.fx2, sc: fxSc(fx.fx2), x: c.x, y: c.y + GEO.cell * 0.36, t0: now() + (120 + i * 40) / sp, dur: 480 / sp }));
      await wait(300);
    } else if (fx.kind === 'cells') {
      AUDIO.play('magic');
      const list = step.skill.cat === 'push' ? [t] : cells;
      list.forEach((c, i) => { const p = fx.center ? bodyAt(c) : { x: c.x, y: c.y + GEO.cell * 0.36 };
        FX.push({ type: 'sprite', fx: fx.fx, sc: fxSc(fx.fx), x: p.x, y: p.y, center: !!fx.center, t0: now() + i * 25 / sp, dur: 480 / sp, tint: fx.tint }); });
      if (fx.fx2) list.forEach(c => FX.push({ type: 'sprite', fx: fx.fx2, x: c.x, y: c.y + GEO.cell * 0.36, t0: now() + 160 / sp, dur: 480 / sp }));
      await wait(320);
    } else if (fx.kind === 'wave') {
      AUDIO.play('push');
      FX.push({ type: 'wave', color: fx.color, x: t.x, y: t.y, t0: now(), dur: 380 / sp });
      await wait(180);
    } else {
      AUDIO.play('slash');
      // push: the step's cells are the post-push cell, so strike the (pre-push) target; aim at the body
      (step.skill.cat === 'push' || !cells.length ? [t] : cells).map(bodyAt).forEach(c => FX.push({ type: 'slash', color: fx.color, x: c.x, y: c.y, t0: now(), dur: 300 / sp }));
      await wait(180);
    }
    if (step.skill.cat === 'rage' && !SAVE.settings.reduce) SHAKE = 6;
  }
  function finishExec(sim, replay) {
    const lv = G.level;
    EX = null;
    if (sim.outcome === 'win') {
      AUDIO.play('win'); vibrate([30, 40, 60]);
      const hinted = !!SAVE.hintsUsed[lv.id];
      let stars = 1; if (sim.rageUsed <= lv.parRageUsed) stars = 2; if (stars === 2 && !hinted) stars = 3;
      const prev = SAVE.progress[lv.id] || {};
      const firstClear = !prev.stars;
      SAVE.progress[lv.id] = { stars: Math.max(prev.stars || 0, stars), plays: (prev.plays || 0) + 1 };
      persist();
      const usedActs = sim.steps.length;
      const next = LEVELS.find(l => l.id === lv.id + 1);
      const newHeroes = next ? next.heroes.filter(h => heroFirstLevel(h) === next.id) : [];
      modal(`<div class="m-badge win">${ic('trophy')}</div><h3>CHIẾN THẮNG!</h3>
        <div class="stars-big">${stars3(stars)}</div>
        <div class="stats">
          <div>Hành động<b>${usedActs}/${G.order.length}</b></div>
          <div>Nộ đã dùng<b>${sim.rageUsed}/${lv.rageBudget}</b><small>chuẩn 2${STAR}: ≤${lv.parRageUsed}</small></div>
          <div>Gợi ý<b>${hinted ? 'Có' : 'Không'}</b></div>
          <div>Tốt nhất<b class="st-row">${stars3(SAVE.progress[lv.id].stars)}</b></div>
        </div>
        ${stars < 3 ? `<p style="color:var(--mut);font-size:12px">${stars === 1 ? `2${STAR}: dùng tối đa ${lv.parRageUsed} nộ.` : `3${STAR}: thắng mà không mở gợi ý.`}</p>` : ''}
        ${newHeroes.length && firstClear ? `<p style="color:var(--cyan)">Mở khóa: ${newHeroes.map(h => S.HEROES[h].name).join(', ')}!</p>` : ''}
        <div class="acts">${next ? `<button class="btn big green" data-m="next">${ic('play')}Chơi tiếp</button>` : '<p>Bạn đã hoàn thành toàn bộ chiến dịch!</p>'}
        <div class="row2"><button class="btn" data-m="retry">${ic('retry')}Chơi lại</button><button class="btn" data-m="list">${ic('map')}Chọn màn</button></div></div>`, box => {
        box.querySelector('[data-m=retry]').onclick = () => { closeModal(); backToPlan(); };
        box.querySelector('[data-m=list]').onclick = () => { closeModal(); G.mode = 'plan'; show('levels'); };
        const n = box.querySelector('[data-m=next]'); if (n) n.onclick = () => { closeModal(); startLevel(next.id); };
      });
      [1, 2, 3].forEach(i => { if (i <= stars) setTimeout(() => AUDIO.play('star'), 300 + i * 180); });
    } else {
      AUDIO.play('lose'); vibrate(80);
      const rem = sim.remaining.map(e => `${D.KIND_INFO[e.kind].name.split(' /')[0]} ở <b>${cellName(e.c, e.r)}</b> (HP ${e.hp})`);
      const fails = sim.steps.filter(s => !s.ok).map(s => `${S.HEROES[s.heroId].name}: ${D.FAIL_TXT[s.reason]}`);
      modal(`<div class="m-badge lose">${ic('skull')}</div><h3 class="lose">THẤT BẠI</h3>
        <p>Còn <b>${sim.remaining.length}</b> quái sống sau lượt:</p>
        <div class="hint-tier">${rem.join('<br>')}${fails.length ? '<br><span style="color:#ff9a8e">Hành động hụt: ' + fails.join('; ') + '</span>' : ''}</div>
        <div class="acts"><button class="btn big green" data-m="fix">${ic('scroll')}Sửa kế hoạch</button>
        <div class="row2"><button class="btn" data-m="replay">${ic('eye')}Xem lại</button><button class="btn" data-m="hint">${ic('hint')}Gợi ý</button></div></div>`, box => {
        box.querySelector('[data-m=fix]').onclick = () => { closeModal(); backToPlan(); };
        box.querySelector('[data-m=replay]').onclick = () => { closeModal(); G.mode = 'plan'; execute(true); };
        box.querySelector('[data-m=hint]').onclick = () => { closeModal(); backToPlan(); openHints(); };
      });
    }
  }
  function backToPlan() {
    EX = null; G.mode = 'plan'; setExecUI(false); FX = []; POP = [];
    Object.keys(HERO_ACT).forEach(k => { HERO_ACT[k].anim = null; HERO_ACT[k].loop = true; }); resetHeroOffsets();
    G.sim = S.simulate(G.level, G.placement, planOf());
    buildActorsFromState(S.makeState(G.level));
    G.pv = G.order.indexOf(G.sel); renderPlanUI();
    if (G.tut) $('#tut').classList.remove('hidden');
  }

  // ================= HINTS =================
  function solutionLines() {
    const rs = G.level.referenceSolution;
    const place = Object.entries(rs.placement).map(([h, p]) => `${S.HEROES[h].name} → <b>${cellName(p[0], p[1])}</b>`).join(', ');
    const steps = rs.plan.map((a, i) => `${i + 1}. ${S.HEROES[a.heroId].name}: <b>${S.SKILLS[S.HEROES[a.heroId].skills[a.cat]].name}</b>${a.cat === 'push' ? ' ' + IC.dirIcon(pushDir(a.heroId)) + ' (' + S.DIRS[pushDir(a.heroId)].name + ')' : ''}`);
    return { place, steps };
  }
  function keyStep() {
    const rs = G.level.referenceSolution; let i = rs.plan.findIndex(a => a.cat === 'push'); if (i < 0) i = rs.plan.findIndex(a => a.cat === 'rage'); if (i < 0) i = 0;
    const a = rs.plan[i]; const p = rs.placement[a.heroId];
    return `Bước quan trọng: đặt <b>${S.HEROES[a.heroId].name}</b> ở <b>${cellName(p[0], p[1])}</b> và dùng <b>${D.CAT_TXT[a.cat]}</b>${a.cat === 'push' ? ' (đẩy ' + IC.dirIcon(pushDir(a.heroId)) + ' ' + S.DIRS[pushDir(a.heroId)].name + ')' : ''}${i === 0 ? ', hành động đầu tiên' : `, là hành động thứ ${i + 1}`}.`;
  }
  function ideaText() {
    const rs = G.level.referenceSolution; const cats = new Set(rs.plan.map(a => a.cat));
    let t = G.level.idea;
    const used = rs.plan.length < G.level.heroes.length ? ` Không nhất thiết mọi nhân vật đều phải ra tay.` : '';
    t += cats.has('push') ? ' Lời giải tham chiếu có dùng <b>Đẩy</b>.' : ' Lời giải tham chiếu không cần Đẩy.';
    if (cats.has('rage')) t += ' Cần dùng <b>Chiêu nộ</b>.';
    return t + used;
  }
  function openHints() {
    const id = G.level.id; const lvl = (SAVE.hintTier && SAVE.hintTier[id]) || 0;
    const tiers = [
      ['1 · Ý tưởng', ideaText()],
      ['2 · Một bước quan trọng', keyStep()],
      ['3 · Lời giải', (() => { const s = solutionLines(); return `Vị trí: ${s.place}<br>${s.steps.join('<br>')}<br><button class="btn tiny" data-m="apply" style="margin-top:6px">${ic('check')}Áp dụng lời giải</button>`; })()],
    ];
    const html = `<div class="m-badge">${ic('hint')}</div><h3>GỢI Ý</h3><p style="font-size:12px;color:var(--mut)">Mở gợi ý sẽ mất điều kiện 3${STAR} của màn này (hoàn tác & thử lại không bị trừ sao).</p>` +
      tiers.map((t, i) => `<div class="hint-tier ${i < lvl ? '' : 'locked'}"><h4>${t[0]}</h4>${i < lvl ? t[1] : '<i>Chưa mở</i>'}</div>`).join('') +
      `<div class="acts">${lvl < 3 ? `<button class="btn big" data-m="more">${ic('unlock')}Mở gợi ý ${lvl + 1}</button>` : ''}<button class="btn" data-m="close">Đóng</button></div>`;
    modal(html, box => {
      const m = box.querySelector('[data-m=more]'); if (m) m.onclick = () => { SAVE.hintTier = SAVE.hintTier || {}; SAVE.hintTier[id] = lvl + 1; SAVE.hintsUsed[id] = true; persist(); AUDIO.play('select'); openHints(); };
      box.querySelector('[data-m=close]').onclick = closeModal;
      const ap = box.querySelector('[data-m=apply]'); if (ap) ap.onclick = () => {
        const rs = G.level.referenceSolution;
        commit(() => {
          G.placement = JSON.parse(JSON.stringify(rs.placement));
          const acted = rs.plan.map(a => a.heroId); G.order = acted.concat(G.level.heroes.filter(h => !acted.includes(h)));
          rs.plan.forEach(a => { G.actions[a.heroId] = { cat: a.cat, dir: a.dir == null ? 2 : a.dir }; });
          G.sel = G.order[0];
        }, 'swap');
        closeModal(); toast('Đã áp dụng lời giải tham chiếu — bấm TẤN CÔNG');
      };
    });
  }

  // ================= TUTORIAL =================
  // Each entry: intro = lesson card shown when the level opens; steps = guided banner.
  // step: { txt, done() | next:true, cells: [[side,c,r]...] highlighted on the board, el: CSS selector that glows }
  const P = h => G.placement[h], A = h => G.actions[h].cat;
  const ATTACK = { txt: 'Mọi thứ đã sẵn sàng. Bấm <b>TẤN CÔNG</b> để cả đội ra tay.', el: '[data-act=attack]', hand: [{tap:'[data-act=attack]'}], done: () => G.mode === 'exec' };
  const skillCard = id => { const sk = S.SKILLS[id]; return `<div class="tut-sk">${miniAoe(sk)}<div><b>${sk.name}</b> · ${D.CAT_TXT[sk.cat]}<br><small>${sk.cat === 'push' ? `Đẩy 1 ô ${S.DIRS[sk.dir].arrow} + ${sk.damage} sát thương` : `${sk.damage} sát thương · ${D.AOE_TXT[sk.aoe]}`}${sk.ignoresArmor ? ' · bỏ qua giáp' : ''}</small></div></div>`; };
  const TUTS = {
    1: {
      intro: { icon: 'scroll', title: 'CÁCH CHƠI', body: `<p>Mục tiêu: <b>hạ hết quái trong đúng 1 lượt</b>.</p>
        <ol class="tut-ol"><li><b>Đặt vị trí</b> nhân vật ở sân xanh (bên trái).</li><li><b>Chọn kỹ năng</b> cho từng nhân vật.</li><li><b>Xếp thứ tự</b> ra tay.</li><li>Bấm <b>TẤN CÔNG</b> — mỗi nhân vật hành động 1 lần.</li></ol>
        <p>Bảng luôn <b>xem trước</b> kết quả, nên cứ thử thoải mái.</p>` },
      steps: [
        { txt: 'Quái đứng ở <b>B2</b> sân địch. Nhân vật chỉ đánh quái <b>cùng hàng</b> với mình. Kéo Kiếm Sĩ lên <b>hàng 2</b>.', cells: [['ally', 1, 1], ['enemy', 1, 1]], hand: [{row:['sword',1]}], done: () => P('sword')[1] === 1 },
        { txt: 'Ô vàng bên sân địch là ô sẽ bị đánh. <b>Đánh thường</b> trúng đúng 1 ô, gây 2 sát thương — vừa đủ hạ quái 2 máu.', cells: [['enemy', 1, 1]], next: true },
        { txt: 'Cột không quan trọng: đứng ô nào trong hàng 2 cũng đánh tới. <b>Chỉ hàng quyết định mục tiêu.</b>', next: true },
        ATTACK,
      ],
    },
    2: {
      intro: { icon: 'swords', title: 'THỨ TỰ HÀNH ĐỘNG', body: `<p>Kiếm Sĩ và Pháp Sư đều đánh <b>Hàng đầu</b>: con quái <b>gần nhất</b> trong hàng.</p>
        <p>Thẻ nhân vật đánh số <b>1, 2…</b> là thứ tự ra tay. Kéo thẻ để đổi thứ tự.</p>` + skillCard('mg_n') },
      steps: [
        { txt: 'Hàng 1 có 2 quái. Đặt <b>cả hai nhân vật vào hàng 1</b>.', cells: [['enemy', 0, 0], ['enemy', 3, 0]], hand: [{row:['sword',0]}, {row:['mage',0]}], done: () => P('sword')[1] === 0 && P('mage')[1] === 0 },
        { txt: 'Người số 1 hạ quái <b>A1</b>, nên người số 2 đánh con kế tiếp là <b>D1</b>. Chạm từng thẻ để xem trước mục tiêu của mỗi bước.', el: '#cards', hand: [{tap:'#cards .card:nth-child(2)'}], next: true },
        ATTACK,
      ],
    },
    3: {
      intro: { icon: 'eye', title: 'BỎ QUA 1 QUÁI', body: `<p><b>Cung Thủ</b> bỏ qua con quái đầu tiên và bắn <b>con thứ hai</b> trong hàng. Ô trống không tính, chỉ đếm quái.</p>
        <p>Nếu hàng chỉ còn 1 quái, Cung Thủ bắn luôn con đó.</p>` + skillCard('ar_n') },
      steps: [
        { txt: 'Đặt <b>cả hai nhân vật vào hàng 2</b>.', cells: [['enemy', 0, 1], ['enemy', 3, 1]], hand: [{row:['archer',1]}, {row:['sword',1]}], done: () => P('archer')[1] === 1 && P('sword')[1] === 1 },
        { txt: 'Cung Thủ bắn qua đầu <b>A2</b> trúng <b>D2</b>; Kiếm Sĩ đánh <b>A2</b>. Mỗi người một con.', cells: [['enemy', 3, 1]], next: true },
        ATTACK,
      ],
    },
    4: {
      intro: { icon: 'rage', title: 'CHIÊU NỘ', body: `<p><b>Chiêu nộ</b> là đòn duy nhất <b>đánh vùng</b> và mạnh hơn đánh thường.</p>
        <p>Mỗi Chiêu nộ tốn <b>1 điểm Nộ</b>; số điểm của màn hiện ở dòng <b>Nộ</b> dưới bảng. Dùng không quá mức chuẩn để được 2${STAR}.</p>` + skillCard('mg_r') },
      steps: [
        { txt: 'Đặt <b>cả hai nhân vật vào hàng 2</b>.', hand: [{row:['sword',1]}, {row:['mage',1]}], done: () => P('sword')[1] === 1 && P('mage')[1] === 1 },
        { txt: 'Chạm thẻ <b>Pháp Sư</b>, rồi chọn <b>Chiêu nộ</b>.', el: '#skills [data-cat=rage]', hand: [{skill:['mage','rage']}], done: () => A('mage') === 'rage' },
        { txt: 'Kiếm Sĩ (số 1) hạ <b>A2</b> trước, nên nộ của Pháp Sư nhắm <b>C2</b> và nổ trúng cả <b>C2, D2</b>. Nếu Pháp Sư đi trước, vụ nổ chỉ trúng A2!', cells: [['enemy', 2, 1], ['enemy', 3, 1]], el: '#cards', next: true },
        ATTACK,
      ],
    },
    5: {
      intro: { icon: 'push', title: 'ĐẨY', body: `<p><b>Đẩy</b> gây <b>1 sát thương</b> và dời quái <b>1 ô</b> theo hướng riêng của từng nhân vật.</p>
        <p>Bị biên, tường hoặc quái khác chặn thì quái đứng yên (vẫn mất 1 máu).</p>
        <p>Dùng Đẩy để <b>gom quái vào vùng Chiêu nộ</b>.</p>` + skillCard('ar_p') },
      steps: [
        { txt: 'Chạm thẻ <b>Cung Thủ</b> rồi chọn <b>Đẩy</b>. Cung Thủ luôn đẩy <b>↓ xuống</b>.', el: '#skills [data-cat=push]', hand: [{skill:['archer','push']}], done: () => A('archer') === 'push' },
        { txt: 'Đặt Cung Thủ ở <b>hàng 1</b>: quái <b>A1</b> bị đẩy xuống <b>A2</b>.', cells: [['enemy', 0, 0], ['enemy', 0, 1]], hand: [{row:['archer',0]}], done: () => P('archer')[1] === 0 },
        { txt: 'Kiếm Sĩ: chọn <b>Chiêu nộ</b> (quét dọc 3 ô) và đứng ở <b>hàng 3</b> — trúng A2, A3, A4.', cells: [['enemy', 0, 1], ['enemy', 0, 2], ['enemy', 0, 3]], hand: [{skill:['sword','rage']}, {row:['sword',2]}], done: () => A('sword') === 'rage' && P('sword')[1] === 2 },
        { txt: 'Cung Thủ phải ra tay <b>trước</b> (thẻ số 1) để quái kịp vào vùng nộ.', el: '#cards', hand: [{first:'archer'}], done: () => G.order[0] === 'archer' },
        ATTACK,
      ],
    },
    6: {
      intro: { icon: 'push', title: 'HƯỚNG ĐẨY', body: `<p>Mỗi nhân vật đẩy theo <b>một hướng cố định</b>:</p>
        <p class="tut-dirs">Kiếm Sĩ <b>→</b> · Cung Thủ <b>↓</b> · Pháp Sư <b>↑</b><br>Thương Binh <b>←</b> · Sát Thủ <b>↗</b> · Phù Thủy Băng <b>↘</b></p>
        <p>Đẩy có thể đưa quái <b>sang hàng khác</b>.</p>` + skillCard('mg_p') },
      steps: [
        { txt: 'Quái <b>A4</b> nằm ngoài tầm nộ. Pháp Sư chọn <b>Đẩy</b> và đứng ở <b>hàng 4</b> để đẩy nó lên <b>A3</b>.', cells: [['enemy', 0, 3], ['enemy', 0, 2]], hand: [{skill:['mage','push']}, {row:['mage',3]}], done: () => A('mage') === 'push' && P('mage')[1] === 3 },
        { txt: 'Kiếm Sĩ dùng <b>Chiêu nộ</b> ở <b>hàng 2</b>: quét A1, A2, A3.', hand: [{skill:['sword','rage']}, {row:['sword',1]}], done: () => A('sword') === 'rage' && P('sword')[1] === 1 },
        ATTACK,
      ],
    },
    7: {
      intro: { icon: 'swords', title: 'NHÂN VẬT MỚI: THƯƠNG BINH', body: `<p>Thương Binh đánh Hàng đầu, đẩy <b>← sang trái</b>.</p><p>Chiêu nộ <b>xuyên cả hàng</b> 4 ô (dừng lại khi gặp tường).</p>` + skillCard('ln_r') },
      steps: [
        { txt: 'Pháp Sư chọn <b>Đẩy</b> ở <b>hàng 2</b>: quái <b>B2</b> bị đẩy lên <b>B1</b>.', cells: [['enemy', 1, 1], ['enemy', 1, 0]], hand: [{skill:['mage','push']}, {row:['mage',1]}], done: () => A('mage') === 'push' && P('mage')[1] === 1 },
        { txt: 'Thương Binh dùng <b>Chiêu nộ</b> ở <b>hàng 1</b>: xuyên A1 → D1.', cells: [['enemy', 0, 0], ['enemy', 3, 0]], hand: [{skill:['lancer','rage']}, {row:['lancer',0]}], done: () => A('lancer') === 'rage' && P('lancer')[1] === 0 },
        { txt: '<b>Kéo thẻ Pháp Sư lên vị trí số 1</b>: phải đẩy trước rồi mới xuyên.', el: '#cards', hand: [{first:'mage'}], done: () => G.order[0] === 'mage' },
        ATTACK,
      ],
    },
    8: {
      intro: { icon: 'eye', title: 'NHÂN VẬT MỚI: SÁT THỦ', body: `<p>Sát Thủ <b>Bỏ qua 1 quái</b> như Cung Thủ, đánh thường <b>4 sát thương</b>.</p>
        <p>Đẩy <b>chéo ↗</b>: chỉ xét ô đến — ô đó trống là quái đi được, kể cả khi bên cạnh có tường hay quái.</p>` + skillCard('as_p') },
      steps: [
        { txt: 'Sát Thủ chọn <b>Đẩy</b> ở <b>hàng 4</b>: quái <b>A4</b> (4 máu) bị đẩy chéo lên <b>B3</b>.', cells: [['enemy', 0, 3], ['enemy', 1, 2]], hand: [{skill:['assassin','push']}, {row:['assassin',3]}], done: () => A('assassin') === 'push' && P('assassin')[1] === 3 },
        { txt: 'Pháp Sư dùng <b>Chiêu nộ</b> ở <b>hàng 3</b>: nổ 3×3 quanh B3 — trúng cả 4 quái.', hand: [{skill:['mage','rage']}, {row:['mage',2]}], done: () => A('mage') === 'rage' && P('mage')[1] === 2 },
        ATTACK,
      ],
    },
    9: {
      intro: { icon: 'rage', title: 'NHÂN VẬT MỚI: PHÙ THỦY BĂNG', body: `<p>Phù Thủy Băng đánh Hàng đầu, đẩy <b>chéo ↘</b>.</p><p>Chiêu nộ nổ <b>hình chữ thập</b> 5 ô và <b>bỏ qua giáp</b>.</p>` + skillCard('ic_r') },
      steps: [
        { txt: 'Cung Thủ chọn <b>Đẩy</b> ở <b>hàng 2</b>: quái <b>B2</b> xuống <b>B3</b>.', cells: [['enemy', 1, 1], ['enemy', 1, 2]], hand: [{skill:['archer','push']}, {row:['archer',1]}], done: () => A('archer') === 'push' && P('archer')[1] === 1 },
        { txt: 'Phù Thủy Băng dùng <b>Chiêu nộ</b> ở <b>hàng 3</b>: chữ thập quanh B3 trúng B3, C3, B4.', cells: [['enemy', 1, 2], ['enemy', 2, 2], ['enemy', 1, 3]], hand: [{skill:['ice','rage']}, {row:['ice',2]}], done: () => A('ice') === 'rage' && P('ice')[1] === 2 },
        { txt: '<b>Kéo thẻ Cung Thủ lên vị trí số 1</b>.', el: '#cards', hand: [{first:'archer'}], done: () => G.order[0] === 'archer' },
        ATTACK,
      ],
    },
    10: {
      intro: { icon: 'trophy', title: 'BÀI KIỂM TRA', body: `<p>Bạn đã biết đủ: <b>Đánh thường, Bỏ qua 1 quái, Đẩy, Chiêu nộ</b> và cả 6 nhân vật.</p>
        <p>Màn này tự giải nhé! Gợi ý: cần cả <b>Đẩy</b> lẫn <b>Nộ</b>. Bí thì bấm nút gợi ý ở góc trên.</p>` },
    },
    11: { intro: { icon: 'map', title: 'CHƯƠNG 2', body: `<p>Hết phần hướng dẫn — từ đây <b>độ khó tăng</b>: nhiều quái hơn, máu dày hơn, 3–4 nhân vật phải phối hợp.</p><p>Xem lại luật bất cứ lúc nào: <b>Tạm dừng → Cách chơi</b>.</p>` } },
    41: { intro: { icon: 'lock', title: 'TƯỜNG', body: `<p><b>Tường</b> (ô gạch xám) chặn đường ngắm và chặn tia xuyên.</p><p>Tường không tính là quái khi “Bỏ qua 1 quái”. Đẩy quái vào tường thì nó đứng yên.</p>` } },
    43: { intro: { icon: 'shield', title: 'GIÁP NẶNG', body: `<p>Quái có <b>khiên</b> giảm 1 sát thương mỗi đòn — Đẩy (1 sát thương) không làm nó mất máu.</p><p>Chiêu nộ của Phù Thủy Băng bỏ qua giáp.</p>` } },
    47: { intro: { icon: 'anchor', title: 'MIỄN ĐẨY & Ô KHÓA', body: `<p>Quái có <b>neo</b> không bị đẩy (vẫn mất 1 máu) và chặn quái khác bị đẩy vào ô của nó.</p><p>Ô có <b>ổ khóa</b> ở sân xanh không đặt được nhân vật.</p>` } },
    50: { intro: { icon: 'skull', title: 'BOSS', body: `<p><b>Boss</b> (vương miện) nhiều máu, có giáp và miễn đẩy — nhưng chỉ chiếm 1 ô.</p><p>Dọn quái nhỏ trước, dồn đòn mạnh nhất vào boss.</p>` } },
  };
  // glossary page (pause menu → Cách chơi)
  function openHowTo() {
    modal(`<div class="m-badge">${ic('scroll')}</div><h3>CÁCH CHƠI</h3><div class="howto">
      <p>Hạ <b>hết quái trong 1 lượt</b>: đặt vị trí, chọn kỹ năng, xếp thứ tự rồi bấm TẤN CÔNG.</p>
      <h4>Mục tiêu</h4><p><b>Hàng đầu</b>: quái gần nhất cùng hàng. <b>Bỏ qua 1 quái</b> (Cung Thủ, Sát Thủ): con thứ hai; hàng chỉ còn 1 quái thì bắn con đó. Cột đứng không quan trọng.</p>
      <h4>Kỹ năng</h4><p><b>Đánh thường</b>: 1 ô. <b>Đẩy</b>: 1 sát thương + dời 1 ô theo hướng riêng (Kiếm Sĩ →, Cung Thủ ↓, Pháp Sư ↑, Thương Binh ←, Sát Thủ ↗, Phù Thủy Băng ↘). <b>Chiêu nộ</b>: đánh vùng, tốn 1 điểm Nộ.</p>
      <h4>Chướng ngại</h4><p><b>Tường</b> chặn đường bắn. <b>Giáp</b> −1 sát thương mỗi đòn. <b>Neo</b> miễn đẩy. <b>Ô khóa</b> không đặt được nhân vật.</p>
      <h4>Sao</h4><p>1${STAR} thắng · 2${STAR} không vượt mức nộ chuẩn · 3${STAR} thêm không dùng gợi ý.</p></div>
      <div class="acts"><button class="btn big green" data-m="close">Đã hiểu</button></div>`, box => { box.querySelector('[data-m=close]').onclick = closeModal; });
  }
  function clearTutGlow() { $$('.tut-glow').forEach(e => e.classList.remove('tut-glow')); }
  function startTutorial() {
    const id = G.level.id; const t = TUTS[id];
    G.tut = null; G.tutStep = 0; G.tutList = []; clearTutGlow();
    $('#tut').classList.add('hidden');
    if (!t || (SAVE.tutorialsSeen[id] && !G.forceTut)) return;
    G.forceTut = false;
    G.tutList = t.steps || [];
    const begin = () => { closeModal(); if (G.tutList.length) showTutStep(); else { SAVE.tutorialsSeen[id] = true; persist(); } };
    if (t.intro) {
      modal(`<div class="m-badge">${ic(t.intro.icon || 'scroll')}</div><h3>${t.intro.title}</h3><div class="tut-intro">${t.intro.body}</div>
        <div class="acts"><button class="btn big green" data-m="go">${ic('play')}${G.tutList.length ? 'Bắt đầu' : 'Đã hiểu'}</button></div>`,
        box => { box.querySelector('[data-m=go]').onclick = () => { AUDIO.play('select'); begin(); }; });
    } else begin();
  }
  function showTutStep() {
    clearTutGlow();
    const s = G.tutList[G.tutStep];
    if (!s) { G.tut = null; $('#tut').classList.add('hidden'); SAVE.tutorialsSeen[G.level.id] = true; persist(); return; }
    G.tut = s; $('#tut-txt').innerHTML = `<small class="tut-n">${G.tutStep + 1}/${G.tutList.length}</small>` + s.txt; $('#tut').classList.remove('hidden');
    $('#tut-next').innerHTML = s.next ? 'Tiếp' + ic('next') : 'Bỏ qua' + ic('skip');
    if (s.el) $$(s.el).forEach(e => e.classList.add('tut-glow'));
    if (!s.next && s.done && s.done()) { G.tutStep++; showTutStep(); }
  }
  $('#tut-next').onclick = () => { if (!G.tut) return; if (G.tut.next) { G.tutStep++; showTutStep(); } else { G.tutStep = G.tutList.length; showTutStep(); } AUDIO.play('tap'); };
  function tutCheck() { if (G.tut && G.tut.done && G.tut.done()) { G.tutStep++; AUDIO.play('select'); showTutStep(); } }

  // ---- tutorial pointing hand ----
  // Each step's `hand` is a list of sub-goals; the hand demonstrates the first one not yet met:
  //   {row:[hero,r]}  drag the hero on the board into row r
  //   {skill:[hero,cat]}  tap the hero's card, then the skill button
  //   {first:hero}  drag the hero's card to slot 1
  //   {tap:selector}  tap a UI element
  // Steps without `hand` point at their first highlighted cell, or at the "Tiếp" button.
  const HAND = document.createElement('div'); HAND.id = 'tut-hand'; HAND.className = 'tut-hand hidden';
  HAND.innerHTML = `<i class="tut-ripple"></i><svg viewBox="0 0 64 74" aria-hidden="true"><path d="M20 36V9a6.5 6.5 0 0 1 13 0v22a5.5 5.5 0 0 1 11 0v2a5.5 5.5 0 0 1 11 0v3a5 5 0 0 1 10 0v15c0 12-8 20-20 20h-6c-8 0-12-3-16-9L5 48a6 6 0 0 1 9-8z" fill="#fff" stroke="#16202a" stroke-width="3.5" stroke-linejoin="round"/><path d="M33 31v9M44 33v7M55 36v6" fill="none" stroke="#16202a" stroke-width="2.5" stroke-linecap="round"/><path d="M22 9a4.5 4.5 0 0 1 9 0" fill="none" stroke="#c9d6e0" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  $('#app').appendChild(HAND);
  const HAND_TIP = { x: 26.5, y: 3 }; // fingertip inside the 64-wide svg (drawn at 52px)
  const elCenter = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, vis: r.width > 0 && r.height > 0 }; };
  function boardPagePt(c, r) { const b = board.getBoundingClientRect(); const p = cellCenter('ally', c, r); return { x: b.left + p.x, y: b.top + p.y }; }
  function rowTargetCol(h, r) {
    const cur = G.placement[h][0]; const ok = c => !isLocked(c, r) && !heroAt(c, r);
    const cols = [0, 1, 2, 3].sort((a, b) => Math.abs(a - cur) - Math.abs(b - cur));
    return cols.find(ok) ?? cols.find(c => !isLocked(c, r)) ?? cur;
  }
  function tutGesture() {
    const s = G.tut; if (!s || !GEO) return null;
    const goals = s.hand || [];
    for (const g of goals) {
      if (g.row) {
        const [h, r] = g.row; if (G.placement[h][1] === r) continue;
        const [c0, r0] = G.placement[h]; const c1 = rowTargetCol(h, r);
        return { kind: 'drag', a: boardPagePt(c0, r0), b: boardPagePt(c1, r), board: { from: [c0, r0], to: [c1, r] } };
      }
      if (g.skill) {
        const [h, cat] = g.skill; if (G.actions[h].cat === cat) continue;
        const el = G.sel === h ? $(`#skills [data-cat=${cat}]`) : $(`#cards .card[data-hero=${h}]`);
        return el && { kind: 'tap', el };
      }
      if (g.first) {
        if (G.order[0] === g.first) continue;
        const el = $(`#cards .card[data-hero=${g.first}]`), first = $('#cards').firstElementChild;
        return el && first && { kind: 'drag', el, a: elCenter(el), b: elCenter(first) };
      }
      if (g.tap) { const el = $(g.tap); return el && { kind: 'tap', el }; }
    }
    if (goals.length) return null;
    if (s.cells && s.cells.length) {
      const [side, c, r] = s.cells[0]; const b = board.getBoundingClientRect(); const p = cellCenter(side, c, r);
      return { kind: 'point', a: { x: b.left + p.x, y: b.top + p.y } };
    }
    return { kind: 'tap', el: $('#tut-next') };
  }
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  let handKey = '', handT0 = 0;
  function updateHand() {
    const show = screen === 'game' && G.tut && G.mode === 'plan' && !G.drag && !G.cardDrag && !G.chipDrag && $('#modal').classList.contains('hidden');
    const g = show ? tutGesture() : null;
    G.tutGest = g;
    if (!g) { HAND.classList.add('hidden'); handKey = ''; return; }
    if (g.el) { const c = elCenter(g.el); if (!c.vis) { HAND.classList.add('hidden'); return; } if (!g.a) g.a = c; }
    const key = g.kind + (g.el ? g.el.dataset.hero || g.el.dataset.cat || g.el.id || g.el.className : '') + (g.board ? g.board.from + '>' + g.board.to : '');
    if (key !== handKey) { // new gesture: restart the animation and bring off-screen targets into view
      handKey = key; handT0 = now();
      if (g.el && g.el.closest('#g-scroll')) g.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    const app = $('#app').getBoundingClientRect();
    let x = g.a.x, y = g.a.y, press = 0, alpha = 1, ripple = -1;
    if (g.kind === 'drag') {
      const T = 2200, t = ((now() - handT0) % T) / T;
      if (t < 0.12) { alpha = t / 0.12; y += 10 * (1 - t / 0.12); }
      else if (t < 0.22) { press = (t - 0.12) / 0.1; if (t > 0.17) ripple = (t - 0.17) / 0.25; }
      else if (t < 0.72) { const k = ease((t - 0.22) / 0.5); x += (g.b.x - g.a.x) * k; y += (g.b.y - g.a.y) * k; press = 1; }
      else { x = g.b.x; y = g.b.y; press = Math.max(0, 1 - (t - 0.72) / 0.08); alpha = t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15; }
      g.k = t < 0.22 ? 0 : t < 0.72 ? ease((t - 0.22) / 0.5) : 1;
    } else if (g.kind === 'tap') {
      const T = 1300, t = ((now() - handT0) % T) / T;
      if (t < 0.45) y += 14 * ease(1 - t / 0.45);
      else if (t < 0.6) press = (t - 0.45) / 0.15;
      else { press = 1 - (t - 0.6) / 0.4; y += 14 * ease((t - 0.6) / 0.4); }
      if (t > 0.55) ripple = (t - 0.55) / 0.45;
    } else { y += 6 + 6 * Math.sin(now() / 220); } // point: gentle bob
    HAND.classList.remove('hidden');
    HAND.style.opacity = alpha;
    HAND.style.transform = `translate(${x - app.left - HAND_TIP.x * 52 / 64}px, ${y - app.top - HAND_TIP.y * 52 / 64}px) rotate(-12deg) scale(${1 - press * 0.12})`;
    const rp = HAND.firstElementChild;
    rp.style.opacity = ripple < 0 || ripple > 1 ? 0 : 1 - ripple;
    rp.style.transform = `translate(-50%, -50%) scale(${0.3 + Math.max(0, ripple) * 1.2})`;
  }
  // board overlay for a hero-drag demo: dashed arrow + target cell
  function drawHandGuide(ctx) {
    const g = G.tutGest; if (!g || !g.board) return;
    const { cell } = GEO; const a = cellCenter('ally', ...g.board.from), b = cellCenter('ally', ...g.board.to), t = cellXY('ally', ...g.board.to);
    const pulse = 0.5 + 0.5 * Math.sin(now() / 180);
    ctx.fillStyle = `rgba(255,214,90,${0.12 + pulse * 0.14})`; ctx.fillRect(t.x + 2, t.y + 2, cell - 4, cell - 4);
    ctx.strokeStyle = '#ffd65a'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -now() / 40;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
    const ang = Math.atan2(b.y - a.y, b.x - a.x), L = 10;
    ctx.fillStyle = '#ffd65a'; ctx.beginPath(); ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - L * Math.cos(ang - 0.45), b.y - L * Math.sin(ang - 0.45)); ctx.lineTo(b.x - L * Math.cos(ang + 0.45), b.y - L * Math.sin(ang + 0.45)); ctx.fill();
    // ghost of the hero travelling with the finger
    if (g.k > 0 && g.k < 1) {
      const h = heroAt(...g.board.from); if (!h) return; const sk = skinOf(h); const sh = sheet(sk.sprite, idleOf(sk.sprite));
      spr(ctx, sh, 0, a.x + (b.x - a.x) * g.k, a.y + (b.y - a.y) * g.k + cell * 0.35, GEO.sc, false, 0.55, sk.filter, GEO.dpr);
      ctx.setTransform(GEO.dpr, 0, 0, GEO.dpr, 0, 0);
    }
  }

  // ================= LEVEL SELECT =================
  let curChap = 1;
  function renderLevels() {
    $('#lv-stars').innerHTML = STAR + ' ' + totalStars() + '/180';
    const tabs = $('#chap-tabs'); tabs.innerHTML = '';
    CHAPTERS.forEach(ch => {
      const first = (ch.id - 1) * 10 + 1; const b = document.createElement('button');
      b.innerHTML = '<small>Chương</small><b>' + ch.id + '</b>'; b.className = (ch.id === curChap ? 'active' : '') + (unlocked(first) ? '' : ' locked');
      b.onclick = () => { curChap = ch.id; AUDIO.play('tap'); renderLevels(); }; tabs.appendChild(b);
    });
    const ch = CHAPTERS[curChap - 1];
    const lvls = LEVELS.filter(l => l.chapter === curChap);
    const st = lvls.reduce((a, l) => a + ((SAVE.progress[l.id] || {}).stars || 0), 0);
    $('#chap-head').innerHTML = `<h3>${ch.name}</h3><p>Mục tiêu học: ${ch.goal} · ${STAR} ${st}/30</p><div class="prog"><i style="width:${st / 30 * 100}%"></i></div>`;
    const grid = $('#lv-grid'); grid.innerHTML = '';
    const cur = continueId();
    for (const l of lvls) {
      const b = document.createElement('button'); const u = unlocked(l.id); const s = (SAVE.progress[l.id] || {}).stars || 0;
      b.className = 'lv' + (u ? '' : ' locked') + (l.id === cur ? ' current' : '');
      const nh = l.heroes.find(h => heroFirstLevel(h) === l.id && l.id > 1);
      b.innerHTML = `${nh ? `<span class="new-hero">MỚI</span>` : ''}<b>${l.id}</b><small>${l.name}</small><span class="st">${stars3(s)}</span>${u ? '' : `<span class="lv-lock">${ic('lock')}</span>`}`;
      b.onclick = () => { if (!u) { toast('Hoàn thành màn trước để mở khóa'); AUDIO.play('fail'); return; } AUDIO.play('select'); startLevel(l.id); };
      grid.appendChild(b);
    }
  }
  function continueId() { const l = LEVELS.find(l => unlocked(l.id) && !cleared(l.id)); return l ? l.id : LEVELS[LEVELS.length - 1].id; }

  // ================= HOME =================
  function renderHome() { const s = totalStars(); $('#home-stars').innerHTML = s ? `${STAR} ${s}/180 · Màn ${continueId()}` : ''; }
  const parade = $('#home-parade'); const pctx = parade.getContext('2d');
  function drawParade() {
    const dpr = Math.min(2, window.devicePixelRatio || 1); const W = parade.clientWidth || 320, H = 90;
    if (parade.width !== W * dpr) { parade.width = W * dpr; parade.height = H * dpr; }
    pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.clearRect(0, 0, parade.width, parade.height);
    const heroes = ['Knight', 'Archer', 'Wizard', 'Lancer', 'Swordsman', 'Priest'];
    const foes = ['Slime', 'Skeleton', 'Orc', 'Minotaur', 'Demon_D'];
    const sc = Math.max(1, Math.round(2 * dpr));
    heroes.forEach((n, i) => { const sh = sheet(n, 'Walk') || sheet(n, 'Walk01'); spr(pctx, sh, Math.floor(now() / FRAME_MS + i * 2), 22 + i * 26, 70, sc, false, 1, n === 'Priest' ? D.SKINS.ice[0].filter : null, dpr); });
    foes.forEach((n, i) => { const sh = sheet(n, idleOf(n)); spr(pctx, sh, Math.floor(now() / FRAME_MS + i), W - 22 - i * 30, 70, sc, true, 1, null, dpr); });
  }

  // ================= COLLECTION =================
  let colTab = 'heroes'; const colCanvases = [];
  function renderCollection() {
    $$('#col-tabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === colTab));
    const body = $('#col-body'); body.innerHTML = ''; colCanvases.length = 0;
    if (colTab === 'heroes') {
      for (const h of S.HERO_ORDER) {
        const hd = S.HEROES[h]; const un = heroUnlocked(h);
        const card = document.createElement('div'); card.className = 'hero-card' + (un ? '' : ' locked');
        const skins = D.SKINS[h].map((s, i) => `<button data-h="${h}" data-i="${i}" class="${(SAVE.skins[h] || 0) === i ? 'on' : ''}" ${totalStars() >= s.unlock && un ? '' : 'disabled'}>${s.name}${s.unlock ? ` (${s.unlock}${STAR})` : ''}</button>`).join('');
        card.innerHTML = `<div class="hero-top"><canvas width="144" height="144"></canvas><div><h4>${hd.name}</h4><p>${un ? hd.tag : 'Mở khóa ở màn ' + heroFirstLevel(h)}</p><div class="skins">${skins}</div></div></div>
          <div class="sk-list">${['normal', 'push', 'rage'].map(c => { const s = S.SKILLS[hd.skills[c]]; const pol = D.POLICY_TXT[s.policy];
            return `<div class="sk-row">${miniAoe(s)}<div><h5>${s.name}<em class="cat-${c}">${ic(CAT_IC[c])}${D.CAT_TXT[c]}</em></h5><p><b>${pol.short}</b> · ${c === 'push' ? `Đẩy 1 ô hướng ${S.DIRS[s.dir].name} ${IC.dirIcon(s.dir)}` + (s.damage ? ` + ${s.damage} sát thương` : '') : `Sát thương ${s.damage} · ${D.AOE_TXT[s.aoe]}`}${s.ignoresArmor ? ' · bỏ qua giáp' : ''}<br>${pol.tip}</p></div></div>`; }).join('')}</div>`;
        body.appendChild(card);
        colCanvases.push({ cv: card.querySelector('canvas'), sprite: skinOf(h).sprite, filter: skinOf(h).filter, flip: false, cycle: true });
      }
      body.querySelectorAll('.skins button').forEach(b => b.onclick = () => { SAVE.skins[b.dataset.h] = +b.dataset.i; persist(); AUDIO.play('select'); renderCollection(); });
      body.insertAdjacentHTML('beforeend', `<div class="hero-card"><p class="credit" style="margin:0">Không có giới hạn tầm: đứng cột nào trong hàng cũng đánh tới. Chỉ HÀNG quyết định mục tiêu; ô AoE phụ có thể lan sang hàng bên cạnh. Tường vẫn chặn đường ngắm.</p></div>`);
    } else if (colTab === 'enemies') {
      const groups = { slime: [], skel: [], armor: [], anchor: [], boss: [] };
      const seen = new Set();
      for (const l of LEVELS) for (const e of l.enemies) { const k = e.kind + '|' + e.sprite; if (!seen.has(k)) { seen.add(k); groups[e.kind].push({ sprite: e.sprite, lv: l.id }); } }
      const maxUn = LEVELS.filter(l => unlocked(l.id)).length;
      for (const [k, list] of Object.entries(groups)) {
        if (!list.length) continue;
        const g = document.createElement('div'); g.className = 'enemy-group';
        g.innerHTML = `<h4>${ic(KIND_IC[k])}${D.KIND_INFO[k].name}</h4><p class="d">${D.KIND_INFO[k].desc}</p><div class="enemy-grid">${list.map(x => `<div class="enemy-cell"><canvas width="128" height="128"></canvas>${x.lv <= maxUn ? x.sprite.replace('_', ' ') : '???'}<br>Màn ${x.lv}</div>`).join('')}</div>`;
        body.appendChild(g);
        g.querySelectorAll('canvas').forEach((cv, i) => colCanvases.push({ cv, sprite: list[i].sprite, flip: true, dark: list[i].lv > maxUn }));
      }
    } else {
      for (const [src, cap] of D.CONCEPT) body.insertAdjacentHTML('beforeend', `<div><img class="art-img" src="${encodeURI(src)}" alt="${esc(cap)}" loading="lazy"><p class="art-cap">${cap}</p></div>`);
      body.insertAdjacentHTML('beforeend', '<p class="credit">Ảnh concept chỉ là tham khảo bố cục/art direction, không phải bằng chứng màn chơi đã giải được.</p>');
    }
  }
  $('#col-tabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (!t) return; colTab = t.dataset.tab; AUDIO.play('tap'); renderCollection(); });
  function drawCollection() {
    const t = now();
    colCanvases.forEach((o, i) => {
      const ctx = o.cv.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, o.cv.width, o.cv.height);
      const anims = D.META.chars[o.sprite].anims;
      let anim = idleOf(o.sprite);
      if (o.cycle) { const cyc = ['Idle', 'Attack01', 'Attack02', 'Attack03', 'Attack', 'Heal', 'Attack3'].filter(a => anims[a]); anim = cyc[Math.floor(t / 1600) % cyc.length]; }
      const sh = sheet(o.sprite, anim); if (!sh) return;
      spr(ctx, sh, Math.floor(t / FRAME_MS), o.cv.width / 2, o.cv.height * 0.8, 4, o.flip, 1, o.dark ? 'brightness(0)' : o.filter, 1);
    });
  }

  // ================= SETTINGS =================
  function renderSettings() {
    const s = SAVE.settings;
    $('#set-music').value = s.music; $('#set-sfx').value = s.sfx; $('#set-vibe').checked = s.vibe; $('#set-speed').value = s.speed;
    $('#set-reduce').checked = s.reduce; $('#set-final').checked = s.finalPreview; $('#set-lang').value = s.lang;
    $('#btn-unlock-all').innerHTML = SAVE.unlockAll ? ic('lock') + 'Khoá lại theo tiến độ' : ic('unlock') + 'Mở khoá tất cả màn';
    $('#save-ver').textContent = 'Phiên bản dữ liệu lưu: v' + SAVE_VERSION + ' · tự lưu tiến độ, sao, cài đặt và kế hoạch đang soạn.';
  }
  function applySettings() {
    const s = SAVE.settings; AUDIO.setVolume('sfx', s.sfx / 100); AUDIO.setVolume('music', s.music / 100);
  }
  $('#set-music').oninput = e => { SAVE.settings.music = +e.target.value; applySettings(); AUDIO.setMusic(SAVE.settings.music > 0); persist(); };
  $('#set-sfx').oninput = e => { SAVE.settings.sfx = +e.target.value; applySettings(); persist(); };
  $('#set-sfx').onchange = () => AUDIO.play('hit');
  $('#set-vibe').onchange = e => { SAVE.settings.vibe = e.target.checked; persist(); vibrate(20); };
  $('#set-speed').onchange = e => { SAVE.settings.speed = +e.target.value; persist(); };
  $('#set-reduce').onchange = e => { SAVE.settings.reduce = e.target.checked; persist(); };
  $('#set-final').onchange = e => { SAVE.settings.finalPreview = e.target.checked; persist(); };
  $('#set-lang').onchange = e => { SAVE.settings.lang = e.target.value; persist(); };

  // ================= ACTIONS =================
  function openPause() {
    if (EX) EX.paused = true;
    modal(`<div class="m-badge">${ic('pause')}</div><h3>TẠM DỪNG</h3><p>Màn ${G.level.id} · ${G.level.name}</p><div class="acts">
      <button class="btn big green" data-m="resume">${ic('play')}Tiếp tục</button>
      <div class="row2"><button class="btn" data-m="restart">${ic('retry')}Chơi lại màn</button><button class="btn" data-m="settings">${ic('gear')}Cài đặt</button></div>
      <button class="btn" data-m="howto">${ic('scroll')}Cách chơi</button>
      <div class="row2"><button class="btn" data-m="levels">${ic('map')}Chọn màn</button><button class="btn" data-m="home">${ic('home')}Trang chủ</button></div></div>`, box => {
      box.querySelector('[data-m=howto]').onclick = () => openHowTo();
      box.querySelector('[data-m=resume]').onclick = () => { closeModal(); if (EX) EX.paused = false; };
      box.querySelector('[data-m=restart]').onclick = () => { closeModal(); if (EX) { EX.skip = true; EX = null; } backToPlan(); };
      box.querySelector('[data-m=settings]').onclick = () => { closeModal(); if (EX) EX.paused = false; show('settings'); };
      box.querySelector('[data-m=levels]').onclick = () => { closeModal(); EX = null; G.mode = 'plan'; show('levels'); };
      box.querySelector('[data-m=home]').onclick = () => { closeModal(); EX = null; G.mode = 'plan'; show('home'); };
    });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    AUDIO.ensure();
    const act = b.dataset.act;
    switch (act) {
      case 'continue': AUDIO.play('select'); AUDIO.setMusic(SAVE.settings.music > 0); startLevel(continueId()); break;
      case 'levels': AUDIO.play('tap'); curChap = LEVELS.find(l => l.id === continueId()).chapter; show('levels'); break;
      case 'collection': AUDIO.play('tap'); show('collection'); break;
      case 'settings': AUDIO.play('tap'); show('settings'); break;
      case 'home': AUDIO.play('tap'); show('home'); break;
      case 'back-settings': AUDIO.play('tap'); applySettings(); show(prevScreen === 'game' && G.level ? 'game' : (prevScreen || 'home')); break;
      case 'pause': AUDIO.play('tap'); openPause(); break;
      case 'hint': AUDIO.play('tap'); if (G.mode === 'plan') openHints(); break;
      case 'attack': AUDIO.ensure(); execute(); break;
      case 'exec-pause': if (EX) { EX.paused = !EX.paused; b.innerHTML = EX.paused ? ic('play') + 'Tiếp' : ic('pause') + 'Dừng'; } break;
      case 'exec-speed': if (EX) { EX.speed = EX.speed === 1 ? 2 : 1; b.innerHTML = ic('bolt') + '×' + EX.speed; } break;
      case 'exec-skip': if (EX) { EX.skip = true; EX.paused = false; } break;
      case 'replay-tutorial': SAVE.tutorialsSeen = {}; persist(); toast('Hướng dẫn sẽ hiện lại khi vào màn'); break;
      case 'unlock-all':
        SAVE.unlockAll = !SAVE.unlockAll; persist(); renderSettings(); AUDIO.play('select');
        toast(SAVE.unlockAll ? 'Đã mở khoá tất cả màn' : 'Màn chơi đã khoá lại theo tiến độ'); break;
      case 'reset-save':
        modal('<div class="m-badge lose">' + ic('trash') + '</div><h3>XOÁ DỮ LIỆU?</h3><p>Toàn bộ tiến độ, sao và cài đặt sẽ bị xoá. Không thể hoàn tác.</p><div class="acts"><button class="btn danger" data-m="y">' + ic('trash') + 'Xoá</button><button class="btn" data-m="n">Huỷ</button></div>', box => {
          box.querySelector('[data-m=y]').onclick = () => { SAVE = defaultSave(); persist(); closeModal(); renderSettings(); toast('Đã xoá dữ liệu'); };
          box.querySelector('[data-m=n]').onclick = closeModal;
        });
        break;
    }
  });
  document.addEventListener('keydown', e => {
    if (screen !== 'game' || G.mode !== 'plan' || !$('#modal').classList.contains('hidden')) return;
    if (e.key === 'Enter') execute();
  });

  // ================= MAIN LOOP =================
  let lastSlow = 0;
  function loop() {
    try {
      if (screen === 'game') {
        drawBoard();
        // card portraits & dirpad target
        for (const b of $('#cards').children) {
          const cv = b.querySelector('canvas'); const h = b.dataset.hero; const sk = skinOf(h); const ctx = cv.getContext('2d');
          ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
          const sh = sheet(sk.sprite, idleOf(sk.sprite)); spr(ctx, sh, Math.floor(now() / FRAME_MS), cv.width / 2, cv.height * 0.86, 3, false, 1, sk.filter, 1);
        }
        const pad = $('#dirpad'); const cv = pad.querySelector('canvas');
        if (cv && !$('#push-panel').classList.contains('hidden')) {
          const ctx = cv.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
          const uid = pad.dataset.target; const e = uid !== '' ? G.level.enemies[+uid] : null;
          if (e) spr(ctx, sheet(e.sprite, idleOf(e.sprite)), Math.floor(now() / FRAME_MS), 36, 58, 2, true, 1, null, 1);
          else { ctx.fillStyle = '#888'; ctx.font = '800 26px ' + CFONT; ctx.textAlign = 'center'; ctx.fillText('?', 36, 46); }
        }
      } else if (screen === 'home') drawParade();
      else if (screen === 'collection' && now() - lastSlow > 90) { lastSlow = now(); drawCollection(); }
      updateHand();
    } catch (err) { console.error(err); }
    requestAnimationFrame(loop);
  }

  // ================= BOOT =================
  async function boot() {
    loadSave(); applySettings();
    // canvas text never triggers webfont loading by itself; request the weights the board uses (Vietnamese subset included)
    const fontsReady = document.fonts ? Promise.all(['500', '700', '800'].map(w => document.fonts.load(`${w} 12px 'Be Vietnam Pro'`, 'ẮẶỊỄĐ'))).catch(() => {}) : null;
    await preload();
    if (fontsReady) await Promise.race([fontsReady, new Promise(r => setTimeout(r, 1500))]);
    $('#load-txt').textContent = 'Sẵn sàng!';
    show('home');
    requestAnimationFrame(loop);
    // dev hook for automated checks
    window.__FP = { G, SIM: S, startLevel, execute, LEVELS, get EX() { return EX; }, SAVE: () => SAVE };
  }
  boot();
})();
