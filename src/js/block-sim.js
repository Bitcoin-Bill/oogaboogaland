// Block Frenzy's rules: capture the flag on Fort Chaos, two Oogas a side, no deaths. The "flag" each team guards is
// its Bitcoin block, a glowing orange cube on a stand; the code calls it a flag, the page calls it a block. Pure state
// and functions, no DOM or scene, so the suite plays whole rounds in Node; `scene-block.js` draws it and feeds the
// player's input.
//
// Each team keeps its flag on the stand inside its fort. Touch the other team's flag (on its stand or where it was
// dropped) to carry it; carry it home and touch your own stand while your own flag is home to capture. Captures
// return both flags. A carrier can drop the flag (`drop`); it lies where it fell and, untouched, goes home after
// `RETURN_S`. A team touching its own dropped flag sends it home at once. A carrier can't pick the same flag up again
// until they have left its circle, so a drop is never undone by standing still.
//
// Paint is the only tool here. A ball that hits a player splats them: frozen for `SPLAT_S`, unable to move, paint or
// carry, and a carrier drops the flag where they stand. Then `GUARD_S` of fresh-paint protection before they can be
// splatted again. Nobody dies, nobody is removed, nobody has health. First team to `CAPTURES` wins.
//
// Quiz traps: glowing Matrix pads on the field (`ARENA.traps`). Step on one and a bubble closes round you: you can't
// move, paint, pick up or score, a carrier drops the block, and nobody can paint you inside it. You get out by
// answering a Bitcoin question (the scene asks it and calls `escape`), or the bubble wears off after `TRAP_MAX_S`.
// Bots "work the question" for a seeded few seconds. A sprung pad goes dark for `TRAP_REARM_S`.
//
// Every number lives in CONFIG. The arena, its blocks and the stands live in ARENA. Actors, flags, shots and the event
// ring are preallocated in `create`; `step` allocates nothing. Bots draw from the run's seeded `rng`, so a seed
// replays a round.
(() => {
  "use strict";
  const BL = window.BL = window.BL || {};
  const CONFIG = {
    CAPTURES: 3, RETURN_S: 20, SPLAT_S: 2, GUARD_S: 2.5, PICK_R: 1.3, STAND_R: 1.7, BODY_R: 0.45, HEIGHT: 1.7,
    SPEED: 6.2, SPRINT: 1.45, CARRY: 0.88, BOT_SPEED: 5.5, ACCEL: 30,
    SHOT_SPEED: 24, SHOT_LIFT: 2.2, GRAVITY: 9, SHOT_LIFE: 1.1, SHOT_Y: 1.3, SHOT_R: 0.5, COOLDOWN: 0.32, BOT_COOLDOWN: 1.4,
    BOT_RANGE: 12, BOT_SPREAD: 0.2, BOT_AIM: 0.6, GUARD_RANGE: 10, MAX_SHOTS: 48, MAX_EVENTS: 32, STEP: 1 / 120,
    TRAP_R: 0.95, TRAP_MAX_S: 25, TRAP_REARM_S: 8, BOT_THINK: [3.5, 8]
  };
  // Fort Chaos: x across, z along, the ground at y 0. Blue's fort is at +z, red's at -z. Each block is
  // [x0, x1, z0, z1, height]; the forts have a back wall, two side walls and a front wall split by a gate, and
  // the field between them has cover, a centre tower and side bunkers. Mirrored so neither side is favoured.
  const W = 22, L = 34;
  const half = [
    // A fort: back, sides, the front either side of its gate, and a low step at the gate.
    [-8, 8, 32, 33, 2.4], [-8, -7, 23, 32, 2.4], [7, 8, 23, 32, 2.4], [-8, -2.6, 23, 24, 2.4], [2.6, 8, 23, 24, 2.4],
    // Cover in its half of the field: crates before the gate, side bunkers, and long low walls.
    [-1.2, 1.2, 18.5, 19.5, 1.1], [-15.5, -12.5, 14, 18, 1.8], [12.5, 15.5, 14, 18, 1.8],
    [-11, -5, 8.5, 9.5, 1.1], [5, 11, 8.5, 9.5, 1.1], [-20, -18, 4, 7, 1.6], [18, 20, 4, 7, 1.6]
  ];
  const BLOCKS = [[-1.6, 1.6, -1.6, 1.6, 3.6]];
  for (const b of half) BLOCKS.push(b, [b[0], b[1], -b[3], -b[2], b[4]]);
  const TEAMS = ["blue", "red"];
  const ARENA = {
    W, L, BLOCKS,
    stands: { blue: { x: 0, z: 28 }, red: { x: 0, z: -28 } },
    // Where each side's Oogas start and come back to after a round, two each, inside their fort.
    starts: { blue: [[-3, 26], [3, 26]], red: [[3, -26], [-3, -26]] },
    // Where a defender waits: a little in front of its own gate.
    guard: { blue: { x: 0, z: 21 }, red: { x: 0, z: -21 } },
    // The quiz pads, turned half round between the halves like everything else.
    traps: [[-10, 13], [10, -13], [10, 13], [-10, -13], [-17, 0], [17, 0], [-4.5, 4.5], [4.5, -4.5]]
  };
  const other = (team) => team === "blue" ? "red" : "blue";
  const mulberry32 = (seed) => () => {
    seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  // Push a body of radius r out of every block and the arena's edge, sliding along what it hits.
  const resolve = (p, r) => {
    for (let i = 0; i < BLOCKS.length; i++) {
      const b = BLOCKS[i];
      const cx = p.x < b[0] ? b[0] : p.x > b[1] ? b[1] : p.x, cz = p.z < b[2] ? b[2] : p.z > b[3] ? b[3] : p.z;
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2), k = (r - d) / d;
        p.x += dx * k;
        p.z += dz * k;
      } else {
        // Inside the block: out by the nearest face.
        const l = p.x - b[0], rt = b[1] - p.x, n = p.z - b[2], f = b[3] - p.z, m = Math.min(l, rt, n, f);
        if (m === l) p.x = b[0] - r; else if (m === rt) p.x = b[1] + r; else if (m === n) p.z = b[2] - r; else p.z = b[3] + r;
      }
    }
    if (p.x < -W + r) p.x = -W + r; else if (p.x > W - r) p.x = W - r;
    if (p.z < -L + r) p.z = -L + r; else if (p.z > L - r) p.z = L - r;
  };
  // True when a point at height y is inside a block (or below the ground).
  const solidAt = (x, y, z) => {
    if (y <= 0) return true;
    for (let i = 0; i < BLOCKS.length; i++) {
      const b = BLOCKS[i];
      if (x > b[0] && x < b[1] && z > b[2] && z < b[3] && y < b[4]) return true;
    }
    return x < -W || x > W || z < -L || z > L;
  };
  // True when a body of radius r can walk the straight line from (ax, az) to (bx, bz) without touching a block.
  const clearLine = (ax, az, bx, bz, r) => {
    for (let i = 0; i < BLOCKS.length; i++) {
      const b = BLOCKS[i], x0 = b[0] - r, x1 = b[1] + r, z0 = b[2] - r, z1 = b[3] + r;
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

  // A round. `team` is the player's colour; `seed` seeds the bots. `roster` names the four Oogas: the player first,
  // then their teammate, then the two rivals (any may be null; names are only carried for the scene).
  const create = ({ team = "blue", seed = 1, names = [] } = {}) => {
    const rival = other(team);
    const actors = [0, 1, 2, 3].map((i) => ({
      id: i, name: names[i] || null, team: i < 2 ? team : rival, bot: i > 0, role: i === 1 || i === 3 ? "defend" : "attack",
      x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, heading: 0, moving: 0, carrying: null, splat: 0, guard: 0, cooldown: 0,
      blocked: null, stuck: 0, lastX: 0, lastZ: 0, detour: 0, aim: 0, trapped: 0, think: 0, detourX: 0, detourZ: 0, painted: 0, captures: 0, splats: 0
    }));
    const flags = {};
    for (const t of TEAMS) flags[t] = { team: t, state: "home", x: ARENA.stands[t].x, z: ARENA.stands[t].z, carrier: null, returnAt: 0 };
    const shots = Array.from({ length: CONFIG.MAX_SHOTS }, () => ({ live: false, team: null, owner: -1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0 }));
    const traps = ARENA.traps.map(([x, z]) => ({ x, z, dark: 0 }));
    const events = Array.from({ length: CONFIG.MAX_EVENTS }, () => ({ type: "", team: null, actor: -1, x: 0, y: 0, z: 0 }));
    const sim = { team, rival, seed, rng: mulberry32(seed), actors, flags, shots, traps, events, eventCount: 0, score: { blue: 0, red: 0 }, time: 0, flip: false, over: false, winner: null, acc: 0 };
    reset(sim);
    return sim;
  };
  const emit = (sim, type, team, actor, x, y, z) => {
    if (sim.eventCount >= sim.events.length) return;
    const e = sim.events[sim.eventCount++];
    e.type = type; e.team = team; e.actor = actor; e.x = x; e.y = y; e.z = z;
  };
  // Everyone back to their fort, both flags home, the score at nil and the clock at zero.
  const reset = (sim, seed = sim.seed) => {
    sim.seed = seed;
    sim.rng = mulberry32(seed);
    for (const a of sim.actors) {
      const k = a.id % 2, at = ARENA.starts[a.team][k];
      a.x = a.lastX = at[0]; a.z = a.lastZ = at[1]; a.y = a.vx = a.vz = a.vy = 0;
      a.heading = a.team === "blue" ? Math.PI : 0;
      a.moving = 0; a.carrying = a.blocked = null; a.splat = a.guard = a.cooldown = a.stuck = a.detour = a.aim = a.trapped = a.think = a.painted = 0;
      a.captures = a.splats = 0;
    }
    for (const t of TEAMS) homeFlag(sim.flags[t]);
    for (const s of sim.shots) s.live = false;
    for (const t of sim.traps) t.dark = 0;
    sim.score.blue = sim.score.red = 0;
    sim.time = sim.acc = 0;
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
    f.carrier = null;
    f.returnAt = 0;
  };
  // A carrier lets go: the flag lies at their feet and counts down home.
  const dropFlag = (sim, a, why) => {
    const f = a.carrying && sim.flags[a.carrying];
    if (!f) return false;
    f.state = "dropped";
    f.x = a.x;
    f.z = a.z;
    f.carrier = null;
    f.returnAt = sim.time + CONFIG.RETURN_S;
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
  // Throw a paint ball from actor `id` along `yaw` (radians, 0 toward +z) with an upward `pitch` added to the lob.
  const fire = (sim, id, yaw, pitch = 0) => {
    const a = sim.actors[id];
    if (sim.over || a.splat > 0 || a.trapped > 0 || a.cooldown > 0) return false;
    let s = null;
    for (let i = 0; i < sim.shots.length && !s; i++) if (!sim.shots[i].live) s = sim.shots[i];
    if (!s) return false;
    const c = Math.cos(pitch), sx = Math.sin(yaw) * c, sz = Math.cos(yaw) * c;
    s.live = true; s.team = a.team; s.owner = id; s.t = 0;
    s.x = a.x + sx * 0.5; s.z = a.z + sz * 0.5; s.y = a.y + CONFIG.SHOT_Y;
    s.vx = sx * CONFIG.SHOT_SPEED; s.vz = sz * CONFIG.SHOT_SPEED; s.vy = CONFIG.SHOT_LIFT + Math.sin(pitch) * CONFIG.SHOT_SPEED;
    a.cooldown = a.bot ? CONFIG.BOT_COOLDOWN : CONFIG.COOLDOWN;
    a.heading = yaw;
    emit(sim, "fire", a.team, id, s.x, s.y, s.z);
    return true;
  };
  const splat = (sim, a, by) => {
    a.splat = CONFIG.SPLAT_S;
    a.guard = 0;
    a.vx = a.vz = 0;
    a.splats++;
    a.painted = Math.min(1, a.painted + 0.34);
    emit(sim, "splat", a.team, a.id, a.x, a.y + 1, a.z);
    dropFlag(sim, a, "knock");
    if (by >= 0) sim.actors[by].captures += 0;
  };

  // The bots: an attacker goes for the flag and a defender waits at its gate, both breaking off to send a dropped
  // flag of theirs home or to chase the Ooga carrying it, and both paint the nearest rival in range.
  const goal = { x: 0, z: 0 };
  const botGoal = (sim, a) => {
    const own = sim.flags[a.team], theirs = sim.flags[other(a.team)], stand = ARENA.stands[a.team];
    if (a.carrying) { goal.x = stand.x; goal.z = stand.z; return; }
    if (own.state === "dropped") { goal.x = own.x; goal.z = own.z; return; }
    if (own.state === "carried") { const c = sim.actors[own.carrier]; goal.x = c.x; goal.z = c.z; return; }
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
    if (theirs.state === "carried") {
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
    if (clearLine(a.x, a.z, wantX, wantZ, CONFIG.BODY_R * 0.9)) return Math.atan2(dx, dz);
    // The two sides fan opposite ways, as the field is turned half round between them, so neither steers better.
    const base = Math.atan2(dx, dz), probe = Math.min(PROBE, d), hand = (a.id % 2 ? 1 : -1) * (a.team === "blue" ? 1 : -1);
    for (let i = 0; i < FANS.length; i++) {
      const h = base + FANS[i] * hand;
      if (clearLine(a.x, a.z, a.x + Math.sin(h) * probe, a.z + Math.cos(h) * probe, CONFIG.BODY_R)) return h;
    }
    return base;
  };
  const thinkBot = (sim, a, dt) => {
    if (a.splat > 0 || a.trapped > 0) return;
    if (a.detour > 0) {
      a.detour -= dt;
      goal.x = a.detourX; goal.z = a.detourZ;
    } else botGoal(sim, a);
    const d = Math.hypot(goal.x - a.x, goal.z - a.z);
    // An autopiloted player (`auto`, the suite's and the debug handle's) runs at the player's sprint.
    const speed = (a.bot === "auto" ? CONFIG.SPEED * CONFIG.SPRINT : CONFIG.BOT_SPEED) * (a.carrying ? CONFIG.CARRY : 1);
    if (d > 0.4) {
      const h = steer(sim, a, goal.x, goal.z);
      a.vx = Math.sin(h) * speed; a.vz = Math.cos(h) * speed;
    } else a.vx = a.vz = 0;
    // Stuck for a second: pick a random spot nearby for a moment.
    a.stuck = Math.hypot(a.x - a.lastX, a.z - a.lastZ) < 0.6 * dt && d > 1 ? a.stuck + dt : 0;
    a.lastX = a.x; a.lastZ = a.z;
    if (a.stuck > 0.8) {
      a.stuck = 0;
      a.detour = 0.9;
      const ang = sim.rng() * Math.PI * 2;
      a.detourX = a.x + Math.sin(ang) * 4; a.detourZ = a.z + Math.cos(ang) * 4;
    }
    // Paint the nearest rival in range, leading their run a little, with a seeded wobble, after holding them in sight
    // for `BOT_AIM` (so a rival who runs past gets a moment, and a bot just back from a splat can't paint at once).
    if (a.cooldown <= 0) {
      let t = null, best = CONFIG.BOT_RANGE * CONFIG.BOT_RANGE;
      for (const b of sim.actors) {
        if (b.team === a.team || b.splat > 0 || b.guard > 0 || b.trapped > 0) continue;
        const dd = (b.x - a.x) ** 2 + (b.z - a.z) ** 2;
        if (dd < best && clearLine(a.x, a.z, b.x, b.z, 0.05)) { best = dd; t = b; }
      }
      a.aim = t ? a.aim + dt : 0;
      if (t && a.aim >= CONFIG.BOT_AIM) {
        a.aim = 0;
        const lead = Math.sqrt(best) / CONFIG.SHOT_SPEED;
        const yaw = Math.atan2(t.x + t.vx * lead - a.x, t.z + t.vz * lead - a.z) + (sim.rng() - 0.5) * 2 * CONFIG.BOT_SPREAD;
        // Lob flatter at range so the ball arrives near chest height.
        const pitch = Math.min(0.12, Math.max(-0.12, (Math.sqrt(best) - 8) * -0.006));
        fire(sim, a.id, yaw, pitch);
      }
    }
  };

  // Flags: pickups, returns and captures for one actor.
  const touchFlags = (sim, a) => {
    if (a.splat > 0 || a.trapped > 0) return;
    if (a.guard <= 0) {
      for (const t of sim.traps) {
        if (t.dark <= 0 && (a.x - t.x) ** 2 + (a.z - t.z) ** 2 < CONFIG.TRAP_R * CONFIG.TRAP_R) { spring(sim, a, t); return; }
      }
    }
    const r2 = CONFIG.PICK_R * CONFIG.PICK_R;
    if (a.blocked) {
      const f = sim.flags[a.blocked];
      if (f.state !== "dropped" || (a.x - f.x) ** 2 + (a.z - f.z) ** 2 > r2) a.blocked = null;
    }
    const own = sim.flags[a.team], theirs = sim.flags[other(a.team)];
    if (own.state === "dropped" && (a.x - own.x) ** 2 + (a.z - own.z) ** 2 < r2) {
      homeFlag(own);
      emit(sim, "return", own.team, a.id, own.x, 0, own.z);
    }
    if (!a.carrying && theirs.state !== "carried" && a.blocked !== theirs.team && (a.x - theirs.x) ** 2 + (a.z - theirs.z) ** 2 < r2) {
      theirs.state = "carried";
      theirs.carrier = a.id;
      a.carrying = theirs.team;
      emit(sim, "pickup", theirs.team, a.id, theirs.x, 0, theirs.z);
    }
    if (a.carrying) {
      const stand = ARENA.stands[a.team];
      if ((a.x - stand.x) ** 2 + (a.z - stand.z) ** 2 < CONFIG.STAND_R * CONFIG.STAND_R && own.state === "home") {
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
    }
  };

  // One fixed step. `input` is the player's: `x`, `z` a world-space move direction of length up to 1, `sprint`,
  // `jump` (a press). The scene fires and drops through `fire` and `drop`.
  const tick = (sim, dt, input) => {
    sim.time += dt;
    // Each step takes the four in the other order from the last, so neither side always moves, picks up or reaches a
    // dropped block first.
    sim.flip = !sim.flip;
    for (let n = 0; n < 4; n++) {
      const a = sim.actors[sim.flip ? 3 - n : n];
      if (a.cooldown > 0) a.cooldown -= dt;
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
      if (a.bot) thinkBot(sim, a, dt);
      else if (a.splat <= 0 && a.trapped <= 0) {
        const speed = CONFIG.SPEED * (a.carrying ? CONFIG.CARRY : input.sprint ? CONFIG.SPRINT : 1);
        const tx = input.x * speed, tz = input.z * speed, k = Math.min(1, CONFIG.ACCEL * dt);
        a.vx += (tx - a.vx) * k;
        a.vz += (tz - a.vz) * k;
        if (input.jump && a.y <= 0) a.vy = 5.2;
      }
      // Jumps carry anyone already in the air; splatted Oogas fall where they are.
      if (a.y > 0 || a.vy > 0) {
        a.vy -= 16 * dt;
        a.y += a.vy * dt;
        if (a.y <= 0) { a.y = 0; a.vy = 0; }
      }
      a.x += a.vx * dt;
      a.z += a.vz * dt;
      resolve(a, CONFIG.BODY_R);
      const sp = Math.hypot(a.vx, a.vz);
      a.moving = sp;
      if (sp > 0.5 && a.cooldown <= (a.bot ? CONFIG.BOT_COOLDOWN : CONFIG.COOLDOWN) - 0.25) a.heading = Math.atan2(a.vx, a.vz);
      if (a.carrying) { const f = sim.flags[a.carrying]; f.x = a.x; f.z = a.z; }
    }
    for (let n = 0; n < 4; n++) touchFlags(sim, sim.actors[sim.flip ? 3 - n : n]);
    for (const t of sim.traps) if (t.dark > 0) t.dark -= dt;
    for (const t of TEAMS) {
      const f = sim.flags[t];
      if (f.state === "dropped" && sim.time >= f.returnAt) {
        homeFlag(f);
        emit(sim, "return", t, -1, f.x, 0, f.z);
      }
    }
    // Paint in flight: gravity, then a rival in the way or anything solid.
    for (const s of sim.shots) {
      if (!s.live) continue;
      s.t += dt;
      s.vy -= CONFIG.GRAVITY * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      let hit = false;
      for (const a of sim.actors) {
        if (a.team === s.team || a.splat > 0 || a.guard > 0 || a.trapped > 0) continue;
        const dy = s.y - a.y;
        if (dy > -0.1 && dy < CONFIG.HEIGHT + 0.15 && (s.x - a.x) ** 2 + (s.z - a.z) ** 2 < CONFIG.SHOT_R * CONFIG.SHOT_R) {
          splat(sim, a, s.owner);
          hit = true;
          break;
        }
      }
      if (!hit && (solidAt(s.x, s.y, s.z) || s.t > CONFIG.SHOT_LIFE)) {
        emit(sim, "miss", s.team, s.owner, s.x, Math.max(0.02, s.y), s.z);
        hit = true;
      }
      if (hit) s.live = false;
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
  BL.blockSim = { CONFIG, ARENA, TEAMS, other, create, reset, step, tick, fire, drop, escape, clearLine, solidAt, resolve };
})();
