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
    const desk = { x: -4.7 * s, z: -0.7 * s, heading: Math.PI / 2 };
    // Sani's corner: his recliner and, along the wall behind it, the beer dispenser, the glass cabinet and the bin.
    const lounge = { x: 2.4 * s, z: 1.2 * s };
    const reach = Math.abs(lounge.z) + 2.2;
    const station = Math.sqrt(R * R - reach * reach) - 1 - lounge.x;
    const beer = { station, walk: station - 2, chair: { x: lounge.x, z: lounge.z + 1.8 } };
    // What a body cannot walk through, in the room's frame (circles and axis-aligned boxes).
    const solids = [
      { x: table.x, z: table.z, r: table.r + 0.05 },
      ...chairs.map((c) => ({ x: c.x, z: c.z, r: 0.48 })),
      { x: desk.x, z: desk.z, hx: 0.5, hz: 1 },
      { x: beer.chair.x, z: beer.chair.z, r: 0.8 },
      ...[-2.2, 0, 2.2].map((z) => ({ x: lounge.x + station, z: lounge.z + z, hx: 0.62, hz: 0.82 }))
    ];
    const value = Object.freeze({
      scale, radius: R, wall: H, ceiling: H + 1.6 * s, doorZ, door: DOOR, screens, ribbon, table, chairs, desk, lounge, beer, solids,
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
  BL.timechainRooms = { COUNT, SCALES, ROOMS, EXTERIOR_ZONE, DOOR, SCREENS, RIBBON, parse, get, layout, clearAt };
})();
