// The Lightning Jet Hangar's geometry: the long rock hall behind the Lightning Factory's door at the end of its left
// walkway, as its concept draws it. A timber landing inside the door with steps down to the runway, which runs down the
// middle of the floor between hazard-striped edges and blue marker lamps, and on through the launch tunnel's octagonal
// frames, each lined with blue neon, to the launch shield at its far end, sealed until Jet v2 flies, the sky beyond.
// Ochre truss gantries cross the vault, hung with lanterns on chains of every length and the bolt's royal-blue banners;
// timber catwalks run along both side walls on brackets, a stair up to each from the back. On the right, in the
// hall's wider half, the Jet stands docked beside the runway, nose to the tunnel, inside its striped bay: a timber
// gangway runs along its left flank at the cockpit's sill, bridging the wing, with a long stair down from behind the
// wing toward the runway; trestles stand under its wings and a step platform behind an engine. On the left the crew's workstations stand in rows, their screens glowing blue, and on the
// wall above them the two boards, the repository's stats right after the door and its timeline farther in. Crates,
// lantern posts, blue floor lamps and terminals on stands line the runway. The Jet itself is `jet-models.js`'s; the
// boards' faces and the crew are the scene's.
//
// `LAYOUT` is the one table of where everything stands, read by the scene too. The hangar's frame: +z runs back out
// through the door to the hall, x to the right looking in, y 0 the floor. `supportAt`, `clearAt` and `walkable` are the
// floor an Ooga walks, layered as the Factory's is; they allocate nothing.
(() => {
  "use strict";
  const BL = window.BL = window.BL || {};
  const { models, math } = BL;
  const FM = BL.factoryModels, JM = BL.jetModels;
  const { cached, box, bevelBox, merge, noShadow, moved, turnedX, turnedY, beam, lathe, chain, lanternParts, deckParts, stairParts } = models;
  const { mulberry32 } = math;
  const TAU = Math.PI * 2;

  const STONE = ["#5b4a3e", "#524238", "#66544a", "#4a3d34"], STONE_DK = "#3a2f28", IRON = "#4a4d52", IRON_DK = "#2c2e33";
  const TIMBER = "#8a5a32", TIMBER_LT = "#a8703e", TIMBER_DK = "#5c3a1e", GIRDER = "#86602f", GIRDER_DK = "#5e4223";
  const RUNWAY = "#2a2e36", SEAM = "#3b404a", PAINT = "#ffd23a", INK = "#141414", MARKER = "#6fc8ff", NEON = "#3fa8ff";
  const SCREEN = "#2f7fd8", SCREEN_INK = "#cfe8ff", FLOOR_LAMP = "#4aa8ff";

  // The hall is wider on the right, where the Jet docks, than on the left, where the crew works.
  const HALL = { x0: -22, x1: 27, back: -34, front: 30, h: 18 };
  const LAYOUT = {
    HALL,
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
    // ends; and the truss gantries across the vault, by z, at the height they run.
    catwalkY: 7.5, catwalks: [[HALL.x0 + 3, HALL.x0 + 5.4, -20, 24], [HALL.x1 - 5.4, HALL.x1 - 3, -20, 24]],
    catwalkStairs: [[HALL.x0 + 4.2, 0, -31.5, HALL.x0 + 4.2, 7.5, -20, 1.6], [HALL.x1 - 4.2, 0, -31.5, HALL.x1 - 4.2, 7.5, -20, 1.6]],
    gantries: [22, 14, 6, -2, -10, -18, -26], gantryY: 15,
    // The Jet's dock right of the runway, nose to the tunnel: where `jet-models.js`'s jet stands on the floor, and the
    // striped bay round it, [x0, x1, z0, z1]. Its gangway along the left flank at the cockpit's sill, `w` wide at `x`
    // and `y` up, in three decks [z0, z1, posts]: one in front of the wing on braced posts, one bridging the wing, and
    // one behind it; and the stair down from its back end toward the tail, [x, y, z] at the foot and at the head and the
    // width.
    jet: { x: 15, z: -10 },
    bay: [5.6, 25.2, -29.6, 6.6],
    gangway: { x: 11.075, y: 5, w: 2.65, decks: [[-21, -13.6, true], [-13.6, -6.2, false], [-6.2, -4.6, true]] },
    jetStairs: [10.6, 0, 3.4, 10.6, 5, -4.6, 1.6],
    // Trestles under the wings, [x, z], and the step platform behind the left engine, [x, z, top].
    trestles: [[8, -8.9], [22, -8.9]],
    engineStand: [13, 5.8, 2.2],
    // The crew's workstations on the left, [x, z, turn] each, their screens facing `turn` (0 toward the door); the
    // terminals on stands by the runway, [x, z, turn], the dock's showing the Jet; and the tool chests, [x, z, turn].
    stations: [[-9.5, 17, 0], [-9.5, 9.5, 0.3], [-9.5, 2, 0], [-9.5, -5.5, 0.3], [-9.5, -13, 0], [-9.5, -20.5, 0.3], [-14.5, 6.5, Math.PI / 2], [-14.5, -11, Math.PI / 2], [-14.5, -18.5, Math.PI / 2]],
    kiosks: [[-6.9, 12.5, 0.7], [-6.9, -9, 0.7], [7.3, -3.2, -0.8, "jet"]],
    toolChests: [[8.3, 0.4, -Math.PI / 2], [-16.2, 20.8, 0.4]],
    // Crates about the floor, [x, z, turn, stacked], and the blue floor lamps, [x, z].
    crates: [[-7.6, 12, 0.2, 2], [-8.5, 11.2, -0.3, 1], [-7.7, 3.4, 0.1, 1], [-7.8, -15.4, -0.2, 2], [-8.7, -16, 0.4, 1], [-7.6, -24, 0.3, 1],
      [-16.4, 1.2, 0.5, 1], [-15.6, -15, -0.2, 2], [-12, -29, 0.2, 2], [-13, -28.4, -0.3, 1],
      [7.4, 18, 0.3, 2], [8.3, 18.7, -0.4, 1], [7.6, 11.4, -0.2, 1], [6.6, -28.4, 0.3, 1], [12.9, -27.6, 0.2, 2], [19.6, 5.2, -0.2, 2], [20.5, 4.3, 0.4, 1], [24.2, -22.5, 0, 1], [16.5, -30.4, -0.3, 1]],
    floorLamps: [[-6.3, 20], [-6.3, 8], [-6.3, -4], [-6.3, -16], [-6.3, -28], [6.3, 20], [6.3, -28], [-11.8, 21.2], [-17.4, -3.2], [-11.6, -24],
      [5.9, 6.3], [5.9, -29.3], [24.9, 6.3], [24.9, -29.3], [6.3, 13.5]],
    // The two boards on the left wall under the catwalk: the repository's stats right after the door, turned a little
    // toward it, and its timeline farther in; centre, width and height, and the way each faces.
    boards: {
      stats: { x: HALL.x0 + 3.6, y: 4.5, z: 16, w: 9, h: 4, turn: Math.PI / 2 - 0.44 },
      timeline: { x: HALL.x0 + 2.6, y: 4.5, z: -2, w: 11, h: 4, turn: Math.PI / 2 }
    },
    // The signs: the hangar's over the runway from the last gantry, the right wall's call to work, the plaque by the
    // runway at the Jet's tail.
    signs: { hangar: [0, 11.6, -26], work: [HALL.x1 - 3.4, 10.6, 13.5], soon: [7.6, 1.9, 8.4] },
    // The crew, gorillas in hard hats, each pacing its post: [x, y, z, radius, heading], heading 0 facing +z. At the
    // workstations, at the stats board, on the Jet's gangway, at its stair and its engine, and on both catwalks.
    crew: [[-9.5, 0, 18, 0.35, Math.PI], [-9.2, 0, 10.4, 0.35, Math.PI + 0.3], [-9.5, 0, -12.1, 0.35, Math.PI], [-13.5, 0, -11, 0.35, -Math.PI / 2],
      [HALL.x0 + 6.4, 0, 17.2, 0.8, -Math.PI / 2 - 0.44], [11, 5, -17.5, 0.9, Math.PI / 2], [7.4, 0, 0.4, 0.5, Math.PI / 2], [14.8, 0, 6.2, 0.4, Math.PI],
      [HALL.x1 - 4.2, 7.5, 6, 2.2, -Math.PI / 2], [HALL.x0 + 4.2, 7.5, 0, 2.2, Math.PI / 2]],
    // The far islet seen through the launch shield, past the tunnel's end.
    isle: { x: 7, y: 9, z: -240, r: 11 }
  };

  // A painted line on the floor from (ax, az) to (bx, bz), `w` wide, its top at `y`: yellow and black dashes.
  const hazard = (out, ax, az, bx, bz, y, w = 0.3, dash = 0.6) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / dash)), a = Math.atan2(bx - ax, bz - az);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      out.push(moved(turnedY(box({ w, h: 0.02, d: len / n - 0.02, color: i % 2 ? INK : PAINT }), a), ax + (bx - ax) * t, y - 0.01, az + (bz - az) * t));
    }
  };
  // A part built facing +z at the origin, turned to face `turn` and set down at (x, y, z).
  const placed = (out, parts, x, y, z, turn = 0) => { for (const g of parts) out.push(moved(turnedY(g, turn), x, y, z)); };

  // ---- the hall -------------------------------------------------------------------------------------------------

  // The chamber: a floor of stone tiles, craggy walls of stacked blocks leaning in as they rise, a vault of slabs, and
  // behind it all a dark backing, so the sky the launch tunnel lets in never shows between two blocks. The back wall
  // leaves the tunnel's mouth open, the front the door's over the landing.
  const shell = cached(() => {
    const { x0: X0, x1: X1, back: B, front: F, h: H } = HALL, d = LAYOUT.door, t = LAYOUT.tunnel, rand = mulberry32(5150), rock = [], vault = [];
    const mid = (X0 + X1) / 2, span = X1 - X0;
    for (let x = X0; x < X1; x += 4) for (let z = B; z < F; z += 4) {
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
    wall(B, F, none, (u, y, depth, color) => block(color, X0 + depth - 1.1, y, u));
    wall(B, F, none, (u, y, depth, color) => block(color, X1 - depth + 1.1, y, u));
    wall(X0, X1, octagon, (u, y, depth, color) => block(color, u, y, B + depth - 1.1));
    wall(X0, X1, (u, y) => Math.abs(u - d.x) < 4.3 && y > d.y - 0.5 && y < d.y + 7.8, (u, y, depth, color) => block(color, u, y, F - depth + 1.1));
    for (let x = X0; x < X1; x += 5) for (let z = B; z < F; z += 5) vault.push(box({ w: 5.4, h: 2, d: 5.4, color: STONE[Math.floor(rand() * 4)], offset: { x: x + 2.5, y: H + rand() * 1.2, z: z + 2.5 } }));
    const back = [
      box({ w: 1, h: H + 4, d: F - B + 4, color: STONE_DK, offset: { x: X0 - 1.2, y: H / 2, z: (B + F) / 2 } }),
      box({ w: 1, h: H + 4, d: F - B + 4, color: STONE_DK, offset: { x: X1 + 1.2, y: H / 2, z: (B + F) / 2 } }),
      box({ w: span + 4, h: H + 4, d: 1, color: STONE_DK, offset: { x: mid, y: H / 2, z: F + 1.6 } }),
      box({ w: span + 4, h: 1, d: F - B + 4, color: STONE_DK, offset: { x: mid, y: H + 3, z: (B + F) / 2 } })
    ];
    // The back wall's backing leaves the tunnel's mouth, in three slabs round it.
    const mw = t.r + 0.6;
    back.push(box({ w: -mw - X0 + 2, h: H + 4, d: 1, color: STONE_DK, offset: { x: (X0 - 2 - mw) / 2, y: H / 2, z: B - 1.6 } }), box({ w: X1 + 2 - mw, h: H + 4, d: 1, color: STONE_DK, offset: { x: (mw + X1 + 2) / 2, y: H / 2, z: B - 1.6 } }));
    back.push(box({ w: 2 * mw, h: H + 4 - (t.y + mw), d: 1, color: STONE_DK, offset: { y: (H + 4 + t.y + mw) / 2 - 2, z: B - 1.6 } }));
    return { rock: merge(...rock), vault: merge(...vault), backing: merge(...back) };
  });

  // The landing inside the door: timber planks on posts, railed down both sides and along its front but for its steps,
  // which come down to the runway between heavy stringers.
  const landing = cached(() => {
    const l = LAYOUT.landing, [sx, , sz0, , sy1, sz1, sw] = LAYOUT.steps, geos = [];
    placed(geos, deckParts(l.w, l.d, l.y, "new", 29, [[sx - l.x, sz1 - l.z, sw / 2 + 0.05, 0, -1]]), l.x, l.y, l.z);
    geos.push(...stairParts(sx, 0, sz0, sx, sy1, sz1, sw, [true, false]));
    return merge(...geos);
  });

  // The runway: slate panels with their seams between twin yellow centre lines and hazard-striped edges, yellow and
  // black bands across it every eight metres and at the hold-short line, chevrons before the shield, and blue marker
  // lamps along both edges, the length of the floor and on through the tunnel; and on the floor beside it, the stripes
  // round the Jet's bay and along the crew's side. The lamps glow, so they are their own mesh.
  const runway = cached(() => {
    const r = LAYOUT.runway, flat = [], glow = [], len = r.z0 - r.z1, mid = (r.z0 + r.z1) / 2, top = 0.06;
    flat.push(box({ w: r.halfW * 2, h: 0.04, d: len, color: RUNWAY, offset: { y: 0.02, z: mid } }));
    for (let z = r.z0 - 2; z > r.z1; z -= 4) flat.push(box({ w: r.halfW * 2 - 0.7, h: 0.01, d: 0.05, color: SEAM, offset: { y: 0.045, z } }));
    for (const x of [-2.6, 2.6]) flat.push(box({ w: 0.05, h: 0.01, d: len - 0.4, color: SEAM, offset: { x, y: 0.045, z: mid } }));
    for (const x of [-0.18, 0.18]) flat.push(box({ w: 0.12, h: 0.02, d: len - 1, color: PAINT, offset: { x, y: 0.05, z: mid } }));
    for (const s of [-1, 1]) hazard(flat, s * (r.halfW - 0.2), r.z0, s * (r.halfW - 0.2), r.z1, top, 0.3, 0.7);
    const band = (z, d = 0.5) => {
      for (let k = 0; k < 10; k++) flat.push(box({ w: r.halfW * 0.2 - 0.02, h: 0.02, d, color: k % 2 ? INK : PAINT, offset: { x: -r.halfW + (k + 0.5) * r.halfW * 0.2, y: 0.05, z } }));
    };
    for (let z = r.z0 - 4; z > r.z1 + 6; z -= 8) band(z);
    band(r.z1 + 0.35, 0.7);
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
      const z = r.z1 + 2 + k * 1.2;
      flat.push(moved(turnedY(box({ w: 2.4, h: 0.02, d: 0.35, color: PAINT }), s * 0.6), s * 1.1, 0.05, z));
    }
    for (let z = r.z0 - 1; z > r.z1; z -= 3) for (const s of [-1, 1]) {
      flat.push(box({ w: 0.3, h: 0.08, d: 0.3, color: IRON_DK, offset: { x: s * (r.halfW + 0.45), y: 0.04, z } }));
      glow.push(box({ w: 0.18, h: 0.1, d: 0.18, color: MARKER, emissive: 1, offset: { x: s * (r.halfW + 0.45), y: 0.12, z } }));
    }
    // The Jet's bay, striped all round, and the line along the crew's side of the runway.
    const [bx0, bx1, bz0, bz1] = LAYOUT.bay;
    hazard(flat, bx0, bz0, bx1, bz0, 0.025, 0.28);
    hazard(flat, bx1, bz0, bx1, bz1, 0.025, 0.28);
    hazard(flat, bx1, bz1, bx0, bz1, 0.025, 0.28);
    hazard(flat, bx0, bz1, bx0, bz0, 0.025, 0.28);
    hazard(flat, -5.9, 22, -5.9, HALL.back + 3, 0.025, 0.24, 0.8);
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
    for (let k = 0; k < 14; k++) iron.push(box({ w: 0.8, h: 0.22, d: 0.18, color: k % 2 ? INK : PAINT, offset: { x: -5.6 + (k + 0.5) * 0.8, y: 1.05, z: hs } }));
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
    const underBoard = (x, z) => Object.values(B).some((b) => Math.sign(b.x) === Math.sign(x) && Math.abs(z - b.z) < b.w / 2 + 0.4);
    L.catwalks.forEach(([x0, x1, z0, z1], i) => {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, side = i ? 1 : -1, [sx, , , , , sz1, sw] = L.catwalkStairs[i];
      // The rails: the hall side and both ends; the wall side is the rock.
      const rails = side < 0 ? "nse" : "nsw";
      placed(geos, deckParts(x1 - x0, z1 - z0, 0, rails, 31 + i, [[sx - cx, sz1 - cz, sw / 2 + 0.05, 0, -1]]), cx, y, cz);
      const wall = side < 0 ? HALL.x0 + 1.4 : HALL.x1 - 1.4, edge = side < 0 ? x1 - 0.2 : x0 + 0.2;
      for (let z = z0 + 1.5; z < z1 - 1; z += 4) {
        if (underBoard(edge, z)) continue;
        geos.push(beam(wall, y - 2.6, z, edge, y - 0.6, z, 0.18, TIMBER_DK), beam(wall, y - 0.55, z, edge, y - 0.55, z, 0.22, TIMBER_DK));
      }
    });
    for (const [ax, ay, az, bx, by, bz, w] of L.catwalkStairs) geos.push(...stairParts(ax, ay, az, bx, by, bz, w, [true, false]));
    return merge(...geos);
  });

  // Every lantern in the hall, as `FM.lanterns` takes them: hung from the gantries on chains of every length (none
  // over the hangar's sign or against the Jet's fin), on posts both sides of the runway and on the landing, and on the
  // catwalks' rails. `hangDrop` is how far below a gantry's bottom chord each hung one's hook is, those over the
  // runway's middle hung short so the tunnel's mouth stays clear from the door.
  const hangDrop = (i, j) => HUNG_X[j] === 0 ? 0.4 : 0.8 + ((i * 7 + j * 3) % 5) * 0.75;
  const HUNG_X = [-17, -11, -5.5, 0, 5.5, 11, 16.5, 22];
  const lamps = cached(() => {
    const L = LAYOUT, out = [], fin = (z) => z > L.jet.z + 6.6 && z < L.jet.z + 14;
    L.gantries.forEach((z, i) => HUNG_X.forEach((x, j) => {
      if (z === L.signs.hangar[2] && Math.abs(x) < 3 || fin(z) && Math.abs(x - L.jet.x) < 1.6) return;
      out.push(["hang", x, L.gantryY - 0.6 - hangDrop(i, j), z]);
    }));
    for (let z = L.runway.z0 - 5; z > HALL.back + 4; z -= 9) for (const s of [-1, 1]) out.push(["post", s * (L.runway.halfW + 1.6), 0, z, s < 0 ? 0 : Math.PI]);
    out.push(["post", -4, L.landing.y, 25.4, 0], ["post", 4, L.landing.y, 25.4, Math.PI]);
    L.catwalks.forEach(([x0, x1, z0, z1], i) => {
      for (let z = z1 - 4; z > z0 + 2; z -= 8) out.push(["rail", i ? x0 + 0.1 : x1 - 0.1, L.catwalkY, z]);
    });
    return out;
  });

  // The vault's dressing: the gantries, each a truss of ochre girders on knee braces into the walls, with the chains
  // the lanterns hang from and two crane trolleys over the Jet; the bolt's banners, down both walls and hung from the
  // gantries; and the lanterns, whose lights the scene shares out, each with how far it reaches.
  const dressing = cached(() => {
    const L = LAYOUT, { x0: X0, x1: X1 } = HALL, iron = [], banners = [], gy = L.gantryY, mid = (X0 + X1) / 2, span = X1 - X0 - 4;
    for (const z of L.gantries) {
      for (const y of [gy + 0.5, gy - 0.5]) iron.push(box({ w: span, h: 0.32, d: 0.46, color: GIRDER, offset: { x: mid, y, z } }));
      const n = Math.round(span / 2.4);
      for (let k = 0; k <= n; k++) {
        const x = X0 + 2 + span * k / n;
        iron.push(box({ w: 0.16, h: 0.7, d: 0.3, color: GIRDER_DK, offset: { x, y: gy, z } }));
        if (k < n) {
          const x2 = X0 + 2 + span * (k + 1) / n, up = k % 2 ? 1 : -1;
          iron.push(beam(x, gy - up * 0.36, z, x2, gy + up * 0.36, z, 0.12, GIRDER_DK));
        }
      }
      for (const [x, s] of [[X0, 1], [X1, -1]]) iron.push(beam(x + s * 3.2, gy - 3, z, x + s * 1.8, gy - 0.3, z, 0.32, GIRDER_DK), box({ w: 0.5, h: 1.3, d: 0.6, color: IRON_DK, offset: { x: x + s * 2.2, y: gy, z } }));
    }
    const hung = lamps();
    L.gantries.forEach((z, i) => HUNG_X.forEach((x, j) => {
      const hook = gy - 0.6 - hangDrop(i, j);
      if (hung.some(([kind, hx, hy, hz]) => kind === "hang" && hx === x && hz === z)) iron.push(...chain(x, gy - 0.66, z, x, hook, z, 0.06, IRON_DK));
    }));
    // The crane trolleys: a yellow carriage on the bottom chord, its hook block hung over the Jet.
    for (const [x, z, drop] of [[L.jet.x, -18, 3.6], [L.jet.x + 3.5, -2, 3.4]]) {
      iron.push(bevelBox({ w: 1.3, h: 0.7, d: 1.1, color: "#e0a92a", bevel: 0.06, offset: { x, y: gy - 1.05, z } }), box({ w: 1.5, h: 0.12, d: 0.3, color: IRON_DK, offset: { x, y: gy - 0.72, z } }));
      iron.push(...chain(x, gy - 1.4, z, x, gy - 1.4 - drop, z, 0.09, IRON_DK));
      iron.push(bevelBox({ w: 0.5, h: 0.55, d: 0.34, color: "#e0a92a", bevel: 0.05, offset: { x, y: gy - 1.7 - drop, z } }), box({ w: 0.12, h: 0.4, d: 0.12, color: IRON_DK, offset: { x, y: gy - 2.15 - drop, z } }));
    }
    for (const z of [20, 10, 0, -10, -22]) for (const [x, s] of [[X0 + 3.4, -1], [X1 - 3.4, 1]]) {
      banners.push(moved(turnedY(merge(FM.banner(3)), -s * Math.PI / 2), x, 12.6, z));
    }
    for (const [z, xs] of [[14, [-8.5, 8.5]], [6, [-14]], [-2, [-8.5, 8.5]], [-10, [-14, 21]], [-18, [-8.5, 8.5]]]) for (const x of xs) {
      banners.push(moved(merge(FM.banner(2.6)), x, gy - 0.7, z + 0.36));
    }
    const lit = FM.lanterns(hung, []);
    for (let i = 0; i < lit.lights.length; i += 4) lit.lights[i + 3] = lit.lights[i + 1] > 8 ? 11 : 7.5;
    return { iron: merge(...iron), banners: merge(...banners), frame: lit.frame, glass: lit.glass, lights: lit.lights };
  });

  // ---- the floor's fixtures ---------------------------------------------------------------------------------------

  // A monitor facing +z with its stand: a dark frame round a glowing blue screen showing a page of the crew's work, a
  // title bar, lines of text and a little bar chart, or with `jet` the Jet's silhouette in white.
  const monitor = (flat, glow, w, h, seed, jet = false) => {
    flat.push(box({ w: w + 0.08, h: h + 0.08, d: 0.06, color: IRON_DK, offset: { y: h / 2, z: -0.03 } }));
    glow.push(box({ w, h, d: 0.02, color: SCREEN, emissive: 0.95, offset: { y: h / 2, z: 0.01 } }));
    const ink = (x, y, bw, bh) => glow.push(box({ w: bw, h: bh, d: 0.01, color: SCREEN_INK, emissive: 1, offset: { x, y, z: 0.026 } }));
    if (jet) {
      // From above, nose to the right: the fuselage, the swept wings and the tailplanes.
      const stroke = (ax, ay, bx, by, t) => glow.push(beam(ax * w, ay * h, 0.03, bx * w, by * h, 0.03, t, SCREEN_INK, 1));
      stroke(-0.32, 0.5, 0.34, 0.5, 0.05);
      for (const s of [-1, 1]) stroke(0.06, 0.5, -0.1, 0.5 + s * 0.38, 0.045), stroke(-0.24, 0.5, -0.32, 0.5 + s * 0.18, 0.035);
      return;
    }
    const rand = mulberry32(seed);
    ink(0, h - 0.05, w - 0.1, 0.035);
    for (let k = 0; k < 3; k++) {
      const lw = (0.3 + rand() * 0.35) * w;
      ink(-w / 2 + 0.06 + lw / 2, h * (0.72 - k * 0.15), lw, 0.025);
    }
    for (let k = 0; k < 4; k++) {
      const bh = (0.12 + rand() * 0.28) * h;
      ink(w * 0.12 + k * w * 0.1, 0.06 + bh / 2, w * 0.06, bh);
    }
  };

  // The crew's workstations, the terminals on stands, the tool chests, the crates (some stacked, a lantern on the
  // tallest), and the blue floor lamps. Screens and lamps glow, so they are their own mesh; the lanterns on the crates
  // come back with their lights.
  const fixtures = cached(() => {
    const L = LAYOUT, flat = [], glow = [], frame = [], glass = [], lights = [];
    L.stations.forEach(([x, z, turn], i) => {
      const f = [], g = [];
      f.push(bevelBox({ w: 2.1, h: 0.08, d: 0.9, color: TIMBER_LT, bevel: 0.02, offset: { y: 0.8 } }));
      for (const dx of [-0.95, 0.95]) for (const dz of [-0.35, 0.35]) f.push(box({ w: 0.08, h: 0.78, d: 0.08, color: TIMBER_DK, offset: { x: dx, y: 0.39, z: dz } }));
      f.push(box({ w: 2, h: 0.06, d: 0.06, color: TIMBER_DK, offset: { y: 0.22, z: -0.35 } }));
      // The tower under the desk, its lamp lit.
      f.push(box({ w: 0.34, h: 0.62, d: 0.6, color: IRON_DK, offset: { x: 0.65, y: 0.33, z: -0.05 } }));
      g.push(box({ w: 0.05, h: 0.05, d: 0.02, color: MARKER, emissive: 1, offset: { x: 0.65, y: 0.52, z: 0.26 } }));
      for (const [dx, w, a] of [[-0.48, 0.78, 0.18], [0.5, 0.64, -0.2]]) {
        const mf = [], mg = [];
        monitor(mf, mg, w, 0.46, 73 + i * 2 + (dx > 0 ? 1 : 0));
        for (const p of mf) f.push(moved(turnedY(p, a), dx, 0.98, -0.22));
        for (const p of mg) g.push(moved(turnedY(p, a), dx, 0.98, -0.22));
        f.push(box({ w: 0.08, h: 0.14, d: 0.08, color: IRON_DK, offset: { x: dx, y: 0.91, z: -0.26 } }), box({ w: 0.26, h: 0.02, d: 0.18, color: IRON_DK, offset: { x: dx, y: 0.85, z: -0.26 } }));
      }
      f.push(box({ w: 0.56, h: 0.03, d: 0.18, color: "#1d1f24", offset: { y: 0.855, z: 0.14 } }), box({ w: 0.09, h: 0.03, d: 0.13, color: "#1d1f24", offset: { x: 0.42, y: 0.855, z: 0.16 } }));
      // A mug and a stack of papers.
      f.push(moved(lathe({ profile: [[0.045, 0], [0.045, 0.1], [0, 0.1]], segments: 8, color: i % 2 ? "#c23a2e" : "#e8e2d4" }), -0.85, 0.84, 0.18));
      f.push(box({ w: 0.3, h: 0.04, d: 0.22, color: "#efe9dc", offset: { x: 0.8, y: 0.86, z: 0.12 } }));
      placed(flat, f, x, 0, z, turn);
      placed(glow, g, x, 0, z, turn);
    });
    for (const [x, z, turn, kind] of L.kiosks) {
      const f = [], g = [];
      f.push(bevelBox({ w: 0.6, h: 0.08, d: 0.5, color: IRON_DK, bevel: 0.02, offset: { y: 0.04 } }), box({ w: 0.14, h: 1.1, d: 0.14, color: IRON, offset: { y: 0.6 } }));
      const mf = [], mg = [];
      monitor(mf, mg, 0.78, 0.5, 91 + x, kind === "jet");
      for (const p of mf) f.push(moved(turnedX(p, -0.45), 0, 1.08, 0.02));
      for (const p of mg) g.push(moved(turnedX(p, -0.45), 0, 1.08, 0.02));
      placed(flat, f, x, 0, z, turn);
      placed(glow, g, x, 0, z, turn);
    }
    for (const [x, z, turn] of L.toolChests) {
      const f = [];
      f.push(bevelBox({ w: 0.95, h: 1.05, d: 0.6, color: "#b3261e", bevel: 0.04, offset: { y: 0.6 } }));
      for (let k = 0; k < 4; k++) f.push(box({ w: 0.82, h: 0.02, d: 0.02, color: "#e8e8e8", offset: { y: 0.3 + k * 0.22, z: 0.31 } }));
      f.push(box({ w: 1, h: 0.06, d: 0.64, color: "#8e1d17", offset: { y: 1.15 } }));
      for (const dx of [-0.36, 0.36]) f.push(box({ w: 0.08, h: 0.08, d: 0.08, color: "#1d1f24", offset: { x: dx, y: 0.04 } }));
      placed(flat, f, x, 0, z, turn);
    }
    const crate = (x, y, z, a, s) => {
      flat.push(moved(turnedY(bevelBox({ w: 0.9 * s, h: 0.8 * s, d: 0.9 * s, color: TIMBER, bevel: 0.05 }), a), x, y + 0.4 * s, z));
      for (const h of [0.16, 0.64]) flat.push(moved(turnedY(box({ w: 0.92 * s, h: 0.06 * s, d: 0.92 * s, color: TIMBER_DK }), a), x, y + h * s, z));
      flat.push(moved(turnedY(beam(-0.42 * s, 0.08 * s, 0.46 * s, 0.42 * s, 0.72 * s, 0.46 * s, 0.06 * s, TIMBER_DK), a), x, y, z));
    };
    L.crates.forEach(([x, z, a, stacked], i) => {
      crate(x, 0, z, a, 1);
      if (stacked > 1) crate(x + 0.05, 0.8, z - 0.04, a + 0.3, 0.8);
      const top = stacked > 1 ? 1.44 : 0.8;
      if (i % 3 === 0) {
        lanternParts(0.75, x, top, z, frame, glass);
        lights.push(x, top + 0.35, z, 6);
      } else if (i % 3 === 1) flat.push(moved(turnedY(bevelBox({ w: 0.42, h: 0.2, d: 0.22, color: "#c2402e", bevel: 0.03 }), a + 0.5), x, top + 0.1, z));
    });
    for (const [x, z] of L.floorLamps) {
      flat.push(bevelBox({ w: 0.56, h: 0.1, d: 0.56, color: IRON_DK, bevel: 0.02, offset: { x, y: 0.05, z } }));
      glow.push(bevelBox({ w: 0.44, h: 0.42, d: 0.44, color: FLOOR_LAMP, emissive: 1, bevel: 0.03, offset: { x, y: 0.31, z } }));
    }
    return { flat: merge(...flat), glow: noShadow(merge(...glow)), frame: merge(...frame), glass: noShadow(merge(...glass)), lights };
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

  // ---- the Jet's dock ----------------------------------------------------------------------------------------

  // The dock's timber: the gangway up the Jet's left flank, its decks on braced posts in front of the wing and behind
  // it and the span between on two stringers over the wing, railed along its outer edge and across both ends but where
  // the stair comes up, and open along the fuselage; the stair; the trestles under the wings, each a braced pair of
  // legs under a padded cradle; and the step platform behind the left engine.
  const dock = cached(() => {
    const L = LAYOUT, g = L.gangway, [sx, , sz0, , sy1, sz1, sw] = L.jetStairs, geos = [], last = g.decks.length - 1;
    g.decks.forEach(([z0, z1, posts], i) => {
      const d = z1 - z0, cz = (z0 + z1) / 2, rails = (i === 0 ? "n" : "") + (i === last ? "s" : "");
      placed(geos, deckParts(g.w, d, posts ? g.y : 0, rails, 37 + i, i === last ? [[sx - g.x, d / 2, sw / 2 + 0.05, 0, 1]] : []), g.x, g.y, cz);
    });
    const z0 = g.decks[0][0], z1 = g.decks[last][1], outer = g.x - g.w / 2 + 0.1;
    placed(geos, models.railParts(outer, z0 + 0.1, outer, z1 - 0.1, [false, false]), 0, g.y, 0);
    const [b0, b1] = g.decks.find(([, , posts]) => !posts);
    for (const dx of [-0.8, 0.8]) geos.push(beam(g.x + dx, g.y - 0.62, b0 - 0.6, g.x + dx, g.y - 0.62, b1 + 0.6, 0.3, TIMBER_DK));
    geos.push(...stairParts(sx, 0, sz0, sx, sy1, sz1, sw, [true, false]));
    for (const [x, z] of L.trestles) {
      const top = 3.3;
      for (const s of [-1, 1]) {
        geos.push(beam(x - 0.9, 0, z + s * 0.6, x - 0.2, top - 0.2, z + s * 0.6, 0.18, TIMBER_DK), beam(x + 0.9, 0, z + s * 0.6, x + 0.2, top - 0.2, z + s * 0.6, 0.18, TIMBER_DK));
        geos.push(beam(x - 0.6, 1, z + s * 0.6, x + 0.6, 1, z + s * 0.6, 0.12, TIMBER));
      }
      geos.push(beam(x - 0.55, 1.6, z - 0.6, x + 0.55, 1.6, z + 0.6, 0.1, TIMBER), beam(x + 0.55, 1.6, z - 0.6, x - 0.55, 1.6, z + 0.6, 0.1, TIMBER));
      geos.push(bevelBox({ w: 0.7, h: 0.22, d: 1.5, color: TIMBER_LT, bevel: 0.04, offset: { x, y: top - 0.11, z } }), box({ w: 0.6, h: 0.06, d: 1.4, color: "#2b2b2b", offset: { x, y: top + 0.02, z } }));
    }
    const [ex, ez, et] = L.engineStand;
    placed(geos, deckParts(1.6, 1.4, et, "nwe", 43), ex, et, ez);
    geos.push(...stairParts(ex, 0, ez + 3.4, ex, et, ez + 0.7, 1.1, [true, false]));
    return merge(...geos);
  });

  // The crew's hi-vis vest, sized for the gorillas' chests in their chest's frame: navy, banded twice in yellow.
  const vest = cached(() => merge(
    box({ w: 1.24, h: 0.86, d: 0.64, color: "#24346b", offset: { y: 0.55 } }),
    ...[0.42, 0.7].map((y) => box({ w: 1.27, h: 0.07, d: 0.67, color: "#f2c230", emissive: 0.25, offset: { y } }))
  ));

  // ---- the floor an Ooga walks ----------------------------------------------------------------------------------

  // Every surface with its height, as the Factory keeps its own: the floor, the landing, the catwalks and the dock's
  // decks as rects, the steps and the stairs as strips that run half a metre on, flat, past both ends; and what stands
  // in the way as boxes [x0, x1, z0, z1, from, to] between two heights of the feet. `supportAt(x, z, feet)` is the
  // highest surface within a step of the feet, so a walker on a catwalk stands on it and one on the floor walks under
  // it.
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
    // The gangway, end to end, runs on to the fuselage's side.
    const g = L.gangway, gz0 = g.decks[0][0], gz1 = g.decks[g.decks.length - 1][1];
    rect(g.x - g.w / 2 + 0.15, g.x + g.w / 2, gz0 + 0.15, gz1 - 0.15, g.y);
    const strip = (ax, ay, az, bx, by, bz, w) => {
      const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len * 0.5, uz = (bz - az) / len * 0.5;
      strips.push(ax, az, bx, bz, w / 2, ay, by, ax - ux, az - uz, ax, az, w / 2, ay, ay, bx, bz, bx + ux, bz + uz, w / 2, by, by);
    };
    strip(...L.steps.slice(0, 6), L.steps[6] - 0.3);
    for (const s of L.catwalkStairs) strip(...s.slice(0, 6), s[6] - 0.2);
    strip(...L.jetStairs.slice(0, 6), L.jetStairs[6] - 0.2);
    const block = (x0, x1, z0, z1, from, to) => boxes.push(x0, x1, z0, z1, from, to);
    const around = (x, z, hx, hz, to) => block(x - hx, x + hx, z - hz, z + hz, -1, to);
    // Under the landing, beside its steps, and under the deep end of each stair, where no Ooga stands.
    const l = L.landing;
    block(l.x - l.w / 2, l.x + l.w / 2, l.z - l.d / 2 + 0.05, l.z + l.d / 2, -1, l.y - 0.4);
    for (const [sx, , sz0, , , sz1, w] of L.catwalkStairs) block(sx - w / 2, sx + w / 2, Math.min(sz0, sz1) + 3.6, Math.max(sz0, sz1), -1, 0.3);
    // The dock: under the gangway, and under its stair two metres up from its foot, from the floor, each low enough
    // that the widest Ooga on the stair clears it; and the Jet's own boxes, its fuselage and gear, its engine pods and
    // its wings' roots.
    block(g.x - g.w / 2, g.x + g.w / 2, gz0, gz1, -1, g.y - 1);
    const [jx, , jz0, , , jz1, jw] = L.jetStairs;
    block(jx - jw / 2, jx + jw / 2, jz1, jz0 - 2, -1, 0.3);
    const j = L.jet;
    for (const [x0, x1, z0, z1, from, to] of JM.BOXES) block(j.x + x0, j.x + x1, j.z + z0, j.z + z1, from, to);
    for (const [x, z] of L.trestles) around(x, z, 1.05, 0.85, 3.2);
    const [ex, ez, et] = L.engineStand;
    block(ex - 0.8, ex + 0.8, ez - 0.7, ez + 3.6, -1, et + 0.4);
    // The workstations, the terminals, the tool chests, the crates and the floor lamps.
    for (const [x, z, turn] of L.stations) {
      const across = Math.abs(Math.sin(turn)) > 0.7;
      around(x, z, across ? 0.5 : 1.1, across ? 1.1 : 0.5, 1.3);
    }
    for (const [x, z] of L.kiosks) around(x, z, 0.4, 0.4, 1.4);
    for (const [x, z] of L.toolChests) around(x, z, 0.55, 0.55, 1.1);
    for (const [x, z, , stacked] of L.crates) around(x, z, 0.55, 0.55, stacked > 1 ? 1.5 : 0.85);
    for (const [x, z] of L.floorLamps) around(x, z, 0.3, 0.3, 0.4);
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
    const d = LAYOUT.door, t = LAYOUT.tunnel;
    if (Math.abs(x - d.x) < d.half - 0.3 && z > HALL.front - 2.4 && z < HALL.front + 1 && Math.abs(feet - d.y) < 0.8) return true;
    if (z <= HALL.back + 2.2) return z > t.holdShort && Math.abs(x) < t.r - 1.6;
    return x > HALL.x0 + 2.4 && x < HALL.x1 - 2.4 && z < HALL.front - 1.6;
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
    LAYOUT, STEP, shell, landing, runway, tunnel, isle, catwalks, dressing, fixtures, boardFrames, dock, vest,
    hallGlimpse: cached(() => noShadow(merge(
      box({ w: 4.4, h: 4.6, d: 0.1, color: "#2a1a10", emissive: 0.55, offset: { y: 2.3, z: -3.25 } }),
      ...[-1.3, -0.4, 0.5, 1.4].map((x, i) => box({ w: 0.14, h: 0.18, d: 0.05, color: "#ffc86a", emissive: 1, offset: { x, y: 2.6 + (i % 2) * 0.7, z: -3.18 } }))
    ))),
    supportAt, clearAt, walkable
  };
})();
