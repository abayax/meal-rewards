// All sounds are synthesized with the Web Audio API, so no audio files are needed.
const Sounds = (() => {
  let ctx = null;
  let enabled = true;
  let ringTimer = null;

  // iOS only allows audio after a user gesture; call this from a tap handler.
  function unlock() {
    // Let sound play even when the iPhone silent switch is on (Safari 17+).
    if (navigator.audioSession) {
      try { navigator.audioSession.type = 'playback'; } catch (e) {}
    }
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, start, dur, { type = 'sine', vol = 0.25, slideTo = null } = {}) {
    if (!ctx || !enabled) return;
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  const N = { C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880, B5: 988, C6: 1047, E6: 1319, G6: 1568 };

  return {
    unlock,
    setEnabled(on) { enabled = on; if (!on) this.stopRing(); },

    coin() {
      tone(N.B5, 0, 0.08, { type: 'square', vol: 0.12 });
      tone(N.E6, 0.07, 0.3, { type: 'square', vol: 0.12 });
    },

    undo() { tone(500, 0, 0.15, { type: 'triangle', vol: 0.15, slideTo: 300 }); },

    nope() {
      tone(330, 0, 0.12, { type: 'triangle', vol: 0.15 });
      tone(262, 0.12, 0.18, { type: 'triangle', vol: 0.15 });
    },

    sparkle() {
      [N.C6, N.E6, N.G6, N.C6 * 2].forEach((f, i) => tone(f, i * 0.07, 0.25, { vol: 0.15 }));
      [0.35, 0.6, 0.85].forEach(t => tone(120, t, 0.25, { type: 'triangle', vol: 0.3, slideTo: 40 }));
    },

    fanfare() {
      const seq = [
        [N.C5, 0, 0.15], [N.E5, 0.15, 0.15], [N.G5, 0.3, 0.15], [N.C6, 0.45, 0.4],
        [N.G5, 0.85, 0.15], [N.C6, 1.0, 0.8],
      ];
      seq.forEach(([f, t, d]) => {
        tone(f, t, d + 0.1, { type: 'triangle', vol: 0.25 });
        tone(f / 2, t, d + 0.1, { type: 'sine', vol: 0.15 });
      });
      [1.9, 2.2, 2.5, 2.8].forEach(t => tone(150, t, 0.3, { type: 'triangle', vol: 0.3, slideTo: 40 }));
    },

    start() {
      [N.C5, N.E5, N.G5].forEach((f, i) => tone(f, i * 0.1, 0.2, { type: 'triangle', vol: 0.2 }));
    },

    warn() {
      tone(N.A5, 0, 0.25, { vol: 0.2 });
      tone(N.F5, 0.3, 0.4, { vol: 0.2 });
    },

    // Phone-style ringtone, repeats until stopRing() (or ~20 seconds).
    ring() {
      this.stopRing();
      let n = 0;
      const once = () => {
        for (let i = 0; i < 6; i++) {
          tone(i % 2 ? N.E6 : N.C6, i * 0.09, 0.08, { type: 'square', vol: 0.1 });
        }
        if (++n >= 12) this.stopRing();
      };
      once();
      ringTimer = setInterval(once, 1600);
    },
    stopRing() { clearInterval(ringTimer); ringTimer = null; },

    sad() {
      [N.G5, N.F5, N.E5, N.C5 * 0.9].forEach((f, i) => tone(f / 2, i * 0.35, 0.4, { type: 'triangle', vol: 0.2 }));
    },
  };
})();
