// The Timechain Sphere's room, as one design built at each of its three sizes (timechain-rooms.js `layout`): a round
// charcoal hall with amber light strips, the screen wall across the front with the latest-blocks ribbon over it, an
// amber chain of blocks inlaid from the doorway to the meeting table, and behind the visitor the one doorway in a flat
// bay, its two leaves continuing the wall's strip and chain across their seam, the Exit button beside it and a dim
// vestibule past it. The architecture scales; the doorway, the furniture, the button and the screens' pixels do not
// change size with it, only how far apart things stand. Geometry is cached per size and shared by every room of that
// size; `build` makes one room's nodes. The screens' pictures are the scene's (`picture`); nothing here paints.
(() => {
  "use strict";
  const BL = window.BL;
  const { box, lathe, ring, merge, noShadow, moved, turnedY } = BL.models;
  const { hexToRgb } = BL.math;
  const { createNode, addChild } = BL.scene;
  const ROOMS = BL.timechainRooms, DOOR = ROOMS.DOOR;
  const C = {
    tileA: "#19191c", tileB: "#222226", base: "#121214", wall: "#1f1f23", band: "#18181b", pilaster: "#141417",
    ceiling: "#111113", bezel: "#0c0c0d", amber: "#f7931a", ember: "#9c5a12", vestibule: "#0f0f11", curtain: "#08080a",
    curtainB: "#121215", seat: "#2a2a2f", cushion: "#34343a", desk: "#1d1d21", leg: "#101012"
  };
  const rgb = (c) => typeof c === "string" ? hexToRgb(c) : c;
  // A quad wound so its front faces `normal`, whatever order its corners come in.
  const quad = (geo, a, b, c, d, color, emissive, normal) => {
    const base = geo.verts.length / 3, pts = [a, b, c, d];
    let nx = 0, ny = 0, nz = 0;
    for (let k = 0; k < 4; k++) {
      const p = pts[k], q = pts[(k + 1) % 4];
      geo.verts.push(p[0], p[1], p[2]);
      nx += (p[1] - q[1]) * (p[2] + q[2]); ny += (p[2] - q[2]) * (p[0] + q[0]); nz += (p[0] - q[0]) * (p[1] + q[1]);
    }
    const i = [base, base + 1, base + 2, base + 3];
    geo.faces.push({ i: nx * normal[0] + ny * normal[1] + nz * normal[2] < 0 ? i.reverse() : i, color: rgb(color), emissive });
  };
  const blank = () => ({ verts: [], faces: [], lines: [] });
  const perScale = (build) => {
    const made = new Map();
    return (scale) => made.get(scale) || made.set(scale, build(scale)).get(scale);
  };
  const UP = [0, 1, 0], DOWN = [0, -1, 0];

  // The hall: the round wall from bay edge to bay edge, the flat bay with the doorway cut in it, the floor's tiles
  // over a dark base, the chain of blocks, the dome and the pilasters between the screens and the door.
  const hall = perScale((scale) => {
    const L = ROOMS.layout(scale), R = L.radius, H = L.wall, s = scale, geo = blank(), parts = [geo];
    const edge = Math.asin(DOOR.bay / R), n = Math.round(40 * s), at = (phi, y, r = R) => [r * Math.sin(phi), y, r * Math.cos(phi)];
    for (let i = 0; i < n; i++) {
      const p0 = edge + (Math.PI * 2 - 2 * edge) * i / n, p1 = edge + (Math.PI * 2 - 2 * edge) * (i + 1) / n, m = (p0 + p1) / 2, inward = [-Math.sin(m), 0, -Math.cos(m)];
      quad(geo, at(p0, 0), at(p1, 0), at(p1, 0.9), at(p0, 0.9), C.band, 0, inward);
      quad(geo, at(p0, 0.9), at(p1, 0.9), at(p1, H), at(p0, H), C.wall, 0, inward);
    }
    // The bay, facing into the room, round the doorway.
    const Z = L.doorZ, B = DOOR.bay, W = DOOR.halfW, D = DOOR.height, IN = [0, 0, -1];
    quad(geo, [-B, 0, Z], [-W, 0, Z], [-W, H, Z], [-B, H, Z], C.wall, 0, IN);
    quad(geo, [W, 0, Z], [B, 0, Z], [B, H, Z], [W, H, Z], C.wall, 0, IN);
    quad(geo, [-W, D, Z], [W, D, Z], [W, H, Z], [-W, H, Z], C.wall, 0, IN);
    // Its frame: jambs and a lintel standing a hand proud of the bay.
    const F = DOOR.frame;
    for (const side of [-1, 1]) parts.push(box({ w: F, h: D + F, d: 0.14, color: C.pilaster, offset: { x: side * (W + F / 2), y: (D + F) / 2, z: Z - 0.05 } }));
    parts.push(box({ w: 2 * W + 2 * F, h: F, d: 0.14, color: C.pilaster, offset: { y: D + F / 2, z: Z - 0.05 } }));
    // The floor: a dark base disc, then tiles wherever a whole tile fits.
    const segments = 64, middle = geo.verts.length / 3;
    geo.verts.push(0, -0.01, 0);
    for (let i = 0; i < segments; i++) {
      const p0 = at(i / segments * Math.PI * 2, -0.01), p1 = at((i + 1) / segments * Math.PI * 2, -0.01), base = geo.verts.length / 3;
      geo.verts.push(...p0, ...p1);
      // Points at increasing angle run from +z toward +x: counter-clockwise seen from above, so the face looks up.
      geo.faces.push({ i: [middle, base, base + 1], color: hexToRgb(C.base), emissive: 0 });
    }
    const T = 1.2, cells = Math.ceil(R / T);
    for (let i = -cells; i < cells; i++) for (let j = -cells; j < cells; j++) {
      const x0 = i * T, x1 = x0 + T, z0 = j * T, z1 = z0 + T;
      if (Math.max(Math.hypot(x0, z0), Math.hypot(x1, z0), Math.hypot(x0, z1), Math.hypot(x1, z1)) > R - 0.05 || z1 > Z) continue;
      quad(geo, [x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1], (i + j) & 1 ? C.tileA : C.tileB, 0, UP);
    }
    // The dome, from the wall's top to its crown.
    const crown = L.ceiling, rings = 6;
    for (let k = 0; k < rings; k++) for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, t0 = k / rings, t1 = (k + 1) / rings;
      const r0 = R * Math.cos(t0 * Math.PI / 2), r1 = R * Math.cos(t1 * Math.PI / 2), y0 = H + (crown - H) * Math.sin(t0 * Math.PI / 2), y1 = H + (crown - H) * Math.sin(t1 * Math.PI / 2);
      quad(geo, at(a0, y0, r0), at(a1, y0, r0), at(a1, y1, r1), at(a0, y1, r1), C.ceiling, 0, [-Math.sin((a0 + a1) / 2) * 0.5, -1, -Math.cos((a0 + a1) / 2) * 0.5]);
    }
    // Pilasters down the side and back walls, clear of the screens and the bay.
    for (const k of [1.3, 1.75, 2.2, 2.62]) for (const side of [-1, 1]) {
      const phi = Math.PI + side * k, r = R - 0.16 * s;
      parts.push(moved(turnedY(box({ w: 0.5 * s, h: H, d: 0.32 * s, color: C.pilaster, offset: { y: H / 2 } }), phi), r * Math.sin(phi), 0, r * Math.cos(phi)));
    }
    // The screens' and cards' dark bezels, a little behind their pictures.
    for (const list of [L.screens, L.ribbon]) for (const p of list) {
      const pad = list === L.screens ? 0.16 * s : 0.06 * s, back = 0.1;
      parts.push(moved(turnedY(box({ w: p.w + pad, h: p.h + pad, d: back, color: C.bezel, offset: { z: -back / 2 - 0.01 } }), -p.angle), p.x, p.y, p.z));
    }
    return merge(...parts);
  });
  // What glows: the light strips low and high round the wall and across the bay, the chain of blocks on the floor
  // from the doorway to the table and round it, and the doorway's amber edge. Kept off the shadows.
  const glow = perScale((scale) => {
    const L = ROOMS.layout(scale), R = L.radius, H = L.wall, s = scale, geo = blank();
    const edge = Math.asin(DOOR.bay / R), n = Math.round(40 * s), at = (phi, y, r) => [r * Math.sin(phi), y, r * Math.cos(phi)];
    for (const [y, h] of [[0.9, 0.05], [H - 0.45 * s, 0.07 * s]]) for (let i = 0; i < n; i++) {
      const p0 = edge + (Math.PI * 2 - 2 * edge) * i / n, p1 = edge + (Math.PI * 2 - 2 * edge) * (i + 1) / n, m = (p0 + p1) / 2, r = R - 0.02;
      quad(geo, at(p0, y, r), at(p1, y, r), at(p1, y + h, r), at(p0, y + h, r), C.amber, 1, [-Math.sin(m), 0, -Math.cos(m)]);
    }
    const Z = L.doorZ - 0.015, B = DOOR.bay, W = DOOR.halfW, IN = [0, 0, -1], top = H - 0.45 * s;
    quad(geo, [-B, 0.9, Z], [-W - DOOR.frame, 0.9, Z], [-W - DOOR.frame, 0.95, Z], [-B, 0.95, Z], C.amber, 1, IN);
    quad(geo, [W + DOOR.frame, 0.9, Z], [B, 0.9, Z], [B, 0.95, Z], [W + DOOR.frame, 0.95, Z], C.amber, 1, IN);
    quad(geo, [-B, top, Z], [B, top, Z], [B, top + 0.07 * s, Z], [-B, top + 0.07 * s, Z], C.amber, 1, IN);
    // The doorway's amber edge, inside the frame.
    const D = DOOR.height, e = 0.035, z = L.doorZ - 0.125;
    for (const side of [-1, 1]) quad(geo, [side * W - e, 0, z], [side * W + e, 0, z], [side * W + e, D, z], [side * W - e, D, z], C.amber, 0.9, IN);
    quad(geo, [-W, D - e, z], [W, D - e, z], [W, D + e, z], [-W, D + e, z], C.amber, 0.9, IN);
    // The chain: links down the axis from the doorway to the table's ring, and the ring of links round the table.
    const link = (x, z, a, len, w, emissive) => {
      const c = Math.cos(a), sn = Math.sin(a), hx = w / 2, hz = len / 2, p = (u, v) => [x + u * c + v * sn, 0.006, z - u * sn + v * c];
      quad(geo, p(-hx, -hz), p(hx, -hz), p(hx, hz), p(-hx, hz), C.amber, emissive, UP);
    };
    const ringR = L.table.r + 0.75;
    for (let z = L.doorZ - 0.45; z > ringR + 0.2; z -= 0.62) {
      link(0, z, 0, 0.36, 0.44, 0.55);
      if (z - 0.62 > ringR + 0.2) link(0, z - 0.31, 0, 0.26, 0.09, 0.4);
    }
    const links = 26;
    for (let i = 0; i < links; i++) {
      const a = (i + 0.5) / links * Math.PI * 2;
      link(Math.sin(a) * ringR, Math.cos(a) * ringR, a, 0.22, 0.3 + (i & 1) * 0.08, i & 1 ? 0.4 : 0.55);
    }
    return noShadow(geo);
  });
  // The vestibule past the doorway, dim, ending in a hanging curtain of dark strips; the same depth in every room.
  const vestibule = perScale((scale) => {
    const L = ROOMS.layout(scale), geo = blank(), Z = L.doorZ, W = DOOR.halfW, D = DOOR.height, end = Z + DOOR.vestibule;
    quad(geo, [-W, 0, Z], [W, 0, Z], [W, 0, end], [-W, 0, end], C.vestibule, 0, UP);
    quad(geo, [-W, D, Z], [W, D, Z], [W, D, end], [-W, D, end], C.vestibule, 0, DOWN);
    for (const side of [-1, 1]) quad(geo, [side * W, 0, Z], [side * W, 0, end], [side * W, D, end], [side * W, D, Z], C.vestibule, 0, [-side, 0, 0]);
    const strips = 10;
    for (let i = 0; i < strips; i++) {
      const x0 = -W + 2 * W * i / strips, x1 = x0 + 2 * W / strips;
      quad(geo, [x0, 0, end], [x1, 0, end], [x1, D, end], [x0, D, end], i & 1 ? C.curtain : C.curtainB, 0, [0, 0, -1]);
    }
    return geo;
  });
  const vestibuleGlow = perScale((scale) => {
    const L = ROOMS.layout(scale), geo = blank(), Z = L.doorZ, W = DOOR.halfW - 0.08, end = Z + DOOR.vestibule - 0.05;
    for (const side of [-1, 1]) quad(geo, [side * W - 0.02, 0.005, Z], [side * W + 0.02, 0.005, Z], [side * W + 0.02, 0.005, end], [side * W - 0.02, 0.005, end], C.ember, 0.6, UP);
    return noShadow(geo);
  });
  // A door leaf, `side` -1 or 1, centred on its own origin: charcoal, the wall's low strip running across it at the
  // same height and a row of chain links meeting its partner's at the seam, all on the face toward the room (-z).
  const leaf = (side) => {
    const W = DOOR.halfW, D = DOOR.height, geo = box({ w: W, h: D, d: 0.08, color: C.wall, offset: { y: D / 2 } }), IN = [0, 0, -1], z = -0.045;
    quad(geo, [-W / 2, 0.9, z], [W / 2, 0.9, z], [W / 2, 0.95, z], [-W / 2, 0.95, z], C.amber, 1, IN);
    for (let k = 0; k < 3; k++) {
      const x0 = side < 0 ? W / 2 - 0.08 - k * 0.42 : -W / 2 + 0.08 + k * 0.42, x1 = x0 + side * 0.3;
      quad(geo, [Math.min(x0, x1), 1.62, z], [Math.max(x0, x1), 1.62, z], [Math.max(x0, x1), 1.78, z], [Math.min(x0, x1), 1.78, z], C.amber, 0.7, IN);
    }
    // The leading edge, dark, so the seam shows as a line.
    const e = side < 0 ? W / 2 : -W / 2;
    quad(geo, [e - 0.015, 0, z - 0.001], [e + 0.015, 0, z - 0.001], [e + 0.015, D, z - 0.001], [e - 0.015, D, z - 0.001], C.leg, 0, IN);
    return geo;
  };
  const leaves = [leaf(-1), leaf(1)];
  // The Exit button's plate, its amber face and the play mark on it, facing -z.
  const button = (() => {
    const geo = merge(box({ w: 0.38, h: 0.38, d: 0.06, color: C.pilaster }), box({ w: 0.28, h: 0.28, d: 0.02, color: C.amber, emissive: 0.85, offset: { z: -0.035 } }));
    const base = geo.verts.length / 3;
    geo.verts.push(-0.06, -0.08, -0.047, -0.06, 0.08, -0.047, 0.08, 0, -0.047);
    geo.faces.push({ i: [base, base + 1, base + 2], color: hexToRgb(C.curtain), emissive: 0 });
    return geo;
  })();
  // The meeting table: a dark drum on a pedestal with an amber band and a flat ₿ inlaid in its top.
  const BITCOIN = ["00011011000", "00011011000", "01111111100", "00110000110", "00110000110", "00111111100", "00110000110", "00110000011", "00110000011", "01111111110", "00011011000", "00011011000"];
  const table = (() => {
    const geo = merge(
      lathe({ profile: [[0, 0], [0.55, 0], [0.55, 0.06], [0.2, 0.09], [0.2, 0.42], [1.1, 0.44], [1.1, 0.56], [0, 0.56]], segments: 32, color: C.seat }),
      ring({ r: 1.11, thickness: 0.03, y: 0.5, segments: 32, color: C.amber, emissive: 0.8 })
    );
    const cell = 0.07, top = 0.563;
    BITCOIN.forEach((row, r) => [...row].forEach((on, c) => {
      if (on !== "1") return;
      const x0 = (c - 5.5) * cell, z0 = (r - 6) * cell;
      quad(geo, [x0, top, z0], [x0 + cell, top, z0], [x0 + cell, top, z0 + cell], [x0, top, z0 + cell], C.amber, 0.75, UP);
    }));
    return geo;
  })();
  // A blocky lounge chair, its front toward +z.
  const chair = merge(
    box({ w: 0.86, h: 0.36, d: 0.82, color: C.seat, offset: { y: 0.18 } }),
    box({ w: 0.7, h: 0.1, d: 0.64, color: C.cushion, offset: { y: 0.41, z: 0.04 } }),
    box({ w: 0.86, h: 0.8, d: 0.2, color: C.seat, offset: { y: 0.76, z: -0.31 } }),
    ...[-1, 1].map((side) => box({ w: 0.14, h: 0.26, d: 0.74, color: C.cushion, offset: { x: side * 0.36, y: 0.49 } })),
    box({ w: 0.6, h: 0.03, d: 0.03, color: C.amber, emissive: 0.6, offset: { y: 0.04, z: 0.42 } })
  );
  // The holdings desk with its terminal, front toward +z; the terminal's picture hangs at `screen`.
  const desk = merge(
    box({ w: 2, h: 0.06, d: 0.8, color: C.desk, offset: { y: 0.76 } }),
    ...[-1, 1].map((side) => box({ w: 0.06, h: 0.73, d: 0.72, color: C.leg, offset: { x: side * 0.93, y: 0.365 } })),
    box({ w: 0.12, h: 0.32, d: 0.12, color: C.leg, offset: { y: 0.95, z: -0.2 } }),
    box({ w: 1.24, h: 0.8, d: 0.07, color: C.bezel, offset: { y: 1.48, z: -0.2 } }),
    box({ w: 0.9, h: 0.03, d: 0.26, color: C.leg, offset: { y: 0.8, z: 0.12 } }),
    box({ w: 1.9, h: 0.02, d: 0.02, color: C.amber, emissive: 0.6, offset: { y: 0.735, z: 0.4 } })
  );
  const DESK_SCREEN = { y: 1.48, z: -0.16, w: 1.1, h: 0.68 };
  // Sani's recliner (base, swivelling seat, back) and his laptop, as the old sphere had them, in the room's colours.
  const reclinerBase = merge(box({ w: 1.35, h: 0.12, d: 1.1, color: C.leg, offset: { y: 0.12 } }), box({ w: 0.22, h: 0.55, d: 0.22, color: C.pilaster, offset: { y: 0.38 } }));
  const reclinerSeat = merge(
    box({ w: 1.24, h: 0.22, d: 0.95, color: C.seat, offset: { y: 0.68 } }),
    box({ w: 1.04, h: 0.14, d: 0.85, color: C.cushion, offset: { y: 0.81 } }),
    box({ w: 1.08, h: 0.15, d: 0.4, color: C.cushion, offset: { y: 0.64, z: 0.52 } }),
    ...[-0.63, 0.63].map((x) => box({ w: 0.18, h: 0.18, d: 1.05, color: C.seat, offset: { x, y: 1.08 } }))
  );
  const reclinerBack = merge(
    box({ w: 1.25, h: 1.25, d: 0.22, color: C.seat, offset: { y: 0.58 } }),
    box({ w: 1.05, h: 0.9, d: 0.17, color: C.cushion, offset: { y: 0.55, z: 0.15 } }),
    box({ w: 0.72, h: 0.06, d: 0.25, color: C.amber, emissive: 0.6, offset: { y: 1.07, z: 0.16 } })
  );
  const laptopBase = (() => {
    const parts = [box({ w: 1.04, h: 0.065, d: 0.65, color: "#3a3a40" })];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 9; col++) parts.push(box({ w: 0.075, h: 0.015, d: 0.065, color: C.leg, offset: { x: (col - 4) * 0.1, y: 0.042, z: 0.06 + row * 0.08 } }));
    return merge(...parts);
  })();
  const laptopLid = merge(
    box({ w: 1.04, h: 0.47, d: 0.055, color: "#3a3a40", offset: { y: 0.22 } }),
    box({ w: 0.94, h: 0.39, d: 0.015, color: "#0f1a12", emissive: 0.45, offset: { y: 0.23, z: -0.036 } }),
    ...[0, 1, 2, 3].map((i) => box({ w: 0.28 + (i % 3) * 0.13, h: 0.025, d: 0.01, color: i % 2 ? "#3ddc84" : "#f7931a", emissive: 0.85, offset: { x: -0.14, y: 0.34 - i * 0.075, z: -0.05 } }))
  );

  // A picture on a quad `w` by `h` about the origin, facing +z, from a decoded image `image` of `width` by `height`.
  const picture = (image, width, height, w, h) => {
    const geo = { verts: [-w / 2, -h / 2, 0, w / 2, -h / 2, 0, w / 2, h / 2, 0, -w / 2, h / 2, 0], faces: [{ i: [0, 1, 2, 3], color: [0, 0, 0], emissive: 0 }], lines: [], castShadow: false };
    geo.imageSurface = { asset: { width, height, load: () => image }, rect: [-w / 2, -h / 2, w, h] };
    return geo;
  };

  // One room's nodes at `scale`. The screens', cards', terminal's and signs' nodes come empty: the scene hangs their
  // pictures. The lounge carries what timechain-beer.js drives (`node`, `chair`, `swivel`, `place`, `station`, `walk`).
  const build = (scale) => {
    const L = ROOMS.layout(scale), root = createNode(), s = scale;
    addChild(root, createNode({ geometry: hall(scale) }), createNode({ geometry: glow(scale), sightHidden: true }),
      createNode({ geometry: vestibule(scale) }), createNode({ geometry: vestibuleGlow(scale), sightHidden: true }));
    const doors = [-1, 1].map((side) => createNode({ geometry: leaves[side < 0 ? 0 : 1], position: { x: side * DOOR.halfW / 2, y: 0, z: L.doorZ + 0.06 } }));
    addChild(root, ...doors);
    const facingIn = (p) => createNode({ position: { x: p.x, y: p.y, z: p.z }, rotation: { x: 0, y: -p.angle, z: 0 } });
    const screens = L.screens.map(facingIn), cards = L.ribbon.map(facingIn);
    addChild(root, ...screens, ...cards);
    const E = L.exitButton;
    // The button is built facing -z, into the room; the signs' pictures face +z and turn round to it.
    const exitButton = createNode({ geometry: button, position: { x: E.x, y: E.y, z: E.z } });
    // Signs on the bay: EXIT over the doorway, how to use the button under it, the room's number on the other side.
    const exitSign = createNode({ position: { x: 0, y: DOOR.height + 0.42, z: L.doorZ - 0.03 }, rotation: { x: 0, y: Math.PI, z: 0 } });
    const useSign = createNode({ position: { x: E.x, y: E.y - 0.36, z: L.doorZ - 0.03 }, rotation: { x: 0, y: Math.PI, z: 0 } });
    const roomSign = createNode({ position: { x: -E.x, y: E.y + 0.5, z: L.doorZ - 0.03 }, rotation: { x: 0, y: Math.PI, z: 0 } });
    addChild(root, exitButton, exitSign, useSign, roomSign);
    const tableNode = createNode({ geometry: table, position: { x: L.table.x, y: 0, z: L.table.z } });
    const chairs = L.chairs.map((c) => createNode({ geometry: chair, position: { x: c.x, y: 0, z: c.z }, rotation: { x: 0, y: c.heading, z: 0 } }));
    const deskNode = createNode({ geometry: desk, position: { x: L.desk.x, y: 0, z: L.desk.z }, rotation: { x: 0, y: L.desk.heading, z: 0 } });
    const terminal = createNode({ position: { x: 0, y: DESK_SCREEN.y, z: DESK_SCREEN.z } });
    addChild(deskNode, terminal);
    addChild(root, tableNode, ...chairs, deskNode);
    // Sani's corner, in the frame timechain-beer.js expects: the recliner 1.8 m along +z from its origin.
    const lounge = createNode({ position: { x: L.lounge.x, y: 0, z: L.lounge.z } });
    const reclinerNode = createNode({ geometry: reclinerBase, position: { x: 0, y: 0, z: 1.8 } });
    const swivel = createNode({ geometry: reclinerSeat, rotation: { x: 0, y: Math.PI, z: 0 } });
    const back = createNode({ geometry: reclinerBack, position: { x: 0, y: 0.82, z: -0.44 }, rotation: { x: -0.23, y: 0, z: 0 } });
    const laptop = createNode({ geometry: laptopBase, position: { x: 0, y: 1, z: 0.58 } });
    addChild(laptop, createNode({ geometry: laptopLid, position: { x: 0, y: 0.035, z: 0.3 }, rotation: { x: 0.14, y: 0, z: 0 } }));
    addChild(swivel, back, laptop);
    addChild(reclinerNode, swivel);
    addChild(lounge, reclinerNode);
    addChild(root, lounge);
    // Point lights, the fixed ones first: warm over the table and the corners, the screens' wash, the vestibule.
    const lights = [
      [0, L.wall - 0.4, 0, 9 * s, 0.95, 0.62, 0.3],
      [0, L.screens[0].y, -L.radius * 0.62, 10 * s, 0.75, 0.48, 0.2],
      [L.desk.x * 0.8, 3 * s, L.desk.z, 6 * s, 0.6, 0.42, 0.22],
      [L.beer.chair.x, 3 * s, L.beer.chair.z, 6 * s, 0.6, 0.42, 0.22],
      [0, 2.6, L.doorZ - 1.6, 6, 0.7, 0.46, 0.2],
      [0, DOOR.height - 0.4, L.doorZ + DOOR.vestibule * 0.5, 3.2, 0.32, 0.2, 0.08]
    ];
    return {
      root, layout: L, doors, screens, cards, exitButton, exitSign, useSign, roomSign, terminal, table: tableNode, chairs, desk: deskNode, lights,
      lounge: { node: lounge, chair: reclinerNode, swivel, laptop, place: { x: L.lounge.x, y: 0, z: L.lounge.z, ry: 0 }, station: L.beer.station, walk: L.beer.walk }
    };
  };
  // Every geometry a room of this size draws, for the scene's live set and for releasing a preview.
  const geometries = (scale) => [hall(scale), glow(scale), vestibule(scale), vestibuleGlow(scale), ...leaves, button, table, chair, desk, reclinerBase, reclinerSeat, reclinerBack, laptopBase, laptopLid];
  BL.timechainRoomModels = { build, picture, geometries, DESK_SCREEN, COLORS: C };
})();
