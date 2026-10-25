// The Lightning Jet Hangar, behind the Lightning Factory's door at the end of its left walkway (`hangar-models.js` has
// the hall): the landing inside the door, the runway down the middle and on through the launch tunnel's neon frames to
// the launch shield, sealed until Jet v2 flies, with the island's own sky beyond it; the Jet docked beside the runway
// (`jet-models.js`) with a stair tower up its flank; the crew's workstations, and the repository's two boards on the
// wall. The crew are the Factory's own, gorillas in hard hats, each pacing its post.
// Until the hangar opens the scene stays `wip`, and the Factory builds no door to it (`FM.hangarEntry`) unless a page
// opens it with ?wip=hangar.
//
// Whoever walked in stays themselves: the Ooga the hall handed over (`world.pilot`), or on a page that opens here,
// `character=`. It stands on the landing a step in from the door, looking down the runway. Walking back out through the
// door's shield, Escape and the Leave button all take it back to the hall, onto the walkway at the door. The hangar is a
// room of the Factory: its voice zone is in the Factory's group, so players here and in the hall hear each other.
//
// The sky through the tunnel is the island's: the hub's clock samples it every frame, and only its sky (gradient, sun,
// moon and stars) is taken, the hall keeping its own warm light.
(() => {
  "use strict";
  const BL = window.BL = window.BL || {};
  const { math, models, contributors, daylight, hud: hudMod, interact: interactMod, pilot: pilotMod, fx: fxMod } = BL;
  const FM = BL.factoryModels, HM = BL.hangarModels, JM = BL.jetModels;
  const { clamp } = math;
  const { createNode, addChild, removeChild, createCamera, stepTweens, tweenCount, traverseVisible } = BL.scene;
  const { LAYOUT } = HM, { HALL } = LAYOUT, DOOR = LAYOUT.door, TUN = LAYOUT.tunnel;

  const params = new URLSearchParams(location.search), DEBUG = params.has("debug");
  // The Jet's construction stage: the one it has reached, or under debug the one `jetstage=` asks for.
  const JET_STAGE = DEBUG && JM.STAGES[params.get("jetstage")] ? Number(params.get("jetstage")) : JM.STAGE;
  const COARSE = window.matchMedia("(pointer: coarse)").matches;
  const PITCH = [-0.2, 1.3], DIST = [3, 30];
  const FOLLOW = { y: 0.9, min: 3, max: 7, pitch: [0.25, 0.8] };
  const FLY = { speed: 6, perDist: 0.4, climb: 4, yMax: HALL.h - 3 };
  // The door's shield, as wide as its arch, in the hall's cyan; and the launch shield across the tunnel's end, in a
  // paler blue.
  const OPENING = { minX: -DOOR.half, maxX: DOOR.half, floorY: 0, ceilingY: DOOR.top }, TINT = BL.factoryWindow.TINT;
  const LAUNCH = { minX: -TUN.r + 0.6, maxX: TUN.r - 0.6, floorY: 0, ceilingY: TUN.y + TUN.r - 0.8 }, LAUNCH_TINT = [0.45, 0.72, 1];
  const view = (x, y, z, yaw, pitch, dist) => ({ yaw, pitch, dist, target: { x, y, z } });
  // `entrance` stands over the landing and looks down the runway to the tunnel's mouth, as the concept's entry view.
  const PRESETS = {
    entrance: view(0, 3.5, 6, 0, 0.1, 20),
    runway: view(0, 4.5, -62, 0, 0.05, 18),
    // The Jet from behind its tail, the concept's own angle, the tunnel beyond its nose.
    jet: view(LAYOUT.jet.x - 2, 5, LAYOUT.jet.z, -0.5, 0.16, 27),
    boards: view(HALL.x0 + 5.5, 4.5, 8, Math.PI / 2 - 0.35, 0.05, 12),
    door: view(0, 3.2, DOOR.z - 4, Math.PI, 0.12, 11)
  };
  // In from the hall: on the landing a step in from the door, facing down the runway, the view in the doorway behind it.
  const ARRIVAL = { position: { x: 0, y: DOOR.y, z: DOOR.z - 3.4 }, target: { x: 0, y: DOOR.y + 1, z: DOOR.z - 3.4 }, yaw: 0, pitch: 0.12, dist: 2.8 };
  // The hall's own light, warm, with the island's sky through the tunnel written into it each frame (`skyFrom`).
  const RENDER_OPTS = {
    clear: [0.05, 0.05, 0.07], sky: [0.54, 0.38, 0.26], ground: [0.24, 0.16, 0.1],
    direct: [0.7, 0.52, 0.36], directStrength: 0.36, ambientFloor: 0.4, light: { x: 0.25, y: 0.9, z: 0.35 },
    horizon: new Float32Array(3), zenith: new Float32Array(3), sun: new Float32Array(3), sunDirection: { x: 0, y: 1, z: 0 },
    moon: { x: 0, y: 1, z: 0 }, moonSun: { x: 0, y: -1, z: 0 }, starMatrix: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), stars: 0,
    clouds: 0.45, sea: -140, shadowCenter: { x: 2.5, y: 6, z: -2 }, shadowExtent: 42,
    lights: new Float32Array(BL.glRenderer.POINT_LIGHT_CAPACITY * 8), lightCount: 0, bloomStrength: 1
  };
  // What the clock writes, as Ooga Drop keeps it; the hangar takes its sky from it.
  const SKY = {
    clear: new Float32Array(3), horizon: new Float32Array(3), zenith: new Float32Array(3), sky: new Float32Array(3), ground: new Float32Array(3), sun: new Float32Array(3), direct: new Float32Array(3),
    light: { x: 0.55, y: 0.78, z: -0.25 }, sunDirection: { x: 0, y: 1, z: 0 }, moon: { x: 0, y: 1, z: 0 }, moonSun: { x: 0, y: -1, z: 0 }, starMatrix: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
    stars: 0, torch: 0, day: 1, twilight: 0, lampFactor: 0, directStrength: 1, sunStrength: 1, moonStrength: 0, ambientFloor: 0.18, diffuseFloor: 0, shadowStrength: 1, shadowFloor: 0, shadowBias: 0.002, time: 0
  };
  const copy3 = (a, b) => { a.x = b.x; a.y = b.y; a.z = b.z; };
  const skyFrom = (clock) => {
    daylight.sample(clock.read(), SKY, clock.dayOfYear, daylight.ISLAND_LATITUDE_DEG, clock.continuousDay, clock.utcMs);
    RENDER_OPTS.horizon.set(SKY.horizon); RENDER_OPTS.zenith.set(SKY.zenith); RENDER_OPTS.sun.set(SKY.sun);
    copy3(RENDER_OPTS.sunDirection, SKY.sunDirection); copy3(RENDER_OPTS.moon, SKY.moon); copy3(RENDER_OPTS.moonSun, SKY.moonSun);
    RENDER_OPTS.starMatrix.set(SKY.starMatrix);
    RENDER_OPTS.stars = SKY.stars;
  };
  const TIPS = {
    exit: ["Lightning Factory · the way back", "Back to the hall, onto the walkway to the balcony."],
    sign: ["Lightning Jet Hangar", "Where Lightning Jet v2 is being built, and where it will launch from."],
    mouth: ["Launch tunnel · sealed", "The runway opens when Jet v2 is ready to fly."],
    jet: ["Lightning Jet v2 · under construction", "The Jet is still being built. Its stair leads up to the cockpit."],
    stats: ["Repo stats · drneski/lightning-jet", "The project's GitHub stats show here, fetched once as you come in."],
    timeline: ["Lightning Jet timeline", "The project's story, dated from its repository, shows here: its first release, every one since, and v2 ahead."],
    station: ["Crew workstations", "Where the crew follows the Jet's build."]
  };
  // How near the hold-short bar the launch shield answers whoever walks up to it, and how far back they must step before
  // it answers again.
  const SHIELD_NEAR = 0.6, SHIELD_REARM = 3;

  let renderer, game, world, go, root, camera, hud, hooks, input, pilot, fx, agentPlay = null, clock = null;
  let people = null, avatar = null, playerWorld = null, scene = null, leaving = false, dust = null, unsubscribeAccount = null, remotes = null, footsteps = null, node = null;
  const NO_ACTORS = [];
  // On the Worker's page the island's driving rules hold in here too, and the Ooga driven is reported to the room every
  // frame, so signed-in players in the hangar hear each other and those in the hall (voice needs a driven Ooga).
  const mayPossess = (cave) => BL.net.mayDrive(cave.traits.name);
  const accountChanged = () => {
    if (!avatar) return;
    const released = BL.net.state.released;
    const denied = mayPossess(avatar) || (released && released.name === avatar.traits.name ? "That Ooga is no longer yours to drive" : null);
    BL.net.state.released = null;
    if (denied && people.player === avatar) {
      pilot.release(true);
      hud.toast(denied);
    }
  };
  const targets = [];

  // Back to the hall as the same Ooga, onto the walkway at the door, nothing held or hovered here carried out.
  const leaveHangar = () => {
    if (leaving) return;
    world.pilotDetached = !pilot.player;
    world.pilot = pilot.player ? pilot.player.traits.name : null;
    if (!go("factory")) return;
    leaving = true;
    pilot.controls.reset(); input.reset(); pilot.setActive(false); hud.tooltip.hide();
  };
  const onKey = (e) => {
    if (e.key === "0" && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && !leaving) return pilot.resetCamera();
    if ((e.key === "x" || e.key === "X") && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && !leaving) {
      if (pilot.modeAction("mode-toggle")) { e.preventDefault(); return true; }
    }
    if (e.key === "Escape") {
      if (!pilot.escape()) leaveHangar();
      return true;
    }
    return false;
  };
  // In real mode `counted` is the API's `{ exact, rounded }`, which the tally counts (the pile itself follows the API's).
  const onDonation = (donation, counted = null) => {
    game.recordDonation(donation, counted && counted.exact);
    world.level = Math.min(BL.pile.MAX_BANANAS, world.level + (counted ? counted.exact : BL.game.bananasFor(donation.sats)));
  };
  const onLootCleared = () => {};

  // A label at (x, y, z) facing `turn`, its board behind its face.
  const sign = (parent, l, x, y, z, turn = 0) => {
    const n = createNode({ position: { x, y, z }, rotation: { x: 0, y: turn, z: 0 }, geometry: l.back });
    addChild(n, createNode({ geometry: l.face }));
    addChild(parent, n);
    return n;
  };

  // The hangar for a visit: the hall and everything standing in it from the cached builds, the signs, the boards'
  // frames, the Jet at its dock, the door back to the hall with its shield, and the launch shield.
  const build = () => {
    const L = LAYOUT, s = { crew: [] }, shell = HM.shell(), runway = HM.runway(), tunnel = HM.tunnel(), dressed = HM.dressing(), fixtures = HM.fixtures(), frames = HM.boardFrames();
    addChild(root, createNode({ geometry: shell.rock }), createNode({ geometry: shell.vault }), createNode({ geometry: shell.backing }),
      createNode({ geometry: HM.landing() }), createNode({ geometry: runway.flat }), createNode({ geometry: runway.glow, sightHidden: true }),
      createNode({ geometry: tunnel.stone }), createNode({ geometry: tunnel.glow, sightHidden: true }), createNode({ geometry: HM.isle(), sightHidden: true }),
      createNode({ geometry: HM.catwalks() }), createNode({ geometry: dressed.iron }), createNode({ geometry: dressed.banners }),
      createNode({ geometry: dressed.frame }), createNode({ geometry: dressed.glass, sightHidden: true }), createNode({ geometry: fixtures.glow, sightHidden: true }),
      createNode({ geometry: fixtures.frame }), createNode({ geometry: fixtures.glass, sightHidden: true }), createNode({ geometry: HM.dock() }));
    s.mouth = createNode({ geometry: tunnel.iron });
    s.fixtures = createNode({ geometry: fixtures.flat });
    addChild(root, s.mouth, s.fixtures);
    // The Jet at its dock, nose to the tunnel, as far built as its stage.
    s.jet = createNode({ position: { x: L.jet.x, y: 0, z: L.jet.z }, geometry: JM.jet(JET_STAGE) });
    addChild(root, s.jet);
    // The boards' frames on the left wall, each with its title across its top and its screen dark until its face is painted.
    s.boards = {};
    for (const [key, b] of Object.entries(L.boards)) {
      const n = createNode({ position: { x: b.x, y: b.y, z: b.z }, rotation: { x: 0, y: b.turn, z: 0 }, geometry: frames[key].flat });
      addChild(n, createNode({ geometry: frames[key].glow, sightHidden: true }));
      sign(n, FM.label(key === "stats" ? "drneski/lightning-jet" : "LIGHTNING JET TIMELINE", "", { height: 0.9 }), 0, b.h / 2 - 0.42, 0.06);
      const dark = models.box({ w: b.w, h: b.h, d: 0.04, color: "#0b1734", emissive: 0.6 });
      addChild(n, createNode({ geometry: dark, sightHidden: true }));
      addChild(root, n);
      s.boards[key] = n;
    }
    // The signs: the hangar's over the runway between two lit bolts, hung from the last gantry on two rods; the right
    // wall's call to work; and the plaque by the runway at the Jet's tail, on its post.
    const [hx, hy, hz] = L.signs.hangar, hangarSign = FM.label("LIGHTNING JET\nHANGAR", "", { height: 1.7 });
    s.sign = sign(root, hangarSign, hx, hy, hz);
    for (const side of [-1, 1]) {
      addChild(root, createNode({ position: { x: hx + side * (hangarSign.width / 2 + 0.6), y: hy, z: hz + 0.05 }, geometry: FM.smoothBolt(1.2, 0.1, "#ffd23a", 1), sightHidden: true }));
      addChild(root, createNode({ position: { x: hx + side * (hangarSign.width / 2 - 0.3), y: (hy + L.gantryY) / 2 + 0.4, z: hz - 0.05 }, geometry: models.box({ w: 0.06, h: L.gantryY - hy - 1.2, d: 0.06, color: "#2c2e33" }) }));
    }
    const [wx, wy, wz] = L.signs.work;
    sign(root, FM.label("WORK\nBUILD\nTEST\nLAUNCH", "", { height: 1.6, style: "jet" }), wx, wy, wz, -Math.PI / 2);
    const [px, py, pz] = L.signs.soon;
    sign(root, FM.label("JET V2", "COMING SOON", { height: 0.9, style: "jet" }), px, py, pz);
    addChild(root, createNode({ position: { x: px, y: (py - 0.6) / 2, z: pz - 0.1 }, geometry: models.box({ w: 0.14, h: py - 0.6, d: 0.14, color: "#5c3a1e" }) }));
    // In the tunnel's mouth, a banner of the hangar's words either side.
    for (const side of [-1, 1]) sign(root, FM.label("LAUNCH\nEXPLORE\nCONNECT\nOOGABOOGA", "", { height: 1, style: "jet" }), side * (TUN.r - 2.2), TUN.y + 2.6, HALL.back - 0.4);
    // The door, the Factory's own turned to face in, with the hall's warm dark through it and its sign the way back.
    const door = FM.hangarDoor(), D = FM.HANGAR_DOOR;
    s.door = createNode({ position: { x: DOOR.x, y: DOOR.y, z: DOOR.z }, rotation: { x: 0, y: DOOR.turn, z: 0 } });
    s.doorStone = createNode({ geometry: door.stone });
    addChild(s.door, s.doorStone, createNode({ geometry: door.glow, sightHidden: true }), createNode({ geometry: HM.hallGlimpse(), sightHidden: true }));
    sign(s.door, FM.label("LIGHTNING\nFACTORY", "", { height: 1.3 }), D.sign[0], D.sign[1], D.sign[2]);
    addChild(root, s.door);
    s.gate = { hum: 0, phase: BL.labPhase.create(s.door, { x: DOOR.x, z: DOOR.z, ry: DOOR.turn, floorY: DOOR.y, room: { w: 4.4, h: 5, from: 0, to: 3.3 } }, OPENING, DOOR.plane, TINT) };
    // The launch shield across the tunnel's end, humming; it lets nothing through until Jet v2 flies.
    const launch = createNode({ position: { x: 0, y: 0, z: TUN.z1 } });
    addChild(root, launch);
    s.launch = { hum: 0, armed: true, phase: BL.labPhase.create(launch, { x: 0, z: TUN.z1, ry: 0, floorY: 0, room: { w: 2 * TUN.r, h: LAUNCH.ceilingY, from: 0, to: 1 } }, LAUNCH, 0, LAUNCH_TINT) };
    const target = (n, kind, preset, radius) => {
      input.add(n, { kind, preset }, { radius });
      targets.push(n);
    };
    target(s.doorStone, "exit", null, 3);
    target(s.sign, "sign", "runway", 2.5);
    target(s.mouth, "mouth", "runway", 6);
    target(s.jet, "jet", "jet", 6);
    target(s.boards.stats, "stats", "boards", 4);
    target(s.boards.timeline, "timeline", "boards", 4.5);
    target(s.fixtures, "station", null, 1.2);
    return s;
  };

  // The crew, gorillas in hard hats as the Factory's and the hangar's hi-vis vests, each pacing its post on the floor,
  // on the Jet's gangway or on a catwalk, kept to where an Ooga could walk at its height.
  const hireCrew = (s) => {
    const hat = FM.hardHat(), vest = HM.vest();
    for (const [x, y, z, radius, heading] of LAYOUT.crew) {
      const walkable = (fx, fz, nx, nz) => Math.hypot(nx - x, nz - z) < radius + 0.4 && HM.supportAt(nx, nz, y) === y && HM.clearAt(nx, nz, y, 0.3, fx, fz);
      const agent = BL.agent.create({ groundAt: () => y, walkable, form: "ape", x, z, heading, scale: 0.86 });
      addChild(agent.parts.head, createNode({ position: { x: 0, y: 0.6, z: 0.05 }, geometry: hat }));
      addChild(agent.parts.torso, createNode({ geometry: vest }));
      agent.pace(x, z, radius);
      addChild(root, agent.root);
      s.crew.push(agent);
    }
  };

  // Point lights, most important first so the lowest tier keeps them: the door's cyan, the landing, the dock's two work
  // lamps, the boards' blue, the tunnel mouth's and the launch shield's, and two warm ones over the crew's floor; the
  // lanterns share what is left, the vault's and the floor's, the nearest the view first, each reaching as far as
  // `hangar-models.js` says and flickering like a flame, as the Factory shares its own.
  const LANTERN_GLOW = [1.3, 0.8, 0.36], FIXED = 10;
  const lanternPool = models.cached(() => new Float32Array([...HM.dressing().lights, ...HM.fixtures().lights]));
  const lamp = (i, x, y, z, radius, r, g, b) => {
    const o = i * 8, l = RENDER_OPTS.lights;
    l[o] = x; l[o + 1] = y; l[o + 2] = z; l[o + 3] = radius; l[o + 4] = r; l[o + 5] = g; l[o + 6] = b; l[o + 7] = 0;
  };
  const lightUp = () => {
    const L = LAYOUT, B = L.boards;
    lamp(0, DOOR.x, DOOR.y + 2.2, DOOR.z - 2, 8, TINT[0], TINT[1], TINT[2]);
    lamp(1, 0, L.landing.y + 3, L.landing.z - 3, 12, 1, 0.66, 0.3);
    lamp(2, L.gangway.x - 2, 8, L.gangway.decks[0][1], 16, 1, 0.86, 0.62);
    lamp(3, L.jet.x - 4, 7, L.jet.z + 12, 18, 1, 0.86, 0.62);
    lamp(4, B.stats.x + 2.5, B.stats.y, B.stats.z, 9, 0.35, 0.6, 1);
    lamp(5, B.timeline.x + 2.5, B.timeline.y, B.timeline.z, 10, 0.35, 0.6, 1);
    lamp(6, 0, TUN.y, HALL.back + 3, 16, 0.3, 0.55, 1);
    lamp(7, 0, TUN.y, TUN.z1 + 4, 14, LAUNCH_TINT[0], LAUNCH_TINT[1], LAUNCH_TINT[2]);
    lamp(8, -12, 6, 12, 16, 1, 0.66, 0.32);
    lamp(9, -12, 6, -12, 16, 1, 0.66, 0.32);
    RENDER_OPTS.lightCount = Math.min(BL.glRenderer.POINT_LIGHT_CAPACITY, FIXED + lanternPool().length / 4);
  };
  let poolScore = null;
  // The shared slots go to the lanterns nearest the view, nearest first, by repeated minimum: no sort, no list.
  const glowNear = (elapsed) => {
    const P = lanternPool(), n = P.length / 4, t = pilot.orbit.target, Lt = RENDER_OPTS.lights;
    if (!poolScore) poolScore = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const dx = P[i * 4] - t.x, dy = P[i * 4 + 1] - t.y, dz = P[i * 4 + 2] - t.z;
      poolScore[i] = dx * dx + dy * dy * 2 + dz * dz;
    }
    for (let slot = FIXED; slot < RENDER_OPTS.lightCount; slot++) {
      let best = 0, bestD = Infinity;
      for (let i = 0; i < n; i++) if (poolScore[i] < bestD) { bestD = poolScore[i]; best = i; }
      poolScore[best] = Infinity;
      const k = 0.9 + Math.sin(elapsed * 9.3 + best * 1.7) * 0.06 + Math.sin(elapsed * 23.7 + best * 5.3) * 0.04, w = slot * 8;
      Lt[w] = P[best * 4]; Lt[w + 1] = P[best * 4 + 1]; Lt[w + 2] = P[best * 4 + 2]; Lt[w + 3] = P[best * 4 + 3];
      Lt[w + 4] = LANTERN_GLOW[0] * k; Lt[w + 5] = LANTERN_GLOW[1] * k; Lt[w + 6] = LANTERN_GLOW[2] * k; Lt[w + 7] = 0;
    }
  };

  const groundFor = (x, z, feet) => HM.supportAt(x, z, feet);
  const walkableFor = (ax, az, bx, bz, y, height, actor) => HM.walkable(ax, az, bx, bz, y, actor.bodyRadius || 0.35);
  // There is no banana pile in here. Space must jump even when the rifle needs ammunition.
  const reloadPolicy = { near: () => false, available: () => false };
  const clipProjectileTarget = (from, to) => {
    let clipped = scene.gate.phase.ripples.absorb(from.x, from.y, from.z, to);
    if (scene.launch.phase.ripples.absorb(from.x, from.y, from.z, to)) clipped = true;
    return clipped;
  };
  const absorbProjectile = (ax, ay, az, point, dt) => {
    const bx = point.x, by = point.y, bz = point.z;
    let hit = scene.gate.phase.ripples.absorb(ax, ay, az, point) ? scene.gate.phase.ripples : null;
    if (scene.launch.phase.ripples.absorb(ax, ay, az, point)) hit = scene.launch.phase.ripples;
    return !!hit && hit.cross(ax, ay, az, bx, by, bz, dt);
  };
  // The door's passage, where the view may stand behind whoever comes in; and the launch tunnel, where it may follow
  // whoever walks down it.
  const inDoorway = (p) => Math.abs(p.x - DOOR.x) < DOOR.half && p.z > HALL.front - 2.5 && p.y > DOOR.y && p.y < DOOR.y + DOOR.top;
  const inTunnel = (p) => p.z < HALL.back + 2;

  const enter = (ctx) => {
    ({ renderer, game, world, go, agentPlay } = ctx);
    camera = createCamera({ fov: 55, near: 0.3, far: 420 });
    root = createNode();
    clock = daylight.createClock({ hour: DEBUG ? parseFloat(params.get("hour")) : NaN, daylen: DEBUG ? parseFloat(params.get("daylen")) : NaN, day: DEBUG ? parseFloat(params.get("day")) : NaN, time: DEBUG ? params.get("time") : null, now: new Date() });
    skyFrom(clock);
    hud = hudMod.create({ roster: contributors.activeRoster, catalog: models.SWAG, tierColors: models.TIER_COLORS, renderIcon: hudMod.renderIcon, lootEnabled: ctx.lootEnabled });
    hud.setAreaLabel("LF");
    hooks = {};
    input = interactMod.create({ canvas: ctx.canvas, renderer, camera, hooks });
    const clampTarget = (p) => {
      p.y = clamp(p.y, 0.5, HALL.h - 3);
      if (inDoorway(p)) { p.z = Math.min(p.z, DOOR.z + 2); return; }
      if (inTunnel(p)) {
        p.x = clamp(p.x, -TUN.r + 2, TUN.r - 2);
        p.y = Math.min(p.y, TUN.y + TUN.r - 2.5);
        p.z = Math.max(p.z, TUN.holdShort - 1);
        return;
      }
      p.x = clamp(p.x, HALL.x0 + 3, HALL.x1 - 3);
      p.z = Math.min(p.z, HALL.front - 2);
    };
    // Inside the walls, which lean in as they rise; the door's passage lets the eye nearer the front, and the launch
    // tunnel lets it on down the runway, inside its frames and short of the shield.
    const clampCamera = (p) => {
      p.y = clamp(p.y, 0.6, HALL.h - 1.5);
      if (inDoorway(p)) { p.z = Math.min(p.z, DOOR.z + 3); return; }
      const lean = p.y / HALL.h * 2.6;
      if (p.z < HALL.back + 1.6 + lean) {
        p.x = clamp(p.x, -TUN.r + 1.5, TUN.r - 1.5);
        p.y = Math.min(p.y, TUN.y + TUN.r - 1.8);
        p.z = Math.max(p.z, TUN.z1 + 1.5);
        return;
      }
      p.x = clamp(p.x, HALL.x0 + 1.6 + lean, HALL.x1 - 1.6 - lean);
      p.z = Math.min(p.z, HALL.front - 1.6 - lean);
    };
    pilot = pilotMod.create({
      renderer, canvas: ctx.canvas, camera, hud, presets: PRESETS, landing: "entrance", pitch: PITCH, dist: DIST,
      follow: FOLLOW, fly: FLY, clampTarget, clampCamera, ceilingAt: () => HALL.h - 1.5, coarse: COARSE, mayPossess,
      close: { eyeHeight: 1.1, eyeRatio: 0.95, eyeForward: 0.16, pitch: [-1.35, 1.35], trailingDist: 4, orbitDist: 5, maxStep: 0.6, groundAt: (x, z) => HM.supportAt(x, z, feetOf()) }
    });
    const tipFor = (hit) => TIPS[hit.owner.kind] ? TIPS[hit.owner.kind][0] : "";
    Object.assign(hooks, {
      onHover: (hit, p) => {
        if (hit) hud.tooltip.show(tipFor(hit), p.x, p.y);
        else hud.tooltip.hide();
      },
      onHoverMove: (hit, p) => hud.tooltip.show(tipFor(hit), p.x, p.y),
      onTap: (hit) => {
        if (!hit) return;
        const o = hit.owner;
        if (o.kind === "exit") return leaveHangar();
        if (o.preset) pilot.goPreset(o.preset);
        if (TIPS[o.kind]) hud.toast(TIPS[o.kind][1]);
      },
      ...pilot.hooks
    });
    hud.onPreset(pilot.goPreset);
    hud.onAction((action) => {
      if (action === "leave") leaveHangar();
      else if (action === "reset-view") pilot.resetCamera();
      else if (action === "act") pilot.action();
      else if (!leaving && action.startsWith("mode-")) pilot.modeAction(action);
      else if (action.startsWith("weapon-") || action === "magazine-swap") pilot.weaponAction(action);
    });
    hud.setStats(game.state);
    fx = fxMod.create({ root, input, hooks, hud, game, world, renderer, camera, overlay: ctx.overlay, tickerAt: { x: 0, y: 10, z: 0 } });
    dust = BL.dressing.motes({ count: 220, span: 26, low: 0.5, high: 13 });
    addChild(root, dust.node);
    scene = build();
    hireCrew(scene);
    // The visitor's Ooga: `character=` on a page that opens here, else the one the hall handed over, else a free view.
    const asked = ctx.from === null ? new URLSearchParams(location.search).get("character")?.trim().toLowerCase() : null;
    const named = asked ? contributors.roster.find((c) => c.name.toLowerCase() === asked) : null;
    const returningOwn = pilot.loginViewRestored && BL.net.ownCharacter();
    const picked = returningOwn ? contributors.roster.find(c => c.name === returningOwn.handle)
      : named || world.pilot && contributors.roster.find((c) => c.name === world.pilot) || null;
    const playerName = picked && !BL.net.mayDrive(picked.name) ? picked.name : null;
    world.pilot = null;
    if (playerName) {
      // Keep the visitor's weapons and magazines across the doorway, as the hall does.
      playerWorld = { level: 0, weapons: world.weapons, magazine: world.magazine };
      const shared = { root, input, hud, game, world: playerWorld, playerName, weaponsEnabled: true, fx, viewYaw: 0, outsideActors: () => remotes ? remotes.actors() : NO_ACTORS, outsideActorHeight: BL.remotePlayers.BODY_HEIGHT, groundAt: groundFor, walkable: walkableFor, clipProjectileTarget, absorbProjectile, reloadPolicy };
      shared.onModelChange = () => {
        if (!avatar) return;
        scene.gate.phase.body.refresh(avatar.root);
        scene.launch.phase.body.refresh(avatar.root);
      };
      people = shared.crew = BL.crew.create(shared);
      world.weapons = playerWorld.weapons;
      world.magazine = playerWorld.magazine;
      pilot.bind(shared);
      avatar = people.cavemen.get(playerName);
      if (pilot.loginViewRestored) {
        Object.assign(avatar.root.position, { x: ARRIVAL.position.x, y: ARRIVAL.position.y + avatar.baseY, z: ARRIVAL.position.z });
        avatar.root.rotation.y = ARRIVAL.yaw + Math.PI;
      }
      pilot.possess(avatar);
      people.selectWeapon(avatar.weapon.selectedSlot, avatar);
      if (!pilot.loginViewRestored) pilot.navigate(ARRIVAL);
      const heads = Math.max(avatar.headOpen.verts.length, avatar.headClosed.verts.length);
      scene.gate.phase.body.track(avatar.root, avatar.traits.height * 2, heads);
      scene.launch.phase.body.track(avatar.root, avatar.traits.height * 2, heads);
    }
    unsubscribeAccount = BL.net.subscribe(accountChanged);
    // Other signed-in players in the hangar, as the Oogas they drive.
    remotes = BL.remotePlayers.create({ root, crew: people });
    // The driven Ooga's own footsteps, heard by this page alone (footsteps.js).
    footsteps = BL.footsteps.create();
    // The page's one factory node goes on with the hall's show while the visitor is in here.
    node = BL.factoryFeed.node(world);
    lightUp();
    leaving = false;

    hangarScene.root = root;
    hangarScene.camera = camera;
    hangarScene.input = input;
    hangarScene.debug = {
      hud, camera, controls: pilot.controls, pilot, crew: people, cavemen: people ? people.cavemen : null,
      hangar: { layout: LAYOUT, get scene() { return scene; }, get avatar() { return avatar; } }
    };
  };
  const feetOf = () => avatar ? avatar.root.position.y - avatar.baseY : 0;

  // A phase plane's hum: its glow follows, and it ripples now and then across its opening.
  const hum = (g, opening, dt, elapsed, gap) => {
    g.phase.update(dt, elapsed);
    g.phase.body.update(dt);
    g.phase.body.time = g.phase.ripples.time;
    g.hum -= dt;
    if (g.hum <= 0) {
      g.hum = gap + Math.random() * gap * 2;
      g.phase.ripples.pulse(opening.minX + Math.random() * (opening.maxX - opening.minX), opening.floorY + Math.random() * (opening.ceilingY - opening.floorY), 0);
    }
  };
  const update = (dt, elapsed) => {
    const s = scene;
    skyFrom(clock);
    pilot.readInput(dt);
    if (people) people.update(dt, elapsed);
    pilot.update(dt);
    // The Ooga driven here goes to the room with where it stands and its health; other players here are shown.
    const drivenHere = people && people.player;
    BL.net.setBody(drivenHere ? drivenHere.traits.name : null);
    if (drivenHere) {
      const p = drivenHere.root.position;
      BL.net.sendPose(p.x, p.y - drivenHere.baseY, p.z, drivenHere.root.rotation.y);
      BL.net.setHealth(drivenHere.health.value, drivenHere.health.stunned);
    }
    remotes.update(dt);
    footsteps.update(drivenHere);
    node.tick(dt);
    hum(s.gate, OPENING, dt, elapsed, 0.12);
    hum(s.launch, LAUNCH, dt, elapsed, 0.18);
    // Walked up to the hold-short bar, the launch shield ripples where they stand and says, once an approach, that it is
    // sealed.
    if (drivenHere) {
      const z = drivenHere.root.position.z;
      if (s.launch.armed && z < TUN.holdShort + SHIELD_NEAR) {
        s.launch.armed = false;
        s.launch.phase.ripples.pulse(clamp(drivenHere.root.position.x, LAUNCH.minX, LAUNCH.maxX), 1.4, 0);
        hud.toast("Launch shield · sealed. The runway opens when Jet v2 is ready.");
      } else if (z > TUN.holdShort + SHIELD_REARM) s.launch.armed = true;
    }
    glowNear(elapsed);
    dust.update(elapsed, pilot.orbit.target.x, pilot.orbit.target.z);
    for (let i = 0; i < s.crew.length; i++) s.crew[i].update(dt);
    // Back out through the door: walked past its shield, or flown up to it with the free view.
    if (!leaving) {
      const through = (p, feet, margin) => Math.abs(p.x - DOOR.x) <= DOOR.half && DOOR.z - p.z <= DOOR.plane + margin && feet > DOOR.y - 0.3 && feet < DOOR.y + DOOR.top;
      if (pilot.player) {
        if (through(pilot.player.root.position, pilot.player.root.position.y - pilot.player.baseY, 0)) leaveHangar();
      } else if (!avatar) {
        const a = pilot.controls.read();
        if (Math.hypot(a.x, a.y) > 0.05 && through(camera.position, camera.position.y, 0.9)) leaveHangar();
      }
    }
    stepTweens(dt);
    fx.update(dt, elapsed);
  };
  const drawExtra = (ctx2d, project) => remotes.drawNames(ctx2d, project);
  const overlay = (dt) => fx.drawOverlay(dt, drawExtra);

  const leave = () => {
    // Left by Back or Forward rather than by its door, the hangar hands the Ooga on, so the next scene plays the same
    // one; the door and Escape have handed theirs over already.
    if (!leaving) {
      world.pilotDetached = !pilot.player;
      world.pilot = pilot.player ? pilot.player.traits.name : null;
    }
    unsubscribeAccount();
    unsubscribeAccount = null;
    BL.net.setBody(null);
    scene.gate.phase.dispose();
    scene.launch.phase.dispose();
    for (const a of scene.crew) a.dispose();
    remotes.dispose();
    remotes = null;
    footsteps.dispose();
    footsteps = null;
    if (people) people.dispose();
    fx.dispose();
    pilot.dispose();
    for (const n of targets) input.remove(n);
    targets.length = 0;
    while (root.children.length) removeChild(root, root.children[root.children.length - 1]);
    const count = input.targetCount;
    input.dispose();
    hud.dispose();
    scene = hud = hooks = input = pilot = fx = agentPlay = dust = people = avatar = playerWorld = node = clock = null;
    hangarScene.input = hangarScene.debug = null;
    return { targets: count };
  };
  const liveGeometry = (set) => {
    if (scene) {
      scene.gate.phase.liveGeometry(set); scene.launch.phase.liveGeometry(set);
      for (const a of scene.crew) a.liveGeometry(set);
    }
    if (avatar) set.add(avatar.headOpen).add(avatar.headClosed);
    if (remotes) remotes.liveGeometry(set);
  };
  const stats = () => {
    let nodes = 0;
    traverseVisible(root, () => nodes++);
    const all = (n) => 1 + n.children.reduce((sum, c) => sum + all(c), 0);
    return { visibleNodes: nodes, allNodes: all(root), tweens: tweenCount(), targets: input.targetCount, ...fx.stats(), ...(remotes ? remotes.stats() : {}) };
  };

  const hangarScene = {
    // Still being built: unregistered unless a page opts in with ?wip=hangar, and the Factory builds no door to it.
    wip: true,
    // Voice zone: the Factory's group, which the hall shares (`factory.hall`).
    voiceZone: "factory.hangar",
    micKey: true,
    id: "hangar", enter, update, overlay, onDonation, onKey, onLootCleared, renderOpts: RENDER_OPTS, leave, stats, liveGeometry,
    root: null, camera: null, input: null, debug: null, agent: null, agentView: null, agentControls: null, agentHandoff: null,
    get inMotion() {
      return !!scene;
    }
  };
  BL.scenes = BL.scenes || {};
  BL.scenes.hangar = hangarScene;
})();
