// The Lightning Jet Hangar, behind the Lightning Factory's door at the end of its left walkway (`hangar-models.js` has
// the hall): the landing inside the door, the runway down the middle and on through the launch tunnel's neon frames to
// the launch shield, sealed until Jet v2 flies, with space beyond it, the hall humming
// (`hangar-audio.js`); the Jet docked beside the runway
// (`jet-models.js`) with a stair tower up its flank; the crew's workstations, and the repository's two boards on the
// wall. The crew are the Factory's own, gorillas in hard hats, each pacing its post. The boards read the repository
// once a page life, on the first visit (`jet-feed.js`), and show the best reading there is meanwhile; a tap opens one
// in the board dialog.
// Until the hangar opens the scene stays `wip`, and the Factory builds no door to it (`FM.hangarEntry`) unless a page
// opens it with ?wip=hangar.
//
// Whoever walked in stays themselves: the Ooga the hall handed over (`world.pilot`), or on a page that opens here,
// `character=`. It stands on the landing a step in from the door, looking down the runway. Walking back out through the
// door's shield, Escape and the Leave button all take it back to the hall, onto the walkway at the door. The hangar is a
// room of the Factory: its voice zone is in the Factory's group, so players here and in the hall hear each other.
//
// Past the launch shield is space, as ₿IFRÖST's dome shows its night: stars twinkling in their halos, the galaxy's
// band, a ringed giant and a red world turning with their moons, and shooting stars; the hall keeps its own warm
// light.
(() => {
  "use strict";
  const BL = window.BL = window.BL || {};
  const { math, models, contributors, hud: hudMod, interact: interactMod, pilot: pilotMod, fx: fxMod } = BL;
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
  const LAUNCH = { minX: -TUN.r + 0.6, maxX: TUN.r - 0.6, floorY: 0, ceilingY: TUN.y + TUN.r - 0.8 }, LAUNCH_TINT = HM.TINTS.launch;
  const view = (x, y, z, yaw, pitch, dist) => ({ yaw, pitch, dist, target: { x, y, z } });
  // `entrance` stands over the landing and looks down the runway to the tunnel's mouth, as the concept's entry view.
  const PRESETS = {
    entrance: view(0, 3.5, 6, 0, 0.1, 20),
    runway: view(0, 4.5, -62, 0, 0.05, 18),
    // The Jet from behind its tail, the concept's own angle, the tunnel beyond its nose.
    jet: view(LAYOUT.jet.x - 2, 5, LAYOUT.jet.z, -0.5, 0.16, 27),
    boards: view(HALL.x0 + 5.5, 4.3, 7, Math.PI / 2 - 0.35, 0.05, 17),
    door: view(0, 3.2, DOOR.z - 4, Math.PI, 0.12, 11)
  };
  // In from the hall: on the landing a step in from the door, facing down the runway, the view in the doorway behind it.
  const ARRIVAL = { position: { x: 0, y: DOOR.y, z: DOOR.z - 3.4 }, target: { x: 0, y: DOOR.y + 1, z: DOOR.z - 3.4 }, yaw: 0, pitch: 0.12, dist: 2.8 };
  // The hall's own light, warm, and past the launch shield space, as ₿IFRÖST's night shows it: the sky pass paints its
  // deep gradient, its twinkling stars and a moon low in the tunnel's end; `sun` is the sun's colour, which the night
  // hides.
  const RENDER_OPTS = {
    clear: [0.01, 0.012, 0.035], sky: [0.54, 0.38, 0.26], ground: [0.24, 0.16, 0.1],
    direct: [0.7, 0.52, 0.36], directStrength: 0.36, ambientFloor: 0.4, light: { x: 0.25, y: 0.9, z: 0.35 },
    horizon: [0.07, 0.06, 0.18], zenith: [0.006, 0.008, 0.03], sun: [0.05, 0.05, 0.08], stars: 1,
    moon: { x: 0.2, y: 0.13, z: -0.97 }, starMatrix: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
    shadowCenter: { x: 2.5, y: 6, z: -2 }, shadowExtent: 42,
    lights: new Float32Array(BL.glRenderer.POINT_LIGHT_CAPACITY * 8), lightCount: 0, bloomStrength: 1
  };
  // The space past the shield, from ₿IFRÖST's dome (`bifrostModels.sky`): its stars, the twinkling ones in their halos,
  // the galaxy's band and its shooting stars on a dome tipped so its zenith looks back down the tunnel and turned so
  // the band crosses the tunnel's end; and its ringed giant and its red world, turning with their moons going round,
  // hung past the tunnel's end and smaller, [x, y, z, scale] from it. Twinkling stars rest as bright as the rest and dip
  // by `TWINKLE_DIP` of their glow; a shooting star streaks for `METEOR_LIFE` seconds, one every `METEOR_GAP`.
  const SPACE = { tip: -Math.PI / 2, turn: -0.3, planets: [[-22, 18, -300, 0.55], [28, -2, -270, 0.8]] };
  const TWINKLE_DIP = 1.08, METEOR_LIFE = 0.8, METEOR_GAP = [3, 9];
  // The boards' Jets coming alive now and then (`boardJets`): the first wait and the waits after, s; each beat's length,
  // s: waking (its engines lighting), leaving, away, and coming back; how many specks of trail each board keeps, how
  // often one is let go and how long it lasts; and each board's way of going: the stats board's dashes off its right
  // edge in an orange streak and warps back, the timeline's lifts nose-up, rolls, rockets off its top in cyan and drops
  // back in.
  const JET_FLY = { first: [8, 14], every: [25, 45], wake: 1.1, go: 1.6, away: 5, back: 0.8, trail: 14, puff: 0.04, life: 0.6 };
  const JET_STYLE = { stats: { spot: 0, kind: "dash", ink: "#ffb02e" }, timeline: { spot: 0, kind: "loop", ink: "#5fe3ff" } };
  // The tunnel's neon burns past full (`NEON_GLOW`), each frame's strip shimmering at its own pace, and every
  // `NEON_STUTTER` seconds one stutters, dipping twice as a tired tube does; the light at the tunnel's mouth follows
  // its first strip (`MOUTH_LIGHT`).
  const NEON_GLOW = 1.7, NEON_STUTTER = [2.5, 7], MOUTH_LIGHT = HM.TINTS.mouth;
  // The floor lamps breathe a little, each at its own pace, and every `LAMP_STUTTER` seconds one stutters, failing four
  // times in half a second (`LAMP_FAILS`, from and to, s, at `LAMP_DIM` of its light); and every `RABBIT` seconds a
  // pulse runs down the runway's marker lamps toward the launch tunnel at `RABBIT_SPEED` m/s, each brightening by up to
  // `RABBIT_GLOW` its own as it passes, within about `RABBIT_WIDTH` metres of it.
  // How the door back to the hall answers whoever comes near: from DOOR_FAR metres of its opening, growing faster the
  // nearer they come, and fully only at the doorway itself (DOOR_NEAR), easing at DOOR_EASE a second, its arch's glow
  // brightening by up to DOOR_BRIGHTEN, its light by up to DOOR_POWER (more floods whoever stands in the doorway) and
  // reaching DOOR_REACH metres farther; its light, the hangar's first fixed one, as `fixedLights` has it.
  const DOOR_NEAR = 0, DOOR_FAR = 12, DOOR_EASE = 5, DOOR_BRIGHTEN = 3.2, DOOR_POWER = 1.4, DOOR_REACH = 4, DOOR_LIGHT = HM.fixedLights()[0];
  const LAMP_STUTTER = [3, 9], LAMP_FAILS = [0, 0.05, 0.12, 0.2, 0.3, 0.34, 0.46, 0.5], LAMP_DIM = 0.15;
  const RABBIT = [8, 14], RABBIT_SPEED = 28, RABBIT_GLOW = 2.2, RABBIT_WIDTH = 2.5;
  const TIPS = {
    exit: ["Lightning Factory · the way back", "Back to the hall, onto the walkway to the balcony."],
    sign: ["Lightning Jet Hangar", "Where Lightning Jet v2 is being built, and where it will launch from."],
    mouth: ["Launch tunnel · sealed", "The runway opens when Jet v2 is ready to fly."],
    jet: ["Lightning Jet v2 · under construction", "The Jet is still being built. Its stair leads up to the cockpit."],
    stats: ["Repo stats · drneski/lightning-jet", ""],
    timeline: ["Lightning Jet timeline", ""],
    station: ["Crew workstations", "Where the crew follows the Jet's build."],
    firetest: ["Engine static fire test · DO NOT PRESS", "Whatever you do, don't press the big red button."],
    sis: ["Kortik's Sis · Jet Hangar Chief Engineer", "Walk up to her and poke her. If you dare."],
    terminal: ["Hangar terminal", "Walk up to it and DISPLAY the Jet's history on the big screen."],
    projector: ["The projector · Lightning Jet Pictures", "An old film projector. Any terminal by the runway starts the show."],
    screen: ["The big screen", "Walk up to a terminal by the runway and DISPLAY the Jet's history here."],
    tess: [COARSE ? "Tess the guide · tap for a tour" : "Tess the guide · click for a tour", ""]
  };
  // How near the hold-short bar the launch shield answers whoever walks up to it, and how far back they must step before
  // it answers again.
  const SHIELD_NEAR = 0.6, SHIELD_REARM = 3;

  let renderer, game, world, go, root, camera, hud, hooks, input, pilot, fx, agentPlay = null;
  let people = null, avatar = null, playerWorld = null, scene = null, leaving = false, dust = null, unsubscribeAccount = null, remotes = null, footsteps = null, node = null;
  let unsubscribeFeed = null, boardsDirty = false, audio = null, actPrompt = false, soundPanel = null;
  const NO_ACTORS = [];
  // What walks the hall besides the crew, for the crew to keep clear of: the other players' Oogas and Kortik's Sis.
  const ACTORS = [];
  const outsideActors = () => {
    ACTORS.length = 0;
    const others = remotes ? remotes.actors() : NO_ACTORS;
    for (let i = 0; i < others.length; i++) ACTORS.push(others[i]);
    if (scene && scene.sis) ACTORS.push(scene.sis.actor);
    return ACTORS;
  };
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
      if (scene && scene.guide.escape()) { e.preventDefault(); return true; }
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

  // The Jet as far built as its stage: its cells, and its nozzles on a node of their own once its engines are fitted.
  const jetNode = (options) => {
    const [cells, ...rest] = JM.pieces(JET_STAGE), node = createNode({ ...options, geometry: cells });
    for (const geometry of rest) addChild(node, createNode({ geometry }));
    return node;
  };
  // The Jet in miniature on a board, climbing across its face, turned toward the eye and banked so its top shows,
  // round its fuselage's axis.
  const miniJet = ([x, y, z, scale, climb, yaw, roll]) => {
    const flight = createNode({ position: { x, y, z }, rotation: { x: 0, y: 0, z: climb } }), turn = createNode({ rotation: { x: 0, y: -Math.PI / 2 + yaw, z: 0 } }), axis = JM.AXIS * scale;
    const jet = jetNode({ position: { x: axis * Math.sin(roll), y: -axis * Math.cos(roll), z: 0 }, rotation: { x: 0, y: 0, z: roll }, scale: { x: scale, y: scale, z: scale } });
    addChild(turn, jet);
    addChild(flight, turn);
    flight.jet = jet;
    return flight;
  };
  // A board's Jet, ready to come alive: its plumes on its nozzles (the static fire's, in the Jet's own frame, hidden till
  // its engines light) and a pool of trail specks on the board, in the board's frame.
  const flyer = (board, flight, spot, style) => {
    const E = HM.exhaust(), flames = [];
    for (const e of JM.EXHAUST) for (const geometry of [E.envelope, E.core]) {
      const f = createNode({ position: { x: e.x, y: e.y, z: e.z }, geometry, visible: false, sightHidden: true });
      addChild(flight.jet, f);
      flames.push(f);
    }
    const speck = models.particleGeometry(style.ink, 0.07, 1), trail = [];
    for (let i = 0; i < JET_FLY.trail; i++) {
      const node = createNode({ geometry: speck, visible: false, sightHidden: true });
      addChild(board, node);
      trail.push({ node, life: 0 });
    }
    return { flight, spot, style, flames, trail, at: 0, phase: "rest", t: 0, wait: JET_FLY.first[0] + Math.random() * (JET_FLY.first[1] - JET_FLY.first[0]), puff: 0 };
  };

  // Space past the launch shield (`SPACE`), lighter on Canvas 2D: the dome tipped and turned with its stars, twinkling
  // groups, halos, band and shooting stars waiting their turn, and the planets on nodes of their own, a turning one
  // leaning on a node with its body and each band of its rings spinning at their own pace (`spins`), its day and night
  // over it, and its moons going round it (`moons`), as ₿IFRÖST hangs them.
  const buildSpace = (s) => {
    const BM = BL.bifrostModels, night = BM.sky(renderer.kind === "canvas2d" ? 1 : 0);
    const space = createNode({ position: { x: 0, y: TUN.y, z: TUN.z1 } }), turn = createNode({ rotation: { x: 0, y: SPACE.turn, z: 0 } }), dome = createNode({ rotation: { x: SPACE.tip, y: 0, z: 0 } });
    s.twinkleFull = 1 / BM.TWINKLE_EMISSIVE;
    s.twinkle = night.twinkle.map((geometry) => createNode({ geometry, sightHidden: true }));
    s.halos = night.halos.map((geometry) => createNode({ geometry, sightHidden: true }));
    addChild(dome, createNode({ geometry: night.stars, sightHidden: true }), ...s.twinkle, ...s.halos, createNode({ geometry: night.band, sightHidden: true }));
    s.meteors = night.meteors.map((m) => {
      const node = createNode({ geometry: m.geometry, visible: false, sightHidden: true });
      addChild(dome, node);
      return { node, dir: m.dir, len: m.len, t: 1 };
    });
    s.meteorWait = METEOR_GAP[0];
    addChild(turn, dome);
    addChild(space, turn);
    s.spins = [];
    s.moons = [];
    SPACE.planets.forEach(([x, y, z, k], i) => {
      const p = night.planets[i], planet = createNode({ position: { x, y, z }, scale: { x: k, y: k, z: k } });
      if (p.body) {
        const lean = createNode({ rotation: { x: 0, y: 0, z: p.tilt } });
        for (const [geometry, rate] of [[p.body, p.turn], ...p.rings.map((ring) => [ring.geometry, ring.rate])]) {
          const node = createNode({ geometry, sightHidden: true });
          addChild(lean, node);
          s.spins.push({ node, rate });
        }
        addChild(planet, lean);
        for (const geometry of p.shade) addChild(planet, createNode({ geometry, scale: { x: p.r, y: p.r, z: p.r }, sightHidden: true }));
      } else addChild(planet, createNode({ geometry: p.geometry, sightHidden: true }));
      for (const m of p.moons) {
        const node = createNode({ geometry: m.geometry, sightHidden: true });
        addChild(planet, node);
        s.moons.push({ node, a: m.a, rate: m.rate, phase: m.phase, u: m.u, v: m.v });
      }
      addChild(space, planet);
    });
    addChild(root, space);
  };
  // The neon's flicker, and the mouth's light with it.
  const neonLife = (s, dt, elapsed) => {
    s.stutterWait -= dt;
    if (s.stutterWait <= 0) {
      s.stutterWait = NEON_STUTTER[0] + Math.random() * (NEON_STUTTER[1] - NEON_STUTTER[0]);
      s.stutter = Math.floor(Math.random() * s.neon.length);
      s.stutterAt = elapsed;
    }
    const since = elapsed - s.stutterAt;
    for (let i = 0; i < s.neon.length; i++) {
      let k = NEON_GLOW * (0.93 + 0.05 * Math.sin(elapsed * (7.3 + i * 1.7) + i * 2.3) + 0.03 * Math.sin(elapsed * (19.1 + i * 3.1) + i));
      if (i === s.stutter && (since < 0.06 || since > 0.14 && since < 0.21)) k *= 0.22;
      s.neon[i].glow = k;
    }
    const f = s.neon[0].glow / NEON_GLOW, o = 6 * 8, Lt = RENDER_OPTS.lights;
    Lt[o + 4] = MOUTH_LIGHT[0] * f; Lt[o + 5] = MOUTH_LIGHT[1] * f; Lt[o + 6] = MOUTH_LIGHT[2] * f;
  };
  // The boards' Jets: resting at their spots, then now and then waking (engines lit, a shudder), leaving their board each
  // in its own way with a trail of specks, away a while, and back. Everything is set from where each beat has got to.
  const boardJets = (s, dt) => {
    for (let n = 0; n < s.flyers.length; n++) {
      const F = s.flyers[n], node = F.flight, [x, y, z, scale, climb, , roll] = F.spot, jet = node.jet, axis = JM.AXIS * scale;
      F.t += dt;
      if (F.phase === "rest" && F.t >= F.wait) { F.phase = "wake"; F.t = 0; }
      else if (F.phase === "wake" && F.t >= JET_FLY.wake) { F.phase = "go"; F.t = 0; }
      else if (F.phase === "go" && F.t >= JET_FLY.go) { F.phase = "away"; F.t = 0; node.visible = false; }
      else if (F.phase === "away" && F.t >= JET_FLY.away) { F.phase = "back"; F.t = 0; node.visible = true; }
      else if (F.phase === "back" && F.t >= JET_FLY.back) { F.phase = "rest"; F.t = 0; F.wait = JET_FLY.every[0] + Math.random() * (JET_FLY.every[1] - JET_FLY.every[0]); }
      const loop = F.style.kind === "loop", u = F.t;
      let px = x, py = y, pitch = climb, bank = roll, size = 1, fire = 0;
      if (F.phase === "wake") {
        const k = Math.min(1, u / JET_FLY.wake);
        fire = k;
        if (loop) { py += 0.18 * k * k * (3 - 2 * k); pitch = climb + 1.2 * k * k * (3 - 2 * k); }
        else { px += (Math.random() - 0.5) * 0.024 * k; py += (Math.random() - 0.5) * 0.024 * k; pitch = climb + 0.1 * k; }
      } else if (F.phase === "go") {
        fire = 1;
        if (loop) {
          // A barrel roll round its fuselage, then straight up and off the top.
          const roll1 = Math.min(1, u / 0.8), up = Math.max(0, u - 0.6);
          bank = roll + Math.PI * 2 * roll1 * roll1 * (3 - 2 * roll1);
          pitch = climb + 1.2;
          py += 0.18 + 4 * up * up;
        } else {
          const d = 3 * u * u, a = climb + 0.1;
          px += Math.cos(a) * d; py += Math.sin(a) * d; pitch = a;
        }
        size = u > JET_FLY.go - 0.4 ? (JET_FLY.go - u) / 0.4 : 1;
      } else if (F.phase === "back") {
        const k = Math.min(1, u / JET_FLY.back);
        if (loop) { py += 2.6 * (1 - k) * (1 - k) - 0.06 * Math.sin(Math.PI * k); fire = 1 - k; }
        else size = k < 0.7 ? k / 0.7 * 1.15 : 1.15 - 0.15 * (k - 0.7) / 0.3;
      }
      node.position.x = px; node.position.y = py; node.position.z = z;
      node.rotation.z = pitch;
      node.scale.x = node.scale.y = node.scale.z = Math.max(0.001, size);
      jet.position.x = axis * Math.sin(bank); jet.position.y = -axis * Math.cos(bank); jet.rotation.z = bank;
      // The engines: the plumes lit and flickering while it flies.
      for (let i = 0; i < F.flames.length; i++) {
        const f = F.flames[i];
        f.visible = fire > 0.02;
        f.scale.x = f.scale.y = fire * (0.8 + Math.random() * 0.25);
        f.scale.z = fire * (0.6 + Math.random() * 0.5);
      }
      // The trail: a speck let go behind it every so often while it goes, each fading and shrinking; and a ring of them
      // as the stats board's Jet warps back.
      if (F.phase === "go" && (F.puff -= dt) <= 0) {
        F.puff = JET_FLY.puff;
        const tailX = px - Math.cos(pitch) * 13 * scale * size, tailY = py - Math.sin(pitch) * 13 * scale * size;
        const p = F.trail[F.at];
        F.at = (F.at + 1) % F.trail.length;
        p.life = JET_FLY.life;
        p.node.position.x = tailX + (Math.random() - 0.5) * 0.05; p.node.position.y = tailY + (Math.random() - 0.5) * 0.05; p.node.position.z = z;
        p.node.visible = true;
      }
      if (F.phase === "back" && !loop && u < dt) {
        for (let i = 0; i < 8; i++) {
          const p = F.trail[F.at], a = i / 8 * Math.PI * 2;
          F.at = (F.at + 1) % F.trail.length;
          p.life = JET_FLY.life;
          p.node.position.x = x + Math.cos(a) * 0.45; p.node.position.y = y + Math.sin(a) * 0.3; p.node.position.z = z;
          p.node.visible = true;
        }
      }
      for (let i = 0; i < F.trail.length; i++) {
        const p = F.trail[i];
        if (p.life <= 0) continue;
        p.life -= dt;
        const k = Math.max(0, p.life / JET_FLY.life);
        p.node.visible = k > 0;
        p.node.scale.x = p.node.scale.y = p.node.scale.z = 0.4 + k;
        p.node.glow = 0.5 + k;
      }
    }
  };
  // The lamps' life: the floor lamps breathing and one now and then stuttering; the runway's rabbit.
  const lampLife = (s, dt, elapsed) => {
    if ((s.lampWait -= dt) <= 0) {
      s.lampWait = LAMP_STUTTER[0] + Math.random() * (LAMP_STUTTER[1] - LAMP_STUTTER[0]);
      s.lampOut = Math.floor(Math.random() * s.lamps.length);
      s.lampAt = elapsed;
    }
    const since = elapsed - s.lampAt;
    let out = false;
    for (let i = 0; i < LAMP_FAILS.length; i += 2) if (since >= LAMP_FAILS[i] && since < LAMP_FAILS[i + 1]) out = true;
    for (let i = 0; i < s.lamps.length; i++) s.lamps[i].glow = out && i === s.lampOut ? LAMP_DIM : 1 + 0.04 * Math.sin(elapsed * (2.1 + i * 0.37) + i * 1.9);
    if ((s.rabbitWait -= dt) <= 0) {
      s.rabbitWait = RABBIT[0] + Math.random() * (RABBIT[1] - RABBIT[0]);
      s.rabbitAt = elapsed;
    }
    const front = LAYOUT.runway.z0 - (elapsed - s.rabbitAt) * RABBIT_SPEED;
    for (let i = 0; i < s.markers.length; i++) {
      const d = (s.markers[i].position.z - front) / RABBIT_WIDTH;
      s.markers[i].glow = 1 + RABBIT_GLOW * Math.exp(-d * d);
    }
  };
  // Space's life: stars twinkle a group at a time with their halos, the planets and their rings spin, moons go round
  // their planets, and now and then a shooting star streaks down its way and fades.
  const heavens = (s, dt, elapsed) => {
    for (let i = 0; i < s.twinkle.length; i++) {
      const u = Math.sin(elapsed * (1.1 + 0.29 * i) + i * 2.1) * Math.sin(elapsed * (0.37 + 0.07 * i) + i), d = u * u;
      s.twinkle[i].glow = s.halos[i].glow = s.twinkleFull - TWINKLE_DIP * d * d;
    }
    for (let i = 0; i < s.spins.length; i++) s.spins[i].node.rotation.y += dt * s.spins[i].rate;
    for (let i = 0; i < s.moons.length; i++) {
      const m = s.moons[i], t = elapsed * m.rate + m.phase, x = Math.cos(t) * m.a, y = Math.sin(t) * m.a, p = m.node.position;
      p.x = m.u[0] * x + m.v[0] * y; p.y = m.u[1] * x + m.v[1] * y; p.z = m.u[2] * x + m.v[2] * y;
    }
    s.meteorWait -= dt;
    if (s.meteorWait <= 0) {
      s.meteorWait = METEOR_GAP[0] + Math.random() * (METEOR_GAP[1] - METEOR_GAP[0]);
      const m = s.meteors[Math.floor(Math.random() * s.meteors.length)];
      if (m.t >= 1) { m.t = 0; m.node.visible = true; }
    }
    for (let i = 0; i < s.meteors.length; i++) {
      const m = s.meteors[i];
      if (m.t >= 1) continue;
      m.t = Math.min(1, m.t + dt / METEOR_LIFE);
      const k = m.t * m.len;
      m.node.position.x = m.dir[0] * k; m.node.position.y = m.dir[1] * k; m.node.position.z = m.dir[2] * k;
      m.node.glow = 1.4 * (1 - m.t);
      m.node.smokeOpacity = Math.min(1, 3 * (1 - m.t));
      m.node.visible = m.t < 1;
    }
  };

  // The hangar for a visit: the hall and everything standing in it from the cached builds, the signs, the boards, the
  // Jet at its dock, the door back to the hall with its shield, the launch shield and space past it.
  const build = () => {
    const L = LAYOUT, s = { crew: [] }, shell = HM.shell(), runway = HM.runway(), tunnel = HM.tunnel(), dressed = HM.dressing(), fixtures = HM.fixtures(), frames = HM.boardFrames();
    addChild(root, createNode({ geometry: shell.rock }), createNode({ geometry: shell.vault }), createNode({ geometry: shell.backing }),
      createNode({ geometry: HM.landing() }), createNode({ geometry: runway.flat }),
      createNode({ geometry: tunnel.stone }),
      createNode({ geometry: HM.catwalks() }), createNode({ geometry: dressed.iron }), createNode({ geometry: dressed.banners }),
      createNode({ geometry: dressed.frame }), createNode({ geometry: dressed.glass, sightHidden: true }), createNode({ geometry: fixtures.glow, sightHidden: true }),
      createNode({ geometry: fixtures.frame }), createNode({ geometry: fixtures.glass, sightHidden: true }), createNode({ geometry: HM.dock() }));
    s.mouth = createNode({ geometry: tunnel.iron });
    // The tunnel's neon, a strip on every frame, each flickering on its own (`neonLife`).
    s.neon = tunnel.neonZ.map((z) => createNode({ position: { x: 0, y: 0, z }, geometry: tunnel.neon, sightHidden: true }));
    addChild(root, ...s.neon);
    s.stutter = -1;
    s.stutterAt = 0;
    s.stutterWait = NEON_STUTTER[0];
    s.fixtures = createNode({ geometry: fixtures.flat });
    addChild(root, s.mouth, s.fixtures);
    // The runway's marker lamps and the floor lamps, each a node of its own, so they come alive one at a time
    // (`lampLife`).
    const M = runway.markers;
    s.markers = [];
    for (let i = 0; i < M.length; i += 2) s.markers.push(createNode({ position: { x: M[i], y: 0, z: M[i + 1] }, geometry: HM.marker(), sightHidden: true }));
    s.lamps = L.floorLamps.map(([x, z]) => createNode({ position: { x, y: 0, z }, geometry: HM.floorLamp(), sightHidden: true }));
    addChild(root, ...s.markers, ...s.lamps);
    s.lampWait = LAMP_STUTTER[0];
    s.lampOut = -1;
    s.lampAt = 0;
    s.rabbitWait = RABBIT[0];
    s.rabbitAt = -Infinity;
    // The Jet at its dock, nose to the tunnel, as far built as its stage.
    s.jet = jetNode({ position: { x: L.jet.x, y: 0, z: L.jet.z } });
    addChild(root, s.jet);
    // The boards on the left wall: each a glass in its frame with its face built on it and the Jet flying across it,
    // its lettering painted over it from the reading (`paintBoards`); the stats board's fifth tile shows the stars, or
    // a flag while the repository has a milestone open. Each has its picture for the board dialog too, with a link out
    // to the repository.
    s.boards = {};
    s.flyers = [];
    s.boardText = {};
    s.boardViews = {};
    const faces = { stats: HM.statsFace(), timeline: HM.timelineFace() };
    for (const [key, b] of Object.entries(L.boards)) {
      const n = createNode({ position: { x: b.x, y: b.y, z: b.z }, rotation: { x: 0, y: b.turn, z: 0 }, scale: { x: b.scale, y: b.scale, z: b.scale }, geometry: frames[key].flat });
      addChild(n, createNode({ geometry: frames[key].glow, sightHidden: true }), createNode({ geometry: faces[key].flat }), createNode({ geometry: faces[key].glow, sightHidden: true }));
      HM.JETS[key].forEach((spot, i) => {
        const flight = miniJet(spot);
        addChild(n, flight);
        if (JET_STYLE[key] && JET_STYLE[key].spot === i) s.flyers.push(flyer(n, flight, spot, JET_STYLE[key]));
      });
      addChild(root, n);
      s.boards[key] = n;
      s.boardViews[key] = { title: key === "stats" ? "Lightning Jet on GitHub" : "Lightning Jet Timeline", help: "", canvas: document.createElement("canvas"), count: 1, index: 0, version: 0,
        caption: key === "stats" ? "Repository stats" : "Dated from the repository", note: "", wide: true, go() {},
        link: { href: `https://github.com/${BL.jetFeed.REPO}`, label: `Open ${BL.jetFeed.REPO} on GitHub ↗` } };
    }
    s.statsStars = createNode({ geometry: faces.stats.stars, sightHidden: true });
    s.statsFlag = createNode({ geometry: faces.stats.flag, sightHidden: true, visible: false });
    addChild(s.boards.stats, s.statsStars, s.statsFlag);
    // The hangar's sign over the runway between two lit bolts, hung from the last gantry on two rods.
    const [hx, hy, hz] = L.signs.hangar, hangarSign = FM.label("LIGHTNING JET\nHANGAR", "", { height: 1.7 });
    s.sign = sign(root, hangarSign, hx, hy, hz);
    for (const side of [-1, 1]) {
      addChild(root, createNode({ position: { x: hx + side * (hangarSign.width / 2 + 0.6), y: hy, z: hz + 0.05 }, geometry: FM.smoothBolt(1.2, 0.1, "#ffd23a", 1), sightHidden: true }));
      addChild(root, createNode({ position: { x: hx + side * (hangarSign.width / 2 - 0.3), y: (hy + L.gantryY) / 2 + 0.4, z: hz - 0.05 }, geometry: models.box({ w: 0.06, h: L.gantryY - hy - 1.2, d: 0.06, color: "#2c2e33" }) }));
    }
    // The door, the Factory's own turned to face in, with the hall's warm dark through it and its sign the way back.
    const door = FM.hangarDoor(), D = FM.HANGAR_DOOR;
    s.door = createNode({ position: { x: DOOR.x, y: DOOR.y, z: DOOR.z }, rotation: { x: 0, y: DOOR.turn, z: 0 } });
    s.doorStone = createNode({ geometry: door.stone });
    s.doorGlow = createNode({ geometry: door.glow, sightHidden: true });
    addChild(s.door, s.doorStone, s.doorGlow, createNode({ geometry: HM.hallGlimpse(), sightHidden: true }));
    // Through the shield, the Factory's hall as it stands, from the hall's own stand-in (`hangar-window.js`; WebGL only,
    // the glimpse staying behind it and in its place on Canvas 2D).
    if (renderer.kind !== "canvas2d") {
      const hall = FM.hubWindow(), h = FM.LAYOUT.hangar;
      s.window = BL.hangarWindow.create({ group: s.door, pieces: [hall.hall, hall.chamber, hall.fire], beyond: BL.hangarWindow.across(h.x, h.y, h.z, h.turn, DOOR.plane), plane: DOOR.plane });
    }
    sign(s.door, FM.label("LIGHTNING\nFACTORY", "", { height: 1.3 }), D.sign[0], D.sign[1], D.sign[2]);
    addChild(root, s.door);
    s.gate = { hum: 0, near: 0, phase: BL.labPhase.create(s.door, { x: DOOR.x, z: DOOR.z, ry: DOOR.turn, floorY: DOOR.y, room: { w: 4.4, h: 5, from: 0, to: 3.3 } }, OPENING, DOOR.plane, TINT) };
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
    target(s.boards.stats, "stats", "boards", 4.6);
    target(s.boards.timeline, "timeline", "boards", 5.2);
    target(s.fixtures, "station", null, 1.2);
    return s;
  };

  // The crew, gorillas in hard hats as the Factory's and the hangar's hi-vis vests, each pacing its post on the floor,
  // on the Jet's gangway or on a catwalk, kept to where an Ooga could walk at its height and held off rails, desks and
  // the Jet by their own breadth (`CREW_BODY`, half a gorilla's shoulders). Each paces to the next spot round its post it
  // can walk to all the way, tried `PACE_TRIES` times, so none presses on toward one past a rail; with none, it stands
  // a while.
  const CREW_BODY = 0.5, PACE_TRIES = 12;
  const hireCrew = (s) => {
    const hat = FM.hardHat(), vest = HM.vest();
    for (const [x, y, z, radius, heading] of LAYOUT.crew) {
      const walkable = (fx, fz, nx, nz) => Math.hypot(nx - x, nz - z) < radius + 0.4 && HM.supportAt(nx, nz, y) === y && HM.clearAt(nx, nz, y, CREW_BODY, fx, fz);
      const agent = BL.agent.create({ groundAt: () => y, walkable, form: "ape", x, z, heading, scale: 0.86 });
      addChild(agent.parts.head, createNode({ position: { x: 0, y: 0.6, z: 0.05 }, geometry: hat }));
      addChild(agent.parts.torso, createNode({ geometry: vest }));
      const at = agent.root.position, target = [{ x, z }];
      const reaches = (tx, tz) => {
        const n = Math.ceil(Math.hypot(tx - at.x, tz - at.z) / 0.25);
        for (let i = 1; i <= n; i++) {
          if (!walkable(at.x + (tx - at.x) * (i - 1) / n, at.z + (tz - at.z) * (i - 1) / n, at.x + (tx - at.x) * i / n, at.z + (tz - at.z) * i / n)) return false;
        }
        return true;
      };
      agent.onIdle = () => {
        for (let k = 0; k < PACE_TRIES; k++) {
          const a = Math.random() * Math.PI * 2, r = radius * Math.sqrt(Math.random()), tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r;
          if (!reaches(tx, tz)) continue;
          target[0].x = tx; target[0].z = tz;
          agent.walk(target, Math.hypot(tx - at.x, tz - at.z) > radius * 0.8);
          return;
        }
        target[0].x = at.x; target[0].z = at.z;
        agent.walk(target);
      };
      addChild(root, agent.root);
      s.crew.push(agent);
    }
  };

  // The boards' lettering and their dialog pictures from the best reading there is, painted again whenever the feed
  // says it changed; a picture replaced leaves the GPU at the next housekeeping pass.
  const paintBoards = (s) => {
    const r = BL.jetFeed.reading();
    for (const key of Object.keys(LAYOUT.boards)) {
      if (s.boardText[key]) removeChild(s.boards[key], s.boardText[key]);
      s.boardText[key] = createNode({ geometry: HM.boardText(key, r), sightHidden: true });
      addChild(s.boards[key], s.boardText[key]);
      const view = s.boardViews[key];
      HM.paintBoard(key, view.canvas, r);
      view.note = HM.boardNote(r);
      view.version++;
    }
    const milestone = !!(r && r.milestones.length);
    s.statsStars.visible = !milestone;
    s.statsFlag.visible = milestone;
  };

  // Point lights, most important first so the lowest tier keeps them: the door's cyan, the landing, the dock's two work
  // lamps, the boards' blue, the tunnel mouth's and the launch shield's, and two warm ones over the crew's floor
  // (`HM.fixedLights`); the
  // lanterns share what is left, the vault's and the floor's, the nearest the view first, each reaching as far as
  // `hangar-models.js` says and flickering like a flame, as the Factory shares its own.
  const LANTERN_GLOW = HM.LANTERN_GLOW, FIXED = 10;
  const lanternPool = models.cached(() => new Float32Array([...HM.dressing().lights, ...HM.fixtures().lights]));
  const lamp = (i, x, y, z, radius, r, g, b) => {
    const o = i * 8, l = RENDER_OPTS.lights;
    l[o] = x; l[o + 1] = y; l[o + 2] = z; l[o + 3] = radius; l[o + 4] = r; l[o + 5] = g; l[o + 6] = b; l[o + 7] = 0;
  };
  const lightUp = () => {
    HM.fixedLights().forEach((l, i) => lamp(i, ...l));
    RENDER_OPTS.lightCount = Math.min(BL.glRenderer.POINT_LIGHT_CAPACITY, FIXED + lanternPool().length / 4);
  };
  let poolScore = null;
  // The shared slots go to the lanterns nearest the view, nearest first, by repeated minimum: no sort, no list.
  const glowNear = (elapsed, from) => {
    const P = lanternPool(), n = P.length / 4, t = pilot.orbit.target, Lt = RENDER_OPTS.lights;
    if (!poolScore) poolScore = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const dx = P[i * 4] - t.x, dy = P[i * 4 + 1] - t.y, dz = P[i * 4 + 2] - t.z;
      poolScore[i] = dx * dx + dy * dy * 2 + dz * dz;
    }
    for (let slot = from; slot < RENDER_OPTS.lightCount; slot++) {
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
  // In the air, the same clearance without the floor within a step, as the Factory keeps it, so a jump carries an Ooga
  // over a deck's rail and it drops to whatever is below; on foot the edges still hold.
  const flyableFor = (ax, az, bx, bz, y, height, actor) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.2)), radius = actor.bodyRadius || 0.35;
    for (let i = 1; i <= steps; i++) {
      if (!HM.clearAt(ax + (bx - ax) * i / steps, az + (bz - az) * i / steps, y, radius, ax + (bx - ax) * (i - 1) / steps, az + (bz - az) * (i - 1) / steps)) return false;
    }
    return true;
  };
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
    camera = createCamera({ fov: 55, near: 0.3, far: 700 });
    root = createNode();
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
        if (o.kind === "tess") return scene.guide.tap();
        if (scene.guide.holding) return;
        if (o.kind === "exit") return leaveHangar();
        if (o.kind === "stats" || o.kind === "timeline") return hud.openBoard(scene.boardViews[o.kind]);
        if (o.kind === "firetest" && scene.fire.near && scene.fire.press()) return;
        if (o.kind === "sis" && scene.sis.near && scene.sis.poke()) return;
        if (o.kind === "terminal" && scene.terminals.near && scene.terminals.press()) return;
        if (o.preset) pilot.goPreset(o.preset);
        if (TIPS[o.kind]) hud.toast(TIPS[o.kind][1]);
      },
      ...pilot.hooks
    });
    hud.onPreset((name) => { if (!scene.guide.holding) pilot.goPreset(name); });
    hud.onAction((action) => {
      if (action === "leave") leaveHangar();
      else if (action === "reset-view") pilot.resetCamera();
      else if (action === "act") pilot.action();
      else if (action === "hangar-mute") soundPanel.toggle();
      else if (!leaving && action.startsWith("mode-")) pilot.modeAction(action);
      else if (action.startsWith("weapon-") || action === "magazine-swap") pilot.weaponAction(action);
    });
    hud.setStats(game.state);
    fx = fxMod.create({ root, input, hooks, hud, game, world, renderer, camera, overlay: ctx.overlay, tickerAt: { x: 0, y: 10, z: 0 } });
    dust = BL.dressing.motes({ count: 220, span: 26, low: 0.5, high: 13 });
    addChild(root, dust.node);
    scene = build();
    buildSpace(scene);
    hireCrew(scene);
    const F = LAYOUT.fireTest, exits = JM.EXHAUST;
    audio = BL.hangarAudio.create({ door: { x: DOOR.x, y: DOOR.y + 2, z: DOOR.z }, launch: { x: 0, y: TUN.y, z: TUN.z1 }, tunnel: { y: TUN.y, z0: TUN.z0, z1: TUN.z1 },
      booth: { x: F.x, y: 2, z: F.z }, engines: { x: LAYOUT.jet.x, y: exits[0].y, z: LAYOUT.jet.z + exits[0].z + 2 }, projector: HM.projector().lens, screen: HM.filmScreen().picture });
    // The engine static fire test's booth beside the runway (`hangar-fire.js`), and its settings: the Sound
    // button opens the hangar's sound panel, its level and the pad's vibration.
    scene.fire = BL.hangarFire.create({ root, jet: scene.jet, nozzles: scene.jet.children[0] || null, fx, audio, hold: (on) => {
      pilot.setActive(!on);
      pilot.setExternalControl(on);
    }, toast: hud.toast });
    input.add(scene.fire.body, { kind: "firetest", preset: null }, { radius: 1.6 });
    targets.push(scene.fire.body);
    soundPanel = openSoundPanel();
    // Kortik's Sis, the hangar's chief engineer (`sis.js`).
    scene.sis = BL.sis.create({ fx, audio, fire: scene.fire, jet: scene.jet, toast: hud.toast });
    addChild(root, scene.sis.node, scene.sis.props);
    input.add(scene.sis.body, { kind: "sis", preset: null }, { radius: 1.2 });
    targets.push(scene.sis.body);
    // The terminals by the runway and the film show they start (`hangar-terminals.js`), its mood page reading hers.
    scene.terminals = BL.hangarTerminals.create({ root, audio, mood: () => scene.sis.mood, toast: hud.toast });
    for (const n of scene.terminals.nodes) {
      input.add(n, { kind: "terminal", preset: null }, { radius: 0.8 });
      targets.push(n);
    }
    input.add(scene.terminals.projector, { kind: "projector", preset: null }, { radius: 1.2 });
    input.add(scene.terminals.screen, { kind: "screen", preset: null }, { radius: 4.5 });
    targets.push(scene.terminals.projector, scene.terminals.screen);
    // Tess, the Factory's guide, helping out in here (`hangar-guide.js`): she greets whoever walks in once a page and
    // shows them round, answers questions about the Jet, and flies to distract Kortik's Sis while she smashes it. Her
    // beam finds Sis wherever she is (`sisHead`), and the projector and its screen.
    scene.sisHead = { x: 0, y: 0, z: 0 };
    scene.guide = BL.hangarGuide.create({
      parent: root, input, fx, camera, pilot, visitor: () => people && people.player, world, hud, coarse: COARSE, landing: true,
      quality: () => renderer.quality, busy: () => leaving || scene.fire.t >= 0,
      targets: { sis: [scene.sisHead], show: [HM.projector().lens, HM.filmScreen().picture] }
    });
    scene.distraction = BL.hangarGuide.distraction(scene.sis);
    // The repository's reading: read from GitHub on the first visit a page life, unless the cache holds a fresh one.
    unsubscribeFeed = BL.jetFeed.subscribe(() => { boardsDirty = true; });
    if (!params.has("nosim") && params.get("jet") !== "0") BL.jetFeed.load();
    paintBoards(scene);
    boardsDirty = false;
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
      const shared = { root, input, hud, game, world: playerWorld, playerName, weaponsEnabled: true, fx, viewYaw: 0, outsideActors, outsideActorHeight: BL.remotePlayers.BODY_HEIGHT, groundAt: groundFor, walkable: walkableFor, flyable: flyableFor, clipProjectileTarget, absorbProjectile, reloadPolicy,
        useNear: (x, z, reach, feet) => scene.fire.useNear(x, z, reach, feet) || scene.terminals.useNear(x, z, reach, feet) || scene.sis.useNear() };
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
    leaving = actPrompt = false;

    hangarScene.root = root;
    hangarScene.camera = camera;
    hangarScene.input = input;
    hangarScene.debug = {
      hud, camera, controls: pilot.controls, pilot, crew: people, cavemen: people ? people.cavemen : null,
      hangar: { layout: LAYOUT, feed: BL.jetFeed, get scene() { return scene; }, get avatar() { return avatar; }, get audio() { return audio; }, get fire() { return scene && scene.fire; }, get sis() { return scene && scene.sis && scene.sis.debug; }, get terminals() { return scene && scene.terminals && scene.terminals.debug; }, get guide() { return scene && scene.guide; } }
    };
  };
  const feetOf = () => avatar ? avatar.root.position.y - avatar.baseY : 0;

  // The hangar's sound panel, from its Sound button: the sound on or off, its level, and how hard a pad vibrates in the
  // static fire test, each kept in this browser (`hangarAudio`'s and `gamepad`'s own keys). A press outside closes it;
  // the press on the Sound button that closed it does not open it again.
  const openSoundPanel = () => {
    const panel = document.getElementById("hangar-sound"), onOff = document.getElementById("hangar-sound-toggle");
    const volume = document.getElementById("hangar-volume"), vibration = document.getElementById("hangar-vibration");
    let closedAt = -Infinity;
    const show = () => {
      onOff.textContent = audio.muted ? "Sound off" : "Sound on";
      onOff.setAttribute("aria-pressed", String(!audio.muted));
      volume.value = String(Math.round(audio.volume * 100));
      vibration.value = String(Math.round(BL.gamepad.strength * 100));
    };
    const onToggle = () => {
      audio.setMuted(!audio.muted);
      show();
      onOff.blur();
    };
    const onVolume = () => audio.setVolume(Number(volume.value) / 100);
    // A taste of the new strength, on a pad that has one.
    const onVibration = () => {
      BL.gamepad.setStrength(Number(vibration.value) / 100);
      BL.gamepad.rumble(0.6, 0.6, 160);
    };
    const blur = (e) => e.target.blur();
    const close = () => {
      if (!panel.hidden) closedAt = performance.now();
      panel.hidden = true;
    };
    onOff.addEventListener("click", onToggle);
    volume.addEventListener("input", onVolume);
    vibration.addEventListener("input", onVibration);
    volume.addEventListener("change", blur);
    vibration.addEventListener("change", blur);
    hud.dismissOutside(panel, close);
    return {
      toggle: () => {
        if (!panel.hidden) return close();
        if (performance.now() - closedAt < 400) return;
        show();
        panel.hidden = false;
      },
      dispose: () => {
        panel.hidden = true;
        onOff.removeEventListener("click", onToggle);
        volume.removeEventListener("input", onVolume);
        vibration.removeEventListener("input", onVibration);
        volume.removeEventListener("change", blur);
        vibration.removeEventListener("change", blur);
      }
    };
  };

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
    const s = scene, drivenHere = people && people.player;
    s.fire.unshake(camera);
    pilot.readInput(dt);
    if (people) people.update(dt, elapsed);
    // The static fire test, after the crew has moved, so a presser it knocks down lies where the crew left them.
    s.fire.update(dt, drivenHere);
    s.sis.update(dt, drivenHere, camera.position);
    s.terminals.update(dt, drivenHere);
    // Kortik's Sis smashing the Jet brings Tess over to distract her, whatever she was doing; it over, she goes back.
    const sp = s.sis.node.position;
    s.sisHead.x = sp.x; s.sisHead.y = sp.y + 0.9; s.sisHead.z = sp.z;
    if (s.sis.rampaging && !s.guide.lent) { s.guide.lend(s.distraction.drive); s.sis.distract(s.guide.root.position); }
    else if (!s.sis.rampaging && s.guide.lent) { s.distraction.done(); s.guide.lend(null); s.sis.distract(null); }
    pilot.update(dt);
    s.guide.update(dt, elapsed);
    s.fire.view(camera);
    if (s.window) s.window.update(camera);
    // The hall's hum hears from the Ooga driven here, or from the view's target.
    const ear = people && people.player, at = ear ? ear.root.position : pilot.orbit.target;
    audio.listen(at.x, ear ? at.y - ear.baseY + 1.4 : at.y, at.z, camera.target.x - camera.position.x, camera.target.z - camera.position.z);
    audio.update(dt);
    // The Ooga driven here goes to the room with where it stands and its health; other players here are shown.
    BL.net.setBody(drivenHere ? drivenHere.traits.name : null);
    if (drivenHere) {
      const p = drivenHere.root.position;
      BL.net.sendPose(p.x, p.y - drivenHere.baseY, p.z, drivenHere.root.rotation.y);
      BL.net.setHealth(drivenHere.health.value, drivenHere.health.stunned);
    }
    remotes.update(dt);
    footsteps.update(drivenHere);
    // The act button's DON'T PRESS beside the static fire test's button, DISPLAY (or STOP) beside a terminal, and POKE
    // beside Kortik's Sis.
    const actLabel = drivenHere && (s.fire.actLabel() || s.terminals.actLabel() || s.sis.actLabel());
    if (actLabel) { hud.setAct(actLabel); actPrompt = true; }
    else if (actPrompt) { actPrompt = false; pilot.showAct(); }
    node.tick(dt);
    // The door answers whoever comes near (the Ooga driven here, or with none the view), as ₿IFRÖST's windows do: its
    // arch's studs and neon brighten, its light swells and reaches farther, and its field hums faster.
    const who = drivenHere ? drivenHere.root.position : pilot.orbit.target;
    const want = clamp((DOOR_FAR - Math.max(0, Math.hypot(who.x - DOOR.x, who.y - DOOR.y - 1, who.z - DOOR.z) - 2)) / (DOOR_FAR - DOOR_NEAR), 0, 1);
    s.gate.near += (want * want - s.gate.near) * Math.min(1, dt * DOOR_EASE);
    s.doorGlow.glow = 1 + DOOR_BRIGHTEN * s.gate.near;
    const Lt = RENDER_OPTS.lights, power = 1 + DOOR_POWER * s.gate.near;
    Lt[3] = DOOR_LIGHT[3] + DOOR_REACH * s.gate.near; Lt[4] = DOOR_LIGHT[4] * power; Lt[5] = DOOR_LIGHT[5] * power; Lt[6] = DOOR_LIGHT[6] * power;
    hum(s.gate, OPENING, dt, elapsed, 0.12 * (1 - 0.65 * s.gate.near));
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
    // The fire test's lights, the film's, and Tess's own, then the lanterns'.
    const fired = FIXED + s.fire.lights(RENDER_OPTS.lights, FIXED), shown = fired + s.terminals.lights(RENDER_OPTS.lights, fired);
    s.guide.light(RENDER_OPTS.lights, shown * 8);
    glowNear(elapsed, shown + 1);
    heavens(s, dt, elapsed);
    neonLife(s, dt, elapsed);
    lampLife(s, dt, elapsed);
    boardJets(s, dt);
    dust.update(elapsed, pilot.orbit.target.x, pilot.orbit.target.z);
    for (let i = 0; i < s.crew.length; i++) s.crew[i].update(dt);
    if (boardsDirty) {
      boardsDirty = false;
      paintBoards(s);
    }
    hud.updateBoard(elapsed);
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
  const drawExtra = (ctx2d, project) => {
    remotes.drawNames(ctx2d, project);
    scene.sis.overlay(ctx2d, project);
    scene.fire.overlay(ctx2d);
  };
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
    unsubscribeFeed();
    unsubscribeFeed = null;
    BL.net.setBody(null);
    scene.gate.phase.dispose();
    scene.launch.phase.dispose();
    if (scene.window) scene.window.dispose();
    scene.fire.dispose();
    scene.guide.dispose();
    soundPanel.dispose();
    soundPanel = null;
    for (const a of scene.crew) a.dispose();
    remotes.dispose();
    remotes = null;
    footsteps.dispose();
    footsteps = null;
    audio.dispose();
    audio = null;
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
    if (scene) {
      scene.gate.phase.liveGeometry(set); scene.launch.phase.liveGeometry(set);
      scene.sis.liveGeometry(set);
      scene.terminals.liveGeometry(set);
      scene.guide.liveGeometry(set);
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
