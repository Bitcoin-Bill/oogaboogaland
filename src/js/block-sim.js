// Block Frenzy's rules: capture the flag on Fort Chaos, two Oogas a side, no deaths. The "flag" each team guards is
// its Bitcoin block, a glowing orange cube on a stand; the code calls it a flag, the page calls it a block. Pure state
// and functions, no DOM or scene, so the suite plays whole rounds in Node; `scene-block.js` draws it and feeds the
// player's input.
//
// Each team keeps its flag on the stand inside its fort. Touch the other team's flag (on its stand or where it was
// dropped) to carry it; carry it home and touch your own stand while your own flag is home to capture. Captures
// return both flags. A carrier can drop the flag (`drop`), and a splatted, netted-and-splatted or trapped carrier
// drops it too. A dropped flag stays where it fell, as long as it takes: the carrier's teammates can grab it and run
// on, and its own team has to pick it up and carry it all the way back to its stand. A carrier can't pick the same
// flag up again until they have left its circle, so a drop is never undone by standing still.
//
// Tools (`fire` with a kind): paint balls without end, and a few paint grenades (lobbed, burst on landing), paint
// rockets (straight, burst on impact) and nets (slow a rival and stop their jumps for `NET_S`). A paint hit or a burst
// splats a rival: frozen for `SPLAT_S`, unable to move, throw or carry, and a carrier drops the flag where they stand.
// Then `GUARD_S` of fresh-paint protection. Walking onto your own stand refills grenades, rockets and nets. Nobody
// dies, nobody is removed, nobody has health. First team to `CAPTURES` wins.
//
// Crates: wooden boxes anyone can push by walking into them and stand on. Each fort starts with a few, each team has
// a stock to place (`build`) on its own half, and a round opens with `PREP_S` of fortifying, each side kept to its
// own half and the flags locked, so the bots plug their gates and the visitor can wall theirs: getting in then takes
// a push or a double jump. A crate never lands on a stand.
//
// Quiz traps: glowing Matrix pads on the field (`ARENA.traps`). Step on one and a bubble closes round you: you can't
// move, throw, pick up or score, a carrier drops the block, and nobody can paint you inside it. You get out by
// answering a Bitcoin question (the scene asks it and calls `escape`), or the bubble wears off after `TRAP_MAX_S`.
// Bots "work the question" for a seeded few seconds. A sprung pad goes dark for `TRAP_REARM_S`.
//
// Weather: the sky turns from clear to breezy to stormy and back on a seeded schedule; the wind gusts and wanders and
// pushes Oogas about (hard in the air, a little on the ground) and bends every throw.
//
// Every number lives in CONFIG. The arena, its blocks and the stands live in ARENA. Actors, flags, shots, crates and
// the event ring are preallocated in `create`; `step` allocates nothing. Bots and weather draw from the run's seeded
// `rng`, so a seed replays a round.
(() => {
  "use strict";
  const BL = window.BL = window.BL || {};
  const CONFIG = {
    JUMP: 6.5, JUMP2: 6.5, FALL: 16, CARRY_JUMP: 0.85, CROUCH_H: 1.05, CROUCH_SPEED: 0.55,
    CAPTURES: 3, SPLAT_S: 2, GUARD_S: 2.5, PICK_R: 1.3, STAND_R: 1.7, BODY_R: 0.45, HEIGHT: 1.7,
    SPEED: 6.2, SPRINT: 1.45, CARRY: 0.88, BOT_SPEED: 5.5, ACCEL: 30,
    SHOT_Y: 1.3, BOT_COOLDOWN: 1.4, BOT_RANGE: 12, BOT_SPREAD: 0.2, BOT_AIM: 0.6, GUARD_RANGE: 10,
    MAX_SHOTS: 48, MAX_EVENTS: 48, STEP: 1 / 120,
    TRAP_R: 0.95, TRAP_MAX_S: 25, TRAP_REARM_S: 8, BOT_THINK: [3.5, 8],
    PREP_S: 20, CRATE_HALF: 0.6, CRATE_H: 1.1, MAX_CRATES: 32, CRATE_STOCK: 3, PUSH: 0.55, STAND_CLEAR: 2.4,
    NET_S: 4, NET_SLOW: 0.4,
    WIND: { clear: 0.4, breeze: 1.8, storm: 3.8 }, WEATHER_S: [24, 42], GROUND_WIND: 0.3, AIR_WIND: 0.85, SHOT_WIND: 0.7
  };
  // The tools: speed, upward lob, gravity, life in seconds, hit radius, burst radius (0 for none), cooldown, and how
  // many a full refill holds (0 for no limit).
  const TOOLS = {
    paint: { speed: 24, lift: 2.2, gravity: 9, life: 1.1, r: 0.5, blast: 0, cool: 0.32, max: 0 },
    grenade: { speed: 12, lift: 4.5, gravity: 14, life: 2.2, r: 0.45, blast: 2.6, cool: 0.8, max: 3 },
    rocket: { speed: 28, lift: 0, gravity: 0, life: 1.6, r: 0.55, blast: 3.2, cool: 1.2, max: 1 },
    net: { speed: 15, lift: 3, gravity: 9, life: 1.4, r: 0.75, blast: 0, cool: 0.8, max: 3 }
  };
  const KINDS = ["paint", "grenade", "rocket", "net"];
  // Fort Chaos: x across, z along, the ground at y 0. Blue's fort is at +z, red's at -z. Each block is
  // [x0, x1, z0, z1, top, bottom], bottom 0 unless it floats: a floor, a roof or a wall's upper half. Anything whose
  // top an Ooga can reach is somewhere to stand, so the map has a second storey: a double jump (`JUMP` then `JUMP2`)
  // clears the forts' 2.4 m walls, reaches the stilt huts' floors and the centre deck, and gets into a fort from the
  // alley behind it. Mirrored so neither side is favoured.
  const W = 22, L = 37;
  // A box from its centre and size, for the posts and the crates.
  const at = (x, z, w, d, top, bottom = 0) => [x - w / 2, x + w / 2, z - d / 2, z + d / 2, top, bottom];
  const half = [
    // A fort: back, sides, the front either side of its gate; a crate in the alley behind to climb from.
    [-8, 8, 32, 33, 2.4, 0], [-8, -7, 23, 32, 2.4, 0], [7, 8, 23, 32, 2.4, 0], [-8, -2.6, 23, 24, 2.4, 0], [2.6, 8, 23, 24, 2.4, 0],
    at(0, 34.6, 2, 1.2, 1.1),
    // Crates before the gate, and two tall walls either side of the approach to break the long sight line.
    at(0, 19, 2.4, 1, 1.1), [-6.5, -3, 13, 14, 3.2, 0], [3, 6.5, 13, 14, 3.2, 0],
    // Low cover across the field and the side rocks.
    [-11, -5, 8.5, 9.5, 1.1, 0], [5, 11, 8.5, 9.5, 1.1, 0], [-20, -18, 4, 7, 1.6, 0], [18, 20, 4, 7, 1.6, 0]
  ];
  // A stilt hut on each side of each half: four posts, a floor at 2 m, walls with a window band at eye height, a roof,
  // and its open side facing the field's edge. `s` is the side, -1 or 1.
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? 8 : -14, x1 = s > 0 ? 14 : -8, outer = s > 0 ? x1 : x0, inner = s > 0 ? x0 : x1;
    for (const [px, pz] of [[x0 + 0.3, 11.3], [x1 - 0.3, 11.3], [x0 + 0.3, 15.7], [x1 - 0.3, 15.7]]) half.push(at(px, pz, 0.6, 0.6, 2));
    half.push([x0, x1, 11, 16, 2.3, 2]);
    // The wall facing the middle and the wall toward the fort: a lower band, a window, then an upper band.
    for (const [z0, z1] of [[11, 11.4], [15.6, 16]]) half.push([x0, x1, z0, z1, 3.2, 2.3], [x0, x1, z0, z1, 4.2, 3.85]);
    half.push([Math.min(inner, inner + 0.4 * s), Math.max(inner, inner + 0.4 * s), 11, 16, 4.2, 2.3]);
    // The open side keeps a short rail.
    half.push([Math.min(outer, outer - 0.4 * s), Math.max(outer, outer - 0.4 * s), 11, 12.5, 3.1, 2.3]);
    half.push([x0 - 0.3, x1 + 0.3, 10.7, 16.3, 4.5, 4.2]);
  }
  // The centre deck: four posts, a floor at 2.2 m with gaps in its north and south parapets, a roof, and a crate by
  // each gap to jump from. It is symmetric itself, so it goes in once.
  const BLOCKS = [];
  for (const [px, pz] of [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]]) BLOCKS.push(at(px, pz, 0.8, 0.8, 2.2));
  BLOCKS.push([-3.2, 3.2, -3.2, 3.2, 2.5, 2.2], [-3.4, 3.4, -3.4, 3.4, 4.9, 4.6]);
  for (const s of [-1, 1]) {
    BLOCKS.push([s > 0 ? 2.8 : -3.2, s > 0 ? 3.2 : -2.8, -3.2, 3.2, 3.4, 2.5]);
    for (const [x0, x1] of [[-3.2, -1], [1, 3.2]]) BLOCKS.push([x0, x1, s > 0 ? 2.8 : -3.2, s > 0 ? 3.2 : -2.8, 3.4, 2.5]);
  }
  for (const b of half) BLOCKS.push(b, [b[0], b[1], -b[3], -b[2], b[4], b[5]]);
  BLOCKS.push(at(0, 4.6, 1.6, 1, 1), at(0, -4.6, 1.6, 1, 1));
  const TEAMS = ["blue", "red"];
  // Blue's half, as [x, z]; red's are the same turned half round (`-x, -z`).
  const flip = (list) => list.map(([x, z]) => [-x, -z]);
  const FORT_CRATES = [[-4.6, 20.6], [4.6, 20.6], [-1.6, 29.6], [1.6, 29.6]];
  // Where a defender plugs its gate at the start: one in the gate and two behind it, so pushing won't open it.
  const PLUG = [[0, 21.4], [-1.3, 22.6], [1.3, 22.6]];
  // Where an attacker bot drops its stock: across the alley behind its fort, to make the back way harder.
  const ALLEY = [[-3, 35.6], [3, 35.6], [0, 31.1]];
  const ARENA = {
    W, L, BLOCKS,
    stands: { blue: { x: 0, z: 28 }, red: { x: 0, z: -28 } },
    // Where each side's Oogas start and come back to after a round, two each, inside their fort.
    starts: { blue: [[-3, 26], [3, 26]], red: [[3, -26], [-3, -26]] },
    // Where a defender waits: a little in front of its own gate.
    guard: { blue: { x: 0, z: 17.2 }, red: { x: 0, z: -17.2 } },
    // The quiz pads, turned half round between the halves like everything else.
    traps: [[-10, 13], [10, -13], [10, 13], [-10, -13], [-17, 0], [17, 0], [-4.5, 4.5], [4.5, -4.5]],
    crates: { blue: FORT_CRATES, red: flip(FORT_CRATES) },
    plug: { blue: PLUG, red: flip(PLUG) },
    alley: { blue: ALLEY, red: flip(ALLEY) }
  };
  const other = (team) => team === "blue" ? "red" : "blue";
  const mulberry32 = (seed) => () => {
    seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  // The crates of the sim being stepped; the world queries below see them as boxes alongside the fixed blocks.
  let CRATES = [];
  const CB = [0, 0, 0, 0, 0, 0];
  const crateBox = (c) => { CB[0] = c.x - CONFIG.CRATE_HALF; CB[1] = c.x + CONFIG.CRATE_HALF; CB[2] = c.z - CONFIG.CRATE_HALF; CB[3] = c.z + CONFIG.CRATE_HALF; CB[4] = CONFIG.CRATE_H; CB[5] = 0; return CB; };
  const boxCount = () => BLOCKS.length + CRATES.length;
  // The i-th box: a fixed block, then the live crates (a dead crate is an empty box nothing touches).
  const boxAt = (i) => {
    if (i < BLOCKS.length) return BLOCKS[i];
    const c = CRATES[i - BLOCKS.length];
    if (!c.live) { CB[0] = CB[1] = CB[2] = CB[3] = 1e9; CB[4] = CB[5] = 0; return CB; }
    return crateBox(c);
  };
  // A crouching Ooga is shorter: low cover hides it and a ball thrown at chest height sails over.
  const heightOf = (a) => a.crouch ? CONFIG.CROUCH_H : CONFIG.HEIGHT;
  // Push a body of radius r out of every box it overlaps in height, and the arena's edge, sliding along what it hits.
  // A body standing on a box's top, or passing under a floating one, is clear of it.
  const resolve = (p, r) => {
    const feet = p.y || 0, head = feet + heightOf(p);
    for (let i = 0, n = boxCount(); i < n; i++) {
      const b = boxAt(i);
      if (feet >= b[4] - 0.05 || head <= b[5]) continue;
      const cx = p.x < b[0] ? b[0] : p.x > b[1] ? b[1] : p.x, cz = p.z < b[2] ? b[2] : p.z > b[3] ? b[3] : p.z;
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2), k = (r - d) / d;
        p.x += dx * k;
        p.z += dz * k;
      } else {
        // Inside the box: out by the nearest face.
        const l = p.x - b[0], rt = b[1] - p.x, nn = p.z - b[2], f = b[3] - p.z, m = Math.min(l, rt, nn, f);
        if (m === l) p.x = b[0] - r; else if (m === rt) p.x = b[1] + r; else if (m === nn) p.z = b[2] - r; else p.z = b[3] + r;
      }
    }
    if (p.x < -W + r) p.x = -W + r; else if (p.x > W - r) p.x = W - r;
    if (p.z < -L + r) p.z = -L + r; else if (p.z > L - r) p.z = L - r;
  };
  // The highest top under a body of radius r that its feet at y are on or above: where it stands.
  const groundAt = (x, z, y, r = CONFIG.BODY_R * 0.7) => {
    let g = 0;
    for (let i = 0, n = boxCount(); i < n; i++) {
      const b = boxAt(i);
      if (b[4] > y + 0.05 || b[4] <= g || x < b[0] - r || x > b[1] + r || z < b[2] - r || z > b[3] + r) continue;
      g = b[4];
    }
    return g;
  };
  // The lowest bottom of a floating block over a body, above its feet: what its head would hit.
  const ceilingAt = (x, z, y, r = CONFIG.BODY_R * 0.7) => {
    let c = Infinity;
    for (let i = 0; i < BLOCKS.length; i++) {
      const b = BLOCKS[i];
      if (b[5] <= y + 0.05 || b[5] >= c || x < b[0] - r || x > b[1] + r || z < b[2] - r || z > b[3] + r) continue;
      c = b[5];
    }
    return c;
  };
  // True when a point at height y is inside a box (or below the ground, or past the arena's edge).
  const solidAt = (x, y, z) => {
    if (y <= 0) return true;
    for (let i = 0, n = boxCount(); i < n; i++) {
      const b = boxAt(i);
      if (x > b[0] && x < b[1] && z > b[2] && z < b[3] && y < b[4] && y > b[5]) return true;
    }
    return x < -W || x > W || z < -L || z > L;
  };
  // True when the straight line from (ax, az) to (bx, bz) misses every box, widened by r, that stands on the ground.
  // `over` skips boxes lower than it: a throw at chest height clears crates and low walls.
  const clearLine = (ax, az, bx, bz, r, over = 0) => {
    for (let i = 0, n = boxCount(); i < n; i++) {
      const b = boxAt(i);
      if (b[5] > 1.4 || b[4] < over) continue;
      const x0 = b[0] - r, x1 = b[1] + r, z0 = b[2] - r, z1 = b[3] + r;
      let t0 = 0, t1 = 1;
      const dx = bx - ax, dz = bz - az;
      if (Math.abs(dx) < 1e-9) { if (ax <= x0 || ax >= x1) continue; } else {
        let a = (x0 - ax) / dx, c = (x1 - ax) / dx;
        if (a > c) { const s = a; a = c; c = s; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, c);
        if (t0 >= t1) continue;
      }
      if (Math.abs(dz) < 1e-9) { if (az <= z0 || az >= z1) continue; } else {
        let a = (z0 - az) / dz, c = (z1 - az) / dz;
        if (a > c) { const s = a; a = c; c = s; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, c);
        if (t0 >= t1) continue;
      }
      return false;
    }
    return true;
  };

  // A round. `team` is the player's colour; `seed` seeds the bots and the weather; `prep` the fortifying seconds.
  // `names` names the four Oogas: the player first, then their teammate, then the two rivals (only carried for the
  // scene).
  const create = ({ team = "blue", seed = 1, names = [], prep = CONFIG.PREP_S } = {}) => {
    const rival = other(team);
    const actors = [0, 1, 2, 3].map((i) => ({
      id: i, name: names[i] || null, team: i < 2 ? team : rival, bot: i > 0, role: i === 1 || i === 3 ? "defend" : "attack",
      x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, heading: 0, moving: 0, carrying: null, splat: 0, guard: 0, cooldown: 0,
      blocked: null, stuck: 0, lastX: 0, lastZ: 0, detour: 0, aim: 0, trapped: 0, think: 0, grounded: true, jumps: 0, crouch: false,
      botJump: false, jump2At: 0, tries: 0, progT: 0, lastD: 0, netted: 0, grenade: 0, rocket: 0, net: 0, crates: 0,
      detourX: 0, detourZ: 0, painted: 0, captures: 0, splats: 0
    }));
    const flags = {};
    for (const t of TEAMS) flags[t] = { team: t, state: "home", x: ARENA.stands[t].x, y: 0, z: ARENA.stands[t].z, carrier: null };
    const shots = Array.from({ length: CONFIG.MAX_SHOTS }, () => ({ live: false, kind: "paint", team: null, owner: -1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0 }));
    const crates = Array.from({ length: CONFIG.MAX_CRATES }, () => ({ live: false, team: null, x: 0, z: 0 }));
    const traps = ARENA.traps.map(([x, z]) => ({ x, z, dark: 0 }));
    const events = Array.from({ length: CONFIG.MAX_EVENTS }, () => ({ type: "", team: null, actor: -1, x: 0, y: 0, z: 0 }));
    const weather = { kind: "clear", left: 0, angle: 0, strength: 0, target: 0, x: 0, z: 0 };
    const sim = { team, rival, seed, prepS: prep, prep: 0, rng: mulberry32(seed), actors, flags, shots, crates, traps, events, weather, eventCount: 0, score: { blue: 0, red: 0 }, time: 0, flip: false, over: false, winner: null, acc: 0 };
    reset(sim);
    return sim;
  };
  const emit = (sim, type, team, actor, x, y, z) => {
    if (sim.eventCount >= sim.events.length) return;
    const e = sim.events[sim.eventCount++];
    e.type = type; e.team = team; e.actor = actor; e.x = x; e.y = y; e.z = z;
  };
  const refill = (a) => {
    let more = false;
    for (const k of KINDS) if (TOOLS[k].max && a[k] < TOOLS[k].max) { a[k] = TOOLS[k].max; more = true; }
    return more;
  };
  // A crate at (x, z) if the spot is free of blocks, crates and stands; returns it, or null.
  const freeSpot = (sim, x, z) => {
    const h = CONFIG.CRATE_HALF;
    if (x < -W + h || x > W - h || z < -L + h || z > L - h) return false;
    for (const t of TEAMS) { const s = ARENA.stands[t]; if (Math.hypot(x - s.x, z - s.z) < CONFIG.STAND_CLEAR) return false; }
    for (let i = 0, n = boxCount(); i < n; i++) {
      const b = boxAt(i);
      if (b[5] > CONFIG.CRATE_H) continue;
      if (x + h > b[0] && x - h < b[1] && z + h > b[2] && z - h < b[3]) return false;
    }
    return true;
  };
  const addCrate = (sim, team, x, z) => {
    if (!freeSpot(sim, x, z)) return null;
    for (const c of sim.crates) if (!c.live) { c.live = true; c.team = team; c.x = x; c.z = z; return c; }
    return null;
  };
  // Everyone back to their fort, both flags home, the forts' crates back, the score at nil and the clock at zero.
  const reset = (sim, seed = sim.seed) => {
    sim.seed = seed;
    sim.rng = mulberry32(seed);
    CRATES = sim.crates;
    for (const c of sim.crates) c.live = false;
    for (const t of TEAMS) for (const [x, z] of ARENA.crates[t]) addCrate(sim, t, x, z);
    for (const a of sim.actors) {
      const k = a.id % 2, at = ARENA.starts[a.team][k];
      a.x = a.lastX = at[0]; a.z = a.lastZ = at[1]; a.y = a.vx = a.vz = a.vy = 0;
      a.heading = a.team === "blue" ? Math.PI : 0;
      a.moving = 0; a.grounded = true; a.jumps = 0; a.crouch = a.botJump = false; a.carrying = a.blocked = null;
      a.splat = a.guard = a.cooldown = a.stuck = a.detour = a.aim = a.trapped = a.think = a.painted = a.jump2At = a.tries = a.netted = a.progT = 0;
      a.lastD = Infinity;
      a.captures = a.splats = 0;
      refill(a);
      a.crates = CONFIG.CRATE_STOCK;
    }
    // The bots fortify at once: each side's defender plugs its gate, a rival attacker blocks its alley. The visitor
    // builds their own with `build`.
    for (const a of sim.actors) {
      if (!a.bot) continue;
      const spots = a.role === "defend" ? ARENA.plug[a.team] : a.team === sim.rival ? ARENA.alley[a.team] : null;
      if (!spots) continue;
      for (const [x, z] of spots) if (a.crates > 0 && addCrate(sim, a.team, x, z)) a.crates--;
    }
    for (const t of TEAMS) homeFlag(sim.flags[t]);
    for (const s of sim.shots) s.live = false;
    for (const t of sim.traps) t.dark = 0;
    const w = sim.weather;
    w.kind = "clear"; w.left = CONFIG.WEATHER_S[0]; w.angle = sim.rng() * Math.PI * 2; w.strength = 0; w.target = CONFIG.WIND.clear; w.x = w.z = 0;
    sim.score.blue = sim.score.red = 0;
    sim.time = sim.acc = 0;
    sim.prep = sim.prepS;
    sim.flip = false;
    sim.eventCount = 0;
    sim.over = false;
    sim.winner = null;
    return sim;
  };
  const homeFlag = (f) => {
    f.state = "home";
    f.x = ARENA.stands[f.team].x;
    f.z = ARENA.stands[f.team].z;
    f.y = 0;
    f.carrier = null;
  };
  // A carrier lets go: the flag lies at their feet and counts down home.
  const dropFlag = (sim, a, why) => {
    const f = a.carrying && sim.flags[a.carrying];
    if (!f) return false;
    // It falls to whatever is under the carrier, so a block dropped mid-jump lands on the ground or a roof.
    f.state = "dropped";
    f.x = a.x;
    f.y = groundAt(a.x, a.z, a.y);
    f.z = a.z;
    f.carrier = null;
    a.blocked = f.team;
    a.carrying = null;
    emit(sim, why, f.team, a.id, f.x, 0, f.z);
    return true;
  };
  // The player asks to drop what they carry; false when they carry nothing.
  const drop = (sim, id = 0) => {
    const a = sim.actors[id];
    return !sim.over && a.splat <= 0 && dropFlag(sim, a, "drop");
  };
  // Place a crate a step from actor `id` along `yaw` (its heading if not given), on their own half, from their stock.
  const build = (sim, id = 0, yaw = sim.actors[id].heading) => {
    const a = sim.actors[id];
    if (sim.over || a.splat > 0 || a.trapped > 0 || a.crates <= 0 || !a.grounded) return false;
    const x = a.x + Math.sin(yaw) * 1.4, z = a.z + Math.cos(yaw) * 1.4;
    if ((a.team === "blue" ? z : -z) < 2 || !addCrate(sim, a.team, x, z)) return false;
    a.crates--;
    emit(sim, "build", a.team, id, x, 0, z);
    return true;
  };
  // Out of a quiz bubble (a right answer, or the bot's think time up): fresh-paint protection follows, as after a splat.
  const escape = (sim, id = 0, why = "escape") => {
    const a = sim.actors[id];
    if (a.trapped <= 0) return false;
    a.trapped = a.think = 0;
    a.guard = CONFIG.GUARD_S;
    emit(sim, why, a.team, id, a.x, 1, a.z);
    return true;
  };
  const spring = (sim, a, t) => {
    a.trapped = CONFIG.TRAP_MAX_S;
    a.think = a.bot ? CONFIG.BOT_THINK[0] + sim.rng() * (CONFIG.BOT_THINK[1] - CONFIG.BOT_THINK[0]) : 0;
    a.vx = a.vz = 0;
    a.x = t.x; a.z = t.z;
    t.dark = CONFIG.TRAP_REARM_S;
    emit(sim, "trap", a.team, a.id, t.x, 0, t.z);
    dropFlag(sim, a, "knock");
  };
  // Throw tool `kind` from actor `id` along `yaw` (radians, 0 toward +z) with an upward `pitch` added to the lob.
  const fire = (sim, id, yaw, pitch = 0, kind = "paint") => {
    const a = sim.actors[id], tool = TOOLS[kind];
    if (sim.over || !tool || a.splat > 0 || a.trapped > 0 || a.cooldown > 0 || (tool.max && a[kind] <= 0)) return false;
    let s = null;
    for (let i = 0; i < sim.shots.length && !s; i++) if (!sim.shots[i].live) s = sim.shots[i];
    if (!s) return false;
    const c = Math.cos(pitch), sx = Math.sin(yaw) * c, sz = Math.cos(yaw) * c;
    s.live = true; s.kind = kind; s.team = a.team; s.owner = id; s.t = 0;
    s.x = a.x + sx * 0.5; s.z = a.z + sz * 0.5; s.y = a.y + (a.crouch ? CONFIG.CROUCH_H - 0.25 : CONFIG.SHOT_Y);
    s.vx = sx * tool.speed; s.vz = sz * tool.speed; s.vy = tool.lift + Math.sin(pitch) * tool.speed;
    if (tool.max) a[kind]--;
    a.cooldown = a.bot ? Math.max(tool.cool, CONFIG.BOT_COOLDOWN) : tool.cool;
    a.heading = yaw;
    emit(sim, kind === "paint" ? "fire" : "throw", a.team, id, s.x, s.y, s.z);
    return true;
  };
  const splat = (sim, a) => {
    a.splat = CONFIG.SPLAT_S;
    a.guard = a.netted = 0;
    a.vx = a.vz = 0;
    a.splats++;
    a.painted = Math.min(1, a.painted + 0.34);
    emit(sim, "splat", a.team, a.id, a.x, a.y + 1, a.z);
    dropFlag(sim, a, "knock");
  };
  const open = (a) => a.splat <= 0 && a.guard <= 0 && a.trapped <= 0;
  // A grenade or rocket bursts: every open rival within its radius is splatted.
  const burst = (sim, s) => {
    const r = TOOLS[s.kind].blast;
    emit(sim, s.kind === "rocket" ? "boom" : "pop", s.team, s.owner, s.x, Math.max(0.05, s.y), s.z);
    for (const a of sim.actors) {
      if (a.team === s.team || !open(a)) continue;
      const dy = s.y - (a.y + 0.9);
      if ((a.x - s.x) ** 2 + (a.z - s.z) ** 2 + dy * dy < r * r) splat(sim, a);
    }
  };

  // The bots: an attacker goes for the flag and a defender waits at its gate, both breaking off to send a dropped
  // flag of theirs home or to chase the Ooga carrying it, and both throw at the nearest rival in range.
  const goal = { x: 0, z: 0 };
  const botGoal = (sim, a) => {
    const own = sim.flags[a.team], theirs = sim.flags[other(a.team)], stand = ARENA.stands[a.team];
    if (sim.prep > 0) {
      // Fortifying: defenders at the gate, attackers at the halfway line.
      if (a.role === "defend") { goal.x = ARENA.guard[a.team].x; goal.z = ARENA.guard[a.team].z; }
      else { goal.x = a.id % 2 ? -6 : 6; goal.z = a.team === "blue" ? 2.5 : -2.5; }
      return;
    }
    if (a.carrying) { goal.x = stand.x; goal.z = stand.z; return; }
    if (own.state === "dropped") { goal.x = own.x; goal.z = own.z; return; }
    if (own.state === "carried" && sim.actors[own.carrier].team !== a.team) { const c = sim.actors[own.carrier]; goal.x = c.x; goal.z = c.z; return; }
    if (a.role === "defend") {
      let near = null, best = CONFIG.GUARD_RANGE * CONFIG.GUARD_RANGE;
      for (const b of sim.actors) {
        if (b.team === a.team || b.splat > 0) continue;
        const d = (b.x - stand.x) ** 2 + (b.z - stand.z) ** 2;
        if (d < best) { best = d; near = b; }
      }
      if (near) { goal.x = near.x; goal.z = near.z; return; }
      goal.x = ARENA.guard[a.team].x; goal.z = ARENA.guard[a.team].z;
      return;
    }
    if (theirs.state === "carried" && sim.actors[theirs.carrier].team === a.team) {
      // A teammate has it: walk alongside them home.
      const c = sim.actors[theirs.carrier];
      goal.x = c.x + (a.x < c.x ? -2 : 2); goal.z = c.z;
      return;
    }
    goal.x = theirs.x; goal.z = theirs.z;
  };
  // Eight headings round the wanted one, nearest first; the first that walks clear for a probe's length wins.
  const PROBE = 2.6, FANS = [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4, Math.PI];
  const steer = (sim, a, wantX, wantZ) => {
    const dx = wantX - a.x, dz = wantZ - a.z, d = Math.hypot(dx, dz);
    if (d < 0.3) return 0;
    if (a.y > 0.2 || clearLine(a.x, a.z, wantX, wantZ, CONFIG.BODY_R * 0.9)) return Math.atan2(dx, dz);
    // The two sides fan opposite ways, as the field is turned half round between them, so neither steers better.
    const base = Math.atan2(dx, dz), probe = Math.min(PROBE, d), hand = (a.id % 2 ? 1 : -1) * (a.team === "blue" ? 1 : -1);
    for (let i = 0; i < FANS.length; i++) {
      const h = base + FANS[i] * hand;
      if (clearLine(a.x, a.z, a.x + Math.sin(h) * probe, a.z + Math.cos(h) * probe, CONFIG.BODY_R)) return h;
    }
    return base;
  };
  // A grenade's pitch to land about `range` metres off: the closest of a few tries by its own ballistics.
  const lobPitch = (range) => {
    const g = TOOLS.grenade;
    let best = 0.3, err = Infinity;
    for (let p = -0.2; p <= 0.9; p += 0.05) {
      const vy = g.lift + Math.sin(p) * g.speed, t = (vy + Math.sqrt(vy * vy + 2 * g.gravity * CONFIG.SHOT_Y)) / g.gravity;
      const e = Math.abs(Math.cos(p) * g.speed * t - range);
      if (e < err) { err = e; best = p; }
    }
    return best;
  };
  const thinkBot = (sim, a, dt) => {
    if (a.splat > 0 || a.trapped > 0) return;
    if (a.detour > 0) {
      a.detour -= dt;
      goal.x = a.detourX; goal.z = a.detourZ;
    } else botGoal(sim, a);
    const d = Math.hypot(goal.x - a.x, goal.z - a.z);
    // An autopiloted player (`auto`, the suite's and the debug handle's) runs at the player's sprint.
    const speed = (a.bot === "auto" ? CONFIG.SPEED * CONFIG.SPRINT : CONFIG.BOT_SPEED) * (a.carrying ? CONFIG.CARRY : 1) * (a.netted > 0 ? CONFIG.NET_SLOW : 1);
    if (d > 0.4) {
      const h = steer(sim, a, goal.x, goal.z);
      a.vx = Math.sin(h) * speed; a.vz = Math.cos(h) * speed;
    } else a.vx = a.vz = 0;
    // Stuck, judged by progress toward the goal over each second: first a double jump over whatever is in the way
    // (twice), then a random spot nearby for a moment.
    a.progT += dt;
    if (a.progT >= 1) {
      a.progT = 0;
      const stalled = d > 1.5 && d > a.lastD - 0.4 && a.detour <= 0;
      a.lastD = d;
      if (stalled && a.grounded && a.tries < 2 && a.netted <= 0) {
        a.tries++;
        a.botJump = true;
        a.jump2At = sim.time + 0.28;
      } else if (stalled) {
        a.tries = 0;
        a.detour = 1.2;
        const ang = sim.rng() * Math.PI * 2;
        a.detourX = a.x + Math.sin(ang) * 5; a.detourZ = a.z + Math.cos(ang) * 5;
      } else if (!stalled) a.tries = 0;
    }
    if (a.jump2At && sim.time >= a.jump2At) { a.jump2At = 0; a.botJump = true; }
    // Throw at the nearest open rival in range, after holding them in sight for `BOT_AIM` (so a rival who runs past
    // gets a moment, and a bot just back from a splat can't throw at once): a net at a carrier, now and then a grenade
    // or a rocket, otherwise paint, leading the run a little with a seeded wobble.
    if (a.cooldown <= 0 && sim.prep <= 0) {
      let t = null, best = CONFIG.BOT_RANGE * CONFIG.BOT_RANGE;
      for (const b of sim.actors) {
        if (b.team === a.team || !open(b)) continue;
        const dd = (b.x - a.x) ** 2 + (b.z - a.z) ** 2;
        if (dd < best && clearLine(a.x, a.z, b.x, b.z, 0.05, CONFIG.SHOT_Y)) { best = dd; t = b; }
      }
      a.aim = t ? a.aim + dt : 0;
      if (t && a.aim >= CONFIG.BOT_AIM) {
        a.aim = 0;
        const dist = Math.sqrt(best), roll = sim.rng();
        const kind = t.carrying && a.net > 0 ? "net" : dist > 6 && a.grenade > 0 && roll < 0.25 ? "grenade" : dist < 14 && a.rocket > 0 && roll > 0.88 ? "rocket" : "paint";
        const lead = dist / TOOLS[kind].speed;
        const yaw = Math.atan2(t.x + t.vx * lead - a.x, t.z + t.vz * lead - a.z) + (sim.rng() - 0.5) * 2 * CONFIG.BOT_SPREAD;
        // Paint lobs flatter at range so the ball arrives near chest height; a grenade arcs to its range.
        const pitch = kind === "grenade" ? lobPitch(dist) : kind === "rocket" ? -0.03 : Math.min(0.12, Math.max(-0.12, (dist - 8) * -0.006));
        fire(sim, a.id, yaw, pitch, kind);
      }
    }
  };

  // Flags: pickups, returns and captures for one actor, and its refill at home.
  const touchFlags = (sim, a) => {
    if (a.splat > 0 || a.trapped > 0) return;
    if (a.guard <= 0 && a.y < 0.3) {
      for (const t of sim.traps) {
        if (t.dark <= 0 && (a.x - t.x) ** 2 + (a.z - t.z) ** 2 < CONFIG.TRAP_R * CONFIG.TRAP_R) { spring(sim, a, t); return; }
      }
    }
    const stand = ARENA.stands[a.team], home = a.y < 1.4 && (a.x - stand.x) ** 2 + (a.z - stand.z) ** 2 < CONFIG.STAND_R * CONFIG.STAND_R;
    if (home && refill(a)) emit(sim, "refill", a.team, a.id, a.x, a.y, a.z);
    if (sim.prep > 0) return;
    const r2 = CONFIG.PICK_R * CONFIG.PICK_R;
    if (a.blocked) {
      const f = sim.flags[a.blocked];
      if (f.state !== "dropped" || (a.x - f.x) ** 2 + (a.z - f.z) ** 2 > r2) a.blocked = null;
    }
    const own = sim.flags[a.team], theirs = sim.flags[other(a.team)];
    // Picking up: the rivals' flag from its stand or the ground, or your own team's flag where it was dropped.
    for (const f of [theirs, own]) {
      if (a.carrying || a.blocked === f.team || f.state === "carried" || (f === own && f.state !== "dropped")) continue;
      const fy = f.state === "dropped" ? f.y : 0;
      if (a.y > fy + 1.4 || a.y < fy - 0.5 || (a.x - f.x) ** 2 + (a.z - f.z) ** 2 >= r2) continue;
      f.state = "carried";
      f.carrier = a.id;
      a.carrying = f.team;
      emit(sim, f === own ? "rescue" : "pickup", f.team, a.id, f.x, 0, f.z);
    }
    // Your own flag carried back onto your stand is home again.
    if (a.carrying === a.team && home) {
      a.carrying = null;
      homeFlag(own);
      emit(sim, "return", own.team, a.id, own.x, 0, own.z);
    }
    if (a.carrying === theirs.team && home && own.state === "home") {
      const f = sim.flags[a.carrying];
      a.carrying = null;
      homeFlag(f);
      homeFlag(own);
      a.captures++;
      sim.score[a.team]++;
      emit(sim, "capture", a.team, a.id, stand.x, 0, stand.z);
      if (sim.score[a.team] >= CONFIG.CAPTURES) {
        sim.over = true;
        sim.winner = a.team;
        emit(sim, "win", a.team, a.id, stand.x, 0, stand.z);
      }
    }
  };

  // A grounded Ooga walking into a crate shoves it along the side it pushed, at `PUSH` of its own step; the crate
  // stops at anything else, and then the Ooga stops too.
  const pushCrates = (sim, a) => {
    if (a.y > 0.05) return;
    const r = CONFIG.BODY_R, h = CONFIG.CRATE_HALF;
    for (const c of sim.crates) {
      if (!c.live) continue;
      const cx = Math.max(c.x - h, Math.min(a.x, c.x + h)), cz = Math.max(c.z - h, Math.min(a.z, c.z + h));
      const dx = a.x - cx, dz = a.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r || d2 < 1e-9) continue;
      const d = Math.sqrt(d2), pen = (r - d) * CONFIG.PUSH;
      const ox = c.x, oz = c.z;
      if (Math.abs(dx) > Math.abs(dz)) c.x -= Math.sign(dx) * pen; else c.z -= Math.sign(dz) * pen;
      // Back to where it was if the new spot overlaps a block, another crate or a stand.
      c.live = false;
      const ok = freeSpot(sim, c.x, c.z);
      c.live = true;
      if (!ok) { c.x = ox; c.z = oz; } else if (Math.abs(c.x - ox) + Math.abs(c.z - oz) > 1e-6) a.pushing = true;
    }
  };
  // The weather: a seeded run of clear, breezy and stormy spells, the wind easing toward each spell's strength,
  // wandering in direction and gusting.
  const stepWeather = (sim, dt) => {
    const w = sim.weather;
    w.left -= dt;
    if (w.left <= 0) {
      const r = sim.rng();
      w.kind = r < 0.4 ? "clear" : r < 0.75 ? "breeze" : "storm";
      w.target = CONFIG.WIND[w.kind];
      w.left = CONFIG.WEATHER_S[0] + sim.rng() * (CONFIG.WEATHER_S[1] - CONFIG.WEATHER_S[0]);
      emit(sim, "weather", null, -1, 0, 0, 0);
    }
    w.strength += (w.target - w.strength) * Math.min(1, dt * 0.4);
    w.angle += Math.sin(sim.time * 0.13 + sim.seed) * dt * 0.25;
    const gust = 1 + 0.35 * Math.sin(sim.time * 1.7 + Math.sin(sim.time * 0.6) * 2);
    w.x = Math.cos(w.angle) * w.strength * gust;
    w.z = Math.sin(w.angle) * w.strength * gust;
  };

  // One fixed step. `input` is the player's: `x`, `z` a world-space move direction of length up to 1, `sprint`,
  // `jump` (a press), `crouch` (held). The scene throws, drops and builds through `fire`, `drop` and `build`.
  const tick = (sim, dt, input) => {
    CRATES = sim.crates;
    sim.time += dt;
    const prepWas = sim.prep;
    if (sim.prep > 0) {
      sim.prep = Math.max(0, sim.prep - dt);
      if (prepWas > 0 && sim.prep === 0) emit(sim, "go", null, -1, 0, 0, 0);
    }
    stepWeather(sim, dt);
    const wind = sim.weather;
    // Each step takes the four in the other order from the last, so neither side always moves, picks up or reaches a
    // dropped block first.
    sim.flip = !sim.flip;
    for (let n = 0; n < 4; n++) {
      const a = sim.actors[sim.flip ? 3 - n : n];
      if (a.cooldown > 0) a.cooldown -= dt;
      if (a.netted > 0) { a.netted -= dt; if (a.netted <= 0) { a.netted = 0; emit(sim, "unnet", a.team, a.id, a.x, a.y, a.z); } }
      if (a.splat > 0) {
        a.splat -= dt;
        a.vx = a.vz = 0;
        if (a.splat <= 0) { a.splat = 0; a.guard = CONFIG.GUARD_S; emit(sim, "clean", a.team, a.id, a.x, 1, a.z); }
      } else if (a.trapped > 0) {
        a.trapped -= dt;
        a.vx = a.vz = 0;
        if (a.bot && a.think > 0 && (a.think -= dt) <= 0) escape(sim, a.id);
        else if (a.trapped <= 0) { a.trapped = 0.001; escape(sim, a.id, "timeout"); }
      } else if (a.guard > 0) a.guard = Math.max(0, a.guard - dt);
      a.painted = Math.max(0, a.painted - dt * 0.05);
      const free = a.splat <= 0 && a.trapped <= 0;
      let jump = false;
      if (a.bot) {
        thinkBot(sim, a, dt);
        jump = a.botJump;
        a.botJump = false;
      } else if (free) {
        a.crouch = !!input.crouch && a.grounded;
        const speed = CONFIG.SPEED * (a.crouch ? CONFIG.CROUCH_SPEED : a.carrying ? CONFIG.CARRY : input.sprint ? CONFIG.SPRINT : 1) * (a.netted > 0 ? CONFIG.NET_SLOW : 1);
        const tx = input.x * speed, tz = input.z * speed, k = Math.min(1, CONFIG.ACCEL * dt);
        a.vx += (tx - a.vx) * k;
        a.vz += (tz - a.vz) * k;
        jump = !!input.jump;
      }
      // A jump from the ground, and one more in the air; carrying the block weighs both down a little, a net stops both.
      if (jump && free && a.netted <= 0) {
        const k = a.carrying ? CONFIG.CARRY_JUMP : 1;
        if (a.grounded) { a.vy = CONFIG.JUMP * k; a.grounded = false; a.jumps = 1; emit(sim, "jump", a.team, a.id, a.x, a.y, a.z); }
        else if (a.jumps > 0) { a.vy = CONFIG.JUMP2 * k; a.jumps = 0; emit(sim, "jump2", a.team, a.id, a.x, a.y, a.z); }
      }
      a.x += a.vx * dt;
      a.z += a.vz * dt;
      // The wind shoves anyone not stuck fast: hard in the air, a little underfoot.
      if (free) {
        const k = (a.grounded ? CONFIG.GROUND_WIND : CONFIG.AIR_WIND) * dt;
        a.x += wind.x * k;
        a.z += wind.z * k;
      }
      // Fortifying keeps each side to its own half.
      if (sim.prep > 0) {
        if (a.team === "blue" && a.z < 1) a.z = 1;
        else if (a.team === "red" && a.z > -1) a.z = -1;
      }
      a.pushing = false;
      pushCrates(sim, a);
      resolve(a, CONFIG.BODY_R);
      // Height: fall onto whatever is underneath, and stop at a floor overhead.
      const ground = groundAt(a.x, a.z, a.y);
      if (a.vy !== 0 || a.y > ground) {
        a.vy -= CONFIG.FALL * dt;
        a.y += a.vy * dt;
        const ceiling = ceilingAt(a.x, a.z, a.y - a.vy * dt);
        if (a.vy > 0 && a.y + heightOf(a) > ceiling) { a.y = ceiling - heightOf(a); a.vy = 0; }
        if (a.y <= ground) {
          if (!a.grounded && a.vy < -1) emit(sim, "land", a.team, a.id, a.x, ground, a.z);
          a.y = ground; a.vy = 0; a.grounded = true; a.jumps = 0;
        } else a.grounded = false;
      } else a.grounded = true;
      const sp = Math.hypot(a.vx, a.vz);
      a.moving = sp;
      if (sp > 0.5 && a.cooldown <= (a.bot ? CONFIG.BOT_COOLDOWN : TOOLS.paint.cool) - 0.25) a.heading = Math.atan2(a.vx, a.vz);
      if (a.carrying) { const f = sim.flags[a.carrying]; f.x = a.x; f.z = a.z; }
    }
    for (let n = 0; n < 4; n++) touchFlags(sim, sim.actors[sim.flip ? 3 - n : n]);
    for (const t of sim.traps) if (t.dark > 0) t.dark -= dt;
    // Throws in flight: gravity and the wind, then a rival in the way or anything solid.
    for (const s of sim.shots) {
      if (!s.live) continue;
      const tool = TOOLS[s.kind];
      s.t += dt;
      s.vy -= tool.gravity * dt;
      const drift = (s.kind === "rocket" ? 0.3 : 1) * CONFIG.SHOT_WIND * dt;
      s.vx += wind.x * drift; s.vz += wind.z * drift;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      let hit = null;
      for (const a of sim.actors) {
        if (a.team === s.team || !open(a)) continue;
        const dy = s.y - a.y;
        if (dy > -0.1 && dy < heightOf(a) + 0.15 && (s.x - a.x) ** 2 + (s.z - a.z) ** 2 < tool.r * tool.r) { hit = a; break; }
      }
      const solid = !hit && solidAt(s.x, s.y, s.z), spent = s.t > tool.life;
      if (!hit && !solid && !spent) continue;
      s.live = false;
      if (tool.blast) burst(sim, s);
      else if (hit && s.kind === "net") {
        hit.netted = CONFIG.NET_S;
        emit(sim, "net", hit.team, hit.id, hit.x, hit.y + 1, hit.z);
      } else if (hit) splat(sim, hit);
      else emit(sim, s.kind === "net" ? "netmiss" : "miss", s.team, s.owner, s.x, Math.max(0.02, s.y), s.z);
    }
  };
  // Advance by any frame time in fixed substeps (at most four a call, as the other games do). Stops when the round is
  // decided.
  const step = (sim, dt, input) => {
    sim.acc = Math.min(sim.acc + dt, CONFIG.STEP * 4);
    while (sim.acc >= CONFIG.STEP && !sim.over) {
      sim.acc -= CONFIG.STEP;
      tick(sim, CONFIG.STEP, input);
    }
  };
  BL.blockSim = { CONFIG, TOOLS, KINDS, ARENA, TEAMS, other, create, reset, step, tick, fire, drop, build, escape, clearLine, solidAt, resolve, groundAt };
})();
