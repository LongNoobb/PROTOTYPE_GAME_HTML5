// FANTASY PUZZLE — unified icon set.
// One source of truth for every UI icon: the same path data renders as inline SVG (HTML UI) and
// as Path2D on the board canvas, so icons look identical everywhere.
// Style: 24×24 grid, chunky filled "sticker" shapes with a dark outline (pixel-RPG friendly),
// plus optional layers: shade (dark overlay), hi (light overlay), ink (solid dark), acc (accent colour).
(function () {
  'use strict';
  const LINE = '#140f0a';

  function gear(n, ro, ri) {
    const step = Math.PI * 2 / n, P = (r, a) => (12 + r * Math.sin(a)).toFixed(2) + ' ' + (12 - r * Math.cos(a)).toFixed(2);
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = i * step;
      d += (i ? 'L' : 'M') + P(ri, a - 0.38 * step) + 'L' + P(ro, a - 0.2 * step) + 'L' + P(ro, a + 0.2 * step) + 'L' + P(ri, a + 0.38 * step);
    }
    return d + 'Z';
  }
  const SWORD = {
    b: 'M21 3l-.9 4.4-9.6 9.7-3.6-3.6L16.6 3.9z M3.6 13.4l1.6-1.6 7 7-1.6 1.6z M6.3 16.6l1.1 1.1-3.4 3.4-1.1-1.1z M2.6 19.4a1.7 1.7 0 1 1 2.4 2.4 1.7 1.7 0 0 1-2.4-2.4z',
    hi: 'M19.7 4.3l-.5 2.6-8.7 8.8-.9-.9z',
  };
  const ARROW = { b: 'M12 2.5l8.5 9h-5.2V21H8.7v-9.5H3.5z', hi: 'M12 5.4l-4.6 4.9h2.6v9.4h1.3V10.3h.7z' };

  const ICONS = {
    back: { b: 'M15.2 3.5l3 3L12.7 12l5.5 5.5-3 3L6.7 12z' },
    next: { b: 'M8.8 3.5l-3 3 5.5 5.5-5.5 5.5 3 3L17.3 12z' },
    pause: { b: 'M5.5 4h4.5v16H5.5z M14 4h4.5v16H14z', hi: 'M6.7 5.2h1.4v13.6H6.7z M15.2 5.2h1.4v13.6h-1.4z' },
    play: { b: 'M6.5 3.5L20.5 12 6.5 20.5z', hi: 'M8 6.3v5.2l6.6-1.5z' },
    skip: { b: 'M2.5 4.5L11.5 12l-9 7.5z M11.5 4.5l9 7.5-9 7.5z M20 4.5h2v15h-2z' },
    hint: {
      b: 'M12 1.8a7.2 7.2 0 0 0-4.3 13V17h8.6v-2.2A7.2 7.2 0 0 0 12 1.8z M8 18.5h8v1.4a2.3 2.3 0 0 1-2.3 2.3h-3.4A2.3 2.3 0 0 1 8 19.9z',
      ink: 'M11 9.5h2V17h-2z', hi: 'M7.7 8.6a4.6 4.6 0 0 1 3.4-3.9v2a2.8 2.8 0 0 0-1.6 1.9z',
    },
    star: {
      b: 'M12 1.6l3.1 6.5 7.1.9-5.2 4.9 1.4 7.1L12 17.5 5.6 21l1.4-7.1L1.8 9l7.1-.9z',
      hi: 'M12 4.6l-2 4.3-4.7.6 3.4 3.2-.5 2.3L12 12z',
    },
    lock: {
      b: 'M6.6 10.5V7.6a5.4 5.4 0 0 1 10.8 0v2.9h-2.8V7.6a2.6 2.6 0 0 0-5.2 0v2.9z M5 10.5h14a1.2 1.2 0 0 1 1.2 1.2v8.6A1.2 1.2 0 0 1 19 21.5H5a1.2 1.2 0 0 1-1.2-1.2v-8.6A1.2 1.2 0 0 1 5 10.5z',
      ink: 'M12 13.2a1.7 1.7 0 0 1 1 3.1v2.3h-2v-2.3a1.7 1.7 0 0 1 1-3.1z', shade: 'M4 16h16v4.3a1.2 1.2 0 0 1-1.2 1.2H5.2A1.2 1.2 0 0 1 4 20.3z',
    },
    unlock: {
      b: 'M6.6 10.5V7.6a5.4 5.4 0 0 1 10.6-1.5l-2.7.8a2.6 2.6 0 0 0-5.1.7v2.9z M5 10.5h14a1.2 1.2 0 0 1 1.2 1.2v8.6A1.2 1.2 0 0 1 19 21.5H5a1.2 1.2 0 0 1-1.2-1.2v-8.6A1.2 1.2 0 0 1 5 10.5z',
      ink: 'M12 13.2a1.7 1.7 0 0 1 1 3.1v2.3h-2v-2.3a1.7 1.7 0 0 1 1-3.1z', shade: 'M4 16h16v4.3a1.2 1.2 0 0 1-1.2 1.2H5.2A1.2 1.2 0 0 1 4 20.3z',
    },
    skull: {
      b: 'M12 2.2c-5 0-8.6 3.5-8.6 8.2 0 2.8 1.3 4.7 3.1 5.7v3.8a1.6 1.6 0 0 0 1.6 1.6h7.8a1.6 1.6 0 0 0 1.6-1.6v-3.8c1.8-1 3.1-2.9 3.1-5.7 0-4.7-3.6-8.2-8.6-8.2z',
      ink: 'M8.6 9.3a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4z M15.4 9.3a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4z M12 14.3l1.3 2.2h-2.6z M9.9 18.6h1.2v3H9.9z M12.9 18.6h1.2v3h-1.2z',
      hi: 'M6.3 8.2a6 6 0 0 1 4-3.6v1.7a4.4 4.4 0 0 0-2.6 2.4z',
    },
    shield: {
      b: 'M12 1.8l8.8 3.1v6.6c0 5.4-3.7 9.3-8.8 10.8-5.1-1.5-8.8-5.4-8.8-10.8V4.9z',
      accC: '#7d2b33', shade: 'M12 4.3v15.9c3.7-1.4 6.3-4.6 6.3-8.6V6.6z', acc: 'M12 7.5l1.4 2.9 3.2.4-2.3 2.2.6 3.2-2.9-1.6-2.9 1.6.6-3.2-2.3-2.2 3.2-.4z',
    },
    anchor: {
      b: 'M12 1.6a3.1 3.1 0 1 1 0 6.2 3.1 3.1 0 0 1 0-6.2z M10.7 7.4h2.6v12.4h-2.6z M7.4 9.4h9.2v2.4H7.4z M3.5 13a8.5 8.5 0 0 0 17 0h-3.4a5.1 5.1 0 0 1-10.2 0z M1.4 14.6l2.2-4.4 3.3 3.3z M22.6 14.6l-2.2-4.4-3.3 3.3z',
      ink: 'M12 3.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z',
    },
    check: { b: 'M2.8 12.6l3.1-3.1 4.1 4.1 8.1-8.1 3.1 3.1L10 19.8z' },
    cross: { b: 'M6 3.4l6 6 6-6L20.6 6l-6 6 6 6-2.6 2.6-6-6-6 6L3.4 18l6-6-6-6z' },
    sword: SWORD,
    swords: { parts: [SWORD, Object.assign({ flip: true }, SWORD)] },
    push: { b: 'M2.5 5.2l3.2-1.4L13.9 12l-8.2 8.2-3.2-1.4 6.6-6.8z M10.1 5.2l3.2-1.4L21.5 12l-8.2 8.2-3.2-1.4 6.6-6.8z' },
    rage: {
      b: 'M12 1.2c1.1 3.6 5.7 5.6 5.7 11.2 0 .8-.1 1.5-.3 2.2.9-.7 1.6-1.9 1.8-3.1 1.1 1.5 1.6 3.1 1.6 4.6 0 4.1-3.9 6.7-8.8 6.7s-8.8-2.6-8.8-6.7c0-3 1.7-5.1 3.4-6.9.1 1.6.6 2.9 1.6 3.7C8 8.3 10.4 5.7 12 1.2z',
      accC: '#fff1a8', acc: 'M12 11.5c.8 2.1 3.2 3.1 3.2 5.8 0 2.1-1.5 3.6-3.2 3.6s-3.2-1.5-3.2-3.4c0-1.6.9-2.5 1.7-3.3.2.8.5 1.4 1.1 1.7-.3-1.8-.2-3.2.4-4.4z',
    },
    home: { b: 'M12 2.2L22.3 11h-2.6v10.3H14v-6.2h-4v6.2H4.3V11H1.7z', shade: 'M12 4.9l-6 5.1v10.3h2.2V13.6h7.6v6.7H18V10z', hi: 'M12 2.2L1.7 11h2.1L12 4z' },
    map: {
      accC: '#d9434a', b: 'M2.2 5.3L8.5 2.7l7 2.6 6.3-2.6v16.1l-6.3 2.6-7-2.6-6.3 2.6z', shade: 'M8.5 2.7l7 2.6v16.1l-7-2.6z',
      acc: 'M15.6 8.6l1.2-1.2 1.4 1.4 1.4-1.4 1.1 1.1-1.4 1.4 1.4 1.4-1.1 1.1-1.4-1.4-1.4 1.4-1.2-1.2 1.4-1.3z M4 15.4l1.4-.9.7 1.1-1.4.9z M6.3 13.6l1.2-1.1.9 1-1.2 1.1z M9.3 12.4l1.5-.4.3 1.3-1.5.4z M12.3 12.8l1.3.7-.6 1.2-1.3-.7z',
    },
    book: {
      b: 'M4.2 3.2h12.4a3 3 0 0 1 3 3v15.3H6.7a2.5 2.5 0 0 1-2.5-2.5z', shade: 'M4.2 3.2h3v15.4H6.7a2.5 2.5 0 0 0-2.5 2.2z',
      accC: '#3fe3ff', ink: 'M6.7 18.1h12.9v1.5H6.7z', acc: 'M13.2 6.6l2.8 2.8-2.8 2.8-2.8-2.8z',
    },
    gear: { b: gear(8, 11, 8.2), ink: 'M12 8.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8z', shade: 'M12 3.8a8.2 8.2 0 0 1 0 16.4v-2.6a5.6 5.6 0 0 0 0-11.2z' },
    retry: { b: 'M12 3.4a8.6 8.6 0 1 1-8.2 11.2l3.1-1A5.4 5.4 0 1 0 12 6.6v2.9L6.8 5 12 .5z' },
    eye: {
      b: 'M12 4.8C6.4 4.8 2.4 9.4 1.3 12c1.1 2.6 5.1 7.2 10.7 7.2s9.6-4.6 10.7-7.2C21.6 9.4 17.6 4.8 12 4.8z',
      ink: 'M12 7.8a4.2 4.2 0 1 1 0 8.4 4.2 4.2 0 0 1 0-8.4z', hi: 'M13.3 9.1a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8z',
    },
    trash: {
      b: 'M3.8 5.2h16.4v2.7H3.8z M9 2.2h6l1.1 3H7.9z M5.4 9h13.2l-1.2 11.6a1.6 1.6 0 0 1-1.6 1.4H8.2a1.6 1.6 0 0 1-1.6-1.4z',
      ink: 'M9 11h1.8v8.6H9z M13.2 11H15v8.6h-1.8z',
    },
    music: { b: 'M8.6 3.6L20.4 1.4v14.1a3.3 3.3 0 1 1-2.3-3.1V6.2l-7.2 1.4v10.2a3.3 3.3 0 1 1-2.3-3.1z' },
    sound: { b: 'M2.6 8.6h4.2l5.4-4.6v16l-5.4-4.6H2.6z M15 8a5.3 5.3 0 0 1 0 8l-1.6-1.6a3 3 0 0 0 0-4.8z M17.8 5.2a9.2 9.2 0 0 1 0 13.6l-1.6-1.6a6.9 6.9 0 0 0 0-10.4z' },
    vibe: {
      b: 'M7.6 2.4h8.8a1.6 1.6 0 0 1 1.6 1.6v16a1.6 1.6 0 0 1-1.6 1.6H7.6A1.6 1.6 0 0 1 6 20V4a1.6 1.6 0 0 1 1.6-1.6z M1.6 7.5h2.2v9H1.6z M20.2 7.5h2.2v9h-2.2z',
      ink: 'M8.2 4.8h7.6v12.4H8.2z',
    },
    bolt: { b: 'M14 1.2L3.8 13.6h6.8L8.8 22.8 20.2 9.8h-6.9z', hi: 'M13 4.6l-6 7.4h2.5z' },
    sparkle: { b: 'M10.5 1.4l2.3 7 7 2.3-7 2.3-2.3 7-2.3-7-7-2.3 7-2.3z M18.5 14.6l1.2 2.8 2.9 1.2-2.9 1.2-1.2 2.8-1.2-2.8-2.9-1.2 2.9-1.2z' },
    chat: { b: 'M3.4 3.6h17.2a1.6 1.6 0 0 1 1.6 1.6v10.2a1.6 1.6 0 0 1-1.6 1.6H10.4l-5.4 4.6v-4.6H3.4a1.6 1.6 0 0 1-1.6-1.6V5.2a1.6 1.6 0 0 1 1.6-1.6z', ink: 'M6 8.4h12v1.8H6z M6 11.8h8v1.8H6z' },
    scroll: {
      b: 'M6.2 2.6h12.3a2.7 2.7 0 0 1 0 5.4h-1.1v11.3a2.7 2.7 0 0 1-2.7 2.7H5a2.7 2.7 0 0 1 0-5.4h1.2z', shade: 'M16.2 2.6h2.3a2.7 2.7 0 0 1 0 5.4h-2.3z',
      ink: 'M9 10h5.6v1.6H9z M9 13.4h5.6V15H9z',
    },
    helm: {
      b: 'M12 2.2c5.1 0 8.7 3.9 8.7 9.2v9h-6.2v-5.6h-5v5.6H3.3v-9c0-5.3 3.6-9.2 8.7-9.2z',
      accC: '#e5484d', ink: 'M5.8 10h12.4v2.4H5.8z', acc: 'M11 1.2h2v5h-2z', hi: 'M6 8.6a6.4 6.4 0 0 1 4.4-4.4v1.7a4.8 4.8 0 0 0-2.8 2.7z',
    },
    image: {
      accC: '#6fd884', b: 'M2.8 4.2h18.4v15.6H2.8z', ink: 'M5 6.4h14v11.2H5z',
      acc: 'M5 17.6l4.8-6 3.4 4 2.1-2.2 3.7 4.2z M15.6 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z',
    },
    flag: { b: 'M4.2 2h2.6v20H4.2z M6.8 3.2h12.8l-2.8 4.6 2.8 4.6H6.8z', shade: 'M6.8 9.6h12.8l-1.3 2.8H6.8z' },
    trophy: {
      b: 'M6 2.4h12v6.8a6 6 0 0 1-4.6 5.8v2.9h3.4v3.7H7.2v-3.7h3.4V15A6 6 0 0 1 6 9.2z M2.2 4h3.2v2.5H4.5a2.1 2.1 0 0 0 1.6 3.4l.4 2.3A4.5 4.5 0 0 1 2.2 7.8z M21.8 4h-3.2v2.5h.9a2.1 2.1 0 0 1-1.6 3.4l-.4 2.3a4.5 4.5 0 0 0 4.3-4.4z',
      hi: 'M8 4h1.8v5.4a4 4 0 0 0 1.4 3.1l-.8 1.1A5 5 0 0 1 8 9.3z',
    },
    arrow: ARROW,
    chev: { b: 'M8.8 3.5l-3 3 5.5 5.5-5.5 5.5 3 3L17.3 12z' },
  };
  const LAYERS = [['shade', '#000', 0.28], ['hi', '#fff', 0.42], ['ink', LINE, 1], ['acc', null, 1]];
  const partsOf = n => { const ic = ICONS[n] || ICONS.star; return ic.parts || [ic]; };

  // ---------- SVG (HTML UI) ----------
  // icon('star') -> '<svg class="ic ic-star">…</svg>'. Colour = currentColor; accent via --ic-acc.
  // rot: degrees (arrows), cls: extra classes, title: accessible label (otherwise aria-hidden).
  function icon(name, o) {
    o = o || {};
    let g = '';
    for (const p of partsOf(name)) {
      let s = `<path class="ic-b" d="${p.b}"/>`;
      for (const [k, col, a] of LAYERS) if (p[k]) s += `<path d="${p[k]}" fill="${col || `var(--ic-acc,${p.accC || '#ffd76a'})`}"${a < 1 ? ` fill-opacity="${a}"` : ''}/>`;
      g += p.flip ? `<g transform="matrix(-1 0 0 1 24 0)">${s}</g>` : s;
    }
    if (o.rot) g = `<g transform="rotate(${o.rot} 12 12)">${g}</g>`;
    const lab = o.title ? `role="img" aria-label="${o.title}"` : 'aria-hidden="true"';
    return `<svg class="ic ic-${name}${o.cls ? ' ' + o.cls : ''}" viewBox="-1.5 -1.5 27 27" ${lab}>${g}</svg>`;
  }

  // ---------- Canvas (board) ----------
  const P2D = {};
  const path = d => P2D[d] || (P2D[d] = new Path2D(d));
  // drawIcon(ctx, 'skull', cx, cy, sizePx, '#e8e0cc', { rot, acc, line })
  function drawIcon(ctx, name, cx, cy, size, color, o) {
    o = o || {};
    ctx.save();
    ctx.translate(cx, cy);
    if (o.rot) ctx.rotate(o.rot * Math.PI / 180);
    ctx.scale(size / 24, size / 24); ctx.translate(-12, -12);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const p of partsOf(name)) {
      ctx.save();
      if (p.flip) ctx.transform(-1, 0, 0, 1, 24, 0);
      const b = path(p.b);
      ctx.strokeStyle = o.line || LINE; ctx.lineWidth = o.lw || 3.2; ctx.globalAlpha = 1; ctx.stroke(b);
      ctx.fillStyle = color; ctx.fill(b);
      for (const [k, col, a] of LAYERS) if (p[k]) { ctx.globalAlpha = a; ctx.fillStyle = col || o.acc || p.accC || '#ffd76a'; ctx.fill(path(p[k])); }
      ctx.restore();
    }
    ctx.restore();
  }

  // 8 push directions (sim DIRS index 0..7, clockwise from up) -> arrow icon rotation.
  const dirIcon = (d, o) => icon('arrow', Object.assign({ rot: d * 45 }, o || {}));

  // Static markup: <i data-ic="x"> is replaced by the icon; any other [data-ic] element gets it prepended.
  function hydrate(root) {
    for (const el of (root || document).querySelectorAll('[data-ic]')) {
      const svg = icon(el.dataset.ic);
      if (el.tagName === 'I') el.outerHTML = svg; else { el.insertAdjacentHTML('afterbegin', svg); el.removeAttribute('data-ic'); }
    }
  }
  if (document.readyState !== 'loading') hydrate(); else document.addEventListener('DOMContentLoaded', () => hydrate());

  window.ICONS = { icon, drawIcon, dirIcon, hydrate, list: Object.keys(ICONS) };
})();
