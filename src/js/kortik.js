// Kortik at his switchboard. Lamps on the board start flashing as calls come in; he answers each by taking a cord's plug
// from the shelf in his fist, lining it up in front of the lit jack and pushing it home, letting go, and throwing its key;
// when the lamp flickers out he pulls the plug straight back out and sets it upright in its hole again. Out of free
// cords, or just because, he moves a plugged cord from one jack to another. Between calls he leans in to scowl at the
// board, and when someone is near he acts out what he thinks of Lightning, one emote at a time with a quiet between:
// hands up, a facepalm, a fist on the desk that makes his mug jump, a slow clap for a failed payment, a shout for Tess,
// a search for his liquidity under his mug. Now and then he has had ENOUGH: he stands up on his stool, draws his katana
// and cuts the board until every channel drops, sheathes it and sits back down to rewire. It is comedy, not routing:
// nothing here reads the node.
// His arms bend at the elbow (two-bone reach), so a fist lands where it means to; a plug in it lies along the forearm,
// the drawn sword along the cut. Everything runs in the wall's frame (kortik-models.js) on a fixed set of nodes;
// update allocates nothing.
(() => {
  "use strict";
  const BL = window.BL, KM = BL.kortikModels, FM = BL.factoryModels, Q = BL.math.quat;
  const { createNode, addChild } = BL.scene;
  // What he says: one line an emote, in emote order, the katana's last, then its two afterwords.
  const LINES = ["Gosh, I hate Lightning!", "Another channel? Unbelievable!", "Now I have to rebalance. BY HAND!", "They never make it easy on you!",
    "Open channel. Close channel. Open channel...", "WHO moved my liquidity?!", "Another failed payment. Wonderful.",
    "And they call this the future of money!", "Tess! Make yourself useful!", "It worked? That's suspicious.", "Show-off.",
    "Stuck HTLC. Classic.", "ENOUGH!", "Force-closed.", "Now I have to rewire all of it."];
  const KATANA = 12, FORCED = 13, REWIRE = 14;
  const EMOTES = ["hate", "unbelievable", "rebalance", "slam", "openclose", "liquidity", "clap", "future", "tess", "suspicious", "showoff", "htlc", "katana"];
  // How near the view must be for him to act up, and the quiet he keeps between emotes, in seconds.
  const HEAR = 16, QUIET = [12, 22];
  // A plug's place in a jack, how far out a hand lines it up before pushing it home, and how long it takes to settle
  // into a fist, a jack or its hole.
  const IN_JACK = 0.012, APPROACH = 0.13, SETTLE = 0.15;
  // How high he stands on his stool, and how long the sword takes to come into his hand and to go back.
  const RISE = 0.46, DRAW = 0.26, SHEATHE = 0.42;
  const SEGMENTS = 10, TAU = Math.PI * 2;
  // A plan's steps, where a hand goes (in the wall's frame, or with his body), and a jack's states.
  const LOOK = 0, MOVE = 1, GRAB = 2, PLUG = 3, DROP = 4, KEY = 5, LEAN = 6, SAY = 7, SHAKE = 8, WAIT = 9, SWIVEL = 10, STAND = 11, ROLL = 12;
  const THUD = 13, FAIL = 14, WAG = 15, SWORD = 16, FORCE = 17, TILT = 18, SCAB = 19, MUG = 20;
  const T_JACK = 0, T_JACK_IN = 1, T_HOME = 2, T_KEY = 3, T_POINT = 4, T_VIEW = 5, T_REST = 6, T_UP = 7, T_FACE = 8, T_CHIN = 9, T_MOUTH = 10;
  const T_CLAP = 11, T_SPREAD = 12, T_CROSS = 13, T_RAISE = 14, T_DESK = 15, T_ACCUSE = 16, T_TAP = 17, T_HILT = 18, T_SCAB = 19, T_SWORD = 20;
  const T_TWO = 21, T_YANK = 22, T_CONSOLE = 23, T_HALL = 24, T_LAP = 25, T_MUG = 26, T_LIFT = 27, T_MUGSPOT = 28;
  const IDLE = 0, CALLING = 1, CONNECTED = 2, CLEARING = 3;
  // The drawn sword's poses, each [fist x, y, z in the wall's frame, the blade's angle round the board's face from +x,
  // its tilt toward the board, his body's twist]: on guard, then wound up and cut, three times, and the flick.
  const POSE = 6, GUARD = 0, FLICK = 7;
  const POSES = new Float32Array([
    0.1, 1.4, 0.42, 1.62, 0.3, 0,
    0.5, 2.05, 0.72, 1.95, -0.45, -0.5,
    -0.32, 1.12, 0.45, 3.9, 0.4, 0.55,
    -0.4, 2.02, 0.7, 1.2, -0.45, 0.5,
    0.45, 1.12, 0.45, -0.8, 0.4, -0.55,
    0.55, 1.2, 0.6, -0.35, -0.25, -0.6,
    -0.3, 1.85, 0.5, 2.5, 0.4, 0.55,
    0.45, 1.25, 0.55, -0.9, 0.1, -0.2
  ]);
  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrapAngle = (a) => a - TAU * Math.round(a / TAU);
  // A rotation as a quaternion from where it sends x, y and z, into `out`.
  const fromBasis = (out, xx, xy, xz, yx, yy, yz, zx, zy, zz) => {
    const tr = xx + yy + zz;
    if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; out[3] = 0.25 * s; out[0] = (yz - zy) / s; out[1] = (zx - xz) / s; out[2] = (xy - yx) / s; }
    else if (xx > yy && xx > zz) { const s = Math.sqrt(1 + xx - yy - zz) * 2; out[3] = (yz - zy) / s; out[0] = 0.25 * s; out[1] = (yx + xy) / s; out[2] = (zx + xz) / s; }
    else if (yy > zz) { const s = Math.sqrt(1 + yy - xx - zz) * 2; out[3] = (zx - xz) / s; out[0] = (yx + xy) / s; out[1] = 0.25 * s; out[2] = (zy + yz) / s; }
    else { const s = Math.sqrt(1 + zz - xx - yy) * 2; out[3] = (xy - yx) / s; out[0] = (zx + xz) / s; out[1] = (zy + yz) / s; out[2] = 0.25 * s; }
    return out;
  };

  const create = ({ fx }) => {
    const B = KM.BOARD, S = KM.station(), L = FM.LAYOUT.kortik, K = KM.KATANA, rand = BL.math.mulberry32(0x6b6f7274);
    const ox = L.x - L.w / 2 + FM.KORTIK.face, oy = L.y, oz = L.z;
    const node = createNode({ position: { x: ox, y: oy, z: oz }, rotation: { x: 0, y: Math.PI / 2, z: 0 } });
    addChild(node, createNode({ geometry: S.body }), createNode({ geometry: S.glass }));
    const sign = KM.sign(), signNode = createNode({ position: { x: 0, y: B.sign.y, z: B.sign.z } });
    addChild(signNode, createNode({ geometry: sign.back }), createNode({ geometry: sign.face }));
    addChild(node, signNode);
    KM.NOTES.forEach((n, i) => addChild(node, createNode({ position: { x: n.x, y: n.y, z: 0.03 }, rotation: { x: 0, y: 0, z: n.tilt }, geometry: S.notes[i] })));
    addChild(node, createNode({ position: { x: KM.LOG.x, y: KM.LOG.y, z: KM.LOG.z }, rotation: { x: -Math.PI / 2, y: KM.LOG.ang, z: 0 }, geometry: S.log }));
    const mug = createNode({ position: { x: KM.MUG.x, y: KM.DESK, z: KM.MUG.z }, geometry: S.mug });
    addChild(node, mug);
    // Places in the wall's frame he turns to: the Routing Console, and the middle of the hall where Tess flies.
    const wallOf = (x, y, z, out) => { out[0] = -(z - oz); out[1] = y - oy; out[2] = x - ox; return out; };
    const consoleAt = wallOf(FM.LAYOUT.switchboard.x, FM.LAYOUT.switchboard.y + 2, FM.LAYOUT.switchboard.z, new Float32Array(3));
    const hallAt = wallOf(FM.LAYOUT.ring.x, FM.LAYOUT.ring.y + 4, FM.LAYOUT.ring.z, new Float32Array(3));

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
    // where it was to where it goes whenever it is taken, plugged in or set down; a cut one flies home in an arc.
    const n = B.cords, plugs = [], keys = [], segs = [];
    const cordJack = new Int8Array(n).fill(-1), cordHeld = new Int8Array(n).fill(-1);
    const keyThrow = new Float32Array(n), keyTarget = new Float32Array(n);
    const plugPos = new Float32Array(n * 3), plugFrom = new Float32Array(n * 3), plugDir = new Float32Array(n * 3), plugBlend = new Float32Array(n).fill(1);
    const plugSettle = new Float32Array(n).fill(SETTLE), plugArc = new Float32Array(n);
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
    const qRest = Q.fromEuler(Q.create(), K.rest[0], K.rest[1], K.rest[2]), qReady = Q.fromEuler(Q.create(), K.ready[0], K.ready[1], K.ready[2]), qHand = Q.create();

    // His body's turn, lean, sideways roll and standing; a point turned with them into the wall's frame (into OUT), a
    // direction likewise, or a direction turned back into his body's frame (into DIR).
    let yaw = Math.PI, yawTarget = Math.PI, lean = 0.1, leanTarget = 0.1, roll = 0, rollTarget = 0, rise = 0, riseTarget = 0;
    let cl = 1, sl = 0, cy = -1, sy = 0, cr = 1, sr = 0;
    const trig = () => { cl = Math.cos(lean); sl = Math.sin(lean); cy = Math.cos(yaw); sy = Math.sin(yaw); cr = Math.cos(roll); sr = Math.sin(roll); };
    trig();
    const OUT = new Float32Array(3), DIR = new Float32Array(3), V3 = new Float32Array(3);
    const dirToWall = (x, y, z) => {
      const rx = x * cr - y * sr, ry = x * sr + y * cr;
      const ly = ry * cl - z * sl, lz = ry * sl + z * cl;
      OUT[0] = rx * cy + lz * sy; OUT[1] = ly; OUT[2] = -rx * sy + lz * cy;
    };
    const toWall = (x, y, z) => {
      dirToWall(x, y, z);
      OUT[1] += k.root.position.y; OUT[2] += seatZ;
    };
    const toBody = (x, y, z) => {
      const bx = x * cy - z * sy, bz = x * sy + z * cy;
      const by = y * cl + bz * sl;
      DIR[0] = bx * cr + by * sr; DIR[1] = -bx * sr + by * cr; DIR[2] = -y * sl + bz * cl;
    };

    // Each hand: what it is going to (a target kind and its cord and jack), from where, how far along, where its fist
    // actually is this frame, and which way its forearm points.
    const hand = new Float32Array(6), from = new Float32Array(6), fist = new Float32Array(6), fore = new Float32Array(6);
    const kind = new Uint8Array([T_REST, T_REST]), kindCord = new Int8Array(2), kindJack = new Int8Array(2);
    const moveT = new Float32Array(2), moveDur = new Float32Array(2), moveE = new Float32Array([1, 1]), wagT = new Float32Array(2);
    const look = new Float32Array(3), viewer = new Float32Array(3);
    let lookKind = T_JACK, lookJack = 4, headYaw = 0, headPitch = 0, headTilt = 0, tiltTarget = 0, shake = 0, shakeDur = 0, time = 0;
    let quiet = 4, eventIn = 1.5, blinkIn = 3, blink = 0, talk = 0, near = false, forced = -1;
    // The sword: drawn or not and how far into his hand, the scabbard's turn ready to draw, the blade's angle and tilt
    // (now, and from and to for the right hand's move), which way it last swung round, whether that move is a cut, and
    // where its point and the left hand's hold are.
    let swordOn = false, swordBlend = 0, scab = 0, scabTarget = 0, bladeTh = 1.62, bladePh = 0.35, thFrom = 0, thTo = 0, phFrom = 0, phTo = 0, swing = 1, strike = 0, glint = 0, sparkIn = 0;
    const TIP = new Float32Array(3), TWO = new Float32Array(3);
    // The board's moods and the desk's: lamps gone wild and then dark, a failed call's red lamp, the mug in his hand or
    // jumping, the plugs jolting.
    let chaos = 0, dark = 0, failJack = -1, failT = 0, redLamp = -1, mugHeld = false, mugBlend = 1, mugHop = 0, jolt = 0;
    const mugAt = new Float32Array([KM.MUG.x, KM.DESK, KM.MUG.z]), mugFrom = new Float32Array(3);
    // The mug's handle stands out from its middle this far, at this height.
    const HANDLE_X = 0.11, HANDLE_Y = 0.078;

    // Where a target is, in the wall's frame, into `out` at `o`. A fist goes round a plug's sleeve: over the plug in its
    // hole, over one in a jack, or the same distance out in front of a jack to line a plug up.
    const set = (out, o, x, y, z) => { out[o] = x; out[o + 1] = y; out[o + 2] = z; };
    const body = (out, o, x, y, z) => { toWall(x, y, z); out[o] = OUT[0]; out[o + 1] = OUT[1]; out[o + 2] = OUT[2]; };
    // A point on the katana as it hangs, `along` its grip from the guard, in his body's frame.
    const onKatana = (out, o, alongY) => {
      Q.rotateVec(V3, P.katana.quaternion, 0, alongY, 0);
      body(out, o, P.katana.position.x + V3[0], P.katana.position.y + V3[1], P.katana.position.z + V3[2]);
    };
    const pointOf = (target, arm, cord, j, out, o) => {
      const side = arm === 0 ? -1 : 1;
      switch (target) {
        case T_JACK: case T_JACK_IN: set(out, o, jackX(j), jackY(j), IN_JACK + KM.GRIP + (target === T_JACK ? APPROACH : 0)); return;
        case T_HOME: set(out, o, KM.cordX(cord), B.shelf + 0.03 + KM.GRIP, B.plugZ); return;
        case T_KEY: set(out, o, KM.cordX(cord), B.shelf + 0.12, B.keyZ); return;
        case T_POINT: case T_VIEW: set(out, o, viewer[0], viewer[1], viewer[2]); return;
        case T_CONSOLE: set(out, o, consoleAt[0], consoleAt[1], consoleAt[2]); return;
        case T_HALL: set(out, o, hallAt[0], hallAt[1], hallAt[2]); return;
        case T_TAP: set(out, o, jackX(j), jackY(j) + B.lamp, 0.09); return;
        case T_YANK: set(out, o, jackX(j), jackY(j) - 0.05, IN_JACK + KM.GRIP + 0.4); return;
        case T_ACCUSE: set(out, o, KM.jackX(j) * 0.5, 2.35, 0); return;
        case T_DESK: set(out, o, 1.05, KM.DESK + 0.07, 0.55); return;
        case T_LAP: set(out, o, 0, B.shelf, 0.45); return;
        case T_MUG: set(out, o, KM.MUG.x + HANDLE_X, KM.DESK + HANDLE_Y, KM.MUG.z); return;
        case T_MUGSPOT: set(out, o, KM.MUG.x, KM.DESK, KM.MUG.z); return;
        case T_SWORD: { const p = j * POSE; set(out, o, POSES[p], POSES[p + 1], POSES[p + 2]); return; }
        case T_TWO: set(out, o, TWO[0], TWO[1], TWO[2]); return;
        case T_HILT: onKatana(out, o, K.hold); return;
        case T_SCAB: onKatana(out, o, K.scab); return;
        case T_UP: body(out, o, side * 0.45, 2.1 - seatY, 0.08); return;
        case T_FACE: body(out, o, side * 0.02, 0.84, 0.38); return;
        case T_CHIN: body(out, o, side * 0.03, 0.6, 0.37); return;
        case T_MOUTH: body(out, o, side * 0.15, 0.66, 0.33); return;
        case T_CLAP: body(out, o, side * 0.11, 0.42, 0.36); return;
        case T_SPREAD: body(out, o, side * 0.3, 0.46, 0.32); return;
        case T_CROSS: body(out, o, -side * 0.13, 0.3 + arm * 0.06, 0.24 - arm * 0.03); return;
        case T_RAISE: body(out, o, side * 0.3, 0.95, 0.3); return;
        case T_LIFT: body(out, o, side * 0.3, 0.62, 0.42); return;
        default: body(out, o, side * 0.3, B.shelf + 0.07 - seatY, 0.5);
      }
    };
    pointOf(T_REST, 0, -1, -1, hand, 0);
    pointOf(T_REST, 1, -1, -1, hand, 3);

    // A plan is a list of steps from a fixed pool, run one after another. A move's hand takes `travel` to get there,
    // which may outlast its step, so both hands can move at once.
    const steps = [];
    for (let i = 0; i < 96; i++) steps.push({ kind: WAIT, dur: 0, arm: 0, target: 0, cord: -1, jack: -1, v: 0, travel: 0 });
    let count = 0, at = 0, stepT = 0;
    const push = (what, dur, arm = 0, target = 0, cord = -1, j = -1, v = 0) => {
      const s = steps[count++];
      s.kind = what; s.dur = dur; s.arm = arm; s.target = target; s.cord = cord; s.jack = j; s.v = v; s.travel = dur;
      return s;
    };
    const go = (arm, target, travel, wait = travel, cord = -1, j = -1, v = 0) => { push(MOVE, wait, arm, target, cord, j, v).travel = travel; };
    const say = (which) => {
      fx.say(k, LINES[which], 3.6);
      talk = Math.min(2.4, 0.4 + LINES[which].length * 0.05);
      quiet = QUIET[0] + rand() * (QUIET[1] - QUIET[0]);
    };
    // A plug changing hands, jacks or its hole settles there from where it is, over `dur`, rising `arc` on the way.
    const settle = (c, dur = SETTLE, arc = 0) => {
      for (let i = 0; i < 3; i++) plugFrom[c * 3 + i] = plugPos[c * 3 + i];
      plugBlend[c] = 0;
      plugSettle[c] = dur;
      plugArc[c] = arc;
    };
    // The way the sheathed blade points, as the angles the drawn one is posed by.
    const bladeFromScabbard = () => {
      Q.rotateVec(V3, P.katana.quaternion, 0, -1, 0);
      dirToWall(V3[0], V3[1], V3[2]);
      bladeTh = Math.atan2(OUT[1], OUT[0]);
      bladePh = Math.asin(clamp(-OUT[2], -1, 1));
    };
    // Every channel on the board cut at once: the plugs fly home, the keys drop, the lamps go wild and then dark,
    // sparks and smoke off the board, and no call comes in for a while.
    const forceClose = () => {
      for (let c = 0; c < n; c++) {
        if (cordJack[c] >= 0) { cordJack[c] = -1; settle(c, 0.55, 0.3); }
        keyTarget[c] = 0;
      }
      for (let j = 0; j < jacks; j++) { jack[j] = IDLE; jackCord[j] = -1; jackT[j] = 0; }
      chaos = 0.7; dark = 1.6; eventIn = 7;
      for (let i = 0; i < 5; i++) {
        const x = (rand() - 0.5) * 3.6, y = 1.1 + rand() * 1.6;
        sparksAt(x, y, 0.05, 6);
        fx.puff(ox + 0.1, oy + y, oz - x, 0.2 + rand() * 0.3, 0.2, (rand() - 0.5) * 0.3, 1.4);
      }
    };
    const begin = (s) => {
      switch (s.kind) {
        case MOVE:
          for (let a = 0; a < 2; a++) if (s.arm === a || s.arm === 2) {
            for (let i = 0; i < 3; i++) from[a * 3 + i] = hand[a * 3 + i];
            kind[a] = s.target; kindCord[a] = s.cord; kindJack[a] = s.jack;
            moveT[a] = 0;
            moveDur[a] = s.travel;
            moveE[a] = s.travel > 0 ? 0 : 1;
            if (a === 0 && s.target === T_SWORD) {
              const p = s.jack * POSE;
              thFrom = bladeTh; thTo = thFrom + wrapAngle(POSES[p + 3] - thFrom);
              if (thTo !== thFrom) swing = thTo > thFrom ? 1 : -1;
              phFrom = bladePh; phTo = POSES[p + 4];
              strike = s.v;
              yawTarget = Math.PI + POSES[p + 5];
            }
          }
          break;
        case LOOK: lookKind = s.target; lookJack = s.jack; break;
        case LEAN: leanTarget = s.v; break;
        case ROLL: rollTarget = s.v; break;
        case STAND: riseTarget = s.v; break;
        case TILT: tiltTarget = s.v; break;
        case SCAB: scabTarget = s.v; break;
        case SWIVEL: {
          const t = s.v === 1 ? viewer : s.v === 2 ? consoleAt : hallAt;
          yawTarget = s.v ? Math.atan2(t[0], t[2] - seatZ) : Math.PI;
          break;
        }
        case GRAB: {
          const j = cordJack[s.cord];
          if (j >= 0) { jack[j] = IDLE; jackCord[j] = -1; jackT[j] = 0; }
          cordJack[s.cord] = -1;
          cordHeld[s.cord] = s.arm;
          settle(s.cord);
          break;
        }
        case PLUG:
          cordHeld[s.cord] = -1;
          cordJack[s.cord] = s.jack;
          jack[s.jack] = CONNECTED; jackCord[s.jack] = s.cord; jackT[s.jack] = 0;
          settle(s.cord);
          break;
        case DROP: cordHeld[s.cord] = -1; cordJack[s.cord] = -1; settle(s.cord); break;
        case KEY: keyTarget[s.cord] = s.v; break;
        case SAY: say(s.v); break;
        case SHAKE: shake = 0; shakeDur = s.dur; break;
        case WAG: wagT[s.arm] = s.dur; break;
        case THUD: {
          mugHop = 0.36; jolt = 0.3; chaos = Math.max(chaos, 0.2);
          const o = s.arm * 3;
          fx.puff(ox + fist[o + 2], oy + KM.DESK + 0.02, oz - fist[o], 0.3, 0.25, 0, 0.9);
          fx.puff(ox + fist[o + 2], oy + KM.DESK + 0.02, oz - fist[o], -0.1, 0.2, 0.3, 0.9);
          break;
        }
        case FAIL:
          failJack = s.jack; failT = 2.2;
          if (jack[s.jack] === IDLE) { jack[s.jack] = CALLING; jackT[s.jack] = 0; }
          break;
        case SWORD:
          if (s.v && !swordOn) bladeFromScabbard();
          swordOn = !!s.v;
          break;
        case FORCE: forceClose(); break;
        case MUG:
          for (let i = 0; i < 3; i++) mugFrom[i] = mugAt[i];
          mugHeld = !!s.v; mugBlend = 0;
          break;
      }
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
    // An idle jack, on one half if asked, or none.
    const idleJack = (half = -1) => {
      for (let tries = 0; tries < 16; tries++) {
        const j = Math.floor(rand() * jacks);
        if (jack[j] === IDLE && (half < 0 || sideOf(j) === half)) return j;
      }
      return -1;
    };
    // A lamp worth looking at: a call, else a connection, else any.
    const litJack = () => {
      let j = oldest(CALLING);
      if (j < 0) j = oldest(CONNECTED);
      return j >= 0 ? j : Math.floor(rand() * jacks);
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
      go(o, T_KEY, 0.32, 0.32, c, j);
      push(KEY, 0.18, o, 0, c, j, v);
      go(o, T_REST, 0.32, 0.32, c, j);
    };
    // A plug carried to a jack, lined up in front of it, pushed home and let go of; `h` hurries it.
    const plugInto = (c, j, a, h = 1, rest = true) => {
      push(LOOK, 0, a, T_JACK, c, j);
      push(LEAN, 0, 0, 0, -1, -1, 0.3);
      go(a, T_JACK, 0.6 * h, 0.6 * h, c, j);
      go(a, T_JACK_IN, 0.22 * h, 0.22 * h, c, j);
      push(PLUG, 0.14 * h, a, 0, c, j);
      go(a, T_JACK, 0.2 * h, 0.2 * h, c, j);
      if (rest) go(a, T_REST, 0.4, 0.4, c, j);
    };
    // A plug taken out of its jack: the fist goes round it and pulls it straight back out.
    const pullFrom = (c, j, a, h = 1) => {
      push(LOOK, 0.3 * h, a, T_JACK, c, j);
      push(LEAN, 0, 0, 0, -1, -1, 0.3);
      go(a, T_JACK, 0.45 * h, 0.45 * h, c, j);
      go(a, T_JACK_IN, 0.18 * h, 0.18 * h, c, j);
      push(GRAB, 0.12 * h, a, 0, c, j);
      go(a, T_JACK, 0.22 * h, 0.22 * h, c, j);
    };
    // A plug lifted from its hole on the shelf.
    const takeHome = (c, j, a) => {
      push(LOOK, 0.3, a, T_JACK, c, j);
      push(LOOK, 0, a, T_HOME, c, j);
      push(LEAN, 0, 0, 0, -1, -1, 0.14);
      go(a, T_HOME, 0.45, 0.45, c, j);
      push(GRAB, 0.16, a, 0, c, j);
    };
    // His hands in the air and a shake of the head, at the board.
    const fuss = () => {
      go(2, T_UP, 0.4);
      push(SHAKE, 0.9);
      go(2, T_REST, 0.5);
      push(WAIT, 0.5);
    };
    // Round on his stool to whoever is near (1), the Routing Console (2) or the hall (3), and back to the board.
    const turnTo = (v) => {
      push(LOOK, 0, 0, v === 1 ? T_VIEW : v === 2 ? T_CONSOLE : T_HALL);
      push(LEAN, 0, 0, 0, -1, -1, 0.05);
      push(SWIVEL, 0.55, 0, 0, -1, -1, v);
    };
    const turnBack = () => {
      push(SWIVEL, 0.55, 0, 0, -1, -1, 0);
      push(LOOK, 0, 0, T_JACK, -1, Math.floor(rand() * jacks));
      push(LEAN, 0, 0, 0, -1, -1, 0.1);
      push(WAIT, 0.4);
    };

    // ---- the emotes, one for each of LINES before the afterwords ----
    const hate = () => {
      turnTo(1);
      go(2, T_UP, 0.35);
      push(SAY, 0, 0, 0, -1, -1, 0);
      push(SHAKE, 1.2);
      go(2, T_REST, 0.45);
      push(WAIT, 0.3);
      turnBack();
    };
    const unbelievable = () => {
      const j = litJack();
      push(LEAN, 0, 0, 0, -1, -1, 0.36);
      push(LOOK, 1.2, 0, T_JACK, -1, j);
      push(SAY, 0, 0, 0, -1, -1, 1);
      go(0, T_FACE, 0.3);
      push(LOOK, 0, 0, T_LAP);
      push(LEAN, 0, 0, 0, -1, -1, 0.22);
      push(WAIT, 1.3);
      push(SHAKE, 0.6);
      go(0, T_REST, 0.4);
      push(LEAN, 0, 0, 0, -1, -1, 0.1);
      push(WAIT, 0.3);
    };
    // Yanked out and shoved into another jack, hurrying, on the same half.
    const rebalance = () => {
      const was = oldest(CONNECTED), j = was >= 0 ? idleJack(sideOf(was)) : -1;
      if (j < 0) return openClose();
      const c = jackCord[was], a = sideOf(was);
      push(LOOK, 0.3, 0, T_JACK, -1, was);
      push(SAY, 0, 0, 0, -1, -1, 2);
      pullFrom(c, was, a, 0.6);
      go(a, T_YANK, 0.1, 0.16, c, was);
      plugInto(c, j, a, 0.6);
      push(SHAKE, 0.5);
      push(LEAN, 0, 0, 0, -1, -1, 0.1);
    };
    const slam = () => {
      push(LEAN, 0, 0, 0, -1, -1, 0.2);
      push(LOOK, 0.4, 0, T_JACK, -1, litJack());
      push(SAY, 0, 0, 0, -1, -1, 3);
      go(0, T_RAISE, 0.3);
      push(LOOK, 0, 0, T_LAP);
      go(0, T_DESK, 0.1);
      push(THUD, 0.5, 0);
      push(SHAKE, 0.5);
      go(0, T_REST, 0.4);
      push(LEAN, 0, 0, 0, -1, -1, 0.1);
      push(WAIT, 0.3);
    };
    // The same cord in, out and in again.
    const openClose = () => {
      const j = idleJack(), c = j >= 0 ? freeCord(j) : -1;
      if (c < 0) return hate();
      const a = sideOf(j);
      push(SAY, 0, 0, 0, -1, -1, 4);
      takeHome(c, j, a);
      plugInto(c, j, a, 0.75, false);
      for (let i = 0; i < 2; i++) { pullFrom(c, j, a, 0.55); plugInto(c, j, a, 0.55, i === 1); }
      keyFor(c, j, a, 0.55);
      push(LEAN, 0, 0, 0, -1, -1, 0.1);
    };
    // Pawing frantically over the board one side and the other, then a look under his mug.
    const liquidity = () => {
      push(SAY, 0, 0, 0, -1, -1, 5);
      push(LEAN, 0, 0, 0, -1, -1, 0.3);
      for (let side = 0; side < 2; side++) {
        push(ROLL, 0, 0, 0, -1, -1, side ? -0.15 : 0.15);
        for (let i = 0; i < 6; i++) {
          const a = i % 2, j = Math.floor(rand() * jacks);
          push(LOOK, 0, 0, T_JACK, -1, j);
          go(a, T_JACK, 0.16, 0.17, -1, j);
        }
      }
      push(ROLL, 0, 0, 0, -1, -1, 0);
      push(LEAN, 0, 0, 0, -1, -1, 0.12);
      go(0, T_REST, 0.3, 0);
      push(LOOK, 0, 1, T_MUG);
      go(1, T_MUG, 0.4);
      push(MUG, 0, 1, 0, -1, -1, 1);
      go(1, T_LIFT, 0.3, 0.35);
      push(LOOK, 0.8, 0, T_MUGSPOT);
      push(SHAKE, 0.5);
      go(1, T_MUG, 0.3);
      push(MUG, 0, 1, 0, -1, -1, 0);
      go(1, T_REST, 0.35);
      push(WAIT, 0.3);
    };
    // A red lamp, and a slow clap for it.
    const clap = () => {
      let j = oldest(CONNECTED);
      if (j < 0) j = Math.floor(rand() * jacks);
      push(FAIL, 0, 0, 0, -1, j);
      push(LEAN, 0, 0, 0, -1, -1, 0.3);
      push(LOOK, 1.2, 0, T_JACK, -1, j);
      turnTo(1);
      push(SAY, 0, 0, 0, -1, -1, 6);
      for (let i = 0; i < 4; i++) { go(2, T_SPREAD, 0.32); go(2, T_CLAP, 0.16, 0.3); }
      go(2, T_REST, 0.4);
      turnBack();
    };
    const future = () => {
      const c = Math.floor(rand() * B.cols);
      push(LEAN, 0, 0, 0, -1, -1, 0.2);
      push(LOOK, 0, 0, T_ACCUSE, -1, c);
      go(0, T_ACCUSE, 0.3, 0.3, -1, c);
      push(SAY, 0, 0, 0, -1, -1, 7);
      push(WAG, 1.4, 0);
      go(0, T_REST, 0.4);
      push(LEAN, 0, 0, 0, -1, -1, 0.1);
      push(WAIT, 0.3);
    };
    const tess = () => {
      turnTo(3);
      push(LEAN, 0, 0, 0, -1, -1, -0.12);
      go(2, T_MOUTH, 0.3);
      push(SAY, 0, 0, 0, -1, -1, 8);
      push(WAIT, 1.6);
      go(2, T_REST, 0.4);
      push(WAIT, 0.4);
      turnBack();
    };
    const suspicious = () => {
      let j = oldest(CONNECTED);
      if (j < 0) j = litJack();
      push(LEAN, 0, 0, 0, -1, -1, -0.22);
      push(LOOK, 0, 0, T_JACK, -1, j);
      go(1, T_CHIN, 0.4);
      push(TILT, 0, 0, 0, -1, -1, 0.22);
      push(SAY, 0, 0, 0, -1, -1, 9);
      push(WAIT, 1.4);
      push(LEAN, 0, 0, 0, -1, -1, 0.36);
      push(WAIT, 1.1);
      push(TILT, 0, 0, 0, -1, -1, 0);
      push(LEAN, 0, 0, 0, -1, -1, 0.1);
      go(1, T_REST, 0.4);
      push(WAIT, 0.3);
    };
    const showOff = () => {
      turnTo(2);
      go(0, T_CROSS, 0.35, 0);
      go(1, T_CROSS, 0.35, 0.4);
      push(SAY, 0, 0, 0, -1, -1, 10);
      push(WAIT, 1.6);
      push(SHAKE, 0.5);
      go(2, T_REST, 0.4);
      turnBack();
    };
    const htlc = () => {
      let j = oldest(CALLING);
      if (j < 0) j = litJack();
      const a = sideOf(j);
      push(LEAN, 0, 0, 0, -1, -1, 0.3);
      push(LOOK, 0, 0, T_JACK, -1, j);
      push(SAY, 0, 0, 0, -1, -1, 11);
      go(a, T_JACK, 0.35, 0.35, -1, j);
      for (let i = 0; i < 3; i++) { go(a, T_TAP, 0.08, 0.1, -1, j); go(a, T_JACK, 0.1, 0.14, -1, j); }
      push(WAIT, 0.4);
      go(a, T_REST, 0.4);
      push(LEAN, 0, 0, 0, -1, -1, 0.1);
    };
    // ENOUGH: up on his stool, the scabbard turned and the sword drawn into both hands, three cuts across the board
    // and every channel down, the flick, the sword home, and down to rewire.
    const katana = () => {
      push(LOOK, 0, 0, T_JACK, -1, Math.floor(jacks / 2));
      push(SAY, 0, 0, 0, -1, -1, KATANA);
      push(LEAN, 0, 0, 0, -1, -1, 0.08);
      push(STAND, 0.5, 0, 0, -1, -1, 1);
      go(1, T_SCAB, 0.3, 0);
      push(SCAB, 0.3, 0, 0, -1, -1, 1);
      go(0, T_HILT, 0.28);
      push(SWORD, 0, 0, 0, -1, -1, 1);
      go(0, T_SWORD, 0.3, 0.3, -1, GUARD);
      push(SCAB, 0, 0, 0, -1, -1, 0);
      go(1, T_TWO, 0.25, 0.45);
      for (let cut = 0; cut < 3; cut++) {
        go(0, T_SWORD, 0.32, 0.34, -1, 1 + cut * 2);
        go(0, T_SWORD, 0.15, 0.22, -1, 2 + cut * 2, 1);
      }
      push(FORCE, 0);
      go(0, T_SWORD, 0.4, 0.7, -1, GUARD);
      go(0, T_SWORD, 0.18, 0.35, -1, FLICK);
      push(SAY, 0, 0, 0, -1, -1, FORCED);
      go(1, T_SCAB, 0.25, 0);
      push(SCAB, 0.25, 0, 0, -1, -1, 1);
      push(SWORD, 0, 0, 0, -1, -1, 0);
      go(0, T_HILT, 0.4, 0.45);
      push(SCAB, 0, 0, 0, -1, -1, 0);
      go(0, T_REST, 0.35, 0);
      go(1, T_REST, 0.35);
      push(STAND, 0.55, 0, 0, -1, -1, 0);
      push(WAIT, 0.8);
      push(SAY, 0, 0, 0, -1, -1, REWIRE);
      push(SHAKE, 1.0);
      push(LEAN, 0, 0, 0, -1, -1, 0.1);
      push(WAIT, 0.5);
    };
    const ACTS = [hate, unbelievable, rebalance, slam, openClose, liquidity, clap, future, tess, suspicious, showOff, htlc, katana];
    // The next emote: the katana now and then once he has worked up to it, otherwise the next from a shuffled bag.
    const bag = new Int8Array(KATANA);
    let bagAt = KATANA, sinceKatana = 0;
    const nextEmote = () => {
      if (sinceKatana >= 3 && rand() < 0.3) { sinceKatana = 0; return KATANA; }
      if (bagAt >= KATANA) {
        for (let i = 0; i < KATANA; i++) bag[i] = i;
        for (let i = KATANA - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)), t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
        bagAt = 0;
      }
      sinceKatana++;
      return bag[bagAt++];
    };
    // Whoever is near and a quiet over: an emote; otherwise mostly just a moment.
    const afterwards = (chance) => {
      if (near && quiet <= 0 && rand() < chance) ACTS[nextEmote()]();
      else if (rand() < 0.15) fuss();
      else push(WAIT, 0.4 + rand() * 1.2);
    };
    const connect = (j, c) => {
      const a = sideOf(j);
      takeHome(c, j, a);
      plugInto(c, j, a);
      keyFor(c, j, a, 0.55);
      push(LEAN, 0, 0, 0, -1, -1, 0.1);
      afterwards(0.35);
    };
    // A plugged cord pulled from one jack and pushed into another on the same half: rebalancing, by hand.
    const repatch = (was, j) => {
      const c = jackCord[was], a = sideOf(j);
      pullFrom(c, was, a);
      plugInto(c, j, a);
      push(LEAN, 0, 0, 0, -1, -1, 0.1);
      afterwards(0.5);
    };
    const disconnect = (j) => {
      const c = jackCord[j], a = sideOf(j);
      pullFrom(c, j, a);
      push(LEAN, 0, 0, 0, -1, -1, 0.14);
      push(LOOK, 0, a, T_HOME, c, j);
      go(a, T_HOME, 0.55, 0.55, c, j);
      push(DROP, 0.14, a, 0, c, j);
      go(a, T_REST, 0.35, 0.35, c, j);
      keyFor(c, j, a, 0);
      push(LEAN, 0, 0, 0, -1, -1, 0.1);
      push(WAIT, 0.3 + rand());
    };
    // A lamp flickering out is pulled first. A call is answered with a free cord, or now and then (and always when
    // none is free) by moving one already plugged on the same half. Otherwise a moment to himself: an emote for
    // whoever is near, scowling at the board up close, a glance at them, or his hands in the air.
    const plan = () => {
      count = at = 0;
      stepT = 0;
      let j = oldest(CLEARING);
      if (forced >= 0) { ACTS[forced](); forced = -1; }
      else if (j >= 0) disconnect(j);
      else if ((j = oldest(CALLING)) >= 0) {
        const c = freeCord(j), was = oldest(CONNECTED, sideOf(j));
        if (was >= 0 && (c < 0 || rand() < 0.3)) repatch(was, j);
        else if (c >= 0) connect(j, c);
        else push(WAIT, 0.5);
      } else {
        const r = rand();
        if (near && quiet <= 0 && r < 0.55) ACTS[nextEmote()]();
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
      let fx_ = nx * d - ux * L1, fy = ny * d - uy * L1, fz = nz * d - uz * L1;
      const fl = Math.hypot(fx_, fy, fz) || 1;
      fx_ /= fl; fy /= fl; fz /= fl;
      dirToWall(fx_, fy, fz);
      fore[o] = OUT[0]; fore[o + 1] = OUT[1]; fore[o + 2] = OUT[2];
      const c1 = Math.cos(x1), s1 = Math.sin(x1), c2 = Math.cos(z1), s2 = Math.sin(z1);
      const ay = fy * c1 + fz * s1, az = -fy * s1 + fz * c1, lx = fx_ * c2 + ay * s2, ly = -fx_ * s2 + ay * c2;
      lower.rotation.x = Math.atan2(-az, -ly); lower.rotation.y = 0; lower.rotation.z = Math.asin(clamp(lx, -1, 1));
    };
    // A few sparks off the board at a point in the wall's frame, flying out into the hall and falling to the deck.
    const SPARKS = KM.sparks(), TRAIL = KM.trail();
    const sparksAt = (x, y, z, count) => {
      for (let i = 0; i < count; i++) {
        const vx = (Math.random() - 0.5) * 2.4, vy = 0.6 + Math.random() * 1.8, vz = 0.8 + Math.random() * 1.6;
        fx.spawnParticle(SPARKS[i % SPARKS.length], ox + z, oy + y, oz - x, vz, vy, -vx, 0.35 + Math.random() * 0.35, 9, 7, oy + 0.03);
      }
    };
    // The sword: on his hip it rides the scabbard; in his hands it lies along the cut his right hand is making, its
    // edge leading the way it swings round so its flat shows to the hall, the point kept off the board's face. It eases
    // between the two as he draws and sheathes.
    const blade = (dt) => {
      swordBlend = clamp(swordBlend + (swordOn ? dt / DRAW : -dt / SHEATHE), 0, 1);
      const sw = P.sword, kp = P.katana.position;
      if (swordBlend <= 0) {
        sw.position.x = kp.x; sw.position.y = kp.y; sw.position.z = kp.z;
        sw.quaternion.set(P.katana.quaternion);
        return;
      }
      if (kind[0] === T_SWORD) {
        const e = moveE[0];
        bladeTh = thFrom + (thTo - thFrom) * e;
        bladePh = phFrom + (phTo - phFrom) * e + (strike ? 0.65 * Math.sin(Math.PI * e) : 0);
      }
      const most = (fist[2] - 0.012) / K.tip;
      if (Math.sin(bladePh) > most) bladePh = Math.asin(clamp(most, -1, 1));
      const cp = Math.cos(bladePh), dx = cp * Math.cos(bladeTh), dy = cp * Math.sin(bladeTh), dz = -Math.sin(bladePh);
      for (let i = 0; i < 3; i++) TIP[i] = fist[i] + (i === 0 ? dx : i === 1 ? dy : dz) * K.tip;
      const span = K.hold2 - K.hold;
      TWO[0] = fist[0] - dx * span; TWO[1] = fist[1] - dy * span; TWO[2] = fist[2] - dz * span;
      // Its grip up (+y) against the blade, its edge (+x) along the swing round the board's face, square to the blade.
      const ux = -dx, uy = -dy, uz = -dz;
      toBody(ux, uy, uz);
      const bx = DIR[0], by = DIR[1], bz = DIR[2];
      toBody(-swing * Math.sin(bladeTh), swing * Math.cos(bladeTh), 0);
      const cx = DIR[0], cy_ = DIR[1], cz = DIR[2];
      fromBasis(qHand, cx, cy_, cz, bx, by, bz, cy_ * bz - cz * by, cz * bx - cx * bz, cx * by - cy_ * bx);
      toBody(fist[0], fist[1] - k.root.position.y, fist[2] - seatZ);
      const e = smooth(swordBlend);
      sw.position.x = kp.x + (DIR[0] - bx * K.hold - kp.x) * e;
      sw.position.y = kp.y + (DIR[1] - by * K.hold - kp.y) * e;
      sw.position.z = kp.z + (DIR[2] - bz * K.hold - kp.z) * e;
      sw.quaternion.set(P.katana.quaternion);
      Q.slerpTo(sw.quaternion, qHand, e);
      if (swordOn && swordBlend >= 1 && glint < 0) glint = 1;
      // A cut leaves its light along the blade's outer half, and throws sparks wherever its point scrapes the board.
      if (strike && kind[0] === T_SWORD && moveDur[0] > 0) {
        for (let i = 0; i < 6; i++) {
          const f = (0.45 + 0.11 * i) * K.tip, x = fist[0] + dx * f, y = fist[1] + dy * f, z = fist[2] + dz * f;
          fx.spawnParticle(TRAIL, ox + z, oy + y, oz - x, 0, 0, 0, 0.3, 0, 0, oy);
        }
        if (TIP[2] < 0.07) {
          sparkIn -= dt;
          if (sparkIn <= 0) { sparkIn = 0.022; sparksAt(TIP[0], TIP[1], Math.max(0.03, TIP[2]), 2); }
        }
      }
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
      // The view in the wall's frame, and whether it is near enough for him to act up for it.
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

      // His body: the swivel (quick with the sword out), the lean, roll and standing and a breath first, so his hands'
      // body-held targets ride them. Standing, his legs straighten under him onto the stool.
      let turn = (yawTarget - yaw) % TAU;
      if (turn > Math.PI) turn -= TAU; else if (turn < -Math.PI) turn += TAU;
      yaw += turn * Math.min(1, dt * (swordOn ? 14 : 7));
      lean += (leanTarget - lean) * Math.min(1, dt * 6);
      roll += (rollTarget - roll) * Math.min(1, dt * 6);
      rise += (riseTarget - rise) * Math.min(1, dt * 6);
      k.root.rotation.y = yaw;
      k.root.rotation.x = lean;
      k.root.rotation.z = roll;
      k.root.position.y = seatY + rise * RISE + 0.008 * Math.sin(time * 1.8);
      P.legR.rotation.x = P.legL.rotation.x = (-1.45 - lean) * (1 - rise) - lean * rise;
      P.shinR.rotation.x = P.shinL.rotation.x = 1.45 * (1 - rise);
      trig();
      // The scabbard turned ready to draw, or hanging at rest.
      scab += (scabTarget - scab) * Math.min(1, dt * 9);
      P.katana.position.x = K.x + (K.readyX - K.x) * scab;
      P.katana.quaternion.set(qRest);
      Q.slerpTo(P.katana.quaternion, qReady, scab);
      for (let a = 0; a < 2; a++) {
        const o = a * 3;
        pointOf(kind[a], a, kindCord[a], kindJack[a], hand, o);
        if (moveDur[a] > 0) {
          moveT[a] = Math.min(moveT[a] + dt, moveDur[a]);
          const e = smooth(moveT[a] / moveDur[a]);
          moveE[a] = e;
          for (let i = 0; i < 3; i++) hand[o + i] = from[o + i] + (hand[o + i] - from[o + i]) * e;
          if (moveT[a] >= moveDur[a]) moveDur[a] = 0;
        }
        if (wagT[a] > 0) { wagT[a] -= dt; hand[o + 1] += 0.05 * Math.sin(time * 17); hand[o] += 0.025 * Math.sin(time * 8.5); }
        reachFor(a);
        if (a === 0) blade(dt);
      }
      if (glint > 0) glint -= dt * 2.5;
      else if (!swordOn) glint = -1;
      P.sword.glow = 1 + 3 * Math.max(0, glint) + (strike && kind[0] === T_SWORD && moveDur[0] > 0 ? 1.6 : 0);
      // The head turned to what he looks at, tilted, a shake now and then, a blink, and his mouth working as he talks.
      pointOf(lookKind, 0, -1, lookJack, look, 0);
      toWall(0, headY, headZ);
      toBody(look[0] - OUT[0], look[1] - OUT[1], look[2] - OUT[2]);
      headYaw += (clamp(Math.atan2(DIR[0], DIR[2]), -0.9, 0.9) - headYaw) * Math.min(1, dt * 8);
      headPitch += (clamp(-Math.atan2(DIR[1], Math.hypot(DIR[0], DIR[2])), -0.5, 0.45) - headPitch) * Math.min(1, dt * 8);
      headTilt += (tiltTarget - headTilt) * Math.min(1, dt * 6);
      if (shakeDur > 0) { shake += dt; if (shake >= shakeDur) shakeDur = 0; }
      P.head.rotation.y = headYaw + (shakeDur > 0 ? Math.sin(shake * 18) * 0.35 * (1 - shake / shakeDur) : 0);
      P.head.rotation.x = headPitch;
      P.head.rotation.z = headTilt;
      blinkIn -= dt;
      if (blinkIn <= 0) { blink = 0.12; blinkIn = 2.5 + rand() * 3; }
      if (blink > 0) blink -= dt;
      if (talk > 0) talk -= dt;
      const face = blink > 0 ? k.headClosed : talk > 0 && Math.sin(time * 26) > 0 ? k.headTalk : k.headOpen;
      if (P.head.geometry !== face) P.head.geometry = face;

      // His mug: in his hand by the handle, set back down, or jumping when the desk is thumped.
      mugBlend = Math.min(1, mugBlend + dt / SETTLE);
      const mb = smooth(mugBlend);
      let mx = KM.MUG.x, my = KM.DESK, mz = KM.MUG.z;
      if (mugHeld) { mx = fist[3] - HANDLE_X; my = fist[4] - HANDLE_Y; mz = fist[5]; }
      mugAt[0] = mugFrom[0] + (mx - mugFrom[0]) * mb; mugAt[1] = mugFrom[1] + (my - mugFrom[1]) * mb; mugAt[2] = mugFrom[2] + (mz - mugFrom[2]) * mb;
      let hop = 0;
      if (mugHop > 0) { mugHop = Math.max(0, mugHop - dt); hop = Math.sin(Math.PI * (1 - mugHop / 0.36)); }
      mug.position.x = mugAt[0]; mug.position.y = mugAt[1] + 0.05 * hop; mug.position.z = mugAt[2];
      mug.rotation.z = 0.2 * hop * Math.sin(time * 30);
      const joltY = jolt > 0 ? 0.025 * Math.sin(Math.PI * (1 - jolt / 0.3)) : 0;
      if (jolt > 0) jolt = Math.max(0, jolt - dt);

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
        else { tx = KM.cordX(c); ty = B.shelf + 0.03 + joltY; tz = B.plugZ; }
        plugBlend[c] = Math.min(1, plugBlend[c] + dt / plugSettle[c]);
        const b = smooth(plugBlend[c]), arc = plugArc[c] * Math.sin(Math.PI * plugBlend[c]);
        plugPos[o] = plugFrom[o] + (tx - plugFrom[o]) * b;
        plugPos[o + 1] = plugFrom[o + 1] + (ty - plugFrom[o + 1]) * b + arc;
        plugPos[o + 2] = plugFrom[o + 2] + (tz - plugFrom[o + 2]) * b;
        p.position.x = plugPos[o]; p.position.y = plugPos[o + 1]; p.position.z = plugPos[o + 2];
        p.rotation.x = Math.acos(clamp(dy, -1, 1));
        p.rotation.y = Math.atan2(dx, dz);
        if (held >= 0 || j >= 0 || plugBlend[c] < 1) drawCord(c, plugPos[o] + dx * KM.PLUG, plugPos[o + 1] + dy * KM.PLUG, plugPos[o + 2] + dz * KM.PLUG);
        else for (let s = 0; s < SEGMENTS; s++) segs[c * SEGMENTS + s].visible = false;
        keyThrow[c] += (keyTarget[c] - keyThrow[c]) * Math.min(1, dt * 14);
        keys[c].rotation.x = keyThrow[c];
        keys[c].position.y = B.shelf + 0.04 + joltY;
      }
      // The lamps: a call flashes, a connection burns steady, a clearing one flickers, a failed one flashes red, and the
      // rest of the board blinks slowly on its own; cut, the whole board goes wild, then dark.
      if (failT > 0) {
        failT -= dt;
        if (failT <= 0 && jack[failJack] === CONNECTED) { jack[failJack] = CLEARING; jackT[failJack] = 0; }
      }
      const red = failT > 0 ? KM.ACTIVE[failJack] : -1;
      if (red !== redLamp) {
        if (redLamp >= 0) lamps[redLamp].geometry = S.lamp;
        if (red >= 0) lamps[red].geometry = S.lampRed;
        redLamp = red;
      }
      if (chaos > 0) chaos -= dt;
      else if (dark > 0) dark -= dt;
      for (let i = 0; i < lamps.length; i++) {
        const a = activeOf[i];
        let g;
        if (chaos > 0) g = Math.random() < 0.45 ? 1.7 : 0.08;
        else if (dark > 0) g = 0.04;
        else if (i === redLamp) g = Math.sin(time * 16) > 0 ? 1.7 : 0.25;
        else if (a >= 0) {
          const st = jack[a];
          g = st === CALLING ? (Math.sin(time * 11) > 0 ? 1.5 : 0.18) : st === CONNECTED ? 1 : st === CLEARING ? (Math.sin(time * 23 + a) > 0.3 ? 0.9 : 0.15) : 0.12;
        } else {
          const f = time * rate[i] + phase[i];
          g = f - Math.floor(f) < 0.22 ? 0.95 : 0.12;
        }
        if (lamps[i].glow !== g) lamps[i].glow = g;
      }
    };
    const liveGeometry = (set) => { set.add(k.headOpen).add(k.headClosed).add(k.headTalk).add(S.lamp).add(S.lampRed); };
    const dispose = () => { count = at = 0; };
    // For debugging: the named emote next, whoever is near, at once unless his hands are full or he is up on his stool.
    const emote = (name) => {
      forced = EMOTES.indexOf(name);
      quiet = 0;
      let busy = mugHeld || swordBlend > 0 || riseTarget > 0;
      for (let c = 0; c < n; c++) if (cordHeld[c] >= 0) busy = true;
      if (!busy) {
        count = at = 0;
        leanTarget = 0.1; rollTarget = tiltTarget = scabTarget = 0; yawTarget = Math.PI; wagT[0] = wagT[1] = 0;
      }
      return forced;
    };
    return { node, kortik: k, update, liveGeometry, dispose, emote, get jacks() { return jack; }, get cords() { return cordJack; }, get held() { return cordHeld; }, get near() { return near; } };
  };
  BL.kortik = { create, LINES, EMOTES };
})();
