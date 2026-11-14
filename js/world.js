(function () {
  "use strict";

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpRGB(c1, c2, t) {
    return [
      Math.round(lerp(c1[0], c2[0], t)),
      Math.round(lerp(c1[1], c2[1], t)),
      Math.round(lerp(c1[2], c2[2], t)),
    ];
  }

  function rgbStr(c, alpha) {
    if (alpha === undefined) return `rgb(${c[0]},${c[1]},${c[2]})`;
    return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
  }

  // 4 gameplay depth planes ordered back-to-front
  const LAYERS = [
    {
      id: 1,
      name: "Distant Ridge",
      parallax: 0.42,
      vParallax: 0.45,
      scale: 0.44,
      nominalDist: 315,
      distJitter: 18,
      baseY: 5,
      hillAmp: 26,
      chunkW: 360,
    },
    {
      id: 2,
      name: "Far Slope",
      parallax: 0.62,
      vParallax: 0.65,
      scale: 0.64,
      nominalDist: 210,
      distJitter: 12,
      baseY: 62,
      hillAmp: 28,
      chunkW: 410,
    },
    {
      id: 3,
      name: "Midground Grove",
      parallax: 0.82,
      vParallax: 0.84,
      scale: 0.85,
      nominalDist: 130,
      distJitter: 10,
      baseY: 122,
      hillAmp: 30,
      chunkW: 460,
    },
    {
      id: 4,
      name: "Foreground Meadow",
      parallax: 1.0,
      vParallax: 1.0,
      scale: 1.12,
      nominalDist: 65,
      distJitter: 6,
      baseY: 190,
      hillAmp: 30,
      chunkW: 520,
    },
  ];

  // Pastel color palettes smoothly interpolated between Day (0) and Night (1)
  const ENV_COLORS = {
    skyTop: { day: [198, 226, 245], night: [42, 47, 78] },
    skyMid: { day: [232, 238, 246], night: [66, 68, 104] },
    skyHor: { day: [253, 234, 240], night: [106, 97, 134] },
    cloud: { day: [255, 249, 251], night: [92, 91, 126] },
    cloudShade: { day: [234, 218, 229], night: [72, 72, 102] },
    mtnFar: { day: [182, 198, 220], night: [54, 62, 92] },

    hills: {
      1: { day: [167, 191, 189], night: [57, 68, 92] },
      2: { day: [154, 194, 162], night: [50, 74, 82] },
      3: { day: [134, 179, 140], night: [44, 69, 73] },
      4: { day: [120, 166, 128], night: [38, 61, 64] },
    },
    trunk: { day: [124, 101, 94], night: [70, 61, 72] },
    trunkHi: { day: [148, 122, 114], night: [88, 78, 92] },
    sakuraA: { day: [250, 214, 224], night: [174, 144, 174] },
    sakuraB: { day: [244, 184, 202], night: [148, 121, 152] },
    sakuraLight: { day: [255, 240, 244], night: [204, 175, 202] },
    torii: { day: [216, 136, 126], night: [128, 86, 98] },
    toriiCap: { day: [108, 96, 100], night: [64, 58, 72] },
    stone: { day: [190, 182, 174], night: [92, 92, 106] },
    stoneShade: { day: [158, 150, 144], night: [72, 72, 86] },
    bamboo: { day: [144, 188, 146], night: [62, 94, 86] },
    bambooDark: { day: [118, 162, 122], night: [48, 76, 72] },
  };

  class WorldState {
    constructor() {
      this.layerMaps = new Map();
      LAYERS.forEach((l) => this.layerMaps.set(l.id, new Map()));
      this.generationNonce = 1;
      this.petals = [];
      this.fireflies = [];
      this.clouds = [];
      this.stars = [];
      this.birds = [];
      this.bursts = [];
      this.impactMarks = [];
      this.lastCamX = 0;
      this.killCount = 0;
      this.lastRangeReadout = 130;
      this.reset();
    }

    reset() {
      LAYERS.forEach((l) => this.layerMaps.get(l.id).clear());
      this.generationNonce = 1;
      this.bursts = [];
      this.impactMarks = [];
      this.killCount = 0;
      this.lastCamX = 0;

      // Ambient drifting sakura petals
      this.petals = [];
      for (let i = 0; i < 65; i++) {
        this.petals.push(this._makePetal(true));
      }

      // Nighttime fireflies
      this.fireflies = [];
      for (let i = 0; i < 28; i++) {
        this.fireflies.push({
          ox: (Math.random() - 0.5) * 1400,
          oy: -40 + Math.random() * 280,
          phase: Math.random() * Math.PI * 2,
          speed: 0.4 + Math.random() * 0.7,
          r: 1.5 + Math.random() * 1.8,
        });
      }

      // Soft pastel clouds
      this.clouds = [];
      for (let i = 0; i < 12; i++) {
        this.clouds.push({
          x: (Math.random() - 0.5) * 2600,
          y: -310 + Math.random() * 200,
          w: 110 + Math.random() * 140,
          h: 28 + Math.random() * 24,
          speed: 3 + Math.random() * 6,
          puffs: 3 + Math.floor(Math.random() * 3),
        });
      }

      // Subtle twilight stars
      this.stars = [];
      for (let i = 0; i < 60; i++) {
        this.stars.push({
          x: (Math.random() - 0.5) * 2200,
          y: -420 + Math.random() * 290,
          r: 0.7 + Math.random() * 1.3,
          twinkle: Math.random() * Math.PI * 2,
        });
      }

      // Occasional distant serene cranes
      this.birds = [];
      for (let i = 0; i < 4; i++) {
        this.birds.push({
          x: -500 + i * 24 + Math.random() * 800,
          y: -210 + Math.random() * 90,
          speed: 14 + Math.random() * 8,
          flapPhase: Math.random() * Math.PI * 2,
          scale: 0.65 + Math.random() * 0.35,
        });
      }

      // Pre-populate initial view & guarantee an approachable first monster nearby
      this._ensureChunks(0, 1200, true);
    }

    _makePetal(randomX) {
      return {
        ox: (Math.random() - 0.5) * 1200,
        oy: randomX ? -350 + Math.random() * 640 : -360 - Math.random() * 80,
        vx: 14 + Math.random() * 22,
        vy: 18 + Math.random() * 24,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 2.4,
        wobble: Math.random() * Math.PI * 2,
        size: 2.5 + Math.random() * 3.4,
      };
    }

    // Smooth hill height curve (continuous across chunk seams!)
    _hillHeightAt(layer, worldX) {
      return (
        layer.baseY +
        Math.sin(worldX * 0.0028 + layer.id * 1.7) * (layer.hillAmp * 0.55) +
        Math.cos(worldX * 0.0063 - layer.id * 0.9) * (layer.hillAmp * 0.32) +
        Math.sin(worldX * 0.013 + layer.id * 2.5) * (layer.hillAmp * 0.13)
      );
    }

    _countNearbyMonsters(camX, radiusWorld) {
      let count = 0;
      for (const layer of LAYERS) {
        const map = this.layerMaps.get(layer.id);
        const lx = camX * layer.parallax;
        for (const chunk of map.values()) {
          if (chunk.monster && chunk.monster.alive && !chunk.monster.vanishing) {
            if (Math.abs(chunk.monster.worldX - lx) < radiusWorld * layer.parallax + 250) {
              count++;
            }
          }
        }
      }
      return count;
    }

    _generateChunk(layer, chunkIdx, isStarterPass) {
      const nonce = this.generationNonce++;
      const x0 = chunkIdx * layer.chunkW;
      const s = layer.scale;
      const chunkDist = Math.round(
        layer.nominalDist + (Math.random() * 2 - 1) * layer.distJitter
      );

      const props = [];
      const flowerPatches = [];
      const grassClumps = [];

      // Choose biome flavor for this newly generated chunk
      const biomeRoll = Math.random();
      const hasBamboo = biomeRoll < 0.25;
      const hasTorii = biomeRoll >= 0.25 && biomeRoll < 0.48 && layer.id <= 3;

      // 1) Sakura trees (1 to 3 per chunk)
      const treeCount = hasBamboo ? 1 : 1 + Math.floor(Math.random() * 2.2);
      for (let i = 0; i < treeCount; i++) {
        const px = x0 + 55 + ((i + 0.35 + Math.random() * 0.45) / treeCount) * (layer.chunkW - 110);
        const py = this._hillHeightAt(layer, px) + 4 * s;
        const height = (68 + Math.random() * 34) * s;
        const trunkW = (11 + Math.random() * 5) * s;
        const lean = (Math.random() - 0.5) * 16 * s;

        const puffs = [];
        const puffCount = 5 + Math.floor(Math.random() * 3);
        for (let p = 0; p < puffCount; p++) {
          const ang = (p / puffCount) * Math.PI * 1.4 - Math.PI * 0.7;
          puffs.push({
            dx: lean + Math.sin(ang) * (20 + Math.random() * 20) * s,
            dy: -height + Math.cos(ang) * 12 * s - Math.random() * 14 * s,
            r: (18 + Math.random() * 14) * s,
            tone: p % 3,
          });
        }

        props.push({
          type: "sakura",
          x: px,
          y: py,
          height,
          trunkW,
          lean,
          puffs,
          splats: [],
          monster: null,
        });
      }

      // 2) Bamboo groves
      if (hasBamboo) {
        const bx = x0 + 90 + Math.random() * (layer.chunkW - 180);
        const by = this._hillHeightAt(layer, bx) + 5 * s;
        const poles = [];
        const poleCount = 4 + Math.floor(Math.random() * 4);
        for (let p = 0; p < poleCount; p++) {
          poles.push({
            dx: (p - poleCount / 2) * (10 + Math.random() * 4) * s,
            h: (84 + Math.random() * 36) * s,
            w: (4.2 + Math.random() * 1.8) * s,
            tilt: (Math.random() - 0.5) * 0.08,
            dark: p % 2 === 0,
          });
        }
        props.push({
          type: "bamboo",
          x: bx,
          y: by,
          poles,
          splats: [],
          monster: null,
        });
      }

      // 3) Torii Gate
      if (hasTorii) {
        const tx = x0 + layer.chunkW * (0.3 + Math.random() * 0.4);
        const ty = this._hillHeightAt(layer, tx) + 3 * s;
        props.push({
          type: "torii",
          x: tx,
          y: ty,
          w: 58 * s,
          h: 64 * s,
          splats: [],
          monster: null,
        });
      }

      // 4) Stone Lanterns (Tōrō) & Mossy Boulders
      if (Math.random() < 0.72) {
        const lx = x0 + 60 + Math.random() * (layer.chunkW - 120);
        const ly = this._hillHeightAt(layer, lx) + 4 * s;
        props.push({
          type: Math.random() < 0.6 ? "lantern" : "boulder",
          x: lx,
          y: ly,
          size: (26 + Math.random() * 8) * s,
          splats: [],
          monster: null,
        });
      }

      // 5) Wildflowers & Swaying Meadow Grass Clumps
      const clumpCount = 5 + Math.floor(Math.random() * 4);
      for (let g = 0; g < clumpCount; g++) {
        const gx = x0 + 25 + Math.random() * (layer.chunkW - 50);
        const gy = this._hillHeightAt(layer, gx) + (2 + Math.random() * 10) * s;
        const blades = [];
        for (let b = 0; b < 6; b++) {
          blades.push({
            dx: (b - 2.5) * 4.2 * s,
            h: (12 + Math.random() * 10) * s,
            bend: (Math.random() - 0.5) * 6 * s,
          });
        }
        grassClumps.push({
          x: gx,
          y: gy,
          blades,
          splats: [],
          monster: null,
        });
      }

      const flowerColors = [
        [252, 240, 200],
        [249, 198, 214],
        [204, 218, 248],
        [232, 206, 244],
      ];
      for (let f = 0; f < 16; f++) {
        const fx = x0 + Math.random() * layer.chunkW;
        const fy = this._hillHeightAt(layer, fx) + (4 + Math.random() * 24) * s;
        flowerPatches.push({
          x: fx,
          y: fy,
          r: (1.8 + Math.random() * 2.2) * s,
          col: flowerColors[f % flowerColors.length],
        });
      }

      // Decide if this chunk spawns a sneaky monster!
      let monster = null;
      const shouldConsiderSpawn = !isStarterPass || (Math.abs(chunkIdx) === 1 && (layer.id === 3 || layer.id === 4));

      if (shouldConsiderSpawn) {
        const nearby = this._countNearbyMonsters(this.lastCamX, 650);
        // Scale difficulty mix smoothly with killCount
        let layerWeight = 0.28;
        if (this.killCount < 2) {
          // Early shots: mostly close/mid targets (Layers 3 & 4)
          layerWeight = layer.id >= 3 ? 0.52 : layer.id === 2 ? 0.14 : 0.05;
        } else if (this.killCount < 5) {
          layerWeight = layer.id >= 2 ? 0.4 : 0.25;
        } else {
          // Later shots: more distant & sneaky ridge targets too
          layerWeight = layer.id <= 2 ? 0.44 : 0.34;
        }

        const forceNeeded = nearby === 0 && Math.random() < 0.68;
        const starterTrigger = isStarterPass && chunkIdx === 1 && layer.id === 3 && nearby === 0;

        if (starterTrigger || (!isStarterPass && (forceNeeded || (nearby < 2 && Math.random() < layerWeight)))) {
          monster = this._attachMonsterToChunk(layer, chunkDist, props, grassClumps);
        }
      }

      return {
        idx: chunkIdx,
        nonce,
        x0,
        x1: x0 + layer.chunkW,
        dist: chunkDist,
        props,
        grassClumps,
        flowerPatches,
        monster,
      };
    }

    _attachMonsterToChunk(layer, chunkDist, props, grassClumps) {
      const s = layer.scale;
      const peek = Math.random() < 0.5 ? -1 : 1;

      // Pick a hiding anchor prop available in this chunk
      const candidates = [];
      props.forEach((p) => {
        if (p.type === "sakura") {
          candidates.push({ prop: p, mode: "trunk" });
          candidates.push({ prop: p, mode: "canopy" });
        } else if (p.type === "lantern" || p.type === "boulder") {
          candidates.push({ prop: p, mode: "stone" });
        } else if (p.type === "bamboo") {
          candidates.push({ prop: p, mode: "bamboo" });
        } else if (p.type === "torii") {
          candidates.push({ prop: p, mode: "torii" });
        }
      });

      if (grassClumps.length > 0) {
        const g = grassClumps[Math.floor(Math.random() * grassClumps.length)];
        candidates.push({ prop: g, mode: "grass" });
      }

      if (candidates.length === 0) return null;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      const p = pick.prop;

      let species = "bark_lurker";
      let mx = p.x;
      let my = p.y;

      if (pick.mode === "trunk") {
        species = "bark_lurker";
        mx = p.x + peek * (p.trunkW * 0.45);
        my = p.y;
      } else if (pick.mode === "canopy") {
        species = "blossom_mimic";
        const puff = p.puffs[Math.floor(Math.random() * p.puffs.length)];
        mx = p.x + puff.dx * 0.7;
        my = p.y + puff.dy + 8 * s;
      } else if (pick.mode === "stone") {
        species = "lantern_shade";
        mx = p.x + peek * (p.size * 0.42);
        my = p.y;
      } else if (pick.mode === "bamboo") {
        species = "bamboo_stalker";
        const pole = p.poles[Math.floor(Math.random() * p.poles.length)];
        mx = p.x + pole.dx + peek * 3 * s;
        my = p.y;
      } else if (pick.mode === "torii") {
        species = "ridge_phantom";
        mx = p.x + peek * (p.w * 0.36);
        my = p.y;
      } else if (pick.mode === "grass") {
        species = layer.id === 1 ? "ridge_phantom" : "grass_oni";
        mx = p.x;
        my = p.y + 3 * s;
      }

      const monster = window.SakuraMonsters.createMonster({
        species,
        hideMode: pick.mode,
        worldX: mx,
        worldY: my,
        scale: s,
        distance: chunkDist,
        peekSide: peek,
        layerId: layer.id,
        difficulty: this.killCount,
      });

      p.monster = monster;
      return monster;
    }

    _ensureChunks(camX, halfSpanWorldW, isStarterPass) {
      for (const layer of LAYERS) {
        const map = this.layerMaps.get(layer.id);
        const lx = camX * layer.parallax;
        const viewHalf = halfSpanWorldW * Math.max(0.65, layer.parallax) + layer.chunkW * 0.9;
        const minIdx = Math.floor((lx - viewHalf) / layer.chunkW);
        const maxIdx = Math.floor((lx + viewHalf) / layer.chunkW);

        // Evict chunks completely past the blurred periphery so looking back reveals a brand-new world
        const evictHalf = viewHalf + layer.chunkW * 0.45;
        for (const [idx, chunk] of map.entries()) {
          const cx = (chunk.x0 + chunk.x1) * 0.5;
          if (Math.abs(cx - lx) > evictHalf) {
            map.delete(idx);
          }
        }

        // Generate fresh chunks just beyond the visual border
        for (let idx = minIdx; idx <= maxIdx; idx++) {
          if (!map.has(idx)) {
            map.set(idx, this._generateChunk(layer, idx, isStarterPass));
          }
        }
      }
    }

    update(dt, camX, camY, halfSpanWorldW, timePhase, windLevel, killCount) {
      this.lastCamX = camX;
      this.killCount = killCount;
      this._ensureChunks(camX, halfSpanWorldW, false);

      // Update monsters
      for (const layer of LAYERS) {
        const map = this.layerMaps.get(layer.id);
        for (const chunk of map.values()) {
          if (chunk.monster) {
            window.SakuraMonsters.updateMonster(chunk.monster, dt);
          }
        }
      }

      // Clouds & birds drift
      for (const c of this.clouds) {
        c.x += c.speed * (0.7 + windLevel * 0.6) * dt;
        const rel = c.x - camX * 0.14;
        if (rel > 1400) c.x -= 2800;
        if (rel < -1400) c.x += 2800;
      }

      for (const b of this.birds) {
        b.x += b.speed * dt;
        b.flapPhase += dt * 4.5;
        const rel = b.x - camX * 0.22;
        if (rel > 1100) b.x -= 2200;
      }

      // Drifting sakura petals driven by live wind gusts
      for (const p of this.petals) {
        p.wobble += dt * 2.2;
        p.rot += p.vRot * dt;
        p.ox += (p.vx * (0.45 + windLevel * 1.45) + Math.sin(p.wobble) * 14) * dt;
        p.oy += p.vy * (0.7 + windLevel * 0.45) * dt;
        if (p.ox > 650) p.ox -= 1300;
        if (p.ox < -650) p.ox += 1300;
        if (p.oy > 340) {
          p.oy = -340 - Math.random() * 60;
          p.ox = (Math.random() - 0.5) * 1200;
        }
      }

      // Fireflies
      for (const f of this.fireflies) {
        f.phase += dt * f.speed;
        f.ox += Math.sin(f.phase * 0.9) * 10 * dt;
        f.oy += Math.cos(f.phase * 1.2) * 8 * dt;
      }

      // Splat burst particles
      for (let i = this.bursts.length - 1; i >= 0; i--) {
        const b = this.bursts[i];
        let aliveAny = false;
        for (const pt of b.particles) {
          if (pt.kind === "ring") {
            pt.r += (pt.maxR - pt.r) * Math.min(1, dt * 11);
            pt.alpha -= dt * 2.2;
          } else {
            pt.vy += pt.gravity * dt;
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.rot += pt.vRot * dt;
            pt.alpha -= pt.decay * dt;
          }
          if (pt.alpha > 0.02) aliveAny = true;
        }
        if (!aliveAny) this.bursts.splice(i, 1);
      }

      // Impact marks fade slowly
      for (let i = this.impactMarks.length - 1; i >= 0; i--) {
        this.impactMarks[i].alpha -= dt * 0.55;
        if (this.impactMarks[i].alpha <= 0) this.impactMarks.splice(i, 1);
      }
    }

    // Trigger all nearby monsters to vanish when a shot misses
    alertAllMonsters() {
      for (const layer of LAYERS) {
        for (const chunk of this.layerMaps.get(layer.id).values()) {
          if (chunk.monster && chunk.monster.alive) {
            chunk.monster.vanishing = true;
          }
        }
      }
    }

    // Raycast front-to-back (Layer 4 -> Layer 1) along ballistic trajectory
    evaluateShot(camX, camY, scopeScale, tickScale, dropCanonicalFn) {
      const worldPerScreen = 1 / scopeScale;

      for (let i = LAYERS.length - 1; i >= 0; i--) {
        const layer = LAYERS[i];
        const map = this.layerMaps.get(layer.id);
        const aimWorldX = camX * layer.parallax;

        for (const chunk of map.values()) {
          if (aimWorldX < chunk.x0 - 30 || aimWorldX > chunk.x1 + 30) continue;

          // Compute exact drop at this chunk's distance
          const dropPx = dropCanonicalFn(chunk.dist) * tickScale;
          const impactWorldY = camY * layer.vParallax + dropPx * worldPerScreen;

          // 1) If chunk has an active monster, test if its exposed body/head was hit
          const m = chunk.monster;
          if (m && m.alive && !m.vanishing) {
            // If behind a trunk or stone, first ensure the solid core of the obstacle didn't eat the bullet
            const blocked = this._checkObstacleBlock(chunk, m, aimWorldX, impactWorldY, layer.scale);
            if (blocked) {
              this.impactMarks.push({
                layerId: layer.id,
                x: aimWorldX,
                y: impactWorldY,
                alpha: 1,
                color: blocked === "stone" ? "#F7EFEA" : "#C9B19D",
              });
              return { hit: false, surface: blocked, distance: chunk.dist };
            }

            const res = window.SakuraMonsters.testMonsterHit(m, aimWorldX, impactWorldY);
            if (res) {
              m.alive = false;
              this._stampSplatOnAnchor(chunk, m, aimWorldX, impactWorldY);
              return {
                hit: true,
                headshot: res.headshot,
                distance: m.distance,
                layerId: layer.id,
                worldX: aimWorldX,
                worldY: impactWorldY,
                scale: layer.scale,
              };
            }
          }

          // 2) Check if bullet struck solid stone/trunk prop
          const propHit = this._checkAnySolidProp(chunk, aimWorldX, impactWorldY, layer.scale);
          if (propHit) {
            this.impactMarks.push({
              layerId: layer.id,
              x: aimWorldX,
              y: impactWorldY,
              alpha: 1,
              color: propHit === "stone" ? "#F7EFEA" : "#B89A86",
            });
            return { hit: false, surface: propHit, distance: chunk.dist };
          }

          // 3) Check if bullet hit the hillside dirt
          const hillY = this._hillHeightAt(layer, aimWorldX);
          if (impactWorldY >= hillY) {
            this.impactMarks.push({
              layerId: layer.id,
              x: aimWorldX,
              y: hillY + 2,
              alpha: 1,
              color: "#D9C7B8",
            });
            return { hit: false, surface: "earth", distance: chunk.dist };
          }
        }
      }

      return { hit: false, surface: "air", distance: 400 };
    }

    _checkObstacleBlock(chunk, monster, x, y, s) {
      for (const p of chunk.props) {
        if (p.monster !== monster) continue;
        if (p.type === "sakura" && monster.hideMode === "trunk") {
          const trunkCenter = p.x + p.lean * 0.25;
          if (Math.abs(x - trunkCenter) < p.trunkW * 0.36 && y < p.y && y > p.y - p.height * 0.92) {
            return "wood";
          }
        } else if ((p.type === "lantern" || p.type === "boulder") && monster.hideMode === "stone") {
          if (Math.abs(x - p.x) < p.size * 0.38 && y < p.y && y > p.y - p.size * 1.15) {
            return "stone";
          }
        }
      }
      return null;
    }

    _checkAnySolidProp(chunk, x, y, s) {
      for (const p of chunk.props) {
        if (p.type === "sakura") {
          const trunkCenter = p.x + p.lean * 0.25;
          if (Math.abs(x - trunkCenter) < p.trunkW * 0.42 && y < p.y && y > p.y - p.height * 0.92) {
            return "wood";
          }
        } else if (p.type === "lantern" || p.type === "boulder") {
          if (Math.abs(x - p.x) < p.size * 0.45 && y < p.y && y > p.y - p.size * 1.15) {
            return "stone";
          }
        } else if (p.type === "torii") {
          const halfW = p.w * 0.36;
          if (
            (Math.abs(x - (p.x - halfW)) < 4 * s || Math.abs(x - (p.x + halfW)) < 4 * s) &&
            y < p.y &&
            y > p.y - p.h
          ) {
            return "wood";
          }
        }
      }
      return null;
    }

    _stampSplatOnAnchor(chunk, monster, wx, wy) {
      const targetProp =
        chunk.props.find((p) => p.monster === monster) ||
        chunk.grassClumps.find((g) => g.monster === monster);
      if (!targetProp) return;
      for (let i = 0; i < 6; i++) {
        targetProp.splats.push({
          dx: wx - targetProp.x + (Math.random() - 0.5) * 14 * monster.scale,
          dy: wy - targetProp.y + (Math.random() - 0.5) * 14 * monster.scale,
          r: (2.5 + Math.random() * 4.5) * monster.scale,
        });
      }
    }

    // Reads distance of terrain/props at center cross (or slightly below along BDC drop line when aiming high)
    getRangeReading(camX, camY, scopeScale, tickScale, dropCanonicalFn) {
      // Sample front-to-back at center cross first
      const centerRes = this._sampleEnvDistanceAt(camX, camY, 0, scopeScale);
      if (centerRes !== null) {
        this.lastRangeReadout = centerRes;
        return `${centerRes}m`;
      }

      // If aiming just above a hillside to use a BDC tick, look along the vertical drop line
      for (const testDist of [130, 210, 315]) {
        const dropPx = dropCanonicalFn(testDist) * tickScale;
        const tickRes = this._sampleEnvDistanceAt(camX, camY, dropPx / scopeScale, scopeScale);
        if (tickRes !== null && Math.abs(tickRes - testDist) < 45) {
          this.lastRangeReadout = tickRes;
          return `${tickRes}m`;
        }
      }

      return "---";
    }

    _sampleEnvDistanceAt(camX, camY, worldOffsetY, scopeScale) {
      for (let i = LAYERS.length - 1; i >= 0; i--) {
        const layer = LAYERS[i];
        const map = this.layerMaps.get(layer.id);
        const lx = camX * layer.parallax;
        const ly = camY * layer.vParallax + worldOffsetY;

        for (const chunk of map.values()) {
          if (lx < chunk.x0 || lx > chunk.x1) continue;
          const hillY = this._hillHeightAt(layer, lx);
          if (ly >= hillY - 6 * layer.scale) {
            return chunk.dist;
          }
          for (const p of chunk.props) {
            if (p.type === "sakura" && Math.abs(lx - p.x) < 34 * layer.scale && ly < p.y && ly > p.y - p.height - 25 * layer.scale) {
              return chunk.dist;
            }
            if ((p.type === "lantern" || p.type === "boulder") && Math.abs(lx - p.x) < p.size * 0.65 && ly < p.y && ly > p.y - p.size * 1.25) {
              return chunk.dist;
            }
            if (p.type === "torii" && Math.abs(lx - p.x) < p.w * 0.55 && ly < p.y && ly > p.y - p.h * 1.05) {
              return chunk.dist;
            }
            if (p.type === "bamboo" && Math.abs(lx - p.x) < 28 * layer.scale && ly < p.y && ly > p.y - 105 * layer.scale) {
              return chunk.dist;
            }
          }
        }
      }
      return null;
    }

    renderPeripheral(ctx, W, H, camX, camY, peripheralScale, timePhase, time, windLevel) {
      this._renderScene(ctx, W, H, W / 2, H / 2, camX, camY, peripheralScale, timePhase, time, windLevel, false);
    }

    renderScopeWorld(ctx, W, H, cx, cy, camX, camY, scopeScale, timePhase, time, windLevel) {
      this._renderScene(ctx, W, H, cx, cy, camX, camY, scopeScale, timePhase, time, windLevel, true);
    }

    _renderScene(ctx, W, H, cx, cy, camX, camY, scale, timePhase, time, windLevel, isSharpScope) {
      // 1) Pastel Sky Gradient
      const topC = lerpRGB(ENV_COLORS.skyTop.day, ENV_COLORS.skyTop.night, timePhase);
      const midC = lerpRGB(ENV_COLORS.skyMid.day, ENV_COLORS.skyMid.night, timePhase);
      const horC = lerpRGB(ENV_COLORS.skyHor.day, ENV_COLORS.skyHor.night, timePhase);

      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(0, rgbStr(topC));
      skyGrad.addColorStop(0.54, rgbStr(midC));
      skyGrad.addColorStop(1, rgbStr(horC));
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      // 2) Stars (at twilight/night)
      if (timePhase > 0.25) {
        const starAlpha = Math.min(1, (timePhase - 0.25) / 0.65);
        for (const st of this.stars) {
          const sx = cx + (((st.x - camX * 0.05) % 2000 + 3000) % 2000 - 1000) * scale;
          const sy = cy + (st.y - camY * 0.14) * scale;
          if (sy < -10 || sy > H + 10) continue;
          const tw = 0.45 + 0.55 * Math.sin(time * 1.7 + st.twinkle);
          ctx.fillStyle = `rgba(248, 240, 246, ${(starAlpha * tw * 0.72).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(sx, sy, st.r * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 3) Sun / Moon
      const sunX = cx + (170 - camX * 0.04) * scale;
      const sunY = cy + (-175 + timePhase * 18 - camY * 0.1) * scale;
      const wrappedSunX = ((sunX % 2200) + 2200) % 2200;
      const orbX = wrappedSunX > 1600 ? wrappedSunX - 2200 : wrappedSunX;

      const orbGlow = ctx.createRadialGradient(orbX, sunY, 6 * scale, orbX, sunY, 95 * scale);
      if (timePhase < 0.5) {
        orbGlow.addColorStop(0, "rgba(255, 250, 238, 0.85)");
        orbGlow.addColorStop(0.35, "rgba(255, 234, 224, 0.35)");
        orbGlow.addColorStop(1, "rgba(255, 234, 224, 0)");
      } else {
        orbGlow.addColorStop(0, "rgba(248, 242, 246, 0.92)");
        orbGlow.addColorStop(0.32, "rgba(218, 206, 236, 0.28)");
        orbGlow.addColorStop(1, "rgba(218, 206, 236, 0)");
      }
      ctx.fillStyle = orbGlow;
      ctx.beginPath();
      ctx.arc(orbX, sunY, 95 * scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = timePhase < 0.5 ? "rgba(255, 251, 244, 0.92)" : "rgba(250, 245, 248, 0.95)";
      ctx.beginPath();
      ctx.arc(orbX, sunY, (timePhase < 0.5 ? 24 : 20) * scale, 0, Math.PI * 2);
      ctx.fill();

      // 4) Fluffy Pastel Clouds
      const clCol = lerpRGB(ENV_COLORS.cloud.day, ENV_COLORS.cloud.night, timePhase);
      const clShade = lerpRGB(ENV_COLORS.cloudShade.day, ENV_COLORS.cloudShade.night, timePhase);
      for (const c of this.clouds) {
        const sx = cx + (((c.x - camX * 0.14) % 2800 + 4200) % 2800 - 1400) * scale;
        const sy = cy + (c.y - camY * 0.18) * scale;
        if (sx < -220 * scale || sx > W + 220 * scale) continue;

        ctx.fillStyle = rgbStr(clShade, 0.55);
        ctx.beginPath();
        ctx.ellipse(sx, sy + 7 * scale, c.w * 0.48 * scale, c.h * 0.42 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = rgbStr(clCol, 0.78);
        for (let p = 0; p < c.puffs; p++) {
          const frac = (p / (c.puffs - 1) - 0.5) * 0.75;
          ctx.beginPath();
          ctx.arc(
            sx + frac * c.w * scale,
            sy - Math.cos(frac * Math.PI) * c.h * 0.25 * scale,
            c.h * (0.62 - Math.abs(frac) * 0.22) * scale,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }

      // 5) Distant Mountain Range (Layer 0)
      const mtnCol = lerpRGB(ENV_COLORS.mtnFar.day, ENV_COLORS.mtnFar.night, timePhase);
      ctx.fillStyle = rgbStr(mtnCol, 0.85);
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let px = -40; px <= W + 40; px += 28) {
        const wx = (px - cx) / scale + camX * 0.22;
        const peakY =
          -42 +
          Math.sin(wx * 0.0022) * 34 +
          Math.cos(wx * 0.0051) * 18 +
          Math.sin(wx * 0.009) * 8;
        const sy = cy + (peakY - camY * 0.26) * scale;
        ctx.lineTo(px, sy);
      }
      ctx.lineTo(W + 40, H);
      ctx.closePath();
      ctx.fill();

      // 6) Distant Cranes
      if (isSharpScope) {
        ctx.strokeStyle = timePhase > 0.5 ? "rgba(218, 206, 224, 0.45)" : "rgba(88, 78, 92, 0.45)";
        ctx.lineWidth = Math.max(1, 1.3 * scale);
        for (const b of this.birds) {
          const bx = cx + (((b.x - camX * 0.22) % 2200 + 3300) % 2200 - 1100) * scale;
          const by = cy + (b.y - camY * 0.25) * scale;
          const flap = Math.sin(b.flapPhase) * 4 * b.scale * scale;
          const wing = 8 * b.scale * scale;
          ctx.beginPath();
          ctx.moveTo(bx - wing, by - flap);
          ctx.quadraticCurveTo(bx - wing * 0.45, by - 4 * b.scale * scale, bx, by);
          ctx.quadraticCurveTo(bx + wing * 0.45, by - 4 * b.scale * scale, bx + wing, by - flap);
          ctx.stroke();
        }
      }

      // 7) Render Interactive Parallax Terrain Layers (1 -> 4)
      for (const layer of LAYERS) {
        this._renderLayer(ctx, W, H, cx, cy, camX, camY, scale, layer, timePhase, time, windLevel, isSharpScope);
      }

      // 8) Foreground Drifting Cherry Blossom Petals
      const petalCol = timePhase > 0.5 ? "rgba(210, 178, 204, 0.72)" : "rgba(255, 224, 234, 0.85)";
      for (const p of this.petals) {
        const px = cx + (p.ox * scale);
        const py = cy + (p.oy * scale);
        if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(p.rot);
        ctx.fillStyle = petalCol;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * scale, p.size * 0.58 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 9) Nighttime Fireflies
      if (timePhase > 0.35) {
        const ffVis = Math.min(1, (timePhase - 0.35) / 0.5);
        for (const f of this.fireflies) {
          const fx = cx + (((f.ox - camX * 0.85) % 1400 + 2100) % 1400 - 700) * scale;
          const fy = cy + (f.oy - camY * 0.85) * scale;
          const pulse = 0.25 + 0.75 * Math.max(0, Math.sin(f.phase * 2.1));
          const a = ffVis * pulse * 0.78;
          if (a < 0.05) continue;
          ctx.fillStyle = `rgba(255, 236, 152, ${a.toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(fx, fy, f.r * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    _renderLayer(ctx, W, H, cx, cy, camX, camY, scale, layer, timePhase, time, windLevel, isSharpScope) {
      const map = this.layerMaps.get(layer.id);
      const lx = camX * layer.parallax;
      const ly = camY * layer.vParallax;

      // Hill fill
      const hillC = lerpRGB(ENV_COLORS.hills[layer.id].day, ENV_COLORS.hills[layer.id].night, timePhase);
      ctx.fillStyle = rgbStr(hillC);
      ctx.beginPath();
      ctx.moveTo(-20, H + 40);
      const step = isSharpScope ? 14 : 36;
      for (let px = -20; px <= W + 40; px += step) {
        const wx = (px - cx) / scale + lx;
        const wy = this._hillHeightAt(layer, wx);
        const sy = cy + (wy - ly) * scale;
        ctx.lineTo(px, sy);
      }
      ctx.lineTo(W + 40, H + 40);
      ctx.closePath();
      ctx.fill();

      // Subtle misty rim along hilltop for atmospheric depth
      if (layer.id <= 2) {
        ctx.strokeStyle = timePhase > 0.5 ? "rgba(182, 174, 210, 0.14)" : "rgba(255, 245, 248, 0.35)";
        ctx.lineWidth = Math.max(1, 2 * scale);
        ctx.stroke();
      }

      // Draw visible chunks in this layer
      const visibleWorldHalf = W / (2 * scale) + 120;
      const chunks = [];
      for (const chunk of map.values()) {
        if (chunk.x1 < lx - visibleWorldHalf || chunk.x0 > lx + visibleWorldHalf) continue;
        chunks.push(chunk);
      }
      chunks.sort((a, b) => a.idx - b.idx);

      for (const chunk of chunks) {
        // Wildflowers along slope
        if (isSharpScope) {
          for (const fl of chunk.flowerPatches) {
            const fx = cx + (fl.x - lx) * scale;
            const fy = cy + (fl.y - ly) * scale;
            const fCol = timePhase > 0.5 ? lerpRGB(fl.col, [120, 118, 146], 0.65) : fl.col;
            ctx.fillStyle = rgbStr(fCol, 0.9);
            ctx.beginPath();
            ctx.arc(fx, fy, fl.r * scale, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Props (with Z-ordered monster peeking!)
        for (const p of chunk.props) {
          const px = cx + (p.x - lx) * scale;
          const py = cy + (p.y - ly) * scale;
          this._drawProp(ctx, p, px, py, lx, ly, cx, cy, scale, layer.scale, timePhase, time, windLevel, isSharpScope);
        }

        // Grass clumps (with grass_oni / ridge_phantom tucked behind foreground grass!)
        for (const g of chunk.grassClumps) {
          const gx = cx + (g.x - lx) * scale;
          const gy = cy + (g.y - ly) * scale;
          if (isSharpScope && g.monster) {
            const m = g.monster;
            window.SakuraMonsters.drawMonster(
              ctx,
              m,
              cx + (m.worldX - lx) * scale,
              cy + (m.worldY - ly) * scale,
              scale,
              timePhase,
              time
            );
          }
          this._drawGrassClump(ctx, g, gx, gy, scale, layer.scale, hillC, timePhase, time, windLevel);
        }
      }

      // Splat burst particles on this layer
      if (isSharpScope) {
        for (const b of this.bursts) {
          if (b.layerId !== layer.id) continue;
          for (const pt of b.particles) {
            if (pt.alpha <= 0.02) continue;
            const bx = cx + (pt.x - lx) * scale;
            const by = cy + (pt.y - ly) * scale;
            ctx.save();
            ctx.globalAlpha = Math.max(0, pt.alpha);
            if (pt.kind === "ring") {
              ctx.strokeStyle = pt.color;
              ctx.lineWidth = Math.max(1.2, 2.5 * layer.scale * scale);
              ctx.beginPath();
              ctx.arc(bx, by, pt.r * scale, 0, Math.PI * 2);
              ctx.stroke();
            } else if (pt.kind === "petal") {
              ctx.translate(bx, by);
              ctx.rotate(pt.rot);
              ctx.fillStyle = pt.color;
              ctx.beginPath();
              ctx.ellipse(0, 0, pt.r * 1.2 * scale, pt.r * 0.65 * scale, 0, 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.fillStyle = pt.color;
              ctx.beginPath();
              ctx.arc(bx, by, pt.r * scale, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }
        }

        // Brief miss impact puff
        for (const imp of this.impactMarks) {
          if (imp.layerId !== layer.id) continue;
          const ix = cx + (imp.x - lx) * scale;
          const iy = cy + (imp.y - ly) * scale;
          ctx.save();
          ctx.globalAlpha = imp.alpha * 0.75;
          ctx.fillStyle = imp.color;
          ctx.beginPath();
          ctx.arc(ix, iy, (1 - imp.alpha) * 14 * layer.scale * scale + 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    _drawProp(ctx, p, px, py, lx, ly, cx, cy, scale, layerScale, timePhase, time, windLevel, isSharpScope) {
      const sway = Math.sin(time * 1.4 + p.x * 0.02) * (1.2 + windLevel * 1.8) * layerScale * scale;

      const drawAttachedMonster = () => {
        if (!isSharpScope || !p.monster) return;
        const m = p.monster;
        window.SakuraMonsters.drawMonster(
          ctx,
          m,
          cx + (m.worldX - lx) * scale,
          cy + (m.worldY - ly) * scale,
          scale,
          timePhase,
          time
        );
      };

      const drawSplats = () => {
        if (!p.splats.length) return;
        ctx.fillStyle = timePhase > 0.5 ? "rgba(110, 42, 78, 0.72)" : "rgba(148, 38, 76, 0.68)";
        for (const sp of p.splats) {
          ctx.beginPath();
          ctx.arc(px + sp.dx * scale, py + sp.dy * scale, sp.r * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      if (p.type === "sakura") {
        // Trunk & canopy peek ordering:
        // bark_lurker peeks from BEHIND the trunk; blossom_mimic hides INSIDE the blossoms!
        if (p.monster && p.monster.hideMode === "trunk") {
          drawAttachedMonster();
        }

        const trunkCol = lerpRGB(ENV_COLORS.trunk.day, ENV_COLORS.trunk.night, timePhase);
        const trunkHi = lerpRGB(ENV_COLORS.trunkHi.day, ENV_COLORS.trunkHi.night, timePhase);
        const tw = p.trunkW * scale;
        const th = p.height * scale;
        const lean = p.lean * scale;

        // Main trunk
        ctx.fillStyle = rgbStr(trunkCol);
        ctx.beginPath();
        ctx.moveTo(px - tw * 0.62, py);
        ctx.quadraticCurveTo(px - tw * 0.25 + lean * 0.25, py - th * 0.5, px + lean - tw * 0.24, py - th * 0.92);
        ctx.lineTo(px + lean + tw * 0.24, py - th * 0.92);
        ctx.quadraticCurveTo(px + tw * 0.32 + lean * 0.25, py - th * 0.5, px + tw * 0.62, py);
        ctx.closePath();
        ctx.fill();

        // Soft highlight edge
        ctx.strokeStyle = rgbStr(trunkHi, 0.55);
        ctx.lineWidth = Math.max(1, tw * 0.14);
        ctx.beginPath();
        ctx.moveTo(px - tw * 0.35, py - 2 * scale);
        ctx.quadraticCurveTo(px - tw * 0.1 + lean * 0.25, py - th * 0.5, px + lean - tw * 0.12, py - th * 0.85);
        ctx.stroke();

        // Sakura Canopy puffs
        const sA = lerpRGB(ENV_COLORS.sakuraA.day, ENV_COLORS.sakuraA.night, timePhase);
        const sB = lerpRGB(ENV_COLORS.sakuraB.day, ENV_COLORS.sakuraB.night, timePhase);
        const sL = lerpRGB(ENV_COLORS.sakuraLight.day, ENV_COLORS.sakuraLight.night, timePhase);

        p.puffs.forEach((pf, idx) => {
          const c = pf.tone === 0 ? sA : pf.tone === 1 ? sB : sL;
          ctx.fillStyle = rgbStr(c, 0.94);
          ctx.beginPath();
          ctx.arc(px + pf.dx * scale + sway * (0.6 + idx * 0.08), py + pf.dy * scale, pf.r * scale, 0, Math.PI * 2);
          ctx.fill();

          if (idx === Math.floor(p.puffs.length / 2) && p.monster && p.monster.hideMode === "canopy") {
            drawAttachedMonster();
          }
        });

        drawSplats();
      } else if (p.type === "lantern") {
        if (p.monster) drawAttachedMonster();

        const st = lerpRGB(ENV_COLORS.stone.day, ENV_COLORS.stone.night, timePhase);
        const stS = lerpRGB(ENV_COLORS.stoneShade.day, ENV_COLORS.stoneShade.night, timePhase);
        const sz = p.size * scale;

        // Base & post
        ctx.fillStyle = rgbStr(stS);
        ctx.fillRect(px - sz * 0.34, py - sz * 0.18, sz * 0.68, sz * 0.18);
        ctx.fillStyle = rgbStr(st);
        ctx.fillRect(px - sz * 0.14, py - sz * 0.66, sz * 0.28, sz * 0.48);

        // Firebox
        ctx.fillRect(px - sz * 0.26, py - sz * 0.95, sz * 0.52, sz * 0.3);

        // Warm lantern glow window (brighter at night)
        const glowAlpha = 0.25 + timePhase * 0.72;
        if (timePhase > 0.2) {
          const lg = ctx.createRadialGradient(px, py - sz * 0.8, 1, px, py - sz * 0.8, sz * 1.15);
          lg.addColorStop(0, `rgba(255, 224, 150, ${(timePhase * 0.36).toFixed(2)})`);
          lg.addColorStop(1, "rgba(255, 224, 150, 0)");
          ctx.fillStyle = lg;
          ctx.beginPath();
          ctx.arc(px, py - sz * 0.8, sz * 1.15, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(255, 222, 148, ${glowAlpha.toFixed(2)})`;
        ctx.fillRect(px - sz * 0.11, py - sz * 0.89, sz * 0.22, sz * 0.18);

        // Curved roof
        ctx.fillStyle = rgbStr(stS);
        ctx.beginPath();
        ctx.moveTo(px - sz * 0.46, py - sz * 0.94);
        ctx.quadraticCurveTo(px, py - sz * 1.24, px + sz * 0.46, py - sz * 0.94);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, py - sz * 1.12, sz * 0.08, 0, Math.PI * 2);
        ctx.fill();

        drawSplats();
      } else if (p.type === "boulder") {
        if (p.monster) drawAttachedMonster();
        const st = lerpRGB(ENV_COLORS.stone.day, ENV_COLORS.stone.night, timePhase);
        const stS = lerpRGB(ENV_COLORS.stoneShade.day, ENV_COLORS.stoneShade.night, timePhase);
        const sz = p.size * scale;

        ctx.fillStyle = rgbStr(st);
        ctx.beginPath();
        ctx.ellipse(px, py - sz * 0.32, sz * 0.62, sz * 0.45, -0.08, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = rgbStr(stS, 0.55);
        ctx.beginPath();
        ctx.ellipse(px + sz * 0.14, py - sz * 0.24, sz * 0.4, sz * 0.28, 0.1, 0, Math.PI * 2);
        ctx.fill();

        drawSplats();
      } else if (p.type === "bamboo") {
        const b1 = lerpRGB(ENV_COLORS.bamboo.day, ENV_COLORS.bamboo.night, timePhase);
        const b2 = lerpRGB(ENV_COLORS.bambooDark.day, ENV_COLORS.bambooDark.night, timePhase);

        p.poles.forEach((pole, idx) => {
          if (idx === Math.floor(p.poles.length / 2) && p.monster) {
            drawAttachedMonster();
          }
          ctx.save();
          ctx.translate(px + pole.dx * scale, py);
          ctx.rotate(pole.tilt + sway * 0.003);
          const pw = pole.w * scale;
          const ph = pole.h * scale;
          ctx.fillStyle = rgbStr(pole.dark ? b2 : b1);
          ctx.fillRect(-pw * 0.5, -ph, pw, ph);

          // Bamboo joint rings
          ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
          for (let j = 1; j <= 4; j++) {
            ctx.fillRect(-pw * 0.6, -ph * (j / 5), pw * 1.2, Math.max(1, 1.3 * scale));
          }
          ctx.restore();
        });
        drawSplats();
      } else if (p.type === "torii") {
        if (p.monster) drawAttachedMonster();
        const tCol = lerpRGB(ENV_COLORS.torii.day, ENV_COLORS.torii.night, timePhase);
        const capCol = lerpRGB(ENV_COLORS.toriiCap.day, ENV_COLORS.toriiCap.night, timePhase);
        const w = p.w * scale;
        const h = p.h * scale;
        const pillarW = w * 0.11;

        ctx.fillStyle = rgbStr(tCol);
        ctx.fillRect(px - w * 0.36 - pillarW * 0.5, py - h, pillarW, h);
        ctx.fillRect(px + w * 0.36 - pillarW * 0.5, py - h, pillarW, h);
        ctx.fillRect(px - w * 0.44, py - h * 0.74, w * 0.88, pillarW * 0.8);
        ctx.fillRect(px - w * 0.54, py - h * 0.96, w * 1.08, pillarW * 0.95);

        // Dark top kasagi cap
        ctx.fillStyle = rgbStr(capCol);
        ctx.beginPath();
        ctx.moveTo(px - w * 0.6, py - h * 0.96);
        ctx.quadraticCurveTo(px, py - h * 0.89, px + w * 0.6, py - h * 0.96);
        ctx.lineTo(px + w * 0.58, py - h * 1.04);
        ctx.quadraticCurveTo(px, py - h * 0.97, px - w * 0.58, py - h * 1.04);
        ctx.closePath();
        ctx.fill();

        drawSplats();
      }
    }

    _drawGrassClump(ctx, g, gx, gy, scale, layerScale, hillRGB, timePhase, time, windLevel) {
      const bladeCol = [
        Math.max(10, hillRGB[0] - 16),
        Math.max(12, hillRGB[1] - 12),
        Math.max(12, hillRGB[2] - 10),
      ];
      const sway = Math.sin(time * 2.3 + g.x * 0.04) * (2.2 + windLevel * 3.8) * layerScale * scale;

      ctx.strokeStyle = rgbStr(bladeCol);
      ctx.lineWidth = Math.max(1, 1.9 * layerScale * scale);
      ctx.lineCap = "round";

      for (const b of g.blades) {
        ctx.beginPath();
        ctx.moveTo(gx + b.dx * scale, gy);
        ctx.quadraticCurveTo(
          gx + (b.dx + b.bend * 0.4) * scale + sway * 0.45,
          gy - b.h * 0.55 * scale,
          gx + (b.dx + b.bend) * scale + sway,
          gy - b.h * scale
        );
        ctx.stroke();
      }

      if (g.splats.length) {
        ctx.fillStyle = timePhase > 0.5 ? "rgba(110, 42, 78, 0.72)" : "rgba(148, 38, 76, 0.68)";
        for (const sp of g.splats) {
          ctx.beginPath();
          ctx.arc(gx + sp.dx * scale, gy + sp.dy * scale, sp.r * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  window.SakuraWorld = {
    WorldState,
    LAYERS,
  };
})();
