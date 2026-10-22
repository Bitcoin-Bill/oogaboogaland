// Kortik's Switchboard: the manual patchboard on its deck beside the Routing Console, and Kortik, the samurai who works
// it. Geometry and his dress only; kortik.js runs him. Everything is in the wall's frame: the panel's face at z 0
// looking +z into the hall, x along the wall, y up from the deck.
(() => {
  "use strict";
  const BL = window.BL, M = BL.models, FM = BL.factoryModels;
  const { box, bevelBox, merge, cached, makeVox } = M;
  const { createNode, addChild } = BL.scene;

  // ---- Kortik --------------------------------------------------------------------------------------------------

  // A fictional samurai for now: a name no login can have keeps him off the roster, the island and every claim.
  const NAME = "kortik/factory";
  const LOOK = {
    skin: "#d08a52", hair: "#2a2124", robe: "#3b3444", robeDk: "#2a2431", collar: "#5a5266", sash: "#cdbb98", sashDk: "#ab987c",
    wrap: "#1b1719", sandal: "#8a5a32", strap: "#c8b694", mouth: "#4a1f17"
  };
  const SCABBARD = "#1d1a1c", GOLD = "#e8b23a", GOLD_DK = "#a87a22", HILT_DK = "#2a1d10";
  const TONES = Object.keys(LOOK);
  const tones = (k) => k.kortik || (k.kortik = Object.fromEntries(TONES.map((key) => [key, k.color(LOOK[key])])));
  // Kimono cloth: the robe's colour flecked with its shadow, hashed from the cell so no character's draws move.
  const cloth = (T) => (x, y, z) => ((x * 7 + y * 13 + z * 5) % 9 === 0 ? T.robeDk : T.robe);
  // The katana at his left hip, hilt forward and up: a black scabbard tipped in gold, a gold guard, and a gold grip
  // bound in dark diamonds. Built along +z, the grip's end at +z, in metres.
  const katana = cached(() => {
    const parts = [
      box({ w: 0.05, h: 0.045, d: 0.62, color: SCABBARD, offset: { z: -0.2 } }),
      box({ w: 0.056, h: 0.05, d: 0.04, color: GOLD, offset: { z: -0.5 } }),
      box({ w: 0.056, h: 0.05, d: 0.03, color: GOLD_DK, offset: { z: 0.1 } }),
      box({ w: 0.11, h: 0.1, d: 0.025, color: GOLD, offset: { z: 0.135 } }),
      box({ w: 0.045, h: 0.04, d: 0.24, color: GOLD, offset: { z: 0.27 } }),
      box({ w: 0.05, h: 0.045, d: 0.02, color: GOLD_DK, offset: { z: 0.395 } })
    ];
    for (const z of [0.18, 0.24, 0.3, 0.36]) parts.push(box({ w: 0.049, h: 0.012, d: 0.03, color: HILT_DK, offset: { y: 0.018, z } }), box({ w: 0.049, h: 0.012, d: 0.03, color: HILT_DK, offset: { y: -0.018, z: z + 0.03 } }));
    return merge(...parts);
  });
  // The dress hooks models.buildCaveman calls, in its order.
  const DRESS = {
    // A dark kimono crossed at the chest over a V of skin, its lapels edged lighter, and a pale sash knotted at the
    // front with its tails hanging; the loincloth's flaps are the kimono's skirts.
    torso(k, v) {
      const T = tones(k);
      v.fill(0, 8, 0, 7, 0, 5, cloth(T));
      for (const [x, y] of [[3, 7], [4, 7], [5, 7], [4, 6]]) v.set(x, y, 5, k.skinJ());
      for (const [x, y] of [[2, 7], [6, 7], [3, 6], [5, 6], [4, 5]]) v.set(x, y, 5, T.collar);
      v.set(5, 5, 5, T.robeDk);
      v.set(5, 4, 5, T.robeDk);
      v.fill(0, 8, 2, 3, 0, 5, (x, y, z) => ((x + y + z) % 4 ? T.sash : T.sashDk));
      for (const [x, y, c] of [[4, 2, T.sash], [4, 3, T.sashDk], [3, 2, T.sashDk], [5, 3, T.sash], [3, 1, T.sash], [5, 1, T.sashDk], [3, 0, T.sashDk]]) v.set(x, y, 6, c);
      k.loin = [T.robe, T.robeDk];
    },
    // Wide kimono sleeves to the forearm over dark wrist wraps, and hakama: wide pleated legs to the ankle over
    // straw sandals.
    gear(k) {
      const T = tones(k), u = k.u, c = cloth(T), arm = makeVox(), leg = makeVox();
      arm.fill(0, 2, 0, 1, 0, 2, k.skinJ);
      arm.fill(0, 2, 2, 3, 0, 2, T.wrap);
      arm.fill(0, 2, 4, 4, 0, 2, k.skinJ);
      arm.fill(-1, 3, 5, 10, -1, 3, (x, y, z) => (y === 5 ? T.robeDk : c(x, y, z)));
      arm.fill(0, 2, 11, 11, 0, 2, c);
      k.parts.armR.geometry = k.parts.armL.geometry = k.vg(arm, { x: -1.5 * u, y: -11 * u, z: -1.5 * u });
      leg.fill(-1, 4, 2, 4, -1, 4, (x) => (x & 1 ? T.robe : T.robeDk));
      leg.fill(0, 3, 1, 1, 0, 4, T.robeDk);
      leg.fill(0, 3, 0, 0, 0, 5, T.sandal);
      leg.fill(0, 3, 1, 1, 5, 5, k.skinJ);
      leg.set(1, 1, 4, T.strap);
      leg.set(2, 1, 4, T.strap);
      k.parts.legR.geometry = k.parts.legL.geometry = k.vg(leg, { x: -2 * u, y: -5 * u, z: -2.5 * u });
    },
    // A thick black crop over the crown and down the back, sideburns into the beard, forelocks at the brow's corners,
    // and the topknot: a bound stalk with its knot standing up off the crown. The bare head's ears show below.
    crown(k, v) {
      const hair = k.hairJ, T = tones(k);
      v.fill(-1, 7, 6, 7, -1, 6, hair);
      v.fill(0, 6, 8, 8, 0, 5, hair);
      v.fill(-1, 7, 1, 5, -1, -1, hair);
      v.fill(-1, -1, 3, 5, -1, 4, hair);
      v.fill(7, 7, 3, 5, -1, 4, hair);
      v.fill(-1, -1, 1, 2, 4, 5, hair);
      v.fill(7, 7, 1, 2, 4, 5, hair);
      for (const x of [0, 1, 5, 6]) v.set(x, 5, 6, hair());
      v.fill(2, 4, 9, 9, 1, 3, hair);
      v.set(3, 10, 2, T.wrap);
      v.fill(2, 4, 11, 12, 1, 3, hair);
      v.set(3, 13, 2, hair());
    },
    // Narrow eyes under the brows, their pupils turned in: a glare. They are the cells a blink closes.
    eyes(k, v) {
      for (const x of [1, 2, 4, 5]) {
        v.set(x, 2, 5, k.P.white);
        k.eyeCells.push([x, 2]);
      }
      v.set(2, 2, 5, k.P.black);
      v.set(4, 2, 5, k.P.black);
      return true;
    },
    // Heavy brows slanting down to a crease, the nose, a moustache over a down-turned mouth, and a short beard along the
    // jaw to a point, the cheeks bare.
    mark(k, v) {
      const T = tones(k), hair = k.hairJ, P = k.P;
      for (const [x, y] of [[0, 4], [1, 4], [1, 3], [2, 3], [6, 4], [5, 4], [5, 3], [4, 3]]) v.set(x, y, 6, hair());
      v.set(3, 3, 5, P.skinDk);
      v.set(3, 2, 6, P.nose);
      v.set(3, 1, 6, P.nose);
      for (const x of [1, 2, 4, 5]) v.set(x, 1, 6, hair());
      v.fill(2, 4, 0, 0, 6, 6, T.mouth);
      v.set(1, 0, 6, hair());
      v.set(5, 0, 6, hair());
      v.set(0, 0, 5, hair());
      v.set(6, 0, 5, hair());
      v.fill(0, 6, -1, -1, 3, 6, hair);
      v.fill(1, 5, -2, -2, 4, 6, hair);
      v.fill(2, 4, -3, -3, 5, 6, hair);
    },
    // The katana instead of a club, slung at the left hip (+x is his left).
    extras(k) {
      k.parts.club.visible = false;
      k.parts.katana = createNode({ position: { x: k.armX * 0.82, y: 0.16 * k.h, z: 0.02 * k.h }, rotation: { x: -0.5, y: 0.3, z: 0.12 }, geometry: katana() });
      addChild(k.root, k.parts.katana);
    }
  };
  const traits = cached(() => ({
    ...BL.contributors.traitsFor(NAME), skin: LOOK.skin, hair: LOOK.hair, fur: LOOK.robe, height: 1.3, belly: 1.08,
    face: "none", hairless: true, noBrow: true, noPupils: true, dress: DRESS
  }));

  // ---- the switchboard ----------------------------------------------------------------------------------------

  const WOOD = "#7a4a26", WOOD_DK = "#4a2c16", WOOD_LT = "#9a6234", PANEL = "#24150d", BRASS = "#c9a24a", HOLE = "#0c0908";
  const STRIP = "#e8dcc0", LAMP = "#ffb21c", RED = "#c8321e", BLACK = "#1e1a1a", PAPER = "#efdfb0", IRON = "#2a2a2a";
  // The board: jacks on a grid over the whole face, `cols` across `pitch` apart and `rows` up from `y0`, each with its
  // lamp just above. The middle `active` columns of the lowest `activeRows` rows are the ones Kortik can reach from
  // his stool and works. The shelf in front carries the cords' plugs in a row and a key behind each.
  const BOARD = {
    half: 2.8, top: 3.4, depth: 0.38, shelf: 0.745, shelfDepth: 0.5,
    cols: 21, rows: 10, pitch: 0.25, rowPitch: 0.22, y0: 0.98, lamp: 0.085,
    active: 8, activeRows: 4,
    cords: 10, cordPitch: 0.15, plugZ: 0.16, keyZ: 0.34, black: [2, 6, 8], patched: 18,
    seat: { y: 0.6, z: FM.KORTIK.seat },
    sign: { y: 4.35, z: 0.08, height: 1.1 }, hooks: [[-2.6, 5.05, 0.28], [2.6, 5.05, 0.28]]
  };
  const jackX = (c) => (c - (BOARD.cols - 1) / 2) * BOARD.pitch, jackY = (r) => BOARD.y0 + r * BOARD.rowPitch;
  const cordX = (i) => (i - (BOARD.cords - 1) / 2) * BOARD.cordPitch;
  // The active jacks, lowest row first, as indices into the whole grid (row * cols + col).
  const ACTIVE = [];
  for (let r = 0; r < BOARD.activeRows; r++) for (let c = 0; c < BOARD.active; c++) ACTIVE.push(r * BOARD.cols + (BOARD.cols - BOARD.active) / 2 + c);
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
    const B = BOARD, parts = [], half = B.half;
    // The cabinet: a deep timber case with a dark face, posts at its ends running up to carry the sign, and a cornice.
    parts.push(bevelBox({ w: half * 2, h: B.top - B.shelf, d: B.depth, color: WOOD_DK, offset: { y: (B.top + B.shelf) / 2, z: -B.depth / 2 - 0.02 } }));
    parts.push(box({ w: half * 2 - 0.3, h: B.top - B.shelf - 0.24, d: 0.02, color: PANEL, offset: { y: (B.top + B.shelf) / 2, z: -0.012 } }));
    for (const s of [-1, 1]) {
      parts.push(bevelBox({ w: 0.18, h: B.top + 0.1, d: B.depth + 0.08, color: WOOD, offset: { x: s * (half + 0.02), y: (B.top + 0.1) / 2, z: -B.depth / 2 } }));
      parts.push(FM.beam(s * (half + 0.02), B.top, -0.1, s * (half + 0.02), 5.15, -0.1, 0.16, WOOD_DK));
      parts.push(FM.beam(s * 2.6, 5.05, -0.1, s * 2.6, 5.05, 0.28, 0.07, IRON));
    }
    parts.push(FM.beam(-half - 0.1, 5.05, -0.1, half + 0.1, 5.05, -0.1, 0.12, WOOD_DK));
    parts.push(bevelBox({ w: half * 2 + 0.3, h: 0.2, d: B.depth + 0.16, color: WOOD, offset: { y: B.top + 0.1, z: -B.depth / 2 } }));
    // The jacks: a brass bezel round a dark hole on every cell of the grid, and a paper designation strip under each row.
    for (let r = 0; r < B.rows; r++) {
      const y = jackY(r);
      for (let c = 0; c < B.cols; c++) {
        const x = jackX(c);
        parts.push(box({ w: 0.075, h: 0.075, d: 0.02, color: BRASS, offset: { x, y, z: 0.005 } }), box({ w: 0.034, h: 0.034, d: 0.012, color: HOLE, offset: { x, y, z: 0.016 } }));
      }
      parts.push(box({ w: (B.cols - 1) * B.pitch + 0.12, h: 0.03, d: 0.006, color: STRIP, offset: { y: y - 0.07, z: 0.003 } }));
    }
    // The desk under the shelf, its kneehole and drawers, and the shelf itself with a hole for each plug and a key
    // plate behind it.
    parts.push(bevelBox({ w: half * 2 - 0.1, h: B.shelf - 0.03, d: B.shelfDepth - 0.02, color: WOOD_DK, offset: { y: (B.shelf - 0.03) / 2, z: B.shelfDepth / 2 - 0.01 } }));
    parts.push(box({ w: 1.3, h: 0.5, d: 0.02, color: "#160d08", offset: { y: 0.3, z: B.shelfDepth + 0.002 } }));
    for (const s of [-1, 1]) for (const y of [0.22, 0.48]) {
      parts.push(box({ w: 1.0, h: 0.02, d: 0.02, color: WOOD_LT, offset: { x: s * 1.55, y, z: B.shelfDepth + 0.002 } }));
      parts.push(box({ w: 0.06, h: 0.04, d: 0.04, color: BRASS, offset: { x: s * 1.55, y: y + 0.1, z: B.shelfDepth + 0.01 } }));
    }
    parts.push(bevelBox({ w: half * 2, h: 0.06, d: B.shelfDepth + 0.06, color: WOOD_LT, offset: { y: B.shelf, z: B.shelfDepth / 2 } }));
    for (let i = 0; i < B.cords; i++) {
      parts.push(box({ w: 0.05, h: 0.004, d: 0.05, color: HOLE, offset: { x: cordX(i), y: B.shelf + 0.03, z: B.plugZ } }));
      parts.push(box({ w: 0.06, h: 0.012, d: 0.09, color: IRON, offset: { x: cordX(i), y: B.shelf + 0.035, z: B.keyZ } }));
    }
    // What lives on the shelf: books and his routing notes, the red telephone, his mug, a cup of tools and papers.
    for (const [x, y, w, h, d, color, turn] of [[1.75, 0.8, 0.34, 0.07, 0.26, "#5e3a7a", 0.1], [1.74, 0.87, 0.3, 0.06, 0.24, "#2f5a8a", -0.06], [1.76, 0.93, 0.32, 0.05, 0.25, "#8a3a2a", 0.15],
      [-1.6, 0.83, 0.09, 0.11, 0.09, "#efe9dc", 0], [-1.85, 0.84, 0.1, 0.13, 0.1, "#3a2a1e", 0], [0.98, 0.78, 0.36, 0.01, 0.26, PAPER, -0.2]]) {
      parts.push(M.moved(M.turnedY(box({ w, h, d, color }), turn), x, y, 0.24));
    }
    for (const [dx, h, color] of [[-0.03, 0.22, "#d4a72c"], [0.02, 0.2, RED], [0.0, 0.25, "#7a7a7a"]]) parts.push(box({ w: 0.018, h, d: 0.018, color, offset: { x: -1.85 + dx, y: 0.84 + h / 2, z: 0.24 } }));
    parts.push(box({ w: 0.26, h: 0.1, d: 0.22, color: RED, offset: { x: 2.25, y: 0.82, z: 0.22 } }), box({ w: 0.3, h: 0.05, d: 0.08, color: "#a82a18", offset: { x: 2.25, y: 0.9, z: 0.22 } }),
      box({ w: 0.1, h: 0.012, d: 0.1, color: "#f2efe4", offset: { x: 2.25, y: 0.875, z: 0.3 } }));
    // The rest of the board is patched already: cords plugged into jacks he cannot reach from his stool, hanging
    // under their own weight to another jack or down over the shelf, a plug at each jack.
    const rnd = BL.math.mulberry32(0x636f7264), reachable = new Set(ACTIVE), anyJack = () => {
      let idx;
      do idx = Math.floor(rnd() * B.cols * B.rows); while (reachable.has(idx));
      return idx;
    };
    for (let i = 0; i < B.patched; i++) {
      const a = anyJack(), ax = jackX(a % B.cols), ay = jackY(Math.floor(a / B.cols)), color = rnd() < 0.22 ? BLACK : RED;
      const toShelf = rnd() < 0.5;
      let bx, by, bz;
      if (toShelf) { bx = ax * 0.7 + (rnd() - 0.5) * 0.6; by = B.shelf + 0.03; bz = 0.44; }
      else { const b = anyJack(); bx = jackX(b % B.cols); by = jackY(Math.floor(b / B.cols)); bz = 0.12; parts.push(box({ w: 0.034, h: 0.034, d: 0.11, color, offset: { x: bx, y: by, z: 0.065 } })); }
      parts.push(box({ w: 0.034, h: 0.034, d: 0.11, color, offset: { x: ax, y: ay, z: 0.065 } }));
      const span = Math.hypot(bx - ax, by - ay), sag = 0.12 + 0.3 * span;
      let px = ax, py = ay, pz = 0.12;
      for (let k = 1; k <= 9; k++) {
        const t = k / 9, d = 4 * t * (1 - t);
        let qx = ax + (bx - ax) * t, qy = ay + (by - ay) * t - sag * d, qz = 0.12 + (bz - 0.12) * t + 0.14 * d;
        // Over the shelf a cord lies on it rather than through it.
        if (qz < B.shelfDepth + 0.04 && qy < B.shelf + 0.05) qy = B.shelf + 0.05;
        parts.push(FM.beam(px, py, pz, qx, qy, qz, 0.028, color));
        px = qx; py = qy; pz = qz;
      }
    }
    // His stool, and crates at the board's ends.
    const sz = BOARD.seat.z;
    parts.push(bevelBox({ w: 0.46, h: 0.07, d: 0.46, color: WOOD, offset: { y: 0.47, z: sz } }));
    for (const [dx, dz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) parts.push(FM.beam(dx * 1.2, 0, sz + dz * 1.2, dx, 0.44, sz + dz, 0.06, WOOD_DK));
    for (const [x, y, z, s, color] of [[-2.35, 0.4, 1.0, 0.8, "#8a5a30"], [-2.35, 1.15, 1.05, 0.7, "#7a4e28"], [2.35, 0.35, 1.0, 0.7, "#8a5a30"]]) parts.push(bevelBox({ w: s, h: s, d: s, color, offset: { x, y, z } }));
    // A coil of spare cord on the right crate.
    for (let i = 0; i < 6; i++) parts.push(FM.beam(2.15 + i * 0.07, 0.72, 0.8, 2.15 + i * 0.07, 0.72, 1.2, 0.05, i % 3 ? RED : BLACK));
    const body = merge(...parts);
    const lamp = merge(box({ w: 0.05, h: 0.035, d: 0.03, color: LAMP, emissive: 1, offset: { z: 0.018 } }));
    // A plug stands on its tip at y 0: a brass tip and collar under a sleeve, the cord leaving its far end at PLUG.
    const plug = (color) => merge(box({ w: 0.016, h: 0.045, d: 0.016, color: BRASS, offset: { y: -0.022 } }), box({ w: 0.03, h: 0.015, d: 0.03, color: BRASS, offset: { y: 0.008 } }),
      box({ w: 0.034, h: 0.08, d: 0.034, color, offset: { y: 0.055 } }), box({ w: 0.02, h: 0.02, d: 0.02, color, offset: { y: 0.104 } }));
    // A lever key: a bat-handle standing up from its plate, pivoting about x at its foot.
    const key = merge(box({ w: 0.016, h: 0.07, d: 0.016, color: "#c8c2b4", offset: { y: 0.035 } }), box({ w: 0.03, h: 0.022, d: 0.03, color: BLACK, offset: { y: 0.075 } }));
    // A cord segment: a unit box along +z, scaled to length and thickness where it is drawn.
    const segment = (color) => box({ w: 1, h: 1, d: 1, color, offset: { z: 0 } });
    return { body, lamp, plugs: { red: plug(RED), black: plug(BLACK) }, key, segments: { red: segment(RED), black: segment(BLACK) }, notes: NOTES.map((n) => note(n.lines, n.size)) };
  });
  const PLUG = 0.115;
  // The sign above the board, in the Factory's lit lettering.
  const sign = () => FM.label("KORTIK'S\nSWITCHBOARD", "Manual Routing Department", { height: BOARD.sign.height });

  BL.kortikModels = { NAME, BOARD, ACTIVE, NOTES, PLUG, traits, station, sign, jackX, jackY, cordX };
})();
