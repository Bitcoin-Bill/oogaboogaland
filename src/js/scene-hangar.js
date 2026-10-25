// The Lightning Jet Hangar, behind the Lightning Factory's door at the end of its left walkway: for now its shell, a
// long rock hall under iron gantries with the runway down its middle to the launch tunnel's mouth, sealed until Jet v2
// flies. The Jet, its scaffold and crew and the boards come with the hangar itself; until then the scene stays `wip`,
// and the Factory builds no door to it (`FM.hangarEntry`) unless a page opens it with ?wip=hangar.
//
// Whoever walked in stays themselves: the Ooga the hall handed over (`world.pilot`), or on a page that opens here,
// `character=`. It stands a few steps in from the door, looking down the runway. Walking back out through the door's
// shield, Escape and the Leave button all take it back to the hall, onto the walkway at the door. The hangar is a room
// of the Factory: its voice zone is in the Factory's group, so players here and in the hall hear each other.
(() => {
  "use strict";
  const BL = window.BL = window.BL || {};
  const { math, models, contributors, hud: hudMod, interact: interactMod, pilot: pilotMod, fx: fxMod } = BL;
  const FM = BL.factoryModels, HM = BL.hangarModels;
  const { clamp } = math;
  const { createNode, addChild, removeChild, createCamera, stepTweens, tweenCount, traverseVisible } = BL.scene;
  const { LAYOUT } = HM, { HALL } = LAYOUT, DOOR = LAYOUT.door;

  const COARSE = window.matchMedia("(pointer: coarse)").matches;
  const PITCH = [-0.2, 1.3], DIST = [3, 30];
  const FOLLOW = { y: 0.9, min: 3, max: 7, pitch: [0.25, 0.8] };
  const FLY = { speed: 6, perDist: 0.4, climb: 4, yMax: HALL.h - 3 };
  // The door's shield, as wide as its arch, in the hall's cyan.
  const OPENING = { minX: -DOOR.half, maxX: DOOR.half, floorY: 0, ceilingY: DOOR.top }, TINT = BL.factoryWindow.TINT;
  const view = (x, y, z, yaw, pitch, dist) => ({ yaw, pitch, dist, target: { x, y, z } });
  // `entrance` stands inside the door and looks down the runway to the tunnel's mouth.
  const PRESETS = {
    entrance: view(0, 3.5, 12, 0, 0.1, 20),
    runway: view(0, 4.5, -22, 0, 0.08, 14),
    door: view(0, 3.2, DOOR.z - 4, Math.PI, 0.12, 11)
  };
  // In from the hall: a few steps in from the door, facing down the runway, the view just inside the door behind it.
  const ARRIVAL = { position: { x: 0, y: 0, z: DOOR.z - 3.5 }, target: { x: 0, y: 1, z: DOOR.z - 3.5 }, yaw: 0, pitch: 0.14, dist: 2.8 };
  const RENDER_OPTS = {
    clear: [0.05, 0.05, 0.07], sky: [0.34, 0.3, 0.3], ground: [0.14, 0.11, 0.09],
    direct: [0.5, 0.45, 0.42], directStrength: 0.3, ambientFloor: 0.32,
    sun: { x: 0.2, y: 0.9, z: 0.35 }, shadowCenter: { x: 0, y: 6, z: -2 }, shadowExtent: 40,
    lights: new Float32Array(BL.glRenderer.POINT_LIGHT_CAPACITY * 8), lightCount: 0, bloomStrength: 0.95,
    fog: [0.06, 0.06, 0.08], fogNear: 45, fogFar: 120
  };
  const TIPS = {
    exit: ["Lightning Factory · the way back", "Back to the hall, onto the walkway to the balcony."],
    sign: ["Lightning Jet Hangar", "Lightning Jet v2 is being built in here. The hangar is still going up."],
    mouth: ["Launch tunnel · sealed", "The runway opens when Jet v2 is ready to fly."]
  };

  let renderer, game, world, go, root, camera, hud, hooks, input, pilot, fx, agentPlay = null;
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

  // The hangar for a visit: its shell, runway, tunnel mouth and dressing from the cached builds, the sign over the
  // runway, and the door back to the hall in the front wall with its shield across it.
  const build = () => {
    const s = {}, shell = HM.shell(), runway = HM.runway(), mouth = HM.mouth(), dressed = HM.dressing(), door = FM.hangarDoor(), D = FM.HANGAR_DOOR;
    addChild(root, createNode({ geometry: shell.rock }), createNode({ geometry: shell.vault }), createNode({ geometry: runway.flat }), createNode({ geometry: runway.glow, sightHidden: true }),
      createNode({ geometry: dressed.iron }), createNode({ geometry: dressed.banners }), createNode({ geometry: dressed.frame }), createNode({ geometry: dressed.glass, sightHidden: true }));
    s.mouth = createNode({ geometry: mouth.iron });
    addChild(root, s.mouth, createNode({ geometry: mouth.glow, sightHidden: true }));
    const sign = FM.label("LIGHTNING JET HANGAR", "(Under Construction)", { height: 1.6 });
    s.sign = createNode({ position: { x: 0, y: LAYOUT.sign.y, z: LAYOUT.sign.z }, geometry: sign.back });
    addChild(s.sign, createNode({ geometry: sign.face }));
    addChild(root, s.sign);
    // The door, the Factory's own turned to face in, with the hall's warm dark through it and its sign the way back.
    s.door = createNode({ position: { x: DOOR.x, y: 0, z: DOOR.z }, rotation: { x: 0, y: DOOR.turn, z: 0 } });
    s.doorStone = createNode({ geometry: door.stone });
    const back = FM.label("LIGHTNING\nFACTORY", "", { height: 1.3 }), backNode = createNode({ position: { x: D.sign[0], y: D.sign[1], z: D.sign[2] }, geometry: back.back });
    addChild(backNode, createNode({ geometry: back.face }));
    addChild(s.door, s.doorStone, createNode({ geometry: door.glow, sightHidden: true }), createNode({ geometry: HM.hallGlimpse(), sightHidden: true }), backNode);
    addChild(root, s.door);
    const mouthFrame = { x: DOOR.x, z: DOOR.z, ry: DOOR.turn, floorY: 0, room: { w: 4.4, h: 5, from: 0, to: 3.3 } };
    s.gate = { hum: 0, phase: BL.labPhase.create(s.door, mouthFrame, OPENING, DOOR.plane, TINT) };
    const target = (n, kind, preset, radius) => {
      input.add(n, { kind, preset }, { radius });
      targets.push(n);
    };
    target(s.doorStone, "exit", null, 3);
    target(s.sign, "sign", "runway", 2.5);
    target(s.mouth, "mouth", "runway", 5);
    return s;
  };

  // Point lights, most important first so the lowest tier keeps them: the door's cyan, the tunnel mouth's blue and the
  // hall's warm middle; the lanterns share what is left, each flickering like a flame.
  const LANTERN_GLOW = [1.3, 0.8, 0.36], LANTERN_REACH = 7.5;
  let fixedLights = 0;
  const lamp = (i, x, y, z, radius, r, g, b) => {
    const o = i * 8, l = RENDER_OPTS.lights;
    l[o] = x; l[o + 1] = y; l[o + 2] = z; l[o + 3] = radius; l[o + 4] = r; l[o + 5] = g; l[o + 6] = b; l[o + 7] = 0;
  };
  const lightUp = () => {
    let n = 0;
    lamp(n++, DOOR.x, 2.4, DOOR.z - 2, 8, TINT[0], TINT[1], TINT[2]);
    lamp(n++, 0, LAYOUT.mouth.y, HALL.back + 3, 14, 0.35, 0.6, 1);
    lamp(n++, 0, 9, 0, 24, 1, 0.66, 0.3);
    fixedLights = n;
    const hung = HM.dressing().lights;
    for (let i = 0; i < hung.length && n < BL.glRenderer.POINT_LIGHT_CAPACITY; i += 4) lamp(n++, hung[i], hung[i + 1], hung[i + 2], LANTERN_REACH, ...LANTERN_GLOW);
    RENDER_OPTS.lightCount = n;
  };

  const groundFor = (x, z) => HM.supportAt(x, z);
  const walkableFor = (ax, az, bx, bz) => HM.walkable(ax, az, bx, bz);
  // There is no banana pile in here. Space must jump even when the rifle needs ammunition.
  const reloadPolicy = { near: () => false, available: () => false };
  const clipProjectileTarget = (from, to) => scene.gate.phase.ripples.absorb(from.x, from.y, from.z, to);
  const absorbProjectile = (ax, ay, az, point, dt) => {
    const gate = scene.gate.phase.ripples, bx = point.x, by = point.y, bz = point.z;
    return gate.absorb(ax, ay, az, point) && gate.cross(ax, ay, az, bx, by, bz, dt);
  };
  // The door's passage, where the view may stand behind whoever comes in.
  const inDoorway = (p) => Math.abs(p.x - DOOR.x) < DOOR.half && p.z > HALL.front - 2.5 && p.y < DOOR.top;

  const enter = (ctx) => {
    ({ renderer, game, world, go, agentPlay } = ctx);
    camera = createCamera({ fov: 55, near: 0.3, far: 200 });
    root = createNode();
    hud = hudMod.create({ roster: contributors.activeRoster, catalog: models.SWAG, tierColors: models.TIER_COLORS, renderIcon: hudMod.renderIcon, lootEnabled: ctx.lootEnabled });
    hud.setAreaLabel("LF");
    hooks = {};
    input = interactMod.create({ canvas: ctx.canvas, renderer, camera, hooks });
    const clampTarget = (p) => {
      p.y = clamp(p.y, 0.5, HALL.h - 3);
      if (inDoorway(p)) { p.z = Math.min(p.z, DOOR.z + 2); return; }
      p.x = clamp(p.x, -HALL.halfW + 3, HALL.halfW - 3);
      p.z = clamp(p.z, HALL.back + 3, HALL.front - 2);
    };
    // Inside the walls, which lean in as they rise; only the door's passage lets the eye nearer the front.
    const clampCamera = (p) => {
      p.y = clamp(p.y, 0.6, HALL.h - 1.5);
      if (inDoorway(p)) { p.z = Math.min(p.z, DOOR.z + 3); return; }
      const lean = p.y / HALL.h * 2.6;
      p.x = clamp(p.x, -HALL.halfW + 1.6 + lean, HALL.halfW - 1.6 - lean);
      p.z = clamp(p.z, HALL.back + 1.6 + lean, HALL.front - 1.6 - lean);
    };
    pilot = pilotMod.create({
      renderer, canvas: ctx.canvas, camera, hud, presets: PRESETS, landing: "entrance", pitch: PITCH, dist: DIST,
      follow: FOLLOW, fly: FLY, clampTarget, clampCamera, ceilingAt: () => HALL.h - 1.5, coarse: COARSE, mayPossess,
      close: { eyeHeight: 1.1, eyeRatio: 0.95, eyeForward: 0.16, pitch: [-1.35, 1.35], trailingDist: 4, orbitDist: 5, maxStep: 0.6, groundAt: groundFor }
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
    dust = BL.dressing.motes({ count: 200, span: 24, low: 0.5, high: 12 });
    addChild(root, dust.node);
    scene = build();
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
      shared.onModelChange = () => { if (avatar) scene.gate.phase.body.refresh(avatar.root); };
      people = shared.crew = BL.crew.create(shared);
      world.weapons = playerWorld.weapons;
      world.magazine = playerWorld.magazine;
      pilot.bind(shared);
      avatar = people.cavemen.get(playerName);
      if (pilot.loginViewRestored) {
        Object.assign(avatar.root.position, { x: ARRIVAL.position.x, y: avatar.baseY, z: ARRIVAL.position.z });
        avatar.root.rotation.y = ARRIVAL.yaw + Math.PI;
      }
      pilot.possess(avatar);
      people.selectWeapon(avatar.weapon.selectedSlot, avatar);
      if (!pilot.loginViewRestored) pilot.navigate(ARRIVAL);
      scene.gate.phase.body.track(avatar.root, avatar.traits.height * 2, Math.max(avatar.headOpen.verts.length, avatar.headClosed.verts.length));
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

  const update = (dt, elapsed) => {
    const s = scene;
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
    // The door's shield hums, and shows the outline of whoever walks through it.
    const g = s.gate;
    g.phase.update(dt, elapsed);
    g.phase.body.update(dt);
    g.phase.body.time = g.phase.ripples.time;
    g.hum -= dt;
    if (g.hum <= 0) {
      g.hum = 0.12 + Math.random() * 0.25;
      g.phase.ripples.pulse(OPENING.minX + Math.random() * (OPENING.maxX - OPENING.minX), Math.random() * OPENING.ceilingY, 0);
    }
    // The lanterns flicker like flames.
    const L = RENDER_OPTS.lights;
    for (let slot = fixedLights, j = 0; slot < RENDER_OPTS.lightCount; slot++, j++) {
      const k = 0.9 + Math.sin(elapsed * 9.3 + j * 1.7) * 0.06 + Math.sin(elapsed * 23.7 + j * 5.3) * 0.04, o = slot * 8;
      L[o + 4] = LANTERN_GLOW[0] * k; L[o + 5] = LANTERN_GLOW[1] * k; L[o + 6] = LANTERN_GLOW[2] * k;
    }
    dust.update(elapsed, pilot.orbit.target.x, pilot.orbit.target.z);
    // Back out through the door: walked past its shield, or flown up to it with the free view.
    if (!leaving) {
      const through = (p, margin) => Math.abs(p.x - DOOR.x) <= DOOR.half && DOOR.z - p.z <= DOOR.plane + margin && p.y < DOOR.top + 1;
      if (pilot.player) {
        if (through(pilot.player.root.position, 0)) leaveHangar();
      } else if (!avatar) {
        const a = pilot.controls.read();
        if (Math.hypot(a.x, a.y) > 0.05 && through(camera.position, 0.9)) leaveHangar();
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
    scene = hud = hooks = input = pilot = fx = agentPlay = dust = people = avatar = playerWorld = node = null;
    hangarScene.input = hangarScene.debug = null;
    return { targets: count };
  };
  const liveGeometry = (set) => {
    if (scene) scene.gate.phase.liveGeometry(set);
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
