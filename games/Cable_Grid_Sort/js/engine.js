/* Cable Grid Sort — rules engine (no DOM). Shared by the game and the Node verifier.
 *
 * Grid: 5 columns x 6 rows. Cell index = row * 5 + col.
 * State = { pos: Int8Array(2 * cables), rec: bitmask of cables recorded as completed }.
 * Everything else (active cables, open regions, conflicts, completion) is derived from the state,
 * so Undo = restore an earlier state object, Restart = initial state.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CableEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const COLS = 5, ROWS = 6, CELLS = COLS * ROWS;
  const col = i => i % COLS;
  const row = i => (i / COLS) | 0;
  const cell = (c, r) => r * COLS + c;
  const dist2 = (a, b) => { const dx = col(a) - col(b), dy = row(a) - row(b); return dx * dx + dy * dy; };
  const manh = (a, b) => Math.abs(col(a) - col(b)) + Math.abs(row(a) - row(b));
  const NEIGHBORS = [];
  for (let i = 0; i < CELLS; i++) {
    const n = [];
    if (row(i) > 0) n.push(i - COLS);
    if (row(i) < ROWS - 1) n.push(i + COLS);
    if (col(i) > 0) n.push(i - 1);
    if (col(i) < COLS - 1) n.push(i + 1);
    NEIGHBORS.push(n);
  }

  const COLORS = {
    red:    { name: 'Đỏ',         hex: '#f23d3d' },
    blue:   { name: 'Xanh dương', hex: '#2f7bf6' },
    yellow: { name: 'Vàng',       hex: '#ffc61f' },
    green:  { name: 'Xanh lá',    hex: '#39c44a' },
    purple: { name: 'Tím',        hex: '#a74ff5' },
    cyan:   { name: 'Cyan',       hex: '#1ec8ea' },
    orange: { name: 'Cam',        hex: '#ff8a24' },
    pink:   { name: 'Hồng',       hex: '#f465b4' },
  };

  /* ---------- conditions ----------
   * Level files may write a lock as {total:2} | {color:'red', n:2} | {all:[...]} | {any:[...]}.
   * Normalized form: {op:'all'|'any', items:[{kind:'total', n} | {kind:'color', color, n}]}.
   */
  function normCond(c) {
    if (!c) return null;
    const item = x => (x.total != null ? { kind: 'total', n: x.total } : { kind: 'color', color: x.color, n: x.n });
    if (c.all) return { op: 'all', items: c.all.map(item) };
    if (c.any) return { op: 'any', items: c.any.map(item) };
    return { op: 'all', items: [item(c)] };
  }

  function condItemValue(lv, item, rec) {
    let v = 0;
    for (let i = 0; i < lv.cables.length; i++) {
      if (!(rec & (1 << i))) continue;
      if (item.kind === 'total' || lv.cables[i].color === item.color) v++;
    }
    return Math.min(v, item.n);
  }
  function condMet(lv, cond, rec) {
    if (!cond) return true;
    const ok = cond.items.map(it => condItemValue(lv, it, rec) >= it.n);
    return cond.op === 'all' ? ok.every(Boolean) : ok.some(Boolean);
  }
  /** Parts of a condition with live progress, e.g. [{label:'Đỏ', v:1, n:2}] */
  function condProgress(lv, cond, rec) {
    return cond.items.map(it => ({
      label: it.kind === 'total' ? 'Hoàn thành' : COLORS[it.color].name,
      kind: it.kind, color: it.color,
      v: condItemValue(lv, it, rec), n: it.n,
    }));
  }
  function condText(lv, cond, rec) {
    const parts = condProgress(lv, cond, rec).map(p =>
      p.kind === 'total' ? `Hoàn thành ${p.n} dây: ${p.v}/${p.n}` : `${p.label} ${p.v}/${p.n}`);
    return parts.join(cond.op === 'all' ? ' VÀ ' : ' HOẶC ');
  }

  /* ---------- level compile ---------- */
  function compile(def) {
    const P = ([c, r]) => cell(c, r);
    const cables = def.cables.map((c, i) => ({
      i, id: c.id, color: c.color, sym: c.sym, len: c.len, len2: c.len * c.len,
      start: [P(c.ends[0]), P(c.ends[1])],
      targets: [P(c.targets[0]), P(c.targets[1])],
      hidden: !!c.hidden,              // body under a translucent cover until recorded
      secret: !!c.secret,              // color/body concealed while locked
      lock: normCond(c.lock),
    }));
    const regions = (def.regions || []).map((r, i) => {
      let cells = [];
      if (r.rows) for (const rr of r.rows) for (let c = 0; c < COLS; c++) cells.push(cell(c, rr));
      if (r.rect) { const [c0, r0, c1, r1] = r.rect; for (let rr = r0; rr <= r1; rr++) for (let c = c0; c <= c1; c++) cells.push(cell(c, rr)); }
      if (r.cells) cells = cells.concat(r.cells.map(P));
      return { i, id: r.id || 'Z' + (i + 1), cells, set: new Set(cells), lock: normCond(r.lock) };
    });
    const broken = new Set((def.broken || []).map(P));
    const lv = { def, id: def.id, name: def.name, cables, regions, broken, n: cables.length };
    const pos = new Int8Array(cables.length * 2);
    cables.forEach((c, i) => { pos[2 * i] = c.start[0]; pos[2 * i + 1] = c.start[1]; });
    lv.initial = settle(lv, { pos, rec: 0 }).state;
    return lv;
  }

  /* ---------- derived state ---------- */
  function activeMask(lv, rec) {
    let m = 0;
    lv.cables.forEach((c, i) => { if (condMet(lv, c.lock, rec)) m |= 1 << i; });
    return m;
  }
  function openRegions(lv, rec) { return lv.regions.map(r => condMet(lv, r.lock, rec)); }
  function lockedCellSet(lv, rec) {
    const s = new Set();
    lv.regions.forEach(r => { if (!condMet(lv, r.lock, rec)) r.cells.forEach(x => s.add(x)); });
    return s;
  }

  // Exact integer segment geometry.
  function orient(ax, ay, bx, by, cx, cy) { const v = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); return v > 0 ? 1 : v < 0 ? -1 : 0; }
  function onSeg(ax, ay, bx, by, px, py) { return Math.min(ax, bx) <= px && px <= Math.max(ax, bx) && Math.min(ay, by) <= py && py <= Math.max(ay, by); }
  /** Returns null or {x,y,type} (grid coords) for two cable center lines. All plugs sit on distinct cells,
   *  so ANY contact is a conflict: proper crossing, collinear overlap, or one line running through a plug. */
  function segConflict(a1, a2, b1, b2) {
    const ax = col(a1), ay = row(a1), bx = col(a2), by = row(a2), cx = col(b1), cy = row(b1), dx = col(b2), dy = row(b2);
    const o1 = orient(ax, ay, bx, by, cx, cy), o2 = orient(ax, ay, bx, by, dx, dy);
    const o3 = orient(cx, cy, dx, dy, ax, ay), o4 = orient(cx, cy, dx, dy, bx, by);
    if (o1 && o2 && o3 && o4) {
      if (o1 !== o2 && o3 !== o4) {
        const den = (ax - bx) * (cy - dy) - (ay - by) * (cx - dx);
        const t = ((ax - cx) * (cy - dy) - (ay - cy) * (cx - dx)) / den;
        return { x: ax + t * (bx - ax), y: ay + t * (by - ay), type: 'cross' };
      }
      return null;
    }
    if (o1 === 0 && o2 === 0) { // collinear
      const pts = [];
      if (onSeg(ax, ay, bx, by, cx, cy)) pts.push([cx, cy]);
      if (onSeg(ax, ay, bx, by, dx, dy)) pts.push([dx, dy]);
      if (onSeg(cx, cy, dx, dy, ax, ay)) pts.push([ax, ay]);
      if (onSeg(cx, cy, dx, dy, bx, by)) pts.push([bx, by]);
      if (!pts.length) return null;
      const x = pts.reduce((s, p) => s + p[0], 0) / pts.length, y = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      return { x, y, type: 'overlap' };
    }
    if (o1 === 0 && onSeg(ax, ay, bx, by, cx, cy)) return { x: cx, y: cy, type: 'plug' };
    if (o2 === 0 && onSeg(ax, ay, bx, by, dx, dy)) return { x: dx, y: dy, type: 'plug' };
    if (o3 === 0 && onSeg(cx, cy, dx, dy, ax, ay)) return { x: ax, y: ay, type: 'plug' };
    if (o4 === 0 && onSeg(cx, cy, dx, dy, bx, by)) return { x: bx, y: by, type: 'plug' };
    return null;
  }

  function isCorrect(lv, pos, i) {
    const [t1, t2] = lv.cables[i].targets, a = pos[2 * i], b = pos[2 * i + 1];
    return (a === t1 && b === t2) || (a === t2 && b === t1);
  }

  /** Full analysis of a state. */
  function analyze(lv, st) {
    const n = lv.n, pos = st.pos;
    const active = activeMask(lv, st.rec);
    const conflicts = []; // {i,j,x,y,type}
    const conflictMask = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      if (!(active & (1 << i))) continue;
      for (let j = i + 1; j < n; j++) {
        if (!(active & (1 << j))) continue;
        const c = segConflict(pos[2 * i], pos[2 * i + 1], pos[2 * j], pos[2 * j + 1]);
        if (c) { conflicts.push({ i, j, ...c }); conflictMask[i] |= 1 << j; conflictMask[j] |= 1 << i; }
      }
    }
    const correct = [], complete = [];
    let nComplete = 0;
    for (let i = 0; i < n; i++) {
      const on = !!(active & (1 << i));
      correct[i] = on && isCorrect(lv, pos, i);
      complete[i] = correct[i] && conflictMask[i] === 0;
      if (complete[i]) nComplete++;
    }
    const regionsOpen = openRegions(lv, st.rec);
    const allActive = active === (1 << n) - 1;
    const win = allActive && regionsOpen.every(Boolean) && nComplete === n;
    return { active, conflicts, conflictMask, correct, complete, nComplete, regionsOpen, win };
  }

  /** Record completions and run the unlock cascade until stable.
   *  Returns {state, events:[{type:'record',cable}|{type:'unlockCable',cable}|{type:'unlockRegion',region}]} in order. */
  function settle(lv, st) {
    let rec = st.rec;
    const events = [];
    let prevActive = activeMask(lv, rec), prevOpen = openRegions(lv, rec);
    for (let guard = 0; guard < 64; guard++) {
      const a = analyze(lv, { pos: st.pos, rec });
      let changed = false;
      for (let i = 0; i < lv.n; i++) if (a.complete[i] && !(rec & (1 << i))) { rec |= 1 << i; events.push({ type: 'record', cable: i }); changed = true; }
      if (!changed) break;
      const act = activeMask(lv, rec), open = openRegions(lv, rec);
      // regions first (they free space), then cables, each in level order -> shown one after another
      open.forEach((o, r) => { if (o && !prevOpen[r]) events.push({ type: 'unlockRegion', region: r }); });
      for (let i = 0; i < lv.n; i++) if ((act & (1 << i)) && !(prevActive & (1 << i))) events.push({ type: 'unlockCable', cable: i });
      prevActive = act; prevOpen = open;
    }
    return { state: { pos: st.pos, rec }, events };
  }

  /* ---------- moves ---------- */
  function occupant(pos, c) { for (let k = 0; k < pos.length; k++) if (pos[k] === c) return k; return -1; }

  /** Why can plug k (= 2*cable + end) not go to cell `to`? null if legal. */
  function moveError(lv, st, k, to, locked) {
    const i = k >> 1, from = st.pos[k], other = st.pos[k ^ 1];
    locked = locked || lockedCellSet(lv, st.rec);
    if (!condMet(lv, lv.cables[i].lock, st.rec)) return 'cable-locked';
    if (locked.has(from)) return 'region-locked-from';
    if (to < 0 || to >= CELLS || to === from) return 'same';
    if (lv.broken.has(to)) return 'broken';
    if (locked.has(to)) return 'region-locked';
    if (occupant(st.pos, to) >= 0) return 'occupied';
    if (dist2(to, other) > lv.cables[i].len2 + 1e-9) return 'too-long';
    return null;
  }

  function legalMoves(lv, st) {
    const locked = lockedCellSet(lv, st.rec), out = [];
    const occ = new Set(st.pos);
    for (let i = 0; i < lv.n; i++) {
      if (!condMet(lv, lv.cables[i].lock, st.rec)) continue;
      for (let e = 0; e < 2; e++) {
        const k = 2 * i + e, from = st.pos[k], other = st.pos[k ^ 1];
        if (locked.has(from)) continue;
        for (let to = 0; to < CELLS; to++) {
          if (occ.has(to) || lv.broken.has(to) || locked.has(to)) continue;
          if (dist2(to, other) > lv.cables[i].len2 + 1e-9) continue;
          out.push({ k, from, to });
        }
      }
    }
    return out;
  }

  function applyMove(lv, st, k, to) {
    const pos = Int8Array.from(st.pos); pos[k] = to;
    return settle(lv, { pos, rec: st.rec });
  }

  function stateKey(lv, st) {
    // ends of a cable are interchangeable for every rule, so canonicalize them
    let s = '';
    for (let i = 0; i < lv.n; i++) {
      const a = st.pos[2 * i], b = st.pos[2 * i + 1];
      s += String.fromCharCode(48 + Math.min(a, b), 48 + Math.max(a, b));
    }
    return s + ':' + st.rec;
  }

  // A move pulls one plug and plugs it anywhere in reach, so each plug not on its target costs >= 1 move.
  // The tiny Manhattan term only breaks ties (total < 1, so A* stays optimal).
  function heuristic(lv, st) {
    let h = 0, tie = 0;
    for (let i = 0; i < lv.n; i++) {
      const [t1, t2] = lv.cables[i].targets, a = st.pos[2 * i], b = st.pos[2 * i + 1];
      h += Math.min((a !== t1) + (b !== t2), (a !== t2) + (b !== t1));
      tie += Math.min(manh(a, t1) + manh(b, t2), manh(a, t2) + manh(b, t1));
    }
    return h + tie / 1000;
  }

  /* ---------- solver: A* (weight 1 = optimal) ---------- */
  function solve(lv, start, opts) {
    opts = opts || {};
    const maxNodes = opts.maxNodes || 400000, w = opts.weight || 1;
    const heap = [];
    const less = (a, b) => a.f < b.f || (a.f === b.f && a.g > b.g);
    const push = (node) => {
      heap.push(node);
      let i = heap.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (!less(node, heap[p])) break; heap[i] = heap[p]; i = p; }
      heap[i] = node;
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        let i = 0; const n = heap.length;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          if (l >= n) break;
          const c = r < n && less(heap[r], heap[l]) ? r : l;
          if (!less(heap[c], last)) break;
          heap[i] = heap[c]; i = c;
        }
        heap[i] = last;
      }
      return top;
    };
    const seen = new Map();
    const k0 = stateKey(lv, start);
    seen.set(k0, 0);
    push({ st: start, g: 0, f: w * heuristic(lv, start), parent: null, move: null });
    let expanded = 0;
    while (heap.length) {
      const node = pop();
      if (analyze(lv, node.st).win) {
        const moves = [];
        for (let n = node; n.parent; n = n.parent) moves.push(n.move);
        moves.reverse();
        return { ok: true, moves, expanded };
      }
      if (++expanded > maxNodes) return { ok: false, reason: 'limit', expanded };
      const key = stateKey(lv, node.st);
      if (seen.get(key) < node.g) continue;
      const ana = opts.allowMove ? analyze(lv, node.st) : null;
      for (const m of legalMoves(lv, node.st)) {
        if (ana && !opts.allowMove(m, ana)) continue;
        const nxt = applyMove(lv, node.st, m.k, m.to).state;
        const nk = stateKey(lv, nxt), g = node.g + 1;
        const old = seen.get(nk);
        if (old !== undefined && old <= g) continue;
        seen.set(nk, g);
        push({ st: nxt, g, f: g + w * heuristic(lv, nxt), parent: node, move: m });
      }
    }
    return { ok: false, reason: 'unsolvable', expanded };
  }

  return {
    COLS, ROWS, CELLS, COLORS, NEIGHBORS, col, row, cell, dist2, manh,
    compile, analyze, settle, legalMoves, applyMove, moveError, lockedCellSet,
    condMet, condProgress, condText, activeMask, openRegions, stateKey, solve, heuristic, occupant,
  };
});
