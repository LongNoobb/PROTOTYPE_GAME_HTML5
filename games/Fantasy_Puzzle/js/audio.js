// Procedural SFX + light music (WebAudio). No external audio files needed.
(function () {
  'use strict';
  let ctx = null, sfxGain, musGain, musicTimer = null, musicOn = false;
  const vol = { sfx: 0.7, music: 0.35 };
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC();
    sfxGain = ctx.createGain(); sfxGain.gain.value = vol.sfx; sfxGain.connect(ctx.destination);
    musGain = ctx.createGain(); musGain.gain.value = vol.music * 0.25; musGain.connect(ctx.destination);
    return true;
  }
  function tone(f, d, type, g, when, slide, dest) {
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator(), a = ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + d);
    a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(g || 0.2, t + 0.008); a.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(a); a.connect(dest || sfxGain); o.start(t); o.stop(t + d + 0.02);
  }
  function noise(d, g, when, hp, lp) {
    const t = ctx.currentTime + (when || 0);
    const len = Math.floor(ctx.sampleRate * d), buf = ctx.createBuffer(1, len, ctx.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = hp || 1200; f.Q.value = 0.8;
    const a = ctx.createGain(); a.gain.value = g || 0.3;
    s.connect(f); f.connect(a); a.connect(sfxGain); s.start(t);
  }
  const SFX = {
    select: () => tone(880, 0.06, 'square', 0.08),
    tap: () => tone(620, 0.04, 'triangle', 0.08),
    swap: () => { tone(520, 0.06, 'square', 0.08); tone(780, 0.07, 'square', 0.08, 0.06); },
    order: () => tone(440, 0.05, 'triangle', 0.12),
    skill: () => { tone(660, 0.05, 'square', 0.07); tone(990, 0.06, 'square', 0.06, 0.04); },
    dir: () => tone(740, 0.05, 'triangle', 0.1),
    hit: () => { noise(0.12, 0.35, 0, 1800); tone(180, 0.1, 'square', 0.12, 0, 90); },
    slash: () => noise(0.16, 0.25, 0, 3200),
    shoot: () => { noise(0.1, 0.18, 0, 4200); tone(1200, 0.08, 'triangle', 0.05, 0, 600); },
    magic: () => { tone(520, 0.25, 'sine', 0.12, 0, 1300); tone(780, 0.2, 'triangle', 0.06, 0.05, 1560); },
    push: () => { noise(0.22, 0.25, 0, 600); tone(300, 0.2, 'sawtooth', 0.06, 0, 120); },
    collide: () => { noise(0.18, 0.5, 0, 300); tone(90, 0.2, 'square', 0.2, 0, 50); },
    rage: () => { [392, 494, 587, 784].forEach((f, i) => tone(f, 0.25, 'sawtooth', 0.07, i * 0.06)); noise(0.4, 0.2, 0.2, 900); },
    die: () => tone(400, 0.25, 'square', 0.08, 0, 80),
    fail: () => { tone(160, 0.15, 'square', 0.1); tone(130, 0.2, 'square', 0.1, 0.12); },
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'square', 0.09, i * 0.09)),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, i * 0.14)),
    star: () => tone(1320, 0.12, 'square', 0.08),
  };
  function play(name) { if (!vol.sfx || !ensure()) return; try { SFX[name] && SFX[name](); } catch (e) { /* ignore */ } }

  // simple modal loop (pentatonic), soft triangle + bass
  const SCALE = [0, 3, 5, 7, 10, 12, 15];
  let step = 0;
  function musicTick() {
    if (!ctx || !musicOn) return;
    const base = 220, bar = Math.floor(step / 8) % 4, chord = [0, -4, -2, -5][bar];
    if (step % 8 === 0) tone(base / 2 * Math.pow(2, chord / 12), 1.6, 'triangle', 0.18, 0, null, musGain);
    if (Math.random() < 0.7) {
      const n = SCALE[(step * 5 + bar * 2 + (Math.random() * 3 | 0)) % SCALE.length];
      tone(base * 2 * Math.pow(2, (n + chord) / 12), 0.35, 'sine', 0.12, 0, null, musGain);
    }
    step++;
  }
  function setMusic(on) {
    musicOn = on && vol.music > 0;
    if (musicOn && ensure()) { if (!musicTimer) musicTimer = setInterval(musicTick, 280); }
    else if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }
  function setVolume(kind, v) {
    vol[kind] = v;
    if (!ctx) return;
    if (kind === 'sfx') sfxGain.gain.value = v;
    else { musGain.gain.value = v * 0.25; if (v === 0) setMusic(false); }
  }
  window.AUDIO = { play, setMusic, setVolume, ensure, get musicOn() { return musicOn; } };
})();
