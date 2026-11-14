(function () {
  "use strict";

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpColor(c1, c2, t) {
    const r = Math.round(lerp(c1[0], c2[0], t));
    const g = Math.round(lerp(c1[1], c2[1], t));
    const b = Math.round(lerp(c1[2], c2[2], t));
    return `rgb(${r},${g},${b})`;
  }

  function rgba(c, a) {
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  }

  // Sneaky camouflaged yokai-inspired palettes blended softly into day & night hills
  const PALETTES = {
    bark_lurker: {
      dayBody: [96, 78, 74],
      nightBody: [54, 48, 59],
      dayAccent: [148, 124, 118],
      nightAccent: [88, 79, 98],
    },
    blossom_mimic: {
      dayBody: [212, 150, 170],
      nightBody: [132, 108, 134],
      dayAccent: [242, 206, 218],
      nightAccent: [176, 146, 174],
    },
    lantern_shade: {
      dayBody: [132, 132, 126],
      nightBody: [66, 70, 84],
      dayAccent: [168, 166, 158],
      nightAccent: [104, 108, 126],
    },
    bamboo_stalker: {
      dayBody: [110, 138, 114],
      nightBody: [56, 78, 76],
      dayAccent: [152, 178, 152],
      nightAccent: [88, 116, 112],
    },
    grass_oni: {
      dayBody: [114, 140, 112],
      nightBody: [48, 66, 68],
      dayAccent: [168, 138, 146],
      nightAccent: [92, 82, 102],
    },
    ridge_phantom: {
      dayBody: [134, 142, 152],
      nightBody: [62, 68, 92],
      dayAccent: [188, 184, 198],
      nightAccent: [118, 116, 148],
    },
  };

  function createMonster(opts) {
    // opts: { species, hideMode, worldX, worldY, scale, distance, peekSide, layerId, difficulty }
    const s = opts.scale;
    const peek = opts.peekSide || 1;
    const species = opts.species;

    // Define normalized relative offsets (around monster anchor worldX, worldY)
    // so both rendering & exposed hitbox stay in exact lockstep.
    let headOffX = 0;
    let headOffY = -28 * s;
    let headR = 8.5 * s;
    let bodyBox = { x: -9 * s, y: -22 * s, w: 18 * s, h: 24 * s };

    if (species === "bark_lurker") {
      headOffX = peek * 5 * s;
      headOffY = -30 * s;
      headR = 8.5 * s;
      bodyBox = { x: (peek > 0 ? -4 : -13) * s, y: -24 * s, w: 17 * s, h: 26 * s };
    } else if (species === "blossom_mimic") {
      headOffX = 0;
      headOffY = -12 * s;
      headR = 10.5 * s;
      bodyBox = { x: -12 * s, y: -18 * s, w: 24 * s, h: 22 * s };
    } else if (species === "lantern_shade") {
      headOffX = peek * 4 * s;
      headOffY = -26 * s;
      headR = 9 * s;
      bodyBox = { x: -10 * s, y: -20 * s, w: 20 * s, h: 22 * s };
    } else if (species === "bamboo_stalker") {
      headOffX = peek * 6 * s;
      headOffY = -42 * s;
      headR = 8 * s;
      bodyBox = { x: -6 * s, y: -38 * s, w: 14 * s, h: 40 * s };
    } else if (species === "grass_oni") {
      headOffX = 0;
      headOffY = -15 * s;
      headR = 9.5 * s;
      bodyBox = { x: -11 * s, y: -16 * s, w: 22 * s, h: 16 * s };
    } else if (species === "ridge_phantom") {
      headOffX = peek * 2 * s;
      headOffY = -36 * s;
      headR = 8.5 * s;
      bodyBox = { x: -8 * s, y: -32 * s, w: 16 * s, h: 34 * s };
    }

    return {
      id: Math.random().toString(36).slice(2),
      species,
      hideMode: opts.hideMode,
      layerId: opts.layerId,
      worldX: opts.worldX,
      worldY: opts.worldY,
      scale: s,
      distance: opts.distance,
      peekSide: peek,
      seed: Math.random() * 1000,
      alive: true,
      fadeOut: 1.0,
      vanishing: false,
      blinkPhase: Math.random() * 4.5,
      headOffX,
      headOffY,
      headR,
      bodyBox,
      // Subtle camo tightness increases slightly with player kill count
      camoLevel: Math.min(1, (opts.difficulty || 0) * 0.1),
    };
  }

  function updateMonster(m, dt) {
    m.blinkPhase -= dt;
    if (m.blinkPhase < -0.14) {
      m.blinkPhase = 2.6 + Math.random() * 3.8;
    }
    if (m.vanishing) {
      m.fadeOut = Math.max(0, m.fadeOut - dt * 2.8);
    }
  }

  function testMonsterHit(m, impactWorldX, impactWorldY) {
    if (!m.alive || m.vanishing) return null;

    // Slight fair padding for far layers so sub-pixel edge misses feel great
    const pad = (m.layerId <= 2 ? 3.2 : 1.6) * m.scale;

    // 1) Check Head / Vital core
    const hx = m.worldX + m.headOffX;
    const hy = m.worldY + m.headOffY;
    const hr = m.headR + pad;
    const dx = impactWorldX - hx;
    const dy = impactWorldY - hy;
    if (dx * dx + dy * dy <= hr * hr) {
      return { hit: true, headshot: true, hitX: impactWorldX, hitY: impactWorldY };
    }

    // 2) Check Body silhouette box
    const bx = m.worldX + m.bodyBox.x - pad;
    const by = m.worldY + m.bodyBox.y - pad;
    const bw = m.bodyBox.w + pad * 2;
    const bh = m.bodyBox.h + pad * 2;
    if (impactWorldX >= bx && impactWorldX <= bx + bw && impactWorldY >= by && impactWorldY <= by + bh) {
      return { hit: true, headshot: false, hitX: impactWorldX, hitY: impactWorldY };
    }

    return null;
  }

  function drawEyes(ctx, x, y, r, peek, count, isBlinking, timePhase, time, seed) {
    if (isBlinking) {
      ctx.strokeStyle = timePhase > 0.5 ? "rgba(25,20,30,0.85)" : "rgba(35,24,30,0.8)";
      ctx.lineWidth = Math.max(1, r * 0.22);
      ctx.beginPath();
      if (count === 1) {
        ctx.moveTo(x - r * 0.5, y);
        ctx.lineTo(x + r * 0.5, y);
      } else {
        ctx.moveTo(x - r * 0.65, y);
        ctx.lineTo(x - r * 0.15, y);
        ctx.moveTo(x + r * 0.15, y);
        ctx.lineTo(x + r * 0.65, y);
      }
      ctx.stroke();
      return;
    }

    const darkSocket = timePhase > 0.5 ? "rgba(22, 18, 30, 0.9)" : "rgba(34, 24, 30, 0.88)";
    // Faint moonlit eye glint every few seconds at night
    const glintWave = Math.max(0, Math.sin(time * 1.4 + seed));
    const pupilAlpha = timePhase > 0.35 ? 0.25 + timePhase * 0.45 * glintWave : 0.22;
    const pupilColor = `rgba(246, 224, 232, ${pupilAlpha.toFixed(2)})`;

    if (count === 1) {
      ctx.fillStyle = darkSocket;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 0.44, r * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = pupilColor;
      ctx.beginPath();
      ctx.arc(x + peek * r * 0.08, y, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    } else if (count === 3) {
      const pts = [
        [x - r * 0.42, y + r * 0.1],
        [x + r * 0.42, y + r * 0.1],
        [x, y - r * 0.38],
      ];
      pts.forEach(([ex, ey], i) => {
        ctx.fillStyle = darkSocket;
        ctx.beginPath();
        ctx.arc(ex, ey, i === 2 ? r * 0.24 : r * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pupilColor;
        ctx.beginPath();
        ctx.arc(ex, ey, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
      });
    } else {
      [-1, 1].forEach((side) => {
        const ex = x + side * r * 0.42;
        ctx.fillStyle = darkSocket;
        ctx.beginPath();
        ctx.ellipse(ex, y, r * 0.24, r * 0.28, side * -0.15, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = pupilColor;
        ctx.beginPath();
        ctx.arc(ex + peek * r * 0.05, y, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  function drawMonster(ctx, m, sx, sy, pxScale, timePhase, time) {
    if (!m.alive || m.fadeOut <= 0.01) return;

    const pal = PALETTES[m.species] || PALETTES.bark_lurker;
    const bodyCol = lerpColor(pal.dayBody, pal.nightBody, timePhase);
    const accentCol = lerpColor(pal.dayAccent, pal.nightAccent, timePhase);
    const s = m.scale * pxScale;
    const peek = m.peekSide;
    const isBlinking = m.blinkPhase < 0;

    // Subtle off-rhythm breathing / peeking sway
    const breath = Math.sin(time * 2.1 + m.seed) * 1.1 * s;
    const lean = Math.sin(time * 0.95 + m.seed * 0.7) * 0.045;

    ctx.save();
    ctx.globalAlpha = m.fadeOut * (0.94 - m.camoLevel * 0.08);
    ctx.translate(sx, sy);
    ctx.rotate(lean);

    if (m.species === "bark_lurker") {
      // Hunched silhouette with spindly fingers gripping trunk edge
      ctx.fillStyle = bodyCol;
      ctx.beginPath();
      ctx.moveTo(-6 * s, 2 * s);
      ctx.quadraticCurveTo(peek * 12 * s, -12 * s, peek * 6 * s, -27 * s + breath * 0.4);
      ctx.quadraticCurveTo(-peek * 4 * s, -22 * s, -6 * s, 2 * s);
      ctx.fill();

      // Peeking oval mask-like head
      ctx.beginPath();
      ctx.ellipse(peek * 5 * s, -30 * s + breath * 0.5, 7.2 * s, 8.8 * s, peek * 0.16, 0, Math.PI * 2);
      ctx.fill();

      // Pale wooden mask stripe / horns
      ctx.fillStyle = accentCol;
      ctx.beginPath();
      ctx.moveTo(peek * 3 * s, -37 * s + breath * 0.5);
      ctx.lineTo(peek * 7 * s, -44 * s + breath * 0.5);
      ctx.lineTo(peek * 9 * s, -35 * s + breath * 0.5);
      ctx.fill();

      // Spindly claws wrapping around bark
      ctx.strokeStyle = bodyCol;
      ctx.lineWidth = Math.max(1, 1.8 * s);
      ctx.lineCap = "round";
      for (let i = 0; i < 3; i++) {
        const fy = (-18 + i * 4.5) * s;
        ctx.beginPath();
        ctx.moveTo(peek * 6 * s, fy);
        ctx.lineTo(-peek * 3 * s, fy + 1.2 * s);
        ctx.stroke();
      }

      drawEyes(ctx, peek * 5.8 * s, -30.5 * s + breath * 0.5, 6 * s, peek, 3, isBlinking, timePhase, time, m.seed);
    } else if (m.species === "blossom_mimic") {
      // Nestled among sakura clouds: petal-fringed eerie face
      ctx.fillStyle = bodyCol;
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + time * 0.2;
        ctx.beginPath();
        ctx.ellipse(
          Math.cos(ang) * 7.5 * s,
          -11 * s + Math.sin(ang) * 6.5 * s + breath * 0.3,
          7 * s,
          5 * s,
          ang,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      ctx.fillStyle = accentCol;
      ctx.beginPath();
      ctx.arc(0, -12 * s + breath * 0.3, 8.2 * s, 0, Math.PI * 2);
      ctx.fill();

      // Hollow crescent grin
      ctx.strokeStyle = timePhase > 0.5 ? "rgba(25, 18, 30, 0.82)" : "rgba(60, 32, 46, 0.78)";
      ctx.lineWidth = Math.max(1, 1.3 * s);
      ctx.beginPath();
      ctx.arc(0, -10.5 * s + breath * 0.3, 4.2 * s, 0.18 * Math.PI, 0.82 * Math.PI);
      ctx.stroke();

      drawEyes(ctx, 0, -13.5 * s + breath * 0.3, 6.2 * s, peek, 2, isBlinking, timePhase, time, m.seed);
    } else if (m.species === "lantern_shade") {
      // Crouching stone-colored horned watcher
      ctx.fillStyle = bodyCol;
      ctx.beginPath();
      ctx.ellipse(peek * 2 * s, -10 * s, 10 * s, 11 * s + breath * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tilted head + jagged ears/horns
      ctx.beginPath();
      ctx.arc(peek * 4 * s, -24 * s + breath * 0.4, 7.6 * s, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = accentCol;
      ctx.beginPath();
      ctx.moveTo(peek * 0.5 * s, -29 * s + breath * 0.4);
      ctx.lineTo(peek * -2 * s, -39 * s + breath * 0.4);
      ctx.lineTo(peek * 4 * s, -31 * s + breath * 0.4);
      ctx.lineTo(peek * 8 * s, -39 * s + breath * 0.4);
      ctx.lineTo(peek * 9 * s, -28 * s + breath * 0.4);
      ctx.fill();

      drawEyes(ctx, peek * 4.5 * s, -24.5 * s + breath * 0.4, 5.5 * s, peek, 2, isBlinking, timePhase, time, m.seed);
    } else if (m.species === "bamboo_stalker") {
      // Impossibly tall slender figure tilting head from between poles
      ctx.fillStyle = bodyCol;
      ctx.beginPath();
      ctx.roundRect(-4 * s, -34 * s, 8 * s, 35 * s, 3 * s);
      ctx.fill();

      // Crooked neck & vertical mask head
      ctx.save();
      ctx.translate(peek * 2 * s, -33 * s);
      ctx.rotate(peek * 0.28 + Math.sin(time * 1.3 + m.seed) * 0.05);
      ctx.fillStyle = accentCol;
      ctx.beginPath();
      ctx.ellipse(peek * 2 * s, -8 * s, 5.6 * s, 8.8 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      drawEyes(ctx, peek * 2 * s, -8.5 * s, 4.8 * s, peek, 1, isBlinking, timePhase, time, m.seed);
      ctx.restore();
    } else if (m.species === "grass_oni") {
      // Low crouched meadow spirit with stubby curved horns
      ctx.fillStyle = bodyCol;
      ctx.beginPath();
      ctx.ellipse(0, -9 * s + breath * 0.3, 11.5 * s, 9.5 * s, 0, Math.PI, Math.PI * 2);
      ctx.lineTo(11.5 * s, 0);
      ctx.lineTo(-11.5 * s, 0);
      ctx.closePath();
      ctx.fill();

      // Horns
      ctx.fillStyle = accentCol;
      [-1, 1].forEach((side) => {
        ctx.beginPath();
        ctx.moveTo(side * 4 * s, -16 * s + breath * 0.3);
        ctx.quadraticCurveTo(side * 9 * s, -24 * s, side * 6 * s, -25 * s);
        ctx.lineTo(side * 7.5 * s, -15 * s + breath * 0.3);
        ctx.fill();
      });

      drawEyes(ctx, 0, -13 * s + breath * 0.3, 6.2 * s, peek, 2, isBlinking, timePhase, time, m.seed);
    } else if (m.species === "ridge_phantom") {
      // Wispy slender distant silhouette
      ctx.fillStyle = bodyCol;
      ctx.beginPath();
      ctx.moveTo(-7 * s, 2 * s);
      ctx.quadraticCurveTo(-5 * s, -22 * s, peek * 1.5 * s, -32 * s);
      ctx.quadraticCurveTo(6 * s, -22 * s, 7 * s, 2 * s);
      ctx.closePath();
      ctx.fill();

      // Slender eerie tilted head
      ctx.fillStyle = accentCol;
      ctx.beginPath();
      ctx.ellipse(peek * 2 * s, -36 * s + breath * 0.4, 6.2 * s, 7.8 * s, peek * 0.14, 0, Math.PI * 2);
      ctx.fill();

      drawEyes(ctx, peek * 2.2 * s, -36.5 * s + breath * 0.4, 4.8 * s, peek, 2, isBlinking, timePhase, time, m.seed);
    }

    ctx.restore();
  }

  // Juicy splat particle burst + splatter drops
  function createSplatBurst(worldX, worldY, layerId, scale, isHeadshot, timePhase) {
    const particles = [];
    const count = isHeadshot ? 34 : 24;
    const baseColors =
      timePhase > 0.5
        ? ["#3D1838", "#692852", "#9A416E", "#D4789C"]
        : ["#561D3B", "#8B264C", "#B83B64", "#E5859E"];

    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (35 + Math.random() * (isHeadshot ? 165 : 120)) * scale;
      particles.push({
        kind: i % 5 === 0 ? "petal" : "ichor",
        x: worldX,
        y: worldY,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 35 * scale,
        r: (2.2 + Math.random() * (isHeadshot ? 5.2 : 4.0)) * scale,
        gravity: (190 + Math.random() * 140) * scale,
        alpha: 1.0,
        decay: 0.75 + Math.random() * 0.75,
        color:
          i % 5 === 0
            ? timePhase > 0.5
              ? "#C8A6C0"
              : "#FAD3DF"
            : baseColors[i % baseColors.length],
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 8,
      });
    }

    // Expanding shockwave ring
    particles.push({
      kind: "ring",
      x: worldX,
      y: worldY,
      r: 4 * scale,
      maxR: (isHeadshot ? 46 : 34) * scale,
      alpha: 0.7,
      color: isHeadshot ? "#FFE8EE" : "#D96A8A",
    });

    return { layerId, particles };
  }

  window.SakuraMonsters = {
    createMonster,
    updateMonster,
    drawMonster,
    testMonsterHit,
    createSplatBurst,
  };
})();
