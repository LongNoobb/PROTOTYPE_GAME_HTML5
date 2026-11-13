/* Interface and dialog flow for Slot Sorting. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const paths = {
    gear: '<path d="m9 3-.5 2-2 1-2-.5-2 3.5 1.5 1.5v3L2.5 15l2 3.5 2-.5 2 1 .5 2h4l.5-2 2-1 2 .5 2-3.5-1.5-1.5v-3L20 9l-2-3.5-2 .5-2-1-.5-2z"/><circle cx="11" cy="12" r="3"/>',
    bulb: '<path d="M9 18h6m-5 3h4M8 14a7 7 0 1 1 8 0l-1 2H9zM12 5v2"/>',
    spin: '<path d="M20 8a8 8 0 0 0-14-2L3 9m0-6v6h6M4 16a8 8 0 0 0 14 2l3-3m0 6v-6h-6"/>',
    cube: '<path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M7.5 5.5l9 5"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    retry: '<path d="M4 9a8 8 0 1 1 0 7M4 3v6h6"/>',
    sound: '<path d="m11 4-6 5H2v6h3l6 5zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2m0 3h.01"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    trophy: '<path d="M7 3h10v6a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 5 4M17 5h4v3a4 4 0 0 1-5 4M12 14v5m-5 2h10"/>',
    drop: '<path d="M12 3v13m-5-5 5 5 5-5M4 19v3h16v-3"/>',
    star: '<path d="m12 2 3 6.2 6.8 1-4.9 4.8 1.2 6.8-6.1-3.2-6.1 3.2 1.2-6.8L2.2 9.2l6.8-1z"/>',
  };
  const sprites = { gear:0, bulb:1, retry:2, spin:2, close:3, help:4, grid:5, play:6, trophy:7, star:8 };
  const icon = name => name in sprites
    ? `<span class="game-icon sprite-${sprites[name]}" aria-hidden="true"></span>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.help}</svg>`;
  document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
  let adapter, lastFocus, activeKind = null, toastTimer, tipTimer, pendingLoad = null, tutorialKey = '';
  const history = [];
  const overlay = $('ov'), screen = $('game-content');
  const bootButtons = [...screen.querySelectorAll('button')];
  bootButtons.forEach(button => { button.disabled = true; });
  const text = (id, value) => { if ($(id).textContent !== String(value)) $(id).textContent = value; };
  function close() {
    activeKind = null;
    history.length = 0; pendingLoad = null;
    overlay.classList.remove('show'); overlay.replaceChildren(); delete overlay.dataset.kind;
    screen.inert = false;
    if (lastFocus?.isConnected && !lastFocus.disabled) lastFocus.focus({ preventScroll: true });
  }
  function navigate(kind) {
    if (activeKind && activeKind !== kind) history.push({kind:activeKind, focus:document.activeElement?.getAttribute('aria-label')});
    adapter.open(kind);
  }
  function dismissDialog() {
    if (!adapter) return;
    if (activeKind === 'confirm') pendingLoad = null;
    const previous = history.pop();
    if (previous) {
      adapter.open(previous.kind);
      const target = [...overlay.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === previous.focus);
      target?.focus({preventScroll:true});
    } else if (activeKind === 'win' || activeKind === 'lose') navigate('levels');
    else if (['win','lose'].includes(adapter.snapshot().phase)) adapter.open(adapter.snapshot().phase);
    else adapter.close();
  }
  function requestLoad(index, restart = false) {
    const s = adapter.snapshot();
    if (!restart && index === s.index) {
      if (['win','lose'].includes(s.phase)) { history.length = 0; adapter.open(s.phase); }
      else adapter.close();
      return;
    }
    if (s.hasProgress && !['win','lose'].includes(s.phase)) {
      pendingLoad = {index, restart}; navigate('confirm');
    } else adapter.load(index);
  }
  const requestRestart = () => requestLoad(adapter.snapshot().index, true);
  function backLabel() {
    const previous = history[history.length - 1]?.kind;
    return previous === 'menu' ? 'Back to Settings' : ['win','lose'].includes(previous) ? 'View Results' : 'Back to Game';
  }
  function action(label, style, fn, name) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'action ' + style;
    b.setAttribute('aria-label', label);
    if (name) b.innerHTML = icon(name);
    const span = document.createElement('span'); span.className = 'action-label'; span.textContent = label; b.append(span);
    b.addEventListener('click', () => { adapter.tap(); fn(); }); return b;
  }
  function open(kind) {
    if (!adapter) return;
    const s = adapter.snapshot(), level = s.level;
    if (!activeKind) lastFocus = document.activeElement;
    activeKind = kind; screen.inert = true;
    overlay.dataset.kind = kind;
    const panel = document.createElement('section'); panel.className = 'panel panel-' + kind;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'dialog-title');
    const dismiss = action('Close', 'close-button', dismissDialog, 'close');
    dismiss.setAttribute('aria-label', 'Close dialog'); panel.append(dismiss);
    const header = document.createElement('header'); header.className = 'dialog-header'; panel.append(header);
    const eyebrow = document.createElement('div'); eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'LEVEL ' + String(level.id).padStart(2,'0'); header.append(eyebrow);
    const title = document.createElement('h2'); title.id = 'dialog-title'; header.append(title);
    const content = document.createElement('div'); content.className = 'panel-body'; panel.append(content);
    const description = t => { const p = document.createElement('p'); p.className = 'dialog-description'; p.textContent = t; content.append(p); };
    if (kind === 'menu') {
      title.textContent = 'Paused';
      const summary = document.createElement('div'); summary.className = 'level-summary';
      summary.innerHTML = '<span class="summary-level-name"></span>';
      summary.querySelector('.summary-level-name').textContent = 'Level ' + String(level.id).padStart(2,'0') + ' · ' + level.name; content.append(summary);
      const rows = document.createElement('div'); rows.className = 'settings-list';
      const sound = action('Sound', 'setting-row', () => {
        const enabled = !adapter.snapshot().soundOn; adapter.sound(enabled);
        sound.setAttribute('aria-checked', String(enabled)); sound.querySelector('.switch').textContent = enabled ? 'On' : 'Off';
      }, 'sound');
      sound.setAttribute('role', 'switch'); sound.setAttribute('aria-checked', String(s.soundOn));
      const sw = document.createElement('span'); sw.className = 'switch'; sw.textContent = s.soundOn ? 'On' : 'Off'; sound.append(sw); rows.append(sound);
      rows.append(action('Select Level', 'setting-row', () => navigate('levels'), 'grid'));
      rows.append(action('How to Play', 'setting-row', () => navigate('help'), 'help'));
      const camera = action('Camera View', 'setting-row', () => { adapter.close(); $('inspect').click(); }, 'cube');
      const cameraState = document.createElement('span'); cameraState.className = 'camera-state';
      cameraState.textContent = $('inspect').getAttribute('aria-pressed') === 'true' ? '3D Angle' : 'Front';
      camera.append(cameraState); rows.append(camera);
      content.append(rows);
      const actions = document.createElement('div'); actions.className = 'menu-actions';
      actions.append(action('Restart', 'gold-action', requestRestart));
      const resume = s.phase === 'win' ? () => s.index < s.levels.length - 1 ? adapter.load(s.index + 1) : navigate('levels') : s.phase === 'lose' ? () => adapter.load(s.index) : adapter.close;
      actions.append(action(s.phase === 'win' ? 'Next Level' : s.phase === 'lose' ? 'Try Again' : 'Resume', 'primary', resume)); content.append(actions);
      if (adapter.exportModel) {
        const details = document.createElement('details'); details.className = 'model-tools';
        const summary = document.createElement('summary'); summary.textContent = '3D Model';
        details.append(summary, action('Download Model (.glb)', 'text-button', adapter.exportModel, 'cube')); content.append(details);
      }
    } else if (kind === 'levels') {
      title.textContent = 'Select Level';
      description(`${s.levels.filter(l => s.done[l.id]).length}/${s.levels.length} levels completed`);
      const grid = document.createElement('div'); grid.className = 'level-grid';
      s.levels.forEach((lv, i) => {
        const b = document.createElement('button'); b.className = 'level-tile' + (s.done[lv.id] ? ' done' : '') + (i === s.index ? ' current' : '');
        b.setAttribute('aria-label', `Level ${lv.id}: ${lv.name}${s.done[lv.id] ? ', completed' : ''}`);
        if (i === s.index) b.setAttribute('aria-current', 'step');
        const n = document.createElement('strong'); n.textContent = String(lv.id).padStart(2, '0');
        const label = document.createElement('span'); label.className = 'level-tile-label'; label.textContent = i === s.index ? 'Current' : s.done[lv.id] ? 'Completed' : lv.src.length + (lv.src.length === 1 ? ' color' : ' colors');
        const dots = document.createElement('div'); dots.className = 'level-colors'; dots.setAttribute('aria-hidden','true');
        lv.src.forEach(color => { const dot = document.createElement('i'); dot.style.background = window.SlotCore.COLORS[color].css; dots.append(dot); });
        if (s.done[lv.id]) { const check = document.createElement('b'); check.className = 'level-check'; check.innerHTML = icon('check'); b.append(check); }
        b.append(n, dots, label); b.onclick = () => { adapter.tap(); requestLoad(i); }; grid.append(b);
      });
      content.append(grid, action(backLabel(), 'primary', dismissDialog));
    } else if (kind === 'drops') {
      title.textContent = 'Choose a Color'; description('Tap a color to release balls through the connected pipes.');
      const grid = document.createElement('div'); grid.className = 'drop-grid';
      level.src.forEach((color, i) => {
        const c = window.SlotCore.COLORS[color];
        const b = action(c.name, 'color-drop', () => { adapter.close(); adapter.drop(i); });
        const swatch = document.createElement('i'); swatch.style.background = c.css; b.prepend(swatch);
        b.disabled = s.vis.rem[i] + s.vis.pend[i] === 0;
        grid.append(b);
      }); content.append(grid);
    } else if (kind === 'help') {
      title.textContent = 'Connect. Release. Sort!'; description('Guide each color into its matching bin.');
      const demo = document.createElement('div'); demo.className = 'help-demo'; demo.setAttribute('aria-hidden','true');
      demo.innerHTML = `<span class="demo-ball"></span><span class="demo-pipe">${icon('drop')}</span><span class="demo-bin">${icon('check')}</span>`; content.append(demo);
      if (level.tip) {
        const tip = document.createElement('p'); tip.className = 'current-level-tip';
        tip.textContent = `Level ${level.id}: ${level.tip}`;
        content.append(tip);
      }
      const steps = document.createElement('ol'); steps.className = 'help-steps';
      [['01', 'Connect the pipes', 'Drag each column up or down to create a connected path.'], ['02', 'Release a color', 'Tap a colored cap or a color button below. Balls follow the pipes down to a bin.'], ['03', 'Try another route', 'Blocked balls enter the waiting area. Reconnect the pipes to release them before the waiting area fills up.']].forEach(([n, h, p]) => {
        const li = document.createElement('li'); li.innerHTML = `<span>${n}</span><div><strong>${h}</strong><p>${p}</p></div>`; steps.append(li);
      }); content.append(steps);
      description('Auto finish connects the pipes and releases all balls. Hint connects a path for one color.');
      const shortcuts = document.createElement('div'); shortcuts.className = 'shortcuts'; shortcuts.textContent = 'Keyboard: 1–9 release balls · Q/W/E & A/S/D move columns · Space auto finish · H hint · R restart'; content.append(shortcuts);
      content.append(action(history.length ? backLabel() : 'Play', 'primary', dismissDialog));
    } else if (kind === 'win') {
      const stars = s.vis.err === 0 ? 3 : s.vis.err === 1 ? 2 : 1;
      const medal = document.createElement('div'); medal.className = 'result-medal'; medal.innerHTML = icon('trophy'); content.append(medal);
      title.textContent = s.index === s.levels.length - 1 ? 'All Levels Complete!' : 'Level Complete!';
      const star = document.createElement('div'); star.className = 'stars'; star.setAttribute('aria-label', stars + ' out of 3 stars');
      for (let i = 0; i < 3; i++) { const a = document.createElement('span'); a.innerHTML = icon('star'); if (i >= stars) a.className = 'unearned'; star.append(a); } content.append(star);
      description('All balls reached their matching bins!');
      if (s.index < s.levels.length - 1) content.append(action('Play Level ' + s.levels[s.index + 1].id, 'primary', () => adapter.load(s.index + 1)));
      else content.append(action('Select Level', 'primary', () => navigate('levels')));
      content.append(action('Replay Level', 'text-button', () => adapter.load(s.index), 'retry'));
    } else if (kind === 'lose') {
      const medal = document.createElement('div'); medal.className = 'result-medal retry-medal'; medal.innerHTML = icon('retry'); content.append(medal);
      title.textContent = 'Try Again!'; description(s.loseReason);
      description('Check the bin colors before releasing balls. Use Hint if you need help.');
      content.append(action('Try Again', 'primary', () => adapter.load(s.index)), action('Choose Another Level', 'text-button', () => navigate('levels')));
    } else if (kind === 'confirm' && pendingLoad) {
      const target = pendingLoad;
      title.textContent = target.restart ? 'Restart Level?' : 'Switch Level?';
      description(target.restart ? 'The pipes and balls in this level will be reset.' : 'Switch to level ' + s.levels[target.index].id + '? Your current progress in this level will be reset when you return.');
      const actions = document.createElement('div'); actions.className = 'menu-actions';
      actions.append(action(target.restart ? 'Restart' : 'Switch Level', 'gold-action', () => adapter.load(target.index)), action('Go Back', 'primary', dismissDialog)); content.append(actions);
    }
    overlay.replaceChildren(panel); overlay.classList.add('show');
    if (kind === 'levels') panel.querySelector('[aria-current]')?.scrollIntoView({block:'nearest'});
    const preferred = panel.querySelector('.primary') || panel.querySelector('[aria-current]') || dismiss;
    const bounds = panel.getBoundingClientRect(), target = preferred.getBoundingClientRect();
    (target.top >= bounds.top && target.bottom <= bounds.bottom ? preferred : dismiss).focus({ preventScroll: true });
  }
  overlay.addEventListener('click', e => { if (e.target === overlay) dismissDialog(); });
  document.addEventListener('keydown', e => {
    if (!activeKind) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); dismissDialog(); return; }
    if (e.key === 'Tab') {
      const items = [...overlay.querySelectorAll('button:not(:disabled), summary')].filter(el =>
        el.getClientRects().length && (!el.closest('details:not([open])') || el.tagName === 'SUMMARY'));
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    // Dialog owns input; gameplay shortcuts must not fire behind it.
    e.stopPropagation();
  }, true);
  window.SlotUI = {
    icon, close, open, requestRestart,
    tutorial(coach) {
      const card = $('tutorial-card'), cue = $('tutorial-cue');
      const step = coach?.step || '';
      if (tutorialKey !== step) {
        tutorialKey = step;
        card.hidden = !coach;
        $('game-shell').classList.toggle('has-tutorial', !!coach);
        if (coach) {
          const dropping = step === 'drop';
          $('tutorial-step').textContent = dropping ? '02 / 02' : '01 / 02';
          $('tutorial-title').textContent = dropping ? 'Tap to release' : 'Drag to connect';
          $('tutorial-copy').textContent = dropping ? 'The path is ready! Tap the red container cap.' : 'Hold and drag the pipe column up or down to connect the path.';
          cue.dataset.step = step;
        }
      }
      cue.hidden = !coach || !coach.cueVisible;
      if (coach) {
        const position = `${coach.x.toFixed(2)}%|${coach.y.toFixed(2)}%|${coach.direction}|${coach.focusHeight.toFixed(1)}`;
        if (cue.dataset.position !== position) {
          cue.dataset.position = position;
          cue.style.left = coach.x.toFixed(2) + '%'; cue.style.top = coach.y.toFixed(2) + '%';
          cue.style.setProperty('--swipe-y', (coach.direction * Math.min(52, coach.focusHeight * .3)) + 'px');
          cue.style.setProperty('--focus-height', coach.focusHeight.toFixed(1) + 'px');
        }
      }
    },
    ready() {
      bootButtons.forEach(button => { button.disabled = false; });
      $('game-shell').setAttribute('aria-busy','false');
      $('loading')?.remove();
    },
    bootError() {
      $('game-shell').setAttribute('aria-busy','false');
      let loading = $('loading');
      if (!loading) { loading = document.createElement('div'); loading.id = 'loading'; $('frame').append(loading); }
      loading.className = 'load-error'; loading.setAttribute('role','alert');
      loading.innerHTML = '<div class="loading-card"><strong>Could not start the game</strong><p>Please reload. If the problem continues, check your connection or try a browser that supports WebGL.</p><button type="button">Reload</button></div>';
      loading.querySelector('button').onclick = () => location.reload();
    },
    indicateHint(source) {
      const button = $('quick-drops').children[source];
      if (button) button.scrollIntoView({block:'nearest',inline:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    },
    attach(a) {
      adapter = a;
      [['gear', () => a.open('menu')], ['level-select', () => a.open('levels')], ['guide', () => a.open('help')], ['retry', requestRestart], ['bulb', a.hint], ['spin', a.spin], ['palette', () => a.open('drops')]].forEach(([id, fn]) => $(id).onclick = () => { a.tap(); fn(); });
      if ($('view-badge')) $('view-badge').textContent = '3D';
    },
    refresh(level, index, vis) {
      const waiting = vis.pend.reduce((a,b) => a+b,0);
      text('lvl', 'LEVEL ' + String(level.id).padStart(2,'0')); text('lname', level.name);
      text('level-count', String(index+1).padStart(2,'0') + ' / ' + window.SLOT_LEVELS.length);
      text('color-count', level.src.length + (level.src.length === 1 ? ' color' : ' colors')); text('waiting-count', waiting + '/' + (level.cap ?? 4));
      text('error-count', level.noLose ? 'Free' : vis.err + '/' + (level.maxErr ?? 3));
      $('waiting-stat').classList.toggle('warning', waiting >= (level.cap ?? 4) - 1);
      $('error-stat').classList.toggle('warning', !level.noLose && vis.err >= (level.maxErr ?? 3) - 1);
      $('error-stat').classList.toggle('free-play', !!level.noLose);
      $('game-shell').dataset.level = level.id;
      $('palette').hidden = level.src.length <= 3;
      const tray = $('quick-drop-tray'), drops = $('quick-drops');
      tray.hidden = level.src.length < 4;
      if (drops.dataset.level !== String(level.id)) {
        drops.replaceChildren(); drops.dataset.level = level.id;
        if (level.src.length >= 4) level.src.forEach((color, i) => {
          const c = window.SlotCore.COLORS[color], b = document.createElement('button');
          b.className = 'quick-drop'; b.setAttribute('aria-label', 'Release ' + c.name); b.title = 'Release ' + c.name;
          const swatch = document.createElement('i'); swatch.style.background = c.css;
          const label = document.createElement('span'); label.className = 'drop-name'; label.textContent = c.name;
          const count = document.createElement('b'); count.className = 'drop-remaining'; count.textContent = vis.rem[i] + vis.pend[i];
          b.append(swatch, label, count);
          b.disabled = vis.rem[i] + vis.pend[i] === 0;
          b.onclick = () => { adapter.tap(); adapter.drop(i); }; drops.append(b);
        });
        drops.scrollLeft = 0;
      }
      updateTrayHint();
    },
    tip(t) {
      clearTimeout(tipTimer); $('tip').textContent = t || ''; $('tip').classList.toggle('hide', !t);
      if (t) tipTimer = setTimeout(() => $('tip').classList.add('hide'), 9000);
    },
    toast(t, seconds = 2.5) {
      clearTimeout(toastTimer); $('toast').textContent = t; $('toast').classList.remove('hide');
      toastTimer = setTimeout(() => $('toast').classList.add('hide'), seconds * 1000);
    },
    get isOpen() { return !!activeKind; },
  };
  function updateTrayHint() {
    const drops = $('quick-drops'), hint = document.querySelector('.tray-scroll-hint');
    const overflow = drops.scrollWidth - drops.clientWidth;
    hint.hidden = $('quick-drop-tray').hidden || overflow < 2;
    hint.textContent = drops.scrollLeft >= overflow - 3 ? '← Back to first colors' : 'Swipe for more colors →';
  }
  $('quick-drops').addEventListener('scroll', updateTrayHint, {passive:true});
  new ResizeObserver(updateTrayHint).observe($('quick-drops'));
})();
