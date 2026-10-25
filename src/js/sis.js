// Kortik's Sis in the Lightning Jet Hangar: the chief engineer of a Jet she is sure will never fly, always on the move
// on the Jet's side of the hall between her spots (`LAYOUT.sis.spots`), walking or, often, running. At one she tries to
// fix the Jet with her hammer, swinging it up and down onto the gear, a wingtip, the nose gear or an engine, sparks
// and a clang each hit; at another she pulls her goggles down and inspects an engine or the crates, pointing and
// tapping; she stands back and admires the Jet, hopeful for a moment, then goes red and shakes her fist at it; she
// glares at the booth or the door, tapping her foot; she paces up and down, muttering; and now and then she marches up
// to the visitor's Ooga and yells at them about the Jet. She picks what to do next at random, never the spot she just
// left, so it never reads as a loop, keeps quiet a while between lines, and glares at whoever comes near.
//
// She walks a grid of the hall's floor built once a visit from the hangar's own checks (`HM.clearAt`, `HM.supportAt`),
// kept off the runway, out of the static fire booth's box and clear of the crew's posts; a trip is planned by A* over
// it and pulled straight wherever the floor allows (`HM.walkable`). The visitor's Ooga stops her; she waits, then goes
// somewhere else. She is a walk block for the Oogas (`actor`). Everything runs on the rig's fixed nodes and
// preallocated arrays; update allocates nothing.
(() => {
  "use strict";
  const BL = window.BL, SM = BL.sisModels, HM = BL.hangarModels;
  const { createNode, addChild } = BL.scene;
  const TAU = Math.PI * 2;

  // How near someone must come for her to glare at them, m, how far her head turns to, and how fast it follows;
  // the time between blinks and a blink's length, s.
  const GLARE = 7, TURN = 0.6, FOLLOW = 5, BLINK = [2.2, 5], SHUT = 0.12;
  // Her body for the floor and the Oogas, m; the grid's cell; her walk and run, m/s, and their strides, radians of
  // the walk cycle a metre; how fast she turns, rad/s; how long a trip she may run, and how often she does.
  const RADIUS = 0.45, HEIGHT = 2, CELL = 0.5, WALK = 1.6, RUN = 3.8, STRIDE = { walk: 4.2, run: 3.1 }, YAW_RATE = 7, RUN_FROM = 7, RUN_CHANCE = 0.6;
  // How long each thing takes, s, [least, most]; how likely each is when she picks the next, by its kind; how long the
  // visitor may stand in her way before she goes elsewhere.
  const TIMES = { fix: [6, 10], inspect: [4.5, 7], admire: [5, 7], glare: [3, 5], pace: [7, 10], yell: [3.2, 4] }, BLOCKED = 1.4;
  const WEIGHT = { fix: 0.4, inspect: 0.22, admire: 0.14, pace: 0.12, glare: 0.12 };
  // Marching up to the visitor: from how far, how often at most, how likely when she picks, and how near she stops.
  const VISIT = { reach: 14, every: 30, chance: 0.3, stop: 1.9 };
  // A hammer swing, s, and when in it the hammer lands; the quiet she keeps between lines, s.
  const SWING = 1.05, LAND = 0.58, QUIET = [7, 14];
  // How each pose eases toward its target, per second.
  const EASE = 8;
  // Her standing pose: her right arm raised with the hammer's handle over her shoulder, her left fist on her hip; each
  // part's rotation, [x, y, z].
  const POSE = { armR: [-0.55, 0, -0.75], foreR: [-1.9, 0, 0.4], hammer: [Math.PI / 2 + 0.25, 0, 0.7], armL: [0.15, 0, 0.7], foreL: [-0.2, 0, -1.7], head: [0.08, 0, 0] };
  const MAX_PATH = 96;
  // What she says: about the Jet, about Lightning, while she hammers, and the rare hopeful moment.
  const LINES = {
    jet: ["THIS THING WILL NEVER FLY!", "IT'S TOO HEAVY! IT'LL NEVER TAKE OFF!", "WE NEED BIGGER ENGINES!", "I WISH ELON MUSK WAS HERE!"],
    lightning: ["I JUST REBALANCED THAT THING!", "WHY IS ALL THE LIQUIDITY ON THE WRONG SIDE?!", "MY BROTHER STILL REBALANCES MANUALLY! LIKE A CAVEMAN!"],
    hammer: ["COME ON, YOU STUPID THING!", "JUST... ONE... MORE... HIT!"],
    mutter: ["This thing will never fly...", "Too heavy. Way too heavy...", "Bigger engines. We need bigger engines...", "I just rebalanced that thing..."],
    hope: ["Huh... maybe this thing might actually work."]
  };

  // `fx` for her lines and sparks, `audio` for her hammer's clang.
  const create = ({ fx, audio }) => {
    const S = HM.LAYOUT.sis, k = SM.rig(), P = k.parts, H = k.heads, rand = BL.math.mulberry32(0x5153), SPARK = HM.blast().spark;
    const node = createNode({ position: { x: S.x, y: k.HIP, z: S.z }, rotation: { x: 0, y: S.turn, z: 0 } });
    addChild(node, k.root);
    for (const [key, [x, y, z]] of Object.entries(POSE)) { P[key].rotation.x = x; P[key].rotation.y = y; P[key].rotation.z = z; }
    const pick = (lo, hi) => lo + rand() * (hi - lo);
    const one = (list) => list[Math.floor(rand() * list.length)];

    // ---- the floor she walks: a grid of cells, each clear for her body on the floor itself ----
    const [X0, X1, Z0, Z1] = S.floor, NX = Math.ceil((X1 - X0) / CELL), NZ = Math.ceil((Z1 - Z0) / CELL), N = NX * NZ;
    const open = new Uint8Array(N), cx = (i) => X0 + (i % NX + 0.5) * CELL, cz = (i) => Z0 + (Math.floor(i / NX) + 0.5) * CELL;
    const F = HM.LAYOUT.fireTest, fc = Math.cos(F.turn), fs = Math.sin(F.turn);
    // What she keeps out of besides what the floor blocks: the booth's striped box with the presser's place in it, and
    // the crew's posts on the floor.
    const keptOut = (x, z) => {
      const dx = x - F.x, dz = z - F.z, lx = dx * fc - dz * fs, lz = dx * fs + dz * fc;
      if (lx > -2.6 && lx < 2.6 && lz > -1.6 && lz < 2.4) return true;
      for (const [px, py, pz, r] of HM.LAYOUT.crew) if (py === 0 && Math.hypot(x - px, z - pz) < r + 0.9) return true;
      return false;
    };
    // A cell is asked as a step from far outside the hall, so a cell inside anything the floor blocks reads as shut
    // (a step from inside a block may always walk out of it).
    for (let i = 0; i < N; i++) {
      const x = cx(i), z = cz(i);
      open[i] = HM.supportAt(x, z, 0) < 0.05 && HM.clearAt(x, z, 0, RADIUS + 0.1, x + 1e4, z) && !keptOut(x, z) ? 1 : 0;
    }
    const cellAt = (x, z) => {
      const ix = Math.floor((x - X0) / CELL), iz = Math.floor((z - Z0) / CELL);
      return ix < 0 || iz < 0 || ix >= NX || iz >= NZ ? -1 : iz * NX + ix;
    };
    // The open cell nearest (x, z), searching out ring by ring.
    const nearestOpen = (x, z) => {
      const c = cellAt(x, z);
      if (c >= 0 && open[c]) return c;
      const ix = Math.floor((x - X0) / CELL), iz = Math.floor((z - Z0) / CELL);
      for (let r = 1; r < 24; r++) {
        let best = -1, bestD = Infinity;
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const jx = ix + dx, jz = iz + dz;
          if (jx < 0 || jz < 0 || jx >= NX || jz >= NZ || !open[jz * NX + jx]) continue;
          const d = (cx(jz * NX + jx) - x) ** 2 + (cz(jz * NX + jx) - z) ** 2;
          if (d < bestD) { bestD = d; best = jz * NX + jx; }
        }
        if (best >= 0) return best;
      }
      return -1;
    };
    // Her spots that stand on open floor, and the visitor's, a spot of its own moved to them each time.
    const spots = S.spots.filter(([, x, z]) => nearestOpen(x, z) >= 0).map(([name, x, z, kind, lx, ly, lz]) => ({ name, x, z, kind, lx, ly, lz, cell: nearestOpen(x, z), dur: 0, paceYaw: 0 }));
    for (const s of spots) s.paceYaw = Math.atan2(s.lx - s.x, s.lz - s.z) + Math.PI / 2;
    const visitorSpot = { name: "visitor", x: 0, z: 0, kind: "yell", lx: 0, ly: 1.6, lz: 0, cell: -1, dur: 0, paceYaw: 0 };

    // ---- A* over the grid, eight ways round, no corner cut, into preallocated arrays ----
    const g = new Float32Array(N), f = new Float32Array(N), from = new Int32Array(N), state = new Uint8Array(N), heap = new Int32Array(N);
    let heapN = 0;
    const push = (i) => {
      let n = heapN++;
      while (n > 0) { const q = (n - 1) >> 1; if (f[heap[q]] <= f[i]) break; heap[n] = heap[q]; n = q; }
      heap[n] = i;
    };
    const pop = () => {
      const top = heap[0], last = heap[--heapN];
      let n = 0;
      for (;;) {
        let c = n * 2 + 1;
        if (c >= heapN) break;
        if (c + 1 < heapN && f[heap[c + 1]] < f[heap[c]]) c++;
        if (f[heap[c]] >= f[last]) break;
        heap[n] = heap[c]; n = c;
      }
      if (heapN) heap[n] = last;
      return top;
    };
    const DX = [1, -1, 0, 0, 1, 1, -1, -1], DZ = [0, 0, 1, -1, 1, -1, 1, -1];
    const octile = (a, b) => { const ax = Math.abs(a % NX - b % NX), az = Math.abs(Math.floor(a / NX) - Math.floor(b / NX)); return Math.max(ax, az) + 0.4142 * Math.min(ax, az); };
    const search = (start, goal) => {
      state.fill(0);
      heapN = 0;
      g[start] = 0; f[start] = octile(start, goal); from[start] = -1; state[start] = 1;
      push(start);
      while (heapN) {
        const c = pop();
        if (c === goal) return true;
        if (state[c] === 2) continue;
        state[c] = 2;
        const ix = c % NX, iz = (c - ix) / NX;
        for (let d = 0; d < 8; d++) {
          const jx = ix + DX[d], jz = iz + DZ[d];
          if (jx < 0 || jz < 0 || jx >= NX || jz >= NZ) continue;
          const n = jz * NX + jx;
          if (!open[n] || state[n] === 2) continue;
          if (d >= 4 && (!open[iz * NX + jx] || !open[jz * NX + ix])) continue;
          const cost = g[c] + (d >= 4 ? 1.4142 : 1);
          if (state[n] === 1 && cost >= g[n]) continue;
          g[n] = cost; f[n] = cost + octile(n, goal); from[n] = c; state[n] = 1;
          push(n);
        }
      }
      return false;
    };
    // A trip from (x, z) to a cell as waypoints, the grid's cells pulled straight wherever the floor allows.
    const cells = new Int32Array(N), path = new Float32Array(MAX_PATH * 2);
    let pathN = 0, pathAt = 0;
    const plan = (x, z, goal) => {
      const start = nearestOpen(x, z);
      pathN = pathAt = 0;
      if (start < 0 || goal < 0 || !search(start, goal)) return false;
      let n = 0;
      for (let c = goal; c >= 0; c = from[c]) cells[n++] = c;
      let ax = x, az = z, i = n - 1;
      while (i >= 0 && pathN < MAX_PATH) {
        let j = 0;
        while (j < i && !HM.walkable(ax, az, cx(cells[j]), cz(cells[j]), 0, RADIUS)) j++;
        ax = cx(cells[j]); az = cz(cells[j]);
        path[pathN * 2] = ax; path[pathN * 2 + 1] = az; pathN++;
        i = j - 1;
      }
      return true;
    };

    // ---- what she does ----
    const p = node.position;
    const actor = { x: S.x, y: 0, z: S.z, radius: RADIUS, height: HEIGHT };
    let clock = 0, blinkAt = BLINK[0], shut = 0, look = 0, yaw = S.turn, phase = 0, moving = 0, speed = WALK;
    // `doing`: the thing at a spot, or "walk"; its spot, how long it has run; the spot she last left; how long she has
    // been stood in the way; whether she has gone red; the quiet left before her next line and how long her mouth runs.
    let doing = "glare", spot = null, t = 0, last = null, blocked = 0, furious = false, quiet = 2, talk = 0, visitedAt = -Infinity;
    // Pacing: up and down a short line through where she stopped; the hammer's swings while she fixes.
    let paceA = 0, paceDir = 1, paceX = 0, paceZ = 0, swingT = 0, swings = 0;
    const say = (text, dur = 2.6) => {
      fx.say(k, text, dur);
      talk = Math.min(2.2, 0.4 + text.length * 0.05);
      quiet = pick(QUIET[0], QUIET[1]);
    };
    const maybeSay = (list, chance) => { if (quiet <= 0 && rand() < chance) say(one(list)); };
    const nextSpot = (driven) => {
      if (driven && clock - visitedAt > VISIT.every && rand() < VISIT.chance) {
        const q = driven.root.position, d = Math.hypot(q.x - p.x, q.z - p.z);
        if (d < VISIT.reach && d > VISIT.stop + 0.5) {
          const k2 = (d - VISIT.stop) / d;
          visitorSpot.cell = nearestOpen(p.x + (q.x - p.x) * k2, p.z + (q.z - p.z) * k2);
          if (visitorSpot.cell >= 0) { visitedAt = clock; visitorSpot.x = cx(visitorSpot.cell); visitorSpot.z = cz(visitorSpot.cell); return visitorSpot; }
        }
      }
      let total = 0;
      for (const s of spots) if (s !== last) total += WEIGHT[s.kind];
      let r = rand() * total;
      for (const s of spots) {
        if (s === last) continue;
        r -= WEIGHT[s.kind];
        if (r <= 0) return s;
      }
      return spots[0];
    };
    const goTo = (s) => {
      spot = s;
      blocked = 0;
      if (!plan(p.x, p.z, s.cell)) { arrive(); return; }
      const far = Math.hypot(cx(s.cell) - p.x, cz(s.cell) - p.z);
      speed = s === visitorSpot || far > RUN_FROM && rand() < RUN_CHANCE ? RUN : WALK;
      doing = "walk";
    };
    const arrive = () => {
      last = spot;
      doing = spot.kind;
      t = 0;
      spot.dur = pick(TIMES[doing][0], TIMES[doing][1]);
      furious = false;
      swingT = 0; swings = 0;
      if (doing === "pace") { paceA = 0; paceDir = 1; paceX = p.x; paceZ = p.z; }
      if (doing === "fix") maybeSay(LINES.hammer, 0.5);
      else if (doing === "yell") say(one(rand() < 0.6 ? LINES.jet : LINES.lightning), 3);
      else if (doing === "admire" && rand() < 0.3) say(LINES.hope[0], 2.8);
    };
    const turnTo = (wantYaw, dt) => {
      let d = wantYaw - yaw;
      d -= TAU * Math.round(d / TAU);
      yaw += Math.max(-YAW_RATE * dt, Math.min(YAW_RATE * dt, d));
    };

    // The pose eased toward its target each frame: the arms, the hammer's angle, the head's nod and tilt, the lean, a
    // crouch and a sway.
    const cur = { armLx: 0.15, armLz: 0.7, foreLx: -0.2, foreLz: -1.7, armRx: POSE.armR[0], armRz: POSE.armR[2], foreRx: POSE.foreR[0], foreRz: POSE.foreR[2], hamX: POSE.hammer[0], hamZ: POSE.hammer[2], headX: 0.08, headZ: 0, lean: 0, crouch: 0, sway: 0 };
    const want = { ...cur }, KEYS = Object.keys(cur);
    const stand = () => {
      want.armLx = 0.15; want.armLz = 0.7; want.foreLx = -0.2; want.foreLz = -1.7;
      want.armRx = POSE.armR[0]; want.armRz = POSE.armR[2]; want.foreRx = POSE.foreR[0]; want.foreRz = POSE.foreR[2]; want.hamX = POSE.hammer[0]; want.hamZ = POSE.hammer[2];
      want.headX = 0.08; want.headZ = 0; want.lean = 0; want.crouch = 0; want.sway = 0;
    };

    // Once a frame with the Ooga the visitor drives here (or null) and where the view is.
    const update = (dt, driven, eye) => {
      clock += dt;
      t += dt;
      quiet -= dt;
      talk = Math.max(0, talk - dt);
      stand();
      let face = H.open, wantYaw = yaw, stepping = false, glareAt = null, swingNow = -1;
      if (doing === "walk") {
        // On along her waypoints, turning to each, stopping short of the visitor's Ooga.
        const wx = path[pathAt * 2], wz = path[pathAt * 2 + 1], dx = wx - p.x, dz = wz - p.z, d = Math.hypot(dx, dz);
        if (d > 0.01) wantYaw = Math.atan2(dx, dz);
        const step = Math.min(d, speed * dt), nx = p.x + dx / (d || 1) * step, nz = p.z + dz / (d || 1) * step;
        const q = driven && driven.root.position, gap = RADIUS + (driven ? driven.bodyRadius || 0.4 : 0) + 0.1;
        if (q && Math.hypot(nx - q.x, nz - q.z) < gap && Math.hypot(nx - q.x, nz - q.z) < Math.hypot(p.x - q.x, p.z - q.z)) {
          blocked += dt;
          glareAt = q;
          if (blocked > BLOCKED) goTo(nextSpot(null));
        } else {
          p.x = nx; p.z = nz;
          stepping = step > 0;
          if (d - step < 0.05 && ++pathAt >= pathN) { arrive(); stepping = false; }
        }
        if (speed > WALK) { want.lean = 0.18; want.armLx = 0; want.armLz = 0.25; want.foreLx = -1.4; want.foreLz = 0; }
        else { want.armLx = 0; want.armLz = 0.18; want.foreLx = -0.35; want.foreLz = 0; }
        if (spot === visitorSpot) face = H.redOpen;
      } else if (doing === "pace") {
        // Up and down a three-metre line, fast, head down, turning sharply at each end, muttering.
        speed = 2.2;
        const half = 1.5, hx = Math.sin(spot.paceYaw), hz = Math.cos(spot.paceYaw);
        paceA += paceDir * speed * dt;
        if (Math.abs(paceA) > half) { paceA = Math.sign(paceA) * half; paceDir = -paceDir; maybeSay(LINES.mutter, 0.35); }
        const nx = paceX + hx * paceA, nz = paceZ + hz * paceA;
        if (HM.walkable(p.x, p.z, nx, nz, 0, RADIUS)) { p.x = nx; p.z = nz; stepping = true; } else paceDir = -paceDir;
        wantYaw = Math.atan2(hx * paceDir, hz * paceDir);
        want.headX = 0.3; want.armLx = 0; want.armLz = 0.18; want.foreLx = -0.35; want.foreLz = 0;
        if (t > spot.dur) goTo(nextSpot(driven));
      } else {
        // At a spot: facing what she came for, the visitor's Ooga when she has come to yell at them.
        if (doing === "yell" && driven) { visitorSpot.lx = driven.root.position.x; visitorSpot.lz = driven.root.position.z; }
        wantYaw = Math.atan2(spot.lx - p.x, spot.lz - p.z);
        const u = t / spot.dur, up = Math.atan2(spot.ly - 1.75, Math.hypot(spot.lx - p.x, spot.lz - p.z));
        if (doing === "fix") {
          // Swinging the hammer up over her head and down onto the Jet, again and again, a breath between some.
          swingT += dt;
          if (swingT > SWING + (swings % 3 === 2 ? 0.7 : 0.1)) { swingT = 0; swings++; if (swings % 3 === 0) maybeSay(LINES.hammer, 0.45); }
          swingNow = Math.min(1, swingT / SWING);
          const height = Math.max(0, Math.min(1, (spot.ly - 0.6) / 2.4));
          want.lean = 0.22 - height * 0.25; want.armLx = -0.5; want.armLz = 0.55; want.foreLx = -0.3; want.foreLz = 0;
          want.headX = -up * 0.6;
          face = swings % 4 === 3 ? H.goggles : H.open;
        } else if (doing === "inspect") {
          // Goggles down, leaning in, pointing at it and tapping, a shake of the head now and then.
          face = H.goggles;
          want.headX = Math.max(-0.5, Math.min(0.5, -up * 0.8));
          want.headZ = Math.sin(clock * 0.9) * 0.15;
          want.lean = up > 0.3 ? -0.05 : 0.22;
          want.armLx = -1.3 - Math.max(0, up) * 1.2 + Math.sin(clock * 9) * 0.06; want.armLz = 0.15; want.foreLx = -0.25; want.foreLz = 0;
        } else if (doing === "admire") {
          // Looking up at the Jet, hopeful, swaying a little; then red, a stomp, and her fist shaken at it.
          want.headX = Math.max(-0.6, -up);
          want.sway = Math.sin(clock * 1.4) * 0.05;
          if (u > 0.62) {
            if (!furious) { furious = true; maybeSay(LINES.jet, 0.8); }
            face = H.redOpen;
            want.armLx = -2.5 + Math.sin(clock * 16) * 0.25; want.armLz = 0.3; want.foreLx = -0.8; want.foreLz = 0;
            want.crouch = u < 0.68 ? 0.06 : 0;
            want.headX = 0.1;
          }
        } else if (doing === "yell") {
          // Red in the face, the hammer up and her fist shaking at them.
          face = H.redOpen;
          want.armLx = -2.4 + Math.sin(clock * 15) * 0.3; want.armLz = 0.35; want.foreLx = -0.7; want.foreLz = 0;
          want.armRx = -2.2; want.foreRx = -1.2; want.lean = -0.05; want.headX = -0.1;
        }
        if (u >= 1) goTo(nextSpot(driven));
      }
      turnTo(wantYaw, dt);
      node.rotation.y = yaw;
      // The walk: legs and the free arm swinging with her stride, a bob, eased in and out as she starts and stops.
      moving += ((stepping ? 1 : 0) - moving) * Math.min(1, dt * 10);
      const run = speed > WALK ? 1 : 0;
      if (stepping) phase += speed * (run ? STRIDE.run : STRIDE.walk) * dt;
      const swing = Math.sin(phase) * moving, legAmp = run ? 0.95 : 0.55, kneeAmp = run ? 1.3 : 0.7;
      P.legR.rotation.x = -swing * legAmp;
      P.legL.rotation.x = swing * legAmp;
      P.shinR.rotation.x = Math.max(0, swing) * kneeAmp;
      P.shinL.rotation.x = Math.max(0, -swing) * kneeAmp;
      // Ease the rest of the pose.
      const e = Math.min(1, dt * EASE);
      for (let i = 0; i < KEYS.length; i++) cur[KEYS[i]] += (want[KEYS[i]] - cur[KEYS[i]]) * e;
      const breath = Math.sin(clock * 1.9), walking = doing === "walk" || doing === "pace" ? 1 : 0;
      P.armL.rotation.x = cur.armLx + swing * (run ? 0.9 : 0.5) * walking;
      P.armL.rotation.z = cur.armLz;
      P.foreL.rotation.x = cur.foreLx;
      P.foreL.rotation.z = cur.foreLz;
      if (swingNow >= 0) {
        // The swing: wound up over her head, brought down hard to where the hammer lands, and lifted again.
        const height = Math.max(0, Math.min(1, (spot.ly - 0.6) / 2.4)), strike = -0.85 - height * 1.5;
        const up1 = swingNow < 0.45 ? swingNow / 0.45 : 1, down = swingNow < 0.45 ? 0 : Math.min(1, (swingNow - 0.45) / (LAND - 0.45));
        const lift = swingNow > 0.75 ? (swingNow - 0.75) / 0.25 : 0;
        const wound = -2.9, armX = swingNow < 0.45 ? cur.armRx + (wound - cur.armRx) * up1 * up1 * (3 - 2 * up1) : swingNow < LAND ? wound + (strike - wound) * down * down : strike + (cur.armRx - strike) * lift;
        P.armR.rotation.x = armX;
        P.armR.rotation.z = -0.22;
        P.foreR.rotation.x = swingNow < 0.45 ? -1.2 : -0.25;
        P.foreR.rotation.z = 0;
        P.hammer.rotation.x = Math.PI - 0.2;
        P.hammer.rotation.z = 0;
        if (swingNow >= LAND && swingNow - dt / SWING < LAND) {
          // Where the hammer lands: sparks off the Jet and the clang.
          const hx = spot.lx + (rand() - 0.5) * 0.3, hy = spot.ly + (rand() - 0.5) * 0.2, hz = spot.lz + (rand() - 0.5) * 0.3;
          for (let i = 0; i < 9; i++) fx.spawnParticle(SPARK, hx, hy, hz, (rand() - 0.5) * 5, 1 + rand() * 3.5, (rand() - 0.5) * 5, 0.4 + rand() * 0.4, 10, 7);
          audio.clang(hx, hy, hz);
        }
      } else {
        P.armR.rotation.x = cur.armRx + breath * 0.02 + Math.abs(swing) * 0.08;
        P.armR.rotation.z = cur.armRz;
        P.foreR.rotation.x = cur.foreRx;
        P.foreR.rotation.z = cur.foreRz;
        P.hammer.rotation.x = cur.hamX;
        P.hammer.rotation.z = cur.hamZ;
      }
      P.torso.scale.y = 1 + breath * 0.012;
      k.root.rotation.x = cur.lean;
      k.root.rotation.z = cur.sway;
      p.y = k.HIP - cur.crouch + Math.abs(Math.sin(phase)) * moving * (run ? 0.07 : 0.035);
      // Her head: glaring at whoever is near when she isn't busy looking at something, within its reach.
      let wantLook = 0;
      const viewer = glareAt || (driven ? driven.root.position : eye);
      if (viewer && (doing === "glare" || doing === "walk" && !stepping)) {
        const dx = viewer.x - p.x, dz = viewer.z - p.z;
        if (dx * dx + dz * dz < GLARE * GLARE) {
          let a = Math.atan2(dx, dz) - yaw;
          a -= TAU * Math.round(a / TAU);
          wantLook = Math.max(-TURN, Math.min(TURN, a));
        }
      }
      if (doing === "glare" && !wantLook) wantLook = Math.sin(clock * 0.7) * 0.4;
      look += (wantLook - look) * Math.min(1, dt * FOLLOW);
      P.head.rotation.y = look;
      P.head.rotation.x = cur.headX;
      P.head.rotation.z = cur.headZ;
      // Tapping her foot while she glares.
      if (doing === "glare") P.shinR.rotation.x = Math.max(0, Math.sin(clock * 9)) * 0.25;
      // Her mouth running while she talks, and blinking now and then except behind her goggles.
      if (shut > 0) shut -= dt;
      else if ((blinkAt -= dt) <= 0) { shut = SHUT; blinkAt = pick(BLINK[0], BLINK[1]); }
      const mouth = talk > 0 && Math.sin(clock * 18) > -0.2;
      P.head.geometry = face === H.redOpen ? (mouth ? H.redTalk : H.redOpen) : face === H.goggles ? (mouth ? H.gogglesTalk : H.goggles) : mouth ? H.talk : shut > 0 ? H.closed : H.open;
      actor.x = p.x; actor.z = p.z;
    };
    // Her other faces, off the graph until she wears them, kept on the GPU.
    const liveGeometry = (set) => { for (const geo of Object.values(H)) set.add(geo); };
    // For debugging: send her to a spot by name, and what she is doing.
    const debug = {
      go: (name) => { const s = spots.find((q) => q.name === name); if (s) goTo(s); return !!s; },
      get doing() { return doing; }, get spot() { return spot && spot.name; }, get spots() { return spots.map((s) => s.name); }, get path() { return pathN; },
      get position() { return { x: p.x, z: p.z }; }, open: () => { let n = 0; for (let i = 0; i < N; i++) n += open[i]; return n; }
    };
    goTo(nextSpot(null));

    return { node, body: P.torso, actor, update, liveGeometry, debug };
  };

  BL.sis = { create };
})();
