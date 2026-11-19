// FANTASY PUZZLE — rules core (pure, deterministic). Shared by preview, runtime, solver & tests.
(function (root) {
  'use strict';
  const N = 4;
  const DIRS = [ // index 0..7, clockwise from up
    { id: 'U', dc: 0, dr: -1, name: 'Trên', arrow: '↑' },
    { id: 'UR', dc: 1, dr: -1, name: 'Trên phải', arrow: '↗' },
    { id: 'R', dc: 1, dr: 0, name: 'Phải', arrow: '→' },
    { id: 'DR', dc: 1, dr: 1, name: 'Dưới phải', arrow: '↘' },
    { id: 'D', dc: 0, dr: 1, name: 'Dưới', arrow: '↓' },
    { id: 'DL', dc: -1, dr: 1, name: 'Dưới trái', arrow: '↙' },
    { id: 'L', dc: -1, dr: 0, name: 'Trái', arrow: '←' },
    { id: 'UL', dc: -1, dr: -1, name: 'Trên trái', arrow: '↖' },
  ];
  const AOE = {
    single: [[0, 0]],
    vline3: [[0, -1], [0, 0], [0, 1]],
    pierce3: [[0, 0], [1, 0], [2, 0]],
    pierce4: [[0, 0], [1, 0], [2, 0], [3, 0]],
    plus5: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]],
    block2: [[0, 0], [1, 0], [0, 1], [1, 1]],
    block3: [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
  };
  const PIERCE = { pierce3: true, pierce4: true };

  // ---- Skill & hero definitions (proposed balance numbers, GDD §9) ----
  const SKILLS = {};
  function sk(id, o) { SKILLS[id] = Object.assign({ id, damage: 0, aoe: 'single', push: 0, ignoresArmor: false }, o); }
  sk('sw_n', { name: 'Chém', cat: 'normal', policy: 'FRONT', damage: 2, aoe: 'single' });
  sk('sw_p', { name: 'Húc khiên', cat: 'push', policy: 'FRONT', push: 1, dir: 2, damage: 1 });
  sk('sw_r', { name: 'Kiếm phán quyết', cat: 'rage', policy: 'FRONT', damage: 3, aoe: 'vline3' });
  sk('ar_n', { name: 'Bắn tên', cat: 'normal', policy: 'SKIP', damage: 2, aoe: 'single' });
  sk('ar_p', { name: 'Tên chấn động', cat: 'push', policy: 'SKIP', push: 1, dir: 4, damage: 1 });
  sk('ar_r', { name: 'Mưa tên', cat: 'rage', policy: 'SKIP', damage: 2, aoe: 'block3' });
  sk('mg_n', { name: 'Cầu lửa', cat: 'normal', policy: 'FRONT', damage: 2, aoe: 'single' });
  sk('mg_p', { name: 'Dịch chuyển lực', cat: 'push', policy: 'FRONT', push: 1, dir: 0, damage: 1 });
  sk('mg_r', { name: 'Đại bộc phá', cat: 'rage', policy: 'FRONT', damage: 3, aoe: 'block3' });
  sk('ln_n', { name: 'Đâm thương', cat: 'normal', policy: 'FRONT', damage: 2, aoe: 'single' });
  sk('ln_p', { name: 'Gạt thương', cat: 'push', policy: 'FRONT', push: 1, dir: 6, damage: 1 });
  sk('ln_r', { name: 'Phá trận', cat: 'rage', policy: 'FRONT', damage: 3, aoe: 'pierce4' });
  sk('as_n', { name: 'Ám kích', cat: 'normal', policy: 'SKIP', damage: 4, aoe: 'single' });
  sk('as_p', { name: 'Đổi thế', cat: 'push', policy: 'SKIP', push: 1, dir: 1, damage: 1 });
  sk('as_r', { name: 'Đoạt mệnh', cat: 'rage', policy: 'SKIP', damage: 6, aoe: 'single' });
  sk('ic_n', { name: 'Mũi băng', cat: 'normal', policy: 'FRONT', damage: 2, aoe: 'single' });
  sk('ic_p', { name: 'Trượt băng', cat: 'push', policy: 'FRONT', push: 1, dir: 3, damage: 1 });
  sk('ic_r', { name: 'Tâm bão tuyết', cat: 'rage', policy: 'FRONT', damage: 3, aoe: 'plus5', ignoresArmor: true });

  const HEROES = {
    sword: { id: 'sword', name: 'Kiếm Sĩ', tag: 'Hàng đầu', skills: { normal: 'sw_n', push: 'sw_p', rage: 'sw_r' } },
    archer: { id: 'archer', name: 'Cung Thủ', tag: 'Bỏ qua 1 quái', skills: { normal: 'ar_n', push: 'ar_p', rage: 'ar_r' } },
    mage: { id: 'mage', name: 'Pháp Sư', tag: 'Hàng đầu', skills: { normal: 'mg_n', push: 'mg_p', rage: 'mg_r' } },
    lancer: { id: 'lancer', name: 'Thương Binh', tag: 'Hàng đầu', skills: { normal: 'ln_n', push: 'ln_p', rage: 'ln_r' } },
    assassin: { id: 'assassin', name: 'Sát Thủ', tag: 'Bỏ qua 1 quái', skills: { normal: 'as_n', push: 'as_p', rage: 'as_r' } },
    ice: { id: 'ice', name: 'Phù Thủy Băng', tag: 'Hàng đầu', skills: { normal: 'ic_n', push: 'ic_p', rage: 'ic_r' } },
  };
  const HERO_ORDER = ['sword', 'archer', 'mage', 'lancer', 'assassin', 'ice'];

  // Enemy archetypes (§10)
  const ENEMY_KINDS = {
    slime: { name: 'Slime', armor: 0, pushImmune: false },
    skel: { name: 'Bộ xương', armor: 0, pushImmune: false },
    armor: { name: 'Giáp nặng', armor: 1, pushImmune: false },
    anchor: { name: 'Quái neo', armor: 0, pushImmune: true },
    boss: { name: 'Tinh anh', armor: 1, pushImmune: true },
  };

  const key = (c, r) => c + ',' + r;
  const inB = (c, r) => c >= 0 && c < N && r >= 0 && r < N;

  // ---- BoardState ----
  function makeState(level) {
    return {
      enemies: level.enemies.map((e, i) => {
        const k = ENEMY_KINDS[e.kind] || ENEMY_KINDS.skel;
        return {
          uid: i, kind: e.kind, sprite: e.sprite, c: e.c, r: e.r, hp: e.hp, maxHp: e.hp,
          armor: e.armor != null ? e.armor : k.armor, pushImmune: e.pushImmune != null ? e.pushImmune : k.pushImmune,
        };
      }),
      walls: (level.walls || []).map(w => key(w[0], w[1])),
      rageUsed: 0,
    };
  }
  function cloneState(s) {
    return { enemies: s.enemies.map(e => Object.assign({}, e)), walls: s.walls, rageUsed: s.rageUsed };
  }
  const alive = s => s.enemies.filter(e => e.hp > 0);
  const enemyAt = (s, c, r) => s.enemies.find(e => e.hp > 0 && e.c === c && e.r === r);
  const isWall = (s, c, r) => s.walls.indexOf(key(c, r)) >= 0;

  // ---- TargetResolver ----
  function resolveTarget(s, policy, row) {
    const list = alive(s).filter(e => e.r === row).sort((a, b) => a.c - b.c);
    if (policy === 'FRONT') return list[0] || null;
    // SKIP: second living monster; if nothing stands behind the first, hit the first one
    if (policy === 'SKIP') return list[1] || list[0] || null;
    return null;
  }
  function blockedByWall(s, row, col) {
    for (let c = 0; c < col; c++) if (isWall(s, c, row)) return true;
    return false;
  }
  // Full targeting check (policy -> line of sight). No range: any column in the row can hit.
  function checkTarget(s, skill, hero) {
    const t = resolveTarget(s, skill.policy, hero.r);
    if (!t) return { ok: false, reason: 'no_target' };
    if (blockedByWall(s, hero.r, t.c)) return { ok: false, reason: 'blocked', target: t };
    return { ok: true, target: t };
  }

  // ---- SkillResolver: AoE cells ----
  function aoeCells(s, skill, tc, tr) {
    const offs = AOE[skill.aoe];
    const cells = [];
    for (const [dc, dr] of offs) {
      const c = tc + dc, r = tr + dr;
      if (!inB(c, r)) { if (PIERCE[skill.aoe]) break; else continue; }
      if (isWall(s, c, r)) { if (PIERCE[skill.aoe]) break; else continue; }
      cells.push([c, r]);
    }
    return cells;
  }
  function applyDamage(e, dmg, ignoresArmor) {
    const real = Math.max(0, dmg - (ignoresArmor ? 0 : e.armor));
    e.hp -= real;
    return real;
  }

  // ---- PushResolver ----
  function resolvePush(s, t, dirIdx, events) {
    const d = DIRS[dirIdx];
    if (t.pushImmune) { events.push({ t: 'immune', uid: t.uid, c: t.c, r: t.r }); return; }
    const nc = t.c + d.dc, nr = t.r + d.dr;
    let blocked = null;
    if (!inB(nc, nr)) blocked = 'edge';
    else if (isWall(s, nc, nr)) blocked = 'wall';
    // diagonal pushes only care about the destination cell; walls/monsters beside the step don't block
    if (blocked) { // blocked: the target just stays (the push skill's own damage is applied afterwards)
      events.push({ t: 'bump', uid: t.uid, c: t.c, r: t.r, to: [nc, nr], why: blocked, dmg: 0 });
      return;
    }
    const other = enemyAt(s, nc, nr);
    if (other) { // blocked by another monster: nobody moves, no collision damage, no chain push
      events.push({ t: 'collide', uid: t.uid, other: other.uid, c: t.c, r: t.r, to: [nc, nr], dmg: 0 });
      return;
    }
    events.push({ t: 'move', uid: t.uid, from: [t.c, t.r], to: [nc, nr] });
    t.c = nc; t.r = nr;
  }

  function reap(s, events) {
    for (const e of s.enemies) if (e.hp <= 0 && !e.dead) { e.dead = true; e.hp = Math.min(e.hp, 0); events.push({ t: 'die', uid: e.uid, c: e.c, r: e.r }); }
  }

  // ---- One action ----
  // hero: {id, c, r}; act: {cat:'normal'|'push'|'rage', dir}
  function doAction(s, hero, act, rageBudget) {
    const events = [];
    const skill = SKILLS[HEROES[hero.id].skills[act.cat]];
    const res = { heroId: hero.id, skill, act, events, ok: false };
    if (act.cat === 'rage') {
      if (s.rageUsed >= rageBudget) { res.reason = 'no_rage'; events.push({ t: 'fail', reason: 'no_rage' }); return res; }
      s.rageUsed++;
    }
    const chk = checkTarget(s, skill, hero);
    if (!chk.ok) {
      res.reason = chk.reason; res.target = chk.target ? { uid: chk.target.uid, c: chk.target.c, r: chk.target.r } : null;
      events.push({ t: 'fail', reason: chk.reason, target: res.target });
      return res;
    }
    const t = chk.target;
    res.ok = true;
    res.target = { uid: t.uid, c: t.c, r: t.r };
    if (skill.cat === 'push') {
      resolvePush(s, t, skill.dir, events); // direction is fixed per hero
      reap(s, events);
      if (skill.damage > 0 && t.hp > 0) {
        const real = applyDamage(t, skill.damage, skill.ignoresArmor);
        events.push({ t: 'hit', uid: t.uid, c: t.c, r: t.r, dmg: real, raw: skill.damage });
        reap(s, events);
      }
      res.cells = [[t.c, t.r]];
    } else {
      const cells = aoeCells(s, skill, t.c, t.r);
      res.cells = cells;
      const hits = [];
      for (const [c, r] of cells) {
        const e = enemyAt(s, c, r);
        if (e) hits.push(e);
      }
      for (const e of hits) {
        const real = applyDamage(e, skill.damage, skill.ignoresArmor);
        events.push({ t: 'hit', uid: e.uid, c: e.c, r: e.r, dmg: real, raw: skill.damage });
      }
      reap(s, events);
    }
    return res;
  }

  // ---- TurnSimulator ----
  // placement: {heroId:[c,r]}, plan: [{heroId, cat, dir}] in order
  function simulate(level, placement, plan) {
    const s = makeState(level);
    const steps = [];
    let outcome = null;
    for (let i = 0; i < plan.length; i++) {
      const a = plan[i];
      if (!a || !a.cat) { steps.push({ skipped: true, heroId: a && a.heroId, state: cloneState(s) }); continue; }
      const pos = placement[a.heroId];
      const before = cloneState(s);
      const res = doAction(s, { id: a.heroId, c: pos[0], r: pos[1] }, a, level.rageBudget || 0);
      res.before = before;
      res.state = cloneState(s);
      res.index = i;
      steps.push(res);
      if (alive(s).length === 0) { outcome = 'win'; break; }
    }
    if (!outcome) outcome = alive(s).length === 0 ? 'win' : 'lose';
    return { steps, finalState: s, remaining: alive(s), outcome, rageUsed: s.rageUsed };
  }

  // ---- Solver (used offline to verify levels and for in-game checks) ----
  // DFS: at each depth pick an unused hero, a row, the rightmost free column in that row, and an action.
  function solve(level, opts) {
    opts = opts || {};
    const heroes = level.heroes.slice();
    const locked = new Set((level.locked || []).map(p => key(p[0], p[1])));
    const allowDirs = opts.dirs || [0, 1, 2, 3, 4, 5, 6, 7];
    const allowCats = opts.cats || ['normal', 'push', 'rage'];
    const maxSolutions = opts.max || 1;
    const nodeLimit = opts.nodeLimit || 3e6;
    const budget = opts.rageBudget != null ? opts.rageBudget : (level.rageBudget || 0);
    const sols = [];
    let nodes = 0;
    const seen = new Set();
    const lv = Object.assign({}, level, { rageBudget: budget });
    function stateKey(s, used, occ) {
      return alive(s).map(e => e.uid + ':' + e.c + e.r + e.hp).join('|') + '#' + used.join('') + '#' + s.rageUsed;
    }
    function rec(s, used, occ, plan, place) {
      if (sols.length >= maxSolutions || nodes > nodeLimit) return;
      if (alive(s).length === 0) { sols.push({ plan: plan.slice(), placement: Object.assign({}, place), rageUsed: s.rageUsed }); return; }
      const sk = stateKey(s, used, occ);
      if (seen.has(sk)) return;
      seen.add(sk);
      for (let hi = 0; hi < heroes.length; hi++) {
        if (used[hi]) continue;
        const hid = heroes[hi];
        for (let r = 0; r < N; r++) {
          // column does not affect actions (no range); pick any free unlocked cell in the row
          let col = -1;
          for (let c = N - 1; c >= 0; c--) if (!occ.includes(key(c, r)) && !locked.has(key(c, r))) { col = c; break; }
          if (col < 0) continue;
          for (const cat of ((opts.heroCats && opts.heroCats[hid]) || allowCats)) {
            const dirs = [0]; // push direction is fixed by the skill
            for (const dir of dirs) {
              nodes++;
              const ns = cloneState(s);
              const res = doAction(ns, { id: hid, c: col, r }, { cat, dir }, budget);
              if (!res.ok) continue;
              const changed = res.events.some(e => e.t === 'move' || e.t === 'die' || ((e.t === 'hit' || e.t === 'bump' || e.t === 'collide') && (e.dmg > 0)));
              if (!changed) continue;
              used[hi] = 1; occ.push(key(col, r)); plan.push({ heroId: hid, cat, dir: cat === 'push' ? SKILLS[HEROES[hid].skills.push].dir : null }); place[hid] = [col, r];
              rec(ns, used, occ, plan, place);
              used[hi] = 0; occ.pop(); plan.pop(); delete place[hid];
              if (sols.length >= maxSolutions) return;
            }
          }
        }
      }
    }
    rec(makeState(lv), heroes.map(() => 0), [], [], {});
    return { solutions: sols, nodes, exhausted: nodes <= nodeLimit };
  }

  const API = { N, DIRS, AOE, SKILLS, HEROES, HERO_ORDER, ENEMY_KINDS, makeState, cloneState, alive, enemyAt, isWall,
    resolveTarget, checkTarget, aoeCells, doAction, simulate, solve, key };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.SIM = API;
})(typeof window !== 'undefined' ? window : globalThis);
