/* Cable Grid Sort — presentation, input, feedback. Rules live in engine.js. */
(function () {
  'use strict';
  const E = window.CableEngine, LEVELS = window.CABLE_LEVELS, SOL = window.CABLE_SOLUTIONS || {};
  const CELL = 64, OX = 56, OY = 30;
  const cxOf = i => OX + CELL * E.col(i) + CELL / 2;
  const cyOf = i => OY + CELL * E.row(i) + CELL / 2;
  const $ = id => document.getElementById(id);
  const svg = $('board');
  const NS = 'http://www.w3.org/2000/svg';

  const REASONS = {
    'too-long': 'Dây không đủ dài',
    'occupied': 'Cổng đã có đầu dây',
    'region-locked': 'Cổng này đang bị khóa',
    'region-locked-from': 'Đầu dây nằm trong vùng đang khóa',
    'broken': 'Cổng hỏng — không cắm được',
    'same': 'Đầu dây đang ở cổng này',
  };

  /* ---------- storage (best effort) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('cgs.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cgs.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };

  /* ---------- audio ---------- */
  const AU = {
    ctx: null, on: store.get('sound', true),
    init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    tone(f, dur, type, vol, delay, slide) {
      if (!this.on || !this.ctx) return;
      const t = this.ctx.currentTime + (delay || 0);
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.08, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02);
    },
    pick() { this.tone(620, 0.05, 'triangle', 0.05); },
    place() { this.tone(240, 0.05, 'square', 0.035); this.tone(1800, 0.02, 'square', 0.02, 0.01); },
    click() { this.tone(2400, 0.025, 'square', 0.05); this.tone(1200, 0.06, 'triangle', 0.06, 0.02); this.tone(1760, 0.12, 'sine', 0.05, 0.07); },
    error() { this.tone(150, 0.14, 'sawtooth', 0.035); },
    tense() { this.tone(900, 0.05, 'sine', 0.025); },
    unlock() { this.tone(300, 0.35, 'triangle', 0.06, 0, 900); this.tone(1200, 0.15, 'sine', 0.04, 0.3); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.06, i * 0.09)); },
  };

  /* ---------- game state ---------- */
  const G = {
    li: 0, lv: null, st: null, a: null, hist: [], moves: 0,
    sel: -1,             // selected plug index k (2*cable+end)
    drag: null,          // {k, sx, sy, x, y, active}
    anim: null,          // {k, fx, fy, t0, dur}
    fx: [],              // visual effects
    hidden: { regions: new Set(), cables: new Set() }, // unlocks not yet presented
    busy: false, hint: null, won: false, dirty: true, handShown: false,
  };
  const done = new Set(store.get('done', []));
  const seenIntro = new Set(store.get('intros', []));

  /** Shows mechanic cards. single = one card with big art; list = all rules met so far. */
  function showIntro(list, asList) {
    const M = window.CGS_MECH;
    const card = it => `<div class="mech"><div class="mech-art">${M.art(it.art)}</div><h3>${it.title}</h3><ul>${it.lines.map(l => '<li>' + l + '</li>').join('')}</ul></div>`;
    $('intro-title').textContent = asList ? 'Luật chơi' : 'Cơ chế mới';
    const L = LEVELS[G.li];
    const lvTip = asList && L ? `<div class="mech"><h3>Level ${L.id}: ${esc(L.name)}</h3><ul><li>${esc(L.tip)}</li></ul></div>` : '';
    $('intro-body').innerHTML = lvTip + list.map(card).join('') + (asList ? `<div class="mech"><div class="mech-art">${M.COMPLETE_ART()}</div><h3>Đèn LED trên cổng</h3><ul><li>Xanh = dây đúng cặp và không giao.</li><li>Vàng = đúng cặp nhưng còn giao nhau.</li></ul></div>` : '');
    $('intro').classList.toggle('list', !!asList);
    $('intro').hidden = false;
    list.forEach(it => seenIntro.add(it.id)); store.set('intros', [...seenIntro]);
  }

  function loadLevel(li) {
    G.li = li; G.lv = E.compile(LEVELS[li]); G.st = G.lv.initial; G.hist = []; G.moves = 0;
    G.sel = -1; G.drag = null; G.anim = null; G.fx = []; G.busy = false; G.hint = null; G.won = false;
    G.hidden = { regions: new Set(), cables: new Set() };
    G.handShown = !!LEVELS[li].hand && !store.get('handDone', false);
    G.a = E.analyze(G.lv, G.st);
    store.set('last', li);
    $('lv-num').textContent = `LEVEL ${LEVELS[li].id}`;
    $('lv-name').textContent = LEVELS[li].name;
    $('tip-lesson').textContent = LEVELS[li].lesson;
    $('tip-text').textContent = LEVELS[li].tip;
    $('tip').classList.remove('open'); markTipClamp();
    $('win').hidden = true;
    updateHud(); G.dirty = true;
    const M = window.CGS_MECH, fresh = [];
    const intro = M && M.INTROS[LEVELS[li].id];
    if (M && (LEVELS[li].broken || []).length && !seenIntro.has(M.BROKEN_INTRO.id)) fresh.push(M.BROKEN_INTRO);
    if (intro && !seenIntro.has(intro.id)) fresh.push(intro);
    if (fresh.length) showIntro(fresh, false);
  }

  // The level tip is clamped to 2 lines; show a ▾ cue when text is cut, tap toggles the full text.
  function markTipClamp() {
    const t = $('tip');
    t.classList.toggle('clamped', !t.classList.contains('open') && t.scrollHeight > t.clientHeight + 2);
  }

  /* ---------- helpers ---------- */
  const cableOf = k => G.lv.cables[k >> 1];
  const isActive = i => !!(G.a.active & (1 << i)) && !G.hidden.cables.has(i);
  const regionOpenShown = r => G.a.regionsOpen[r] && !G.hidden.regions.has(r);
  function visibleLockedCells() {
    const s = new Set();
    G.lv.regions.forEach((r, ri) => { if (!regionOpenShown(ri)) r.cells.forEach(c => s.add(c)); });
    return s;
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const m = v => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
    return `rgb(${m(r)},${m(g)},${m(b)})`;
  }
  const colorHex = c => E.COLORS[c.color].hex;
  function plugXY(k) {
    if (G.drag && G.drag.active && G.drag.k === k) return [G.drag.x, G.drag.y];
    const p = G.st.pos[k], x = cxOf(p), y = cyOf(p);
    if (G.anim && G.anim.k === k) {
      const t = Math.min(1, (performance.now() - G.anim.t0) / G.anim.dur), e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const arc = G.anim.arc ? Math.sin(Math.PI * t) * G.anim.arc : 0;
      return [G.anim.fx + (x - G.anim.fx) * e, G.anim.fy + (y - G.anim.fy) * e - arc];
    }
    return [x, y];
  }
  function lift(k) {
    if (G.drag && G.drag.active && G.drag.k === k) return 1.12;
    if (G.anim && G.anim.k === k) { const t = Math.min(1, (performance.now() - G.anim.t0) / G.anim.dur); return 1 + 0.12 * Math.sin(Math.PI * t); }
    return G.sel === k ? 1.06 : 1;
  }
  function cableMid(x1, y1, x2, y2, len) {
    const d = Math.hypot(x2 - x1, y2 - y1) / CELL, slack = Math.max(0, 1 - d / len);
    const horiz = Math.abs(x2 - x1) / Math.max(1, Math.hypot(x2 - x1, y2 - y1));
    const sag = Math.min(9, slack * 16) * horiz;
    return [(x1 + x2) / 2, (y1 + y2) / 2 + sag]; // point at t = 0.5 of the quadratic drawn by cablePath
  }
  function cablePath(x1, y1, x2, y2, len) {
    const d = Math.hypot(x2 - x1, y2 - y1) / CELL;
    const slack = Math.max(0, 1 - d / len);
    // sag stays small so the drawn cable always hugs the logical straight line used for crossings
    const horiz = Math.abs(x2 - x1) / Math.max(1, Math.hypot(x2 - x1, y2 - y1));
    const sag = Math.min(9, slack * 16) * horiz;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + sag * 2;
    return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  /* ---------- render ---------- */
  // Cables leave the plug from its boot, ADY below the port centre. Every cable end is shifted by the same
  // vector, so the drawn picture is an exact translation of the logical lines: crossings look where they are.
  const ADY = 22;
  const W = 404, H = 476;
  const DEFS = `<defs>
    <linearGradient id="frame" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa2b2"/><stop offset=".12" stop-color="#cfd5df"/><stop offset=".5" stop-color="#c3c9d4"/><stop offset=".88" stop-color="#cfd5df"/><stop offset="1" stop-color="#8f97a7"/></linearGradient>
    <linearGradient id="plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7dce5"/><stop offset="1" stop-color="#aab1be"/></linearGradient>
    <linearGradient id="shelf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d95a5"/><stop offset=".1" stop-color="#7d8596"/><stop offset="1" stop-color="#6c7485"/></linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="head" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".6" stop-color="#d6ecff" stop-opacity=".85"/><stop offset="1" stop-color="#a9cdf0" stop-opacity=".9"/></linearGradient>
    <pattern id="hazard" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="#232833"/><rect width="7" height="14" fill="#ffc21a"/></pattern>
    <pattern id="slats" width="8" height="9" patternUnits="userSpaceOnUse"><rect width="8" height="9" fill="rgba(16,22,38,.56)"/><rect y="0" width="8" height="1.6" fill="rgba(255,255,255,.13)"/><rect y="7.4" width="8" height="1.6" fill="rgba(0,0,0,.22)"/></pattern>
    <linearGradient id="glare" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".32" stop-color="#fff" stop-opacity=".04"/><stop offset=".33" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3e8f0"/><stop offset=".5" stop-color="#a9b2c2"/><stop offset="1" stop-color="#7c8596"/></linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="2.2" flood-color="#1d2433" flood-opacity=".45"/></filter>
    <clipPath id="gridclip"><rect x="${OX - 4}" y="${OY - 4}" width="${CELL * 5 + 8}" height="${CELL * 6 + 8}" rx="10"/></clipPath>
  </defs>`;

  function renderCabinet(now) {
    const winFx = G.fx.find(f => f.type === 'win');
    let s = `<rect x="34" y="${H - 22}" width="54" height="18" rx="5" fill="#7b8394"/><rect x="${W - 88}" y="${H - 22}" width="54" height="18" rx="5" fill="#7b8394"/>
      <rect x="2" y="2" width="${W - 4}" height="${H - 18}" rx="18" fill="url(#frame)" stroke="#6f7787" stroke-width="2"/>
      <rect x="6" y="5" width="${W - 12}" height="${H - 26}" rx="15" fill="none" stroke="rgba(255,255,255,.6)"/>
      <rect x="14" y="20" width="${W - 28}" height="${H - 52}" rx="8" fill="#3d4453"/>
      <rect x="14" y="12" width="${W - 28}" height="14" rx="5" fill="url(#plate)"/>`;
    // side rails with holes
    for (const rx of [16, W - 26]) {
      s += `<rect x="${rx}" y="26" width="10" height="${H - 64}" fill="#565e6e"/>`;
      for (let y = 32; y < H - 44; y += 12) s += `<rect x="${rx + 3}" y="${y}" width="4" height="6" rx="1" fill="#2c323d"/>`;
    }
    // shelves + LED strips
    for (let r = 0; r < 6; r++) {
      const y = OY + CELL * r;
      s += `<rect x="30" y="${y + 3}" width="${W - 60}" height="${CELL - 6}" rx="9" fill="url(#shelf)" stroke="#565d6c"/>
        <rect x="33" y="${y + 5}" width="${W - 66}" height="3" rx="1.5" fill="#fff" opacity=".22"/>
        <rect x="36" y="${y + 12}" width="14" height="${CELL - 24}" rx="5" fill="#2f3542" stroke="#232833"/>`;
      // LED strip: green when the row's plugs are all part of complete cables
      let rowOk = true, rowHas = false;
      for (let c = 0; c < 5; c++) { const k = occAt(E.cell(c, r)); if (k >= 0) { rowHas = true; if (!G.a.complete[k >> 1]) rowOk = false; } }
      let on = rowHas && rowOk;
      if (winFx) on = Math.floor((now - winFx.t0) / 160 + r) % 2 === 0;
      for (let d = 0; d < 3; d++) s += `<circle cx="43" cy="${y + 20 + d * 12}" r="3.6" fill="${on ? '#5cff6a' : '#3e7a49'}" ${on ? 'filter="url(#glow)"' : ''}/>`;
    }
    // bottom vent plate
    const vy = OY + CELL * 6 + 4;
    s += `<rect x="30" y="${vy}" width="${W - 60}" height="${H - 34 - vy}" rx="6" fill="#565d6c"/>`;
    for (let x = 40; x < W - 50; x += 26) s += `<rect x="${x}" y="${vy + 6}" width="20" height="4" rx="2" fill="#2c323d"/><rect x="${x}" y="${vy + 14}" width="20" height="4" rx="2" fill="#2c323d"/>`;
    for (const [x, y] of [[14, 14], [W - 14, 14], [14, H - 30], [W - 14, H - 30]]) s += `<circle cx="${x}" cy="${y}" r="5" fill="#c5cbd5" stroke="#6f7787" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="1.6" fill="#6f7787"/>`;
    return s;
  }

  let occCache = null;
  function occAt(p) { if (!occCache) { occCache = new Map(); for (let k = 0; k < G.st.pos.length; k++) occCache.set(G.st.pos[k], k); } const v = occCache.get(p); return v == null ? -1 : v; }

  function renderPorts() {
    const lv = G.lv, a = G.a, locked = visibleLockedCells();
    const tOwner = new Map();
    lv.cables.forEach((c, i) => { if (c.secret && !isActive(i)) return; c.targets.forEach(t => tOwner.set(t, i)); });
    let s = '';
    for (let p = 0; p < 30; p++) {
      const x = cxOf(p), y = cyOf(p);
      const ti = tOwner.get(p);
      const broken = lv.broken.has(p);
      const c = ti != null ? lv.cables[ti] : null;
      const dim = c && !isActive(ti);
      const base = broken ? '#6b7280' : c ? colorHex(c) : '#b3bac7';
      s += `<g ${dim ? 'opacity=".6"' : ''}><rect x="${x - 24}" y="${y - 21}" width="48" height="41" rx="9" fill="${base}" stroke="${shade(base, -0.38)}" stroke-width="2" ${dim ? 'stroke-dasharray="5 3"' : ''}/>
        <rect x="${x - 21}" y="${y - 19}" width="42" height="15" rx="7" fill="url(#gloss)"/>
        <rect x="${x - 15}" y="${y - 12}" width="30" height="22" rx="3" fill="${shade(base, -0.72)}"/>
        <rect x="${x - 15}" y="${y - 12}" width="30" height="5" rx="2" fill="#000" opacity=".25"/>`;
      for (let j = 0; j < 7; j++) s += `<rect x="${x - 10.5 + j * 3.3}" y="${y + 3}" width="1.7" height="5" fill="#e0b54a"/>`;
      s += `</g>`;
      if (broken) s += `<path d="M${x - 9},${y - 7} L${x + 9},${y + 7} M${x + 9},${y - 7} L${x - 9},${y + 7}" stroke="#ff4d4d" stroke-width="3.5" stroke-linecap="round"/>`;
      // LED on the bezel: green = complete, amber = right pair but still crossing
      const k = occAt(p);
      if (k >= 0) {
        const i = k >> 1;
        if (a.complete[i]) s += `<circle cx="${x + 18}" cy="${y - 15}" r="3.3" fill="#5cff6a" stroke="#1d6b2a" filter="url(#glow)"/>`;
        else if (a.correct[i]) s += `<circle cx="${x + 18}" cy="${y - 15}" r="3.3" fill="#ffb020" stroke="#7a4b00" filter="url(#glow)"/>`;
      }
      if (c) s += `<g ${dim ? 'opacity=".6"' : ''}><circle cx="${x + 21}" cy="${y + 17}" r="8.5" fill="#fff" stroke="${shade(colorHex(c), -0.3)}" stroke-width="2"/>
          <text x="${x + 21}" y="${y + 20.6}" font-size="10" text-anchor="middle" fill="${shade(colorHex(c), -0.25)}" font-weight="900">${c.sym}</text></g>`;
    }
    return s;
  }

  // Small vector padlock (emoji render differently per device). y = centre of the body.
  function padlock(x, y, sc, col) {
    col = col || '#f5b400';
    return `<g transform="translate(${x},${y}) scale(${sc})"><path d="M-4.6,-2 V-5.4 A4.6,4.6 0 0 1 4.6,-5.4 V-2" fill="none" stroke="#5b6476" stroke-width="2.4"/>
      <rect x="-7" y="-2.4" width="14" height="10.4" rx="2.4" fill="${col}" stroke="${shade(col, -0.45)}" stroke-width="1.2"/>
      <circle cy="2" r="1.6" fill="${shade(col, -0.6)}"/><rect x="-.7" y="2.4" width="1.4" height="3" fill="${shade(col, -0.6)}"/></g>`;
  }
  // Locked region = tinted glass roller shutter drawn OVER ports, cables and plugs inside it (still readable,
  // clearly not touchable). Hazard-striped frame, steel handle bar on the side it rolls towards, lock tag on
  // the outer edge so it never hides a port. Unlock: the shutter rolls away off the board.
  function renderRegions(now) {
    let s = '';
    G.lv.regions.forEach((r, ri) => {
      const retract = G.fx.find(f => f.type === 'retract' && f.region === ri);
      if (regionOpenShown(ri) && !retract) return;
      const cs = r.cells.map(E.col), rs = r.cells.map(E.row);
      const r0 = Math.min(...rs), r1 = Math.max(...rs);
      const x0 = OX + CELL * Math.min(...cs) - 5, y0 = OY + CELL * r0 + 1;
      const w = CELL * (Math.max(...cs) - Math.min(...cs) + 1) + 10, h0 = CELL * (r1 - r0 + 1) - 2;
      const down = r1 === 5 && r0 > 0; // bottom regions roll down into the vent, others roll up
      let t = 0;
      if (retract) { const u = Math.min(1, (now - retract.t0) / retract.dur); t = u * u * (3 - 2 * u); }
      const h = Math.max(0, h0 * (1 - t)), y = down ? y0 + h0 - h : y0;
      const id = `rg${ri}`;
      s += `<g opacity="${(1 - t * 0.3).toFixed(3)}" pointer-events="none"><clipPath id="${id}"><rect x="${x0}" y="${y}" width="${w}" height="${h}" rx="11"/></clipPath>
        <g clip-path="url(#${id})"><rect x="${x0}" y="${y0}" width="${w}" height="${h0}" fill="url(#slats)"/>
        <rect x="${x0}" y="${y0}" width="${w}" height="${h0}" fill="url(#glare)"/></g>`;
      if (h > 6) s += `<rect x="${x0 + 2.5}" y="${y + 2.5}" width="${w - 5}" height="${h - 5}" rx="9" fill="none" stroke="url(#hazard)" stroke-width="5"/>
        <rect x="${x0 + .5}" y="${y + .5}" width="${w - 1}" height="${h - 1}" rx="11" fill="none" stroke="#1d2330" stroke-opacity=".7" stroke-width="1"/>`;
      // handle bar on the leading edge
      const by = down ? y - 3 : y + h - 6;
      if (h > 4) s += `<rect x="${x0 + 12}" y="${by}" width="${w - 24}" height="9" rx="4.5" fill="url(#bar)" stroke="#59606f" stroke-width="1.2"/>
        <rect x="${x0 + w / 2 - 16}" y="${by + 2.5}" width="32" height="4" rx="2" fill="#59606f"/>`;
      s += `</g>`;
      if (!retract) s += lockTag(r, x0 + w / 2, down ? y0 + h0 + 2 : r0 === 0 ? y0 - 2 : y0 + h0 / 2);
    });
    return s;
  }
  // Lock tag: padlock disc + white pill with one chip per condition part (colour dot + v/n), VÀ / HOẶC between.
  function lockTag(r, cx, cy) {
    const parts = E.condProgress(G.lv, r.lock, G.st.rec);
    const items = parts.map(p => ({ p, txt: p.kind === 'total' ? `${p.v}/${p.n} dây` : `${p.v}/${p.n}` }));
    items.forEach(it => { it.w = (it.p.kind === 'color' ? 13 : 0) + it.txt.length * 7 + 16; });
    const opTxt = r.lock.op === 'all' ? 'VÀ' : 'HOẶC', opW = opTxt.length * 7.5 + 8;
    const inner = items.reduce((a, it) => a + it.w, 0) + opW * (items.length - 1);
    const W = inner + 38, x = cx - W / 2;
    let s = `<g filter="url(#soft)" pointer-events="none"><rect x="${x}" y="${cy - 14}" width="${W}" height="28" rx="14" fill="#fff" stroke="#f5b400" stroke-width="2.5"/>
      <circle cx="${x + 15}" cy="${cy}" r="10.5" fill="#fff4cc" stroke="#f5b400" stroke-width="1.5"/>${padlock(x + 15, cy + 1.5, 0.95)}`;
    let px = x + 31;
    items.forEach((it, n) => {
      if (n) { s += `<text x="${px + opW / 2 - 2}" y="${cy + 4}" font-size="10" text-anchor="middle" fill="#b45309" font-weight="900">${opTxt}</text>`; px += opW; }
      const met = it.p.v >= it.p.n;
      s += `<rect x="${px}" y="${cy - 9}" width="${it.w - 4}" height="18" rx="9" fill="${met ? '#effff3' : '#fff8e1'}" stroke="${met ? '#4ade80' : '#e5c56a'}" stroke-width="1.4"/>`;
      let tx = px + 7;
      if (it.p.kind === 'color') { s += `<circle cx="${tx + 4}" cy="${cy}" r="5" fill="${E.COLORS[it.p.color].hex}" stroke="rgba(0,0,0,.3)" stroke-width="1.2"/>`; tx += 13; }
      s += `<text x="${tx}" y="${cy + 4}" font-size="11.5" fill="${met ? '#15803d' : '#5b4300'}" font-weight="900">${it.txt}</text>`;
      px += it.w;
    });
    return s + '</g>';
  }

  function cableStrokes(path, col, sel, act, overLen) {
    const main = overLen ? '#ff3b3b' : col;
    const op = act ? 1 : .45;
    return `<g opacity="${op}">
      <path d="${path}" fill="none" stroke="#141a26" stroke-opacity=".28" stroke-width="17" stroke-linecap="round" transform="translate(0,3)"/>
      <path d="${path}" fill="none" stroke="${shade(main, -0.35)}" stroke-width="${sel ? 17 : 15.5}" stroke-linecap="round" ${act ? '' : 'stroke-dasharray="8 7"'}/>
      <path d="${path}" fill="none" stroke="${main}" stroke-width="${sel ? 13 : 11.5}" stroke-linecap="round" ${act ? '' : 'stroke-dasharray="8 7"'}/>
      <path d="${path}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3.4" stroke-linecap="round" transform="translate(-1.6,-2.2)"/></g>`;
  }

  function renderCables(now) {
    const lv = G.lv, a = G.a;
    let under = '', over = '';
    const selCable = G.sel >= 0 ? G.sel >> 1 : -1;
    const crossSel = selCable >= 0 ? a.conflictMask[selCable] : 0;
    const order = lv.cables.map((c, i) => i).filter(i => i !== selCable);
    if (selCable >= 0) order.push(selCable);
    for (const i of order) {
      const c = lv.cables[i], col = colorHex(c), act = isActive(i);
      if (c.secret && !act) continue; // body concealed until unlocked
      const [px1, py1] = plugXY(2 * i), [px2, py2] = plugXY(2 * i + 1);
      const x1 = px1, y1 = py1 + ADY, x2 = px2, y2 = py2 + ADY;
      const d = Math.hypot(x2 - x1, y2 - y1) / CELL;
      const sel = i === selCable, crossing = !!(crossSel & (1 << i));
      const path = cablePath(x1, y1, x2, y2, c.len);
      let g = '';
      if (crossing) g += `<path d="${path}" fill="none" stroke="#ff9a1f" stroke-width="20" stroke-linecap="round" opacity=".5" filter="url(#glow)"/>`;
      if (sel) g += `<path d="${path}" fill="none" stroke="#7dd3fc" stroke-width="20" stroke-linecap="round" opacity=".55" filter="url(#glow)"/>`;
      g += cableStrokes(path, col, sel, act, d > c.len + 1e-6);
      if (c.hidden && !(G.st.rec & (1 << i))) {
        // translucent sleeve hides the middle of the body
        g += `<path d="${path}" pathLength="100" fill="none" stroke="#8b93a3" stroke-opacity=".94" stroke-width="18" stroke-dasharray="0 17 66 17" stroke-linecap="round"/>`;
        g += `<path d="${path}" pathLength="100" fill="none" stroke="#c4cad4" stroke-opacity=".7" stroke-width="18" stroke-dasharray="0 19 1.5 4.5 1.5 4.5 1.5 4.5 1.5 4.5 1.5 4.5 1.5 4.5 1.5 4.5 1.5 4.5 1.5 4.5 1.5 4.5 1.5 26"/>`;
        if (sel) g += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="3" stroke-dasharray="6 5" class="spin-dash"/>`;
      }
      const pf = G.fx.find(f => f.type === 'pulse' && f.cable === i);
      if (pf) {
        const t = Math.max(0, Math.min(1, (now - pf.t0) / pf.dur));
        g += `<path d="${path}" pathLength="100" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-dasharray="14 200" stroke-dashoffset="${(14 - t * 114).toFixed(1)}" filter="url(#glow)"/>`;
      }
      const reveal = G.fx.find(f => f.type === 'reveal' && f.cable === i);
      if (reveal) { const t = Math.min(1, (now - reveal.t0) / reveal.dur); g = `<g opacity="${t}">${g}</g>`; }
      // colour + symbol on the cable body itself (spec §4), so same-colour cables are told apart anywhere
      if (Math.hypot(x2 - x1, y2 - y1) > 90) { // short cables: both boots already show the symbol
        const [mx, my] = cableMid(x1, y1, x2, y2, c.len), dk = shade(col, -0.35);
        g += `<g opacity="${act ? 1 : .55}"><circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="9.5" fill="#fff" stroke="${dk}" stroke-width="2.4"/>
          <text x="${mx.toFixed(1)}" y="${(my + 4).toFixed(1)}" font-size="11.5" text-anchor="middle" fill="${dk}" font-weight="900">${c.sym}</text></g>`;
      }
      if (sel) over += g; else under += g;
    }
    return { under, over };
  }

  const pr0 = c => (c.lock ? c.lock.items.length : 0);
  function renderPlug(k, now) {
    const i = k >> 1, c = G.lv.cables[i], act = isActive(i);
    const [x, y] = plugXY(k), sc = lift(k);
    const secretLocked = c.secret && !act;
    const col = secretLocked ? '#8a93a5' : colorHex(c);
    const sel = G.sel === k, partner = G.sel >= 0 && (G.sel ^ 1) === k;
    const other = G.st.pos[k ^ 1];
    const ratio = Math.hypot(x - cxOf(other), y - cyOf(other)) / CELL / c.len;
    const taut = act && ratio > 0.92;
    const shake = G.fx.find(f => f.type === 'shake' && f.k === k);
    let dx = 0; if (shake) { const t = (now - shake.t0) / shake.dur; dx = Math.sin(t * Math.PI * 6) * 3 * (1 - t); }
    let s = '';
    if (sel) s += `<rect x="${x - 28}" y="${y - 25}" width="56" height="50" rx="12" fill="rgba(56,189,248,.18)" stroke="#38bdf8" stroke-width="3" filter="url(#glow)"/>`;
    if (partner) s += `<rect x="${x - 28}" y="${y - 25}" width="56" height="50" rx="12" fill="none" stroke="${col}" stroke-width="3" class="blink"/>`;
    s += `<g transform="translate(${(x + dx).toFixed(1)},${y.toFixed(1)}) scale(${sc.toFixed(3)})" ${partner ? 'class="blink"' : ''} ${sc > 1.01 ? 'filter="url(#soft)"' : ''}>`;
    // clear RJ45 head sitting in the jack
    s += `<rect x="-12" y="-13" width="24" height="17" rx="2.5" fill="url(#head)" stroke="#7aa6cf" stroke-width="1.2"/>`;
    for (let j = 0; j < 6; j++) s += `<rect x="${-8.6 + j * 3.3}" y="-12" width="1.6" height="6" fill="#d9a93a"/>`;
    s += `<rect x="-5" y="-4" width="10" height="5" rx="1" fill="#fff" opacity=".7"/>`;
    // coloured boot
    s += `<path d="M-12.5,3 L12.5,3 L9.5,${ADY + 2} Q0,${ADY + 5} -9.5,${ADY + 2} Z" fill="${col}" stroke="${shade(col, -0.4)}" stroke-width="1.5"/>
      <path d="M-8,5 L-4,5 L-4.5,${ADY} L-7,${ADY - 1} Z" fill="#fff" opacity=".4"/>`;
    for (let j = 0; j < 3; j++) s += `<rect x="-8" y="${8 + j * 4}" width="16" height="1.3" fill="${shade(col, -0.3)}" opacity=".6"/>`;
    if (secretLocked) {
      s += `<circle cx="0" cy="13" r="7.6" fill="#e9edf3" stroke="#5c6474" stroke-width="1.6"/><text x="0" y="17" font-size="11" text-anchor="middle" fill="#5c6474" font-weight="900">?</text>`;
      if (pr0(c) !== 1) s += `<g transform="translate(-15,-15)"><circle r="8" fill="#fff" stroke="#f5b400" stroke-width="1.6"/>${padlock(0, 1, .72)}</g>`;
    }
    else {
      s += `<circle cx="0" cy="13" r="7.6" fill="#fff" stroke="${shade(col, -0.4)}" stroke-width="1.6"/><text x="0" y="16.8" font-size="10.5" text-anchor="middle" fill="${shade(col, -0.4)}" font-weight="900">${c.sym}</text>`;
      if (!act && pr0(c) !== 1) s += `<g transform="translate(-15,-15)"><circle r="8" fill="#fff" stroke="#f5b400" stroke-width="1.6"/>${padlock(0, 1, .72)}</g>`;
    }
    // status badge: ✓ = complete, ! = right pair but still crossing
    if (act && G.a.complete[i]) s += `<g transform="translate(-16,-19)"><circle r="8" fill="#22b14c" stroke="#fff" stroke-width="1.8"/><text y="3.8" font-size="10.5" text-anchor="middle" fill="#fff" font-weight="900">✓</text></g>`;
    else if (act && G.a.correct[i]) s += `<g transform="translate(-16,-19)"><circle r="8" fill="#f97316" stroke="#fff" stroke-width="1.8"/><text y="4" font-size="11" text-anchor="middle" fill="#fff" font-weight="900">!</text></g>`;
    // length tag — always visible
    s += `<g transform="translate(16,-19)"><rect x="-9" y="-7.5" width="18" height="15" rx="7.5" fill="${taut ? '#ff8a00' : '#1f3a8a'}" stroke="#fff" stroke-width="1.6"/>
      <text y="4" font-size="10.5" text-anchor="middle" fill="#fff" font-weight="900">${c.len}</text></g>`;
    const pr = !act && c.lock ? E.condProgress(G.lv, c.lock, G.st.rec) : [];
    if (pr.length === 1) s += `<g transform="translate(-14,-19)"><rect x="-14" y="-7.5" width="28" height="15" rx="7.5" fill="#fff" stroke="#f5b400" stroke-width="1.6"/><text y="4" font-size="9.5" text-anchor="middle" fill="#6b4a00" font-weight="900">${pr[0].v}/${pr[0].n}</text></g>`;
    s += `</g>`;
    const reveal = G.fx.find(f => f.type === 'reveal' && f.cable === i);
    if (reveal) { const t = Math.min(1, (now - reveal.t0) / reveal.dur); s += `<circle cx="${x}" cy="${y}" r="${16 + 24 * t}" fill="none" stroke="#ffe066" stroke-width="${4 * (1 - t)}" opacity="${1 - t}"/>`; }
    return s;
  }

  // Selection cues never cover a port: everything is drawn as rings OUTSIDE the bezel or as labels,
  // so the colour of every port stays readable.
  let selTop = '';
  function renderSelection() {
    selTop = '';
    if (G.sel < 0 || G.busy) return '';
    const k = G.sel, c = cableOf(k), other = G.st.pos[k ^ 1], from = G.st.pos[k];
    const col = colorHex(c);
    const ox = cxOf(other), oy = cyOf(other), R = c.len * CELL;
    let s = `<g clip-path="url(#gridclip)" pointer-events="none">
      <circle cx="${ox}" cy="${oy}" r="${R}" fill="${col}" fill-opacity=".07"/>
      <circle cx="${ox}" cy="${oy}" r="${R}" fill="none" stroke="${shade(col, -0.25)}" stroke-width="4" stroke-opacity=".9"/>
      <circle cx="${ox}" cy="${oy}" r="${R}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="8 7" class="spin-dash"/></g>`;
    // "Tầm với" label at the circle edge that is inside the board
    const ang = [-Math.PI / 2, Math.PI / 2, Math.PI, 0, -Math.PI / 4, -3 * Math.PI / 4].find(a => {
      const lx = ox + Math.cos(a) * R, ly = oy + Math.sin(a) * R;
      return lx > OX + 30 && lx < OX + CELL * 5 - 30 && ly > OY + 12 && ly < OY + CELL * 6 - 12;
    });
    if (ang != null) {
      const lx = ox + Math.cos(ang) * R, ly = oy + Math.sin(ang) * R;
      s += `<g pointer-events="none"><rect x="${lx - 38}" y="${ly - 11}" width="76" height="22" rx="11" fill="${shade(col, -0.25)}" stroke="#fff" stroke-width="2"/>
        <text x="${lx}" y="${ly + 4.5}" font-size="11.5" text-anchor="middle" fill="#fff" font-weight="900">Tầm với ${c.len}</text></g>`;
    }
    // where this cable has to go: rings around its two target ports
    const ownCells = [G.st.pos[k], G.st.pos[k ^ 1]];
    const locked = visibleLockedCells();
    c.targets.forEach(t => {
      if (ownCells.includes(t)) return;
      const x = cxOf(t), y = cyOf(t), occ = E.occupant(G.st.pos, t);
      const reach = E.dist2(t, other) <= c.len2 + 1e-9;
      const state = occ >= 0 ? 'busy' : locked.has(t) ? 'locked' : reach ? 'ok' : 'far';
      const stroke = state === 'ok' ? shade(col, -0.2) : state === 'busy' ? '#f97316' : '#94a3b8';
      s += `<rect x="${x - 30}" y="${y - 27}" width="60" height="54" rx="14" fill="none" stroke="${stroke}" stroke-width="3.5" ${state === 'ok' ? 'class="pulse"' : 'stroke-dasharray="7 5"'}/>`;
      const tag = state === 'ok' ? '' : state === 'busy' ? 'Bị chiếm' : state === 'locked' ? 'Đang khóa' : 'Quá xa';
      if (tag) selTop += `<g><rect x="${x - 27}" y="${y - 37}" width="54" height="16" rx="8" fill="${stroke}" stroke="#fff" stroke-width="1.5"/><text x="${x}" y="${y - 25.5}" font-size="9.5" text-anchor="middle" fill="#fff" font-weight="900">${tag}</text></g>`;
    });
    return s;
  }

  // Live feedback while dragging: distance vs. length, and whether the port under the finger accepts the plug.
  function renderDragInfo() {
    if (!G.drag || !G.drag.active || G.busy) return '';
    const k = G.drag.k, c = cableOf(k), other = G.st.pos[k ^ 1];
    const cellU = cellAt(G.drag.x, G.drag.y);
    let s = '', dist, ok = null, why = '';
    if (cellU >= 0 && cellU !== G.st.pos[k]) {
      const err = E.moveError(G.lv, G.st, k, cellU);
      ok = !err; why = err ? (REASONS[err] || '') : '';
      dist = Math.sqrt(E.dist2(cellU, other));
      const x = cxOf(cellU), y = cyOf(cellU), col = ok ? '#22b14c' : '#ef4444';
      s += `<rect x="${x - 30}" y="${y - 27}" width="60" height="54" rx="14" fill="none" stroke="${col}" stroke-width="3.5"/>
        <circle cx="${x + 25}" cy="${y - 22}" r="10" fill="${col}" stroke="#fff" stroke-width="2"/><text x="${x + 25}" y="${y - 17.5}" font-size="12" text-anchor="middle" fill="#fff" font-weight="900">${ok ? '✓' : '✕'}</text>`;
    } else {
      dist = Math.hypot(G.drag.x - cxOf(other), G.drag.y - cyOf(other)) / CELL;
    }
    const over = dist > c.len + 1e-9;
    const txt = `${dist.toFixed(1)} / ${c.len}` + (ok === false && why && !over ? ` · ${why}` : '');
    const w = Math.max(70, txt.length * 6.4 + 18);
    const lx = Math.min(OX + CELL * 5 - w / 2, Math.max(OX + w / 2, G.drag.x)), ly = Math.max(OY + 6, G.drag.y - 46);
    s += `<g pointer-events="none"><rect x="${lx - w / 2}" y="${ly - 12}" width="${w}" height="24" rx="12" fill="${over ? '#ef4444' : '#1f3a8a'}" stroke="#fff" stroke-width="2"/>
      <text x="${lx}" y="${ly + 4.5}" font-size="12" text-anchor="middle" fill="#fff" font-weight="900">${esc(txt)}</text></g>`;
    return s;
  }

  function renderConflicts() {
    let s = '';
    const selCable = G.sel >= 0 ? G.sel >> 1 : -1;
    for (const cf of G.a.conflicts) {
      if (G.hidden.cables.has(cf.i) || G.hidden.cables.has(cf.j)) continue;
      const x = OX + CELL * cf.x + CELL / 2, y = OY + CELL * cf.y + CELL / 2 + ADY;
      const hot = cf.i === selCable || cf.j === selCable;
      const r = cf.type === 'plug' ? 15 : 10;
      s += `<g ${hot ? 'class="pulse"' : ''}><circle cx="${x}" cy="${y}" r="${r}" fill="#ff7a1a" fill-opacity=".85" stroke="#fff" stroke-width="2.2"/>
        <path d="M${x - 4},${y - 4} L${x + 4},${y + 4} M${x + 4},${y - 4} L${x - 4},${y + 4}" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></g>`;
    }
    return s;
  }

  function renderHint() {
    let s = '';
    if (G.hint && G.hint.k != null) {
      const [x, y] = plugXY(G.hint.k), tx = cxOf(G.hint.to), ty = cyOf(G.hint.to);
      s += `<rect x="${x - 29}" y="${y - 26}" width="58" height="52" rx="13" fill="none" stroke="#ffcc00" stroke-width="3.5" class="pulse"/>`;
      const ang = Math.atan2(ty - y, tx - x), mx = x + Math.cos(ang) * 30, my = y + Math.sin(ang) * 30, ex = tx - Math.cos(ang) * 14, ey = ty - Math.sin(ang) * 14;
      const head = `M${ex + Math.cos(ang) * 6},${ey + Math.sin(ang) * 6} l${Math.cos(ang + 2.5) * 12},${Math.sin(ang + 2.5) * 12} M${ex + Math.cos(ang) * 6},${ey + Math.sin(ang) * 6} l${Math.cos(ang - 2.5) * 12},${Math.sin(ang - 2.5) * 12}`;
      s += `<g stroke-linecap="round"><line x1="${mx}" y1="${my}" x2="${ex}" y2="${ey}" stroke="#fff" stroke-width="8"/><path d="${head}" stroke="#fff" stroke-width="8"/>
        <line x1="${mx}" y1="${my}" x2="${ex}" y2="${ey}" stroke="#ffb800" stroke-width="4.5"/><path d="${head}" stroke="#ffb800" stroke-width="4.5"/></g>`;
      s += `<rect x="${tx - 30}" y="${ty - 27}" width="60" height="54" rx="14" fill="none" stroke="#ffcc00" stroke-width="4" class="pulse"/>`;
    }
    if (G.handShown && G.moves === 0 && !G.drag) {
      const k = 0, ts = G.lv.cables[0].targets, to = E.dist2(G.st.pos[0], ts[0]) <= E.dist2(G.st.pos[0], ts[1]) ? ts[0] : ts[1];
      const x1 = cxOf(G.st.pos[k]) + 4, y1 = cyOf(G.st.pos[k]) + 30, x2 = cxOf(to) + 4, y2 = cyOf(to) + 30;
      s += `<g pointer-events="none"><text font-size="36" x="0" y="0" filter="url(#soft)">👆<animateTransform attributeName="transform" type="translate" values="${x1} ${y1};${x1} ${y1};${x2} ${y2};${x2} ${y2}" keyTimes="0;.3;.75;1" dur="1.8s" repeatCount="indefinite"/></text></g>`;
    }
    return s;
  }

  function render() {
    const now = performance.now();
    occCache = null;
    const { under, over } = renderCables(now);
    let plugs = '', selPlugs = '';
    for (let k = 0; k < G.st.pos.length; k++) {
      if (G.sel >= 0 && (k >> 1) === (G.sel >> 1)) selPlugs += renderPlug(k, now); else plugs += renderPlug(k, now);
    }
    svg.innerHTML = DEFS + renderCabinet(now) + renderPorts() + renderSelection() +
      under + plugs + renderConflicts() + renderRegions(now) + over + selPlugs + renderHint() + selTop + renderDragInfo();
  }

  function frame() {
    const now = performance.now();
    if (G.anim && now - G.anim.t0 > G.anim.dur) { G.anim = null; G.dirty = true; }
    const before = G.fx.length;
    G.fx = G.fx.filter(f => now - f.t0 < f.dur);
    if (G.fx.length !== before) G.dirty = true;
    if (G.dirty || G.anim || G.fx.length) { render(); G.dirty = false; }
    requestAnimationFrame(frame);
  }

  /* ---------- HUD ---------- */
  function lockGroups() {
    const lv = G.lv, groups = new Map();
    const add = (cond, what) => { const key = JSON.stringify(cond); if (!groups.has(key)) groups.set(key, { cond, whats: [] }); groups.get(key).whats.push(what); };
    lv.cables.forEach((c, i) => { if (c.lock) add(c.lock, { kind: 'cable', i }); });
    lv.regions.forEach((r, ri) => add(r.lock, { kind: 'region', ri }));
    return [...groups.values()];
  }
  function regionName(r) {
    const rows = [...new Set(r.cells.map(E.row))].sort((a, b) => a - b);
    return rows.length === 1 ? `hàng ${rows[0] + 1}` : `hàng ${rows[0] + 1}–${rows[rows.length - 1] + 1}`;
  }
  function updateHud() {
    const lv = G.lv, a = G.a;
    $('prog-val').textContent = `${a.nComplete}/${lv.n}`;
    const nx = a.conflicts.filter(cf => !G.hidden.cables.has(cf.i) && !G.hidden.cables.has(cf.j)).length;
    $('prog-cap').innerHTML = 'Dây đang hoàn thành' + (nx ? ` · <span class="xcount">✕ ${nx} chỗ giao nhau</span>` : '');
    $('prog-bar').style.width = Math.max(8, 100 * a.nComplete / lv.n) + '%';
    $('moves').textContent = G.moves;
    const box = $('locks');
    const html = lockGroups().map(g => {
      const isOpen = g.whats.every(w => w.kind === 'cable' ? isActive(w.i) : regionOpenShown(w.ri));
      const names = g.whats.map(w => {
        if (w.kind === 'region') return 'Vùng ' + regionName(lv.regions[w.ri]);
        const c = lv.cables[w.i];
        return c.secret && !isActive(w.i) ? 'Dây bí mật' : `${E.COLORS[c.color].name} ${c.sym}`;
      });
      const uniq = [...new Set(names)];
      const what = 'Mở ' + (uniq.length > 2 ? uniq.slice(0, 2).join(', ') + ` +${uniq.length - 2}` : uniq.join(', '));
      const parts = E.condProgress(lv, g.cond, G.st.rec).map(p => {
        const met = p.v >= p.n;
        const label = p.kind === 'total' ? `Hoàn thành ${p.n} dây: ${p.v}/${p.n}` : `${p.label} ${p.v}/${p.n}`;
        const dot = p.kind === 'color' ? `<i class="dot" style="background:${E.COLORS[p.color].hex}"></i>` : '';
        return `<span class="chip ${met ? 'met' : ''}">${dot}${label}</span>`;
      });
      const cond = isOpen ? '<span class="chip met">✓ Đã mở</span>' : parts.join(`<span class="op">${g.cond.op === 'all' ? 'VÀ' : 'HOẶC'}</span>`);
      return `<div class="lock ${isOpen ? 'open' : ''}"><span class="what">${isOpen ? '🔓' : '🔒'} ${esc(what)}</span><span class="cond">${cond}</span></div>`;
    }).join('');
    box.innerHTML = html;
    $('btn-undo').disabled = !G.hist.length;
    const stuck = !G.won && !G.busy && E.legalMoves(lv, G.st).length === 0;
    $('stuck').hidden = !stuck;
    if (stuck) { $('btn-undo').classList.add('nudge'); $('btn-restart').classList.add('nudge'); }
    else { $('btn-undo').classList.remove('nudge'); $('btn-restart').classList.remove('nudge'); }
  }

  let toastTimer = 0;
  function toast(msg, kind) {
    const t = $('toast'); t.textContent = msg; t.className = 'show ' + (kind || '');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = ''; }, 1700);
  }

  /* ---------- actions ---------- */
  function tryMove(k, to, fromXY) {
    if (G.busy || G.won) return false;
    const err = E.moveError(G.lv, G.st, k, to);
    if (err) {
      const msg = err === 'cable-locked' ? 'Dây chưa mở: ' + E.condText(G.lv, cableOf(k).lock, G.st.rec) : REASONS[err];
      toast(msg, 'bad'); AU.error();
      G.fx.push({ type: 'shake', k, t0: performance.now(), dur: 320 });
      if (fromXY) G.anim = { k, fx: fromXY[0], fy: fromXY[1], t0: performance.now(), dur: 160 };
      G.dirty = true;
      return false;
    }
    const before = G.st;
    const [fx, fy] = fromXY || [cxOf(G.st.pos[k]), cyOf(G.st.pos[k])];
    const out = E.applyMove(G.lv, G.st, k, to);
    G.hist.push(before);
    G.st = out.state; G.moves++; G.hint = null;
    if (G.handShown) { G.handShown = false; store.set('handDone', true); }
    const jump = Math.hypot(cxOf(to) - fx, cyOf(to) - fy) / CELL;
    G.anim = { k, fx, fy, t0: performance.now(), dur: fromXY ? 120 : Math.min(420, 160 + 70 * jump), arc: fromXY ? 0 : Math.min(34, 12 + 8 * jump) };
    AU.place();
    // tension warning
    const c = cableOf(k), d2 = E.dist2(G.st.pos[k], G.st.pos[k ^ 1]);
    if (d2 > (c.len * 0.92) ** 2 * 0.999 && d2 <= c.len2) { setTimeout(() => AU.tense(), 90); toast('Dây đang căng', 'info'); }
    G.a = E.analyze(G.lv, G.st);
    presentEvents(out.events);
    G.sel = k; // keep the moved plug selected for chains of steps
    G.dirty = true; updateHud();
    return true;
  }

  // Records are shown instantly; unlocks are presented one after another while input is held.
  function presentEvents(events) {
    const now = performance.now();
    events.filter(e => e.type === 'record').forEach((e, n) => {
      G.fx.push({ type: 'pulse', cable: e.cable, t0: now + 120 + n * 120, dur: 700 });
      setTimeout(() => AU.click(), 120 + n * 120);
    });
    if (events.some(e => e.type === 'record')) {
      const c = G.lv.cables[events.find(e => e.type === 'record').cable];
      toast(`✓ ${E.COLORS[c.color].name} ${c.sym} đã kết nối`, 'good');
    }
    const unlocks = events.filter(e => e.type !== 'record');
    if (!unlocks.length) { afterSettle(); return; }
    unlocks.forEach(e => e.type === 'unlockRegion' ? G.hidden.regions.add(e.region) : G.hidden.cables.add(e.cable));
    G.busy = true; G.sel = -1;
    unlocks.forEach((e, n) => setTimeout(() => {
      const t0 = performance.now();
      if (e.type === 'unlockRegion') {
        G.hidden.regions.delete(e.region);
        G.fx.push({ type: 'retract', region: e.region, t0, dur: 650 });
        toast(`🔓 Mở vùng ${regionName(G.lv.regions[e.region])}`, 'good');
      } else {
        G.hidden.cables.delete(e.cable);
        G.fx.push({ type: 'reveal', cable: e.cable, t0, dur: 600 });
        const c = G.lv.cables[e.cable];
        toast(`🔓 Mở dây ${E.COLORS[c.color].name} ${c.sym}`, 'good');
      }
      AU.unlock(); flashLocks(); G.dirty = true; updateHud();
      if (n === unlocks.length - 1) setTimeout(() => { G.busy = false; G.dirty = true; afterSettle(); }, 700);
    }, 450 + n * 900));
  }
  function flashLocks() { document.querySelectorAll('#locks .lock').forEach(el => { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }); }

  function afterSettle() {
    updateHud();
    if (G.a.win && !G.won) {
      G.won = true; G.sel = -1;
      G.fx.push({ type: 'win', t0: performance.now(), dur: 1400 });
      setTimeout(() => AU.win(), 250);
      done.add(LEVELS[G.li].id); store.set('done', [...done]);
      const best = SOL[LEVELS[G.li].id];
      const wonLv = G.lv;
      setTimeout(() => {
        if (!G.won || G.lv !== wonLv) return; // player already left or undid the win
        $('win-stats').textContent = `${G.moves} nước` + (best ? ` · lời giải ngắn nhất đã kiểm chứng: ${best.length} nước` : '');
        $('win-next').textContent = G.li < LEVELS.length - 1 ? 'Level tiếp ›' : 'Về Level 1';
        $('win').hidden = false;
      }, 1300);
    }
  }

  function undo() {
    if (!G.hist.length || G.busy) return;
    G.st = G.hist.pop(); G.moves = Math.max(0, G.moves - 1);
    G.a = E.analyze(G.lv, G.st); G.hint = null; G.won = false; G.anim = null;
    G.hidden = { regions: new Set(), cables: new Set() }; G.fx = [];
    $('win').hidden = true;
    G.dirty = true; updateHud(); AU.pick();
  }
  function restart() { if (G.busy) return; loadLevel(G.li); AU.pick(); toast('Bắt đầu lại level', 'info'); }

  function hint() {
    if (G.busy || G.won) return;
    const lv = G.lv;
    let res = E.solve(lv, G.st, { maxNodes: 4000, weight: 1 });
    if (!res.ok && res.reason === 'limit') res = E.solve(lv, G.st, { maxNodes: 12000, weight: 2.5 });
    if (res.ok && res.moves.length) {
      const m = res.moves[0];
      G.hint = { k: m.k, to: m.to }; G.sel = m.k;
      const c = cableOf(m.k);
      toast(`Gợi ý: dời ${E.COLORS[c.color].name} ${c.sym} sang ô sáng · còn ~${res.moves.length} nước`, 'info');
      G.dirty = true; return;
    }
    if (!res.ok && res.reason === 'unsolvable') {
      // fall back to the verified solution: find the latest point of our history that lies on it
      const back = stepsBackToSolution();
      toast(back > 0 ? `Bàn hiện tại không còn lời giải. Hoàn tác ${back} nước để quay lại hướng giải.` : 'Bàn hiện tại không còn lời giải — hãy Chơi lại.', 'bad');
      $('btn-undo').classList.add('nudge');
      return;
    }
    // search budget exceeded: use verified solution if we are on it
    const path = solutionStates();
    const key = E.stateKey(lv, G.st);
    const idx = path.findIndex(p => p.key === key);
    if (idx >= 0 && idx < path.length - 1) {
      const m = path[idx + 1].move; G.hint = { k: m.k, to: m.to }; G.sel = m.k; G.dirty = true;
      toast('Gợi ý theo lời giải đã kiểm chứng', 'info'); return;
    }
    const back = stepsBackToSolution();
    toast(`Hoàn tác ${back} nước để quay về lời giải đã kiểm chứng`, 'info');
    $('btn-undo').classList.add('nudge');
  }
  function solutionStates() {
    const lv = G.lv, sol = SOL[LEVELS[G.li].id] || [];
    let st = lv.initial; const out = [{ key: E.stateKey(lv, st), move: null }];
    for (const [k, to] of sol) {
      // the stored plug index may refer to the other end after canonical solving; resolve by cell
      const from = st.pos[k];
      st = E.applyMove(lv, st, k, to).state;
      out.push({ key: E.stateKey(lv, st), move: { k, to, from } });
    }
    return out;
  }
  function stepsBackToSolution() {
    const keys = new Set(solutionStates().map(p => p.key));
    for (let n = G.hist.length - 1; n >= 0; n--) if (keys.has(E.stateKey(G.lv, G.hist[n]))) return G.hist.length - n;
    return G.hist.length;
  }

  /* ---------- input ---------- */
  function svgPoint(ev) {
    const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse()); return [p.x, p.y];
  }
  function cellAt(x, y) {
    const c = Math.floor((x - OX) / CELL), r = Math.floor((y - OY) / CELL);
    if (c < 0 || c > 4 || r < 0 || r > 5) return -1;
    return E.cell(c, r);
  }
  function plugAt(x, y) {
    let best = -1, bd = 30;
    for (let k = 0; k < G.st.pos.length; k++) {
      const d = Math.hypot(x - cxOf(G.st.pos[k]), y - cyOf(G.st.pos[k]));
      if (d < bd || (d === bd && G.sel === k)) { bd = d; best = k; }
    }
    return best;
  }
  function explainPlug(k) {
    const i = k >> 1, c = G.lv.cables[i];
    if (!isActive(i)) { toast('🔒 ' + E.condText(G.lv, c.lock, G.st.rec), 'info'); AU.error(); return false; }
    if (visibleLockedCells().has(G.st.pos[k])) { toast(REASONS['region-locked-from'], 'bad'); AU.error(); return false; }
    return true;
  }

  svg.addEventListener('pointerdown', ev => {
    AU.init();
    if (G.busy || G.won) return;
    const [x, y] = svgPoint(ev);
    const k = plugAt(x, y);
    if (k >= 0) {
      if (!explainPlug(k)) { G.sel = -1; G.dirty = true; return; }
      svg.setPointerCapture(ev.pointerId);
      G.drag = { k, sx: x, sy: y, x, y, active: false, wasSel: G.sel === k };
      if (G.sel !== k) { G.sel = k; AU.pick(); }
      G.hint = G.hint && G.hint.k === k ? G.hint : null;
      G.dirty = true;
      return;
    }
    // tap on an empty cell while a plug is selected
    if (G.sel >= 0) {
      const to = cellAt(x, y);
      if (to >= 0 && to !== G.st.pos[G.sel] && E.occupant(G.st.pos, to) < 0) { tryMove(G.sel, to); return; }
    }
    G.sel = -1; G.dirty = true;
  });
  svg.addEventListener('pointermove', ev => {
    if (!G.drag) return;
    const [x, y] = svgPoint(ev);
    G.drag.x = x; G.drag.y = y;
    if (!G.drag.active && Math.hypot(x - G.drag.sx, y - G.drag.sy) > 8) G.drag.active = true;
    if (G.drag.active) G.dirty = true;
  });
  const endDrag = ev => {
    if (!G.drag) return;
    const d = G.drag; G.drag = null;
    if (d.active) {
      const to = cellAt(d.x, d.y), from = G.st.pos[d.k];
      if (to === from || to < 0) { G.anim = { k: d.k, fx: d.x, fy: d.y, t0: performance.now(), dur: 140 }; }
      else tryMove(d.k, to, [d.x, d.y]);
    } else if (d.wasSel && ev.type === 'pointerup') {
      G.sel = -1; // tap on the selected plug again toggles it off
    }
    G.dirty = true;
  };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  $('btn-undo').onclick = () => { AU.init(); undo(); };
  $('btn-restart').onclick = () => { AU.init(); restart(); };
  $('btn-hint').onclick = () => { AU.init(); toast('Đang tìm gợi ý…', 'info'); setTimeout(hint, 30); };
  $('btn-menu').onclick = () => { buildMenu(); $('menu').hidden = false; };
  $('btn-rules').onclick = () => {
    const M = window.CGS_MECH, ids = LEVELS.slice(0, G.li + 1).map(L => M.INTROS[L.id]).filter(Boolean);
    const firstBroken = LEVELS.findIndex(L => (L.broken || []).length);
    if (firstBroken >= 0 && firstBroken <= G.li) ids.splice(LEVELS.slice(0, firstBroken).filter(L => M.INTROS[L.id]).length, 0, M.BROKEN_INTRO);
    showIntro(ids, true);
  };
  $('tip').onclick = () => {
    const t = $('tip');
    if (!t.classList.contains('open') && !t.classList.contains('clamped')) return;
    t.classList.toggle('open'); markTipClamp();
  };
  window.addEventListener('resize', markTipClamp);
  $('intro-ok').onclick =() => { $('intro').hidden = true; };
  $('intro').onclick = e => { if (e.target.id === 'intro') $('intro').hidden = true; };
  $('menu-close').onclick = () => { $('menu').hidden = true; };
  $('menu').onclick = e => { if (e.target.id === 'menu') $('menu').hidden = true; };
  $('win-next').onclick = () => loadLevel((G.li + 1) % LEVELS.length);
  $('win-replay').onclick = () => loadLevel(G.li);
  $('opt-sound').checked = AU.on;
  $('opt-sound').onchange = e => { AU.on = e.target.checked; store.set('sound', AU.on); };
  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    else if (e.key === 'r' && !e.ctrlKey) restart();
    else if (e.key === 'h') hint();
    else if (e.key === 'Escape') { G.sel = -1; G.dirty = true; }
  });

  function buildMenu() {
    $('menu-grid').innerHTML = LEVELS.map((L, i) =>
      `<button class="lvbtn ${done.has(L.id) ? 'done' : ''} ${i === G.li ? 'cur' : ''}" data-i="${i}"><b>${L.id}. ${esc(L.name)}</b><span>${esc(L.lesson)}</span></button>`).join('');
    $('menu-grid').querySelectorAll('.lvbtn').forEach(b => b.onclick = () => { $('menu').hidden = true; loadLevel(+b.dataset.i); });
  }

  // debug / automation hook (used by the demo recorder and tests)
  window.CGS = {
    G, E, loadLevel, tryMove, undo, restart, hint,
    playSolution(stepMs) {
      const sol = SOL[LEVELS[G.li].id] || []; let n = 0;
      const step = () => { if (n >= sol.length) return; if (G.busy) return setTimeout(step, 120); const [k, to] = sol[n++]; G.sel = k; tryMove(k, to); setTimeout(step, stepMs || 300); };
      step();
    },
  };

  const params = new URLSearchParams(location.search);
  const startLv = params.has('level') ? Math.max(0, Math.min(LEVELS.length - 1, +params.get('level') - 1)) : store.get('last', 0);
  loadLevel(startLv);
  requestAnimationFrame(frame);
})();
