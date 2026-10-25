// Block Frenzy's geometry: Fort Chaos, the two stands, the glowing Bitcoin block each team guards (in its colour), paint balls,
// splats and the team rings under the Oogas' feet. Every builder is cached; the scene places nodes.
(() => {
  "use strict";
  const BL = window.BL = window.BL || {};
  const { box, bevelBox, merge, moved, turnedY, cached, variants, geometry, pushVert, face, tube } = BL.models;
  const { hexToRgb } = BL.math;
  const SIM = BL.blockSim, A = SIM.ARENA;
  const TEAM = {
    blue: { paint: "#3a8dff", deep: "#1d4fa8", light: "#9cc8ff" },
    red: { paint: "#ff4a3a", deep: "#a8261d", light: "#ffb0a6" }
  };
  const ORANGE = "#f7931a", CREAM = "#fff3d6", TOP = SIM.CONFIG.TOWER_TOP;
  // The ₿ in a 7 x 9 grid, top row first: the strokes stand proud of the block's faces.
  const GLYPH = [
    "..#.#..",
    "######.",
    ".#....#",
    ".#....#",
    ".#####.",
    ".#....#",
    ".#....#",
    "######.",
    "..#.#.."
  ];

  // The ground: a sandy field with a darker strip down the middle and each half's end tinted to its team, then every
  // wall block in stone with a team-coloured cap near its fort, timber crates for the field's low cover, and the
  // centre tower in dark stone with an orange band.
  const arena = cached(() => {
    const parts = [];
    parts.push(box({ w: A.W * 2 + 4, h: 1, d: A.L * 2 + 4, color: "#6b5a3e", offset: { y: -0.5 } }));
    parts.push(box({ w: A.W * 2, h: 0.04, d: A.L * 2, color: "#c9a96b", offset: { y: 0.02 } }));
    parts.push(box({ w: A.W * 2, h: 0.05, d: 0.6, color: ORANGE, emissive: 0.25, offset: { y: 0.03 } }));
    for (const t of SIM.TEAMS) {
      const s = t === "blue" ? 1 : -1;
      parts.push(box({ w: A.W * 2, h: 0.05, d: 12, color: t === "blue" ? "#b8b894" : "#c8a586", offset: { y: 0.025, z: s * (A.L - 6) } }));
      // A ring of team paint round the stand, flush with the ground.
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2;
        parts.push(box({ w: 0.5, h: 0.06, d: 0.18, color: TEAM[t].paint, emissive: 0.3, offset: { x: A.stands[t].x + Math.sin(a) * SIM.CONFIG.STAND_R, y: 0.03, z: A.stands[t].z + Math.cos(a) * SIM.CONFIG.STAND_R } }));
      }
    }
    // A low rim round the field.
    for (const s of [-1, 1]) {
      parts.push(bevelBox({ w: 0.6, h: 0.8, d: A.L * 2 + 0.6, color: "#7d7468", offset: { x: s * (A.W + 0.3), y: 0.4 } }));
      parts.push(bevelBox({ w: A.W * 2 + 1.2, h: 0.8, d: 0.6, color: "#7d7468", offset: { z: s * (A.L + 0.3), y: 0.4 } }));
    }
    for (const b of A.BLOCKS) {
      const w = b[1] - b[0], d = b[3] - b[2], bottom = b[5] || 0, h = b[4] - bottom, x = (b[0] + b[1]) / 2, z = (b[2] + b[3]) / 2, y = bottom + h / 2;
      const fort = Math.abs(z) > 22 && Math.abs(z) < 34, team = z > 0 ? "blue" : "red";
      const post = w < 1 && d < 1, deck = b[4] === TOP, rail = bottom === TOP, roof = bottom > 4 && !deck && !rail, floor = bottom > 1.5 && h < 0.5 && !roof, hutWall = bottom > 1.5 && !floor && !roof;
      if (rail) {
        // A sniper tower's parapet: planks with a team-painted cap.
        parts.push(bevelBox({ w, h, d, color: "#8a6440", offset: { x, y, z } }));
        parts.push(box({ w: w + 0.04, h: 0.12, d: d + 0.04, color: TEAM[team].paint, emissive: 0.2, offset: { x, y: b[4] + 0.06, z } }));
      } else if (roof) {
        // Thatch: a straw slab with a darker fringe.
        parts.push(bevelBox({ w, h, d, color: "#b8924a", offset: { x, y, z } }));
        parts.push(box({ w: w + 0.1, h: 0.08, d: d + 0.1, color: "#8a6a32", offset: { x, y: bottom + 0.02, z } }));
      } else if (floor) {
        parts.push(bevelBox({ w, h, d, color: "#7a5232", offset: { x, y, z } }));
        for (let k = 1; k < Math.floor(w / 0.8); k++) parts.push(box({ w: 0.04, h: 0.02, d, color: "#5a3a22", offset: { x: b[0] + k * 0.8, y: b[4] + 0.005, z } }));
      } else if (hutWall) {
        parts.push(bevelBox({ w, h, d, color: "#9a7448", offset: { x, y, z } }));
      } else if (post) {
        parts.push(bevelBox({ w, h, d, color: "#5a3a22", offset: { x, y, z } }));
      } else if (fort) {
        parts.push(bevelBox({ w, h, d, color: "#8a8178", offset: { x, y, z } }));
        parts.push(box({ w: w + 0.04, h: 0.18, d: d + 0.04, color: TEAM[team].paint, emissive: 0.15, offset: { x, y: b[4] + 0.09, z } }));
      } else if (h > 3) {
        // The tall walls that break the sight line, banded in orange.
        parts.push(bevelBox({ w, h, d, color: "#4a4440", offset: { x, y, z } }));
        parts.push(box({ w: w + 0.06, h: 0.3, d: d + 0.06, color: ORANGE, emissive: 0.8, offset: { x, y: b[4] - 0.6, z } }));
      } else {
        parts.push(bevelBox({ w, h, d, color: h > 1.5 ? "#7a6a58" : "#8a5a32", offset: { x, y, z } }));
        parts.push(box({ w: w * 0.7, h: 0.05, d: d + 0.02, color: "#5a3a22", offset: { x, y: bottom + h * 0.55, z } }));
      }
    }
    return merge(...parts);
  });
  // A stand: a stepped stone plinth with its team's paint round the top, where the block sits.
  const stand = variants((i) => {
    const t = SIM.TEAMS[i];
    return merge(
      bevelBox({ w: 1.6, h: 0.3, d: 1.6, color: "#6e655c", offset: { y: 0.15 } }),
      bevelBox({ w: 1.1, h: 0.5, d: 1.1, color: "#8a8178", offset: { y: 0.55 } }),
      box({ w: 1.16, h: 0.08, d: 1.16, color: TEAM[t].paint, emissive: 0.5, offset: { y: 0.8 } })
    );
  });
  // The block: an orange cube with darker edges and a cream ₿ standing proud on four faces, lit from inside. It
  // centres on its own origin so it can turn and bob; `trim` is the team colour of the band round its middle.
  const SIZE = 0.62;
  const glyphFace = (parts, turn) => {
    const u = SIZE * 0.07, h = SIZE / 2 + 0.012;
    for (let r = 0; r < GLYPH.length; r++) for (let c = 0; c < GLYPH[r].length; c++) {
      if (GLYPH[r][c] !== "#") continue;
      // Negated so the glyph reads the right way round from outside each face.
      const lx = (3 - c) * u, ly = (4 - r) * u;
      const x = Math.cos(turn) * lx + Math.sin(turn) * h, z = -Math.sin(turn) * lx + Math.cos(turn) * h;
      parts.push(box({ w: Math.abs(Math.cos(turn)) > 0.5 ? u : 0.024, h: u, d: Math.abs(Math.cos(turn)) > 0.5 ? 0.024 : u, color: CREAM, emissive: 1, offset: { x, y: ly, z } }));
    }
  };
  // A team's block: a cube in its team's colour, glowing, with darker edges, a cream ₿ standing proud on four faces and
  // a band of Bitcoin orange round its foot, so the two sides' blocks never look alike.
  const block = variants((i) => {
    const t = SIM.TEAMS[i], parts = [], body = TEAM[t].paint, edge = TEAM[t].deep;
    parts.push(box({ w: SIZE, h: SIZE, d: SIZE, color: body, emissive: 0.85 }));
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) parts.push(box({ w: 0.06, h: SIZE + 0.02, d: 0.06, color: edge, emissive: 0.3, offset: { x: sx * SIZE / 2, z: sz * SIZE / 2 } }));
    for (const sy of [1, -1]) {
      parts.push(box({ w: SIZE + 0.02, h: 0.06, d: 0.06, color: edge, emissive: 0.3, offset: { y: sy * SIZE / 2, z: SIZE / 2 } }));
      parts.push(box({ w: SIZE + 0.02, h: 0.06, d: 0.06, color: edge, emissive: 0.3, offset: { y: sy * SIZE / 2, z: -SIZE / 2 } }));
      parts.push(box({ w: 0.06, h: 0.06, d: SIZE + 0.02, color: edge, emissive: 0.3, offset: { y: sy * SIZE / 2, x: SIZE / 2 } }));
      parts.push(box({ w: 0.06, h: 0.06, d: SIZE + 0.02, color: edge, emissive: 0.3, offset: { y: sy * SIZE / 2, x: -SIZE / 2 } }));
    }
    for (let k = 0; k < 4; k++) glyphFace(parts, k * Math.PI / 2);
    parts.push(box({ w: SIZE + 0.05, h: 0.05, d: SIZE + 0.05, color: ORANGE, emissive: 0.8, offset: { y: -SIZE / 2 + 0.06 } }));
    const geo = merge(...parts);
    geo.castShadow = false;
    return geo;
  });
  // The ring of ticks that spins round a dropped block so it is easy to find.
  const tick = cached(() => box({ w: 0.12, h: 0.04, d: 0.3, color: ORANGE, emissive: 1, offset: { z: 1.05 } }));
  // A paint ball, a small chunky cube in its team's colour.
  const ball = variants((i) => {
    const t = SIM.TEAMS[i], geo = merge(bevelBox({ w: 0.2, h: 0.2, d: 0.2, color: TEAM[t].paint, emissive: 0.7 }));
    geo.castShadow = false;
    return geo;
  });
  // A splat: a lumpy flat blot with drips, lying in the xz plane facing up; the scene turns and scales each.
  const splat = variants((i) => {
    const t = SIM.TEAMS[i % 2], geo = geometry(), rgb = hexToRgb(TEAM[t].paint), seed = 1 + i * 7;
    const blot = (cx, cz, r, n, j) => {
      const c = pushVert(geo, cx, 0, cz), ring = [];
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2, rr = r * (0.75 + 0.35 * Math.abs(Math.sin(a * (3 + j) + seed)));
        ring.push(pushVert(geo, cx + Math.sin(a) * rr, 0, cz + Math.cos(a) * rr));
      }
      for (let k = 0; k < n; k++) face(geo, [c, ring[k], ring[(k + 1) % n]], rgb, { emissive: 0.15 });
    };
    blot(0, 0, 0.45, 12, i % 3);
    for (let k = 0; k < 4; k++) {
      const a = k * 1.7 + seed, d = 0.55 + (k % 2) * 0.15;
      blot(Math.sin(a) * d, Math.cos(a) * d, 0.09 + (k % 3) * 0.03, 6, 0);
    }
    geo.castShadow = false;
    return geo;
  });
  // The ring under each Ooga's feet that says whose side they're on.
  const ring = variants((i) => {
    const t = SIM.TEAMS[i], parts = [];
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2;
      parts.push(moved(box({ w: 0.24, h: 0.03, d: 0.08, color: TEAM[t].paint, emissive: 0.8 }), Math.sin(a) * 0.55, 0.03, Math.cos(a) * 0.55));
    }
    const geo = merge(...parts);
    geo.castShadow = false;
    return geo;
  });
  // A quiz pad: a dark plate with a grid of green Matrix glyph cells and a glowing rim, flush with the ground.
  const GREEN = "#3dff7a";
  const pad = cached(() => {
    const parts = [box({ w: 1.7, h: 0.05, d: 1.7, color: "#0b1a10", offset: { y: 0.03 } })];
    for (const s of [-1, 1]) {
      parts.push(box({ w: 1.8, h: 0.08, d: 0.08, color: GREEN, emissive: 1, offset: { y: 0.05, z: s * 0.86 } }));
      parts.push(box({ w: 0.08, h: 0.08, d: 1.8, color: GREEN, emissive: 1, offset: { y: 0.05, x: s * 0.86 } }));
    }
    // A scatter of lit cells, the same every build.
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      if ((i * 7 + j * 3) % 4 === 0) continue;
      parts.push(box({ w: 0.16, h: 0.02, d: (i + j) % 3 ? 0.16 : 0.08, color: (i + j) % 2 ? GREEN : "#b8ffcf", emissive: 0.9, offset: { x: (i - 2) * 0.3, y: 0.065, z: (j - 2) * 0.3 } }));
    }
    const geo = merge(...parts);
    geo.castShadow = false;
    return geo;
  });
  // The quiz bubble round a trapped Ooga: a cage of glowing green bars, eight round and two rings, with a question
  // mark over it.
  const bubble = cached(() => {
    const parts = [], R = 0.85, H = 2.3;
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2;
      parts.push(box({ w: 0.05, h: H, d: 0.05, color: GREEN, emissive: 1, offset: { x: Math.sin(a) * R, y: H / 2, z: Math.cos(a) * R } }));
    }
    for (const y of [0.08, H]) for (let k = 0; k < 16; k++) {
      const a = (k + 0.5) / 16 * Math.PI * 2;
      parts.push(moved(turnedY(box({ w: R * 0.4, h: 0.05, d: 0.05, color: GREEN, emissive: 1 }), a), Math.sin(a) * R * 0.98, y, Math.cos(a) * R * 0.98));
    }
    for (const [x, y] of [[-1, 4], [0, 5], [1, 4], [1, 3], [0, 2], [0, 0]]) parts.push(box({ w: 0.11, h: 0.11, d: 0.11, color: "#b8ffcf", emissive: 1, offset: { x: x * 0.11, y: H + 0.35 + y * 0.11 } }));
    const geo = merge(...parts);
    geo.castShadow = false;
    return geo;
  });
  // A pushable crate: planked sides, darker battens, and a band of its team's paint, centred on its foot.
  const crate = variants((i) => {
    const t = SIM.TEAMS[i], h = SIM.CONFIG.CRATE_H, w = SIM.CONFIG.CRATE_HALF * 2, parts = [bevelBox({ w, h, d: w, color: "#9a6a3a", offset: { y: h / 2 } })];
    for (const s of [-1, 1]) {
      parts.push(box({ w: w + 0.02, h: 0.1, d: 0.1, color: "#5a3a22", offset: { y: h / 2, z: s * (w / 2 - 0.04) } }));
      parts.push(box({ w: 0.1, h: 0.1, d: w + 0.02, color: "#5a3a22", offset: { y: h / 2, x: s * (w / 2 - 0.04) } }));
    }
    parts.push(box({ w: w + 0.03, h: 0.12, d: w + 0.03, color: TEAM[t].paint, emissive: 0.2, offset: { y: h - 0.2 } }));
    return merge(...parts);
  });
  // Throws in flight: a grenade (a fat ball with a pale band), a rocket (a nose, a body in team paint and fins,
  // pointing along +z) and a net (a square of green cords).
  const grenade = variants((i) => {
    const t = SIM.TEAMS[i];
    const geo = merge(bevelBox({ w: 0.32, h: 0.32, d: 0.32, color: TEAM[t].paint, emissive: 0.6 }), box({ w: 0.34, h: 0.07, d: 0.34, color: TEAM[t].light, emissive: 0.8 }));
    geo.castShadow = false;
    return geo;
  });
  const rocket = variants((i) => {
    const t = SIM.TEAMS[i];
    const geo = merge(
      box({ w: 0.22, h: 0.22, d: 0.7, color: TEAM[t].paint, emissive: 0.5 }),
      box({ w: 0.16, h: 0.16, d: 0.18, color: "#f3efe4", emissive: 0.5, offset: { z: 0.42 } }),
      box({ w: 0.5, h: 0.04, d: 0.16, color: TEAM[t].deep, offset: { z: -0.3 } }),
      box({ w: 0.04, h: 0.5, d: 0.16, color: TEAM[t].deep, offset: { z: -0.3 } }),
      box({ w: 0.16, h: 0.16, d: 0.3, color: ORANGE, emissive: 1, offset: { z: -0.5 } })
    );
    geo.castShadow = false;
    return geo;
  });
  const net = cached(() => {
    const parts = [], n = 4, s = 0.9;
    for (let k = 0; k <= n; k++) {
      const o = -s / 2 + k * s / n;
      parts.push(box({ w: s, h: 0.03, d: 0.03, color: "#7fe08a", emissive: 0.5, offset: { z: o } }));
      parts.push(box({ w: 0.03, h: 0.03, d: s, color: "#7fe08a", emissive: 0.5, offset: { x: o } }));
    }
    const geo = merge(...parts);
    geo.castShadow = false;
    return geo;
  });
  // A net draped over a caught Ooga: cords down its sides and across its top.
  const draped = cached(() => {
    const parts = [], R = 0.5, H = 1.9;
    for (let k = 0; k < 10; k++) {
      const a = k / 10 * Math.PI * 2;
      parts.push(box({ w: 0.03, h: H, d: 0.03, color: "#7fe08a", emissive: 0.4, offset: { x: Math.sin(a) * R, y: H / 2, z: Math.cos(a) * R } }));
    }
    for (const y of [0.5, 1.1, 1.7]) for (let k = 0; k < 10; k++) {
      const a = (k + 0.5) / 10 * Math.PI * 2;
      parts.push(moved(turnedY(box({ w: R * 0.65, h: 0.03, d: 0.03, color: "#7fe08a", emissive: 0.4 }), a), Math.sin(a) * R * 0.95, y, Math.cos(a) * R * 0.95));
    }
    parts.push(moved(merge(net()), 0, H, 0));
    const geo = merge(...parts);
    geo.castShadow = false;
    return geo;
  });
  // A rain streak, a thin pale bar the scene leans with the wind.
  const streak = cached(() => {
    const geo = box({ w: 0.025, h: 0.5, d: 0.025, color: "#c8d8ff", emissive: 0.4 });
    geo.castShadow = false;
    return geo;
  });
  // The guns, each in its own frame with the grip at the origin and the muzzle along +z, in team colours (variants by
  // team): a paintball marker with a hopper, a chunky grenade launcher with a drum, a big shoulder rocket launcher, a
  // net gun with a flared mouth and a long sniper rifle with a scope.
  const GUNS = ["paint", "grenade", "rocket", "net", "sniper"];
  const METAL = "#3a3a40", DARK = "#24242a";
  const gun = variants((i) => {
    const kind = GUNS[i >> 1], t = SIM.TEAMS[i & 1], c = TEAM[t], parts = [];
    const grip = () => parts.push(box({ w: 0.07, h: 0.18, d: 0.09, color: DARK, offset: { y: -0.08, z: -0.02 } }));
    if (kind === "paint") {
      grip();
      parts.push(bevelBox({ w: 0.1, h: 0.12, d: 0.36, color: METAL, offset: { y: 0.03, z: 0.08 } }));
      parts.push(box({ w: 0.05, h: 0.05, d: 0.32, color: DARK, offset: { y: 0.05, z: 0.4 } }));
      parts.push(bevelBox({ w: 0.16, h: 0.16, d: 0.18, color: c.paint, emissive: 0.4, offset: { y: 0.17, z: 0.06 } }));
      parts.push(box({ w: 0.06, h: 0.07, d: 0.16, color: c.deep, offset: { y: 0.0, z: -0.16 } }));
    } else if (kind === "grenade") {
      grip();
      parts.push(bevelBox({ w: 0.14, h: 0.14, d: 0.4, color: "#4a4a3a", offset: { y: 0.04, z: 0.1 } }));
      parts.push(bevelBox({ w: 0.2, h: 0.2, d: 0.2, color: c.deep, offset: { y: 0.0, z: 0.02 } }));
      parts.push(box({ w: 0.15, h: 0.15, d: 0.24, color: DARK, offset: { y: 0.06, z: 0.38 } }));
      parts.push(box({ w: 0.17, h: 0.04, d: 0.05, color: c.paint, emissive: 0.6, offset: { y: 0.06, z: 0.5 } }));
    } else if (kind === "rocket") {
      // Sits on the shoulder: the grip under its middle, a long fat tube with a sight and an orange warhead peeping out.
      parts.push(box({ w: 0.07, h: 0.16, d: 0.09, color: DARK, offset: { y: -0.12, z: 0.05 } }));
      parts.push(bevelBox({ w: 0.24, h: 0.24, d: 1.25, color: c.deep, offset: { y: 0.04, z: 0.1 } }));
      parts.push(box({ w: 0.27, h: 0.27, d: 0.12, color: c.paint, emissive: 0.4, offset: { y: 0.04, z: 0.68 } }));
      parts.push(box({ w: 0.27, h: 0.27, d: 0.12, color: METAL, offset: { y: 0.04, z: -0.5 } }));
      parts.push(box({ w: 0.14, h: 0.14, d: 0.1, color: ORANGE, emissive: 1, offset: { y: 0.04, z: 0.74 } }));
      parts.push(box({ w: 0.05, h: 0.1, d: 0.14, color: DARK, offset: { x: 0.1, y: 0.2, z: 0.25 } }));
    } else if (kind === "net") {
      grip();
      parts.push(bevelBox({ w: 0.12, h: 0.12, d: 0.34, color: "#3f5a3a", offset: { y: 0.04, z: 0.08 } }));
      parts.push(box({ w: 0.3, h: 0.3, d: 0.08, color: "#7fe08a", emissive: 0.5, offset: { y: 0.04, z: 0.32 } }));
      parts.push(box({ w: 0.2, h: 0.2, d: 0.1, color: "#5a8a52", offset: { y: 0.04, z: 0.26 } }));
      for (const [x, y] of [[-0.13, -0.09], [0.13, -0.09], [-0.13, 0.17], [0.13, 0.17]]) parts.push(box({ w: 0.04, h: 0.04, d: 0.04, color: "#c9b48a", offset: { x, y, z: 0.37 } }));
    } else {
      // The sniper rifle: a long stock and barrel, a team-coloured scope with glowing lenses.
      grip();
      parts.push(bevelBox({ w: 0.08, h: 0.1, d: 0.5, color: "#6a4a2a", offset: { y: 0.03, z: -0.12 } }));
      parts.push(bevelBox({ w: 0.09, h: 0.1, d: 0.42, color: METAL, offset: { y: 0.04, z: 0.3 } }));
      parts.push(box({ w: 0.04, h: 0.04, d: 0.62, color: DARK, offset: { y: 0.05, z: 0.8 } }));
      parts.push(box({ w: 0.07, h: 0.07, d: 0.34, color: c.paint, emissive: 0.3, offset: { y: 0.15, z: 0.28 } }));
      parts.push(box({ w: 0.05, h: 0.05, d: 0.02, color: "#bfe8ff", emissive: 1, offset: { y: 0.15, z: 0.46 } }));
    }
    return merge(...parts);
  });
  // A tower's ladder: two rails and rungs up the gap side to the platform, in the tower's own frame (+x away from it).
  const ladder = cached(() => {
    const parts = [], z0 = -0.5, z1 = 0.5;
    for (const z of [z0, z1]) parts.push(box({ w: 0.08, h: TOP + 0.9, d: 0.08, color: "#5a3a22", offset: { y: (TOP + 0.9) / 2, z } }));
    for (let y = 0.35; y < TOP; y += 0.4) parts.push(box({ w: 0.06, h: 0.06, d: z1 - z0, color: "#8a6440", offset: { y, z: 0 } }));
    return merge(...parts);
  });
  // The rifle rack on a tower's platform: a low crossbar with a rifle on it.
  const rack = variants((i) => merge(
    box({ w: 0.08, h: 0.7, d: 0.08, color: "#5a3a22", offset: { x: -0.35, y: 0.35 } }), box({ w: 0.08, h: 0.7, d: 0.08, color: "#5a3a22", offset: { x: 0.35, y: 0.35 } }),
    box({ w: 0.8, h: 0.06, d: 0.1, color: "#8a6440", offset: { y: 0.6 } }),
    moved(turnedY(gun(8 + i), Math.PI / 2), 0, 0.7, 0)
  ));
  // A zipline: a cable sagging a little between its anchors, in the team's colour, and a pole at the low end.
  const zipline = variants((i) => {
    const z = A.zips[SIM.TEAMS[i]], c = TEAM[SIM.TEAMS[i]];
    const cable = tube({ path: (t) => ({ x: z.ax + (z.bx - z.ax) * t, y: z.ay + (z.by - z.ay) * t + 0.15, z: z.az + (z.bz - z.az) * t }), radius: () => 0.04, rings: 24, segments: 4, colorFn: () => c.light, emissive: 0.5 });
    return merge(cable,
      box({ w: 0.16, h: z.by + 0.4, d: 0.16, color: "#5a3a22", offset: { x: z.bx, y: (z.by + 0.4) / 2, z: z.bz } }),
      box({ w: 0.3, h: 0.3, d: 0.3, color: c.paint, emissive: 0.6, offset: { x: z.ax, y: z.ay + 0.15, z: z.az } }));
  });
  // A rider's trolley: a pulley block on the cable with a hand bar under it.
  const trolley = cached(() => merge(box({ w: 0.14, h: 0.18, d: 0.3, color: METAL, offset: { y: 0.1 } }), box({ w: 0.6, h: 0.05, d: 0.05, color: DARK, offset: { y: -0.15 } }), box({ w: 0.04, h: 0.3, d: 0.04, color: DARK, offset: { y: 0 } })));
  // An ammo cache: an olive box with an orange band and a glowing lid while it's ready; grey and dark while it rests.
  const cache = variants((i) => {
    const ready = i === 0;
    return merge(
      bevelBox({ w: 0.8, h: 0.45, d: 0.55, color: ready ? "#56603a" : "#4a4844", offset: { y: 0.23 } }),
      box({ w: 0.82, h: 0.08, d: 0.57, color: ready ? ORANGE : "#6a6660", emissive: ready ? 0.9 : 0, offset: { y: 0.3 } }),
      box({ w: 0.5, h: 0.05, d: 0.3, color: ready ? "#fff3a0" : "#5a5852", emissive: ready ? 1 : 0, offset: { y: 0.48 } })
    );
  });
  // A trampoline flush with the ground: a dark frame ring on stubby legs, springs, and an orange-and-black mat.
  const tramp = cached(() => {
    const parts = [], R = SIM.CONFIG.TRAMP_R + 0.15, n = 16;
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2, x = Math.sin(a), z = Math.cos(a);
      parts.push(box({ w: 0.42, h: 0.14, d: 0.16, color: "#2a2a30", offset: { x: x * R, y: 0.07, z: z * R } }));
      parts.push(box({ w: 0.05, h: 0.05, d: 0.2, color: "#c9ced6", offset: { x: x * (R - 0.15), y: 0.12, z: z * (R - 0.15) } }));
    }
    // The mat: rings of black and orange.
    for (let k = 0; k < 4; k++) {
      const r = SIM.CONFIG.TRAMP_R * (1 - k * 0.24);
      parts.push(box({ w: r * 1.7, h: 0.03, d: r * 1.7, color: k % 2 ? ORANGE : "#18181c", emissive: k % 2 ? 0.5 : 0, offset: { y: 0.1 + k * 0.004 } }));
    }
    return merge(...parts);
  });
  BL.blockModels = { tramp, TEAM, ORANGE, GUNS, arena, stand, block, tick, ball, splat, ring, pad, bubble, crate, grenade, rocket, net, draped, streak, gun, ladder, rack, zipline, trolley, cache, SPLATS: 6 };
})();
