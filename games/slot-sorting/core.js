/* Slot Sorting — core gameplay logic (no rendering).
 * Shared by index.html (browser) and tools/validate.js (Node).
 *
 * Grid: N reels (columns, 1..MAX_COLS) x R visible rows (level.rows, MIN_ROWS..MAX_ROWS = 3..9, default 3). Each column has one
 * container on top and one bin below, so N = number of colors.
 * The player drags each reel by hand to line up the pipes, then presses a
 * container drop button (see drop()).
 * Segment codes:
 *   'TB' 'LR'            straight
 *   'TR' 'TL' 'LB' 'RB'  elbow
 *   '~TB' '~LR'          S-curve (visual variant of straight)
 *   'X'                  cross (T<->B and L<->R independent)
 *   'LRB'                Y merge (L->B, R->B)
 *   'TLR<' 'TLR>'        T-junction split, from T goes to preferred side
 *   'TRB' 'TLB'          T-junction side-feed (T->B, side->B)
 *   'E'                  empty (blocks)
 * Ball enters a cell from T (falling), L (moving right) or R (moving left).
 * Balls never travel upward.
 */
(function (root) {
  'use strict';
  const OPP = { T: 'B', B: 'T', L: 'R', R: 'L' };
  const ROWS = 3, MIN_ROWS = 3, MAX_ROWS = 9, MIN_COLS = 1, MAX_COLS = 9; // ROWS = default visible rows
  /** The 9 colors, one per container. Key = code used in levels.js. */
  const COLORS = {
    R: { hex: 0xff2a2a, css: '#ff3b3b', name: 'red' },
    B: { hex: 0x1c66ff, css: '#2a76ff', name: 'blue' },
    Y: { hex: 0xffc40d, css: '#ffd21a', name: 'yellow' },
    G: { hex: 0x2fbf3a, css: '#3fcf4a', name: 'green' },
    O: { hex: 0xff7a12, css: '#ff8a26', name: 'orange' },
    P: { hex: 0x8a3cf0, css: '#9b55f5', name: 'purple' },
    K: { hex: 0xff5fb8, css: '#ff74c4', name: 'pink' },
    C: { hex: 0x12c8d8, css: '#2ad8e6', name: 'cyan' },
    N: { hex: 0x8b5a2b, css: '#a06a38', name: 'brown' },
  };
  const COLOR_KEYS = Object.keys(COLORS);
  const segCache = {};

  function parseSeg(code) {
    if (segCache[code]) return segCache[code];
    let s = code, curvy = false, pref = null;
    if (s[0] === '~') { curvy = true; s = s.slice(1); }
    if (s.endsWith('<')) { pref = 'L'; s = s.slice(0, -1); }
    else if (s.endsWith('>')) { pref = 'R'; s = s.slice(0, -1); }
    let seg;
    if (s === 'X') seg = { code, cross: true, ports: ['T', 'B', 'L', 'R'] };
    else if (s === 'E') seg = { code, ports: [] };
    else seg = { code, ports: s.split(''), curvy, pref };
    segCache[code] = seg;
    return seg;
  }

  function exitOf(seg, entry) {
    if (!seg.ports.includes(entry)) return null;
    if (seg.cross) return OPP[entry];
    const c = seg.ports.filter(p => p !== entry && p !== 'T'); // never go up
    if (!c.length) return null;
    if (c.includes('B')) return 'B';
    if (c.includes(OPP[entry])) return OPP[entry];
    if (seg.pref && c.includes(seg.pref)) return seg.pref;
    return c[0];
  }

  const mod = (a, n) => ((a % n) + n) % n;
  /** Number of columns (= containers = bins = colors) in a level. */
  const cols = level => level.src.length;
  /** Visible pipe rows per column (3..9); levels without `rows` keep the classic 3. */
  const rows = level => level.rows ?? ROWS;

  function cellAt(level, pos, r, c) {
    const reel = level.reels[c];
    return parseSeg(reel[mod(pos[c] + r, reel.length)]);
  }

  /** One step of the walk; shared by trace() and the route search. */
  function step(n, R, r, c, ex) {
    if (ex === 'B') { r++; return r >= R ? { done: { kind: 'bin', bin: c } } : { r, c, entry: 'T' }; }
    if (ex === 'R') { c++; return c >= n ? { done: { kind: 'jam', at: { r, c, side: 'L', wall: true } } } : { r, c, entry: 'L' }; }
    c--; return c < 0 ? { done: { kind: 'jam', at: { r, c, side: 'R', wall: true } } } : { r, c, entry: 'R' };
  }

  /** Follow the pipe network from source column s. */
  function trace(level, pos, s) {
    const n = cols(level);
    let r = 0, c = s, entry = 'T';
    const steps = [];
    const R = rows(level);
    for (let i = 0; i < 10 * n * R; i++) {
      const seg = cellAt(level, pos, r, c);
      const ex = exitOf(seg, entry);
      if (!ex) return { kind: 'jam', steps, at: { r, c, side: entry } };
      steps.push({ r, c, entry, exit: ex, code: seg.code });
      const nx = step(n, R, r, c, ex);
      if (nx.done) return { ...nx.done, steps };
      ({ r, c, entry } = nx);
    }
    return { kind: 'jam', steps, at: null };
  }

  function initialState(level) {
    const n = cols(level);
    return {
      pos: level.start.slice(),
      rem: level.balls.slice(),
      pend: new Array(n).fill(0),
      err: 0,
      got: new Array(n).fill(0),
    };
  }

  /**
   * Press the drop button of container s, with the reels at st.pos: releases every ball in it.
   * Returns { state, event, lose, win }.
   * event = { s, color, trace, outcome, balls:[{fromPend}] }
   *   outcome: 'empty' | 'ok' | 'wrong' | 'jam' | 'overflow' | 'blocked'
   *   'blocked' = only waiting balls left and the route is not correct: nothing happens.
   */
  function drop(level, st, s) {
    const ns = { pos: st.pos.slice(), rem: st.rem.slice(), pend: st.pend.slice(), err: st.err, got: st.got.slice() };
    const cap = level.cap ?? 4, maxErr = level.maxErr ?? 3;
    const tr = trace(level, ns.pos, s), color = level.src[s];
    const ev = { s, color, trace: tr, outcome: 'empty', balls: [] };
    let lose = null;
    if (ns.rem[s] === 0 && ns.pend[s] === 0) return { state: ns, event: ev, lose, win: false };
    if (tr.kind === 'bin') {
      if (level.bins[tr.bin] === color) {
        // the whole container empties: waiting balls first, then everything left
        for (let k = 0; k < ns.pend[s]; k++) ev.balls.push({ fromPend: true });
        for (let k = 0; k < ns.rem[s]; k++) ev.balls.push({ fromPend: false });
        ns.got[tr.bin] += ev.balls.length;
        ns.pend[s] = 0; ns.rem[s] = 0;
        ev.outcome = 'ok';
      } else if (ns.rem[s] > 0) {
        // whole batch lands in the wrong bin: one mistake, all balls bounce back
        ns.err++;
        for (let k = 0; k < ns.rem[s]; k++) ev.balls.push({ fromPend: false });
        ev.outcome = 'wrong';
      } else ev.outcome = 'blocked';
    } else if (ns.rem[s] > 0) {
      // broken pipe: the first ball gets stuck and plugs the neck, the rest stay in the container
      const total = sum(ns.pend);
      ev.balls.push({ fromPend: false });
      if (total >= cap) {
        ev.outcome = 'overflow';
        if (!level.noLose) { lose = 'overflow'; ns.rem[s]--; }
      } else {
        ns.rem[s]--; ns.pend[s]++;
        ev.outcome = 'jam';
      }
    } else ev.outcome = 'blocked';
    if (!level.noLose && ns.err >= maxErr) lose = lose || 'wrong';
    const win = !lose && ns.rem.every(x => x === 0) && ns.pend.every(x => x === 0);
    return { state: ns, event: ev, lose, win };
  }
  const sum = a => a.reduce((x, y) => x + y, 0);

  /** Drag steps from position a to k on a reel of length len (either direction). */
  const dragDist = (a, k, len) => { const d = mod(k - a, len); return Math.min(d, len - d); };

  /**
   * Route search from container s. Instead of trying every reel position one by one, the
   * walk keeps, per column, the SET of positions still possible. When the ball enters a
   * column it follows the pipes inside that column only, until it leaves it (side exit at
   * some row), drops into the bin, or jams; positions giving the same result are grouped,
   * so a twisty reel costs one branch per distinct way out, not one per position.
   * Re-entering a column later splits its set again. Fixed reels keep pos.
   * Calls visit(sets, cost) for every group that routes s into its matching bin: sets[c] is
   * the array of usable positions of column c (undefined = the ball never entered it), cost =
   * sum of the fewest drag steps inside each set. The groups are disjoint.
   */
  function searchRoutes(level, pos, s, visit) {
    const n = cols(level), fixed = level.fixed || [], want = level.src[s], R = rows(level);
    const sets = new Array(n);
    // follow column c at reel position k from (r, entry) until the ball leaves the column
    function inColumn(c, k, r, entry) {
      for (;;) {
        const ex = exitOf(parseSeg(level.reels[c][mod(k + r, level.reels[c].length)]), entry);
        if (!ex) return null;
        if (ex !== 'B') return ex + r; // 'L3' / 'R3': leaves sideways at row 3
        if (++r >= R) return 'bin';
        entry = 'T';
      }
    }
    const minCost = (c, S) => Math.min(...S.map(k => dragDist(pos[c], k, level.reels[c].length)));
    (function walk(r, c, entry, cost) {
      const S = sets[c] || (fixed[c] ? [pos[c]] : level.reels[c].map((_, k) => k));
      const groups = new Map();
      for (const k of S) {
        const out = inColumn(c, k, r, entry);
        if (out === null) continue;
        if (!groups.has(out)) groups.set(out, []);
        groups.get(out).push(k);
      }
      const prev = sets[c], base = prev ? cost - minCost(c, prev) : cost;
      for (const [out, G] of groups) {
        sets[c] = G;
        const cst = base + minCost(c, G);
        if (out === 'bin') { if (level.bins[c] === want) visit(sets, cst); continue; }
        const nc = out[0] === 'R' ? c + 1 : c - 1;
        if (nc >= 0 && nc < n) walk(+out.slice(1), nc, out[0] === 'R' ? 'L' : 'R', cst);
      }
      sets[c] = prev;
    })(0, s, 'T', 0);
  }

  /** Closest position to pos in each set (untouched columns keep pos). */
  const closest = (level, pos, sets) => Array.from({ length: cols(level) }, (_, c) => {
    const S = sets[c];
    if (!S) return pos[c];
    let best = S[0];
    for (const k of S) if (dragDist(pos[c], k, level.reels[c].length) < dragDist(pos[c], best, level.reels[c].length)) best = k;
    return best;
  });

  /** Reel positions closest to pos (fewest drag steps) that send container s to its bin, or null. */
  function nearestRoute(level, pos, s) {
    let best = null, bestD = Infinity;
    searchRoutes(level, pos, s, (sets, d) => {
      if (d < bestD) { bestD = d; best = closest(level, pos, sets); }
    });
    return best && { pos: best, dist: bestD };
  }

  /**
   * Reel positions that route EVERY container in `need` (default: all) into its matching
   * bin at the same time. Each container's route only depends on the reels its ball enters,
   * so the position sets of all containers are intersected column by column.
   * Returns up to `max` full position arrays (reels no ball enters keep pos), [] if none.
   */
  function solveAll(level, pos, need, max = 200) {
    const n = cols(level);
    need = need || [...Array(n).keys()];
    const opts = need.map(s => {
      const list = [];
      searchRoutes(level, pos, s, (sets, d) => list.push({ sets: sets.slice(), d }));
      return list.sort((x, y) => x.d - y.d).map(o => o.sets);
    });
    if (opts.some(o => !o.length)) return [];
    const order = opts.map((_, i) => i).sort((i, j) => opts[i].length - opts[j].length);
    const out = [], cur = new Array(n);
    (function join(i) {
      if (out.length >= max) return;
      if (i === order.length) { out.push(closest(level, pos, cur)); return; }
      for (const a of opts[order[i]]) {
        const saved = cur.slice();
        let ok = true;
        for (let c = 0; c < n && ok; c++) {
          if (!a[c]) continue;
          if (!cur[c]) cur[c] = a[c];
          else { const both = cur[c].filter(k => a[c].includes(k)); if (both.length) cur[c] = both; else ok = false; }
        }
        if (ok) join(i + 1);
        for (let c = 0; c < n; c++) cur[c] = saved[c];
        if (out.length >= max) return;
      }
    })(0);
    return out;
  }

  /**
   * Lever plan: release every container in `need` (default: all with balls) into its
   * matching bin, in as few waves as possible. Each wave = one reel configuration that
   * routes all of its containers correctly at once. When the bins are a permutation of
   * the containers, crossing routes cannot all be open together (balls never travel
   * up and an X keeps its direction), so those containers go in later waves.
   * Returns [{ pos, sources }] or null if some container has no route at all.
   * `pick(list)` chooses among equivalent configurations (default: first = fewest drags).
   */
  function planRelease(level, st, need, pick) {
    const n = cols(level);
    need = need || [...Array(n).keys()].filter(s => st.rem[s] > 0 || st.pend[s] > 0);
    pick = pick || (list => list[0]);
    // waiting balls first: they block the shared waiting area
    let left = need.slice().sort((a, b) => (st.pend[b] > 0) - (st.pend[a] > 0) || a - b);
    const waves = [];
    let pos = st.pos.slice();
    while (left.length) {
      const wave = [];
      for (const s of left) if (solveAll(level, pos, wave.concat(s), 1).length) wave.push(s);
      if (!wave.length) return null;
      pos = pick(solveAll(level, pos, wave, 60)).slice();
      waves.push({ pos, sources: wave });
      left = left.filter(s => !wave.includes(s));
    }
    return waves;
  }

  /** Fraction of reachable configs that route container s correctly (difficulty estimate). */
  function routeShare(level, s) {
    const fixed = level.fixed || [], size = c => (fixed[c] ? 1 : level.reels[c].length);
    let ok = 0;
    searchRoutes(level, level.start, s, sets => {
      // reels the ball never entered can be anywhere
      let m = 1; for (let c = 0; c < cols(level); c++) m *= sets[c] ? sets[c].length : size(c);
      ok += m;
    });
    let all = 1; for (let c = 0; c < cols(level); c++) all *= size(c);
    return ok / all;
  }

  /** Structural checks for a level. Returns a list of error strings (empty = ok). */
  function checkLevel(level) {
    const e = [], n = level.src ? level.src.length : 0;
    if (n < MIN_COLS || n > MAX_COLS) e.push(`container count must be between ${MIN_COLS} and ${MAX_COLS} (got ${n})`);
    for (const k of ['bins', 'balls', 'reels', 'start']) if (!level[k] || level[k].length !== n) e.push(`${k} must have ${n} entries`);
    if (level.fixed && level.fixed.length !== n) e.push(`fixed must have ${n} entries`);
    for (const c of level.src || []) if (!COLORS[c]) e.push(`invalid color: ${c}`);
    if (new Set(level.src).size !== n) e.push('each container must have a distinct color');
    // bins hold the same colors as the containers, in any order. A bin that is not under its
    // container forces a turning route; crossing routes are released in separate lever waves.
    if (level.bins && [...level.bins].sort().join() !== [...(level.src || [])].sort().join()) e.push('bins must contain exactly the colors in src (in any order)');
    if (n > 1 && level.bins && level.bins.join() === (level.src || []).join()) e.push('at least one bin must be offset from its matching container');
    const R = rows(level);
    if (!Number.isInteger(R) || R < MIN_ROWS || R > MAX_ROWS) e.push(`pipe rows per column must be between ${MIN_ROWS} and ${MAX_ROWS} (got ${R})`);
    // a reel shorter than the window would show the same piece twice in one column
    (level.reels || []).forEach((r, c) => { if (!r.length) e.push(`reel ${c} is empty`); else if (r.length < R) e.push(`reel ${c} needs at least ${R} pipes (got ${r.length})`); });
    return e;
  }

  const api = { OPP, ROWS, MIN_ROWS, MAX_ROWS, MIN_COLS, MAX_COLS, COLORS, COLOR_KEYS, cols, rows, parseSeg, exitOf, cellAt, trace, initialState, drop, nearestRoute, solveAll, planRelease, routeShare, checkLevel, mod };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SlotCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
