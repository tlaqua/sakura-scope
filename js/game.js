(function () {
  "use strict";

  const STORAGE_KEY_BEST = "sakura_scope_high_score_v1";
  const STORAGE_KEY_SENS = "sakura_scope_sensitivity_v1";
  const STORAGE_KEY_ZOOM = "sakura_scope_zoom_v1";

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
      this.scopeCanvas = document.getElementById("scope-canvas");
      this.scopeCtx = this.scopeCanvas.getContext("2d");

      this.world = new window.SakuraWorld.WorldState();

      this.ui = {
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
        btnPeek: document.getElementById("btn-peek"),
        btnShowCard: document.getElementById("btn-show-card"),
        sensTitle: document.getElementById("sens-slider-title"),
        sensPause: document.getElementById("sens-slider-pause"),
        sensValTitle: document.getElementById("sens-val-title"),
        sensValPause: document.getElementById("sens-val-pause"),
        zoomTitle: document.getElementById("zoom-slider-title"),
        zoomPause: document.getElementById("zoom-slider-pause"),
        zoomValTitle: document.getElementById("zoom-val-title"),
        zoomValPause: document.getElementById("zoom-val-pause"),
        muteBtns: [
          document.getElementById("btn-mute-title"),
          document.getElementById("btn-mute-pause"),
          document.getElementById("btn-mute-go"),
        ],
      };

      this.W = window.innerWidth;
      this.H = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.cx = this.W * 0.5;
      this.cy = this.H * 0.5;
      this.reticleRadius = Math.min(this.W, this.H) * 0.48;
      this.baseScale = 1;
      this.scopeScale = 1;
      this.tickScale = 1;

      this.camX = 0;
      this.camY = 0;
      this.recoilY = 0;
      this.recoilX = 0;
      this.flashAlpha = 0;
      this.hitMarkerAlpha = 0;
      this.hitMarkerHead = false;
      this.breathPhase = 0;
      this.missVisual = null;

      this.state = STATE.TITLE;
      this.score = 0;
      this.highScore = this._loadNumber(STORAGE_KEY_BEST, 0);
      this.sensitivity = Math.max(0.4, Math.min(2.2, this._loadNumber(STORAGE_KEY_SENS, 1.0)));
      this.zoom = Math.max(0.7, Math.min(2.8, this._loadNumber(STORAGE_KEY_ZOOM, 1.0)));
      this.kills = 0;
      this.streak = 0;
      this.longestShot = 0;
      this.dayNightClock = 0;
      this.timePhase = 0;
      this.triggerArmedAt = 0;
      this.nextShotReadyAt = 0;
      this.toastTimer = null;

      this.pointerLocked = false;
      this.suppressPauseOnUnlock = false;
      this.lastInputWasTouch = false;
      this.lastRawPointerX = null;
      this.lastRawPointerY = null;
      this.touchActive = false;
      this.touchId = null;
      this.touchLastX = 0;
      this.touchLastY = 0;
      this.touchMovedDist = 0;
      this.lastTouchEndAt = 0;

      this._bindEvents();
      this._resize();
      this._syncSensitivityUI();
      this._syncZoomUI();
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

    _updateScale() {
      this.baseScale = this.reticleRadius / 240;
      this.scopeScale = this.baseScale * this.zoom;
      this.tickScale = this.scopeScale;
    }

    _resize() {
      this.W = window.innerWidth;
      this.H = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.cx = this.W * 0.5;
      this.cy = this.H * 0.5;

      this.reticleRadius = Math.min(this.W, this.H) * 0.48;
      this._updateScale();

      this.scopeCanvas.width = Math.floor(this.W * this.dpr);
      this.scopeCanvas.height = Math.floor(this.H * this.dpr);
    }

    _bindEvents() {
      window.addEventListener("resize", () => this._resize());

      window.addEventListener(
        "pointerdown",
        (e) => {
          this.lastInputWasTouch = e.pointerType === "touch";
        },
        { capture: true, passive: true }
      );

      document.getElementById("btn-start").addEventListener("click", (e) => {
        e.stopPropagation();
        this._startNewRun(!this.lastInputWasTouch);
      });

      document.getElementById("btn-resume").addEventListener("click", (e) => {
        e.stopPropagation();
        this._resumeGame(!this.lastInputWasTouch);
      });

      document.getElementById("btn-restart-pause").addEventListener("click", (e) => {
        e.stopPropagation();
        this._startNewRun(!this.lastInputWasTouch);
      });

      document.getElementById("btn-retry").addEventListener("click", (e) => {
        e.stopPropagation();
        this._startNewRun(!this.lastInputWasTouch);
      });

const setPeeking = (peeking) => {
        this.ui.overlayGameOver.classList.toggle("peeking-scene", peeking);
      };

      if (this.ui.btnPeek) {
        this.ui.btnPeek.addEventListener("click", (e) => {
          e.stopPropagation();
          setPeeking(true);
        });
      }

      if (this.ui.btnShowCard) {
        this.ui.btnShowCard.addEventListener("click", (e) => {
          e.stopPropagation();
          setPeeking(false);
        });
      }

      this.ui.overlayGameOver.addEventListener("click", (e) => {
        if (e.target === this.ui.overlayGameOver) {
          const isPeeking = this.ui.overlayGameOver.classList.contains("peeking-scene");
          setPeeking(!isPeeking);
        }
      });


      [this.ui.sensTitle, this.ui.sensPause].forEach((slider) => {
        slider.addEventListener("input", (e) => {
          this.sensitivity = parseFloat(e.target.value) || 1.0;
          this._saveNumber(STORAGE_KEY_SENS, this.sensitivity);
          this._syncSensitivityUI();
        });
      });

      const setPreviewingZoom = (slider, active) => {
        const card = slider.closest(".overlay-card");
        if (card) card.classList.toggle("previewing-zoom", active);
      };

      [this.ui.zoomTitle, this.ui.zoomPause].forEach((slider) => {
        slider.addEventListener("input", (e) => {
          this.zoom = parseFloat(e.target.value) || 1.0;
          this._saveNumber(STORAGE_KEY_ZOOM, this.zoom);
          this._updateScale();
          this._syncZoomUI();
          setPreviewingZoom(slider, true);
        });
        const endPreview = () => setPreviewingZoom(slider, false);
        slider.addEventListener("change", endPreview);
        slider.addEventListener("pointerup", endPreview);
        slider.addEventListener("touchend", endPreview);
        slider.addEventListener("pointercancel", endPreview);
      });

      this.ui.muteBtns.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          window.SakuraAudio.init();
          window.SakuraAudio.toggleMute();
          this._syncMuteUI();
        });
      });

      document.addEventListener("pointerlockchange", () => {
        const locked = document.pointerLockElement === this.scopeCanvas;
        this.pointerLocked = locked;
        if (locked) {
          this.lastRawPointerX = null;
          this.lastRawPointerY = null;
        } else if (this.state === STATE.PLAYING) {
          if (this.suppressPauseOnUnlock) {
            this.suppressPauseOnUnlock = false;
          } else {
            this._pauseGame();
          }
        }
      });

      window.addEventListener("mousemove", (e) => {
        if (this.state !== STATE.PLAYING || this.touchActive) return;

        if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
        if (performance.now() - this.lastTouchEndAt < 250) return;

        if (this.pointerLocked) {
          const dx = Math.max(-90, Math.min(90, e.movementX || 0));
          const dy = Math.max(-90, Math.min(90, e.movementY || 0));
          this._panByScreenDelta(dx, dy);
        } else {
          if (this.lastRawPointerX !== null) {
            const dx = Math.max(-90, Math.min(90, e.clientX - this.lastRawPointerX));
            const dy = Math.max(-90, Math.min(90, e.clientY - this.lastRawPointerY));
            this._panByScreenDelta(dx * 1.15, dy * 1.15);
          }
          this.lastRawPointerX = e.clientX;
          this.lastRawPointerY = e.clientY;
        }
      });

      const clearPointerTracking = () => {
        this.lastRawPointerX = null;
        this.lastRawPointerY = null;
      };
      document.addEventListener("mouseleave", clearPointerTracking);
      window.addEventListener("blur", clearPointerTracking);

      this.scopeCanvas.addEventListener("mousedown", (e) => {
        if (e.button !== 0 || this.state !== STATE.PLAYING) return;
        if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
        if (performance.now() - this.lastTouchEndAt < 350) return;

        window.SakuraAudio.init();
        if (!this.pointerLocked) {
          this._requestLockSafely();
        }
        this._attemptShot();
      });

      this.scopeCanvas.addEventListener(
        "touchstart",
        (e) => {
          if (this.state !== STATE.PLAYING || this.touchActive) return;
          window.SakuraAudio.init();

          if (this.pointerLocked) {
            this.suppressPauseOnUnlock = true;
            this._releaseLockSafely();
          }

          clearPointerTracking();

          const t = e.changedTouches[0];
          this.touchActive = true;
          this.touchId = t.identifier;
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
              this.lastTouchEndAt = performance.now();
              clearPointerTracking();
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
      const factor = (0.72 * this.sensitivity) / Math.max(0.45, this.scopeScale);
      this.camX += dx * factor;
      this.camY += dy * factor;
      this._clampVerticalCam();
    }

    _clampVerticalCam() {
      this.camY = Math.max(-375, Math.min(265, this.camY));
    }

    _requestLockSafely() {
      if (this.scopeCanvas.requestPointerLock) {
        try {
          const p = this.scopeCanvas.requestPointerLock();
          if (p && p.catch) p.catch(() => {});
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

    _startNewRun(shouldLockPointer) {
      window.SakuraAudio.init();
      this.world.reset();

      this.camX = 0;
      this.camY = 20;
      this.recoilX = 0;
      this.recoilY = 0;
      this.missVisual = null;
      this.lastRawPointerX = null;
      this.lastRawPointerY = null;

      this.ui.overlayGameOver.classList.remove("peeking-scene", "card-top", "card-bottom");
      if (this.ui.btnPeek) this.ui.btnPeek.textContent = "Hide Card";

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
      if (shouldLockPointer) this._requestLockSafely();
    }

    _pauseGame() {
      if (this.state !== STATE.PLAYING) return;
      this.state = STATE.PAUSED;
      this.lastRawPointerX = null;
      this.lastRawPointerY = null;
      this._updateOverlayVisibility();
    }

    _resumeGame(shouldLockPointer) {
      if (this.state !== STATE.PAUSED) return;
      window.SakuraAudio.init();
      const now = performance.now();
      this.triggerArmedAt = now + 260;
      this.lastRawPointerX = null;
      this.lastRawPointerY = null;
      this.state = STATE.PLAYING;
      this._updateOverlayVisibility();
      if (shouldLockPointer) this._requestLockSafely();
    }

    _buildMissFeedback(result) {
      const nt = result.nearestTarget;
      const dist = result.distance;
      let badge = `${dist}m`;
      let reason = "";

      if (result.surface === "stone" || result.surface === "wood") {
        const mat = result.surface === "stone" ? "Stone" : "Wood";
        badge = `× ${dist}m • ${mat}`;
        if (nt && nt.distance > dist + 35) {
          reason = `Hit ${mat.toLowerCase()} cover at ${dist}m before reaching the ${nt.distance}m target.`;
        } else if (nt) {
          reason = `Clipped ${mat.toLowerCase()} cover at ${dist}m just beside the target.`;
        } else {
          reason = `Struck ${mat.toLowerCase()} at ${dist}m—every shadow slipped away.`;
        }
      } else if (result.surface === "earth") {
        badge = `× ${dist}m • Slope`;
        if (nt && nt.distance > dist + 35) {
          reason = `Shot dropped into the ${dist}m slope short of the ${nt.distance}m target—aim higher.`;
        } else if (nt && nt.dyPx > 6) {
          reason = `Shot dropped low into the ${dist}m slope—use a bit more elevation.`;
        } else if (nt) {
          const side = nt.dxPx < 0 ? "left" : "right";
          reason = `Struck the ${dist}m slope just ${side} of the target.`;
        } else {
          reason = `Your shot struck the slope at ${dist}m—not a trace remained.`;
        }
      } else if (nt) {
        if (nt.dyPx < -7) {
          badge = `× ${nt.distance}m • Too High`;
          reason = `Shot sailed over the ${nt.distance}m target—aim lower or use a smaller tick.`;
        } else if (Math.abs(nt.dxPx) > 7) {
          const side = nt.dxPx < 0 ? "left" : "right";
          badge = `× ${nt.distance}m • Missed ${side[0].toUpperCase() + side.slice(1)}`;
          reason = `Shot passed just ${side} of the ${nt.distance}m target.`;
        } else {
          badge = `× ${nt.distance}m • Grazing Miss`;
          reason = `Just grazed past the ${nt.distance}m target.`;
        }
      } else {
        badge = "× 400m+ • Open Sky";
        reason = "The shot drifted into open sky—no target in line.";
      }

      return { badge, reason };
    }

    _triggerGameOver(result, aimX, aimY) {
      this.state = STATE.GAMEOVER;
      this._releaseLockSafely();

      // Lock camera exactly where the trigger was pulled so reticle & miss line match 1:1
      this.camX = aimX;
      this.camY = aimY;
      this.recoilX = 0;
      this.recoilY = 0;

      const { badge, reason } = this._buildMissFeedback(result);
      this.missVisual = {
        layerId: result.layerId,
        worldX: result.worldX,
        worldY: result.worldY,
        badge,
        target: result.nearestTarget || null,
      };

      const impScreen = this._projectLayerWorldToScreen(
        this.missVisual.layerId,
        this.missVisual.worldX,
        this.missVisual.worldY,
        this.camX,
        this.camY
      );

      this.ui.overlayGameOver.classList.remove("peeking-scene", "card-top", "card-bottom");
      this.ui.overlayGameOver.classList.add(impScreen.y > this.cy + 30 ? "card-top" : "card-bottom");
      if (this.ui.btnPeek) this.ui.btnPeek.textContent = "Hide Card";

      this._updateOverlayVisibility();
      this.world.alertAllMonsters(true);

      const isNewBest = this.score > this.highScore && this.score > 0;
      if (isNewBest) {
        this.highScore = this.score;
        this._saveNumber(STORAGE_KEY_BEST, this.highScore);
      }

      this.ui.goReason.textContent = reason;
      this.ui.goScore.textContent = String(this.score);
      this.ui.goBest.textContent = String(this.highScore);
      this.ui.goKills.textContent = String(this.kills);
      this.ui.goLongest.textContent = `${this.longestShot}m`;
      this.ui.goNewBest.classList.toggle("hidden", !isNewBest);

      this._updateTitleBest();
    }

    _attemptShot() {
      const now = performance.now();
      if (now < this.triggerArmedAt || now < this.nextShotReadyAt) return;
      this.nextShotReadyAt = now + 450;

      const swayX = Math.sin(this.breathPhase * 0.9) * 1.4;
      const swayY = Math.cos(this.breathPhase * 1.3) * 1.4;
      const aimX = this.camX + swayX;
      const aimY = this.camY + swayY;

      const estDist = this.world.lastRangeReadout || 130;
      window.SakuraAudio.playShot(estDist);

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

          this.kills += 1;
          this.streak += 1;
          if (result.distance > this.longestShot) this.longestShot = result.distance;

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

          this._showToast(`${result.headshot ? "CLEAN HIT" : "HIT"} • ${result.distance}m • +${pts}`);
          this._updateHUD();

          setTimeout(() => {
            if (this.state === STATE.PLAYING) window.SakuraAudio.playBoltCycle();
          }, 210);
        }, flightMs);
      } else {
        const flightMs = Math.min(240, Math.max(40, (result.distance / 1100) * 1000));
        setTimeout(() => {
          window.SakuraAudio.playMiss(result.surface, result.distance);
          this._triggerGameOver(result, aimX, aimY);
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
      const valStr = String(this.sensitivity);
      const label = `${this.sensitivity.toFixed(2)}x`;
      this.ui.sensTitle.value = valStr;
      this.ui.sensPause.value = valStr;
      this.ui.sensValTitle.textContent = label;
      this.ui.sensValPause.textContent = label;
    }

    _syncZoomUI() {
      const valStr = String(this.zoom);
      const label = `${this.zoom.toFixed(2)}x`;
      this.ui.zoomTitle.value = valStr;
      this.ui.zoomPause.value = valStr;
      this.ui.zoomValTitle.textContent = label;
      this.ui.zoomValPause.textContent = label;
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
      document.body.classList.toggle("is-playing", inPlay);
      this.ui.hudTop.classList.toggle("hidden", !inPlay);
      this.ui.hudBottom.classList.toggle("hidden", !inPlay);
    }

    _updateHUD() {
      this.ui.score.textContent = `SCORE ${this.score}`;
      this.ui.best.textContent = `BEST ${this.highScore}`;
      this.ui.kills.textContent = `${this.kills} HUNTED`;
      const isNight = this.timePhase > 0.5;
      this.ui.phase.textContent = `${isNight ? "NIGHT" : "DAY"} • ${this.world.getBiomeLabel()}`;
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
      if (this.state === STATE.PLAYING) {
        this.dayNightClock += dt;
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
        this.timePhase = this.timePhase * this.timePhase * (3 - 2 * this.timePhase);
      } else if (this.state === STATE.TITLE) {
        this.camX += 32 * dt;
        this.camY = 12 + Math.sin(timeSec * 0.25) * 14;
      }

      this.breathPhase += dt * 1.45;
      this.recoilX *= Math.pow(0.001, dt);
      this.recoilY *= Math.pow(0.001, dt);
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 1.8);
      this.hitMarkerAlpha = Math.max(0, this.hitMarkerAlpha - dt * 2.4);

      const windLevel = window.SakuraAudio.getWindLevel(timeSec);
      window.SakuraAudio.updateWind(timeSec, this.timePhase);

      const halfSpanWorldW = (this.W * 0.5) / this.scopeScale + 220;
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

    _projectLayerWorldToScreen(layerId, worldX, worldY, renderCamX, renderCamY) {
      const layers = window.SakuraWorld.LAYERS;
      const layer = layers.find((l) => l.id === layerId) || layers[0];
      return {
        x: this.cx + (worldX - renderCamX * layer.parallax) * this.scopeScale,
        y: this.cy + (worldY - renderCamY * layer.vParallax) * this.scopeScale,
      };
    }

    _render(timeSec) {
      const windLevel = window.SakuraAudio.getWindLevel(timeSec);
      const swayX = this.state === STATE.PLAYING ? Math.sin(this.breathPhase * 0.9) * 1.4 : 0;
      const swayY = this.state === STATE.PLAYING ? Math.cos(this.breathPhase * 1.3) * 1.4 : 0;
      const renderCamX = this.camX + swayX + this.recoilX;
      const renderCamY = this.camY + swayY + this.recoilY;

      const ctx = this.scopeCtx;
      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.W, this.H);

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

      if (this.flashAlpha > 0.005) {
        ctx.fillStyle = `rgba(255, 248, 240, ${this.flashAlpha.toFixed(3)})`;
        ctx.fillRect(0, 0, this.W, this.H);
      }

      this._drawReticle(ctx);

      if (this.state === STATE.GAMEOVER && this.missVisual) {
        this._drawMissOverlay(ctx, renderCamX, renderCamY, timeSec);
      }

      ctx.restore();
    }

    _drawMissOverlay(ctx, renderCamX, renderCamY, timeSec) {
      const mv = this.missVisual;
      const bs = this.baseScale;
      const imp = this._projectLayerWorldToScreen(mv.layerId, mv.worldX, mv.worldY, renderCamX, renderCamY);
      const isNight = this.timePhase > 0.5;

      const accent = isNight ? "rgba(255, 138, 166, 0.95)" : "rgba(196, 48, 86, 0.92)";
      const halo = isNight ? "rgba(20, 14, 24, 0.72)" : "rgba(255, 248, 250, 0.85)";

      ctx.save();

      // 1) If a monster was nearby, circle its ghosted head & connect to the miss point
      let tgtScreen = null;
      if (mv.target) {
        tgtScreen = this._projectLayerWorldToScreen(
          mv.target.layerId,
          mv.target.worldX,
          mv.target.worldY,
          renderCamX,
          renderCamY
        );

        ctx.save();
        ctx.setLineDash([3 * bs, 3 * bs]);
        ctx.strokeStyle = isNight ? "rgba(248, 224, 232, 0.55)" : "rgba(44, 30, 38, 0.45)";
        ctx.lineWidth = Math.max(1.2, 1.3 * bs);
        ctx.beginPath();
        ctx.arc(tgtScreen.x, tgtScreen.y, Math.max(10, 14 * bs), 0, Math.PI * 2);
        ctx.stroke();

        if (Math.hypot(tgtScreen.x - imp.x, tgtScreen.y - imp.y) > 8) {
          ctx.beginPath();
          ctx.moveTo(imp.x, imp.y);
          ctx.lineTo(tgtScreen.x, tgtScreen.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 2) Dotted ballistic drop trajectory from center cross to impact point
      ctx.save();
      ctx.setLineDash([4 * bs, 4 * bs]);
      ctx.lineCap = "round";

      ctx.strokeStyle = halo;
      ctx.lineWidth = Math.max(3, 3.4 * bs);
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.lineTo(imp.x, imp.y);
      ctx.stroke();

      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1.5, 1.8 * bs);
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.lineTo(imp.x, imp.y);
      ctx.stroke();
      ctx.restore();

      // 3) Crisp pulsing ring + X at the exact impact / pass point
      const pulse = 1 + 0.14 * Math.sin(timeSec * 4.2);
      const mr = Math.max(6, 8 * bs) * pulse;
      const xr = Math.max(4, 5 * bs);

      ctx.strokeStyle = halo;
      ctx.lineWidth = Math.max(3, 3.4 * bs);
      ctx.beginPath();
      ctx.arc(imp.x, imp.y, mr, 0, Math.PI * 2);
      ctx.moveTo(imp.x - xr, imp.y - xr);
      ctx.lineTo(imp.x + xr, imp.y + xr);
      ctx.moveTo(imp.x + xr, imp.y - xr);
      ctx.lineTo(imp.x - xr, imp.y + xr);
      ctx.stroke();

      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1.6, 1.8 * bs);
      ctx.beginPath();
      ctx.arc(imp.x, imp.y, mr, 0, Math.PI * 2);
      ctx.moveTo(imp.x - xr, imp.y - xr);
      ctx.lineTo(imp.x + xr, imp.y + xr);
      ctx.moveTo(imp.x + xr, imp.y - xr);
      ctx.lineTo(imp.x - xr, imp.y + xr);
      ctx.stroke();

      // 4) Clean compact pill label beside the impact point (dodging target side if needed)
      const fontSize = Math.round(Math.max(11, 11.5 * bs));
      ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
      const textW = ctx.measureText(mv.badge).width;
      const padX = 9;
      const pillW = textW + padX * 2;
      const pillH = fontSize + 10;

      const placeLeft = tgtScreen ? tgtScreen.x > imp.x : false;
      let px = placeLeft ? imp.x - mr - 10 - pillW : imp.x + mr + 10;
      px = Math.max(10, Math.min(this.W - pillW - 10, px));
      let py = Math.max(12, Math.min(this.H - pillH - 12, imp.y - pillH * 0.5));

      ctx.fillStyle = isNight ? "rgba(28, 26, 44, 0.84)" : "rgba(255, 248, 250, 0.88)";
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(px, py, pillW, pillH, 999);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isNight ? "#F8ECF2" : "#2D1E26";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(mv.badge, px + padX, py + pillH * 0.5 + 0.5);

      ctx.restore();
    }

    _drawReticle(ctx) {
      const R = this.reticleRadius;
      const cx = this.cx;
      const cy = this.cy;
      const bs = this.baseScale;
      const ts = this.tickScale;
      const t = this.timePhase;

      const r = Math.round(32 + (246 - 32) * t);
      const g = Math.round(24 + (234 - 24) * t);
      const b = Math.round(32 + (240 - 32) * t);

      const lineAlpha = 0.82 + (0.84 - 0.82) * t;
      const labelAlpha = 0.55 + (0.62 - 0.55) * t;
      const lineColor = `rgba(${r}, ${g}, ${b}, ${lineAlpha.toFixed(3)})`;
      const labelColor = `rgba(${r}, ${g}, ${b}, ${labelAlpha.toFixed(3)})`;
      const haloAlpha = Math.min(0.28, Math.max(0, (t - 0.12) * 0.36));

      const dotR = Math.round(182 + (246 - 182) * t);
      const dotG = Math.round(62 + (178 - 62) * t);
      const dotB = Math.round(92 + (198 - 92) * t);
      const dotA = 0.85 + (0.9 - 0.85) * t;

      ctx.save();
      ctx.lineCap = "butt";

      const maxAllowY = this.H * 0.43;
      const allTicks = [
        { dist: 100, label: "1", halfW: 5.5 * bs },
        { dist: 200, label: "2", halfW: 8.0 * bs },
        { dist: 300, label: "3", halfW: 10.5 * bs },
        { dist: 400, label: "4", halfW: 13.0 * bs },
      ]
        .map((tk) => ({ ...tk, yOff: getCanonicalDrop(tk.dist) * ts }))
        .filter((tk) => tk.yOff <= maxAllowY);

      const postStart = R * 0.96;
      const postEnd = R * 0.56;
      const maxTickY = allTicks.length > 0 ? allTicks[allTicks.length - 1].yOff : 0;
      const bottomThinEnd = Math.min(this.H * 0.44, Math.max(postEnd, maxTickY + 14 * bs));
      const bottomPostStart = Math.min(this.H * 0.47, Math.max(postStart, bottomThinEnd + 18 * bs));

      const strokeReticlePaths = (extraW) => {
        ctx.lineWidth = Math.max(1.8, 2.4 * bs) + extraW;
        ctx.beginPath();
        ctx.moveTo(cx - postStart, cy);
        ctx.lineTo(cx - postEnd, cy);
        ctx.moveTo(cx + postEnd, cy);
        ctx.lineTo(cx + postStart, cy);
        ctx.moveTo(cx, cy - postStart);
        ctx.lineTo(cx, cy - postEnd);
        if (bottomPostStart > bottomThinEnd + 2) {
          ctx.moveTo(cx, cy + bottomThinEnd);
          ctx.lineTo(cx, cy + bottomPostStart);
        }
        ctx.stroke();

        ctx.lineWidth = Math.max(1, 1.05 * bs) + extraW;
        ctx.beginPath();
        ctx.moveTo(cx - postEnd, cy);
        ctx.lineTo(cx + postEnd, cy);
        ctx.moveTo(cx, cy - postEnd);
        ctx.lineTo(cx, cy + bottomThinEnd);
        ctx.stroke();

        ctx.lineWidth = Math.max(1, 1.1 * bs) + extraW;
        for (const tk of allTicks) {
          const ty = cy + tk.yOff;
          ctx.beginPath();
          ctx.moveTo(cx - tk.halfW, ty);
          ctx.lineTo(cx + tk.halfW, ty);
          ctx.stroke();
        }
      };

      if (haloAlpha > 0.01) {
        ctx.strokeStyle = `rgba(22, 16, 26, ${haloAlpha.toFixed(3)})`;
        strokeReticlePaths(1.3 * bs);
      }

      ctx.strokeStyle = lineColor;
      strokeReticlePaths(0);

      ctx.fillStyle = labelColor;
      ctx.font = `500 ${Math.round(Math.max(8, 8.5 * bs))}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      for (const tk of allTicks) {
        ctx.fillText(tk.label, cx + tk.halfW + 4.5 * bs, cy + tk.yOff);
      }

      ctx.fillStyle = `rgba(${dotR}, ${dotG}, ${dotB}, ${dotA.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.3, 1.5 * bs), 0, Math.PI * 2);
      ctx.fill();

      if (this.hitMarkerAlpha > 0.02) {
        const a = this.hitMarkerAlpha;
        const d1 = 6 * bs;
        const d2 = 13 * bs;
        ctx.strokeStyle = this.hitMarkerHead
          ? `rgba(220, 74, 108, ${a.toFixed(2)})`
          : `rgba(255, 245, 248, ${a.toFixed(2)})`;
        ctx.lineWidth = Math.max(1.5, 1.8 * bs);
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

  function bootSakuraScope() {
    new SakuraScopeGame();
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", bootSakuraScope);
  } else {
    bootSakuraScope();
  }
})();
