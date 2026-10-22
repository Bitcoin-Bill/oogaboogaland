// Kortik at his switchboard. Lamps on the board start flashing as calls come in; he answers each by lifting a cord's
// plug from the shelf, carrying it to the lit jack and pushing it in, then throws its key, and pulls the cord back when
// the lamp flickers out. Out of free cords, or just because, he moves a plugged cord from one jack to another. Between
// calls he leans in to scowl at the board, throws up his hands and shakes his head, and when someone is near he swivels
// round on his stool to point and tell them what he thinks of Lightning. It is comedy, not routing: nothing here reads
// the node. Everything runs in the wall's frame (kortik-models.js) on a fixed set of nodes; update allocates nothing.
(() => {
  "use strict";
  const BL = window.BL, KM = BL.kortikModels, FM = BL.factoryModels;
  const { createNode, addChild } = BL.scene;
  const LINES = ["Gosh, I hate Lightning.", "Another channel? Of course.", "Lightning is just a switchboard with extra steps.",
    "More rebalancing? Seriously?", "Plug. Unplug. Repeat.", "More channels? Really?"];
  const REBALANCING = 3;
  // How near the view must be for him to turn and speak, and the quiet he keeps between lines, in seconds.
  const HEAR = 16, QUIET = [16, 30];
  const SEGMENTS = 8, CORD_W = 0.03, TAU = Math.PI * 2;
  // A plan's steps, where a hand goes (the first four in the wall's frame, the rest with his body), and a jack's states.
  const LOOK = 0, MOVE = 1, GRAB = 2, PLUG = 3, DROP = 4, KEY = 5, LEAN = 6, SAY = 7, SHAKE = 8, WAIT = 9, SWIVEL = 10;
  const T_JACK = 0, T_JACK_IN = 1, T_HOME = 2, T_KEY = 3, T_REST = 4, T_UP = 5, T_POINT = 6, T_VIEW = 7;
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

    // The cords: a plug, its key and its cord's segments each, and where each one is.
    const n = B.cords, plugs = [], keys = [], segs = [];
    const cordJack = new Int8Array(n).fill(-1), cordHeld = new Int8Array(n).fill(-1);
    const keyThrow = new Float32Array(n), keyTarget = new Float32Array(n);
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
    }

    // Kortik on his stool, facing the board (-z, a yaw of pi); his right hand is on the board's +x side.
    const k = BL.models.caveman(KM.traits()), P = k.parts, h = k.traits.height;
    const ARM = 10.5 * h / 16, armX = P.armL.position.x, shoulderY = P.armL.position.y, headY = P.head.position.y, headZ = P.head.position.z;
    const seatY = B.seat.y, seatZ = B.seat.z;
    k.root.position.y = seatY;
    k.root.position.z = seatZ;
    k.root.rotation.y = Math.PI;
    // A big head on a stocky body, as the character sheet draws him.
    P.head.scale.x = P.head.scale.y = P.head.scale.z = 1.22;
    addChild(node, k.root);

    // His body's turn and lean, and a point turned with them into the wall's frame (into OUT), or a direction turned
    // back into his body's frame (into DIR).
    let yaw = Math.PI, yawTarget = Math.PI, lean = 0.1, leanTarget = 0.1;
    const OUT = new Float32Array(3), DIR = new Float32Array(3);
    const toWall = (x, y, z) => {
      const cl = Math.cos(lean), sl = Math.sin(lean), cy = Math.cos(yaw), sy = Math.sin(yaw);
      const ly = y * cl - z * sl, lz = y * sl + z * cl;
      OUT[0] = x * cy + lz * sy; OUT[1] = k.root.position.y + ly; OUT[2] = seatZ - x * sy + lz * cy;
    };
    const toBody = (x, y, z) => {
      const cl = Math.cos(lean), sl = Math.sin(lean), cy = Math.cos(yaw), sy = Math.sin(yaw);
      const bx = x * cy - z * sy, bz = x * sy + z * cy;
      DIR[0] = bx; DIR[1] = y * cl + bz * sl; DIR[2] = -y * sl + bz * cl;
    };

    // Each hand: what it is going to (a target kind and its cord and jack), from where, how far along, and where its
    // arm actually reaches this frame.
    const hand = new Float32Array(6), from = new Float32Array(6), reach = new Float32Array(6);
    const kind = new Uint8Array([T_REST, T_REST]), kindCord = new Int8Array(2), kindJack = new Int8Array(2);
    const moveT = new Float32Array(2), moveDur = new Float32Array(2), look = new Float32Array(3), viewer = new Float32Array(3);
    let lookKind = T_JACK, lookJack = 12, headYaw = 0, headPitch = 0, shake = 0, shakeDur = 0, time = 0;
    let quiet = 4, line = 0, eventIn = 1.5, blinkIn = 3, blink = 0, near = false;
    // Where a target is, in the wall's frame, into `out` at `o`.
    const pointOf = (target, arm, cord, j, out, o) => {
      if (target === T_JACK || target === T_JACK_IN) { out[o] = jackX(j); out[o + 1] = jackY(j); out[o + 2] = target === T_JACK ? 0.17 : 0.08; return; }
      if (target === T_HOME) { out[o] = KM.cordX(cord); out[o + 1] = B.shelf + 0.16; out[o + 2] = B.plugZ; return; }
      if (target === T_KEY) { out[o] = KM.cordX(cord); out[o + 1] = B.shelf + 0.12; out[o + 2] = B.keyZ; return; }
      if (target === T_POINT || target === T_VIEW) { out[o] = viewer[0]; out[o + 1] = viewer[1]; out[o + 2] = viewer[2]; return; }
      const side = arm === 0 ? -1 : 1;
      if (target === T_UP) toWall(side * 0.45, 2.1 - seatY, 0.08);
      else toWall(side * 0.34, B.shelf + 0.05 - seatY, 0.52);
      out[o] = OUT[0]; out[o + 1] = OUT[1]; out[o + 2] = OUT[2];
    };
    pointOf(T_REST, 0, -1, -1, hand, 0);
    pointOf(T_REST, 1, -1, -1, hand, 3);

    // A plan is a list of steps from a fixed pool, run one after another.
    const steps = [];
    for (let i = 0; i < 32; i++) steps.push({ kind: WAIT, dur: 0, arm: 0, target: 0, cord: -1, jack: -1, v: 0 });
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
        keyTarget[s.cord] = 0;
        cordJack[s.cord] = -1;
        cordHeld[s.cord] = s.arm;
      } else if (s.kind === PLUG) {
        cordHeld[s.cord] = -1;
        cordJack[s.cord] = s.jack;
        jack[s.jack] = CONNECTED; jackCord[s.jack] = s.cord; jackT[s.jack] = 0;
      } else if (s.kind === DROP) { cordHeld[s.cord] = -1; cordJack[s.cord] = -1; }
      else if (s.kind === KEY) keyTarget[s.cord] = s.v;
      else if (s.kind === SAY) say(s.v);
      else if (s.kind === SHAKE) { shake = 0; shakeDur = s.dur; }
    };
    const oldest = (state) => {
      let best = -1;
      for (let j = 0; j < jacks; j++) if (jack[j] === state && (state === CALLING || jackCord[j] >= 0) && (best < 0 || jackT[j] > jackT[best])) best = j;
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
    const keyFor = (c, j, a) => {
      const o = 1 - a;
      push(LOOK, 0.1, o, T_KEY, c, j);
      push(MOVE, 0.32, o, T_KEY, c, j);
      push(KEY, 0.18, o, 0, c, j, 0.55);
      push(MOVE, 0.32, o, T_REST, c, j);
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
      const a = jackX(j) >= 0 ? 0 : 1;
      push(LOOK, 0.35, a, T_JACK, c, j);
      push(LEAN, 0, 0, 0, -1, -1, 0.14);
      push(MOVE, 0.45, a, T_HOME, c, j);
      push(GRAB, 0.12, a, 0, c, j);
      push(LEAN, 0, 0, 0, -1, -1, 0.32);
      push(MOVE, 0.62, a, T_JACK, c, j);
      push(MOVE, 0.16, a, T_JACK_IN, c, j);
      push(PLUG, 0.12, a, 0, c, j);
      push(MOVE, 0.4, a, T_REST, c, j);
      keyFor(c, j, a);
      push(LEAN, 0, 0, 0, -1, -1, 0.1);
      afterwards(0.35, -1);
    };
    // A plugged cord pulled from one jack and pushed into another: rebalancing, by hand.
    const repatch = (from, j) => {
      const c = jackCord[from], a = jackX(j) >= 0 ? 0 : 1;
      push(LOOK, 0.3, a, T_JACK, c, from);
      push(LEAN, 0, 0, 0, -1, -1, 0.3);
      push(MOVE, 0.5, a, T_JACK_IN, c, from);
      push(GRAB, 0.1, a, 0, c, from);
      push(MOVE, 0.18, a, T_JACK, c, from);
      push(LOOK, 0.05, a, T_JACK, c, j);
      push(MOVE, 0.62, a, T_JACK, c, j);
      push(MOVE, 0.16, a, T_JACK_IN, c, j);
      push(PLUG, 0.12, a, 0, c, j);
      push(MOVE, 0.4, a, T_REST, c, j);
      keyFor(c, j, a);
      push(LEAN, 0, 0, 0, -1, -1, 0.1);
      afterwards(0.6, REBALANCING);
    };
    const disconnect = (j) => {
      const c = jackCord[j], a = jackX(j) >= 0 ? 0 : 1;
      push(LOOK, 0.3, a, T_JACK, c, j);
      push(LEAN, 0, 0, 0, -1, -1, 0.3);
      push(MOVE, 0.55, a, T_JACK_IN, c, j);
      push(GRAB, 0.1, a, 0, c, j);
      push(MOVE, 0.2, a, T_JACK, c, j);
      push(LEAN, 0, 0, 0, -1, -1, 0.14);
      push(LOOK, 0.05, a, T_HOME, c, j);
      push(MOVE, 0.55, a, T_HOME, c, j);
      push(DROP, 0.12, a, 0, c, j);
      push(MOVE, 0.35, a, T_REST, c, j);
      push(LEAN, 0, 0, 0, -1, -1, 0.1);
      push(WAIT, 0.3 + rand());
    };
    // A lamp flickering out is pulled first. A call is answered with a free cord, or now and then (and always when
    // none is free) by moving one already plugged. Otherwise a moment to himself: scowling at the board up close, a
    // glance at whoever is near, a word for them, or his hands in the air.
    const plan = () => {
      count = at = 0;
      stepT = 0;
      let j = oldest(CLEARING);
      if (j >= 0) disconnect(j);
      else if ((j = oldest(CALLING)) >= 0) {
        const c = freeCord(j), moved = oldest(CONNECTED);
        if (moved >= 0 && (c < 0 || rand() < 0.3)) repatch(moved, j);
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
    // Calls come and go on their own: a new one on an idle jack while fewer than six are live, else one clears.
    const event = () => {
      let live = 0;
      for (let j = 0; j < jacks; j++) if (jack[j] !== IDLE) live++;
      if (live < 6 && rand() < 0.7) {
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

    // Aims an arm from its shoulder at its hand's point and writes where the hand ends up. A far jack stretches the
    // arm a little; a point far off (at whoever is near) is a gesture at arm's length.
    const aim = (a) => {
      const arm = a === 0 ? P.armR : P.armL, o = a * 3;
      toWall(a === 0 ? -armX : armX, shoulderY, 0);
      const sx = OUT[0], sy = OUT[1], sz = OUT[2];
      let dx = hand[o] - sx, dy = hand[o + 1] - sy, dz = hand[o + 2] - sz;
      const dist = Math.hypot(dx, dy, dz) || 1;
      dx /= dist; dy /= dist; dz /= dist;
      toBody(dx, dy, dz);
      arm.rotation.z = Math.asin(clamp(DIR[0], -1, 1));
      arm.rotation.x = Math.atan2(-DIR[2], -DIR[1]);
      arm.rotation.y = 0;
      const stretch = dist > ARM * 1.6 ? 1 : clamp(dist / ARM, 1, 1.22), r = ARM * stretch;
      arm.scale.y = stretch;
      reach[o] = sx + dx * r; reach[o + 1] = sy + dy * r; reach[o + 2] = sz + dz * r;
    };
    // Lays a cord's segments along a curve from its hole in the shelf to its plug's far end, sagging and bowing toward
    // him, and lying on the shelf rather than through it.
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
        seg.scale.x = seg.scale.y = CORD_W;
        seg.scale.z = len + 0.008;
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
        aim(a);
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

      // The plugs: in a hand, in a jack, or standing in the shelf; a cord shows whenever its plug is out.
      for (let c = 0; c < n; c++) {
        const p = plugs[c], held = cordHeld[c], j = cordJack[c];
        let tilt = 0;
        if (held >= 0) { p.position.x = reach[held * 3]; p.position.y = reach[held * 3 + 1]; p.position.z = reach[held * 3 + 2]; tilt = 1.1; }
        else if (j >= 0) { p.position.x = jackX(j); p.position.y = jackY(j); p.position.z = 0.012; tilt = Math.PI / 2; }
        else { p.position.x = KM.cordX(c); p.position.y = B.shelf + 0.03; p.position.z = B.plugZ; }
        p.rotation.x = tilt;
        if (held >= 0 || j >= 0) drawCord(c, p.position.x, p.position.y + KM.PLUG * Math.cos(tilt), p.position.z + KM.PLUG * Math.sin(tilt));
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
    return { node, kortik: k, update, liveGeometry, dispose, get jacks() { return jack; }, get cords() { return cordJack; }, get near() { return near; } };
  };
  BL.kortik = { create, LINES };
})();
