// The Lightning Jet Hangar's geometry: the long rock hall behind the Lightning Factory's door at the end of its left
// walkway, as its concept draws it. A timber landing inside the door with steps down to the runway, which runs down the
// middle of the floor and on through the launch tunnel's octagonal frames, each lined with blue neon, to the launch
// shield at its far end, sealed until Jet v2 flies, the sky beyond. Iron gantries cross the vault hung with lanterns and
// the bolt's royal-blue banners; timber catwalks run along both side walls on brackets, a stair up to each from the
// back; on the right the Jet stands docked beside the runway, nose to the tunnel, with a scaffold and stair up its left
// flank to the cockpit; on the left the mechanics' benches with their blue screens, and on the wall above them the two
// boards, the repository's stats right after the door and its timeline farther in. The Jet here is its box-out, to the
// size `jet-models.js` will build it at; the boards' faces are the scene's.
//
// `LAYOUT` is the one table of where everything stands, read by the scene too. The hangar's frame: +z runs back out
// through the door to the hall, x to the right looking in, y 0 the floor. `supportAt`, `clearAt` and `walkable` are the
// floor an Ooga walks, layered as the Factory's is; they allocate nothing.
(() => {
  "use strict";
  const BL = window.BL = window.BL || {};
  const { models, math } = BL;
  const FM = BL.factoryModels;
  const { cached, box, bevelBox, merge, noShadow, moved, turnedX, turnedY, turnedZ, beam, lathe, prism, shaded, deckParts, stairParts } = models;
  const { mulberry32 } = math;
  const TAU = Math.PI * 2;

  const STONE = ["#5b4a3e", "#524238", "#66544a", "#4a3d34"], STONE_DK = "#3a2f28", IRON = "#4a4d52", IRON_DK = "#2c2e33";
  const TIMBER = "#8a5a32", TIMBER_LT = "#a8703e", TIMBER_DK = "#5c3a1e";
  const RUNWAY = "#23262d", PAINT = "#ffd23a", MARKER = "#6fc8ff", NEON = "#3fa8ff", SCREEN = "#2f7fd8";
  // The Jet's livery, for its box-out and the hangar's banners and signs.
  const LIVERY = { body: "#e9edf3", blue: "#2443a8", gold: "#ffc83a", glass: "#1b2f5e", engine: "#6fc8ff" };

  const LAYOUT = {
    HALL: { halfW: 20, back: -34, front: 30, h: 18 },
    // The door back to the hall in the front wall, its sill on the landing: its shield's opening and plane, as the
    // Factory's side of it has them.
    door: { x: 0, y: 1.5, z: 30, turn: Math.PI, half: FM.HANGAR_DOOR.half, top: FM.HANGAR_DOOR.top, plane: FM.HANGAR_DOOR.plane },
    // The landing inside the door, a deck (centre, top, width and depth), and its steps down to the runway, [x, y, z] at
    // the foot and at the head and the width.
    landing: { x: 0, y: 1.5, z: 27.5, w: 9, d: 5 },
    steps: [0, 0, 21.2, 0, 1.5, 25, 6],
    // The runway's paint from the steps' foot to the hold-short line before the launch shield, and its half-width.
    runway: { halfW: 5, z0: 21, z1: -82.8 },
    // The launch tunnel: octagonal frames of radius `r` round a centre `y` up, every `step` metres from the back wall to
    // the shield; walkers stop at `holdShort`, the hazard bar's line.
    tunnel: { y: 5, r: 7, z0: -34, z1: -84, step: 5, holdShort: -82.8 },
    // The catwalks along both side walls at the gantries' feet, decks [x0, x1, z0, z1], and the stairs up to their back
    // ends; and the iron gantries across the vault, by z, at the height they run.
    catwalkY: 7.5, catwalks: [[-17, -14.6, -20, 24], [14.6, 17, -20, 24]],
    catwalkStairs: [[-15.8, 0, -31.5, -15.8, 7.5, -20, 1.6], [15.8, 0, -31.5, 15.8, 7.5, -20, 1.6]],
    gantries: [22, 14, 6, -2, -10, -18, -26], gantryY: 15,
    // The Jet's dock right of the runway, nose to the tunnel: where its box-out stands on the floor, and the box-out's
    // length, span and height (the size `jet-models.js` builds to). The scaffold's deck beside the cockpit and the
    // stair up to it from in front of the nose.
    jet: { x: 11, z: -4, length: 18, span: 12, height: 8 },
    jetDeck: { x: 7.95, y: 3.4, z: -9, w: 2.7, d: 4 },
    jetStairs: [7.4, 0, -16.5, 7.4, 3.4, -11, 1.6],
    // The mechanics' benches on the left, [x, z] each, and crates about the floor, [x, z, turn].
    benches: [[-10.5, 18], [-14, 11], [-10.5, 4], [-14, -3], [-10.5, -10], [-14, -17]],
    crates: [[-8, 15, 0.2], [-8.4, 14.2, -0.3], [-15.8, 7.4, 0.5], [-8, -1, 0.1], [-15.6, -13, -0.2], [15.8, 9, 0.3], [16, 8.1, -0.4], [15.6, -14, 0], [5.9, -17.5, 0.3], [6, 8.5, -0.2]],
    toolChest: { x: 6.1, z: -3.5 },
    // The two boards on the left wall under the catwalk: the repository's stats right after the door, turned a little
    // toward it, and its timeline farther in; centre, width and height, and the way each faces.
    boards: {
      stats: { x: -16.4, y: 4.5, z: 16, w: 9, h: 4, turn: Math.PI / 2 - 0.44 },
      timeline: { x: -17.4, y: 4.5, z: -2, w: 11, h: 4, turn: Math.PI / 2 }
    },
    // The signs: the hangar's over the runway from the last gantry, the right wall's call to work, the plaque by the dock.
    signs: { hangar: [0, 11.6, -26], work: [16.6, 10.6, 12], soon: [13.6, 2.4, 7.4] },
    // The far islet seen through the launch shield, past the tunnel's end.
    isle: { x: 7, y: 9, z: -240, r: 11 }
  };

  // ---- the hall -------------------------------------------------------------------------------------------------

  // The chamber: a floor of stone tiles, craggy walls of stacked blocks leaning in as they rise, a vault of slabs, and
  // behind it all a dark backing, so the sky the launch tunnel lets in never shows between two blocks. The back wall
  // leaves the tunnel's mouth open, the front the door's over the landing.
  const shell = cached(() => {
    const { halfW: W, back: B, front: F, h: H } = LAYOUT.HALL, d = LAYOUT.door, t = LAYOUT.tunnel, rand = mulberry32(5150), rock = [], vault = [];
    for (let x = -W; x < W; x += 4) for (let z = B; z < F; z += 4) {
      rock.push(box({ w: 4, h: 0.4, d: 4, color: STONE[Math.floor(rand() * 4)], offset: { x: x + 2, y: -0.2 - rand() * 0.06, z: z + 2 } }));
    }
    // A wall of blocks from u0 to u1 along it, each set in by the lean and a little heave; `put` lays one.
    const wall = (u0, u1, open, put) => {
      for (let u = u0; u < u1; u += 2) for (let y = 0; y < H + 1; y += 2) {
        if (open(u + 1, y + 1)) continue;
        const depth = 0.4 + (y + 1) / H * 2.6 + rand() * 0.9;
        put(u + 1, y + 1, depth, STONE[Math.floor(rand() * 4)]);
      }
    };
    const block = (color, x, y, z) => rock.push(bevelBox({ w: 2.2, h: 2.2, d: 2.2, color, bevel: 0.18, offset: { x, y, z } }));
    const none = () => false, octagon = (u, y) => Math.hypot(u, y - t.y) < t.r + 0.4;
    wall(B, F, none, (u, y, depth, color) => block(color, -W + depth - 1.1, y, u));
    wall(B, F, none, (u, y, depth, color) => block(color, W - depth + 1.1, y, u));
    wall(-W, W, octagon, (u, y, depth, color) => block(color, u, y, B + depth - 1.1));
    wall(-W, W, (u, y) => Math.abs(u - d.x) < 4.3 && y > d.y - 0.5 && y < d.y + 7.8, (u, y, depth, color) => block(color, u, y, F - depth + 1.1));
    for (let x = -W; x < W; x += 5) for (let z = B; z < F; z += 5) vault.push(box({ w: 5.4, h: 2, d: 5.4, color: STONE[Math.floor(rand() * 4)], offset: { x: x + 2.5, y: H + rand() * 1.2, z: z + 2.5 } }));
    const back = [
      box({ w: 1, h: H + 4, d: F - B + 4, color: STONE_DK, offset: { x: -W - 1.2, y: H / 2, z: (B + F) / 2 } }),
      box({ w: 1, h: H + 4, d: F - B + 4, color: STONE_DK, offset: { x: W + 1.2, y: H / 2, z: (B + F) / 2 } }),
      box({ w: 2 * W + 4, h: H + 4, d: 1, color: STONE_DK, offset: { y: H / 2, z: F + 1.6 } }),
      box({ w: 2 * W + 4, h: 1, d: F - B + 4, color: STONE_DK, offset: { y: H + 3, z: (B + F) / 2 } })
    ];
    // The back wall's backing leaves the tunnel's mouth, in four slabs round it.
    const mw = t.r + 0.6;
    back.push(box({ w: W - mw + 2, h: H + 4, d: 1, color: STONE_DK, offset: { x: -(W + mw + 2) / 2, y: H / 2, z: B - 1.6 } }), box({ w: W - mw + 2, h: H + 4, d: 1, color: STONE_DK, offset: { x: (W + mw + 2) / 2, y: H / 2, z: B - 1.6 } }));
    back.push(box({ w: 2 * mw, h: H + 4 - (t.y + mw), d: 1, color: STONE_DK, offset: { y: (H + 4 + t.y + mw) / 2 - 2, z: B - 1.6 } }));
    return { rock: merge(...rock), vault: merge(...vault), backing: merge(...back) };
  });

  // The landing inside the door: timber planks on posts, railed down both sides and along its front but for its steps,
  // which come down to the runway between heavy stringers.
  const landing = cached(() => {
    const l = LAYOUT.landing, [sx, , sz0, , sy1, sz1, sw] = LAYOUT.steps, geos = [];
    const place = (parts, x, y, z) => { for (const g of parts) geos.push(moved(g, x, y, z)); };
    place(deckParts(l.w, l.d, l.y, "new", 29, [[sx - l.x, sz1 - l.z, sw / 2 + 0.05, 0, -1]]), l.x, l.y, l.z);
    geos.push(...stairParts(sx, 0, sz0, sx, sy1, sz1, sw, [true, false]));
    return merge(...geos);
  });

  // The runway: dark panels between twin yellow centre lines, yellow and black bands across it every eight metres and
  // at the hold-short line, chevrons before the shield, and blue marker lamps along both edges, the length of the floor
  // and on through the tunnel. The lamps glow, so they are their own mesh.
  const runway = cached(() => {
    const r = LAYOUT.runway, flat = [], glow = [], len = r.z0 - r.z1, mid = (r.z0 + r.z1) / 2;
    flat.push(box({ w: r.halfW * 2, h: 0.04, d: len, color: RUNWAY, offset: { y: 0.02, z: mid } }));
    for (const x of [-0.18, 0.18]) flat.push(box({ w: 0.12, h: 0.02, d: len - 1, color: PAINT, offset: { x, y: 0.05, z: mid } }));
    const band = (z, d = 0.5) => {
      for (let k = 0; k < 10; k++) flat.push(box({ w: r.halfW * 0.2 - 0.02, h: 0.02, d, color: k % 2 ? "#141414" : PAINT, offset: { x: -r.halfW + (k + 0.5) * r.halfW * 0.2, y: 0.05, z } }));
    };
    for (let z = r.z0 - 4; z > r.z1 + 6; z -= 8) band(z);
    band(r.z1 + 0.35, 0.7);
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
      const z = r.z1 + 2 + k * 1.2;
      flat.push(moved(turnedY(box({ w: 2.4, h: 0.02, d: 0.35, color: PAINT }), s * 0.6), s * 1.1, 0.05, z));
    }
    for (let z = r.z0 - 1; z > r.z1; z -= 3) for (const s of [-1, 1]) {
      flat.push(box({ w: 0.3, h: 0.08, d: 0.3, color: IRON_DK, offset: { x: s * (r.halfW + 0.2), y: 0.04, z } }));
      glow.push(box({ w: 0.18, h: 0.1, d: 0.18, color: MARKER, emissive: 1, offset: { x: s * (r.halfW + 0.2), y: 0.12, z } }));
    }
    return { flat: merge(...flat), glow: noShadow(merge(...glow)) };
  });

  // The launch tunnel from the back wall to the shield: a stone sleeve, floored, walled and roofed, and inside it an
  // octagonal iron frame every few metres, the mouth's heaviest, each with a neon strip round its inside; the hazard bar
  // across the hold-short line. The neon glows, so it is its own mesh.
  const tunnel = cached(() => {
    const t = LAYOUT.tunnel, iron = [], stone = [], glow = [], len = t.z0 - t.z1, mid = (t.z0 + t.z1) / 2, half = t.r + 0.4;
    stone.push(box({ w: half * 2 + 1, h: 0.4, d: len + 0.4, color: STONE[3], offset: { y: -0.2, z: mid } }));
    for (const s of [-1, 1]) stone.push(box({ w: 0.6, h: t.y + t.r + 0.6, d: len, color: STONE_DK, offset: { x: s * (half + 0.3), y: (t.y + t.r) / 2, z: mid } }));
    stone.push(box({ w: half * 2 + 1.2, h: 0.6, d: len, color: STONE_DK, offset: { y: t.y + t.r + 0.3, z: mid } }));
    for (let z = t.z0 + 0.6, i = 0; z >= t.z1; z -= t.step, i++) {
      const heavy = i === 0, w = heavy ? 0.7 : 0.42;
      for (let k = 0; k < 8; k++) {
        const a0 = TAU * (k + 0.5) / 8, a1 = TAU * (k + 1.5) / 8;
        const ax = Math.cos(a0) * t.r, ay = t.y + Math.sin(a0) * t.r, bx = Math.cos(a1) * t.r, by = t.y + Math.sin(a1) * t.r;
        if (ay < 0 && by < 0) continue;
        const cut = (px, py, qx, qy) => py >= 0 ? [px, py] : [px + (qx - px) * (-py) / (qy - py), 0];
        const [cx0, cy0] = cut(ax, ay, bx, by), [cx1, cy1] = cut(bx, by, ax, ay);
        iron.push(beam(cx0, cy0, z, cx1, cy1, z, w, heavy ? IRON : IRON_DK));
        const n = 0.93;
        glow.push(beam(cx0 * n, t.y + (cy0 - t.y) * n, z + w / 2 + 0.04, cx1 * n, t.y + (cy1 - t.y) * n, z + w / 2 + 0.04, 0.12, NEON, 1));
      }
    }
    // The hazard bar across the hold-short line: a striped beam on two posts.
    const hs = t.holdShort - 0.4;
    for (const s of [-1, 1]) iron.push(box({ w: 0.2, h: 1.1, d: 0.2, color: IRON_DK, offset: { x: s * 5.6, y: 0.55, z: hs } }));
    for (let k = 0; k < 14; k++) iron.push(box({ w: 0.8, h: 0.22, d: 0.18, color: k % 2 ? "#141414" : PAINT, offset: { x: -5.6 + (k + 0.5) * 0.8, y: 1.05, z: hs } }));
    return { iron: merge(...iron), stone: merge(...stone), glow: noShadow(merge(...glow)) };
  });

  // Far off past the shield, a floating islet in the open sky: rock tapering to a point under a green crown and a tree,
  // lit a little of itself as daylight would at that distance.
  const isle = cached(() => {
    const s = LAYOUT.isle, r = s.r;
    return noShadow(moved(merge(
      lathe({ profile: [[0, -r * 1.5], [r * 0.5, -r * 0.9], [r * 0.9, -r * 0.3], [r, 0], [0, 0]], segments: 9, color: "#6a5646", emissive: 0.3 }),
      lathe({ profile: [[r * 1.02, 0], [r * 0.9, r * 0.12], [0, r * 0.16]], segments: 9, color: "#4f9a3a", emissive: 0.35 }),
      moved(lathe({ profile: [[0.6, 0], [0.4, r * 0.4], [0, r * 0.42]], segments: 6, color: "#6b4a2a", emissive: 0.3 }), r * 0.2, r * 0.1, 0),
      moved(lathe({ profile: [[r * 0.34, 0], [r * 0.22, r * 0.3], [0, r * 0.46]], segments: 7, color: "#3f8a35", emissive: 0.35 }), r * 0.2, r * 0.42, 0)
    ), s.x, s.y, s.z));
  });

  // The catwalks along the side walls: plank decks bracketed into the rock (no posts to stand in front of the boards
  // below), railed along the hall side and across both ends but where the stair comes up, and the stairs up to them.
  const catwalks = cached(() => {
    const L = LAYOUT, y = L.catwalkY, geos = [], B = L.boards;
    const place = (parts, x, py, z) => { for (const g of parts) geos.push(moved(g, x, py, z)); };
    const underBoard = (x, z) => Object.values(B).some((b) => Math.sign(b.x) === Math.sign(x) && Math.abs(z - b.z) < b.w / 2 + 0.4);
    L.catwalks.forEach(([x0, x1, z0, z1], i) => {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, side = Math.sign(cx), [sx, , , , , sz1, sw] = L.catwalkStairs[i];
      // The rails: the hall side and both ends; the wall side is the rock.
      const rails = side < 0 ? "nse" : "nsw";
      place(deckParts(x1 - x0, z1 - z0, 0, rails, 31 + i, [[sx - cx, sz1 - cz, sw / 2 + 0.05, 0, -1]]), cx, y, cz);
      const wall = side * (L.HALL.halfW - 1.4), edge = side < 0 ? x1 - 0.2 : x0 + 0.2;
      for (let z = z0 + 1.5; z < z1 - 1; z += 4) {
        if (underBoard(edge, z)) continue;
        geos.push(beam(wall, y - 2.6, z, edge, y - 0.6, z, 0.18, TIMBER_DK), beam(wall, y - 0.55, z, edge, y - 0.55, z, 0.22, TIMBER_DK));
      }
    });
    for (const [ax, ay, az, bx, by, bz, w] of L.catwalkStairs) geos.push(...stairParts(ax, ay, az, bx, by, bz, w, [true, false]));
    return merge(...geos);
  });

  // The gantries across the vault on knee braces into the walls, the lanterns hung from them and on posts along the
  // runway, and the bolt's banners: down both walls, and hung from the gantries over the floor facing the door.
  const lamps = () => {
    const L = LAYOUT, out = [];
    for (const z of L.gantries) for (const x of [-12, -4, 4, 12]) out.push(["hang", x, L.gantryY - 0.3, z]);
    // None on the right under the Jet's wing or by its scaffold.
    for (let z = L.runway.z0 - 5; z > L.HALL.back + 4; z -= 9) for (const s of [-1, 1]) if (s < 0 || z > 4 || z < -19) out.push(["post", s * (L.runway.halfW + 1.6), 0, z, s < 0 ? 0 : Math.PI]);
    out.push(["post", -4, LAYOUT.landing.y, 25.4, 0], ["post", 4, LAYOUT.landing.y, 25.4, Math.PI]);
    return out;
  };
  const dressing = cached(() => {
    const L = LAYOUT, W = L.HALL.halfW, iron = [], banners = [];
    for (const z of L.gantries) {
      iron.push(box({ w: W * 2 - 4, h: 0.6, d: 0.5, color: IRON, offset: { y: L.gantryY, z } }));
      for (const x of [-14, -8, 0, 8, 14]) iron.push(box({ w: 0.12, h: 0.7, d: 0.54, color: IRON_DK, offset: { x, y: L.gantryY, z } }));
      for (const s of [-1, 1]) iron.push(beam(s * (W - 3.2), L.gantryY - 3, z, s * (W - 1.8), L.gantryY - 0.3, z, 0.32, IRON_DK));
    }
    for (const z of [20, 10, 0, -10, -22]) for (const s of [-1, 1]) {
      banners.push(moved(turnedY(merge(FM.banner(3)), -s * Math.PI / 2), s * (W - 3.4), 12.6, z));
    }
    for (const z of [10, -6, -22]) for (const x of [-9, 9]) banners.push(moved(merge(FM.banner(2.6)), x, L.gantryY - 0.35, z + 0.35));
    const hung = FM.lanterns(lamps(), []);
    return { iron: merge(...iron), banners: merge(...banners), frame: hung.frame, glass: hung.glass, lights: hung.lights };
  });

  // The mechanics' benches: a timber desk on four legs, a monitor whose blue screen glows, a keyboard and a lamp; and
  // the crates and the red tool chest about the floor. Screens glow, so they are their own mesh.
  const benches = cached(() => {
    const L = LAYOUT, flat = [], glow = [];
    for (const [x, z] of L.benches) {
      flat.push(bevelBox({ w: 1.9, h: 0.08, d: 0.9, color: TIMBER_LT, bevel: 0.02, offset: { x, y: 0.8, z } }));
      for (const dx of [-0.85, 0.85]) for (const dz of [-0.35, 0.35]) flat.push(box({ w: 0.08, h: 0.78, d: 0.08, color: TIMBER_DK, offset: { x: x + dx, y: 0.39, z: z + dz } }));
      for (const [dx, w] of [[-0.4, 0.72], [0.45, 0.6]]) {
        flat.push(box({ w, h: 0.48, d: 0.06, color: IRON_DK, offset: { x: x + dx, y: 1.14, z: z - 0.25 } }), box({ w: 0.08, h: 0.12, d: 0.08, color: IRON_DK, offset: { x: x + dx, y: 0.88, z: z - 0.25 } }));
        glow.push(box({ w: w - 0.08, h: 0.4, d: 0.02, color: SCREEN, emissive: 0.95, offset: { x: x + dx, y: 1.14, z: z - 0.21 } }));
      }
      flat.push(box({ w: 0.5, h: 0.03, d: 0.18, color: "#1d1f24", offset: { x, y: 0.85, z: z + 0.12 } }));
    }
    for (const [x, z, a] of L.crates) {
      flat.push(moved(turnedY(bevelBox({ w: 0.9, h: 0.8, d: 0.9, color: TIMBER, bevel: 0.05 }), a), x, 0.4, z));
      for (const y of [0.16, 0.64]) flat.push(moved(turnedY(box({ w: 0.92, h: 0.06, d: 0.92, color: TIMBER_DK }), a), x, y, z));
    }
    const c = L.toolChest;
    flat.push(bevelBox({ w: 0.95, h: 1.05, d: 0.6, color: "#b3261e", bevel: 0.04, offset: { x: c.x, y: 0.6, z: c.z } }));
    for (let k = 0; k < 4; k++) flat.push(box({ w: 0.82, h: 0.02, d: 0.02, color: "#e8e8e8", offset: { x: c.x, y: 0.3 + k * 0.22, z: c.z + 0.31 } }));
    for (const dx of [-0.36, 0.36]) flat.push(box({ w: 0.08, h: 0.08, d: 0.08, color: "#1d1f24", offset: { x: c.x + dx, y: 0.04, z: c.z } }));
    return { flat: merge(...flat), glow: noShadow(merge(...glow)) };
  });

  // The boards' frames on the left wall: a dark screen in a blue light frame on iron brackets. The scene lays each
  // board's face over its screen.
  const boardFrame = (w, h) => {
    const flat = [], glow = [];
    flat.push(bevelBox({ w: w + 0.4, h: h + 0.4, d: 0.16, color: IRON_DK, bevel: 0.04, offset: { z: -0.1 } }));
    for (const [bw, bh, x, y] of [[w + 0.24, 0.08, 0, h / 2 + 0.08], [w + 0.24, 0.08, 0, -h / 2 - 0.08], [0.08, h + 0.24, w / 2 + 0.08, 0], [0.08, h + 0.24, -w / 2 - 0.08, 0]]) {
      glow.push(box({ w: bw, h: bh, d: 0.05, color: "#5fb8ff", emissive: 1, offset: { x, y, z: 0.01 } }));
    }
    for (const x of [-w / 3, w / 3]) flat.push(box({ w: 0.12, h: 0.12, d: 1.2, color: IRON_DK, offset: { x, y: h / 2 - 0.3, z: -0.7 } }));
    return { flat: merge(...flat), glow: noShadow(merge(...glow)) };
  };
  const boardFrames = cached(() => ({ stats: boardFrame(LAYOUT.boards.stats.w, LAYOUT.boards.stats.h), timeline: boardFrame(LAYOUT.boards.timeline.w, LAYOUT.boards.timeline.h) }));

  // ---- the Jet's box-out and its dock ---------------------------------------------------------------------------

  // The Jet as a box-out at the size `jet-models.js` will build it: a white fuselage turned on its length with a dark
  // canopy, swept wings and tailplanes in the livery's blue, a blue fin with the bolt on both faces, twin engines whose
  // exhausts glow, and its gear. In the Jet's frame: nose to -z, the origin on the floor under its middle.
  const jetBoxOut = cached(() => {
    const flat = [], round = [], glow = [], cy = 3, L = 9;
    round.push(moved(turnedX(lathe({ profile: [[0, -L], [0.55, -L + 0.8], [1.15, -L + 2.2], [1.5, -L + 4], [1.6, -L + 7], [1.6, L - 4.5], [1.35, L - 1.4], [1.1, L], [0, L]], segments: 16, color: (t) => t > 0.42 && t < 0.47 ? LIVERY.gold : LIVERY.body }), Math.PI / 2), 0, cy, 0));
    round.push(moved(turnedX(lathe({ profile: [[0, -1.7], [0.7, -0.9], [0.78, 0.4], [0.5, 1.5], [0, 1.6]], segments: 12, color: LIVERY.glass, emissive: 0.15 }), Math.PI / 2), 0, cy + 1.05, -L + 4.6));
    // Wings and tailplanes: flat outlines in x and z, wound counter-clockwise, laid flat.
    const flatWing = (pts, depth, color, x, y, z) => flat.push(moved(turnedX(prism(pts, depth, color), Math.PI / 2), x, y, z));
    for (const s of [-1, 1]) {
      const wing = [[0, -2.6], [s * 6, 0.6], [s * 6, 1.7], [0, 2.2]], tail = [[0, 5.6], [s * 3, 7.8], [s * 3, 8.6], [0, 8.6]];
      flatWing(s > 0 ? wing : wing.slice().reverse(), 0.28, LIVERY.blue, 0, cy - 0.6, 0);
      flatWing(s > 0 ? tail : tail.slice().reverse(), 0.18, LIVERY.blue, 0, cy + 0.4, 0);
    }
    // The fin: an outline in z and y, stood up along the fuselage, the bolt on each face.
    const fin = prism([[5.2, 0], [8.9, 0], [8.9, 5], [7.8, 5]].map(([z, y]) => [-z, y]).reverse(), 0.3, LIVERY.blue);
    flat.push(moved(turnedY(fin, Math.PI / 2), 0, cy + 1.2, 0));
    for (const s of [-1, 1]) glow.push(moved(turnedY(FM.smoothBolt(2.2, 0.05, PAINT, 0.9), s > 0 ? Math.PI / 2 : -Math.PI / 2), s * 0.18, cy + 3.6, 7.8));
    // Twin engines at the tail, their exhausts lit.
    for (const s of [-1, 1]) {
      round.push(moved(turnedX(lathe({ profile: [[0, -1.6], [0.62, -1.3], [0.72, 0.6], [0.6, 1.6], [0, 1.6]], segments: 12, color: "#c9ced6" }), Math.PI / 2), s * 1.25, cy - 0.3, L - 1.7));
      glow.push(moved(turnedX(lathe({ profile: [[0.52, 0], [0.52, 0.05], [0, 0.06]], segments: 12, color: LIVERY.engine, emissive: 1 }), Math.PI / 2), s * 1.25, cy - 0.3, L - 0.08));
    }
    // The gear: a nose leg and two mains, each a strut and a wheel.
    for (const [x, z] of [[0, -L + 2.6], [-1.3, 1], [1.3, 1]]) {
      flat.push(box({ w: 0.16, h: cy - 1.4, d: 0.16, color: IRON, offset: { x, y: 0.4 + (cy - 1.4) / 2, z } }));
      round.push(moved(turnedZ(lathe({ profile: [[0, -0.14], [0.42, -0.14], [0.42, 0.14], [0, 0.14]], segments: 12, color: "#1d1f24" }), Math.PI / 2), x, 0.42, z));
    }
    return { body: shaded(round, flat), glow: noShadow(merge(...glow)) };
  });

  // The scaffold up the Jet's left flank: its deck beside the cockpit on posts, railed but where it meets the fuselage
  // and where its stair comes up from in front of the nose.
  const jetScaffold = cached(() => {
    const d = LAYOUT.jetDeck, [sx, , sz0, , sy1, sz1, sw] = LAYOUT.jetStairs, geos = [];
    for (const g of deckParts(d.w, d.d, d.y, "nsw", 37, [[sx - d.x, sz1 - d.z, sw / 2 + 0.05, 0, -1]])) geos.push(moved(g, d.x, d.y, d.z));
    geos.push(...stairParts(sx, 0, sz0, sx, sy1, sz1, sw, [true, false]));
    return merge(...geos);
  });

  // ---- the floor an Ooga walks ----------------------------------------------------------------------------------

  // Every surface with its height, as the Factory keeps its own: the floor, the landing, the catwalks and the scaffold's
  // deck as rects, the steps and the stairs as strips that run half a metre on, flat, past both ends; and what stands in
  // the way as boxes [x0, x1, z0, z1, from, to] between two heights of the feet. `supportAt(x, z, feet)` is the highest
  // surface within a step of the feet, so a walker on a catwalk stands on it and one on the floor walks under it.
  const STEP = 0.6;
  const FLOOR = cached(() => {
    const L = LAYOUT, rects = [], strips = [], boxes = [];
    const rect = (x0, x1, z0, z1, y) => rects.push(x0, x1, z0, z1, y);
    const deck = (d) => rect(d.x - d.w / 2 + 0.15, d.x + d.w / 2 - 0.15, d.z - d.d / 2 + 0.15, d.z + d.d / 2 - 0.15, d.y);
    deck(L.landing);
    // The door's threshold runs on in under its shield, so a walker keeps its footing until it crosses.
    const d = L.door;
    rect(d.x - d.half + 0.1, d.x + d.half - 0.1, L.landing.z, d.z + 1.2, d.y);
    for (const [x0, x1, z0, z1] of L.catwalks) rect(x0 + 0.15, x1 - 0.15, z0 + 0.15, z1 - 0.15, L.catwalkY);
    deck(L.jetDeck);
    const strip = (ax, ay, az, bx, by, bz, w) => {
      const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len * 0.5, uz = (bz - az) / len * 0.5;
      strips.push(ax, az, bx, bz, w / 2, ay, by, ax - ux, az - uz, ax, az, w / 2, ay, ay, bx, bz, bx + ux, bz + uz, w / 2, by, by);
    };
    strip(...L.steps.slice(0, 6), L.steps[6] - 0.3);
    for (const s of L.catwalkStairs) strip(...s.slice(0, 6), s[6] - 0.2);
    strip(...L.jetStairs.slice(0, 6), L.jetStairs[6] - 0.2);
    const block = (x0, x1, z0, z1, from, to) => boxes.push(x0, x1, z0, z1, from, to);
    // Under the landing, beside its steps, and under the deep end of each stair, where no Ooga stands.
    const l = L.landing;
    block(l.x - l.w / 2, l.x + l.w / 2, l.z - l.d / 2 + 0.05, l.z + l.d / 2, -1, l.y - 0.4);
    for (const [sx, , sz0, , , sz1, w] of L.catwalkStairs) block(sx - w / 2, sx + w / 2, Math.min(sz0, sz1) + 3.6, Math.max(sz0, sz1), -1, 0.3);
    // The Jet: its fuselage and engines down to the floor, its wings' tips and the nose leg; under the wings an Ooga
    // walks upright.
    const j = L.jet;
    block(j.x - 1.65, j.x + 1.65, j.z - j.length / 2 + 0.6, j.z + j.length / 2, -1, j.height);
    block(j.x - 2.1, j.x + 2.1, j.z + j.length / 2 - 3.4, j.z + j.length / 2, -1, 4);
    // The benches, the crates and the tool chest.
    for (const [x, z] of L.benches) block(x - 1, x + 1, z - 0.5, z + 0.5, -1, 1.2);
    for (const [x, z] of L.crates) block(x - 0.55, x + 0.55, z - 0.55, z + 0.55, -1, 0.85);
    block(L.toolChest.x - 0.55, L.toolChest.x + 0.55, L.toolChest.z - 0.4, L.toolChest.z + 0.4, -1, 1.1);
    // The lanterns' posts by the runway.
    for (const [kind, x, y, z] of lamps()) if (kind === "post") block(x - 0.2, x + 0.2, z - 0.2, z + 0.2, y - 1, y + 2.9);
    return { rects: new Float32Array(rects), strips: new Float32Array(strips), boxes: new Float32Array(boxes) };
  });
  const supportAt = (x, z, feet) => {
    const F = FLOOR(), reach = feet + STEP;
    let best = 0;
    const R = F.rects;
    for (let i = 0; i < R.length; i += 5) {
      const y = R[i + 4];
      if (y > best && y <= reach && x >= R[i] && x <= R[i + 1] && z >= R[i + 2] && z <= R[i + 3]) best = y;
    }
    const S = F.strips;
    for (let i = 0; i < S.length; i += 7) {
      const x0 = S[i], z0 = S[i + 1], dx = S[i + 2] - x0, dz = S[i + 3] - z0, len2 = dx * dx + dz * dz;
      const t = ((x - x0) * dx + (z - z0) * dz) / len2;
      if (t < 0 || t > 1) continue;
      const px = x0 + dx * t - x, pz = z0 + dz * t - z;
      if (px * px + pz * pz > S[i + 4] * S[i + 4]) continue;
      const y = S[i + 5] + (S[i + 6] - S[i + 5]) * t;
      if (y > best && y <= reach) best = y;
    }
    return best;
  };
  // Inside the hall, a step clear of its leaning walls; down the launch tunnel to the hold-short line; and through the
  // door's passage out to a little past its shield, so a walker crosses it on its feet. A movement may leave a box it
  // already overlaps, so long as it does not go in deeper.
  const inside = (x, z, feet) => {
    const H = LAYOUT.HALL, d = LAYOUT.door, t = LAYOUT.tunnel;
    if (Math.abs(x - d.x) < d.half - 0.3 && z > H.front - 2.4 && z < H.front + 1 && Math.abs(feet - d.y) < 0.8) return true;
    if (z <= H.back + 2.2) return z > t.holdShort && Math.abs(x) < t.r - 1.6;
    return Math.abs(x) < H.halfW - 2.4 && z < H.front - 1.6;
  };
  const depthIn = (B, i, x, z, radius) => {
    const dx = Math.max(B[i] - x, 0, x - B[i + 1]), dz = Math.max(B[i + 2] - z, 0, z - B[i + 3]);
    return radius - Math.hypot(dx, dz);
  };
  const clearAt = (x, z, feet, radius, fromX = x, fromZ = z) => {
    if (!inside(x, z, feet)) return false;
    const B = FLOOR().boxes;
    for (let i = 0; i < B.length; i += 6) {
      if (feet < B[i + 4] || feet > B[i + 5]) continue;
      const now = depthIn(B, i, x, z, radius);
      if (now <= 0) continue;
      if (depthIn(B, i, fromX, fromZ, radius) <= 0 || now > depthIn(B, i, fromX, fromZ, radius) + 1e-9) return false;
    }
    return true;
  };
  // Whether a walker of `radius` whose feet are at `feet` can step from (ax, az) to (bx, bz): clear all the way, and
  // never dropping more than a step, so the landing's and the catwalks' edges hold as their rails do.
  const walkable = (ax, az, bx, bz, feet, radius = 0.35) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.2));
    for (let i = 1; i <= steps; i++) {
      const x = ax + (bx - ax) * i / steps, z = az + (bz - az) * i / steps, floor = supportAt(x, z, feet);
      const px = ax + (bx - ax) * (i - 1) / steps, pz = az + (bz - az) * (i - 1) / steps;
      if (!clearAt(x, z, Math.max(feet, floor), radius, px, pz) || floor < feet - STEP) return false;
    }
    return true;
  };

  BL.hangarModels = {
    LAYOUT, LIVERY, STEP, shell, landing, runway, tunnel, isle, catwalks, dressing, benches, boardFrames, jetBoxOut, jetScaffold,
    hallGlimpse: cached(() => noShadow(merge(
      box({ w: 4.4, h: 4.6, d: 0.1, color: "#2a1a10", emissive: 0.55, offset: { y: 2.3, z: -3.25 } }),
      ...[-1.3, -0.4, 0.5, 1.4].map((x, i) => box({ w: 0.14, h: 0.18, d: 0.05, color: "#ffc86a", emissive: 1, offset: { x, y: 2.6 + (i % 2) * 0.7, z: -3.18 } }))
    ))),
    supportAt, clearAt, walkable
  };
})();
