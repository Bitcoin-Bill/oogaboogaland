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
// dies, nobody is removed, nobody has health. First team to the round's `target` captures wins (`CAPTURES` unless the
// player who starts it picks another).
//
// Crates: wooden boxes anyone can push by walking into them and stand on. Each fort starts with a few, each team has
// a stock to place (`build`) on its own half, and a round opens with `PREP_S` of fortifying, each side kept to its
// own half and the flags locked, so the bots plug their gates and the visitor can wall theirs: getting in then takes
// a push or a double jump. A crate never lands on a stand. An Ooga can pick a crate up (`grab`), carry it overhead,
// set it down or stack it up to three high (`grab` again), or throw it (`fire` with "crate"): a crate that hits a
// rival stuns them as a paint hit does, and lands as a crate where it falls.
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
    JUMP: 6.5, JUMP2: 6.5, FALL: 16, CARRY_JUMP: 1, CROUCH_H: 1.05, CROUCH_SPEED: 0.55,
    CAPTURES: 3, SPLAT_S: 2, GUARD_S: 2.5, PICK_R: 1.3, STAND_R: 1.7, BODY_R: 0.45, HEIGHT: 1.7,
    SPEED: 6.2, SPRINT: 1.55, CARRY: 0.88, SPRINT_S: 4, SPRINT_REST: 0.8, SPRINT_REFILL: 5, SPRINT_MIN: 0.3, BOT_SPEED: 5.5, ACCEL: 30,
    SHOT_Y: 1.3, BOT_COOLDOWN: 1.4, BOT_RANGE: 12, BOT_SPREAD: 0.2, BOT_AIM: 0.6, GUARD_RANGE: 10,
    MAX_SHOTS: 48, MAX_EVENTS: 48, STEP: 1 / 120,
    TRAP_R: 0.95, TRAP_MAX_S: 25, TRAP_REARM_S: 8, BOT_THINK: [3.5, 8], MAX_SIDE: 5,
    PREP_S: 20, CRATE_HALF: 0.6, CRATE_H: 1.1, MAX_CRATES: 32, CRATE_STOCK: 3, PUSH: 0.55, STAND_CLEAR: 2.4,
    NET_S: 4, NET_SLOW: 0.4, PASS_SPEED: 13, PASS_LIFT: 5, PASS_GRAVITY: 13, PASS_SAFE: 0.45, CATCH_R: 1.5,
    WIND: { clear: 0.4, breeze: 1.8, storm: 3.8 }, WEATHER_S: [24, 42], GROUND_WIND: 0.3, AIR_WIND: 0.85, SHOT_WIND: 0.7,
    TRAMP_R: 1.0, BOUNCE: 13.5, STEP_UP: 0.45, FIRE_R: 0.95, BURN_HOPS: 3, BURN_SLOW: 0.25,
    GOLD_GUNS: 2, CATAPULT_R: 1.0, LAUNCH_H: 13, CHUTE_FALL: 2.8, CHUTE_SPEED: 3.4, PEEL_R: 0.55, SLIP_S: 1.5, SLIP_SPIN: 13, PEEL_REARM: 8,
    POWER_R: 1.1, POWER_RESPAWN: 20, BOOTS_S: 6, BOOTS: 1.5, HALVING_S: 12, COLD_S: 12, LASER_S: 5, LASER_COOL: 0.08,
    TOWER_TOP: 6.4, CLIMB: 3.6, ZIP_SPEED: 15, ZIP_HANG: 1.9, ZIP_R: 1.6, CACHE_S: 15, CACHE_R: 1.2
  };
  // The tools: speed, upward lob, gravity, life in seconds, hit radius, burst radius (0 for none), cooldown, and how
  // many a full refill holds (0 for no limit).
  const TOOLS = {
    paint: { speed: 24, lift: 2.2, gravity: 9, life: 1.1, r: 0.5, blast: 0, cool: 0.32, max: 0 },
    grenade: { speed: 12, lift: 4.5, gravity: 14, life: 2.2, r: 0.45, blast: 2.6, cool: 0.8, max: 3 },
    rocket: { speed: 28, lift: 0, gravity: 0, life: 1.6, r: 0.55, blast: 3.2, cool: 1.2, max: 1 },
    net: { speed: 15, lift: 3, gravity: 9, life: 1.4, r: 0.75, blast: 0, cool: 0.8, max: 3 },
    crate: { speed: 12, lift: 2.5, gravity: 14, life: 2.5, r: 0.9, blast: 0, cool: 0.6, max: 0 },
    // The sniper rifle: it stays in the sniper towers, so it fires only from a tower's platform; fast, flat and long.
    sniper: { speed: 60, lift: 0, gravity: 0.6, life: 0.85, r: 0.35, blast: 0, cool: 1.1, max: 0 },
    // The Golden AK: semi-automatic paint, one ball a click with almost no wait, never empty. There are `GOLD_GUNS` a
    // round: mining a block wins one while any are left, and netting whoever holds one takes it.
    gold: { speed: 34, lift: 1.4, gravity: 7, life: 1.2, r: 0.5, blast: 0, cool: 0.11, max: 0 }
  };
  const KINDS = ["paint", "grenade", "rocket", "net"];
  // The maps. A map is its blocks, each [x0, x1, z0, z1, top, bottom] (bottom 0 unless it floats: a floor, a roof or
  // a wall's upper half), and the places on it. x runs across, z along, the ground is at y 0, blue's end is at +z and
  // red's at -z, and red's half is blue's turned half round (`turned`, `flip`), so neither side is favoured. Anything
  // whose top an Ooga can reach is somewhere to stand; a step no higher than `STEP_UP` is walked up.
  const W = 22, L = 37;
  // A box from its centre and size, for the posts and the crates.
  const at = (x, z, w, d, top, bottom = 0) => [x - w / 2, x + w / 2, z - d / 2, z + d / 2, top, bottom];
  // Red's half is blue's turned half round: every box, and every spot, mirrored through the centre.
  const turned = (b) => [-b[1], -b[0], -b[3], -b[2], b[4], b[5]];
  const flip = (list) => list.map(([x, z]) => [-x, -z]);
  const TEAMS = ["blue", "red"];
  // A sniper tower beside each end, on every map: four posts, a platform at `TOWER_TOP`, a parapet with a gap over the
  // ladder on the side facing in, and no roof, so the camera sees a sniper. The ladder is a climb zone, not a block (`ladders`); the rifle
  // rack is on the platform; the zipline leaves from the platform's gap side and runs down into the other end (`zips`).
  const TOP = CONFIG.TOWER_TOP, RAIL = TOP + 0.9;
  const TOWER = [-19, -16, 24.5, 27.5], GAP = [25.4, 26.6];
  const towerBlocks = ([x0, x1, z0, z1]) => [
    [x0, x0 + 0.4, z0, z0 + 0.4, TOP - 0.3, 0], [x1 - 0.4, x1, z0, z0 + 0.4, TOP - 0.3, 0], [x0, x0 + 0.4, z1 - 0.4, z1, TOP - 0.3, 0], [x1 - 0.4, x1, z1 - 0.4, z1, TOP - 0.3, 0],
    [x0, x1, z0, z1, TOP, TOP - 0.3],
    [x0, x0 + 0.25, z0, z1, RAIL, TOP], [x0, x1, z0, z0 + 0.25, RAIL, TOP], [x0, x1, z1 - 0.25, z1, RAIL, TOP],
    [x1 - 0.25, x1, z0, GAP[0], RAIL, TOP], [x1 - 0.25, x1, GAP[1], z1, RAIL, TOP]
  ];
  // A map from blue's half (`half`, turned for red) and its middle (`middle`, put in once), with the towers added.
  const turnedMap = (half, middle, steps = []) => {
    const BLOCKS = [...middle], stepSet = new Set();
    for (const b of half) { const r = turned(b); BLOCKS.push(b, r); if (steps.includes(b)) stepSet.add(b).add(r); }
    for (const b of towerBlocks(TOWER)) BLOCKS.push(b, turned(b));
    return { BLOCKS, steps: stepSet };
  };
  const both = (list) => ({ blue: list, red: flip(list) });

  // Fort Chaos: a stone fort at each end, a double jump (`JUMP` then `JUMP2`) clearing its 2.4 m walls, stilt huts
  // and a centre deck for a second storey, and the alley behind each fort as a back way in.
  const fortChaos = () => {
    const half = [
      // A fort: back, sides, the front either side of its gate; a crate in the alley behind to climb from.
      [-8, 8, 32, 33, 2.4, 0], [-8, -7, 23, 32, 2.4, 0], [7, 8, 23, 32, 2.4, 0], [-8, -2.6, 23, 24, 2.4, 0], [2.6, 8, 23, 24, 2.4, 0],
      at(0, 34.6, 2, 1.2, 1.1),
      // Crates before the gate, and two tall walls either side of the approach to break the long sight line.
      at(0, 19, 2.4, 1, 1.1), [-6.5, -3, 13, 14, 3.2, 0], [3, 6.5, 13, 14, 3.2, 0],
      // Low cover across the field and the side rocks.
      [-11, -5, 8.5, 9.5, 1.1, 0], [5, 11, 8.5, 9.5, 1.1, 0], [-20, -18, 4, 7, 1.6, 0], [18, 20, 4, 7, 1.6, 0]
    ];
    // A stilt hut on each side of each half: four posts, a floor at 2 m, walls with a window band at eye height, open
    // to the sky so the camera can see in, and its open side facing the field's edge. `s` is the side, -1 or 1.
    for (const s of [-1, 1]) {
      const x0 = s > 0 ? 8 : -14, x1 = s > 0 ? 14 : -8, outer = s > 0 ? x1 : x0, inner = s > 0 ? x0 : x1;
      for (const [px, pz] of [[x0 + 0.3, 11.3], [x1 - 0.3, 11.3], [x0 + 0.3, 15.7], [x1 - 0.3, 15.7]]) half.push(at(px, pz, 0.6, 0.6, 2));
      half.push([x0, x1, 11, 16, 2.3, 2]);
      // The wall facing the middle and the wall toward the fort: a lower band, a window, then an upper band.
      for (const [z0, z1] of [[11, 11.4], [15.6, 16]]) half.push([x0, x1, z0, z1, 3.2, 2.3], [x0, x1, z0, z1, 4.2, 3.85]);
      half.push([Math.min(inner, inner + 0.4 * s), Math.max(inner, inner + 0.4 * s), 11, 16, 4.2, 2.3]);
      // The open side keeps a short rail.
      half.push([Math.min(outer, outer - 0.4 * s), Math.max(outer, outer - 0.4 * s), 11, 12.5, 3.1, 2.3]);
    }
    // The centre deck: four posts, a floor at 2.2 m with gaps in its north and south parapets, open to the sky, and a
    // crate by each gap to jump from. It is symmetric itself, so it goes in once.
    const middle = [];
    for (const [px, pz] of [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]]) middle.push(at(px, pz, 0.8, 0.8, 2.2));
    middle.push([-3.2, 3.2, -3.2, 3.2, 2.5, 2.2]);
    for (const s of [-1, 1]) {
      middle.push([s > 0 ? 2.8 : -3.2, s > 0 ? 3.2 : -2.8, -3.2, 3.2, 3.4, 2.5]);
      for (const [x0, x1] of [[-3.2, -1], [1, 3.2]]) middle.push([x0, x1, s > 0 ? 2.8 : -3.2, s > 0 ? 3.2 : -2.8, 3.4, 2.5]);
    }
    middle.push(at(0, 4.6, 1.6, 1, 1), at(0, -4.6, 1.6, 1, 1));
    // Fort Chaos mirrors its halves end to end rather than turning them; its huts and walls are symmetric across.
    const BLOCKS = [...middle];
    for (const b of half) BLOCKS.push(b, [b[0], b[1], -b[3], -b[2], b[4], b[5]]);
    for (const b of towerBlocks(TOWER)) BLOCKS.push(b, turned(b));
    return {
      id: "fort", name: "Fort Chaos", BLOCKS, steps: new Set(),
      // Where a defender waits: a little in front of its own gate.
      guard: { blue: { x: 0, z: 17.2 }, red: { x: 0, z: -17.2 } },
      // The quiz pads.
      traps: [[-10, 13], [10, -13], [10, 13], [-10, -13], [-17, 0], [17, 0], [-4.5, 4.5], [4.5, -4.5]],
      crates: both([[-4.6, 20.6], [4.6, 20.6], [-1.6, 29.6], [1.6, 29.6]]),
      // Where a defender plugs its gate at the start: one in the gate and two behind it, so pushing won't open it.
      plug: both([[0, 21.4], [-1.3, 22.6], [1.3, 22.6]]),
      // Where an attacker bot drops its stock: across the alley behind its fort, to make the back way harder.
      alley: both([[-3, 35.6], [3, 35.6], [0, 31.1]]),
      // Ammo caches: one on each stilt hut's floor and one on the centre deck. A cache refills grenades, rockets and
      // nets like a stand, then goes dark for `CACHE_S`.
      caches: [[12.5, 2.3, 13.5], [-12.5, 2.3, 13.5], [12.5, 2.3, -13.5], [-12.5, 2.3, -13.5], [0, 2.5, 0]],
      // Trampolines flush with the ground: landing on one (or walking onto it) sends an Ooga flying, carrying or not,
      // with the double jump still to come.
      tramps: [[-15, 19], [15, -19], [12, 4], [-12, -4]],
      // Power-up spots, each holding one of `POWERS` until someone runs through it.
      powers: [[-6, 18], [6, -18], [16, 11], [-16, -11], [0, 9.5], [0, -9.5]],
      // The campfire the potato Oogas dance round, out on the halfway line by the field's edge.
      fire: [-20, 0],
      // Each side's catapult, inside its own fort beside the stand.
      catapults: both([[-5, 29.5]])
    };
  };

  // Ooga Town: a two-storey bank at each end with the block's stand in its open hall and a mezzanine over the back,
  // reached by stairs; a pair of two-storey shops in each half, their upper floors joined by a footbridge over the
  // street; market stalls, a fountain in the square and the campfire by the edge.
  const oogaTown = () => {
    const half = [], steps = [];
    // The bank: back wall with a door, side walls rising to the mezzanine, the front either side of its doors.
    half.push([-9, -1.2, 34, 35, 4, 0], [1.2, 9, 34, 35, 4, 0], [-9, -8, 24, 34, 4, 0], [8, 9, 24, 34, 4, 0], [-9, -2.5, 24, 25, 3, 0], [2.5, 9, 24, 25, 3, 0]);
    // The mezzanine over the back of the hall, its parapet open over the stairs and in the middle to jump down.
    half.push([-8, 8, 30.5, 34, 3, 2.7], [-8, -2.2, 30.5, 30.7, 3.9, 3], [2.2, 6, 30.5, 30.7, 3.9, 3]);
    // Seven steps up the inside of the right wall to the mezzanine.
    for (let k = 1; k <= 7; k++) { const b = [6, 8, 25.6 + (k - 1) * 0.7, 25.6 + k * 0.7, k * 3 / 7, 0]; half.push(b); steps.push(b); }
    // The two shops of the half, one either side of the street.
    for (const s of [-1, 1]) {
      const x0 = s > 0 ? 9 : -16, x1 = s > 0 ? 16 : -9, xm = (x0 + x1) / 2, outer = s > 0 ? x1 : x0, inner = s > 0 ? x0 : x1;
      const lo = (v) => Math.min(v, v - 0.4 * s), hi = (v) => Math.max(v, v - 0.4 * s), li = (v) => Math.min(v, v + 0.4 * s), hiI = (v) => Math.max(v, v + 0.4 * s);
      half.push([x0, x1, 14.6, 15, 3.9, 0], [x0, xm - 0.9, 8, 8.4, 3, 0], [xm + 0.9, x1, 8, 8.4, 3, 0]);
      half.push([lo(outer), hi(outer), 8, 15, 3.9, 0]);
      // The inner wall, with a door, stops at the upper floor so the footbridge runs straight on.
      half.push([li(inner), hiI(inner), 8, 10.6, 3, 0], [li(inner), hiI(inner), 12.2, 15, 3, 0]);
      // The upper floor over the back half, its parapet open over the stairs.
      const sx0 = s > 0 ? 14.1 : -15.6, sx1 = s > 0 ? 15.6 : -14.1;
      half.push([x0, x1, 11.5, 15, 3, 2.7], s > 0 ? [9.4, 14.1, 11.5, 11.7, 3.9, 3] : [-14.1, -9.4, 11.5, 11.7, 3.9, 3]);
      for (let k = 1; k <= 7; k++) { const b = [sx0, sx1, 8.6 + (k - 1) * 0.414, 8.6 + k * 0.414, k * 3 / 7, 0]; half.push(b); steps.push(b); }
    }
    // The footbridge between the shops' upper floors, its rails and two posts.
    half.push([-9, 9, 12, 14, 3, 2.7], [-9, 9, 12, 12.2, 3.8, 3], [-9, 9, 13.8, 14, 3.8, 3], at(-4, 13, 0.5, 0.5, 2.7), at(4, 13, 0.5, 0.5, 2.7));
    // Market stalls before the bank and a low wall by the tower.
    half.push(at(-4.5, 19, 3, 1, 1.1), at(4.5, 19, 3, 1, 1.1), [-20, -17, 16, 17, 1.4, 0]);
    // The fountain in the square.
    const middle = [[-1.5, 1.5, -1.5, 1.5, 0.8, 0], at(0, 0, 0.6, 0.6, 2.2)];
    const { BLOCKS, steps: stepSet } = turnedMap(half, middle, steps);
    return {
      id: "town", name: "Ooga Town", BLOCKS, steps: stepSet,
      guard: { blue: { x: 0, z: 21.5 }, red: { x: 0, z: -21.5 } },
      traps: [[-12.5, 4], [12.5, -4], [7, 21], [-7, -21], [-19, 8], [19, -8], [0, 6.5], [0, -6.5]],
      crates: both([[-4.6, 22], [4.6, 22], [-3.2, 27.5], [4.5, 27.5]]),
      plug: both([[0, 24.5], [-1.3, 25.8], [1.3, 25.8]]),
      alley: both([[-3, 36], [3, 36], [0, 33.4]]),
      caches: [[12.5, 3, 13.5], [-12.5, 3, 13.5], [12.5, 3, -13.5], [-12.5, 3, -13.5], [0, 3, 32.5], [0, 3, -32.5]],
      tramps: [[-15, 19], [15, -19], [-5, 4], [5, -4]],
      powers: [[-6.5, 17], [6.5, -17], [19, 12], [-19, -12], [0, 4], [0, -4]],
      fire: [-19.5, 0],
      catapults: both([[-6, 29]])
    };
  };
  const ARENAS = { fort: fortChaos(), town: oogaTown() };
  // What every map shares: its size, the stands, the towers with their ladders and ziplines.
  // The banana peels the potato Oogas drop round their fire, offsets from it toward the field.
  const PEELS = [[3, 1.5], [2.2, -2.6], [0.6, 3.2], [0.8, -3.3]];
  for (const A of Object.values(ARENAS)) {
    A.W = W; A.L = L;
    A.peels = PEELS.map(([dx, dz]) => [A.fire[0] + dx, A.fire[1] + dz]);
    // Where a catapult flings its Ooga: over the middle of the other end, a little in front of its stand.
    A.drops = { blue: [0, -25], red: [0, 25] };
    A.stands = { blue: { x: 0, z: 28 }, red: { x: 0, z: -28 } };
    // Each tower's footprint [x0, x1, z0, z1] and the ladder up its inward side: a zone [x0, x1, z0, z1] to climb in,
    // and the way into the tower (dx, dz) a climber pushes toward.
    A.towers = { blue: TOWER, red: turned([...TOWER, 0, 0]).slice(0, 4) };
    A.ladders = { blue: { zone: [-16, -15.2, GAP[0], GAP[1]], dx: -1, dz: 0 }, red: { zone: [15.2, 16, -GAP[1], -GAP[0]], dx: 1, dz: 0 } };
    // A team's zipline: from its tower's gap (where the hands hang, `ZIP_HANG` over the feet) down into the other end.
    A.zips = {
      blue: { ax: -16.6, ay: TOP + CONFIG.ZIP_HANG, az: 26, bx: -3.5, by: 3.1, bz: -28.5 },
      red: { ax: 16.6, ay: TOP + CONFIG.ZIP_HANG, az: -26, bx: 3.5, by: 3.1, bz: 28.5 }
    };
    for (const t of TEAMS) { const z = A.zips[t]; z.len = Math.hypot(z.bx - z.ax, z.by - z.ay, z.bz - z.az); }
  }
  // The map being stepped: every world query below reads it (`use` sets it from the sim, as it does the crates).
  let ARENA = ARENAS.fort, BLOCKS = ARENA.BLOCKS;
  const MAPS = Object.keys(ARENAS);
  // The power-ups: lightning boots (a burst of speed), the halving (your side's splats last half as long), cold
  // storage (your block can't be lifted off its stand) and laser eyes (rapid paint).
  const POWERS = ["boots", "halving", "cold", "laser"];
  const other = (team) => team === "blue" ? "red" : "blue";
  // The bots' skill: easy bots aim wider, wait longer before throwing, throw less often, run slower and see less far;
  // hard ones the other way. "normal" is the CONFIG values.
  const SKILLS = {
    easy: { spread: 0.36, aim: 1.1, cool: 2.1, speed: 4.8, range: 10 },
    normal: { spread: CONFIG.BOT_SPREAD, aim: CONFIG.BOT_AIM, cool: CONFIG.BOT_COOLDOWN, speed: CONFIG.BOT_SPEED, range: CONFIG.BOT_RANGE },
    hard: { spread: 0.1, aim: 0.35, cool: 0.95, speed: 6, range: 15 }
  };
  // Where the k-th of `size` Oogas a side starts, across the inside of its fort (red's turned half round).
  const startAt = (team, k, size) => {
    const x = (k - (size - 1) / 2) * 2.4, z = 26 - (k % 2) * 1.2;
    return team === "blue" ? [x, z] : [-x, -z];
  };
  const mulberry32 = (seed) => () => {
    seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  // The crates of the sim being stepped; the world queries below see them as boxes alongside the fixed blocks.
  let CRATES = [];
  const CB = [0, 0, 0, 0, 0, 0];
  // Point the world queries at sim's map and crates.
  const use = (sim) => {
    CRATES = sim.crates;
    if (ARENA.id !== sim.map) { ARENA = ARENAS[sim.map]; BLOCKS = ARENA.BLOCKS; }
  };
  const crateBox = (c) => { CB[0] = c.x - CONFIG.CRATE_HALF; CB[1] = c.x + CONFIG.CRATE_HALF; CB[2] = c.z - CONFIG.CRATE_HALF; CB[3] = c.z + CONFIG.CRATE_HALF; CB[4] = c.y + CONFIG.CRATE_H; CB[5] = c.y; return CB; };
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
  // `step` is how far below its top a body's feet may be and still walk onto a box (a stair).
  const resolve = (p, r, step = 0.05) => {
    const feet = p.y || 0, head = feet + heightOf(p);
    for (let i = 0, n = boxCount(); i < n; i++) {
      const b = boxAt(i);
      if (feet >= b[4] - step || head <= b[5]) continue;
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
  // `size` Oogas a side (2 to `MAX_SIDE`): the player first, then their teammates, then the rivals. `skill` picks the
  // bots' `SKILLS`.
  const create = ({ team = "blue", seed = 1, names = [], prep = CONFIG.PREP_S, target = CONFIG.CAPTURES, size = 2, skill = "normal", map = "fort" } = {}) => {
    map = ARENAS[map] ? map : "fort";
    const A = ARENAS[map];
    const rival = other(team);
    size = Math.max(2, Math.min(CONFIG.MAX_SIDE, size | 0));
    const actors = Array.from({ length: size * 2 }, (_, i) => ({
      id: i, slot: i % size, name: names[i] || null, team: i < size ? team : rival, bot: i > 0, role: i % size % 2 ? "defend" : "attack",
      x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, heading: 0, moving: 0, carrying: null, splat: 0, guard: 0, cooldown: 0,
      blocked: null, stuck: 0, lastX: 0, lastZ: 0, detour: 0, aim: 0, trapped: 0, think: 0, grounded: true, jumps: 0, crouch: false,
      waiting: false, stamina: 4, tired: false, sprinting: false, rest: 0, botJump: false, jump2At: 0, tries: 0, progT: 0, lastD: 0, netted: 0, grenade: 0, rocket: 0, net: 0, sniper: 0, crates: 0, holding: false, bonked: false,
      climbing: false, riding: false, zipT: 0, flight: 0, zipLine: "blue", lastKind: "paint", boots: 0, laser: 0, burnt: 0, slip: 0, gold: false,
      detourX: 0, detourZ: 0, painted: 0, captures: 0, splats: 0, hits: 0, longShot: 0, rescues: 0
    }));
    const flags = {};
    for (const t of TEAMS) flags[t] = { team: t, state: "home", x: ARENA.stands[t].x, y: 0, z: ARENA.stands[t].z, carrier: null, vx: 0, vy: 0, vz: 0, thrower: -1, t: 0 };
    const shots = Array.from({ length: CONFIG.MAX_SHOTS }, () => ({ live: false, kind: "paint", team: null, owner: -1, ox: 0, oz: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0 }));
    const crates = Array.from({ length: CONFIG.MAX_CRATES }, () => ({ live: false, team: null, x: 0, y: 0, z: 0 }));
    const traps = A.traps.map(([x, z]) => ({ x, z, dark: 0 }));
    const caches = A.caches.map(([x, y, z]) => ({ x, y, z, dark: 0 }));
    const powers = A.powers.map(([x, z]) => ({ x, z, kind: 0, dark: 0 }));
    const peels = A.peels.map(([x, z]) => ({ x, z, dark: 0 }));
    const events = Array.from({ length: CONFIG.MAX_EVENTS }, () => ({ type: "", team: null, actor: -1, by: -1, x: 0, y: 0, z: 0 }));
    const weather = { kind: "clear", left: 0, angle: 0, strength: 0, target: 0, x: 0, z: 0 };
    const sim = { goldLeft: CONFIG.GOLD_GUNS, map, live: null, team, rival, seed, target, size, skill, bots: SKILLS[skill] || SKILLS.normal, prepS: prep, prep: 0, rng: mulberry32(seed), actors, flags, shots, crates, traps, caches, powers, peels, halving: { blue: 0, red: 0 }, cold: { blue: 0, red: 0 }, events, weather, eventCount: 0, score: { blue: 0, red: 0 }, time: 0, flip: false, over: false, winner: null, acc: 0 };
    reset(sim);
    return sim;
  };
  // `by` is who caused it, when that is someone else (the thrower whose shot splatted `actor`).
  const emit = (sim, type, team, actor, x, y, z, by = -1) => {
    if (sim.eventCount >= sim.events.length) return;
    const e = sim.events[sim.eventCount++];
    e.type = type; e.team = team; e.actor = actor; e.by = by; e.x = x; e.y = y; e.z = z;
  };
  const refill = (a) => {
    let more = false;
    for (const k of KINDS) if (TOOLS[k].max && a[k] < TOOLS[k].max) { a[k] = TOOLS[k].max; more = true; }
    return more;
  };
  // True when a crate fits at (x, y, z): inside the arena, off the stands, overlapping no box at that height.
  const freeSpot = (sim, x, z, y = 0) => {
    const h = CONFIG.CRATE_HALF, top = y + CONFIG.CRATE_H;
    if (x < -W + h || x > W - h || z < -L + h || z > L - h) return false;
    for (const t of TEAMS) { const s = ARENA.stands[t]; if (Math.hypot(x - s.x, z - s.z) < CONFIG.STAND_CLEAR) return false; }
    for (let i = 0, n = boxCount(); i < n; i++) {
      const b = boxAt(i);
      if (b[5] >= top - 0.01 || b[4] <= y + 0.01) continue;
      if (x + h > b[0] && x - h < b[1] && z + h > b[2] && z - h < b[3]) return false;
    }
    return true;
  };
  const addCrate = (sim, team, x, z, y = 0) => {
    if (!freeSpot(sim, x, z, y)) return null;
    for (const c of sim.crates) if (!c.live) { c.live = true; c.team = team; c.x = x; c.y = y; c.z = z; return c; }
    return null;
  };
  // The crate sitting on crate c, if any.
  const crateOn = (sim, c) => {
    for (const o of sim.crates) if (o.live && o !== c && Math.abs(o.y - c.y - CONFIG.CRATE_H) < 0.05 && Math.abs(o.x - c.x) < CONFIG.CRATE_HALF * 2 - 0.05 && Math.abs(o.z - c.z) < CONFIG.CRATE_HALF * 2 - 0.05) return o;
    return null;
  };
  const MAX_STACK_Y = CONFIG.CRATE_H * 2 + 0.05;
  // Everyone back to their fort, both flags home, the forts' crates back, the score at nil and the clock at zero.
  const reset = (sim, seed = sim.seed) => {
    sim.seed = seed;
    sim.rng = mulberry32(seed);
    use(sim);
    for (const c of sim.crates) c.live = false;
    for (const t of TEAMS) for (const [x, z] of ARENA.crates[t]) addCrate(sim, t, x, z);
    for (const a of sim.actors) {
      const at = startAt(a.team, a.slot, sim.size);
      a.x = a.lastX = at[0]; a.z = a.lastZ = at[1]; a.y = a.vx = a.vz = a.vy = 0;
      a.heading = a.team === "blue" ? Math.PI : 0;
      a.moving = 0; a.grounded = true; a.jumps = 0; a.crouch = a.botJump = false; a.carrying = a.blocked = null;
      a.splat = a.guard = a.cooldown = a.stuck = a.detour = a.aim = a.trapped = a.think = a.painted = a.jump2At = a.tries = a.netted = a.progT = 0;
      a.lastD = Infinity;
      a.stamina = CONFIG.SPRINT_S; a.tired = a.sprinting = a.waiting = a.holding = a.bonked = false; a.rest = 0;
      a.captures = a.splats = a.hits = a.longShot = a.rescues = 0;
      a.sniper = 0; a.climbing = a.riding = false; a.zipT = 0; a.flight = 0; a.boots = a.laser = a.burnt = a.slip = 0; a.gold = false;
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
    for (const c of sim.caches) c.dark = 0;
    for (const p of sim.peels) p.dark = 0;
    sim.goldLeft = CONFIG.GOLD_GUNS;
    // Each pair of spots starts with the same power (boots, laser eyes, then the halving or cold storage by the seed);
    // after that each draws from the seed, so a seed replays the round's power-ups too.
    for (let i = 0; i < sim.powers.length; i++) { const p = sim.powers[i]; p.dark = 0; p.kind = [0, 3, seed & 1 ? 2 : 1][(i >> 1) % 3]; }
    for (const t of TEAMS) sim.halving[t] = sim.cold[t] = 0;
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
    f.vx = f.vy = f.vz = 0;
    f.thrower = -1;
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
    use(sim);
    const a = sim.actors[id];
    return !sim.over && a.splat <= 0 && dropFlag(sim, a, "drop");
  };
  // Throw the carried block along `yaw` in a long arc (a pass). Anyone who could pick it up can catch it in the air;
  // its thrower only after `PASS_SAFE`. Where it lands it lies as a dropped block.
  const pass = (sim, id = 0, yaw = sim.actors[id].heading) => {
    use(sim);
    const a = sim.actors[id], f = a.carrying && sim.flags[a.carrying];
    if (sim.over || !f || a.splat > 0 || a.trapped > 0) return false;
    f.state = "flying";
    f.carrier = null;
    f.thrower = id;
    f.t = 0;
    f.x = a.x + Math.sin(yaw) * 0.6; f.z = a.z + Math.cos(yaw) * 0.6; f.y = a.y + 1.6;
    f.vx = Math.sin(yaw) * CONFIG.PASS_SPEED + a.vx * 0.5; f.vz = Math.cos(yaw) * CONFIG.PASS_SPEED + a.vz * 0.5; f.vy = CONFIG.PASS_LIFT;
    a.carrying = null;
    a.heading = yaw;
    emit(sim, "pass", f.team, id, f.x, f.y, f.z);
    return true;
  };
  // A block in flight: gravity and the wind; it lands on whatever it falls onto, or drops where it struck a wall.
  const flyFlag = (sim, f, dt) => {
    f.t += dt;
    f.vy -= CONFIG.PASS_GRAVITY * dt;
    f.vx += sim.weather.x * CONFIG.SHOT_WIND * dt; f.vz += sim.weather.z * CONFIG.SHOT_WIND * dt;
    const nx = f.x + f.vx * dt, ny = f.y + f.vy * dt, nz = f.z + f.vz * dt;
    const outside = nx < -W + 0.4 || nx > W - 0.4 || nz < -L + 0.4 || nz > L - 0.4;
    if (outside || (ny > 0 && solidAt(nx, ny, nz))) { f.vx = f.vz = 0; f.vy = Math.min(f.vy, 0); }
    else { f.x = nx; f.z = nz; }
    f.y = Math.max(ny, -1);
    const ground = groundAt(f.x, f.z, f.y + 0.3, 0.2);
    if (f.y <= ground) {
      f.state = "dropped";
      f.y = ground;
      if (f.thrower >= 0) sim.actors[f.thrower].blocked = f.team;
      emit(sim, "landed", f.team, f.thrower, f.x, f.y, f.z);
    }
  };
  // Place a crate a step from actor `id` along `yaw` (its heading if not given), on their own half, from their stock.
  const build = (sim, id = 0, yaw = sim.actors[id].heading) => {
    use(sim);
    const a = sim.actors[id];
    if (sim.over || a.splat > 0 || a.trapped > 0 || a.crates <= 0 || !a.grounded) return false;
    const x = a.x + Math.sin(yaw) * 1.4, z = a.z + Math.cos(yaw) * 1.4;
    if ((a.team === "blue" ? z : -z) < 2 || !addCrate(sim, a.team, x, z)) return false;
    a.crates--;
    emit(sim, "build", a.team, id, x, 0, z);
    return true;
  };
  // Pick up the nearest top crate in front of actor `id`, or, holding one, set it down a step ahead along `yaw`: on top
  // of a crate there (up to three high) or on whatever ground is there. Hands carrying a block can't take a crate.
  const grab = (sim, id = 0, yaw = sim.actors[id].heading) => {
    use(sim);
    const a = sim.actors[id];
    if (sim.over || a.splat > 0 || a.trapped > 0 || !a.grounded) return false;
    const fx = a.x + Math.sin(yaw) * 1.3, fz = a.z + Math.cos(yaw) * 1.3;
    if (a.holding) {
      let x = fx, z = fz, y = groundAt(fx, fz, a.y + 1.2, 0);
      for (const c of sim.crates) {
        if (!c.live || Math.hypot(c.x - fx, c.z - fz) > 0.8 || crateOn(sim, c)) continue;
        x = c.x; z = c.z; y = c.y + CONFIG.CRATE_H;
      }
      if (y > MAX_STACK_Y || !addCrate(sim, a.team, x, z, y)) return false;
      a.holding = false;
      emit(sim, "set", a.team, id, x, y, z);
      return true;
    }
    if (a.carrying) return false;
    let best = null, bd = 1.1;
    for (const c of sim.crates) {
      if (!c.live || crateOn(sim, c) || c.y > a.y + 1.6) continue;
      const d = Math.hypot(c.x - fx, c.z - fz);
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) return false;
    best.live = false;
    a.holding = true;
    emit(sim, "lift", a.team, id, best.x, best.y, best.z);
    return true;
  };
  // A thrown crate comes to rest where it fell, or as near as there's room; with no room it breaks.
  const landCrate = (sim, s) => {
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const x = s.x + dx * 1.25, z = s.z + dz * 1.25, y = groundAt(x, z, Math.max(0, s.y) + 0.5, 0);
      if (y <= MAX_STACK_Y && addCrate(sim, s.team, x, z, y)) { emit(sim, "set", s.team, s.owner, x, y, z); return; }
    }
    emit(sim, "smash", s.team, s.owner, s.x, Math.max(0, s.y), s.z);
  };
  // Crates with nothing under them fall to whatever is below.
  const settleCrates = (sim, dt) => {
    for (const c of sim.crates) {
      if (!c.live || c.y <= 0) continue;
      c.live = false;
      const below = groundAt(c.x, c.z, c.y, -0.05);
      c.live = true;
      if (below < c.y) c.y = Math.max(below, c.y - 7 * dt);
    }
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
  // On either tower's platform by the gap, take that tower's zipline down into the other fort: from your own tower
  // into theirs to raid, or, with their block in hand, from their tower home. Not while fortifying, nor holding a
  // crate. Returns the line's team, or null.
  const nearZip = (sim, a) => {
    use(sim);
    if (sim.prep > 0 || a.holding || a.y < CONFIG.TOWER_TOP - 0.1) return null;
    for (const t of TEAMS) { const z = ARENA.zips[t]; if (Math.hypot(a.x - z.ax, a.z - z.az) < CONFIG.ZIP_R) return t; }
    return null;
  };
  const zip = (sim, id = 0) => {
    use(sim);
    const a = sim.actors[id];
    const line = sim.over || a.riding || a.splat > 0 || a.trapped > 0 ? null : nearZip(sim, a);
    if (!line) return false;
    a.zipLine = line;
    a.riding = true;
    a.zipT = 0;
    a.climbing = false;
    emit(sim, "zip", a.team, id, a.x, a.y, a.z);
    return true;
  };
  // A rider slides along their line at `ZIP_SPEED`, hands on the cable; at its end (or on a jump) they let go and fall.
  const ride = (sim, a, dt, letGo) => {
    const z = ARENA.zips[a.zipLine];
    a.zipT = Math.min(1, a.zipT + CONFIG.ZIP_SPEED * dt / z.len);
    a.x = z.ax + (z.bx - z.ax) * a.zipT;
    a.z = z.az + (z.bz - z.az) * a.zipT;
    a.y = z.ay + (z.by - z.ay) * a.zipT - CONFIG.ZIP_HANG;
    a.vx = (z.bx - z.ax) / z.len * CONFIG.ZIP_SPEED;
    a.vz = (z.bz - z.az) / z.len * CONFIG.ZIP_SPEED;
    a.vy = 0;
    a.grounded = false;
    a.heading = Math.atan2(a.vx, a.vz);
    if (a.zipT >= 1 || letGo) {
      a.riding = false;
      a.vx *= 0.3; a.vz *= 0.3;
      emit(sim, "unzip", a.team, a.id, a.x, a.y, a.z);
    }
  };
  const trampAt = (a) => {
    for (const [x, z] of ARENA.tramps) if ((a.x - x) ** 2 + (a.z - z) ** 2 < CONFIG.TRAMP_R * CONFIG.TRAMP_R) return true;
    return false;
  };
  // A catapult: standing on your own side's, after fortifying and with no crate in your arms, it flings you high over
  // the field; at the top of the throw a parachute opens (`flight` 1 is the throw, 2 the parachute) and you drift down
  // into the other end, steering as you go.
  const nearCatapult = (sim, a) => {
    if (sim.prep > 0 || a.holding || a.flight || a.riding || !a.grounded || a.y > 0.2) return false;
    const [x, z] = ARENA.catapults[a.team][0];
    return (a.x - x) ** 2 + (a.z - z) ** 2 < CONFIG.CATAPULT_R * CONFIG.CATAPULT_R;
  };
  const launch = (sim, id = 0) => {
    use(sim);
    const a = sim.actors[id];
    if (sim.over || a.splat > 0 || a.trapped > 0 || a.burnt > 0 || a.slip > 0 || !nearCatapult(sim, a)) return false;
    const [tx, tz] = ARENA.drops[a.team], dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
    // Straight up to `LAUNCH_H` and over the drop spot at the top of the arc.
    a.vy = Math.sqrt(2 * CONFIG.FALL * CONFIG.LAUNCH_H);
    const t = a.vy / CONFIG.FALL;
    a.vx = dx / d * (d / t); a.vz = dz / d * (d / t);
    a.flight = 1; a.grounded = false; a.jumps = 0; a.crouch = false;
    a.heading = Math.atan2(dx, dz);
    emit(sim, "launch", a.team, id, a.x, a.y, a.z);
    return true;
  };
  // True when actor `a` stands on either sniper tower's platform.
  const onTower = (a) => {
    if (a.y < CONFIG.TOWER_TOP - 0.3 || a.riding) return false;
    for (const t of TEAMS) {
      const [x0, x1, z0, z1] = ARENA.towers[t];
      if (a.x > x0 && a.x < x1 && a.z > z0 && a.z < z1) return true;
    }
    return false;
  };
  // The ladder zone of whichever tower actor `a` stands at, or null.
  const ladderAt = (a) => {
    for (const t of TEAMS) {
      const l = ARENA.ladders[t], [x0, x1, z0, z1] = l.zone;
      if (a.x >= x0 - 0.1 && a.x <= x1 + 0.1 && a.z >= z0 && a.z <= z1) return l;
    }
    return null;
  };
  // Throw tool `kind` from actor `id` along `yaw` (radians, 0 toward +z) with an upward `pitch` added to the lob.
  const fire = (sim, id, yaw, pitch = 0, kind = "paint") => {
    use(sim);
    const a = sim.actors[id], tool = TOOLS[kind];
    if (sim.over || !tool || a.splat > 0 || a.trapped > 0 || a.cooldown > 0 || (tool.max && a[kind] <= 0) || (kind === "crate") !== a.holding || (kind === "sniper" && !onTower(a)) || a.burnt > 0 || a.slip > 0 || (kind === "gold" && !a.gold)) return false;
    let s = null;
    for (let i = 0; i < sim.shots.length && !s; i++) if (!sim.shots[i].live) s = sim.shots[i];
    if (!s) return false;
    const c = Math.cos(pitch), sx = Math.sin(yaw) * c, sz = Math.cos(yaw) * c;
    s.live = true; s.kind = kind; s.team = a.team; s.owner = id; s.t = 0; s.ox = a.x; s.oz = a.z;
    s.x = a.x + sx * 0.5; s.z = a.z + sz * 0.5; s.y = a.y + (a.crouch ? CONFIG.CROUCH_H - 0.25 : CONFIG.SHOT_Y);
    s.vx = sx * tool.speed; s.vz = sz * tool.speed; s.vy = tool.lift + Math.sin(pitch) * tool.speed;
    if (tool.max) a[kind]--;
    if (kind === "crate") { a.holding = false; s.y = a.y + 1.7; }
    a.cooldown = a.laser > 0 && kind === "paint" ? CONFIG.LASER_COOL : a.bot ? Math.max(tool.cool, sim.bots.cool) : tool.cool;
    a.heading = yaw;
    if (kind !== "crate") a.lastKind = kind;
    emit(sim, kind === "paint" || kind === "gold" ? "fire" : "throw", a.team, id, s.x, s.y, s.z);
    return true;
  };
  // `s` is the shot that did it, if any: its thrower is credited with the hit, and a sniper's range is kept.
  const splat = (sim, a, bonk = false, s = null) => {
    const by = s ? s.owner : -1;
    if (s && by >= 0) {
      const o = sim.actors[by];
      o.hits++;
      if (s.kind === "sniper") o.longShot = Math.max(o.longShot, Math.hypot(a.x - s.ox, a.z - s.oz));
    }
    a.splat = CONFIG.SPLAT_S * (sim.halving[a.team] > 0 ? 0.5 : 1);
    a.bonked = bonk;
    a.guard = a.netted = 0;
    a.vx = a.vz = 0;
    a.splats++;
    a.painted = Math.min(1, a.painted + 0.34);
    emit(sim, bonk ? "bonk" : "splat", a.team, a.id, a.x, a.y + 1, a.z, by);
    if (a.holding) { a.holding = false; emit(sim, "smash", a.team, a.id, a.x, a.y + 2, a.z); }
    if (a.riding) { a.riding = false; a.vy = 0; emit(sim, "unzip", a.team, a.id, a.x, a.y, a.z); }
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
      if ((a.x - s.x) ** 2 + (a.z - s.z) ** 2 + dy * dy < r * r) splat(sim, a, false, s);
    }
  };

  // The bots: an attacker goes for the flag and a defender waits at its gate, both breaking off to send a dropped
  // flag of theirs home or to chase the Ooga carrying it, and both throw at the nearest rival in range.
  const goal = { x: 0, z: 0 };
  // Defenders stand side by side before the gate: the first in the middle, the next either side of it.
  const guardSpread = (a) => { const k = a.slot >> 1; return k === 0 ? 0 : (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 2.2; };
  const botGoal = (sim, a) => {
    const own = sim.flags[a.team], theirs = sim.flags[other(a.team)], stand = ARENA.stands[a.team];
    if (sim.prep > 0) {
      // Fortifying: defenders at the gate, attackers at the halfway line.
      if (a.role === "defend") { goal.x = ARENA.guard[a.team].x + guardSpread(a); goal.z = ARENA.guard[a.team].z; }
      else { goal.x = [6, -6, 0][(a.slot >> 1) % 3]; goal.z = a.team === "blue" ? 2.5 : -2.5; }
      return;
    }
    if (a.carrying) { goal.x = stand.x; goal.z = stand.z; return; }
    if (own.state === "dropped" || own.state === "flying") { goal.x = own.x; goal.z = own.z; return; }
    if (own.state === "carried" && sim.actors[own.carrier].team !== a.team) { const c = sim.actors[own.carrier]; goal.x = c.x; goal.z = c.z; return; }
    if (a.role === "defend") {
      let near = null, best = CONFIG.GUARD_RANGE * CONFIG.GUARD_RANGE;
      for (const b of sim.actors) {
        if (b.team === a.team || b.splat > 0) continue;
        const d = (b.x - stand.x) ** 2 + (b.z - stand.z) ** 2;
        if (d < best) { best = d; near = b; }
      }
      if (near) { goal.x = near.x; goal.z = near.z; return; }
      goal.x = ARENA.guard[a.team].x + guardSpread(a); goal.z = ARENA.guard[a.team].z;
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
    const base = Math.atan2(dx, dz), probe = Math.min(PROBE, d), hand = (a.slot % 2 ? 1 : -1) * (a.team === "blue" ? 1 : -1);
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
  // A bot carrying a block passes it when a rival is closing in and a free teammate stands nearer home.
  const botPass = (sim, a) => {
    let near = false;
    for (const b of sim.actors) if (b.team !== a.team && open(b) && (b.x - a.x) ** 2 + (b.z - a.z) ** 2 < 16) near = true;
    if (!near) return;
    const stand = ARENA.stands[a.team], mine = Math.hypot(a.x - stand.x, a.z - stand.z);
    for (const b of sim.actors) {
      if (b === a || b.team !== a.team || !open(b)) continue;
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      if (d > 5 && d < 15 && Math.hypot(b.x - stand.x, b.z - stand.z) < mine - 3 && clearLine(a.x, a.z, b.x, b.z, 0.1, CONFIG.SHOT_Y)) {
        pass(sim, a.id, Math.atan2(b.x - a.x, b.z - a.z));
        return;
      }
    }
  };
  const thinkBot = (sim, a, dt) => {
    if (a.splat > 0 || a.trapped > 0) return;
    if (a.carrying && a.cooldown <= 0 && sim.rng() < dt * 2) botPass(sim, a);
    if (a.detour > 0) {
      a.detour -= dt;
      goal.x = a.detourX; goal.z = a.detourZ;
    } else botGoal(sim, a);
    const d = Math.hypot(goal.x - a.x, goal.z - a.z);
    // An autopiloted player (`auto`, the suite's and the debug handle's) runs at the player's sprint.
    const speed = (a.bot === "auto" ? CONFIG.SPEED * CONFIG.SPRINT : sim.bots.speed) * (a.carrying ? CONFIG.CARRY : 1) * (a.netted > 0 ? CONFIG.NET_SLOW : 1) * (a.boots > 0 ? CONFIG.BOOTS : 1) * (a.burnt > 0 ? CONFIG.BURN_SLOW : 1);
    // Burnt feet: a bot hops until they cool.
    if (a.burnt > 0 && a.grounded) a.botJump = true;
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
      let t = null, best = sim.bots.range * sim.bots.range;
      for (const b of sim.actors) {
        if (b.team === a.team || !open(b)) continue;
        const dd = (b.x - a.x) ** 2 + (b.z - a.z) ** 2;
        if (dd < best && clearLine(a.x, a.z, b.x, b.z, 0.05, CONFIG.SHOT_Y)) { best = dd; t = b; }
      }
      a.aim = t ? a.aim + dt : 0;
      if (t && a.aim >= sim.bots.aim) {
        a.aim = 0;
        const dist = Math.sqrt(best), roll = sim.rng();
        // A net at a carrier or at a Golden AK's holder, now and then a grenade or a rocket, otherwise paint (or the
        // Golden AK, if this bot holds one).
        const kind = (t.carrying || (t.gold && !a.gold)) && a.net > 0 ? "net" : dist > 6 && a.grenade > 0 && roll < 0.25 ? "grenade" : dist < 14 && a.rocket > 0 && roll > 0.88 ? "rocket" : a.gold ? "gold" : "paint";
        const lead = dist / TOOLS[kind].speed;
        const yaw = Math.atan2(t.x + t.vx * lead - a.x, t.z + t.vz * lead - a.z) + (sim.rng() - 0.5) * 2 * sim.bots.spread;
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
    // Up a tower the rifle is in hand (`sniper` 1); stepping off leaves it on the rack.
    const up = onTower(a) ? 1 : 0;
    if (up !== a.sniper) { a.sniper = up; emit(sim, up ? "rifle" : "unrifle", a.team, a.id, a.x, a.y, a.z); }
    for (const c of sim.caches) {
      if (c.dark > 0 || Math.abs(a.y - c.y) > 0.5 || (a.x - c.x) ** 2 + (a.z - c.z) ** 2 > CONFIG.CACHE_R * CONFIG.CACHE_R) continue;
      if (refill(a)) { c.dark = CONFIG.CACHE_S; emit(sim, "cache", a.team, a.id, c.x, c.y, c.z); }
    }
    if (sim.prep > 0) return;
    // Running through a power-up takes it; the spot draws its next one and rests.
    for (const p of sim.powers) {
      if (p.dark > 0 || a.y > 1.2 || (a.x - p.x) ** 2 + (a.z - p.z) ** 2 > CONFIG.POWER_R * CONFIG.POWER_R) continue;
      const kind = POWERS[p.kind];
      if (kind === "boots") a.boots = CONFIG.BOOTS_S;
      else if (kind === "laser") a.laser = CONFIG.LASER_S;
      else if (kind === "halving") sim.halving[a.team] = CONFIG.HALVING_S;
      else sim.cold[a.team] = CONFIG.COLD_S;
      p.dark = CONFIG.POWER_RESPAWN;
      p.kind = Math.floor(sim.rng() * POWERS.length);
      emit(sim, "power", a.team, a.id, p.x, POWERS.indexOf(kind), p.z);
    }
    const r2 = CONFIG.PICK_R * CONFIG.PICK_R;
    if (a.blocked) {
      const f = sim.flags[a.blocked];
      if (f.state !== "dropped" || (a.x - f.x) ** 2 + (a.z - f.z) ** 2 > r2) a.blocked = null;
    }
    const own = sim.flags[a.team], theirs = sim.flags[other(a.team)];
    // Picking up: the rivals' flag from its stand or the ground, or your own team's flag where it was dropped.
    for (const f of [theirs, own]) {
      if (a.carrying || a.holding || f.state === "carried" || (f === own && f.state === "home")) continue;
      // Cold storage: a block on its own stand can't be lifted while its side's freeze lasts.
      if (f.state === "home" && sim.cold[f.team] > 0) continue;
      if (f.state === "flying") {
        // A catch: the block within reach of the body's middle, its thrower kept off it for a moment.
        if (f.thrower === a.id && f.t < CONFIG.PASS_SAFE) continue;
        const dy = f.y - (a.y + 1);
        if (dy * dy + (a.x - f.x) ** 2 + (a.z - f.z) ** 2 >= CONFIG.CATCH_R * CONFIG.CATCH_R) continue;
      } else {
        if (a.blocked === f.team) continue;
        const fy = f.state === "dropped" ? f.y : 0;
        if (a.y > fy + 1.4 || a.y < fy - 0.5 || (a.x - f.x) ** 2 + (a.z - f.z) ** 2 >= r2) continue;
      }
      f.state = "carried";
      f.carrier = a.id;
      a.carrying = f.team;
      if (f === own) a.rescues++;
      emit(sim, f === own ? "rescue" : "pickup", f.team, a.id, f.x, 0, f.z);
    }
    // Your own flag carried back onto your stand is home again.
    if (a.carrying === a.team && home) {
      a.carrying = null;
      homeFlag(own);
      emit(sim, "return", own.team, a.id, own.x, 0, own.z);
    }
    // At home with their block while your own is away: no score yet, said once a visit to the stand.
    if (a.carrying === theirs.team && home && own.state !== "home" && !a.waiting) {
      a.waiting = true;
      emit(sim, "waiting", a.team, a.id, stand.x, 0, stand.z);
    } else if (!home) a.waiting = false;
    if (a.carrying === theirs.team && home && own.state === "home") {
      const f = sim.flags[a.carrying];
      a.carrying = null;
      homeFlag(f);
      homeFlag(own);
      a.captures++;
      sim.score[a.team]++;
      emit(sim, "capture", a.team, a.id, stand.x, 0, stand.z);
      // A Golden AK for the miner while any are left.
      if (sim.goldLeft > 0 && !a.gold) {
        sim.goldLeft--;
        a.gold = true;
        emit(sim, "gold", a.team, a.id, a.x, a.y, a.z);
      }
      if (sim.score[a.team] >= sim.target) {
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
      if (!c.live || c.y > 0.05 || crateOn(sim, c)) continue;
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
      // Live weather (`setLive`) holds its kind; otherwise each spell is a seeded draw.
      const r = sim.rng();
      w.kind = sim.live || (r < 0.4 ? "clear" : r < 0.75 ? "breeze" : "storm");
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

  // The live Bitcoin network sets the weather: `kind` from the fees, or null to go back to seeded spells. A change
  // starts at once.
  const setLive = (sim, kind) => {
    if (kind === sim.live) return false;
    sim.live = kind;
    if (kind && kind !== sim.weather.kind) sim.weather.left = 0;
    return true;
  };
  // A real Bitcoin block was just found: every quiz pad and ammo cache is ready again.
  const newBlock = (sim, height = 0) => {
    for (const t of sim.traps) t.dark = 0;
    for (const c of sim.caches) c.dark = 0;
    emit(sim, "mined", null, -1, height, 0, 0);
  };
  // One fixed step. `input` is the player's: `x`, `z` a world-space move direction of length up to 1, `sprint`,
  // `jump` (a press), `crouch` (held), and optionally `face`, the yaw the player looks along. The scene throws, drops and builds through `fire`, `drop` and `build`.
  const tick = (sim, dt, input) => {
    use(sim);
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
    const N = sim.actors.length;
    for (let n = 0; n < N; n++) {
      const a = sim.actors[sim.flip ? N - 1 - n : n];
      if (a.cooldown > 0) a.cooldown -= dt;
      if (a.boots > 0) a.boots = Math.max(0, a.boots - dt);
      if (a.laser > 0) a.laser = Math.max(0, a.laser - dt);
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
      // Slipping on a peel: the Ooga spins and slides, out of control, until it finds its feet.
      if (a.slip > 0) {
        a.slip = Math.max(0, a.slip - dt);
        a.heading += CONFIG.SLIP_SPIN * dt * (a.slip / CONFIG.SLIP_S + 0.2);
        const k = Math.max(0, 1 - 2.2 * dt);
        a.vx *= k; a.vz *= k;
        if (a.slip === 0) emit(sim, "steady", a.team, a.id, a.x, a.y, a.z);
      }
      const free = a.splat <= 0 && a.trapped <= 0;
      let jump = false;
      if (a.slip > 0 || a.flight === 1) {
        // No steering, no jumping: the slide (or the catapult's throw) carries on.
        if (!a.bot) input.jump = 0;
        a.botJump = false;
      } else if (a.bot) {
        thinkBot(sim, a, dt);
        jump = a.botJump;
        a.botJump = false;
      } else if (free) {
        a.crouch = !!input.crouch && a.grounded;
        // Sprint: Shift held, moving, not crouched or netted, while there's stamina. It runs out after `SPRINT_S`, then
        // refills after a short rest; run it dry and it must refill to `SPRINT_MIN` before it works again.
        const wants = !!input.sprint && !a.crouch && a.netted <= 0 && (input.x !== 0 || input.z !== 0);
        a.sprinting = wants && !a.tired && a.stamina > 0;
        if (a.sprinting) {
          a.stamina = Math.max(0, a.stamina - dt);
          a.rest = CONFIG.SPRINT_REST;
          if (a.stamina === 0) { a.tired = true; emit(sim, "winded", a.team, a.id, a.x, a.y, a.z); }
        } else if (a.rest > 0) a.rest -= dt;
        else {
          a.stamina = Math.min(CONFIG.SPRINT_S, a.stamina + dt * CONFIG.SPRINT_S / CONFIG.SPRINT_REFILL);
          if (a.tired && a.stamina >= CONFIG.SPRINT_S * CONFIG.SPRINT_MIN) a.tired = false;
        }
        const speed = CONFIG.SPEED * (a.crouch ? CONFIG.CROUCH_SPEED : 1) * (a.sprinting ? CONFIG.SPRINT : 1) * (a.carrying ? CONFIG.CARRY : 1) * (a.netted > 0 ? CONFIG.NET_SLOW : 1) * (a.boots > 0 ? CONFIG.BOOTS : 1) * (a.burnt > 0 ? CONFIG.BURN_SLOW : 1) * (a.flight === 2 ? CONFIG.CHUTE_SPEED / CONFIG.SPEED : 1);
        const tx = input.x * speed, tz = input.z * speed, k = Math.min(1, CONFIG.ACCEL * dt);
        a.vx += (tx - a.vx) * k;
        a.vz += (tz - a.vz) * k;
        // A press is used once: the first substep that sees it takes it, so one press is one jump, and the second
        // press in the air is the double jump.
        jump = !!input.jump;
        input.jump = 0;
      }
      // Flung by a catapult: no steering, nothing in the way, until the top of the arc opens the parachute.
      if (a.flight === 1) {
        a.vy -= CONFIG.FALL * dt;
        a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt;
        a.moving = 0;
        if (a.vy <= 0) {
          a.flight = 2;
          a.vx *= 0.08; a.vz *= 0.08; a.vy = -CONFIG.CHUTE_FALL;
          emit(sim, "chute", a.team, a.id, a.x, a.y, a.z);
        }
        if (a.carrying) { const f = sim.flags[a.carrying]; f.x = a.x; f.z = a.z; }
        continue;
      }
      // On a zipline the cable carries you; a jump lets go.
      if (a.riding) {
        ride(sim, a, dt, jump && free);
        a.moving = CONFIG.ZIP_SPEED;
        if (a.carrying) { const f = sim.flags[a.carrying]; f.x = a.x; f.z = a.z; }
        continue;
      }
      // A jump from the ground, and one more in the air, carrying or not; a net stops both.
      if (jump && free && a.netted <= 0 && !a.flight) {
        const k = a.carrying ? CONFIG.CARRY_JUMP : 1;
        if (a.grounded) {
          a.vy = CONFIG.JUMP * k; a.grounded = false; a.jumps = 1;
          emit(sim, "jump", a.team, a.id, a.x, a.y, a.z);
          // Each hop cools burnt feet a little; enough of them and the Ooga can run again.
          if (a.burnt > 0 && --a.burnt === 0) emit(sim, "cooled", a.team, a.id, a.x, a.y, a.z);
        }
        else if (a.jumps > 0) { a.vy = CONFIG.JUMP2 * k; a.jumps = 0; emit(sim, "jump2", a.team, a.id, a.x, a.y, a.z); }
      }
      a.x += a.vx * dt;
      a.z += a.vz * dt;
      // The wind shoves anyone in the air; underfoot only a storm does, so an Ooga standing still in a breeze stays put.
      const storm = wind.strength > CONFIG.WIND.breeze * 1.2;
      if (free && (!a.grounded || storm)) {
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
      // On foot, a stair (a box no higher than `STEP_UP`) is walked up rather than walked into.
      const stepUp = a.grounded ? CONFIG.STEP_UP : 0.05;
      resolve(a, CONFIG.BODY_R, stepUp);
      // A ladder: pushing into a tower's ladder climbs it, and at the top steps onto the platform.
      const ladder = !a.bot && free && a.netted <= 0 && !a.holding && a.y < CONFIG.TOWER_TOP ? ladderAt(a) : null;
      a.climbing = !!ladder && input.x * ladder.dx + input.z * ladder.dz > 0.3;
      // Height: fall onto whatever is underneath, and stop at a floor overhead.
      const ground = groundAt(a.x, a.z, a.y + (stepUp > 0.05 ? stepUp : 0));
      if (a.climbing) {
        a.x = (ladder.zone[0] + ladder.zone[1]) / 2;
        a.vx = a.vz = a.vy = 0;
        a.y = Math.min(CONFIG.TOWER_TOP, a.y + CONFIG.CLIMB * dt);
        a.grounded = false;
        a.jumps = 0;
        if (a.y >= CONFIG.TOWER_TOP) {
          a.x += ladder.dx * 0.9; a.z += ladder.dz * 0.9;
          a.grounded = true; a.climbing = false;
          emit(sim, "climbed", a.team, a.id, a.x, a.y, a.z);
        }
      } else if (a.vy !== 0 || a.y > ground) {
        // Under a parachute the fall is a steady drift.
        if (a.flight === 2) a.vy = -CONFIG.CHUTE_FALL; else a.vy -= CONFIG.FALL * dt;
        a.y += a.vy * dt;
        const ceiling = ceilingAt(a.x, a.z, a.y - a.vy * dt);
        if (a.vy > 0 && a.y + heightOf(a) > ceiling) { a.y = ceiling - heightOf(a); a.vy = 0; }
        if (a.y <= ground) {
          if (!a.grounded && a.vy < -1) emit(sim, "land", a.team, a.id, a.x, ground, a.z);
          if (a.flight) { a.flight = 0; emit(sim, "touchdown", a.team, a.id, a.x, ground, a.z); }
          a.y = ground; a.vy = 0; a.grounded = true; a.jumps = 0;
        } else a.grounded = false;
      } else { a.y = ground; a.grounded = true; }
      // The campfire: feet in it burn, and burnt feet take `BURN_HOPS` jumps to cool.
      if (a.grounded && a.y < 0.05 && free && a.burnt <= 0 && (a.x - ARENA.fire[0]) ** 2 + (a.z - ARENA.fire[1]) ** 2 < CONFIG.FIRE_R * CONFIG.FIRE_R) {
        a.burnt = CONFIG.BURN_HOPS;
        a.vy = 4.5; a.grounded = false; a.jumps = 0;
        emit(sim, "burn", a.team, a.id, a.x, 0, a.z);
      }
      // A banana peel underfoot: a slide and a spin, and whatever block was in hand goes flying out of it.
      if (a.grounded && a.y < 0.1 && free && a.slip <= 0) {
        for (const p of sim.peels) {
          if (p.dark > 0 || (a.x - p.x) ** 2 + (a.z - p.z) ** 2 > CONFIG.PEEL_R * CONFIG.PEEL_R) continue;
          a.slip = CONFIG.SLIP_S;
          a.vx *= 1.3; a.vz *= 1.3;
          p.dark = CONFIG.PEEL_REARM;
          if (a.holding) { a.holding = false; emit(sim, "smash", a.team, a.id, a.x, a.y + 2, a.z); }
          emit(sim, "slip", a.team, a.id, a.x, 0, a.z);
          dropFlag(sim, a, "knock");
          break;
        }
      }
      if (a.grounded && a.y < 0.05 && free && a.netted <= 0 && trampAt(a)) {
        a.vy = CONFIG.BOUNCE; a.grounded = false; a.jumps = 1;
        emit(sim, "boing", a.team, a.id, a.x, 0, a.z);
      }
      const sp = Math.hypot(a.vx, a.vz);
      a.moving = sp;
      // The player faces where they aim (`input.face`, the camera's yaw) when the scene gives it; everyone else faces
      // where they run, unless they just threw.
      if (a.slip > 0) { /* spinning: the heading turns by itself */ }
      else if (!a.bot && free && input.face !== undefined) a.heading = input.face;
      else if (sp > 0.5 && a.cooldown <= (a.bot ? sim.bots.cool : TOOLS.paint.cool) - 0.25) a.heading = Math.atan2(a.vx, a.vz);
      if (a.carrying) { const f = sim.flags[a.carrying]; f.x = a.x; f.z = a.z; }
    }
    for (let n = 0; n < N; n++) touchFlags(sim, sim.actors[sim.flip ? N - 1 - n : n]);
    for (const t of sim.traps) if (t.dark > 0) t.dark -= dt;
    for (const c of sim.caches) if (c.dark > 0) c.dark = Math.max(0, c.dark - dt);
    for (const p of sim.powers) if (p.dark > 0) p.dark = Math.max(0, p.dark - dt);
    for (const p of sim.peels) if (p.dark > 0) p.dark = Math.max(0, p.dark - dt);
    for (const t of TEAMS) {
      if (sim.halving[t] > 0) sim.halving[t] = Math.max(0, sim.halving[t] - dt);
      if (sim.cold[t] > 0) sim.cold[t] = Math.max(0, sim.cold[t] - dt);
    }
    for (const t of TEAMS) if (sim.flags[t].state === "flying") flyFlag(sim, sim.flags[t], dt);
    settleCrates(sim, dt);
    // Throws in flight: gravity and the wind, then a rival in the way or anything solid.
    for (const s of sim.shots) {
      if (!s.live) continue;
      const tool = TOOLS[s.kind];
      s.t += dt;
      s.vy -= tool.gravity * dt;
      const drift = (s.kind === "rocket" ? 0.3 : s.kind === "sniper" ? 0.1 : 1) * CONFIG.SHOT_WIND * dt;
      s.vx += wind.x * drift; s.vz += wind.z * drift;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      let hit = null;
      for (const a of sim.actors) {
        if (a.team === s.team || !open(a)) continue;
        // A crate is big: it counts a little over the head and under the feet.
        const dy = s.y - a.y, slack = s.kind === "crate" ? 0.45 : 0.15;
        if (dy > -slack && dy < heightOf(a) + slack && (s.x - a.x) ** 2 + (s.z - a.z) ** 2 < tool.r * tool.r) { hit = a; break; }
      }
      const solid = !hit && solidAt(s.x, s.y, s.z), spent = s.t > tool.life;
      if (!hit && !solid && !spent) continue;
      s.live = false;
      if (tool.blast) burst(sim, s);
      else if (hit && s.kind === "net") {
        hit.netted = CONFIG.NET_S;
        emit(sim, "net", hit.team, hit.id, hit.x, hit.y + 1, hit.z);
        // Netting a Golden AK's holder takes it, unless the netter already has one.
        const by = s.owner >= 0 ? sim.actors[s.owner] : null;
        if (hit.gold && by && !by.gold) {
          hit.gold = false;
          by.gold = true;
          emit(sim, "goldsteal", by.team, by.id, hit.x, hit.y + 1, hit.z, hit.id);
        }
      } else if (hit) splat(sim, hit, s.kind === "crate", s);
      if (s.kind === "crate") landCrate(sim, s);
      else if (!hit) emit(sim, s.kind === "net" ? "netmiss" : "miss", s.team, s.owner, s.x, Math.max(0.02, s.y), s.z);
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
  BL.blockSim = { CONFIG, TOOLS, KINDS, SKILLS, POWERS, ARENAS, MAPS, TEAMS, other, create, reset, step, tick, setLive, newBlock, launch, nearCatapult, fire, drop, pass, build, grab, zip, nearZip, onTower, escape, clearLine, solidAt, resolve, groundAt };
  // The map last stepped (or reset), for the scene's and models' reads.
  Object.defineProperty(BL.blockSim, "ARENA", { get: () => ARENA, enumerable: true });
})();
