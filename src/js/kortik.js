// Kortik at his switchboard. Lamps on the board start flashing as calls come in; he answers each by taking a cord's plug
// from the shelf in his fist, lining it up in front of the lit jack and pushing it home, letting go, and throwing its key;
// when the lamp flickers out he pulls the plug straight back out and sets it upright in its hole again. Out of free
// cords, or just because, he moves a plugged cord from one jack to another. Between calls he leans in to scowl at the
// board, throws up his hands and shakes his head, and when someone is near he swivels round on his stool to point and
// tell them what he thinks of Lightning. It is comedy, not routing: nothing here reads the node.
// His arms bend at the elbow (two-bone reach), so a fist lands where it means to; a plug in it lies along the forearm.
// Everything runs in the wall's frame (kortik-models.js) on a fixed set of nodes; update allocates nothing.
(() => {
  "use strict";
  const BL = window.BL, KM = BL.kortikModels, FM = BL.factoryModels;
  const { createNode, addChild } = BL.scene;
  const LINES = ["Gosh, I hate Lightning.", "Another channel? Of course.", "Lightning is just a switchboard with extra steps.",
    "More rebalancing? Seriously?", "Plug. Unplug. Repeat.", "More channels? Really?"];
  const REBALANCING = 3;
  // How near the view must be for him to turn and speak, and the quiet he keeps between lines, in seconds.
  const HEAR = 16, QUIET = [16, 30];
  // A plug's place in a jack, how far out a hand lines it up before pushing it home, and how long it takes to settle
  // into a fist, a jack or its hole.
  const IN_JACK = 0.012, APPROACH = 0.13, SETTLE = 0.15;
  const SEGMENTS = 10, TAU = Math.PI * 2;
  // A plan's steps, where a hand goes (the first five in the wall's frame, the rest with his body), and a jack's states.
  const LOOK = 0, MOVE = 1, GRAB = 2, PLUG = 3, DROP = 4, KEY = 5, LEAN = 6, SAY = 7, SHAKE = 8, WAIT = 9, SWIVEL = 10;
  const T_JACK = 0, T_JACK_IN = 1, T_HOME = 2, T_KEY = 3, T_POINT = 4, T_VIEW = 5, T_REST = 6, T_UP = 7;
  const IDLE = 0, CALLING = 1, CONNECTED = 2, CLEARING = 3;
  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const create = ({ fx }) => {
    const B = KM.BOARD, S = KM.station(), L = FM.LAYOUT.kortik, rand = BL.math.mulberry32(0x6b6f7274);
    const ox = L.x - L.w / 2 + FM.KORTIK.face, oy = L.y, oz = L.z;
    const node = createNode({ position: { x: ox, y: oy, z: oz }, rotation: { x: 0, y: Math.PI / 2, z: 0 } });
    addChild(node, createNode({ geometry: S.body }));
    const sign = KM.sign(), signNode = createNode({ position: { x: 0, y: B.sign.y, z: B.sign.z } });
    addChild(signNode, createNode({ geometry: sign.back }), createNode({ geometry: sign.face }));
    addChild(node, signNode);
    KM.NOTES.forEach((n, i) => addChild(node, createNode({ position: { x: n.x, y: n.y, z: 0.03 }, rotation: { x: 0, y: 0, z: n.tilt }, geometry: S.notes[i] })));

    // The lamps, one over every jack. The board's own blinking has a hashed phase and rate a lamp; the active jacks'
    // lamps show their calls instead.
    const lamps = [];
    for (let r = 0; r < B.rows; r++) for (let c = 0; c < B.cols; c++) {
      const lamp = createNode({ position: { x: KM.jackX(c), y: KM.jackY(r) + B.lamp, z: 0 }, geometry: S.lamp });
      lamp.glow = 0.12;
      lamps.push(lamp);
      addChild(node, lamp);
    }
    const phase = new Float32Array(lamps.length), rate = new Float32Array(lamps.length), activeOf = new Int16Array(lamps.length).fill(-1);
    for (let i = 0; i < lamps.length; i++) {
      const a = Math.sin(i * 12.9898 + 78.233) * 43758.5453, b = Math.sin(i * 39.346 + 11.135) * 24634.6345;
      phase[i] = a - Math.floor(a);
      rate[i] = 0.06 + 0.22 * (b - Math.floor(b));
    }
    KM.ACTIVE.forEach((idx, a) => { activeOf[idx] = a; });
    const jacks = KM.ACTIVE.length, jack = new Uint8Array(jacks), jackCord = new Int8Array(jacks).fill(-1), jackT = new Float32Array(jacks);
    const jackX = (j) => KM.jackX(KM.ACTIVE[j] % B.cols), jackY = (j) => KM.jackY(Math.floor(KM.ACTIVE[j] / B.cols));
    // The hand that works a jack: his right (0) for the board's +x half, his left (1) for the rest.
    const sideOf = (j) => (jackX(j) >= 0 ? 0 : 1);

    // The cords: a plug, its key and its cord's segments each. A plug's position and the way its boot points ease from
    // where it was to where it goes whenever it is taken, plugged in or set down.
    const n = B.cords, plugs = [], keys = [], segs = [];
    const cordJack = new Int8Array(n).fill(-1), cordHeld = new Int8Array(n).fill(-1);
    const keyThrow = new Float32Array(n), keyTarget = new Float32Array(n);
    const plugPos = new Float32Array(n * 3), plugFrom = new Float32Array(n * 3), plugDir = new Float32Array(n * 3), plugBlend = new Float32Array(n).fill(1);
    for (let i = 0; i < n; i++) {
      const black = B.black.includes(i);
      const p = createNode({ position: { x: KM.cordX(i), y: B.shelf + 0.03, z: B.plugZ }, geometry: black ? S.plugs.black : S.plugs.red });
      const key = createNode({ position: { x: KM.cordX(i), y: B.shelf + 0.04, z: B.keyZ }, geometry: S.key });
      plugs.push(p);
      keys.push(key);
      addChild(node, p, key);
      for (let s = 0; s < SEGMENTS; s++) {
        const seg = createNode({ geometry: black ? S.segments.black : S.segments.red, visible: false });
        segs.push(seg);
        addChild(node, seg);
      }
      plugPos[i * 3] = KM.cordX(i); plugPos[i * 3 + 1] = B.shelf + 0.03; plugPos[i * 3 + 2] = B.plugZ;
      plugDir[i * 3 + 1] = 1;
    }

    // Kortik on his stool, facing the board (-z, a yaw of pi), his shins hanging from his knees; his right hand is on the
    // board's +x side.
    const k = KM.rig(), P = k.parts, L1 = k.ARM.upper, L2 = k.ARM.fore, REACH = L1 + L2 - 0.002;
    const armX = P.armL.position.x, shoulderY = P.armL.position.y, headY = P.head.position.y, headZ = P.head.position.z;
    const seatY = B.seat.y, seatZ = B.seat.z;
    k.root.position.y = seatY;
    k.root.position.z = seatZ;
    k.root.rotation.y = Math.PI;
    P.shinR.rotation.x = P.shinL.rotation.x = 1.45;
    addChild(node, k.root);

    // His body's turn and lean; a point turned with them into the wall's frame (into OUT), a direction likewise, or a
    // direction turned back into his body's frame (into DIR).
    let yaw = Math.PI, yawTarget = Math.PI, lean = 0.1, leanTarget = 0.1;
    const OUT = new Float32Array(3), DIR = new Float32Array(3);
    const dirToWall = (x, y, z) => {
      const cl = Math.cos(lean), sl = Math.sin(lean), cy = Math.cos(yaw), sy = Math.sin(yaw);
      const ly = y * cl - z * sl, lz = y * sl + z * cl;
      OUT[0] = x * cy + lz * sy; OUT[1] = ly; OUT[2] = -x * sy + lz * cy;
    };
    const toWall = (x, y, z) => {
      dirToWall(x, y, z);
      OUT[1] += k.root.position.y; OUT[2] += seatZ;
    };
    const toBody = (x, y, z) => {
      const cl = Math.cos(lean), sl = Math.sin(lean), cy = Math.cos(yaw), sy = Math.sin(yaw);
      const bx = x * cy - z * sy, bz = x * sy + z * cy;
      DIR[0] = bx; DIR[1] = y * cl + bz * sl; DIR[2] = -y * sl + bz * cl;
    };

    // Each hand: what it is going to (a target kind and its cord and jack), from where, how far along, where its fist
    // actually is this frame, and which way its forearm points.
    const hand = new Float32Array(6), from = new Float32Array(6), fist = new Float32Array(6), fore = new Float32Array(6);
    const kind = new Uint8Array([T_REST, T_REST]), kindCord = new Int8Array(2), kindJack = new Int8Array(2);
    const moveT = new Float32Array(2), moveDur = new Float32Array(2), look = new Float32Array(3), viewer = new Float32Array(3);
    let lookKind = T_JACK, lookJack = 4, headYaw = 0, headPitch = 0, shake = 0, shakeDur = 0, time = 0;
    let quiet = 4, line = 0, eventIn = 1.5, blinkIn = 3, blink = 0, near = false;
    // Where a target is, in the wall's frame, into `out` at `o`. A fist goes round a plug's sleeve: over the plug in its
    // hole, over one in a jack, or the same distance out in front of a jack to line a plug up.
    const pointOf = (target, arm, cord, j, out, o) => {
      if (target === T_JACK || target === T_JACK_IN) { out[o] = jackX(j); out[o + 1] = jackY(j); out[o + 2] = IN_JACK + KM.GRIP + (target === T_JACK ? APPROACH : 0); return; }
      if (target === T_HOME) { out[o] = KM.cordX(cord); out[o + 1] = B.shelf + 0.03 + KM.GRIP; out[o + 2] = B.plugZ; return; }
      if (target === T_KEY) { out[o] = KM.cordX(cord); out[o + 1] = B.shelf + 0.12; out[o + 2] = B.keyZ; return; }
      if (target === T_POINT || target === T_VIEW) { out[o] = viewer[0]; out[o + 1] = viewer[1]; out[o + 2] = viewer[2]; return; }
      const side = arm === 0 ? -1 : 1;
      if (target === T_UP) toWall(side * 0.45, 2.1 - seatY, 0.08);
      else toWall(side * 0.3, B.shelf + 0.07 - seatY, 0.5);
      out[o] = OUT[0]; out[o + 1] = OUT[1]; out[o + 2] = OUT[2];
    };
    pointOf(T_REST, 0, -1, -1, hand, 0);
    pointOf(T_REST, 1, -1, -1, hand, 3);

    // A plan is a list of steps from a fixed pool, run one after another.
    const steps = [];
    for (let i = 0; i < 40; i++) steps.push({ kind: WAIT, dur: 0, arm: 0, target: 0, cord: -1, jack: -1, v: 0 });
    let count = 0, at = 0, stepT = 0;
    const push = (what, dur, arm = 0, target = 0, cord = -1, j = -1, v = 0) => {
      const s = steps[count++];
      s.kind = what; s.dur = dur; s.arm = arm; s.target = target; s.cord = cord; s.jack = j; s.v = v;
    };
    const say = (which) => {
      if (!near || quiet > 0) return;
      if (which < 0) { which = line; line = (line + 1) % LINES.length; }
      fx.say(k, LINES[which], 3.6);
      quiet = QUIET[0] + rand() * (QUIET[1] - QUIET[0]);
    };
    // A plug changing hands, jacks or its hole settles there from where it is.
    const settle = (c) => {
      for (let i = 0; i < 3; i++) plugFrom[c * 3 + i] = plugPos[c * 3 + i];
      plugBlend[c] = 0;
    };
    const begin = (s) => {
      if (s.kind === MOVE) {
        for (let a = 0; a < 2; a++) if (s.arm === a || s.arm === 2) {
          for (let i = 0; i < 3; i++) from[a * 3 + i] = hand[a * 3 + i];
          kind[a] = s.target; kindCord[a] = s.cord; kindJack[a] = s.jack;
          moveT[a] = 0;
          moveDur[a] = s.dur;
        }
      } else if (s.kind === LOOK) { lookKind = s.target; lookJack = s.jack; }
      else if (s.kind === LEAN) leanTarget = s.v;
      else if (s.kind === SWIVEL) yawTarget = s.v ? Math.atan2(viewer[0], viewer[2] - seatZ) : Math.PI;
      else if (s.kind === GRAB) {
        const j = cordJack[s.cord];
        if (j >= 0) { jack[j] = IDLE; jackCord[j] = -1; jackT[j] = 0; }
        cordJack[s.cord] = -1;
        cordHeld[s.cord] = s.arm;
        settle(s.cord);
      } else if (s.kind === PLUG) {
        cordHeld[s.cord] = -1;
        cordJack[s.cord] = s.jack;
        jack[s.jack] = CONNECTED; jackCord[s.jack] = s.cord; jackT[s.jack] = 0;
        settle(s.cord);
      } else if (s.kind === DROP) { cordHeld[s.cord] = -1; cordJack[s.cord] = -1; settle(s.cord); }
      else if (s.kind === KEY) keyTarget[s.cord] = s.v;
      else if (s.kind === SAY) say(s.v);
      else if (s.kind === SHAKE) { shake = 0; shakeDur = s.dur; }
    };
    // The jack in a state waiting longest, on one half of the board if `half` is 0 or 1.
    const oldest = (state, half = -1) => {
      let best = -1;
      for (let j = 0; j < jacks; j++) {
        if (jack[j] !== state || state !== CALLING && jackCord[j] < 0 || half >= 0 && sideOf(j) !== half) continue;
        if (best < 0 || jackT[j] > jackT[best]) best = j;
      }
      return best;
    };
    // The free cord whose plug stands nearest the jack across the shelf.
    const freeCord = (j) => {
      let best = -1, gap = Infinity;
      for (let c = 0; c < n; c++) if (cordJack[c] < 0 && cordHeld[c] < 0) {
        const d = Math.abs(KM.cordX(c) - jackX(j) * 0.4);
        if (d < gap) { gap = d; best = c; }
      }
      return best;
    };
    // The other hand throws a cord's key (or sets it back).
    const keyFor = (c, j, a, v) => {
      const o = 1 - a;
      push(LOOK, 0.1, o, T_KEY, c, j);
      push(MOVE, 0.32, o, T_KEY, c, j);
      push(KEY, 0.18, o, 0, c, j, v);
      push(MOVE, 0.32, o, T_REST, c, j);
    };
    // A plug carried to a jack, lined up in front of it, pushed home and let go of.
    const plugInto = (c, j, a) => {
      push(LOOK, 0, a, T_JACK, c, j);
      push(LEAN, 0, 0, 0, -1, -1, 0.3);
      push(MOVE, 0.6, a, T_JACK, c, j);
      push(MOVE, 0.22, a, T_JACK_IN, c, j);
      push(PLUG, 0.14, a, 0, c, j);
      push(MOVE, 0.2, a, T_JACK, c, j);
      push(MOVE, 0.4, a, T_REST, c, j);
    };
    // A plug taken out of its jack: the fist goes round it and pulls it straight back out.
    const pullFrom = (c, j, a) => {
      push(LOOK, 0.3, a, T_JACK, c, j);
      push(LEAN, 0, 0, 0, -1, -1, 0.3);
      push(MOVE, 0.45, a, T_JACK, c, j);
      push(MOVE, 0.18, a, T_JACK_IN, c, j);
      push(GRAB, 0.12, a, 0, c, j);
      push(MOVE, 0.22, a, T_JACK, c, j);
    };
    // His hands in the air and a shake of the head, at the board.
    const fuss = () => {
      push(MOVE, 0.4, 2, T_UP);
      push(SHAKE, 0.9);
      push(MOVE, 0.5, 2, T_REST);
      push(WAIT, 0.5);
    };
    // Round on his stool to whoever is near: pointing at them or hands up, a line, a shake of the head, and back.
    const complain = (which) => {
      push(LOOK, 0, 0, T_VIEW);
      push(LEAN, 0, 0, 0, -1, -1, 0.05);
      push(SWIVEL, 0.55, 0, 0, -1, -1, 1);
      if (rand() < 0.55) { push(MOVE, 0.3, 0, T_POINT); push(MOVE, 0.3, 1, T_REST); }
      else push(MOVE, 0.35, 2, T_UP);
      push(SAY, 0, 0, 0, -1, -1, which);
      push(SHAKE, 1.1);
      push(MOVE, 0.45, 2, T_REST);
      push(WAIT, 0.5);
      push(SWIVEL, 0.55, 0, 0, -1, -1, 0);
      push(LOOK, 0, 0, T_JACK, -1, Math.floor(rand() * jacks));
      push(LEAN, 0, 0, 0, -1, -1, 0.1);
      push(WAIT, 0.4);
    };
    // Whoever is near and a line due: complain to them; otherwise mostly just a moment.
    const afterwards = (chance, which) => {
      if (near && quiet <= 0 && rand() < chance) complain(which);
      else if (rand() < 0.15) fuss();
      else push(WAIT, 0.4 + rand() * 1.2);
    };
    const connect = (j, c) => {
      const a = sideOf(j);
      push(LOOK, 0.3, a, T_JACK, c, j);
      push(LOOK, 0, a, T_HOME, c, j);
      push(LEAN, 0, 0, 0, -1, -1, 0.14);
      push(MOVE, 0.45, a, T_HOME, c, j);
      push(GRAB, 0.16, a, 0, c, j);
      plugInto(c, j, a);
      keyFor(c, j, a, 0.55);
      push(LEAN, 0, 0, 0, -1, -1, 0.1);
      afterwards(0.35, -1);
    };
    // A plugged cord pulled from one jack and pushed into another on the same half: rebalancing, by hand.
    const repatch = (was, j) => {
      const c = jackCord[was], a = sideOf(j);
      pullFrom(c, was, a);
      plugInto(c, j, a);
      push(LEAN, 0, 0, 0, -1, -1, 0.1);
      afterwards(0.6, REBALANCING);
    };
    const disconnect = (j) => {
      const c = jackCord[j], a = sideOf(j);
      pullFrom(c, j, a);
      push(LEAN, 0, 0, 0, -1, -1, 0.14);
      push(LOOK, 0, a, T_HOME, c, j);
      push(MOVE, 0.55, a, T_HOME, c, j);
      push(DROP, 0.14, a, 0, c, j);
      push(MOVE, 0.35, a, T_REST, c, j);
      keyFor(c, j, a, 0);
      push(LEAN, 0, 0, 0, -1, -1, 0.1);
      push(WAIT, 0.3 + rand());
    };
    // A lamp flickering out is pulled first. A call is answered with a free cord, or now and then (and always when
    // none is free) by moving one already plugged on the same half. Otherwise a moment to himself: scowling at the
    // board up close, a glance at whoever is near, a word for them, or his hands in the air.
    const plan = () => {
      count = at = 0;
      stepT = 0;
      let j = oldest(CLEARING);
      if (j >= 0) disconnect(j);
      else if ((j = oldest(CALLING)) >= 0) {
        const c = freeCord(j), was = oldest(CONNECTED, sideOf(j));
        if (was >= 0 && (c < 0 || rand() < 0.3)) repatch(was, j);
        else if (c >= 0) connect(j, c);
        else push(WAIT, 0.5);
      } else {
        const r = rand();
        if (near && quiet <= 0 && r < 0.4) complain(-1);
        else if (r < 0.12) fuss();
        else if (near && r < 0.3) { push(LOOK, 1.4, 0, T_VIEW); push(LOOK, 0, 0, T_JACK, -1, Math.floor(rand() * jacks)); push(WAIT, 0.4); }
        else if (r < 0.65) {
          push(LEAN, 0, 0, 0, -1, -1, 0.36);
          push(LOOK, 1.4, 0, T_JACK, -1, Math.floor(rand() * jacks));
          push(LOOK, 1.0, 0, T_JACK, -1, Math.floor(rand() * jacks));
          push(LEAN, 0, 0, 0, -1, -1, 0.1);
          push(WAIT, 0.6);
        } else push(WAIT, 1 + rand() * 1.5);
      }
      begin(steps[0]);
    };
    // Calls come and go on their own: a new one on an idle jack while fewer than five are live, else one clears.
    const event = () => {
      let live = 0;
      for (let j = 0; j < jacks; j++) if (jack[j] !== IDLE) live++;
      if (live < 5 && rand() < 0.7) {
        for (let tries = 0; tries < 12; tries++) {
          const j = Math.floor(rand() * jacks);
          if (jack[j] === IDLE) { jack[j] = CALLING; jackT[j] = 0; return; }
        }
      }
      for (let tries = 0; tries < 12; tries++) {
        const j = Math.floor(rand() * jacks);
        if (jack[j] === CONNECTED && jackT[j] > 5) { jack[j] = CLEARING; jackT[j] = 0; return; }
      }
    };

    // Two-bone reach: the fist goes to its hand's point, or as far toward it as the arm goes, the elbow bending out
    // from the body and down, as an arm's does. The upper arm is aimed in the body's frame, the forearm in the upper
    // arm's; each part hangs along its own -y.
    const reachFor = (a) => {
      const upper = a === 0 ? P.armR : P.armL, lower = a === 0 ? P.foreR : P.foreL, side = a === 0 ? -1 : 1, o = a * 3;
      toWall(side * armX, shoulderY, 0);
      const sx = OUT[0], sy = OUT[1], sz = OUT[2];
      const dx = hand[o] - sx, dy = hand[o + 1] - sy, dz = hand[o + 2] - sz, dist = Math.hypot(dx, dy, dz) || 1e-4, d = clamp(dist, 0.12, REACH);
      fist[o] = sx + dx / dist * d; fist[o + 1] = sy + dy / dist * d; fist[o + 2] = sz + dz / dist * d;
      toBody(dx / dist, dy / dist, dz / dist);
      const nx = DIR[0], ny = DIR[1], nz = DIR[2];
      let px = side * 0.75, py = -0.55, pz = -0.35;
      const along = px * nx + py * ny + pz * nz;
      px -= nx * along; py -= ny * along; pz -= nz * along;
      const pl = Math.hypot(px, py, pz) || 1;
      px /= pl; py /= pl; pz /= pl;
      const ca = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
      const ux = nx * ca + px * sa, uy = ny * ca + py * sa, uz = nz * ca + pz * sa;
      const z1 = Math.asin(clamp(ux, -1, 1)), x1 = Math.atan2(-uz, -uy);
      upper.rotation.x = x1; upper.rotation.y = 0; upper.rotation.z = z1;
      let fx = nx * d - ux * L1, fy = ny * d - uy * L1, fz = nz * d - uz * L1;
      const fl = Math.hypot(fx, fy, fz) || 1;
      fx /= fl; fy /= fl; fz /= fl;
      dirToWall(fx, fy, fz);
      fore[o] = OUT[0]; fore[o + 1] = OUT[1]; fore[o + 2] = OUT[2];
      const c1 = Math.cos(x1), s1 = Math.sin(x1), c2 = Math.cos(z1), s2 = Math.sin(z1);
      const ay = fy * c1 + fz * s1, az = -fy * s1 + fz * c1, lx = fx * c2 + ay * s2, ly = -fx * s2 + ay * c2;
      lower.rotation.x = Math.atan2(-az, -ly); lower.rotation.y = 0; lower.rotation.z = Math.asin(clamp(lx, -1, 1));
    };
    // Lays a cord's segments along a curve from its hole in the shelf to its plug's boot, sagging and bowing toward him,
    // and lying on the shelf rather than through it.
    const drawCord = (c, bx, by, bz) => {
      const ax = KM.cordX(c), ay = B.shelf + 0.035, az = B.plugZ;
      const span = Math.hypot(bx - ax, by - ay, bz - az), bow = 0.08 + span * 0.32;
      let px = ax, py = ay, pz = az;
      for (let s = 1; s <= SEGMENTS; s++) {
        const t = s / SEGMENTS, b = 4 * t * (1 - t) * bow;
        const qx = ax + (bx - ax) * t, qy = Math.max(B.shelf + 0.045, ay + (by - ay) * t - b * 0.5), qz = az + (bz - az) * t + b;
        const seg = segs[c * SEGMENTS + s - 1], dx = qx - px, dy = qy - py, dz = qz - pz, len = Math.hypot(dx, dy, dz) || 1e-4;
        seg.visible = true;
        seg.position.x = (px + qx) / 2; seg.position.y = (py + qy) / 2; seg.position.z = (pz + qz) / 2;
        seg.rotation.y = Math.atan2(dx, dz);
        seg.rotation.x = -Math.asin(clamp(dy / len, -1, 1));
        seg.scale.x = seg.scale.y = B.cordR;
        seg.scale.z = len + 0.012;
        px = qx; py = qy; pz = qz;
      }
    };

    const update = (dt, elapsed, view) => {
      time += dt;
      // The view in the wall's frame, and whether it is near enough for him to turn to it.
      viewer[0] = -(view.z - oz); viewer[1] = view.y - oy; viewer[2] = view.x - ox;
      near = Math.hypot(view.x - (ox + seatZ), view.y - (oy + 1), view.z - oz) < HEAR;
      quiet -= dt;
      eventIn -= dt;
      if (eventIn <= 0) { eventIn = 2.2 + rand() * 3.2; event(); }
      for (let j = 0; j < jacks; j++) jackT[j] += dt;

      // The plan: a step ends after its time and the next begins; a used-up plan makes the next.
      if (count === 0) plan();
      stepT += dt;
      while (at < count && stepT >= steps[at].dur) {
        stepT -= steps[at].dur;
        if (++at < count) begin(steps[at]);
      }
      if (at >= count) plan();

      // His body: the swivel, the lean and a breath first, so his hands' body-held targets ride them.
      let turn = (yawTarget - yaw) % TAU;
      if (turn > Math.PI) turn -= TAU; else if (turn < -Math.PI) turn += TAU;
      yaw += turn * Math.min(1, dt * 7);
      lean += (leanTarget - lean) * Math.min(1, dt * 6);
      k.root.rotation.y = yaw;
      k.root.rotation.x = lean;
      k.root.position.y = seatY + 0.008 * Math.sin(time * 1.8);
      P.legR.rotation.x = P.legL.rotation.x = -1.45 - lean;
      for (let a = 0; a < 2; a++) {
        const o = a * 3;
        pointOf(kind[a], a, kindCord[a], kindJack[a], hand, o);
        if (moveDur[a] > 0) {
          moveT[a] = Math.min(moveT[a] + dt, moveDur[a]);
          const e = smooth(moveT[a] / moveDur[a]);
          for (let i = 0; i < 3; i++) hand[o + i] = from[o + i] + (hand[o + i] - from[o + i]) * e;
          if (moveT[a] >= moveDur[a]) moveDur[a] = 0;
        }
        reachFor(a);
      }
      // The head turned to what he looks at, a shake now and then, and a blink.
      pointOf(lookKind, 0, -1, lookJack, look, 0);
      toWall(0, headY, headZ);
      toBody(look[0] - OUT[0], look[1] - OUT[1], look[2] - OUT[2]);
      headYaw += (clamp(Math.atan2(DIR[0], DIR[2]), -0.9, 0.9) - headYaw) * Math.min(1, dt * 8);
      headPitch += (clamp(-Math.atan2(DIR[1], Math.hypot(DIR[0], DIR[2])), -0.5, 0.45) - headPitch) * Math.min(1, dt * 8);
      if (shakeDur > 0) { shake += dt; if (shake >= shakeDur) shakeDur = 0; }
      P.head.rotation.y = headYaw + (shakeDur > 0 ? Math.sin(shake * 18) * 0.35 * (1 - shake / shakeDur) : 0);
      P.head.rotation.x = headPitch;
      blinkIn -= dt;
      if (blinkIn <= 0) { blink = 0.12; blinkIn = 2.5 + rand() * 3; }
      if (blink > 0) blink -= dt;
      const face = blink > 0 ? k.headClosed : k.headOpen;
      if (P.head.geometry !== face) P.head.geometry = face;

      // The plugs. In a fist one lies along the forearm, boot to the elbow, or square to the board while it is lined up
      // with a jack or pushed in, or upright over its hole while it is set down; otherwise it stands in its jack or its
      // hole. Its boot turns smoothly, and where it sits settles over a moment after it changes hands. A cord shows
      // from its hole to the boot whenever its plug is out.
      for (let c = 0; c < n; c++) {
        const p = plugs[c], held = cordHeld[c], j = cordJack[c], o = c * 3;
        let ux = 0, uy = 1, uz = 0, tx, ty, tz;
        if (held >= 0) {
          const h = held * 3, kd = kind[held];
          if (kd === T_JACK || kd === T_JACK_IN) { uy = 0; uz = 1; }
          else if (kd !== T_HOME) { ux = -fore[h]; uy = -fore[h + 1]; uz = -fore[h + 2]; }
        } else if (j >= 0) { uy = 0; uz = 1; }
        const e = Math.min(1, dt * 14);
        let dx = plugDir[o] + (ux - plugDir[o]) * e, dy = plugDir[o + 1] + (uy - plugDir[o + 1]) * e, dz = plugDir[o + 2] + (uz - plugDir[o + 2]) * e;
        const dl = Math.hypot(dx, dy, dz) || 1;
        dx /= dl; dy /= dl; dz /= dl;
        plugDir[o] = dx; plugDir[o + 1] = dy; plugDir[o + 2] = dz;
        if (held >= 0) { const h = held * 3; tx = fist[h] - dx * KM.GRIP; ty = fist[h + 1] - dy * KM.GRIP; tz = fist[h + 2] - dz * KM.GRIP; }
        else if (j >= 0) { tx = jackX(j); ty = jackY(j); tz = IN_JACK; }
        else { tx = KM.cordX(c); ty = B.shelf + 0.03; tz = B.plugZ; }
        plugBlend[c] = Math.min(1, plugBlend[c] + dt / SETTLE);
        const b = smooth(plugBlend[c]);
        plugPos[o] = plugFrom[o] + (tx - plugFrom[o]) * b;
        plugPos[o + 1] = plugFrom[o + 1] + (ty - plugFrom[o + 1]) * b;
        plugPos[o + 2] = plugFrom[o + 2] + (tz - plugFrom[o + 2]) * b;
        p.position.x = plugPos[o]; p.position.y = plugPos[o + 1]; p.position.z = plugPos[o + 2];
        p.rotation.x = Math.acos(clamp(dy, -1, 1));
        p.rotation.y = Math.atan2(dx, dz);
        if (held >= 0 || j >= 0 || plugBlend[c] < 1) drawCord(c, plugPos[o] + dx * KM.PLUG, plugPos[o + 1] + dy * KM.PLUG, plugPos[o + 2] + dz * KM.PLUG);
        else for (let s = 0; s < SEGMENTS; s++) segs[c * SEGMENTS + s].visible = false;
        keyThrow[c] += (keyTarget[c] - keyThrow[c]) * Math.min(1, dt * 14);
        keys[c].rotation.x = keyThrow[c];
      }
      // The lamps: a call flashes, a connection burns steady, a clearing one flickers, and the rest of the board
      // blinks slowly on its own.
      for (let i = 0; i < lamps.length; i++) {
        const a = activeOf[i];
        let g;
        if (a >= 0) {
          const st = jack[a];
          g = st === CALLING ? (Math.sin(time * 11) > 0 ? 1.5 : 0.18) : st === CONNECTED ? 1 : st === CLEARING ? (Math.sin(time * 23 + a) > 0.3 ? 0.9 : 0.15) : 0.12;
        } else {
          const f = time * rate[i] + phase[i];
          g = f - Math.floor(f) < 0.22 ? 0.95 : 0.12;
        }
        if (lamps[i].glow !== g) lamps[i].glow = g;
      }
    };
    const liveGeometry = (set) => { set.add(k.headOpen).add(k.headClosed); };
    const dispose = () => { count = at = 0; };
    return { node, kortik: k, update, liveGeometry, dispose, get jacks() { return jack; }, get cords() { return cordJack; }, get held() { return cordHeld; }, get near() { return near; } };
  };
  BL.kortik = { create, LINES };
})();
