(() => {
  "use strict";

  const bank = window.BakerySfxBank;
  const Audio = window.AudioContext || window.webkitAudioContext;
  const varied = new Set(["click","lift","fit","wait"]);
  const buffers = new Map();
  const lastStart = new Map();
  const voices = new Set();
  let context, output;
  let enabled = true;
  let generation = 0;

  function stop() {
    generation++;
    for (const voice of voices) voice.stop();
    voices.clear();
    lastStart.clear();
  }

  function setEnabled(value) {
    enabled = value;
    if (!enabled) stop();
  }

  async function play(kind, delay = 0) {
    if (!enabled || document.hidden || !Audio || !bank?.[kind] ||
        navigator.userActivation?.hasBeenActive === false) return;
    const requested = performance.now();
    const current = generation;
    const first = !context;
    try {
      if (!context) {
        context = new Audio();
        output = context.createGain();
        output.gain.value = .8;
        output.connect(context.destination);
      }
      const ready = context.state === "running" ? undefined : context.resume();
      if (!buffers.has(kind)) {
        const bytes = Uint8Array.from(atob(bank[kind]), character => character.charCodeAt(0));
        buffers.set(kind,context.decodeAudioData(bytes.buffer));
      }
      const [buffer] = await Promise.all([buffers.get(kind),ready]);
      const elapsed = performance.now()-requested;
      // The first gesture also starts the browser's audio output device.
      if (current !== generation || elapsed > (first ? 400 : 120)+delay*1000) return;
      const start = context.currentTime+Math.max(0,delay-elapsed/1000);
      // Several waiting cookies can arrive on the same frame.
      if (Math.abs(start-(lastStart.get(kind) ?? -1)) < .04) return;
      lastStart.set(kind,start);
      if (voices.size >= 8) {
        const oldest = voices.values().next().value;
        oldest.stop();
        voices.delete(oldest);
      }
      const voice = context.createBufferSource();
      voice.buffer = buffer;
      if (varied.has(kind)) voice.playbackRate.value = .96+Math.random()*.08;
      voice.connect(output);
      voice.onended = () => {
        voices.delete(voice);
        voice.disconnect();
      };
      voice.start(start);
      voices.add(voice);
    } catch {
      // Audio is optional on devices that cannot start or decode Web Audio.
    }
  }

  document.addEventListener("visibilitychange",() => { if (document.hidden) stop(); });
  window.BakerySfx = { play, setEnabled };
})();
