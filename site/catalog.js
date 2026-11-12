(() => {
  'use strict';

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const hoverPointer = matchMedia('(hover: hover) and (pointer: fine)');
  const previews = [];
  let active = null;

  for (const card of document.querySelectorAll('.game')) {
    const video = card.querySelector('.game-demo');
    if (!video) continue;

    let hovered = false;
    let focused = false;
    let visible = true;
    let dismissed = false;
    let failed = false;
    let generation = 0;
    const wanted = () => ((hovered && hoverPointer.matches) || focused) && visible && !dismissed && !failed
      && !document.hidden && !reducedMotion.matches;

    const stop = () => {
      generation++;
      video.pause();
      card.classList.remove('is-previewing');
      if (video.readyState > 0) video.currentTime = 0;
      if (active === preview) active = null;
    };

    const update = () => {
      if (!wanted()) { stop(); return; }
      if (active === preview) return;
      active?.stop();
      active = preview;
      const request = ++generation;
      // Keep the still image visible until the browser has a frame to show.
      video.muted = true;
      if (!video.hasAttribute('src')) video.src = video.dataset.src;
      video.play().then(() => {
        if (request === generation && wanted()) card.classList.add('is-previewing');
      }).catch(() => {
        // A cancelled play request must not stop a newer hover on this card.
        if (request === generation) stop();
      });
    };

    const preview = { card, stop, update, dismiss() { dismissed = true; stop(); }, setVisible(value) { visible = value; update(); } };
    previews.push(preview);
    card.classList.add('preview-enabled');
    card.addEventListener('pointerenter', event => {
      if (!hoverPointer.matches || event.pointerType === 'touch') return;
      hovered = true;
      dismissed = false;
      update();
    });
    card.addEventListener('pointerleave', () => { hovered = false; update(); });
    card.addEventListener('focus', () => {
      focused = card.matches(':focus-visible');
      dismissed = false;
      update();
    });
    card.addEventListener('blur', () => { focused = false; update(); });
    video.addEventListener('error', () => {
      failed = true;
      card.classList.remove('preview-enabled');
      stop();
    });
    video.addEventListener('waiting', () => card.classList.remove('is-previewing'));
    video.addEventListener('playing', () => {
      if (active === preview && wanted()) card.classList.add('is-previewing');
      else video.pause();
    });
  }

  if ('IntersectionObserver' in window) {
    const byCard = new Map(previews.map(preview => [preview.card, preview]));
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) byCard.get(entry.target).setVisible(entry.isIntersecting);
    });
    for (const preview of previews) observer.observe(preview.card);
  }

  reducedMotion.addEventListener('change', () => previews.forEach(preview => preview.update()));
  hoverPointer.addEventListener('change', () => previews.forEach(preview => preview.stop()));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') active?.dismiss();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) previews.forEach(preview => preview.stop());
  });
  addEventListener('pagehide', () => previews.forEach(preview => preview.stop()));
})();
