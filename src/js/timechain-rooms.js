// The Timechain Sphere's nine rooms: one interior design at three sizes, each number its own place. A room is an
// integer `id` 1–9, validated wherever one comes in (`parse`): the keypad, a route, a history entry, a stored visit.
// Rooms 1–3 are built at 1×, 4–6 at 1.5× and 7–9 at 2×: the architecture (radius, wall height, screens) scales,
// while the doorway, the arrival, the Exit button, the furniture and everything a body touches keep human size.
// Signed in, a room's zone (`sphere-<id>`, never a dotted name, which would fold every room into one voice group)
// is who is seen and heard there; a solo visit uses the same design and joins nothing.
//
// `layout(scale)` is pure numbers in the room's own frame: the floor's middle at the origin, the screens toward -z,
// the one doorway centred on +z opposite them, so whoever comes in faces the middle of the screens with the wall of
// them wrapping as far to the left as to the right. Loadable in Node for the suite.
(() => {
  "use strict";
  const BL = window.BL = window.BL || {};
  const COUNT = 9, SCALES = [1, 1.5, 2], GROUPS = ["1–3", "4–6", "7–9"];
  const EXTERIOR_ZONE = "sphere";
  // The 1× room, and the parts that keep their size in every room: a doorway in a flat bay of the wall, the
  // vestibule behind it, and the Exit button beside it at hand height.
  const BASE = { radius: 9, wall: 5.4, screenBottom: 1.3, screenW: 3, screenH: 2, screenGap: 0.25, ribbonGap: 0.35, ribbonH: 0.72 };
  const DOOR = { halfW: 1.5, height: 3.2, bay: 2.7, vestibule: 2.6, frame: 0.18 };
  const SCREENS = 6, RIBBON = 16, BODY = 0.3;
  // The floor's pattern keeps its physical size in every room, so a bigger room only adds tiles and links: square
  // tiles with one column and one row centred on the axes, and the amber chain exactly one tile wide, one link a
  // tile long, a dark square in each link and notches at each joint. The ring of links round the meeting area runs
  // just outside the chairs, and its dark middle under them.
  const FLOOR = { tile: 0.8, hole: 0.24, notch: 0.12, joint: 0.12, ringIn: 2.62, ringOut: 3.32, ringLinks: 24, ringHole: 0.2 };
  // The dome: a quarter ellipse from the wall's top to a crown `rise` × the radius higher, in bands from the foot
  // (`f`, a fraction of the quarter turn): plain panels, two amber rings and the oculus, then a dark cap. Sixteen ribs
  // meet at the crown. A cornice round its foot covers the join with the wall.
  const DOME = {
    rise: 0.62, sectors: 16, rib: 1.5 * Math.PI / 180, panels: 3,
    bands: [[0, 0.065, "panel"], [0.065, 0.078, "strip"], [0.078, 0.15, "panel"], [0.15, 0.225, "panel"], [0.225, 0.3, "panel"], [0.3, 0.312, "strip"],
      [0.312, 0.39, "panel"], [0.39, 0.47, "panel"], [0.47, 0.55, "panel"], [0.55, 0.63, "panel"], [0.63, 0.71, "panel"], [0.71, 0.79, "panel"],
      [0.79, 0.88, "panel"], [0.88, 0.9, "oculus"], [0.9, 1, "cap"]],
    cornice: { depth: 0.3, below: 0.15, above: 0.25 }
  };
  const ROOMS = Object.freeze(Array.from({ length: COUNT }, (_, i) => Object.freeze({
    id: i + 1, zone: `sphere-${i + 1}`, scale: SCALES[Math.floor(i / 3)], group: GROUPS[Math.floor(i / 3)], name: `Room ${i + 1}`, ambience: "datahall"
  })));
  // A room id from whatever a boundary hands in: an integer 1–9 or its one-digit string. Anything else is null.
  const parse = (value) => {
    if (typeof value === "number") return Number.isInteger(value) && value >= 1 && value <= COUNT ? value : null;
    return typeof value === "string" && /^[1-9]$/.test(value) ? Number(value) : null;
  };
  const get = (value) => {
    const id = parse(value);
    return id ? ROOMS[id - 1] : null;
  };
  const layouts = new Map();
  const layout = (scale) => {
    if (!SCALES.includes(scale)) throw new Error(`No Timechain room at scale ${scale}`);
    if (layouts.has(scale)) return layouts.get(scale);
    const s = scale, R = BASE.radius * s, H = BASE.wall * s;
    // The doorway's bay is a flat chord of the round wall; the door's plane is that chord's.
    const doorZ = Math.sqrt(R * R - DOOR.bay * DOOR.bay);
    // The screens stand just in from the wall, square to the middle, three each side of the axis.
    const screenR = R - 0.3 * s, w = BASE.screenW * s, h = BASE.screenH * s, bottom = BASE.screenBottom * s;
    const step = (w + BASE.screenGap * s) / screenR;
    const screens = Array.from({ length: SCREENS }, (_, i) => {
      const a = (i - (SCREENS - 1) / 2) * step;
      return { angle: a, x: screenR * Math.sin(a), z: -screenR * Math.cos(a), y: bottom + h / 2, w, h };
    });
    // The latest-blocks ribbon over them, the label first on the left, spanning the same arc.
    const ribbonY = bottom + h + BASE.ribbonGap * s + BASE.ribbonH * s / 2, slot = SCREENS * step / RIBBON;
    const ribbon = Array.from({ length: RIBBON }, (_, i) => {
      const a = (i - (RIBBON - 1) / 2) * slot;
      return { angle: a, x: screenR * Math.sin(a), z: -screenR * Math.cos(a), y: ribbonY, w: slot * screenR - 0.08 * s, h: BASE.ribbonH * s };
    });
    // Furniture keeps its size and spreads with the room: the meeting table stays in the middle, the holdings desk
    // and Sani's corner move out toward their walls.
    const table = { x: 0, z: 0, r: 1.15 };
    // Four chairs round it on the diagonals, each facing the table, which leaves the walk from the door clear.
    const chairs = [0.25, 0.75, 1.25, 1.75].map((k) => {
      const a = k * Math.PI;
      return { x: Math.sin(a) * 2.1, z: -Math.cos(a) * 2.1, heading: -a };
    });
    // Sani's corner, the same setup in every room: the beer dispenser, the glass cabinet and the bin in a row along
    // the right-hand wall (+x, as one faces the screens), square to it and as far out as the curve lets the row's
    // ends stand, and his recliner 2.5 m in front of it, a little toward the door, facing the screens. Only its
    // distance from the middle changes with the room.
    const gearX = Math.sqrt((R - 0.2) * (R - 0.2) - 3.05 * 3.05) - 0.35, station = 2.5;
    const lounge = { x: gearX - station, z: 0 };
    const beer = { station, walk: station - 0.9, chair: { x: lounge.x, z: lounge.z + 1.8 } };
    // The floor's chain: from the doorway's middle down the axis to the ring round the meeting area, and from the
    // ring out to either side, ending on a tile's edge just short of Sani's dispenser and, mirrored, the holdings
    // desk against the left-hand wall.
    const T = FLOOR.tile, arm = Math.floor((gearX - 0.45 - T / 2) / T) * T + T / 2;
    const floor = { ...FLOOR, door: doorZ, arm };
    const desk = { x: -(arm + 0.4), z: 0, heading: Math.PI / 2 };
    // The dome's profile, from the wall's top inward, as built in flat facets: [r, y] pairs at every band's edge.
    const rise = DOME.rise * R, profile = [];
    for (const [f] of DOME.bands) profile.push(R * Math.cos(f * Math.PI / 2), H + rise * Math.sin(f * Math.PI / 2));
    profile.push(0, H + rise);
    const facet = Math.max(DOME.rib, (2 * Math.PI / DOME.sectors - DOME.rib) / DOME.panels);
    const dome = { ...DOME, rise, crown: H + rise, profile, chord: Math.cos(facet / 2), cornice: { depth: DOME.cornice.depth * s, below: DOME.cornice.below * s, above: DOME.cornice.above * s } };
    // What a body cannot walk through, in the room's frame (circles and axis-aligned boxes).
    const solids = [
      { x: table.x, z: table.z, r: table.r + 0.05 },
      ...chairs.map((c) => ({ x: c.x, z: c.z, r: 0.48 })),
      { x: desk.x, z: desk.z, hx: 0.5, hz: 1 },
      { x: beer.chair.x, z: beer.chair.z, r: 0.8 },
      ...[-2.2, 0, 2.2].map((z) => ({ x: gearX, z: lounge.z + z, hx: 0.5, hz: 0.82 }))
    ];
    const value = Object.freeze({
      scale, radius: R, wall: H, doorZ, door: DOOR, screens, ribbon, table, chairs, desk, lounge, beer, solids, dome, floor,
      // Where a guided arrival begins (in the vestibule, behind the door) and ends, facing the screens; the Exit
      // button on the bay to the right of the doorway as one faces it, and where Space reaches it from.
      threshold: { x: 0, z: doorZ + DOOR.vestibule * 0.55 },
      arrival: { x: 0, z: doorZ - 2.4, heading: Math.PI },
      exitButton: { x: -(DOOR.halfW + 0.72), y: 1.2, z: doorZ - 0.07 },
      exitReach: 2.2,
      // The walk out stops at the door's foot, square to it, before the doors part.
      doorStep: { x: 0, z: doorZ - 0.9 },
      walkRadius: R - 0.35
    });
    layouts.set(scale, value);
    return value;
  };
  // Whether a body of `radius` may stand at (x, z): inside the round wall and short of the closed door's bay, clear
  // of the furniture. `door` opens the doorway and its vestibule to the guided walk alone.
  const clearAt = (L, x, z, radius = BODY, door = false) => {
    const r = radius;
    if (door && Math.abs(x) < DOOR.halfW - r && z >= L.doorZ - 0.6 && z <= L.doorZ + DOOR.vestibule - r) return true;
    if (Math.hypot(x, z) > L.walkRadius - r || z > L.doorZ - 0.12 - r) return false;
    for (const o of L.solids) {
      if (o.r !== undefined) { if (Math.hypot(x - o.x, z - o.z) < o.r + r) return false; }
      else if (Math.abs(x - o.x) < o.hx + r && Math.abs(z - o.z) < o.hz + r) return false;
    }
    return true;
  };
  // The height of the ceiling over (x, z): the dome's inner face as its flat facets lie (a little inside the true
  // curve, so never above what is drawn), or the cornice's underside round its foot.
  const ceilingAt = (L, x, z) => {
    const D = L.dome, P = D.profile, r = Math.hypot(x, z) / D.chord;
    if (r >= L.radius - D.cornice.depth) return L.wall - D.cornice.below;
    for (let k = 2; k < P.length; k += 2) {
      if (r >= P[k]) return P[k + 1] + (P[k - 1] - P[k + 1]) * (r - P[k]) / (P[k - 2] - P[k]);
    }
    return D.crown;
  };
  BL.timechainRooms = { COUNT, SCALES, ROOMS, EXTERIOR_ZONE, DOOR, SCREENS, RIBBON, FLOOR, parse, get, layout, clearAt, ceilingAt };
})();
