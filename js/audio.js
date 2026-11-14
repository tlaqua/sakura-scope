(function () {
  "use strict";

  const AudioEngine = {
    ctx: null,
    masterGain: null,
    reverbNode: null,
    reverbSend: null,
    noiseBuffer: null,
    windGainLow: null,
    windGainHigh: null,
    windFilterLow: null,
    windFilterHigh: null,
    nightCricketGain: null,
    muted: false,
    initialized: false,
    timePhase: 0,
    windSeedOffset: Math.random() * 100,

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();

        // Master compressor + gain for clean, warm dynamics without clipping
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.knee.value = 18;
        comp.ratio.value = 3.5;
        comp.attack.value = 0.002;
        comp.release.value = 0.18;

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.85;

        comp.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
        this.bus = comp;

        this.noiseBuffer = this._createPinkNoiseBuffer(4.0);
        this._setupValleyReverb();
        this._startAmbientWind();
        this.initialized = true;
      }

      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
    },

    _createPinkNoiseBuffer(seconds) {
      const sr = this.ctx.sampleRate;
      const len = Math.floor(sr * seconds);
      const buf = this.ctx.createBuffer(2, len, sr);
      for (let ch = 0; ch < 2; ch++) {
        const data = buf.getChannelData(ch);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < len; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }
      }
      return buf;
    },

    _setupValleyReverb() {
      const sr = this.ctx.sampleRate;
      const duration = 2.5;
      const len = Math.floor(sr * duration);
      const impulse = this.ctx.createBuffer(2, len, sr);

      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const t = i / len;
          // Natural outdoor hillside echo decay (smooth rolloff, soft early slapback)
          const env = Math.pow(1 - t, 2.7) * (1 + 0.25 * Math.sin(t * 28));
          const white = Math.random() * 2 - 1;
          lp = lp * 0.72 + white * 0.28;
          data[i] = lp * env;
        }
      }

      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = impulse;

      const reverbFilter = this.ctx.createBiquadFilter();
      reverbFilter.type = "lowpass";
      reverbFilter.frequency.value = 2200;

      this.reverbSend = this.ctx.createGain();
      this.reverbSend.gain.value = 0.48;

      this.reverbSend.connect(this.reverbNode);
      this.reverbNode.connect(reverbFilter);
      reverbFilter.connect(this.bus);
    },

    _startAmbientWind() {
      const ctx = this.ctx;

      // 1) Low warm breeze across the hillside
      const srcLow = ctx.createBufferSource();
      srcLow.buffer = this.noiseBuffer;
      srcLow.loop = true;

      this.windFilterLow = ctx.createBiquadFilter();
      this.windFilterLow.type = "bandpass";
      this.windFilterLow.frequency.value = 260;
      this.windFilterLow.Q.value = 1.15;

      this.windGainLow = ctx.createGain();
      this.windGainLow.gain.value = 0.11;

      srcLow.connect(this.windFilterLow);
      this.windFilterLow.connect(this.windGainLow);
      this.windGainLow.connect(this.bus);
      srcLow.start();

      // 2) Delicate high airy blossom rustle
      const srcHigh = ctx.createBufferSource();
      srcHigh.buffer = this.noiseBuffer;
      srcHigh.loop = true;
      srcHigh.playbackRate.value = 1.07;

      this.windFilterHigh = ctx.createBiquadFilter();
      this.windFilterHigh.type = "bandpass";
      this.windFilterHigh.frequency.value = 1500;
      this.windFilterHigh.Q.value = 0.9;

      this.windGainHigh = ctx.createGain();
      this.windGainHigh.gain.value = 0.028;

      srcHigh.connect(this.windFilterHigh);
      this.windFilterHigh.connect(this.windGainHigh);
      this.windGainHigh.connect(this.bus);
      srcHigh.start();

      // 3) Very faint tranquil nocturnal shimmer / distant crickets at nighttime
      const nightOsc = ctx.createOscillator();
      nightOsc.type = "sine";
      nightOsc.frequency.value = 4150;

      const lfoAmp = ctx.createOscillator();
      lfoAmp.type = "sine";
      lfoAmp.frequency.value = 14;
      const lfoAmpGain = ctx.createGain();
      lfoAmpGain.gain.value = 0.5;

      const pulseGain = ctx.createGain();
      pulseGain.gain.value = 0.5;
      lfoAmp.connect(lfoAmpGain);
      lfoAmpGain.connect(pulseGain.gain);

      this.nightCricketGain = ctx.createGain();
      this.nightCricketGain.gain.value = 0.0;

      nightOsc.connect(pulseGain);
      pulseGain.connect(this.nightCricketGain);
      this.nightCricketGain.connect(this.bus);

      nightOsc.start();
      lfoAmp.start();
    },

    getWindLevel(timeSec) {
      const t = (timeSec || performance.now() * 0.001) + this.windSeedOffset;
      const slow = Math.sin(t * 0.24) * 0.5 + 0.5;
      const med = Math.sin(t * 0.61 + 1.3) * 0.5 + 0.5;
      const ripple = Math.sin(t * 1.13 + 2.7) * 0.5 + 0.5;
      return 0.25 + slow * 0.42 + med * 0.23 + ripple * 0.1;
    },

    updateWind(timeSec, timePhase) {
      this.timePhase = timePhase;
      if (!this.initialized || !this.ctx) return;

      const gust = this.getWindLevel(timeSec);
      const now = this.ctx.currentTime;

      const lowFreq = 180 + gust * 220 - timePhase * 45;
      const highFreq = 1150 + gust * 850 - timePhase * 240;

      this.windFilterLow.frequency.setTargetAtTime(lowFreq, now, 0.2);
      this.windFilterHigh.frequency.setTargetAtTime(highFreq, now, 0.2);

      this.windGainLow.gain.setTargetAtTime(0.065 + gust * 0.095, now, 0.25);
      this.windGainHigh.gain.setTargetAtTime((0.012 + gust * 0.036) * (1 - timePhase * 0.35), now, 0.25);

      // Subtle night stillness cricket shimmer pulsing gently in and out
      const nightPulse = Math.max(0, Math.sin(timeSec * 0.85) * 0.5 + 0.35);
      this.nightCricketGain.gain.setTargetAtTime(timePhase * 0.0028 * nightPulse, now, 0.2);
    },

    setMuted(flag) {
      this.muted = !!flag;
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime, 0.04);
      }
    },

    toggleMute() {
      this.setMuted(!this.muted);
      return this.muted;
    },

    isMuted() {
      return this.muted;
    },

    // Multi-layered crisp sniper shot with valley echo
    playShot(distanceMeters) {
      if (!this.initialized || !this.ctx || this.muted) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;

      // 1) Crisp mechanical sear click
      const clickNoise = ctx.createBufferSource();
      clickNoise.buffer = this.noiseBuffer;
      const clickHp = ctx.createBiquadFilter();
      clickHp.type = "highpass";
      clickHp.frequency.value = 3200;
      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(0.28, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);
      clickNoise.connect(clickHp);
      clickHp.connect(clickGain);
      clickGain.connect(this.bus);
      clickNoise.start(now);
      clickNoise.stop(now + 0.02);

      // 2) Tactile sub-bass rifle punch
      const sub = ctx.createOscillator();
      sub.type = "triangle";
      sub.frequency.setValueAtTime(138, now + 0.002);
      sub.frequency.exponentialRampToValueAtTime(34, now + 0.13);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.linearRampToValueAtTime(0.65, now + 0.005);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      sub.connect(subGain);
      subGain.connect(this.bus);
      sub.start(now);
      sub.stop(now + 0.18);

      // 3) Sharp muzzle transient crack + valley echo
      const crack = ctx.createBufferSource();
      crack.buffer = this.noiseBuffer;
      const crackFilter = ctx.createBiquadFilter();
      crackFilter.type = "lowpass";
      crackFilter.frequency.setValueAtTime(7200, now + 0.002);
      crackFilter.frequency.exponentialRampToValueAtTime(420, now + 0.18);

      const crackGain = ctx.createGain();
      crackGain.gain.setValueAtTime(0.001, now);
      crackGain.gain.linearRampToValueAtTime(0.95, now + 0.004);
      crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

      const echoSend = ctx.createGain();
      echoSend.gain.value = 0.72;

      crack.connect(crackFilter);
      crackFilter.connect(crackGain);
      crackGain.connect(this.bus);
      crackGain.connect(echoSend);
      echoSend.connect(this.reverbSend);

      crack.start(now);
      crack.stop(now + 0.22);

      // 4) Faint air-cut whistle for long shots (> 140m)
      if (distanceMeters > 140) {
        const flightTime = Math.min(0.28, distanceMeters / 1350);
        const air = ctx.createBufferSource();
        air.buffer = this.noiseBuffer;
        const airBp = ctx.createBiquadFilter();
        airBp.type = "bandpass";
        airBp.Q.value = 3.2;
        airBp.frequency.setValueAtTime(2800, now + 0.02);
        airBp.frequency.exponentialRampToValueAtTime(1100, now + flightTime);
        const airGain = ctx.createGain();
        airGain.gain.setValueAtTime(0.001, now + 0.02);
        airGain.gain.linearRampToValueAtTime(0.08, now + 0.05);
        airGain.gain.exponentialRampToValueAtTime(0.001, now + flightTime);
        air.connect(airBp);
        airBp.connect(airGain);
        airGain.connect(this.bus);
        air.start(now + 0.02);
        air.stop(now + flightTime + 0.02);
      }
    },

    // Juicy, organic, satisfying SPLAT
    playSplat(isHeadshot, distanceMeters) {
      if (!this.initialized || !this.ctx || this.muted) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const distAtten = Math.max(0.68, 1 - (distanceMeters - 60) / 800);

      // 1) Wet body thump
      const thump = ctx.createOscillator();
      thump.type = "sine";
      thump.frequency.setValueAtTime(isHeadshot ? 190 : 155, now);
      thump.frequency.exponentialRampToValueAtTime(42, now + 0.09);

      const thumpGain = ctx.createGain();
      thumpGain.gain.setValueAtTime(0.68 * distAtten, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      thump.connect(thumpGain);
      thumpGain.connect(this.bus);
      thump.start(now);
      thump.stop(now + 0.12);

      // 2) Staggered wet squelch bursts (resonating bandpass sweeps)
      const bursts = [
        { delay: 0.0, fStart: 2500, fEnd: 340, q: 4.5, dur: 0.09, gain: 0.92 },
        { delay: 0.015, fStart: 1750, fEnd: 210, q: 5.8, dur: 0.12, gain: 0.85 },
        { delay: 0.034, fStart: 1120, fEnd: 170, q: 5.0, dur: 0.14, gain: 0.72 },
        { delay: 0.062, fStart: 2900, fEnd: 680, q: 6.5, dur: 0.08, gain: 0.45 },
      ];

      bursts.forEach((b, idx) => {
        const t0 = now + b.delay;
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        src.playbackRate.value = 0.85 + idx * 0.18;

        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.Q.value = b.q;
        bp.frequency.setValueAtTime(b.fStart, t0);
        bp.frequency.exponentialRampToValueAtTime(b.fEnd, t0 + b.dur);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, t0);
        g.gain.linearRampToValueAtTime(b.gain * distAtten, t0 + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + b.dur);

        src.connect(bp);
        bp.connect(g);
        g.connect(this.bus);
        g.connect(this.reverbSend);
        src.start(t0, Math.random() * 1.5, b.dur + 0.03);
      });

      // 3) Wet droplet pops
      for (let i = 0; i < 4; i++) {
        const dt = 0.025 + i * 0.024 + Math.random() * 0.015;
        const pop = ctx.createOscillator();
        pop.type = "sine";
        const base = 650 + Math.random() * 900;
        pop.frequency.setValueAtTime(base, now + dt);
        pop.frequency.exponentialRampToValueAtTime(base * 0.35, now + dt + 0.035);

        const pg = ctx.createGain();
        pg.gain.setValueAtTime(0.14 * distAtten, now + dt);
        pg.gain.exponentialRampToValueAtTime(0.001, now + dt + 0.04);

        pop.connect(pg);
        pg.connect(this.bus);
        pop.start(now + dt);
        pop.stop(now + dt + 0.045);
      }

      // 4) Extra crisp visceral snap + subtle glass-bell overtone on headshot
      if (isHeadshot) {
        const crunch = ctx.createBufferSource();
        crunch.buffer = this.noiseBuffer;
        const hp = ctx.createBiquadFilter();
        hp.type = "bandpass";
        hp.frequency.value = 3400;
        hp.Q.value = 2.0;
        const cg = ctx.createGain();
        cg.gain.setValueAtTime(0.45 * distAtten, now);
        cg.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
        crunch.connect(hp);
        hp.connect(cg);
        cg.connect(this.bus);
        crunch.start(now, 0.2, 0.07);

        const chime = ctx.createOscillator();
        chime.type = "sine";
        chime.frequency.setValueAtTime(1046.5, now + 0.02);
        const chg = ctx.createGain();
        chg.gain.setValueAtTime(0.001, now + 0.02);
        chg.gain.linearRampToValueAtTime(0.09, now + 0.035);
        chg.gain.exponentialRampToValueAtTime(0.0005, now + 0.45);
        chime.connect(chg);
        chg.connect(this.reverbSend);
        chg.connect(this.bus);
        chime.start(now + 0.02);
        chime.stop(now + 0.48);
      }
    },

    // Crisp mechanical bolt cycle after landing a kill
    playBoltCycle() {
      if (!this.initialized || !this.ctx || this.muted) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;

      const steps = [
        { t: 0.0, freq: 2100, dur: 0.024, gain: 0.16 },
        { t: 0.08, freq: 1450, dur: 0.03, gain: 0.14 },
        { t: 0.22, freq: 1750, dur: 0.028, gain: 0.18 },
        { t: 0.28, freq: 2600, dur: 0.02, gain: 0.2 },
      ];

      steps.forEach((s) => {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = s.freq;
        bp.Q.value = 5.5;
        const g = ctx.createGain();
        g.gain.setValueAtTime(s.gain, now + s.t);
        g.gain.exponentialRampToValueAtTime(0.001, now + s.t + s.dur);
        src.connect(bp);
        bp.connect(g);
        g.connect(this.bus);
        src.start(now + s.t, 0.5, s.dur + 0.01);
      });
    },

    playMiss(surfaceType, distanceMeters) {
      if (!this.initialized || !this.ctx || this.muted) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;

      if (surfaceType === "stone") {
        // Distant stone ricochet ping
        const ping = ctx.createOscillator();
        ping.type = "sine";
        ping.frequency.setValueAtTime(2150, now);
        ping.frequency.exponentialRampToValueAtTime(920, now + 0.18);
        const pg = ctx.createGain();
        pg.gain.setValueAtTime(0.22, now);
        pg.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        ping.connect(pg);
        pg.connect(this.bus);
        pg.connect(this.reverbSend);
        ping.start(now);
        ping.stop(now + 0.24);
      } else if (surfaceType === "wood") {
        // Hollow wood thump
        const wood = ctx.createOscillator();
        wood.type = "triangle";
        wood.frequency.setValueAtTime(260, now);
        wood.frequency.exponentialRampToValueAtTime(95, now + 0.08);
        const wg = ctx.createGain();
        wg.gain.setValueAtTime(0.32, now);
        wg.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        wood.connect(wg);
        wg.connect(this.bus);
        wg.connect(this.reverbSend);
        wood.start(now);
        wood.stop(now + 0.12);
      } else if (surfaceType === "earth") {
        // Soft dirt thud
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(650, now);
        lp.frequency.exponentialRampToValueAtTime(140, now + 0.12);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.36, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        src.connect(lp);
        lp.connect(g);
        g.connect(this.bus);
        src.start(now, 0.1, 0.15);
      }

      // Subtle eerie hush / shadow dissolve
      const hush = ctx.createBufferSource();
      hush.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(950, now + 0.08);
      bp.frequency.exponentialRampToValueAtTime(260, now + 0.55);
      bp.Q.value = 1.8;
      const hg = ctx.createGain();
      hg.gain.setValueAtTime(0.001, now + 0.08);
      hg.gain.linearRampToValueAtTime(0.14, now + 0.14);
      hg.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
      hush.connect(bp);
      bp.connect(hg);
      hg.connect(this.reverbSend);
      hush.start(now + 0.08, 0.3, 0.6);
    },
  };

  window.SakuraAudio = AudioEngine;
})();
