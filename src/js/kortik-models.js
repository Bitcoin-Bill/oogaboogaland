// Kortik's Switchboard: the manual patchboard on its deck beside the Routing Console, and Kortik, the samurai who works
// it. Geometry only; kortik.js runs him. Everything is in the wall's frame: the panel's face at z 0 looking +z into the
// hall, x along the wall, y up from the deck.
(() => {
  "use strict";
  const BL = window.BL, M = BL.models, FM = BL.factoryModels;
  const { box, bevelBox, merge, cached, makeVox, voxelGeometry, lathe, turn, shaded, tube, torus, forwardLathe, moved, turnedX, turnedY, turnedZ } = M;
  const { createNode, addChild } = BL.scene;

  // ---- Kortik ------------------------------------------------------------------------------------------------------

  // A fictional samurai for now, in his own rig rather than the roster's caveman: the character sheet's voxels are under
  // five centimetres, about twice the caveman's detail, and his head is big on a stocky body. `NAME` is a name no
  // login can have, so nothing ever counts him as a contributor.
  const NAME = "kortik/factory";
  const U = 0.046;
  const C = {
    skin: 0, skinDk: 1, skinLt: 2, hair: 3, hairDk: 4, hairLt: 5, robe: 6, robeDk: 7, robeLt: 8, sash: 9, sashDk: 10,
    wrap: 11, sandal: 12, strap: 13, white: 14, black: 15, mouth: 16, collar: 17, shadow: 18, sole: 19
  };
  const PALETTE = ["#d4945a", "#b0703c", "#e6ad78", "#2a2124", "#1b1517", "#3d3134", "#3b3444", "#29232f", "#4b4456", "#d3c3a2", "#aa977a",
    "#1d1a1c", "#8a5a32", "#d3c3a2", "#f4f0e6", "#141212", "#5a2418", "#5c546a", "#17131b", "#5e3c22"];
  // A cell's own small variation, hashed from where it is, never drawn from a random stream.
  const hv = (x, y, z) => ((Math.imul(x + 31, 73856093) ^ Math.imul(y + 17, 19349663) ^ Math.imul(z + 7, 83492791)) >>> 0) % 9;
  const skin = (x, y, z) => (hv(x, y, z) === 0 ? C.skinDk : C.skin);
  const hair = (x, y, z) => { const r = hv(x, y, z); return r < 2 ? C.hairDk : r === 8 ? C.hairLt : C.hair; };
  // Kimono cloth: folds running down it and a little wear.
  const cloth = (x, y, z) => (x % 4 === 1 ? C.robeDk : hv(x, y, z) === 0 ? C.robeLt : C.robe);
  const pleat = (x, y, z) => (x % 2 ? C.robeDk : hv(x, y, z) === 0 ? C.robe : C.shadow);
  const vg = (v, ox, oy, oz) => voxelGeometry(v, { unit: U, palette: PALETTE, origin: { x: ox * U, y: oy * U, z: oz * U } });

  // The head, fourteen cells across, its base on the neck and its face toward +z: a messy black crop with a topknot,
  // heavy brows slanting to a scowl over narrowed eyes, a broad nose, a drooping moustache over a down-turned mouth, a
  // short beard along the jaw to a point, and ears showing under the hair. `closed` draws the blink.
  const headVox = (closed) => {
    const v = makeVox();
    v.fill(1, 12, 0, 10, 1, 11, skin);
    v.fill(3, 10, 0, 2, 12, 12, C.skin);
    for (const x of [0, 13]) { v.fill(x, x, 4, 6, 5, 7, C.skin); v.set(x, 5, 6, C.skinDk); }
    // Hair: two layers down the back, over the temples, the crown to the hairline, and spikes standing off the top.
    v.fill(0, 13, 3, 12, 0, 0, hair);
    v.fill(1, 12, 4, 12, -1, -1, hair);
    v.fill(0, 0, 7, 12, 0, 10, hair);
    v.fill(13, 13, 7, 12, 0, 10, hair);
    v.fill(0, 13, 11, 12, 0, 12, hair);
    for (let x = 0; x <= 13; x++) for (let z = -1; z <= 12; z++) {
      const r = hv(x, 13, z);
      if (r < 5) v.set(x, 13, z, hair(x, 13, z));
      if (r < 2 && x > 0 && x < 13) v.set(x, 14, z, hair(x, 14, z));
    }
    v.fill(0, 3, 9, 10, 12, 12, hair);
    v.fill(10, 13, 9, 10, 12, 12, hair);
    v.fill(0, 1, 2, 8, 8, 11, hair);
    v.fill(12, 13, 2, 8, 8, 11, hair);
    // The topknot: a bound stalk, its dark tie, and the knot itself, rounded at its corners.
    v.fill(5, 8, 13, 14, 4, 7, hair);
    v.fill(5, 8, 15, 15, 4, 7, C.hairDk);
    for (let y = 16; y <= 18; y++) for (let x = 4; x <= 9; x++) for (let z = 3; z <= 8; z++) if (!((x === 4 || x === 9) && (z === 3 || z === 8))) v.set(x, y, z, hair(x, y, z));
    v.fill(5, 8, 19, 19, 4, 7, hair);
    v.fill(6, 7, 20, 20, 5, 6, C.hairDk);
    // Brows, standing proud of the face and slanting down to a crease between them.
    v.fill(2, 4, 8, 8, 12, 12, C.hairDk);
    v.fill(3, 5, 7, 7, 12, 12, C.hairDk);
    v.fill(9, 11, 8, 8, 12, 12, C.hairDk);
    v.fill(8, 10, 7, 7, 12, 12, C.hairDk);
    v.fill(6, 7, 7, 8, 11, 11, C.skinDk);
    // Eyes, narrowed and glaring in; the lids and the shadow under them.
    for (const [x0, x1, pupil] of [[3, 5, 5], [8, 10, 8]]) {
      for (let x = x0; x <= x1; x++) {
        v.set(x, 6, 11, closed ? C.skin : x === pupil ? C.black : C.white);
        v.set(x, 5, 11, closed ? C.skinDk : x === pupil ? C.black : C.white);
        v.set(x, 4, 11, C.skinDk);
      }
    }
    // The nose, its tip and nostrils.
    v.fill(6, 7, 3, 6, 12, 12, C.skinLt);
    v.fill(6, 7, 3, 4, 13, 13, C.skin);
    v.set(6, 3, 13, C.skinDk);
    v.set(7, 3, 13, C.skinDk);
    // The moustache drooping past the mouth, and the beard from the jaw to a point.
    v.fill(3, 10, 2, 2, 12, 12, C.hair);
    for (const x of [3, 4, 9, 10]) v.set(x, 1, 12, C.hair);
    v.fill(5, 8, 1, 1, 12, 12, C.mouth);
    v.fill(2, 11, 0, 0, 9, 12, hair);
    v.fill(2, 11, -1, -1, 8, 12, hair);
    v.fill(3, 10, -2, -2, 8, 12, hair);
    v.fill(4, 9, -3, -3, 9, 12, hair);
    v.fill(5, 8, -4, -4, 10, 12, hair);
    v.fill(1, 1, 0, 3, 8, 11, hair);
    v.fill(12, 12, 0, 3, 8, 11, hair);
    return v;
  };
  // The body, sixteen cells across from the hip up: a dark kimono with folds, crossed at the chest over a V of skin
  // with its lapels standing proud, and the pale sash round the waist, knotted at the front with its tails hanging.
  const torsoVox = () => {
    const v = makeVox();
    v.fill(0, 15, 0, 11, 0, 9, cloth);
    v.fill(2, 13, 12, 12, 1, 8, cloth);
    for (const [x0, x1, y] of [[5, 10, 12], [6, 9, 11], [7, 8, 10]]) v.fill(x0, x1, y, y, 9, 9, C.skin);
    for (const [x, y] of [[3, 12], [4, 12], [4, 11], [5, 11], [5, 10], [6, 10], [6, 9], [7, 9], [7, 8], [8, 8],
      [12, 12], [11, 12], [11, 11], [10, 11], [10, 10], [9, 10], [9, 9], [8, 9], [8, 7], [9, 7]]) {
      v.set(x, y, 9, C.collar);
      v.set(x, y, 10, C.collar);
    }
    for (let i = 0; i < 4; i++) v.set(9 + Math.floor(i / 2), 3 - i, 9, C.robeDk);
    v.fill(0, 15, 4, 6, 0, 9, (x, y) => (y === 5 ? C.sashDk : C.sash));
    v.fill(2, 13, 4, 6, 10, 10, (x, y) => (y === 5 ? C.sashDk : C.sash));
    v.fill(6, 9, 4, 7, 11, 11, C.sash);
    v.fill(7, 8, 5, 6, 12, 12, C.sashDk);
    v.set(5, 6, 11, C.sash);
    v.set(10, 6, 11, C.sash);
    v.fill(6, 7, 0, 3, 11, 11, C.sash);
    v.fill(8, 9, 1, 3, 11, 11, C.sashDk);
    return v;
  };
  // An arm in two pieces jointed at the elbow. The upper arm is the wide kimono sleeve from the shoulder to below the
  // elbow, dark inside its mouth, with its pouch hanging at the back; the forearm comes out of it to a dark wrist wrap
  // and the fist.
  const upperVox = () => {
    const v = makeVox();
    v.fill(0, 6, 8, 17, 0, 6, cloth);
    v.fill(0, 6, 8, 8, 0, 6, C.robeDk);
    v.fill(2, 4, 8, 8, 2, 4, C.shadow);
    v.fill(0, 6, 5, 7, 0, 1, cloth);
    v.fill(0, 6, 5, 5, 0, 1, C.robeDk);
    return v;
  };
  const foreVox = () => {
    const v = makeVox();
    v.fill(2, 4, 5, 8, 2, 4, skin);
    v.fill(1, 5, 3, 4, 1, 5, C.wrap);
    v.fill(1, 5, 0, 2, 1, 5, skin);
    v.fill(1, 5, 2, 2, 5, 5, C.skinDk);
    v.set(5, 1, 4, C.skinLt);
    return v;
  };
  // The hakama, wide and pleated: a thigh from the hip to the knee, and a shin to the ankle over a straw sandal.
  const thighVox = () => {
    const v = makeVox();
    v.fill(0, 6, 0, 5, 0, 6, pleat);
    return v;
  };
  const shinVox = () => {
    const v = makeVox();
    v.fill(0, 6, 2, 6, 0, 6, pleat);
    v.fill(-1, 7, 2, 2, -1, 7, C.robeDk);
    v.fill(2, 4, 1, 1, 2, 4, C.wrap);
    v.fill(1, 5, 0, 0, 0, 8, C.sole);
    v.fill(1, 5, 1, 1, 7, 8, skin);
    v.fill(1, 5, 1, 1, 5, 5, C.strap);
    v.set(3, 1, 6, C.strap);
    return v;
  };
  // The katana at his left hip, made round: a black scabbard with a slight curve and gold fittings, a gold guard, and a
  // gold grip bound in dark diamonds with its cap. Built along +y, the grip's end up.
  const SCABBARD = "#1d1a1c", GOLD = "#e8b23a", GOLD_DK = "#a87a22", HILT_DK = "#24180e";
  const katana = cached(() => {
    const round = [
      tube({ path: (t) => ({ x: 0.035 * Math.sin(Math.PI * t), y: -0.66 + 0.64 * t, z: 0 }), radius: () => 0.024, rings: 10, segments: 10, colorFn: () => SCABBARD }),
      turn([[0, -0.68], [0.026, -0.67], [0.028, -0.62], [0, -0.62]], 12, GOLD),
      turn([[0.028, -0.04], [0.03, -0.02], [0.028, 0]], 12, GOLD_DK),
      turn([[0, 0.002], [0.062, 0.004], [0.062, 0.02], [0, 0.022]], 16, GOLD),
      tube({ path: (t) => ({ x: 0, y: 0.024 + 0.25 * t, z: 0 }), radius: () => 0.021, rings: 4, segments: 10, colorFn: () => GOLD }),
      turn([[0.023, 0.27], [0.024, 0.285], [0.016, 0.296], [0, 0.298]], 12, GOLD_DK)
    ];
    const flat = [];
    for (const y of [0.06, 0.11, 0.16, 0.21, 0.255]) for (const z of [-1, 1]) flat.push(moved(turnedZ(box({ w: 0.024, h: 0.024, d: 0.008, color: HILT_DK }), Math.PI / 4), 0, y, z * 0.02));
    return shaded(round, flat);
  });
  const geometries = cached(() => ({
    headOpen: vg(headVox(false), -7, 0, -6.5),
    headClosed: vg(headVox(true), -7, 0, -6.5),
    torso: vg(torsoVox(), -8, 0, -5),
    upper: vg(upperVox(), -3.5, -17.5, -3.5),
    fore: vg(foreVox(), -3.5, -8.5, -3.5),
    thigh: vg(thighVox(), -3.5, -5.5, -3.5),
    shin: vg(shinVox(), -3.5, -6.5, -3.5)
  }));
  // A fresh rig over the shared geometry: the root at his hip, the head on its neck, arms from the shoulders jointed at
  // the elbow, and legs jointed at the knee. `ARM` is the length from shoulder to elbow and from elbow to the middle of
  // the fist, for his arms' two-bone reach.
  const ARM = { upper: 9 * U, fore: 7 * U };
  const rig = () => {
    const G = geometries(), root = createNode();
    const torso = createNode({ geometry: G.torso });
    const head = createNode({ position: { x: 0, y: 12 * U, z: 0.3 * U }, geometry: G.headOpen });
    const arm = (side) => createNode({ position: { x: side * 10 * U, y: 11 * U, z: 0 }, rotation: { x: -0.2, y: 0, z: side * 0.08 }, geometry: G.upper });
    const fore = () => createNode({ position: { x: 0, y: -ARM.upper, z: 0 }, geometry: G.fore });
    const thigh = (side) => createNode({ position: { x: side * 4 * U, y: 0, z: 0 }, geometry: G.thigh });
    const shin = () => createNode({ position: { x: 0, y: -5 * U, z: 0 }, geometry: G.shin });
    const parts = { torso, head, armR: arm(-1), armL: arm(1), foreR: fore(), foreL: fore(), legR: thigh(-1), legL: thigh(1), shinR: shin(), shinL: shin() };
    // His left is +x, facing +z; the katana slung there, its grip forward and up.
    parts.katana = createNode({ position: { x: 8.6 * U, y: 5 * U, z: 0 }, rotation: { x: 1.15, y: 0.18, z: -0.12 }, geometry: katana() });
    addChild(parts.armR, parts.foreR);
    addChild(parts.armL, parts.foreL);
    addChild(parts.legR, parts.shinR);
    addChild(parts.legL, parts.shinL);
    addChild(root, torso, parts.legR, parts.legL, parts.armR, parts.armL, head, parts.katana);
    return { root, parts, headOpen: G.headOpen, headClosed: G.headClosed, ARM };
  };

  // ---- the switchboard ----------------------------------------------------------------------------------------

  const WOOD = "#7a4a26", WOOD_DK = "#4a2c16", WOOD_LT = "#9a6234", PANEL = "#24150d", BRASS = "#c9a24a", BRASS_DK = "#8f6c2a", HOLE = "#0c0908";
  const STRIP = "#e8dcc0", LAMP = "#ffb21c", RED = "#c8321e", RED_DK = "#8a1f12", BLACK = "#1e1a1a", PAPER = "#efdfb0", IRON = "#2a2a2a";
  // The board: jacks on a grid over the whole face, `cols` across `pitch` apart and `rows` up from `y0`, each with its
  // lamp just above. The middle `active` columns of the lowest `activeRows` rows are the ones Kortik can reach from
  // his stool, and the ones he works; `active` shares the parity of `cols`, so they sit in the middle of the grid. The shelf in front carries the cords' plugs in a row and a key behind each; the desk under it
  // leaves a kneehole between its pedestals.
  const BOARD = {
    half: 2.8, top: 3.4, depth: 0.38, shelf: 0.745, shelfDepth: 0.5, knee: 0.66,
    cols: 21, rows: 10, pitch: 0.25, rowPitch: 0.22, y0: 0.98, lamp: 0.09,
    active: 7, activeRows: 3,
    cords: 10, cordPitch: 0.15, plugZ: 0.16, keyZ: 0.34, black: [2, 6, 8], patched: 18, cordR: 0.026,
    seat: { y: 0.62, z: FM.KORTIK.seat },
    sign: { y: 4.35, z: 0.08, height: 1.1 }, hooks: [[-2.6, 5.05, 0.28], [2.6, 5.05, 0.28]]
  };
  const jackX = (c) => (c - (BOARD.cols - 1) / 2) * BOARD.pitch, jackY = (r) => BOARD.y0 + r * BOARD.rowPitch;
  const cordX = (i) => (i - (BOARD.cords - 1) / 2) * BOARD.cordPitch;
  // The active jacks, lowest row first, as indices into the whole grid (row * cols + col).
  const ACTIVE = [];
  for (let r = 0; r < BOARD.activeRows; r++) for (let c = 0; c < BOARD.active; c++) ACTIVE.push(r * BOARD.cols + (BOARD.cols - BOARD.active) / 2 + c);
  // A plug, turned and standing on its tip at y 0: a brass tip and ring, a fat sleeve in the cord's colour with grip
  // rings, and a tapering boot where the cord leaves it at PLUG. A hand holds it round the sleeve, GRIP up from the tip.
  const PLUG = 0.17, GRIP = 0.06;
  const plugParts = (color, dark) => [
    turn([[0, -0.065], [0.011, -0.06], [0.011, -0.035], [0.015, -0.032], [0.011, -0.028], [0.011, -0.012], [0, -0.012]], 10, BRASS),
    turn([[0, -0.012], [0.02, -0.012], [0.022, 0], [0, 0]], 10, BRASS_DK),
    turn([[0, 0], [0.034, 0.004], [0.037, 0.02], [0.037, 0.1], [0.034, 0.112], [0, 0.112]], 12, color),
    moved(torus(0.037, 0.005, dark, 0, 12, 6), 0, 0.04, 0), moved(torus(0.037, 0.005, dark, 0, 12, 6), 0, 0.075, 0),
    turn([[0, 0.112], [0.028, 0.112], [0.02, 0.15], [0.016, PLUG], [0, PLUG]], 10, dark)
  ];
  const plug = (color, dark) => shaded(plugParts(color, dark));
  // A paper note pinned to the board in a hand-lettered face, its lines centred, with a red pin and an underline.
  const NOTE_FONT = '"Marker Felt", "Chalkboard SE", "Comic Sans MS", cursive';
  const note = (lines, size = 0.42) => {
    const S = 256, canvas = document.createElement("canvas"), g = canvas.getContext("2d");
    canvas.width = canvas.height = S;
    g.fillStyle = PAPER;
    g.fillRect(0, 0, S, S);
    g.fillStyle = "rgba(120, 90, 40, 0.18)";
    g.fillRect(0, S - 18, S, 18);
    g.fillStyle = "#b8322a";
    g.beginPath(); g.arc(S / 2, 18, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#2a2018";
    g.textAlign = "center"; g.textBaseline = "middle";
    const px = lines.length > 3 ? 38 : 46;
    g.font = `${px}px ${NOTE_FONT}`;
    const y0 = S / 2 - (lines.length - 1) * px * 0.55 + 8;
    for (let i = 0; i < lines.length; i++) g.fillText(lines[i], S / 2, y0 + i * px * 1.1);
    g.strokeStyle = "#c0392b"; g.lineWidth = 4;
    const last = y0 + (lines.length - 1) * px * 1.1 + px * 0.55;
    g.beginPath(); g.moveTo(S * 0.28, last); g.lineTo(S * 0.72, last - 4); g.stroke();
    const image = new Image();
    image.src = canvas.toDataURL("image/png");
    const h = size / 2;
    const face = { verts: [-h, -h, 0, h, -h, 0, h, h, 0, -h, h, 0], faces: [{ i: [0, 1, 2, 3], color: [0, 0, 0], emissive: 0 }], lines: [], castShadow: false };
    face.imageSurface = { asset: { width: S, height: S, load: () => image }, rect: [-h, -h, size, size] };
    return face;
  };
  // Where each note is pinned and how far it leans.
  const NOTES = [
    { lines: ["plug.", "unplug.", "repeat."], x: -2.05, y: 2.45, tilt: 0.06 },
    { lines: ["More", "channels?", "Really?"], x: 1.95, y: 2.55, tilt: -0.05 },
    { lines: ["Lightning", "is just a", "switchboard", "with extra", "steps."], x: 2.05, y: 1.5, tilt: 0.04, size: 0.5 }
  ];
  const station = cached(() => {
    const B = BOARD, parts = [], round = [], half = B.half;
    // The cabinet: a deep timber case with a dark face, posts at its ends running up to carry the sign, and a cornice.
    parts.push(bevelBox({ w: half * 2, h: B.top - B.shelf, d: B.depth, color: WOOD_DK, offset: { y: (B.top + B.shelf) / 2, z: -B.depth / 2 - 0.02 } }));
    parts.push(box({ w: half * 2 - 0.3, h: B.top - B.shelf - 0.24, d: 0.02, color: PANEL, offset: { y: (B.top + B.shelf) / 2, z: -0.012 } }));
    for (const s of [-1, 1]) {
      parts.push(bevelBox({ w: 0.2, h: B.top + 0.1, d: B.depth + 0.1, color: WOOD, offset: { x: s * (half + 0.02), y: (B.top + 0.1) / 2, z: -B.depth / 2 } }));
      parts.push(FM.beam(s * (half + 0.02), B.top, -0.1, s * (half + 0.02), 5.15, -0.1, 0.16, WOOD_DK));
      parts.push(FM.beam(s * 2.6, 5.05, -0.1, s * 2.6, 5.05, 0.28, 0.07, IRON));
    }
    parts.push(FM.beam(-half - 0.1, 5.05, -0.1, half + 0.1, 5.05, -0.1, 0.12, WOOD_DK));
    parts.push(bevelBox({ w: half * 2 + 0.34, h: 0.22, d: B.depth + 0.18, color: WOOD, offset: { y: B.top + 0.11, z: -B.depth / 2 } }));
    parts.push(bevelBox({ w: half * 2 + 0.2, h: 0.08, d: B.depth + 0.1, color: WOOD_LT, offset: { y: B.top + 0.26, z: -B.depth / 2 } }));
    // The jacks: a turned brass bezel round a dark hole on every cell of the grid, a brass collar round each lamp, and a
    // paper designation strip under each row.
    const bezel = forwardLathe(turn([[0.024, 0], [0.044, 0], [0.048, 0.012], [0.042, 0.024], [0.024, 0.024], [0.024, 0.008]], 10, BRASS));
    const hole = forwardLathe(lathe({ profile: [[0.024, 0.008], [0, 0.008]], segments: 10, color: HOLE }));
    const collar = forwardLathe(torus(0.03, 0.006, BRASS_DK, 0, 10, 5));
    for (let r = 0; r < B.rows; r++) {
      const y = jackY(r);
      for (let c = 0; c < B.cols; c++) {
        const x = jackX(c);
        round.push(moved(merge(bezel), x, y, 0), moved(merge(hole), x, y, 0), moved(merge(collar), x, y + B.lamp, 0.004));
      }
      parts.push(box({ w: (B.cols - 1) * B.pitch + 0.14, h: 0.032, d: 0.006, color: STRIP, offset: { y: y - 0.075, z: 0.003 } }));
    }
    // The desk under the shelf: two pedestals of drawers with the kneehole between them, a back to the hole, and the
    // shelf itself with a hole for each plug and a key plate behind it.
    for (const s of [-1, 1]) {
      const w = half - B.knee - 0.05, cx = s * (B.knee + w / 2);
      parts.push(bevelBox({ w, h: B.shelf - 0.03, d: B.shelfDepth - 0.02, color: WOOD_DK, offset: { x: cx, y: (B.shelf - 0.03) / 2, z: B.shelfDepth / 2 - 0.01 } }));
      for (const y of [0.18, 0.42, 0.62]) {
        parts.push(box({ w: w - 0.16, h: 0.018, d: 0.02, color: WOOD_LT, offset: { x: cx, y: y - 0.07, z: B.shelfDepth + 0.002 } }));
        round.push(moved(forwardLathe(turn([[0, 0], [0.022, 0.004], [0.026, 0.02], [0, 0.03]], 8, BRASS)), cx, y, B.shelfDepth));
      }
    }
    parts.push(box({ w: B.knee * 2, h: B.shelf - 0.06, d: 0.04, color: "#2a170b", offset: { y: (B.shelf - 0.06) / 2, z: 0.03 } }));
    parts.push(bevelBox({ w: half * 2, h: 0.06, d: B.shelfDepth + 0.08, color: WOOD_LT, offset: { y: B.shelf, z: B.shelfDepth / 2 } }));
    for (let i = 0; i < B.cords; i++) {
      round.push(moved(lathe({ profile: [[0.032, 0.031], [0.026, 0.031], [0, 0.031]], segments: 10, color: HOLE }), cordX(i), B.shelf, B.plugZ));
      round.push(moved(turn([[0.034, 0.03], [0.038, 0.036], [0.032, 0.04]], 10, BRASS), cordX(i), B.shelf, B.plugZ));
      parts.push(box({ w: 0.07, h: 0.014, d: 0.1, color: IRON, offset: { x: cordX(i), y: B.shelf + 0.036, z: B.keyZ } }));
    }
    // The rest of the board is patched already: round cords plugged into jacks he cannot reach from his stool, hanging
    // under their own weight to another jack or down over the shelf, a plug in each jack.
    const rnd = BL.math.mulberry32(0x636f7264), reachable = new Set(ACTIVE), anyJack = () => {
      let idx;
      do idx = Math.floor(rnd() * B.cols * B.rows); while (reachable.has(idx));
      return idx;
    };
    const plugged = (x, y, color, dark) => {
      for (const p of plugParts(color, dark)) round.push(moved(turnedX(p, Math.PI / 2), x, y, 0.012));
    };
    for (let i = 0; i < B.patched; i++) {
      const a = anyJack(), ax = jackX(a % B.cols), ay = jackY(Math.floor(a / B.cols)), black = rnd() < 0.22;
      const color = black ? BLACK : RED, dark = black ? "#0e0c0c" : RED_DK, toShelf = rnd() < 0.5;
      let bx, by, bz;
      if (toShelf) { bx = ax * 0.7 + (rnd() - 0.5) * 0.6; by = B.shelf + 0.05; bz = 0.44; }
      else { const b = anyJack(); bx = jackX(b % B.cols); by = jackY(Math.floor(b / B.cols)); bz = PLUG + 0.012; plugged(bx, by, color, dark); }
      plugged(ax, ay, color, dark);
      const az = PLUG + 0.012, span = Math.hypot(bx - ax, by - ay), sag = 0.14 + 0.32 * span;
      const at = (t) => {
        const d = 4 * t * (1 - t);
        let y = ay + (by - ay) * t - sag * d;
        const z = az + (bz - az) * t + 0.16 * d;
        if (z < B.shelfDepth + 0.06 && y < B.shelf + 0.06) y = B.shelf + 0.06;
        return { x: ax + (bx - ax) * t, y, z };
      };
      round.push(tube({ path: at, radius: () => B.cordR, rings: 16, segments: 8, colorFn: () => color }));
    }
    // What lives on the shelf: books and his routing notes, the red telephone, his mug, a cup of tools and papers.
    for (const [x, y, w, h, d, color, angle] of [[1.75, 0.8, 0.34, 0.07, 0.26, "#5e3a7a", 0.1], [1.74, 0.87, 0.3, 0.06, 0.24, "#2f5a8a", -0.06], [1.76, 0.93, 0.32, 0.05, 0.25, "#8a3a2a", 0.15],
      [0.98, 0.78, 0.36, 0.01, 0.26, PAPER, -0.2]]) {
      parts.push(moved(turnedY(bevelBox({ w, h, d, color }), angle), x, y, 0.24));
    }
    round.push(moved(turn([[0, 0], [0.05, 0], [0.052, 0.12], [0.046, 0.12], [0.044, 0.01], [0, 0.01]], 12, "#efe9dc"), -1.6, B.shelf + 0.03, 0.3));
    round.push(moved(turnedZ(torus(0.03, 0.009, "#efe9dc", 0, 10, 5), Math.PI / 2), -1.548, B.shelf + 0.09, 0.3));
    round.push(moved(turn([[0, 0], [0.05, 0], [0.05, 0.13], [0.044, 0.13], [0.044, 0.01], [0, 0.01]], 12, "#3a2a1e"), -1.88, B.shelf + 0.03, 0.22));
    for (const [dx, h, color] of [[-0.02, 0.24, "#d4a72c"], [0.02, 0.21, RED], [0.0, 0.26, "#7a7a7a"]]) parts.push(box({ w: 0.016, h, d: 0.016, color, offset: { x: -1.88 + dx, y: B.shelf + 0.03 + h / 2, z: 0.22 } }));
    parts.push(bevelBox({ w: 0.28, h: 0.1, d: 0.24, color: RED, offset: { x: 2.25, y: 0.82, z: 0.22 } }));
    round.push(moved(turnedZ(tube({ path: (t) => ({ x: -0.14 + 0.28 * t, y: 0.05 * Math.sin(Math.PI * t), z: 0 }), radius: () => 0.026, rings: 8, segments: 8, colorFn: () => "#a82a18" }), 0), 2.25, 0.9, 0.2));
    round.push(moved(forwardLathe(lathe({ profile: [[0.07, 0], [0.07, 0.012], [0, 0.012]], segments: 16, color: "#f2efe4" })), 2.25, 0.82, 0.34));
    // His stool, round and turned, with a rung for his sandals; and crates at the board's ends with spare cord coiled.
    const sz = B.seat.z;
    round.push(moved(turn([[0, 0.46], [0.24, 0.46], [0.25, 0.5], [0.23, 0.54], [0, 0.55]], 16, WOOD), 0, 0, sz));
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2 + 0.5;
      parts.push(FM.beam(Math.sin(a) * 0.24, 0, sz + Math.cos(a) * 0.24, Math.sin(a) * 0.15, 0.46, sz + Math.cos(a) * 0.15, 0.05, WOOD_DK));
    }
    round.push(moved(torus(0.2, 0.018, WOOD_DK, 0, 16, 6), 0, 0.3, sz));
    for (const [x, y, z, s, color] of [[-2.35, 0.4, 1.0, 0.8, "#8a5a30"], [-2.35, 1.15, 1.05, 0.7, "#7a4e28"], [2.35, 0.35, 1.0, 0.7, "#8a5a30"]]) parts.push(bevelBox({ w: s, h: s, d: s, color, offset: { x, y, z } }));
    for (let i = 0; i < 4; i++) round.push(moved(torus(0.22 - i * 0.03, 0.022, i % 2 ? BLACK : RED, 0, 16, 6), 2.35, 0.72 + i * 0.045, 1.0));
    const body = shaded(round, parts);
    const lamp = shaded([forwardLathe(turn([[0.026, 0], [0.026, 0.008], [0.02, 0.026], [0, 0.032]], 10, LAMP, 1))]);
    // A lever key: a bat-handle standing up from its plate with a round knob, pivoting about x at its foot.
    const key = shaded([turn([[0.008, 0], [0.008, 0.06], [0, 0.06]], 8, "#c8c2b4"), turn([[0, 0.055], [0.018, 0.06], [0.02, 0.075], [0.014, 0.088], [0, 0.09]], 10, BLACK)]);
    // A cord segment: a unit round tube along +z, scaled to length and thickness where it is drawn.
    const segment = (color) => shaded([forwardLathe(lathe({ profile: [[1, -0.5], [1, 0.5]], segments: 10, color }))]);
    return { body, lamp, plugs: { red: plug(RED, RED_DK), black: plug(BLACK, "#0e0c0c") }, key, segments: { red: segment(RED), black: segment(BLACK) }, notes: NOTES.map((n) => note(n.lines, n.size)) };
  });
  // The sign above the board, in the Factory's lit lettering.
  const sign = () => FM.label("KORTIK'S\nSWITCHBOARD", "Manual Routing Department", { height: BOARD.sign.height });

  BL.kortikModels = { NAME, U, BOARD, ACTIVE, NOTES, PLUG, GRIP, rig, station, sign, jackX, jackY, cordX };
})();
