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

  function shiftRGB(c, d) {
    return [
      Math.max(12, Math.min(250, c[0] + d)),
      Math.max(12, Math.min(250, c[1] + d * 0.8)),
      Math.max(12, Math.min(250, c[2] + d * 0.6)),
    ];
  }

  function rgbStr(c, alpha) {
    if (alpha === undefined) return `rgb(${c[0]},${c[1]},${c[2]})`;
    return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
  }

  const LAYERS = [
    { id: 1, parallax: 0.42, vParallax: 0.72, scale: 0.44, nominalDist: 315, distJitter: 18, baseY: 5, hillAmp: 26, chunkW: 360 },
    { id: 2, parallax: 0.62, vParallax: 0.82, scale: 0.64, nominalDist: 210, distJitter: 12, baseY: 62, hillAmp: 28, chunkW: 410 },
    { id: 3, parallax: 0.82, vParallax: 0.91, scale: 0.85, nominalDist: 130, distJitter: 10, baseY: 122, hillAmp: 30, chunkW: 460 },
    { id: 4, parallax: 1.0, vParallax: 1.0, scale: 1.12, nominalDist: 65, distJitter: 6, baseY: 190, hillAmp: 30, chunkW: 520 },
  ];

  // Five distinct calming pastel settings cycling infinitely
  const BIOME_ORDER = ["sakura", "autumn", "village", "city", "pine_mist"];

  const BIOMES = {
    sakura: {
      label: "SAKURA",
      skyTop: { day: [198, 226, 245], night: [42, 47, 78] },
      skyMid: { day: [232, 238, 246], night: [66, 68, 104] },
      skyHor: { day: [253, 234, 240], night: [106, 97, 134] },
      mtn: { day: [182, 198, 220], night: [54, 62, 92] },
      hills: {
        1: { day: [167, 191, 189], night: [57, 68, 92] },
        2: { day: [154, 194, 162], night: [50, 74, 82] },
        3: { day: [134, 179, 140], night: [44, 69, 73] },
        4: { day: [120, 166, 128], night: [38, 61, 64] },
      },
      petal: { day: [255, 222, 234], night: [210, 178, 204] },
      monsterTint: { day: [158, 154, 152], night: [72, 68, 88] },
    },
    autumn: {
      label: "AUTUMN",
      skyTop: { day: [208, 226, 242], night: [48, 44, 74] },
      skyMid: { day: [242, 232, 226], night: [76, 64, 96] },
      skyHor: { day: [252, 226, 206], night: [118, 92, 118] },
      mtn: { day: [196, 188, 206], night: [62, 56, 86] },
      hills: {
        1: { day: [192, 184, 170], night: [68, 60, 82] },
        2: { day: [188, 176, 142], night: [64, 60, 72] },
        3: { day: [178, 166, 128], night: [58, 56, 64] },
        4: { day: [166, 154, 118], night: [50, 50, 56] },
      },
      petal: { day: [242, 174, 146], night: [186, 134, 134] },
      monsterTint: { day: [168, 138, 118], night: [78, 64, 74] },
    },
    village: {
      label: "VILLAGE",
      skyTop: { day: [192, 224, 244], night: [38, 46, 76] },
      skyMid: { day: [228, 238, 242], night: [60, 68, 100] },
      skyHor: { day: [248, 236, 222], night: [98, 94, 126] },
      mtn: { day: [178, 196, 210], night: [50, 60, 86] },
      hills: {
        1: { day: [168, 190, 176], night: [52, 66, 84] },
        2: { day: [158, 186, 150], night: [48, 68, 74] },
        3: { day: [176, 184, 148], night: [52, 66, 68] },
        4: { day: [198, 188, 168], night: [56, 60, 68] },
      },
      petal: { day: [252, 244, 228], night: [204, 198, 212] },
      monsterTint: { day: [166, 156, 146], night: [70, 68, 84] },
    },
    city: {
      label: "CITY",
      skyTop: { day: [204, 220, 238], night: [36, 40, 68] },
      skyMid: { day: [230, 228, 240], night: [58, 58, 92] },
      skyHor: { day: [246, 226, 234], night: [98, 84, 118] },
      mtn: { day: [192, 192, 214], night: [52, 54, 82] },
      hills: {
        1: { day: [184, 184, 202], night: [56, 58, 84] },
        2: { day: [178, 176, 190], night: [52, 54, 76] },
        3: { day: [176, 172, 180], night: [48, 50, 68] },
        4: { day: [172, 168, 174], night: [44, 46, 62] },
      },
      petal: { day: [246, 236, 242], night: [198, 190, 218] },
      monsterTint: { day: [148, 146, 158], night: [62, 64, 82] },
    },
    pine_mist: {
      label: "PINE MIST",
      skyTop: { day: [196, 218, 236], night: [36, 44, 72] },
      skyMid: { day: [224, 234, 242], night: [54, 64, 96] },
      skyHor: { day: [238, 240, 246], night: [88, 94, 126] },
      mtn: { day: [174, 192, 210], night: [48, 58, 88] },
      hills: {
        1: { day: [162, 186, 194], night: [50, 66, 88] },
        2: { day: [148, 178, 180], night: [44, 66, 80] },
        3: { day: [138, 170, 168], night: [40, 62, 72] },
        4: { day: [132, 162, 158], night: [36, 56, 64] },
      },
      petal: { day: [240, 246, 250], night: [196, 210, 232] },
      monsterTint: { day: [134, 152, 156], night: [56, 68, 84] },
    },
  };

  const SHARED_COLORS = {
    cloud: { day: [255, 249, 251], night: [92, 91, 126] },
    cloudShade: { day: [234, 218, 229], night: [72, 72, 102] },
    trunk: { day: [124, 101, 94], night: [70, 61, 72] },
    trunkHi: { day: [148, 122, 114], night: [88, 78, 92] },
    sakuraA: { day: [250, 214, 224], night: [174, 144, 174] },
    sakuraB: { day: [244, 184, 202], night: [148, 121, 152] },
    sakuraLight: { day: [255, 240, 244], night: [204, 175, 202] },
    mapleA: { day: [242, 168, 152], night: [148, 98, 108] },
    mapleB: { day: [246, 198, 156], night: [162, 122, 112] },
    mapleC: { day: [226, 142, 142], night: [132, 86, 98] },
    ginkgo: { day: [246, 222, 146], night: [158, 142, 112] },
    pineA: { day: [108, 146, 138], night: [44, 68, 72] },
    pineB: { day: [126, 164, 154], night: [56, 82, 84] },
    torii: { day: [216, 136, 126], night: [128, 86, 98] },
    toriiCap: { day: [108, 96, 100], night: [64, 58, 72] },
    stone: { day: [190, 182, 174], night: [92, 92, 106] },
    stoneShade: { day: [158, 150, 144], night: [72, 72, 86] },
    bamboo: { day: [144, 188, 146], night: [62, 94, 86] },
    bambooDark: { day: [118, 162, 122], night: [48, 76, 72] },
    plaster: { day: [244, 236, 226], night: [108, 102, 118] },
    roofTile: { day: [134, 146, 164], night: [58, 64, 88] },
    woodWall: { day: [164, 134, 114], night: [76, 64, 72] },
    asphalt: { day: [162, 160, 168], night: [46, 48, 62] },
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

      this.biomeIdx = 0;
      this.biomeClock = 0;
      this.curPalette = null;
      this.reset();
    }

    getBiomeKey() {
      return BIOME_ORDER[this.biomeIdx % BIOME_ORDER.length];
    }

    getBiomeLabel() {
      return BIOMES[this.getBiomeKey()].label;
    }

    _clonePalette(key) {
      const b = BIOMES[key];
      const copyPair = (p) => ({ day: [...p.day], night: [...p.night] });
      return {
        skyTop: copyPair(b.skyTop),
        skyMid: copyPair(b.skyMid),
        skyHor: copyPair(b.skyHor),
        mtn: copyPair(b.mtn),
        petal: copyPair(b.petal),
        hills: {
          1: copyPair(b.hills[1]),
          2: copyPair(b.hills[2]),
          3: copyPair(b.hills[3]),
          4: copyPair(b.hills[4]),
        },
      };
    }

    _blendPaletteToward(targetKey, rate) {
      const t = BIOMES[targetKey];
      const stepPair = (cur, tgt) => {
        for (let i = 0; i < 3; i++) {
          cur.day[i] = lerp(cur.day[i], tgt.day[i], rate);
          cur.night[i] = lerp(cur.night[i], tgt.night[i], rate);
        }
      };
      stepPair(this.curPalette.skyTop, t.skyTop);
      stepPair(this.curPalette.skyMid, t.skyMid);
      stepPair(this.curPalette.skyHor, t.skyHor);
      stepPair(this.curPalette.mtn, t.mtn);
      stepPair(this.curPalette.petal, t.petal);
      for (let id = 1; id <= 4; id++) {
        stepPair(this.curPalette.hills[id], t.hills[id]);
      }
    }

    reset() {
      LAYERS.forEach((l) => this.layerMaps.get(l.id).clear());
      this.generationNonce = 1;
      this.bursts = [];
      this.impactMarks = [];
      this.killCount = 0;
      this.lastCamX = 0;
      this.biomeIdx = 0;
      this.biomeClock = 0;
      this.curPalette = this._clonePalette("sakura");

      this.petals = [];
      for (let i = 0; i < 65; i++) this.petals.push(this._makePetal(true));

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

      this.stars = [];
      for (let i = 0; i < 60; i++) {
        this.stars.push({
          x: (Math.random() - 0.5) * 2200,
          y: -420 + Math.random() * 290,
          r: 0.7 + Math.random() * 1.3,
          twinkle: Math.random() * Math.PI * 2,
        });
      }

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

      // Slight random drift into current biome (mostly pure active biome, occasional neighbor bleed)
      let biome = this.getBiomeKey();
      if (!isStarterPass && Math.random() < 0.14) {
        biome = BIOME_ORDER[(this.biomeIdx + 1) % BIOME_ORDER.length];
      }

      const props = [];
      const flowerPatches = [];
      const grassClumps = [];
      const skylineBlocks = [];

      // Distant city skyline silhouettes on Layers 1 & 2 when in city biome
      if (biome === "city" && layer.id <= 2) {
        const bCount = 5 + Math.floor(Math.random() * 3);
        const stepW = layer.chunkW / bCount;
        const pastelBld = [
          [198, 196, 214],
          [212, 198, 208],
          [188, 202, 212],
          [208, 206, 198],
        ];
        for (let i = 0; i < bCount; i++) {
          const bx = x0 + i * stepW + 4;
          const bw = stepW * (0.72 + Math.random() * 0.25);
          const bh = (38 + Math.random() * 58) * s;
          const by = this._hillHeightAt(layer, bx + bw * 0.5) + 8 * s;
          skylineBlocks.push({
            x: bx,
            y: by,
            w: bw,
            h: bh,
            col: pastelBld[i % pastelBld.length],
            litSeed: Math.random() * 100,
          });
        }
      }

      if (biome === "sakura") {
        this._populateSakuraProps(layer, x0, s, props, flowerPatches, grassClumps);
      } else if (biome === "autumn") {
        this._populateAutumnProps(layer, x0, s, props, flowerPatches, grassClumps);
      } else if (biome === "village") {
        this._populateVillageProps(layer, x0, s, props, flowerPatches, grassClumps);
      } else if (biome === "city") {
        this._populateCityProps(layer, x0, s, props, grassClumps);
      } else {
        this._populatePineMistProps(layer, x0, s, props, flowerPatches, grassClumps);
      }

      // Monster Spawning
      let monster = null;
      const shouldConsiderSpawn =
        !isStarterPass || (Math.abs(chunkIdx) === 1 && (layer.id === 3 || layer.id === 4));

      if (shouldConsiderSpawn) {
        const nearby = this._countNearbyMonsters(this.lastCamX, 650);
        let layerWeight = 0.28;
        if (this.killCount < 2) {
          layerWeight = layer.id >= 3 ? 0.52 : layer.id === 2 ? 0.14 : 0.05;
        } else if (this.killCount < 5) {
          layerWeight = layer.id >= 2 ? 0.4 : 0.25;
        } else {
          layerWeight = layer.id <= 2 ? 0.44 : 0.34;
        }

        const forceNeeded = nearby === 0 && Math.random() < 0.7;
        const starterTrigger = isStarterPass && chunkIdx === 1 && layer.id === 3 && nearby === 0;

        if (starterTrigger || (!isStarterPass && (forceNeeded || (nearby < 2 && Math.random() < layerWeight)))) {
          monster = this._attachMonsterToChunk(layer, chunkDist, biome, props, grassClumps);
        }
      }

      return {
        idx: chunkIdx,
        nonce,
        biome,
        hueShift: (Math.random() - 0.5) * 14,
        x0,
        x1: x0 + layer.chunkW,
        dist: chunkDist,
        props,
        grassClumps,
        flowerPatches,
        skylineBlocks,
        monster,
      };
    }

    _addTree(layer, px, s, style, props) {
      const py = this._hillHeightAt(layer, px) + 4 * s;
      const height = (68 + Math.random() * 34) * s;
      const trunkW = (11 + Math.random() * 5) * s;
      const lean = (Math.random() - 0.5) * 16 * s;
      const puffs = [];
      const puffCount = style === "pine" ? 4 : 5 + Math.floor(Math.random() * 3);
      for (let p = 0; p < puffCount; p++) {
        const ang = (p / puffCount) * Math.PI * 1.4 - Math.PI * 0.7;
        puffs.push({
          dx: lean + Math.sin(ang) * (20 + Math.random() * 20) * s,
          dy: -height + Math.cos(ang) * 12 * s - Math.random() * 14 * s,
          r: (style === "pine" ? 16 + Math.random() * 11 : 18 + Math.random() * 14) * s,
          tone: p % 3,
        });
      }
      props.push({ type: "tree", style, x: px, y: py, height, trunkW, lean, puffs, splats: [], monster: null });
    }

    _addMeadowGrass(layer, x0, s, grassClumps, flowerPatches, isPampas) {
      const clumpCount = 5 + Math.floor(Math.random() * 4);
      for (let g = 0; g < clumpCount; g++) {
        const gx = x0 + 25 + Math.random() * (layer.chunkW - 50);
        const gy = this._hillHeightAt(layer, gx) + (2 + Math.random() * 10) * s;
        const blades = [];
        for (let b = 0; b < 6; b++) {
          blades.push({
            dx: (b - 2.5) * 4.2 * s,
            h: ((isPampas ? 16 : 12) + Math.random() * 10) * s,
            bend: (Math.random() - 0.5) * 6 * s,
            plume: isPampas && b % 2 === 0,
          });
        }
        grassClumps.push({ x: gx, y: gy, blades, splats: [], monster: null });
      }
      if (flowerPatches) {
        const flowerColors = isPampas
          ? [[246, 224, 186], [240, 178, 152], [238, 206, 168]]
          : [[252, 240, 200], [249, 198, 214], [204, 218, 248], [232, 206, 244]];
        for (let f = 0; f < 14; f++) {
          const fx = x0 + Math.random() * layer.chunkW;
          const fy = this._hillHeightAt(layer, fx) + (4 + Math.random() * 24) * s;
          flowerPatches.push({
            x: fx,
            y: fy,
            r: (1.8 + Math.random() * 2.2) * s,
            col: flowerColors[f % flowerColors.length],
          });
        }
      }
    }

    _populateSakuraProps(layer, x0, s, props, flowerPatches, grassClumps) {
      const roll = Math.random();
      const hasBamboo = roll < 0.28;
      const treeCount = hasBamboo ? 1 : 1 + Math.floor(Math.random() * 2.2);
      for (let i = 0; i < treeCount; i++) {
        const px = x0 + 55 + ((i + 0.35 + Math.random() * 0.45) / treeCount) * (layer.chunkW - 110);
        this._addTree(layer, px, s, "sakura", props);
      }
      if (hasBamboo) this._addBamboo(layer, x0, s, props);
      if (roll >= 0.28 && roll < 0.5 && layer.id <= 3) this._addTorii(layer, x0, s, props);
      if (Math.random() < 0.72) this._addStoneProp(layer, x0, s, props, 0.6);
      this._addMeadowGrass(layer, x0, s, grassClumps, flowerPatches, false);
    }

    _populateAutumnProps(layer, x0, s, props, flowerPatches, grassClumps) {
      const treeCount = 1 + Math.floor(Math.random() * 2.3);
      for (let i = 0; i < treeCount; i++) {
        const px = x0 + 50 + ((i + 0.3 + Math.random() * 0.5) / treeCount) * (layer.chunkW - 100);
        const style = Math.random() < 0.38 ? "ginkgo" : "maple";
        this._addTree(layer, px, s, style, props);
      }
      if (Math.random() < 0.3 && layer.id <= 3) this._addTorii(layer, x0, s, props);
      if (Math.random() < 0.75) this._addStoneProp(layer, x0, s, props, 0.55);
      this._addMeadowGrass(layer, x0, s, grassClumps, flowerPatches, true);
    }

    _populateVillageProps(layer, x0, s, props, flowerPatches, grassClumps) {
      // Countryside houses, utility poles, kei-cars, hedges & trees
      const houseCount = layer.id >= 2 ? (Math.random() < 0.78 ? 1 : 2) : 1;
      for (let i = 0; i < houseCount; i++) {
        const hx = x0 + 70 + ((i + 0.25 + Math.random() * 0.45) / houseCount) * (layer.chunkW - 140);
        const hy = this._hillHeightAt(layer, hx) + 5 * s;
        props.push({
          type: "house",
          x: hx,
          y: hy,
          w: (66 + Math.random() * 22) * s,
          h: (46 + Math.random() * 14) * s,
          roofTone: Math.random() < 0.5 ? 0 : 1,
          splats: [],
          monster: null,
        });
      }

      if (Math.random() < 0.72) {
        const px = x0 + 40 + Math.random() * (layer.chunkW - 80);
        const py = this._hillHeightAt(layer, px) + 4 * s;
        props.push({ type: "pole", x: px, y: py, h: (88 + Math.random() * 18) * s, w: 5.5 * s, splats: [], monster: null });
      }

      if (Math.random() < 0.55 && layer.id >= 3) {
        const cx = x0 + 60 + Math.random() * (layer.chunkW - 120);
        const cy = this._hillHeightAt(layer, cx) + 5 * s;
        const carColors = [[206, 226, 214], [244, 232, 206], [214, 224, 240]];
        props.push({
          type: "car",
          x: cx,
          y: cy,
          w: 54 * s,
          h: 24 * s,
          isTruck: true,
          col: carColors[Math.floor(Math.random() * carColors.length)],
          dir: Math.random() < 0.5 ? -1 : 1,
          splats: [],
          monster: null,
        });
      }

      if (Math.random() < 0.65) {
        const tx = x0 + 35 + Math.random() * (layer.chunkW - 70);
        this._addTree(layer, tx, s, Math.random() < 0.5 ? "sakura" : "maple", props);
      }

      this._addMeadowGrass(layer, x0, s, grassClumps, flowerPatches, false);
    }

    _populateCityProps(layer, x0, s, props, grassClumps) {
      const buildingPal = [
        [232, 222, 226],
        [218, 228, 236],
        [238, 232, 220],
        [222, 232, 224],
        [228, 220, 236],
      ];

      // Alleyway building pair (narrow shadowed gap in the middle!)
      if (Math.random() < 0.85) {
        const ax = x0 + 85 + Math.random() * (layer.chunkW - 170);
        const ay = this._hillHeightAt(layer, ax) + 6 * s;
        props.push({
          type: "alley",
          x: ax,
          y: ay,
          gapW: (28 + Math.random() * 10) * s,
          wL: (44 + Math.random() * 20) * s,
          hL: (82 + Math.random() * 34) * s,
          wR: (44 + Math.random() * 20) * s,
          hR: (76 + Math.random() * 36) * s,
          colL: buildingPal[Math.floor(Math.random() * buildingPal.length)],
          colR: buildingPal[Math.floor(Math.random() * buildingPal.length)],
          splats: [],
          monster: null,
        });
      }

      // Parked pastel cars
      if (Math.random() < 0.78 && layer.id >= 2) {
        const cx = x0 + 50 + Math.random() * (layer.chunkW - 100);
        const cy = this._hillHeightAt(layer, cx) + 5 * s;
        const carColors = [
          [198, 218, 238],
          [242, 212, 218],
          [206, 230, 218],
          [246, 234, 202],
          [224, 216, 236],
        ];
        props.push({
          type: "car",
          x: cx,
          y: cy,
          w: (58 + Math.random() * 10) * s,
          h: 22 * s,
          isTruck: false,
          col: carColors[Math.floor(Math.random() * carColors.length)],
          dir: Math.random() < 0.5 ? -1 : 1,
          splats: [],
          monster: null,
        });
      }

      // Trash cans + crates OR glowing vending machine
      if (Math.random() < 0.82) {
        const ux = x0 + 40 + Math.random() * (layer.chunkW - 80);
        const uy = this._hillHeightAt(layer, ux) + 5 * s;
        if (Math.random() < 0.58) {
          props.push({ type: "trashcan", x: ux, y: uy, size: 22 * s, splats: [], monster: null });
        } else {
          const vmCols = [[244, 236, 238], [210, 230, 232], [244, 224, 214]];
          props.push({
            type: "vending",
            x: ux,
            y: uy,
            w: 28 * s,
            h: 50 * s,
            col: vmCols[Math.floor(Math.random() * vmCols.length)],
            splats: [],
            monster: null,
          });
        }
      }

      // Streetlamp
      if (Math.random() < 0.65) {
        const lx = x0 + 30 + Math.random() * (layer.chunkW - 60);
        const ly = this._hillHeightAt(layer, lx) + 4 * s;
        props.push({ type: "streetlight", x: lx, y: ly, h: 74 * s, splats: [], monster: null });
      }
    }

    _populatePineMistProps(layer, x0, s, props, flowerPatches, grassClumps) {
      const treeCount = 1 + Math.floor(Math.random() * 2.2);
      for (let i = 0; i < treeCount; i++) {
        const px = x0 + 50 + ((i + 0.32 + Math.random() * 0.45) / treeCount) * (layer.chunkW - 100);
        this._addTree(layer, px, s, "pine", props);
      }
      if (Math.random() < 0.32 && layer.id <= 3) this._addTorii(layer, x0, s, props);
      if (Math.random() < 0.78) this._addStoneProp(layer, x0, s, props, 0.45);
      this._addMeadowGrass(layer, x0, s, grassClumps, flowerPatches, false);
    }

    _addBamboo(layer, x0, s, props) {
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
      props.push({ type: "bamboo", x: bx, y: by, poles, splats: [], monster: null });
    }

    _addTorii(layer, x0, s, props) {
      const tx = x0 + layer.chunkW * (0.3 + Math.random() * 0.4);
      const ty = this._hillHeightAt(layer, tx) + 3 * s;
      props.push({ type: "torii", x: tx, y: ty, w: 58 * s, h: 64 * s, splats: [], monster: null });
    }

    _addStoneProp(layer, x0, s, props, lanternRatio) {
      const lx = x0 + 60 + Math.random() * (layer.chunkW - 120);
      const ly = this._hillHeightAt(layer, lx) + 4 * s;
      props.push({
        type: Math.random() < lanternRatio ? "lantern" : "boulder",
        x: lx,
        y: ly,
        size: (26 + Math.random() * 8) * s,
        splats: [],
        monster: null,
      });
    }

    _attachMonsterToChunk(layer, chunkDist, biome, props, grassClumps) {
      const s = layer.scale;
      const peek = Math.random() < 0.5 ? -1 : 1;
      const candidates = [];

      props.forEach((p) => {
        if (p.type === "tree") {
          candidates.push({ prop: p, mode: "trunk" });
          candidates.push({ prop: p, mode: "canopy" });
        } else if (p.type === "lantern" || p.type === "boulder") {
          candidates.push({ prop: p, mode: "stone" });
        } else if (p.type === "bamboo") {
          candidates.push({ prop: p, mode: "bamboo" });
        } else if (p.type === "torii") {
          candidates.push({ prop: p, mode: "torii" });
        } else if (p.type === "alley") {
          candidates.push({ prop: p, mode: "alley" });
        } else if (p.type === "car") {
          candidates.push({ prop: p, mode: "car" });
        } else if (p.type === "trashcan") {
          candidates.push({ prop: p, mode: "trashcan" });
        } else if (p.type === "vending") {
          candidates.push({ prop: p, mode: "vending" });
        } else if (p.type === "house") {
          candidates.push({ prop: p, mode: "house" });
        } else if (p.type === "pole") {
          candidates.push({ prop: p, mode: "pole" });
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
      } else if (pick.mode === "alley") {
        // Peek from behind one wall corner cleanly into the bright alleyway gap
        species = "bark_lurker";
        mx = p.x + peek * (p.gapW * 0.38);
        my = p.y;
      } else if (pick.mode === "car") {
        // Crouch behind car hood/roof so head & eyes peek clearly above the car body
        species = "grass_oni";
        mx = p.x + peek * (p.w * 0.14);
        my = p.y - p.h * 0.65;
      } else if (pick.mode === "trashcan") {
        species = "lantern_shade";
        mx = p.x + peek * (p.size * 0.58);
        my = p.y;
      } else if (pick.mode === "vending") {
        species = "bark_lurker";
        mx = p.x + peek * (p.w * 0.46);
        my = p.y;
      } else if (pick.mode === "house") {
        species = "bark_lurker";
        mx = p.x + peek * (p.w * 0.47);
        my = p.y;
      } else if (pick.mode === "pole") {
        species = "bamboo_stalker";
        mx = p.x + peek * (p.w * 0.7);
        my = p.y;
      } else if (pick.mode === "grass") {
        species = layer.id === 1 ? "ridge_phantom" : "grass_oni";
        mx = p.x;
        my = p.y + 3 * s;
      }

      const bInfo = BIOMES[biome] || BIOMES.sakura;
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
        biomeTint: {
          day: bInfo.monsterTint.day,
          night: bInfo.monsterTint.night,
          dayAccent: bInfo.hills[layer.id].day,
          nightAccent: bInfo.hills[layer.id].night,
        },
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

        const evictHalf = viewHalf + layer.chunkW * 0.3;
        for (const [idx, chunk] of map.entries()) {
          const cx = (chunk.x0 + chunk.x1) * 0.5;
          if (Math.abs(cx - lx) > evictHalf) {
            map.delete(idx);
          }
        }

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

      // Cycle biome roughly every 28 seconds so settings evolve continually
      this.biomeClock += dt;
      if (this.biomeClock >= 28) {
        this.biomeClock -= 28;
        this.biomeIdx = (this.biomeIdx + 1) % BIOME_ORDER.length;
      }
      this._blendPaletteToward(this.getBiomeKey(), Math.min(1, dt * 0.35));

      this._ensureChunks(camX, halfSpanWorldW, false);

      for (const layer of LAYERS) {
        for (const chunk of this.layerMaps.get(layer.id).values()) {
          if (chunk.monster) window.SakuraMonsters.updateMonster(chunk.monster, dt);
        }
      }

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

      for (const f of this.fireflies) {
        f.phase += dt * f.speed;
        f.ox += Math.sin(f.phase * 0.9) * 10 * dt;
        f.oy += Math.cos(f.phase * 1.2) * 8 * dt;
      }

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

      for (let i = this.impactMarks.length - 1; i >= 0; i--) {
        this.impactMarks[i].alpha -= dt * 0.55;
        if (this.impactMarks[i].alpha <= 0) this.impactMarks.splice(i, 1);
      }
    }

    alertAllMonsters() {
      for (const layer of LAYERS) {
        for (const chunk of this.layerMaps.get(layer.id).values()) {
          if (chunk.monster && chunk.monster.alive) {
            chunk.monster.vanishing = true;
          }
        }
      }
    }

    evaluateShot(camX, camY, scopeScale, tickScale, dropCanonicalFn) {
      const worldPerScreen = 1 / scopeScale;

      for (let i = LAYERS.length - 1; i >= 0; i--) {
        const layer = LAYERS[i];
        const map = this.layerMaps.get(layer.id);
        const aimWorldX = camX * layer.parallax;

        for (const chunk of map.values()) {
          if (aimWorldX < chunk.x0 - 30 || aimWorldX > chunk.x1 + 30) continue;

          const dropPx = dropCanonicalFn(chunk.dist) * tickScale;
          const impactWorldY = camY * layer.vParallax + dropPx * worldPerScreen;

          const m = chunk.monster;
          if (m && m.alive && !m.vanishing) {
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
        if (p.type === "tree" && monster.hideMode === "trunk") {
          const trunkCenter = p.x + p.lean * 0.25;
          if (Math.abs(x - trunkCenter) < p.trunkW * 0.36 && y < p.y && y > p.y - p.height * 0.92) {
            return "wood";
          }
        } else if ((p.type === "lantern" || p.type === "boulder") && monster.hideMode === "stone") {
          if (Math.abs(x - p.x) < p.size * 0.38 && y < p.y && y > p.y - p.size * 1.15) return "stone";
        } else if (p.type === "car" && monster.hideMode === "car") {
          if (Math.abs(x - p.x) < p.w * 0.44 && y < p.y && y > p.y - p.h * 0.78) return "stone";
        } else if (p.type === "trashcan" && monster.hideMode === "trashcan") {
          if (Math.abs(x - p.x) < p.size * 0.5 && y < p.y && y > p.y - p.size * 0.85) return "stone";
        } else if (p.type === "vending" && monster.hideMode === "vending") {
          if (Math.abs(x - p.x) < p.w * 0.42 && y < p.y && y > p.y - p.h * 0.95) return "stone";
        } else if (p.type === "house" && monster.hideMode === "house") {
          if (Math.abs(x - p.x) < p.w * 0.43 && y < p.y && y > p.y - p.h * 0.95) return "wood";
        } else if (p.type === "alley" && monster.hideMode === "alley") {
          const halfG = p.gapW * 0.5;
          if (x >= p.x - halfG - p.wL && x <= p.x - halfG && y < p.y && y > p.y - p.hL) return "stone";
          if (x >= p.x + halfG && x <= p.x + halfG + p.wR && y < p.y && y > p.y - p.hR) return "stone";
        }
      }
      return null;
    }

    _checkAnySolidProp(chunk, x, y, s) {
      for (const p of chunk.props) {
        if (p.type === "tree") {
          const trunkCenter = p.x + p.lean * 0.25;
          if (Math.abs(x - trunkCenter) < p.trunkW * 0.42 && y < p.y && y > p.y - p.height * 0.92) return "wood";
        } else if (p.type === "lantern" || p.type === "boulder") {
          if (Math.abs(x - p.x) < p.size * 0.45 && y < p.y && y > p.y - p.size * 1.15) return "stone";
        } else if (p.type === "torii") {
          const halfW = p.w * 0.36;
          if ((Math.abs(x - (p.x - halfW)) < 4 * s || Math.abs(x - (p.x + halfW)) < 4 * s) && y < p.y && y > p.y - p.h) {
            return "wood";
          }
        } else if (p.type === "car") {
          if (Math.abs(x - p.x) < p.w * 0.46 && y < p.y && y > p.y - p.h * 0.85) return "stone";
        } else if (p.type === "trashcan") {
          if (Math.abs(x - p.x) < p.size * 0.55 && y < p.y && y > p.y - p.size * 0.92) return "stone";
        } else if (p.type === "vending") {
          if (Math.abs(x - p.x) < p.w * 0.46 && y < p.y && y > p.y - p.h) return "stone";
        } else if (p.type === "house") {
          if (Math.abs(x - p.x) < p.w * 0.46 && y < p.y && y > p.y - p.h) return "wood";
        } else if (p.type === "alley") {
          const halfG = p.gapW * 0.5;
          if (x >= p.x - halfG - p.wL && x <= p.x - halfG && y < p.y && y > p.y - p.hL) return "stone";
          if (x >= p.x + halfG && x <= p.x + halfG + p.wR && y < p.y && y > p.y - p.hR) return "stone";
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

    getRangeReading(camX, camY, scopeScale, tickScale, dropCanonicalFn) {
      const centerRes = this._sampleEnvDistanceAt(camX, camY, 0, scopeScale);
      if (centerRes !== null) {
        this.lastRangeReadout = centerRes;
        return `${centerRes}m`;
      }

      for (const testDist of [130, 210, 315]) {
        const dropPx = dropCanonicalFn(testDist) * tickScale;
        const baseOff = dropPx / scopeScale;
        const tickRes =
          this._sampleEnvDistanceAt(camX, camY, baseOff, scopeScale) ??
          this._sampleEnvDistanceAt(camX, camY, baseOff + 22, scopeScale);
        if (tickRes !== null && Math.abs(tickRes - testDist) < 48) {
          this.lastRangeReadout = tickRes;
          return `${tickRes}m`;
        }
      }

      return "---";
    }

    _sampleEnvDistanceAt(camX, camY, worldOffsetY) {
      for (let i = LAYERS.length - 1; i >= 0; i--) {
        const layer = LAYERS[i];
        const map = this.layerMaps.get(layer.id);
        const lx = camX * layer.parallax;
        const ly = camY * layer.vParallax + worldOffsetY;

        for (const chunk of map.values()) {
          if (lx < chunk.x0 || lx > chunk.x1) continue;
          const hillY = this._hillHeightAt(layer, lx);
          if (ly >= hillY - 6 * layer.scale) return chunk.dist;

          for (const p of chunk.props) {
            if (p.type === "tree" && Math.abs(lx - p.x) < 34 * layer.scale && ly < p.y && ly > p.y - p.height - 25 * layer.scale) {
              return chunk.dist;
            }
            if ((p.type === "lantern" || p.type === "boulder" || p.type === "trashcan") && Math.abs(lx - p.x) < p.size * 0.7 && ly < p.y && ly > p.y - p.size * 1.25) {
              return chunk.dist;
            }
            if ((p.type === "torii" || p.type === "house" || p.type === "vending") && Math.abs(lx - p.x) < p.w * 0.55 && ly < p.y && ly > p.y - p.h * 1.05) {
              return chunk.dist;
            }
            if (p.type === "car" && Math.abs(lx - p.x) < p.w * 0.55 && ly < p.y && ly > p.y - p.h * 1.2) {
              return chunk.dist;
            }
            if (p.type === "alley" && Math.abs(lx - p.x) < (p.gapW * 0.5 + Math.max(p.wL, p.wR)) && ly < p.y && ly > p.y - Math.max(p.hL, p.hR)) {
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
      const pal = this.curPalette;
      const topC = lerpRGB(pal.skyTop.day, pal.skyTop.night, timePhase);
      const midC = lerpRGB(pal.skyMid.day, pal.skyMid.night, timePhase);
      const horC = lerpRGB(pal.skyHor.day, pal.skyHor.night, timePhase);

      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(0, rgbStr(topC));
      skyGrad.addColorStop(0.54, rgbStr(midC));
      skyGrad.addColorStop(1, rgbStr(horC));
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

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

      const sunRelX = (((170 - camX * 0.04) % 2200) + 2200) % 2200;
      const orbX = cx + (sunRelX > 1100 ? sunRelX - 2200 : sunRelX) * scale;
      const sunY = cy + (-175 + timePhase * 18 - camY * 0.1) * scale;

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

      const clCol = lerpRGB(SHARED_COLORS.cloud.day, SHARED_COLORS.cloud.night, timePhase);
      const clShade = lerpRGB(SHARED_COLORS.cloudShade.day, SHARED_COLORS.cloudShade.night, timePhase);
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

      const mtnCol = lerpRGB(pal.mtn.day, pal.mtn.night, timePhase);
      ctx.fillStyle = rgbStr(mtnCol, 0.85);
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let px = -40; px <= W + 40; px += 28) {
        const wx = (px - cx) / scale + camX * 0.22;
        const peakY =
          -42 + Math.sin(wx * 0.0022) * 34 + Math.cos(wx * 0.0051) * 18 + Math.sin(wx * 0.009) * 8;
        ctx.lineTo(px, cy + (peakY - camY * 0.26) * scale);
      }
      ctx.lineTo(W + 40, H);
      ctx.closePath();
      ctx.fill();

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

      for (const layer of LAYERS) {
        this._renderLayer(ctx, W, H, cx, cy, camX, camY, scale, layer, timePhase, time, windLevel, isSharpScope);
      }

      const petalRGB = lerpRGB(pal.petal.day, pal.petal.night, timePhase);
      const petalCol = rgbStr(petalRGB, timePhase > 0.5 ? 0.72 : 0.85);
      for (const p of this.petals) {
        const px = cx + p.ox * scale;
        const py = cy + p.oy * scale;
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

      const visibleWorldHalf = W / (2 * scale) + 120;
      const chunks = [];
      for (const chunk of map.values()) {
        if (chunk.x1 < lx - visibleWorldHalf || chunk.x0 > lx + visibleWorldHalf) continue;
        chunks.push(chunk);
      }
      chunks.sort((a, b) => a.idx - b.idx);

      // Draw distant city skyline silhouettes behind Layer 1 & 2 hills
      for (const chunk of chunks) {
        for (const sb of chunk.skylineBlocks) {
          const sx = cx + (sb.x - lx) * scale;
          const sy = cy + (sb.y - ly) * scale;
          const sw = sb.w * scale;
          const sh = sb.h * scale;
          const col = lerpRGB(sb.col, [58, 62, 88], timePhase * 0.85);
          ctx.fillStyle = rgbStr(col, 0.82);
          ctx.fillRect(sx, sy - sh, sw, sh + 20 * scale);

          if (isSharpScope && timePhase > 0.25) {
            ctx.fillStyle = `rgba(255, 232, 178, ${(timePhase * 0.42).toFixed(2)})`;
            const cols = 3;
            const rows = 4;
            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < cols; c++) {
                if (Math.sin(sb.litSeed + r * 7 + c * 13) > 0.2) {
                  ctx.fillRect(
                    sx + sw * (0.18 + c * 0.26),
                    sy - sh + sh * (0.15 + r * 0.2),
                    sw * 0.14,
                    sh * 0.08
                  );
                }
              }
            }
          }
        }
      }

      const pal = this.curPalette.hills[layer.id];
      const hillC = lerpRGB(pal.day, pal.night, timePhase);

      ctx.fillStyle = rgbStr(hillC);
      ctx.beginPath();
      ctx.moveTo(-20, H + 40);
      const step = isSharpScope ? 14 : 36;
      for (let px = -20; px <= W + 40; px += step) {
        const wx = (px - cx) / scale + lx;
        const wy = this._hillHeightAt(layer, wx);
        ctx.lineTo(px, cy + (wy - ly) * scale);
      }
      ctx.lineTo(W + 40, H + 40);
      ctx.closePath();
      ctx.fill();

      if (layer.id <= 2) {
        ctx.strokeStyle = timePhase > 0.5 ? "rgba(182, 174, 210, 0.14)" : "rgba(255, 245, 248, 0.35)";
        ctx.lineWidth = Math.max(1, 2 * scale);
        ctx.stroke();
      }

      for (const chunk of chunks) {
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

        for (const p of chunk.props) {
          const px = cx + (p.x - lx) * scale;
          const py = cy + (p.y - ly) * scale;
          this._drawProp(ctx, p, px, py, lx, ly, cx, cy, scale, layer.scale, timePhase, time, windLevel, isSharpScope, chunk.hueShift);
        }

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

    _drawProp(ctx, p, px, py, lx, ly, cx, cy, scale, layerScale, timePhase, time, windLevel, isSharpScope, hueShift) {
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

      if (p.type === "tree") {
        if (p.monster && p.monster.hideMode === "trunk") drawAttachedMonster();

        const trunkCol = lerpRGB(SHARED_COLORS.trunk.day, SHARED_COLORS.trunk.night, timePhase);
        const trunkHi = lerpRGB(SHARED_COLORS.trunkHi.day, SHARED_COLORS.trunkHi.night, timePhase);
        const tw = p.trunkW * scale;
        const th = p.height * scale;
        const lean = p.lean * scale;

        ctx.fillStyle = rgbStr(trunkCol);
        ctx.beginPath();
        ctx.moveTo(px - tw * 0.62, py);
        ctx.quadraticCurveTo(px - tw * 0.25 + lean * 0.25, py - th * 0.5, px + lean - tw * 0.24, py - th * 0.92);
        ctx.lineTo(px + lean + tw * 0.24, py - th * 0.92);
        ctx.quadraticCurveTo(px + tw * 0.32 + lean * 0.25, py - th * 0.5, px + tw * 0.62, py);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = rgbStr(trunkHi, 0.55);
        ctx.lineWidth = Math.max(1, tw * 0.14);
        ctx.beginPath();
        ctx.moveTo(px - tw * 0.35, py - 2 * scale);
        ctx.quadraticCurveTo(px - tw * 0.1 + lean * 0.25, py - th * 0.5, px + lean - tw * 0.12, py - th * 0.85);
        ctx.stroke();

        let cA, cB, cC;
        if (p.style === "maple") {
          cA = lerpRGB(SHARED_COLORS.mapleA.day, SHARED_COLORS.mapleA.night, timePhase);
          cB = lerpRGB(SHARED_COLORS.mapleB.day, SHARED_COLORS.mapleB.night, timePhase);
          cC = lerpRGB(SHARED_COLORS.mapleC.day, SHARED_COLORS.mapleC.night, timePhase);
        } else if (p.style === "ginkgo") {
          cA = lerpRGB(SHARED_COLORS.ginkgo.day, SHARED_COLORS.ginkgo.night, timePhase);
          cB = shiftRGB(cA, -10);
          cC = shiftRGB(cA, 8);
        } else if (p.style === "pine") {
          cA = lerpRGB(SHARED_COLORS.pineA.day, SHARED_COLORS.pineA.night, timePhase);
          cB = lerpRGB(SHARED_COLORS.pineB.day, SHARED_COLORS.pineB.night, timePhase);
          cC = shiftRGB(cA, -8);
        } else {
          cA = lerpRGB(SHARED_COLORS.sakuraA.day, SHARED_COLORS.sakuraA.night, timePhase);
          cB = lerpRGB(SHARED_COLORS.sakuraB.day, SHARED_COLORS.sakuraB.night, timePhase);
          cC = lerpRGB(SHARED_COLORS.sakuraLight.day, SHARED_COLORS.sakuraLight.night, timePhase);
        }

        p.puffs.forEach((pf, idx) => {
          const baseC = pf.tone === 0 ? cA : pf.tone === 1 ? cB : cC;
          ctx.fillStyle = rgbStr(shiftRGB(baseC, hueShift * 0.4), 0.94);
          ctx.beginPath();
          if (p.style === "pine") {
            ctx.ellipse(
              px + pf.dx * scale + sway * 0.4,
              py + pf.dy * scale,
              pf.r * 1.35 * scale,
              pf.r * 0.56 * scale,
              0,
              0,
              Math.PI * 2
            );
          } else {
            ctx.arc(px + pf.dx * scale + sway * (0.6 + idx * 0.08), py + pf.dy * scale, pf.r * scale, 0, Math.PI * 2);
          }
          ctx.fill();

          if (idx === Math.floor(p.puffs.length / 2) && p.monster && p.monster.hideMode === "canopy") {
            drawAttachedMonster();
          }
        });
        drawSplats();
      } else if (p.type === "house") {
        if (p.monster) drawAttachedMonster();
        const wall = lerpRGB(SHARED_COLORS.plaster.day, SHARED_COLORS.plaster.night, timePhase);
        const roof = lerpRGB(SHARED_COLORS.roofTile.day, SHARED_COLORS.roofTile.night, timePhase);
        const wood = lerpRGB(SHARED_COLORS.woodWall.day, SHARED_COLORS.woodWall.night, timePhase);
        const w = p.w * scale;
        const h = p.h * scale;

        // Walls & timber trim
        ctx.fillStyle = rgbStr(wall);
        ctx.fillRect(px - w * 0.44, py - h * 0.72, w * 0.88, h * 0.72);
        ctx.fillStyle = rgbStr(wood);
        ctx.fillRect(px - w * 0.44, py - h * 0.16, w * 0.88, h * 0.16);

        // Glowing shoji window at night
        ctx.fillStyle = timePhase > 0.3 ? `rgba(255, 224, 152, ${(0.35 + timePhase * 0.6).toFixed(2)})` : "rgba(182, 174, 166, 0.45)";
        ctx.fillRect(px - w * 0.28, py - h * 0.56, w * 0.24, h * 0.28);
        ctx.fillRect(px + w * 0.06, py - h * 0.56, w * 0.22, h * 0.28);

        // Curved Kawara Roof
        ctx.fillStyle = p.roofTone === 0 ? rgbStr(roof) : rgbStr(shiftRGB(roof, 14));
        ctx.beginPath();
        ctx.moveTo(px - w * 0.56, py - h * 0.68);
        ctx.quadraticCurveTo(px, py - h * 1.18, px + w * 0.56, py - h * 0.68);
        ctx.lineTo(px + w * 0.48, py - h * 0.65);
        ctx.lineTo(px - w * 0.48, py - h * 0.65);
        ctx.closePath();
        ctx.fill();
        drawSplats();
      } else if (p.type === "alley") {
        const wL = p.wL * scale;
        const hL = p.hL * scale;
        const wR = p.wR * scale;
        const hR = p.hR * scale;
        const gap = p.gapW * scale;

        // Shadowed recessed alleyway backdrop
        ctx.fillStyle = timePhase > 0.5 ? "rgba(28, 28, 46, 0.85)" : "rgba(116, 110, 124, 0.42)";
        ctx.fillRect(px - gap * 0.55, py - Math.min(hL, hR) * 0.92, gap * 1.1, Math.min(hL, hR) * 0.92);

        // Monster inside alley gap peeking out from wall corner
        if (p.monster) drawAttachedMonster();

        // Left & Right Pastel Buildings
        const colL = lerpRGB(p.colL, [64, 66, 88], timePhase * 0.82);
        const colR = lerpRGB(p.colR, [58, 62, 84], timePhase * 0.82);

        ctx.fillStyle = rgbStr(colL);
        ctx.fillRect(px - gap * 0.5 - wL, py - hL, wL, hL);
        ctx.fillStyle = rgbStr(colR);
        ctx.fillRect(px + gap * 0.5, py - hR, wR, hR);

        // Subtle pastel windows
        const winCol = timePhase > 0.35 ? `rgba(255, 228, 166, ${(0.25 + timePhase * 0.6).toFixed(2)})` : "rgba(248, 250, 255, 0.5)";
        ctx.fillStyle = winCol;
        for (let r = 0; r < 3; r++) {
          ctx.fillRect(px - gap * 0.5 - wL * 0.72, py - hL * (0.8 - r * 0.22), wL * 0.22, hL * 0.11);
          ctx.fillRect(px - gap * 0.5 - wL * 0.36, py - hL * (0.8 - r * 0.22), wL * 0.22, hL * 0.11);
          ctx.fillRect(px + gap * 0.5 + wR * 0.16, py - hR * (0.8 - r * 0.22), wR * 0.22, hR * 0.11);
          ctx.fillRect(px + gap * 0.5 + wR * 0.54, py - hR * (0.8 - r * 0.22), wR * 0.22, hR * 0.11);
        }
        drawSplats();
      } else if (p.type === "car") {
        // Monster crouched behind car body peeking over roof/hood
        if (p.monster) drawAttachedMonster();

        const bodyC = lerpRGB(p.col, [62, 66, 86], timePhase * 0.78);
        const darkC = lerpRGB([112, 118, 132], [38, 40, 56], timePhase);
        const w = p.w * scale;
        const h = p.h * scale;

        ctx.fillStyle = rgbStr(bodyC);
        ctx.beginPath();
        ctx.roundRect(px - w * 0.48, py - h * 0.62, w * 0.96, h * 0.48, 4 * scale);
        ctx.fill();

        // Cabin
        ctx.beginPath();
        if (p.isTruck) {
          ctx.roundRect(px - w * 0.42, py - h * 1.0, w * 0.4, h * 0.46, 3 * scale);
        } else {
          ctx.roundRect(px - w * 0.28, py - h * 1.0, w * 0.56, h * 0.46, 5 * scale);
        }
        ctx.fill();

        // Windows
        ctx.fillStyle = timePhase > 0.5 ? "rgba(42, 48, 70, 0.9)" : "rgba(182, 204, 224, 0.85)";
        if (p.isTruck) {
          ctx.fillRect(px - w * 0.37, py - h * 0.92, w * 0.28, h * 0.28);
        } else {
          ctx.fillRect(px - w * 0.22, py - h * 0.92, w * 0.2, h * 0.28);
          ctx.fillRect(px + w * 0.02, py - h * 0.92, w * 0.2, h * 0.28);
        }

        // Wheels
        ctx.fillStyle = rgbStr(darkC);
        ctx.beginPath();
        ctx.arc(px - w * 0.3, py - h * 0.14, h * 0.22, 0, Math.PI * 2);
        ctx.arc(px + w * 0.3, py - h * 0.14, h * 0.22, 0, Math.PI * 2);
        ctx.fill();

        if (timePhase > 0.35) {
          ctx.fillStyle = `rgba(255, 232, 168, ${(timePhase * 0.8).toFixed(2)})`;
          ctx.fillRect(px + p.dir * w * 0.44 - 2 * scale, py - h * 0.48, 4 * scale, 4 * scale);
        }
        drawSplats();
      } else if (p.type === "trashcan") {
        if (p.monster) drawAttachedMonster();
        const binC = lerpRGB([178, 184, 192], [72, 76, 92], timePhase);
        const binLid = lerpRGB([152, 158, 168], [56, 60, 74], timePhase);
        const sz = p.size * scale;

        // Pair of street bins
        [-0.36, 0.36].forEach((off, idx) => {
          const bw = sz * 0.58;
          const bh = sz * (idx === 0 ? 0.88 : 0.78);
          const bx = px + off * sz;
          ctx.fillStyle = rgbStr(binC);
          ctx.fillRect(bx - bw * 0.5, py - bh, bw, bh);
          ctx.fillStyle = rgbStr(binLid);
          ctx.fillRect(bx - bw * 0.56, py - bh - sz * 0.1, bw * 1.12, sz * 0.12);
        });
        drawSplats();
      } else if (p.type === "vending") {
        if (p.monster) drawAttachedMonster();
        const vmC = lerpRGB(p.col, [82, 86, 108], timePhase * 0.78);
        const w = p.w * scale;
        const h = p.h * scale;

        ctx.fillStyle = rgbStr(vmC);
        ctx.beginPath();
        ctx.roundRect(px - w * 0.48, py - h, w * 0.96, h, 3 * scale);
        ctx.fill();

        const glow = 0.45 + timePhase * 0.55;
        ctx.fillStyle = `rgba(210, 240, 250, ${glow.toFixed(2)})`;
        ctx.fillRect(px - w * 0.36, py - h * 0.88, w * 0.72, h * 0.46);

        // Tiny colorful drink rows
        const rowCols = ["#F09AA8", "#9AD2C4", "#F4D48E"];
        for (let r = 0; r < 3; r++) {
          ctx.fillStyle = rowCols[r];
          ctx.fillRect(px - w * 0.3, py - h * (0.82 - r * 0.14), w * 0.6, h * 0.06);
        }
        drawSplats();
      } else if (p.type === "pole") {
        if (p.monster) drawAttachedMonster();
        const pC = lerpRGB(SHARED_COLORS.woodWall.day, SHARED_COLORS.woodWall.night, timePhase);
        const w = p.w * scale;
        const h = p.h * scale;
        ctx.fillStyle = rgbStr(pC);
        ctx.fillRect(px - w * 0.5, py - h, w, h);
        ctx.fillRect(px - w * 2.2, py - h * 0.88, w * 4.4, w * 0.55);
        ctx.fillRect(px - w * 1.8, py - h * 0.76, w * 3.6, w * 0.45);
        drawSplats();
      } else if (p.type === "streetlight") {
        const stC = lerpRGB([138, 140, 152], [58, 62, 80], timePhase);
        const h = p.h * scale;
        ctx.strokeStyle = rgbStr(stC);
        ctx.lineWidth = Math.max(1.2, 2.5 * scale);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py - h * 0.9);
        ctx.quadraticCurveTo(px, py - h, px + 14 * scale, py - h);
        ctx.stroke();
        if (timePhase > 0.25) {
          const lg = ctx.createRadialGradient(px + 14 * scale, py - h + 3 * scale, 1, px + 14 * scale, py - h + 3 * scale, 36 * scale);
          lg.addColorStop(0, `rgba(255, 228, 165, ${(timePhase * 0.42).toFixed(2)})`);
          lg.addColorStop(1, "rgba(255, 228, 165, 0)");
          ctx.fillStyle = lg;
          ctx.beginPath();
          ctx.arc(px + 14 * scale, py - h + 3 * scale, 36 * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (p.type === "lantern") {
        if (p.monster) drawAttachedMonster();
        const st = lerpRGB(SHARED_COLORS.stone.day, SHARED_COLORS.stone.night, timePhase);
        const stS = lerpRGB(SHARED_COLORS.stoneShade.day, SHARED_COLORS.stoneShade.night, timePhase);
        const sz = p.size * scale;

        ctx.fillStyle = rgbStr(stS);
        ctx.fillRect(px - sz * 0.34, py - sz * 0.18, sz * 0.68, sz * 0.18);
        ctx.fillStyle = rgbStr(st);
        ctx.fillRect(px - sz * 0.14, py - sz * 0.66, sz * 0.28, sz * 0.48);
        ctx.fillRect(px - sz * 0.26, py - sz * 0.95, sz * 0.52, sz * 0.3);

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
        const st = lerpRGB(SHARED_COLORS.stone.day, SHARED_COLORS.stone.night, timePhase);
        const stS = lerpRGB(SHARED_COLORS.stoneShade.day, SHARED_COLORS.stoneShade.night, timePhase);
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
        const b1 = lerpRGB(SHARED_COLORS.bamboo.day, SHARED_COLORS.bamboo.night, timePhase);
        const b2 = lerpRGB(SHARED_COLORS.bambooDark.day, SHARED_COLORS.bambooDark.night, timePhase);
        p.poles.forEach((pole, idx) => {
          if (idx === Math.floor(p.poles.length / 2) && p.monster) drawAttachedMonster();
          ctx.save();
          ctx.translate(px + pole.dx * scale, py);
          ctx.rotate(pole.tilt + sway * 0.003);
          const pw = pole.w * scale;
          const ph = pole.h * scale;
          ctx.fillStyle = rgbStr(pole.dark ? b2 : b1);
          ctx.fillRect(-pw * 0.5, -ph, pw, ph);
          ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
          for (let j = 1; j <= 4; j++) {
            ctx.fillRect(-pw * 0.6, -ph * (j / 5), pw * 1.2, Math.max(1, 1.3 * scale));
          }
          ctx.restore();
        });
        drawSplats();
      } else if (p.type === "torii") {
        if (p.monster) drawAttachedMonster();
        const tCol = lerpRGB(SHARED_COLORS.torii.day, SHARED_COLORS.torii.night, timePhase);
        const capCol = lerpRGB(SHARED_COLORS.toriiCap.day, SHARED_COLORS.toriiCap.night, timePhase);
        const w = p.w * scale;
        const h = p.h * scale;
        const pillarW = w * 0.11;

        ctx.fillStyle = rgbStr(tCol);
        ctx.fillRect(px - w * 0.36 - pillarW * 0.5, py - h, pillarW, h);
        ctx.fillRect(px + w * 0.36 - pillarW * 0.5, py - h, pillarW, h);
        ctx.fillRect(px - w * 0.44, py - h * 0.74, w * 0.88, pillarW * 0.8);
        ctx.fillRect(px - w * 0.54, py - h * 0.96, w * 1.08, pillarW * 0.95);

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
        const tipX = gx + (b.dx + b.bend) * scale + sway;
        const tipY = gy - b.h * scale;
        ctx.beginPath();
        ctx.moveTo(gx + b.dx * scale, gy);
        ctx.quadraticCurveTo(gx + (b.dx + b.bend * 0.4) * scale + sway * 0.45, gy - b.h * 0.55 * scale, tipX, tipY);
        ctx.stroke();

        if (b.plume) {
          ctx.fillStyle = timePhase > 0.5 ? "rgba(188, 174, 172, 0.55)" : "rgba(250, 238, 214, 0.85)";
          ctx.beginPath();
          ctx.ellipse(tipX, tipY, 2.2 * layerScale * scale, 4.5 * layerScale * scale, 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
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
