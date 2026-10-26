// The Lightning Jet Hangar's geometry, for now its shell: the chamber behind the Lightning Factory's door at the end of
// its left walkway. A long rock hall under iron gantries hung with lanterns and the bolt's banners, the runway down its
// middle to the launch tunnel's mouth (sealed for now, its neon lit, the dark beyond), and in the front wall the door
// back to the hall, the Factory's own (`FM.hangarDoor`) turned to face in. The Jet, its scaffold, the crew and the
// boards come with the hangar itself; this is the room they will stand in.
//
// `LAYOUT` is the one table of where everything stands, read by the scene too. The hangar's frame: +z runs back out
// through the door to the hall, x to the right looking in, y 0 the floor. `supportAt`, `clearAt` and `walkable` are the
// floor an Ooga walks; they allocate nothing.
(() => {
  "use strict";
  const BL = window.BL = window.BL || {};
  const { models, math } = BL;
  const FM = BL.factoryModels;
  const { cached, box, bevelBox, merge, noShadow, moved, beam } = models;
  const { mulberry32 } = math;
  const TAU = Math.PI * 2;

  const STONE = ["#5b4a3e", "#524238", "#66544a", "#4a3d34"], STONE_DK = "#3a2f28", IRON = "#4a4d52", IRON_DK = "#2c2e33";
  const RUNWAY = "#23262d", PAINT = "#ffd23a", MARKER = "#6fc8ff", NEON = "#3fa8ff";

  const LAYOUT = {
    HALL: { halfW: 20, back: -34, front: 30, h: 18 },
    // The door back to the hall in the front wall, its sill on the floor: its shield's opening and plane, as the
    // Factory's side of it has them.
    door: { x: 0, z: 30, turn: Math.PI, half: FM.HANGAR_DOOR.half, top: FM.HANGAR_DOOR.top, plane: FM.HANGAR_DOOR.plane },
    // The runway down the middle from the door's landing to the back wall, and the launch tunnel's mouth in it.
    runway: { halfW: 5, z0: 27, z1: -34 },
    mouth: { y: 5, r: 6.2 },
    // The iron gantries across the vault, by z, and the height they run at.
    gantries: [18, 6, -6, -18, -28], gantryY: 15,
    // The sign over the runway, hung from the third gantry.
    sign: { y: 10.6, z: -6 }
  };

  // The chamber: a floor of stone tiles, craggy walls of stacked blocks leaning in a little, a vault of slabs, and in the
  // front wall the opening the door stands in.
  const shell = cached(() => {
    const { halfW: W, back: B, front: F, h: H } = LAYOUT.HALL, d = LAYOUT.door, rand = mulberry32(5150), rock = [], vault = [];
    for (let x = -W; x < W; x += 4) for (let z = B; z < F; z += 4) {
      rock.push(box({ w: 4, h: 0.4, d: 4, color: STONE[Math.floor(rand() * 4)], offset: { x: x + 2, y: -0.2 - rand() * 0.06, z: z + 2 } }));
    }
    // A wall of blocks `cell` across from u0 to u1 along it, each set in by the lean and a little heave; `put` lays one.
    const wall = (u0, u1, open, put) => {
      for (let u = u0; u < u1; u += 2) for (let y = 0; y < H + 1; y += 2) {
        if (open(u + 1, y + 1)) continue;
        const depth = 0.4 + (y + 1) / H * 2.6 + rand() * 0.9;
        put(u + 1, y + 1, depth, STONE[Math.floor(rand() * 4)]);
      }
    };
    const none = () => false;
    wall(B, F, none, (u, y, depth, color) => rock.push(bevelBox({ w: 2.2, h: 2.2, d: 2.2, color, bevel: 0.18, offset: { x: -W + depth - 1.1, y, z: u } })));
    wall(B, F, none, (u, y, depth, color) => rock.push(bevelBox({ w: 2.2, h: 2.2, d: 2.2, color, bevel: 0.18, offset: { x: W - depth + 1.1, y, z: u } })));
    // The back wall leaves the tunnel's mouth open, the front the door's.
    const m = LAYOUT.mouth;
    wall(-W, W, (u, y) => Math.hypot(u, y - m.y) < m.r + 0.4, (u, y, depth, color) => rock.push(bevelBox({ w: 2.2, h: 2.2, d: 2.2, color, bevel: 0.18, offset: { x: u, y, z: B + depth - 1.1 } })));
    wall(-W, W, (u, y) => Math.abs(u - d.x) < 4.3 && y < 7.8, (u, y, depth, color) => rock.push(bevelBox({ w: 2.2, h: 2.2, d: 2.2, color, bevel: 0.18, offset: { x: u, y, z: F - depth + 1.1 } })));
    for (let x = -W; x < W; x += 5) for (let z = B; z < F; z += 5) vault.push(box({ w: 5.4, h: 2, d: 5.4, color: STONE[Math.floor(rand() * 4)], offset: { x: x + 2.5, y: H + rand() * 1.2, z: z + 2.5 } }));
    return { rock: merge(...rock), vault: merge(...vault) };
  });

  // The runway: dark panels between twin yellow centre lines, yellow and black bands across it, and blue marker lamps
  // along both edges. The lamps glow, so they are their own mesh.
  const runway = cached(() => {
    const r = LAYOUT.runway, flat = [], glow = [], len = r.z0 - r.z1;
    flat.push(box({ w: r.halfW * 2, h: 0.04, d: len, color: RUNWAY, offset: { y: 0.02, z: (r.z0 + r.z1) / 2 } }));
    for (const x of [-0.18, 0.18]) flat.push(box({ w: 0.12, h: 0.02, d: len - 1, color: PAINT, offset: { x, y: 0.05, z: (r.z0 + r.z1) / 2 } }));
    for (let z = r.z0 - 4; z > r.z1 + 2; z -= 8) for (let k = 0; k < 10; k++) {
      flat.push(box({ w: r.halfW * 0.2 - 0.02, h: 0.02, d: 0.5, color: k % 2 ? "#141414" : PAINT, offset: { x: -r.halfW + (k + 0.5) * r.halfW * 0.2, y: 0.05, z } }));
    }
    for (let z = r.z0 - 1; z > r.z1; z -= 3) for (const s of [-1, 1]) {
      flat.push(box({ w: 0.3, h: 0.08, d: 0.3, color: IRON_DK, offset: { x: s * (r.halfW + 0.2), y: 0.04, z } }));
      glow.push(box({ w: 0.18, h: 0.1, d: 0.18, color: MARKER, emissive: 1, offset: { x: s * (r.halfW + 0.2), y: 0.12, z } }));
    }
    return { flat: merge(...flat), glow: noShadow(merge(...glow)) };
  });

  // The launch tunnel's mouth in the back wall: an octagon of iron with a neon strip round its inside, two more frames
  // stepping in behind it, and beyond them the dark of a tunnel not yet open, faintly blue.
  const mouth = cached(() => {
    const m = LAYOUT.mouth, B = LAYOUT.HALL.back, iron = [], glow = [];
    for (let ring = 0; ring < 3; ring++) {
      const r = m.r - ring * 0.5, z = B + 0.6 - ring * 2.4;
      for (let k = 0; k < 8; k++) {
        const a0 = TAU * (k + 0.5) / 8, a1 = TAU * (k + 1.5) / 8;
        const ax = Math.cos(a0) * r, ay = m.y + Math.sin(a0) * r, bx = Math.cos(a1) * r, by = m.y + Math.sin(a1) * r;
        iron.push(beam(ax, Math.max(0, ay), z, bx, Math.max(0, by), z, 0.5, ring ? IRON_DK : IRON));
        const n = 0.9;
        glow.push(beam(ax * n, m.y + (ay - m.y) * n, z + 0.3, bx * n, m.y + (by - m.y) * n, z + 0.3, 0.12, NEON, 1));
      }
    }
    // The tunnel's walls, roof and floor as far as the dark, so nothing past the wall shows round the frames.
    for (const s of [-1, 1]) iron.push(box({ w: 0.5, h: m.y + m.r, d: 6.6, color: STONE_DK, offset: { x: s * (m.r + 0.4), y: (m.y + m.r) / 2, z: B - 3.1 } }));
    iron.push(box({ w: m.r * 2 + 1.3, h: 0.5, d: 6.6, color: STONE_DK, offset: { y: m.y + m.r, z: B - 3.1 } }), box({ w: m.r * 2 + 0.8, h: 0.04, d: 6.6, color: RUNWAY, offset: { y: 0.02, z: B - 3.1 } }));
    glow.push(box({ w: m.r * 2, h: m.r * 2, d: 0.2, color: "#0c1a38", emissive: 0.55, offset: { y: m.y, z: B - 6 } }));
    return { iron: merge(...iron), glow: noShadow(merge(...glow)) };
  });
  // Through the door from in here, until the hall itself shows there: its warm dark and a few of its lanterns.
  const hallGlimpse = cached(() => noShadow(merge(
    box({ w: 4.4, h: 4.6, d: 0.1, color: "#2a1a10", emissive: 0.55, offset: { y: 2.3, z: -3.25 } }),
    ...[-1.3, -0.4, 0.5, 1.4].map((x, i) => box({ w: 0.14, h: 0.18, d: 0.05, color: "#ffc86a", emissive: 1, offset: { x, y: 2.6 + (i % 2) * 0.7, z: -3.18 } }))
  )));

  // The gantries across the vault, the lanterns hung from them and on posts along the runway's edges, and the bolt's
  // banners down both walls, as the concept hangs them.
  const lamps = () => {
    const L = LAYOUT, out = [];
    for (const z of L.gantries) for (const x of [-12, -4, 4, 12]) out.push(["hang", x, L.gantryY - 0.3, z]);
    for (let z = L.runway.z0 - 6; z > L.runway.z1 + 4; z -= 10) for (const s of [-1, 1]) out.push(["post", s * (L.runway.halfW + 2.4), 0, z, s < 0 ? 0 : Math.PI]);
    return out;
  };
  const dressing = cached(() => {
    const L = LAYOUT, W = L.HALL.halfW, iron = [], banners = [];
    for (const z of L.gantries) {
      iron.push(box({ w: W * 2, h: 0.6, d: 0.5, color: IRON, offset: { y: L.gantryY, z } }));
      for (const s of [-1, 1]) iron.push(beam(s * (W - 2.2), L.gantryY - 3, z, s * (W - 0.8), L.gantryY - 0.3, z, 0.32, IRON_DK));
    }
    for (const z of [22, 12, 0, -12, -24]) for (const s of [-1, 1]) {
      banners.push(moved(models.turnedY(merge(FM.banner(3)), -s * Math.PI / 2), s * (W - 2.6), 11, z));
    }
    const hung = FM.lanterns(lamps(), []);
    return { iron: merge(...iron), banners: merge(...banners), frame: hung.frame, glass: hung.glass, lights: hung.lights };
  });

  // ---- the floor an Ooga walks ----------------------------------------------------------------------------------

  // Flat everywhere for now: the floor, a step clear of the walls, and the door's passage out to a little past its
  // shield, so a walker crosses it on its feet.
  const supportAt = () => 0;
  const clearAt = (x, z) => {
    const H = LAYOUT.HALL, d = LAYOUT.door;
    if (Math.abs(x - d.x) < d.half - 0.3 && z > H.front - 2 && z < H.front + 1) return true;
    return Math.abs(x) < H.halfW - 2 && z > H.back + 2 && z < H.front - 1.6;
  };
  const walkable = (ax, az, bx, bz) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.2));
    for (let i = 1; i <= steps; i++) if (!clearAt(ax + (bx - ax) * i / steps, az + (bz - az) * i / steps)) return false;
    return true;
  };

  BL.hangarModels = { LAYOUT, shell, runway, mouth, hallGlimpse, dressing, supportAt, clearAt, walkable };
})();
