(function () {
  "use strict";

  const STORAGE_KEY_BEST = "sakura_scope_high_score_v1";
  const STORAGE_KEY_SENS = "sakura_scope_sensitivity_v1";

  // Ballistic drop formula in canonical units (1 tickScale unit = scopeRadius / 240)
  // Matches clean BDC tick marks: 100m -> 11px, 200m -> 43px, 300m -> 91px
  function getCanonicalDrop(distanceMeters) {
    const d = Math.max(0, distanceMeters - 45);
    return 0.0005 * d * d + 0.21 * d;
  }

  const STATE = {
    TITLE: "title",
    PLAYING: "playing",
    PAUSED: "paused",
    GAMEOVER: "gameover",
  };

  class SakuraScopeGame {
    constructor() {
      this.bgCanvas = document.getElementById("bg-canvas");
      this.bgCtx = this.bgCanvas.getContext("2d");

      this.scopeCanvas = document.getElementById("scope-canvas");
      this.scopeCtx = this.scopeCanvas.getContext("2d");

      this.world = new window.SakuraWorld.WorldState();

      // DOM refs
      this.ui = {
        scopeContainer: document.getElementById("scope-ui"),
        hudTop: document.getElementById("hud-top"),
        hudBottom: document.getElementById("hud-bottom"),
        score: document.getElementById("hud-score"),
        best: document.getElementById("hud-best"),
        range: document.getElementById("hud-range"),
        phase: document.getElementById("hud-phase"),
        kills: document.getElementById("hud-kills"),
        toast: document.getElementById("kill-toast"),
        overlayTitle: document.getElementById("overlay-title"),
        overlayPause: document.getElementById("overlay-pause"),
        overlayGameOver: document.getElementById("overlay-gameover"),
        bestTitle: document.getElementById("best-score-title"),
        goReason: document.getElementById("go-reason"),
        goScore: document.getElementById("go-score"),
        goBest: document.getElementById("go-best"),
        goKills: document.getElementById("go-kills"),
        goLongest: document.getElementById("go-longest"),
        goNewBest: document.getElementById("go-new-best"),
        sensTitle: document.getElementById("sens-slider-title"),
        sensPause: document.getElementById("sens-slider-pause"),
        muteBtns: [
          document.getElementById("btn-mute-title"),
          document.getElementById("btn-mute-pause"),
          document.getElementById("btn-mute-go"),
        ],
      };

      // Viewport metrics
      this.W = window.innerWidth;
      this.H = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.cx = this.W * 0.5;
      this.cy = this.H * 0.5;
      this.scopeRadius = Math.min(this.W, this.H) * 0.45;
      this.scopeScale = 1;
      this.tickScale = 1;

      // Camera & Scope aim state
      this.camX = 0;
      this.camY = 0;
      this.velX = 0;
      this.velY = 0;
      this.recoilY = 0;
      this.recoilX = 0;
      this.flashAlpha = 0;
      this.hitMarkerAlpha = 0;
      this.hitMarkerHead = false;
      this.breathPhase = 0;

      // Gameplay progression
      this.state = STATE.TITLE;
      this.score = 0;
      this.highScore = this._loadNumber(STORAGE_KEY_BEST, 0);
      this.sensitivity = this._loadNumber(STORAGE_KEY_SENS, 1.0);
      this.kills = 0;
      this.streak = 0;
      this.longestShot = 0;
      this.dayNightClock = 0; // Slowly cycles Day <-> Night
      this.timePhase = 0; // 0 = bright day, 1 = pastel night
      this.triggerArmedAt = 0;
      this.nextShotReadyAt = 0;
      this.toastTimer = null;

      // Input state (Mouse / Trackpad Pointer Lock + Relative Fallback + Touch)
      this.pointerLocked = false;
      this.lastRawPointerX = null;
      this.lastRawPointerY = null;
      this.edgeVelX = 0;
      this.edgeVelY = 0;
      this.touchActive = false;
      this.touchId = null;
      this.touchStartX = 0;
      this.touchStartY = 0;
      this.touchLastX = 0;
      this.touchLastY = 0;
      this.touchMovedDist = 0;

      this._bindEvents();
      this._resize();
      this._syncSensitivityUI();
      this._updateTitleBest();

      this.lastFrameTime = performance.now();
      requestAnimationFrame((t) => this._loop(t));
    }

    _loadNumber(key, fallback) {
      try {
        const val = parseFloat(localStorage.getItem(key));
        return Number.isFinite(val) ? val : fallback;
      } catch {
        return fallback;
      }
    }

    _saveNumber(key, val) {
      try {
        localStorage.setItem(key, String(val));
      } catch {}
    }

    _resize() {
      this.W = window.innerWidth;
      this.H = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.cx = this.W * 0.5;
      this.cy = this.H * 0.5;

      // Perfect circle, largest it can comfortably fit inside screen
      const diameter = Math.min(this.W, this.H) * 0.9;
      this.scopeRadius = diameter * 0.5;
      this.scopeScale = this.scopeRadius / 240;
      this.tickScale = this.scopeRadius / 240;

      this.ui.scopeContainer.style.setProperty("--scope-size", `${diameter}px`);

      this.bgCanvas.width = Math.floor(this.W);
      this.bgCanvas.height = Math.floor(this.H);

      this.scopeCanvas.width = Math.floor(this.W * this.dpr);
      this.scopeCanvas.height = Math.floor(this.H * this.dpr);
    }

    _bindEvents() {
      window.addEventListener("resize", () => this._resize());

      document.getElementById("btn-start").addEventListener("click", (e) => {
        e.stopPropagation();
        this._startNewRun();
      });

      document.getElementById("btn-resume").addEventListener("click", (e) => {
        e.stopPropagation();
        this._resumeGame();
      });

      document.getElementById("btn-restart-pause").addEventListener("click", (e) => {
        e.stopPropagation();
        this._startNewRun();
      });

      document.getElementById("btn-retry").addEventListener("click", (e) => {
        e.stopPropagation();
        this._startNewRun();
      });

      [this.ui.sensTitle, this.ui.sensPause].forEach((slider) => {
        slider.addEventListener("input", (e) => {
          this.sensitivity = parseFloat(e.target.value) || 1.0;
          this._saveNumber(STORAGE_KEY_SENS, this.sensitivity);
          this._syncSensitivityUI();
        });
      });

      this.ui.muteBtns.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          window.SakuraAudio.init();
          window.SakuraAudio.toggleMute();
          this._syncMuteUI();
        });
      });

      // Pointer Lock tracking
      document.addEventListener("pointerlockchange", () => {
        const locked = document.pointerLockElement === this.scopeCanvas;
        this.pointerLocked = locked;
        if (!locked && this.state === STATE.PLAYING) {
          // If user intentionally pressed ESC out of pointer lock on desktop, pause cleanly
          this._pauseGame();
        }
      });

      // Mouse / Trackpad movement (works both locked AND unlocked seamlessly)
      window.addEventListener("mousemove", (e) => {
        if (this.state !== STATE.PLAYING) return;

        if (this.pointerLocked) {
          // Guard against browser cursor-warp spikes on pointer lock entry
          const dx = Math.max(-90, Math.min(90, e.movementX || 0));
          const dy = Math.max(-90, Math.min(90, e.movementY || 0));
          this._panByScreenDelta(dx, dy);
        } else if (!this.touchActive) {
          if (this.lastRawPointerX !== null) {
            const dx = e.clientX - this.lastRawPointerX;
            const dy = e.clientY - this.lastRawPointerY;
            this._panByScreenDelta(dx * 1.15, dy * 1.15);
          }
          this.lastRawPointerX = e.clientX;
          this.lastRawPointerY = e.clientY;

          // Gentle outer-ring drift if pointer lock wasn't granted (allows infinite 360 panning)
          const ox = (e.clientX - this.cx) / Math.max(1, this.scopeRadius);
          const oy = (e.clientY - this.cy) / Math.max(1, this.scopeRadius);
          const dist = Math.hypot(ox, oy);
          if (dist > 0.72) {
            const push = Math.min(1, (dist - 0.72) / 0.35);
            this.edgeVelX = (ox / dist) * push * 360;
            this.edgeVelY = (oy / dist) * push * 220;
          } else {
            this.edgeVelX = 0;
            this.edgeVelY = 0;
          }
        }
      });

      // Left-click fire (single-handed mouse or trackpad)
      this.scopeCanvas.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        if (this.state !== STATE.PLAYING) return;
        window.SakuraAudio.init();
        if (!this.pointerLocked && this.scopeCanvas.requestPointerLock) {
          try {
            const p = this.scopeCanvas.requestPointerLock();
            if (p && p.catch) p.catch(() => {});
          } catch {}
        }
        this._attemptShot();
      });

      // Touchpad / Touch screen one-handed drag + tap-to-shoot
      this.scopeCanvas.addEventListener(
        "touchstart",
        (e) => {
          if (this.state !== STATE.PLAYING) return;
          window.SakuraAudio.init();
          if (this.touchActive) return;
          const t = e.changedTouches[0];
          this.touchActive = true;
          this.touchId = t.identifier;
          this.touchStartX = t.clientX;
          this.touchStartY = t.clientY;
          this.touchLastX = t.clientX;
          this.touchLastY = t.clientY;
          this.touchMovedDist = 0;
        },
        { passive: true }
      );

      this.scopeCanvas.addEventListener(
        "touchmove",
        (e) => {
          if (!this.touchActive || this.state !== STATE.PLAYING) return;
          for (const t of e.changedTouches) {
            if (t.identifier === this.touchId) {
              const dx = t.clientX - this.touchLastX;
              const dy = t.clientY - this.touchLastY;
              this.touchMovedDist += Math.hypot(dx, dy);
              // Dragging pans the view smoothly
              this._panByScreenDelta(-dx * 1.15, -dy * 1.15);
              this.touchLastX = t.clientX;
              this.touchLastY = t.clientY;
              break;
            }
          }
        },
        { passive: true }
      );

      this.scopeCanvas.addEventListener(
        "touchend",
        (e) => {
          if (!this.touchActive) return;
          for (const t of e.changedTouches) {
            if (t.identifier === this.touchId) {
              this.touchActive = false;
              this.touchId = null;
              if (this.state === STATE.PLAYING && this.touchMovedDist < 10) {
                this._attemptShot();
              }
              break;
            }
          }
        },
        { passive: true }
      );
    }

    _panByScreenDelta(dx, dy) {
      const factor = (0.72 * this.sensitivity) / Math.max(0.5, this.scopeScale);
      this.camX += dx * factor;
      this.camY += dy * factor;
      this._clampVerticalCam();
    }

    _clampVerticalCam() {
      // Allow looking up into sky/canopies and down across meadow slopes
      this.camY = Math.max(-375, Math.min(265, this.camY));
    }

    _requestLockSafely() {
      if (this.scopeCanvas.requestPointerLock) {
        try {
          const maybePromise = this.scopeCanvas.requestPointerLock();
          if (maybePromise && maybePromise.catch) maybePromise.catch(() => {});
        } catch {}
      }
    }

    _releaseLockSafely() {
      if (document.pointerLockElement && document.exitPointerLock) {
        try {
          document.exitPointerLock();
        } catch {}
      }
    }

    _startNewRun() {
      window.SakuraAudio.init();
      this.world.reset();

      this.camX = 0;
      this.camY = 20;
      this.recoilX = 0;
      this.recoilY = 0;
      this.edgeVelX = 0;
      this.edgeVelY = 0;
      this.lastRawPointerX = null;
      this.lastRawPointerY = null;

      this.score = 0;
      this.kills = 0;
      this.streak = 0;
      this.longestShot = 0;
      this.dayNightClock = 0;
      this.timePhase = 0;

      const now = performance.now();
      this.triggerArmedAt = now + 380;
      this.nextShotReadyAt = now + 380;

      this.state = STATE.PLAYING;
      this._updateOverlayVisibility();
      this._updateHUD();
      this._requestLockSafely();
    }

    _pauseGame() {
      if (this.state !== STATE.PLAYING) return;
      this.state = STATE.PAUSED;
      this.edgeVelX = 0;
      this.edgeVelY = 0;
      this._updateOverlayVisibility();
    }

    _resumeGame() {
      if (this.state !== STATE.PAUSED) return;
      window.SakuraAudio.init();
      const now = performance.now();
      this.triggerArmedAt = now + 260;
      this.lastRawPointerX = null;
      this.lastRawPointerY = null;
      this.state = STATE.PLAYING;
      this._updateOverlayVisibility();
      this._requestLockSafely();
    }

    _triggerGameOver(result) {
      this.state = STATE.GAMEOVER;
      this._releaseLockSafely();
      this.world.alertAllMonsters();

      const isNewBest = this.score > this.highScore && this.score > 0;
      if (isNewBest) {
        this.highScore = this.score;
        this._saveNumber(STORAGE_KEY_BEST, this.highScore);
      }

      const surfaceText =
        result.surface === "stone"
          ? "The bullet chipped stone—every creature slipped away into the mist."
          : result.surface === "wood"
          ? "You clipped wood—the shadows vanished at the sound."
          : result.surface === "earth"
          ? "Your shot kicked up hillside earth—not a trace remained."
          : "The shot echoed into the open sky. Nothing remains.";

      this.ui.goReason.textContent = surfaceText;
      this.ui.goScore.textContent = String(this.score);
      this.ui.goBest.textContent = String(this.highScore);
      this.ui.goKills.textContent = String(this.kills);
      this.ui.goLongest.textContent = `${this.longestShot}m`;
      this.ui.goNewBest.classList.toggle("hidden", !isNewBest);

      this._updateTitleBest();
      this._updateOverlayVisibility();
    }

    _attemptShot() {
      const now = performance.now();
      if (now < this.triggerArmedAt || now < this.nextShotReadyAt) return;
      this.nextShotReadyAt = now + 450;

      // Include natural subtle scope breathing in actual shot aim!
      const swayX = Math.sin(this.breathPhase * 0.9) * 1.4;
      const swayY = Math.cos(this.breathPhase * 1.3) * 1.4;
      const aimX = this.camX + swayX;
      const aimY = this.camY + swayY;

      const estDist = this.world.lastRangeReadout || 130;
      window.SakuraAudio.playShot(estDist);

      // Tactile muzzle kick & subtle lens blink
      this.recoilY = -14;
      this.recoilX = (Math.random() - 0.5) * 4;
      this.flashAlpha = 0.24;

      const result = this.world.evaluateShot(aimX, aimY, this.scopeScale, this.tickScale, getCanonicalDrop);

      if (result.hit) {
        const flightMs = Math.min(260, Math.max(25, (result.distance / 1100) * 1000));
        setTimeout(() => {
          window.SakuraAudio.playSplat(result.headshot, result.distance);
          this.world.bursts.push(
            window.SakuraMonsters.createSplatBurst(
              result.worldX,
              result.worldY,
              result.layerId,
              result.scale,
              result.headshot,
              this.timePhase
            )
          );
          this.hitMarkerAlpha = 1.0;
          this.hitMarkerHead = result.headshot;

          // Scoring: base + distance bonus + headshot + night bonus + streak multiplier
          this.kills += 1;
          this.streak += 1;
          if (result.distance > this.longestShot) {
            this.longestShot = result.distance;
          }

          const distBonus = Math.round(result.distance * 0.85);
          const headBonus = result.headshot ? 140 : 0;
          const nightMult = 1 + this.timePhase * 0.45;
          const streakMult = 1 + Math.min(1.0, (this.streak - 1) * 0.1);
          const pts = Math.round((100 + distBonus + headBonus) * nightMult * streakMult);
          this.score += pts;

          if (this.score > this.highScore) {
            this.highScore = this.score;
            this._saveNumber(STORAGE_KEY_BEST, this.highScore);
          }

          this._showToast(
            `${result.headshot ? "CLEAN HIT" : "HIT"} • ${result.distance}m • +${pts}`
          );
          this._updateHUD();

          setTimeout(() => {
            if (this.state === STATE.PLAYING) {
              window.SakuraAudio.playBoltCycle();
            }
          }, 210);
        }, flightMs);
      } else {
        // Missed! One chance per shot — valley falls silent and game ends
        const flightMs = Math.min(240, Math.max(40, (result.distance / 1100) * 1000));
        setTimeout(() => {
          window.SakuraAudio.playMiss(result.surface, result.distance);
          this._triggerGameOver(result);
        }, flightMs);
      }
    }

    _showToast(text) {
      this.ui.toast.textContent = text;
      this.ui.toast.classList.remove("hidden");
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        this.ui.toast.classList.add("hidden");
      }, 1500);
    }

    _syncSensitivityUI() {
      this.ui.sensTitle.value = String(this.sensitivity);
      this.ui.sensPause.value = String(this.sensitivity);
    }

    _syncMuteUI() {
      const label = window.SakuraAudio.isMuted() ? "Sound: Off" : "Sound: On";
      this.ui.muteBtns.forEach((b) => {
        b.textContent = label;
      });
    }

    _updateTitleBest() {
      this.ui.bestTitle.textContent =
        this.highScore > 0 ? `High Score: ${this.highScore}` : "One Missed Shot Ends The Hunt";
    }

    _updateOverlayVisibility() {
      this.ui.overlayTitle.classList.toggle("hidden", this.state !== STATE.TITLE);
      this.ui.overlayPause.classList.toggle("hidden", this.state !== STATE.PAUSED);
      this.ui.overlayGameOver.classList.toggle("hidden", this.state !== STATE.GAMEOVER);

      const inPlay = this.state === STATE.PLAYING;
      this.ui.hudTop.classList.toggle("hidden", !inPlay);
      this.ui.hudBottom.classList.toggle("hidden", !inPlay);
    }

    _updateHUD() {
      this.ui.score.textContent = `SCORE ${this.score}`;
      this.ui.best.textContent = `BEST ${this.highScore}`;
      this.ui.kills.textContent = `${this.kills} HUNTED`;
      const isNight = this.timePhase > 0.5;
      this.ui.phase.textContent = isNight ? "NIGHT" : "DAY";
      document.body.classList.toggle("night-mode", isNight);
    }

    _loop(now) {
      const dt = Math.min(0.05, (now - this.lastFrameTime) * 0.001);
      this.lastFrameTime = now;
      const timeSec = now * 0.001;

      this._update(dt, timeSec);
      this._render(timeSec);

      requestAnimationFrame((t) => this._loop(t));
    }

    _update(dt, timeSec) {
      // Gentle Day -> Dusk -> Night -> Dawn rhythm (full cycle ~88s)
      if (this.state === STATE.PLAYING) {
        this.dayNightClock += dt;
        // Smooth flat plateaus for pure Day and pure Night with soft twilight transitions
        const cycle = (this.dayNightClock % 88) / 88;
        if (cycle < 0.36) {
          this.timePhase = 0;
        } else if (cycle < 0.52) {
          this.timePhase = (cycle - 0.36) / 0.16;
        } else if (cycle < 0.84) {
          this.timePhase = 1;
        } else {
          this.timePhase = 1 - (cycle - 0.84) / 0.16;
        }
        // Smoothstep curve for graceful twilight blending
        this.timePhase = this.timePhase * this.timePhase * (3 - 2 * this.timePhase);

        // Edge drift if pointer lock isn't active
        if (!this.pointerLocked && !this.touchActive) {
          this.camX += (this.edgeVelX * this.sensitivity * dt) / Math.max(0.5, this.scopeScale);
          this.camY += (this.edgeVelY * this.sensitivity * dt) / Math.max(0.5, this.scopeScale);
          this._clampVerticalCam();
        }
      } else if (this.state === STATE.TITLE) {
        // Serene idle camera pan over the shifting sakura valley on title screen
        this.camX += 26 * dt;
        this.camY = 12 + Math.sin(timeSec * 0.25) * 14;
      }

      this.breathPhase += dt * 1.45;

      // Recoil spring recovery
      this.recoilX *= Math.pow(0.001, dt);
      this.recoilY *= Math.pow(0.001, dt);
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 1.8);
      this.hitMarkerAlpha = Math.max(0, this.hitMarkerAlpha - dt * 2.4);

      const windLevel = window.SakuraAudio.getWindLevel(timeSec);
      window.SakuraAudio.updateWind(timeSec, this.timePhase);

      const halfSpanWorldW = (this.W * 0.5) / this.scopeScale;
      this.world.update(dt, this.camX, this.camY, halfSpanWorldW, this.timePhase, windLevel, this.kills);

      if (this.state === STATE.PLAYING) {
        this.ui.range.textContent = this.world.getRangeReading(
          this.camX,
          this.camY,
          this.scopeScale,
          this.tickScale,
          getCanonicalDrop
        );
        this._updateHUD();
      }
    }

    _render(timeSec) {
      const windLevel = window.SakuraAudio.getWindLevel(timeSec);
      const swayX = this.state === STATE.PLAYING ? Math.sin(this.breathPhase * 0.9) * 1.4 : 0;
      const swayY = this.state === STATE.PLAYING ? Math.cos(this.breathPhase * 1.3) * 1.4 : 0;
      const renderCamX = this.camX + swayX + this.recoilX;
      const renderCamY = this.camY + swayY + this.recoilY;

      // 1) Render Blurred Peripheral World (de-magnified 1x view outside the scope lens)
      const bgCtx = this.bgCtx;
      bgCtx.clearRect(0, 0, this.W, this.H);
      this.world.renderPeripheral(
        bgCtx,
        this.W,
        this.H,
        renderCamX,
        renderCamY,
        this.scopeScale * 0.56,
        this.timePhase,
        timeSec,
        windLevel
      );

      // Subtle atmospheric dim on peripheral background so the sharp lens shines clearly
      bgCtx.fillStyle =
        this.timePhase > 0.5 ? "rgba(18, 16, 28, 0.34)" : "rgba(48, 36, 44, 0.18)";
      bgCtx.fillRect(0, 0, this.W, this.H);

      // 2) Render Razor-Sharp Circular Scope View
      const ctx = this.scopeCtx;
      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.W, this.H);

      // Clip cleanly to the largest centered circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, this.scopeRadius, 0, Math.PI * 2);
      ctx.clip();

      this.world.renderScopeWorld(
        ctx,
        this.W,
        this.H,
        this.cx,
        this.cy,
        renderCamX,
        renderCamY,
        this.scopeScale,
        this.timePhase,
        timeSec,
        windLevel
      );

      // Muzzle blink inside lens
      if (this.flashAlpha > 0.005) {
        ctx.fillStyle = `rgba(255, 248, 240, ${this.flashAlpha.toFixed(3)})`;
        ctx.fillRect(0, 0, this.W, this.H);
      }

      // Soft optical glass vignette along edge of scope tube
      const vig = ctx.createRadialGradient(
        this.cx,
        this.cy,
        this.scopeRadius * 0.72,
        this.cx,
        this.cy,
        this.scopeRadius
      );
      vig.addColorStop(0, "rgba(0, 0, 0, 0)");
      vig.addColorStop(0.75, "rgba(24, 18, 26, 0.08)");
      vig.addColorStop(1, "rgba(18, 14, 22, 0.56)");
      ctx.fillStyle = vig;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, this.scopeRadius, 0, Math.PI * 2);
      ctx.fill();

      // Clean, crisp reticle cross + simple BDC distance tick marks
      this._drawReticle(ctx);

      ctx.restore(); // End circular clip

      // Crisp dark optical scope rim
      ctx.strokeStyle = "rgba(26, 20, 28, 0.88)";
      ctx.lineWidth = Math.max(3, this.scopeRadius * 0.022);
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, this.scopeRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Thin inner machined bevel highlight
      ctx.strokeStyle = "rgba(255, 245, 248, 0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, this.scopeRadius - 2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    _drawReticle(ctx) {
      const R = this.scopeRadius;
      const cx = this.cx;
      const cy = this.cy;
      const ts = this.tickScale;

      const isNight = this.timePhase > 0.5;
      const lineColor = isNight ? "rgba(246, 234, 240, 0.84)" : "rgba(32, 24, 32, 0.82)";
      const labelColor = isNight ? "rgba(246, 234, 240, 0.58)" : "rgba(32, 24, 32, 0.55)";

      ctx.save();
      ctx.strokeStyle = lineColor;
      ctx.fillStyle = labelColor;
      ctx.lineCap = "butt";

      // Outer thicker stadia posts transitioning to razor-thin center hairlines
      const postStart = R * 0.96;
      const postEnd = R * 0.56;

      ctx.lineWidth = Math.max(1.8, 2.4 * ts);
      ctx.beginPath();
      // Left & Right outer posts
      ctx.moveTo(cx - postStart, cy);
      ctx.lineTo(cx - postEnd, cy);
      ctx.moveTo(cx + postEnd, cy);
      ctx.lineTo(cx + postStart, cy);
      // Top & Bottom outer posts
      ctx.moveTo(cx, cy - postStart);
      ctx.lineTo(cx, cy - postEnd);
      ctx.moveTo(cx, cy + postEnd);
      ctx.lineTo(cx, cy + postStart);
      ctx.stroke();

      // Clean, crisp central crosshairs
      ctx.lineWidth = Math.max(1, 1.05 * ts);
      ctx.beginPath();
      ctx.moveTo(cx - postEnd, cy);
      ctx.lineTo(cx + postEnd, cy);
      ctx.moveTo(cx, cy - postEnd);
      ctx.lineTo(cx, cy + postEnd);
      ctx.stroke();

      // Crisp center aiming dot
      ctx.fillStyle = isNight ? "rgba(246, 178, 198, 0.9)" : "rgba(182, 62, 92, 0.85)";
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.3, 1.5 * ts), 0, Math.PI * 2);
      ctx.fill();

      // Simple BDC distance tick marks along the lower vertical crosshair (100m, 200m, 300m)
      const ticks = [
        { dist: 100, label: "1", halfW: 5.5 * ts },
        { dist: 200, label: "2", halfW: 8.0 * ts },
        { dist: 300, label: "3", halfW: 10.5 * ts },
        { dist: 400, label: "4", halfW: 13.0 * ts },
      ];

      ctx.strokeStyle = lineColor;
      ctx.fillStyle = labelColor;
      ctx.lineWidth = Math.max(1, 1.1 * ts);
      ctx.font = `500 ${Math.round(Math.max(8, 8.5 * ts))}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      for (const tk of ticks) {
        const yOff = getCanonicalDrop(tk.dist) * ts;
        const ty = cy + yOff;
        ctx.beginPath();
        ctx.moveTo(cx - tk.halfW, ty);
        ctx.lineTo(cx + tk.halfW, ty);
        ctx.stroke();

        ctx.fillText(tk.label, cx + tk.halfW + 4.5 * ts, ty);
      }

      // Brief crisp hit confirmation tick on center
      if (this.hitMarkerAlpha > 0.02) {
        const a = this.hitMarkerAlpha;
        const d1 = 6 * ts;
        const d2 = 13 * ts;
        ctx.strokeStyle = this.hitMarkerHead
          ? `rgba(220, 74, 108, ${a.toFixed(2)})`
          : `rgba(255, 245, 248, ${a.toFixed(2)})`;
        ctx.lineWidth = Math.max(1.5, 1.8 * ts);
        ctx.beginPath();
        ctx.moveTo(cx - d2, cy - d2);
        ctx.lineTo(cx - d1, cy - d1);
        ctx.moveTo(cx + d1, cy - d1);
        ctx.lineTo(cx + d2, cy - d2);
        ctx.moveTo(cx - d2, cy + d2);
        ctx.lineTo(cx - d1, cy + d1);
        ctx.moveTo(cx + d1, cy + d1);
        ctx.lineTo(cx + d2, cy + d2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    new SakuraScopeGame();
  });
})();
