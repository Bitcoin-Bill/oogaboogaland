// Block Frenzy: capture the flag on Fort Chaos, Bitcoin themed. Each side guards its Bitcoin block, a glowing cube in
// its team's colour on a stand in its fort; steal the other side's, carry it home and touch your own stand while your own block is
// home. Paint splats a rival for a moment (a carrier drops what they carry) and nobody dies. Two a side: the visitor
// and a teammate against two rivals, the three bots run by `block-sim.js`. First to three captures.
//
// Phases `board` (choose a side), `play` and `results`. The rules run in `blockSim.step` on a fixed step; this file
// draws them: the arena and stands built once a visit, the four Oogas posed from the sim each frame, the two blocks on
// their stands, at a carrier's back or lying where they fell, pooled crates, throws and splats, the weather (a wind
// sign, rain and lightning in a storm), and a chase camera behind the visitor's Ooga that the mouse drag, Q E or the
// look stick turns. W A S D run toward where the camera looks, Shift sprints, Space jumps and jumps again in the air,
// a left click or Enter throws the chosen tool (1 paint, 2 grenade, 3 rocket, 4 net; R, a right click or the wheel
// step through them), B drops a crate, F lifts, stacks and sets crates, G drops the
// block, C crouches while held, V switches between the chase camera and first person (a click there locks the mouse
// for aiming; Escape lets it go). On touch the act button jumps, `#block-paint` throws and the tool bar picks. A round
// opens with the sim's fortifying time. The intro card, the board (side and Ooga), the tool bar, the quiz card and the
// results are in `src/index.html` under `#block`.
//
// Quiz traps: stepping on a green pad closes a Matrix bubble round the Ooga (`block-sim.js`). For the visitor the
// scene opens `#block-quiz`, a Bitcoin question from `block-trivia.js` with its four answers shuffled; a right answer
// breaks the bubble (`blockSim.escape`), a wrong one locks the answers for `WRONG_LOCK_MS` and brings another
// question, and the bubble wears off by itself after the sim's `TRAP_MAX_S`. Keys 1 to 4 answer too.
(() => {
  "use strict";
  const BL = window.BL = window.BL || {};
  const { math, models, contributors, daylight, game: gameMod, pile: pileMod, hud: hudMod, interact: interactMod, controls: controlsMod, fx: fxMod } = BL;
  const SIM = BL.blockSim, BM = BL.blockModels, C = SIM.CONFIG;
  const { clamp, damp } = math;
  const { createNode, addChild, removeChild, createCamera, stepTweens, tweenCount, traverseVisible } = BL.scene;
  const params = new URLSearchParams(location.search);
  const DEBUG = params.has("debug");
  const COARSE = window.matchMedia("(pointer: coarse)").matches;
  const hourParam = DEBUG ? parseFloat(params.get("hour")) : NaN;
  const dayParam = DEBUG ? parseFloat(params.get("day")) : NaN;
  const TEAM_INDEX = { blue: 0, red: 1 };
  const WRONG_LOCK_MS = 2500, MAX_SPLATS = 40, CAM = { dist: 6.8, height: 1.8, pitch: [-0.15, 0.9], yawRate: 2.4 };
  const PAINT_BITS = { blue: ["#3a8dff", "#9cc8ff"].map((c) => models.particleGeometry(c, 0.1, 0.6)), red: ["#ff4a3a", "#ffb0a6"].map((c) => models.particleGeometry(c, 0.1, 0.6)) };
  const ORANGE_BITS = ["#f7931a", "#ffd27a", "#fff3d6"].map((c) => models.particleGeometry(c, 0.1, 1));
  const LINES = {
    pickup: ["Block mine! Run!", "Ooga got block!", "Shiny block. Go go!"],
    capture: ["Block home! Ooga rich!", "Mined it!", "Number go up!"],
    splat: ["Splat!", "Paint in eye!", "Ooga sticky!"],
    lost: ["Our block! Get it!", "Thief! Paint thief!"],
    win: ["Ooga win! All blocks!", "Stack sats!"],
    rescue: ["Mine again! Home!", "Ooga take it back!"],
    boom: ["Kaboom!", "Paint everywhere!"],
    net: ["Ooga tangled!", "Net?! Rude!"],
    bonk: ["Bonk!", "Ooga see stars!", "Who threw box?!"],
    trap: ["Quiz?! Ooga think…", "Hmm. Satoshi who?", "Big brain time."],
    free: ["Ooga know!", "Easy! Twenty-one million!", "Brain unlocked!"]
  };
  const QUIZ_BITS = ["#3dff7a", "#b8ffcf"].map((c) => models.particleGeometry(c, 0.09, 1));
  const NET_BITS = ["#7fe08a", "#c8ffd0"].map((c) => models.particleGeometry(c, 0.08, 0.6));
  const WOOD_BITS = ["#9a6a3a", "#5a3a22"].map((c) => models.particleGeometry(c, 0.1, 0));
  const STAR_BITS = ["#ffe066", "#fff3d6"].map((c) => models.particleGeometry(c, 0.09, 1));
  const TOOL_KEYS = { 1: "paint", 2: "grenade", 3: "rocket", 4: "net", 5: "sniper" };
  // Each tool's gun (`BM.gun` takes the gun's index times two plus the team's); Lift shows none.
  const GUN_OF = { paint: 0, grenade: 1, rocket: 2, net: 3, sniper: 4, crate: 0, grab: -1 };
  const WEATHER_WORDS = { clear: "Clear", breeze: "Windy", storm: "Storm" };
  const RAIN = 140;
  // Sky, light and haze from the island's clock, as the drop's.
  const RENDER_OPTS = {
    clear: new Float32Array(3), horizon: new Float32Array(3), zenith: new Float32Array(3), sky: new Float32Array(3), ground: new Float32Array(3), sun: new Float32Array(3), direct: new Float32Array(3),
    light: { x: 0.55, y: 0.78, z: -0.25 }, sunDirection: { x: 0, y: 1, z: 0 }, moon: { x: 0, y: 1, z: 0 }, moonSun: { x: 0, y: -1, z: 0 }, starMatrix: new Float32Array(9),
    stars: 0, torch: 0, day: 1, twilight: 0, lampFactor: 0, directStrength: 1, sunStrength: 1, moonStrength: 0, ambientFloor: 0.22, diffuseFloor: 0, shadowStrength: 1, shadowFloor: 0, shadowBias: 0.002,
    time: 0, bloomStrength: 0.6, lights: new Float32Array(80), lightCount: 0, shadowCenter: { x: 0, y: 0, z: 0 }, shadowExtent: 26, fog: null, fogNear: 60, fogFar: 260
  };
  RENDER_OPTS.starMatrix[0] = RENDER_OPTS.starMatrix[4] = RENDER_OPTS.starMatrix[8] = 1;
  RENDER_OPTS.fog = RENDER_OPTS.horizon;
  RENDER_OPTS.clouds = 0.35;
  RENDER_OPTS.sea = -30;
  const setVec = (v, x, y, z) => { v.x = x; v.y = y; v.z = z; };
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const pick = (list, i) => list[i % list.length];
  // Kept for the page's life: the side last chosen.
  const selection = { team: "blue", ooga: null };

  let home = "hub";
  let renderer, game, world, go, root, camera, hud, hooks, input, fx, controls, clock;
  let sim = null, phase = "board", sceneTime = 0, stateTimer = 0, hintTimer = 0, lineN = 0, result = null;
  let actors = null, blocks = null, shots = null, splats = null, splatNext = 0, ticks = null, pads = null, crates = null, rain = null, caches = null, fpGun = null, zipNear = false;
  let tool = "paint", flash = 0, flashT = 0;
  // The quiz: the deck of question indices still to ask this visit, the one on the card and where its right answer sits.
  const quiz = { open: false, deck: [], index: -1, right: -1, locked: false, lockTimer: 0, asked: 0, solved: 0 };
  const placed = [];
  // `face` is where the visitor's Ooga faces and aims; `yaw` is the camera's, which follows it round.
  const cam = { yaw: Math.PI, face: Math.PI, pitch: 0.28, warm: false, first: false };
  const move = { x: 0, z: 0, sprint: 0, jump: 0, crouch: 0, face: 0 };
  let jumpWas = false;
  const el = {};
  const blockScene = {
    id: "block", renderOpts: RENDER_OPTS, root: null, camera: null, input: null, debug: null, agent: null, agentControls: null,
    get inMotion() { return phase === "play" || fx.inMotion; }
  };

  const place = (node) => { addChild(root, node); placed.push(node); return node; };
  const roster = () => contributors.activeRoster.map((c) => c.name);
  // The four Oogas: the visitor's own when signed in, else the one a cabinet sent in, else the first; then three
  // others from the roster, in its order.
  const castNames = () => {
    const names = roster(), own = BL.net.ownAmong(contributors.activeRoster);
    if (world.pilot && names.includes(world.pilot)) selection.ooga = world.pilot;
    world.pilot = null;
    if (!names.includes(selection.ooga)) selection.ooga = null;
    const first = own || selection.ooga || names[0] || null;
    const rest = names.filter((n) => n !== first);
    return [first, rest[0] || first, rest[1] || first, rest[2] || first];
  };
  const buildActors = (names) => {
    actors = names.map((name, i) => {
      const body = createNode();
      const cave = name ? models.caveman(contributors.traitsFor(name)) : null;
      if (cave) addChild(body, cave.root);
      const ring = createNode({ geometry: BM.ring(0) });
      const blob = createNode({ geometry: BM.splat(0), position: { x: 0, y: 1.9, z: 0 }, scale: { x: 0.8, y: 1, z: 0.8 }, visible: false });
      const bubble = createNode({ geometry: BM.bubble(), visible: false });
      const netted = createNode({ geometry: BM.draped(), visible: false });
      const held = createNode({ geometry: BM.crate(0), position: { x: 0, y: 1.95, z: 0.1 }, visible: false });
      const trolley = createNode({ geometry: BM.trolley(), position: { x: 0, y: C.ZIP_HANG + 0.15, z: 0 }, visible: false });
      addChild(body, ring, blob, bubble, netted, held, trolley);
      // The gun sits in the right hand, its muzzle along the arm; the caveman's own club stays home.
      let gun = null;
      if (cave) {
        const h = cave.headOffset / 1.1, u = h / 16;
        gun = createNode({ geometry: BM.gun(0), position: { x: 0, y: -10 * u, z: 0.03 }, rotation: { x: Math.PI / 2, y: 0, z: 0 }, scale: { x: h / 1.5, y: h / 1.5, z: h / 1.5 }, visible: false });
        addChild(cave.parts.armR, gun);
        if (cave.parts.club) cave.parts.club.visible = false;
      }
      place(body);
      if (cave) input.add(cave.parts.torso, { kind: "ooga", index: i, priority: 1 });
      // A companion a character file hangs on its Ooga (`parts.dog`) is let off the lead here: it is lifted off the
      // body into the arena and trots after its Ooga each frame (`poseCompanions`).
      let pet = null;
      if (cave && cave.parts.dog) {
        const node = cave.parts.dog;
        removeChild(cave.root, node);
        place(node);
        pet = { node, x: 0, y: 0, z: 0, heading: 0, step: 0, warm: false };
      }
      return { body, cave, ring, blob, bubble, netted, held, trolley, gun, pet, phase: 0, name };
    });
  };
  const disposeActors = () => {
    if (!actors) return;
    for (const a of actors) {
      if (a.cave) input.remove(a.cave.parts.torso);
      for (const node of a.pet ? [a.body, a.pet.node] : [a.body]) {
        removeChild(root, node);
        const i = placed.indexOf(node);
        if (i >= 0) placed.splice(i, 1);
      }
    }
    actors = null;
  };
  // A new Ooga picked on the board: the four are cast again round it.
  const chooseOoga = (name) => {
    if (BL.net.ownAmong(contributors.activeRoster)) return;
    selection.ooga = name;
    disposeActors();
    buildActors(castNames());
    for (let i = 0; i < 4; i++) sim.actors[i].name = actors[i].name;
    paintTeams();
  };
  // Team colours go on once a side is chosen.
  const paintTeams = () => {
    for (let i = 0; i < 4; i++) {
      const t = sim.actors[i].team, a = actors[i];
      a.ring.geometry = BM.ring(TEAM_INDEX[t]);
      a.blob.geometry = BM.splat(TEAM_INDEX[SIM.other(t)] + 2 * (i % 3));
    }
  };
  const say = (i, list, dur = 1.6) => {
    const a = actors[i];
    if (a && a.cave) fx.say(a.cave, pick(list, lineN++), dur);
  };

  // A splat decal where a ball landed: flat on the ground, or stood against the face of the wall it hit.
  const stamp = (team, x, y, z) => {
    const node = splats[splatNext];
    splatNext = (splatNext + 1) % MAX_SPLATS;
    node.geometry = BM.splat(TEAM_INDEX[team] + 2 * (splatNext % 3));
    node.visible = true;
    const s = 0.7 + (splatNext % 4) * 0.12;
    setVec(node.scale, s, 1, s);
    if (y < 0.2) {
      setVec(node.position, x, 0.07 + (splatNext % 5) * 0.002, z);
      setVec(node.rotation, 0, splatNext * 1.3, 0);
      return;
    }
    // The nearest face of the block it went into, and the decal just outside it.
    let best = Infinity, nx = 0, nz = 0, px = x, pz = z;
    for (const b of SIM.ARENA.BLOCKS) {
      if (x < b[0] - 0.3 || x > b[1] + 0.3 || z < b[2] - 0.3 || z > b[3] + 0.3) continue;
      for (const [d, fx2, fz2, qx, qz] of [[Math.abs(x - b[0]), -1, 0, b[0], z], [Math.abs(b[1] - x), 1, 0, b[1], z], [Math.abs(z - b[2]), 0, -1, x, b[2]], [Math.abs(b[3] - z), 0, 1, x, b[3]]]) {
        if (d < best) { best = d; nx = fx2; nz = fz2; px = qx; pz = qz; }
      }
    }
    if (best === Infinity) {
      // The arena's rim or open air: drop it to the ground.
      setVec(node.position, x, 0.07, z);
      setVec(node.rotation, 0, splatNext * 1.3, 0);
      return;
    }
    setVec(node.position, px + nx * 0.03, y, pz + nz * 0.03);
    setVec(node.rotation, Math.PI / 2, Math.atan2(nx, nz), 0);
  };

  const T = BL.blockTrivia;
  const nextQuestion = () => {
    if (!quiz.deck.length) {
      for (let i = 0; i < T.length; i++) quiz.deck.push(i);
      for (let i = quiz.deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)), t = quiz.deck[i]; quiz.deck[i] = quiz.deck[j]; quiz.deck[j] = t; }
    }
    quiz.index = quiz.deck.pop();
    const item = T[quiz.index], order = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t; }
    el.quizQ.textContent = item.q;
    for (let k = 0; k < 4; k++) {
      const b = el.answers[k];
      b.textContent = `${k + 1}. ${item.answers[order[k]]}`;
      b.dataset.mark = "";
      b.disabled = false;
      if (order[k] === 0) quiz.right = k;
    }
    quiz.locked = false;
    quiz.asked++;
  };
  const openQuiz = () => {
    quiz.open = true;
    nextQuestion();
    el.quizNote.textContent = COARSE ? "Tap the right answer to break the bubble." : "Click or press 1 to 4. Right answer breaks the bubble.";
    el.quiz.hidden = false;
    hud.el.act.hidden = el.paintBtn.hidden = true;
  };
  const closeQuiz = () => {
    quiz.open = quiz.locked = false;
    window.clearTimeout(quiz.lockTimer);
    if (el.quiz) el.quiz.hidden = true;
    if (phase === "play" && hud) hud.el.act.hidden = el.paintBtn.hidden = !COARSE;
  };
  const answer = (k) => {
    if (!quiz.open || quiz.locked || phase !== "play") return;
    const item = T[quiz.index];
    if (k === quiz.right) {
      el.answers[k].dataset.mark = "right";
      quiz.solved++;
      closeQuiz();
      SIM.escape(sim, 0);
      center("FREE!", 900);
      notice(item.fact, 4500);
      return;
    }
    el.answers[k].dataset.mark = "wrong";
    el.answers[quiz.right].dataset.mark = "right";
    for (const b of el.answers) b.disabled = true;
    quiz.locked = true;
    el.quizNote.textContent = `Not quite. ${item.fact}`;
    quiz.lockTimer = window.setTimeout(() => {
      if (!quiz.open) return;
      nextQuestion();
      el.quizNote.textContent = "Try this one.";
    }, WRONG_LOCK_MS);
  };
  const onAnswer = (e) => { const k = Number(e.currentTarget.dataset.answer); e.currentTarget.blur(); answer(k); };

  const showBoard = () => {
    closeQuiz();
    phase = "board";
    el.board.hidden = false;
    el.results.hidden = el.strip.hidden = el.center.hidden = el.notice.hidden = el.toolBar.hidden = true;
    hud.el.act.hidden = el.paintBtn.hidden = el.cross.hidden = true;
    if (document.pointerLockElement === el.canvas) document.exitPointerLock();
    for (const b of el.teams) b.setAttribute("aria-pressed", String(b.dataset.team === selection.team));
    el.best.textContent = game.state.block.best ? fmt(game.state.block.best) : "none yet";
    el.record.textContent = `${game.state.block.wins} won of ${game.state.block.games}`;
  };
  const fmt = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const start = () => {
    if (!actors || !actors[0].cave) return;
    sim.team = selection.team;
    sim.rival = SIM.other(selection.team);
    for (let i = 0; i < 4; i++) sim.actors[i].team = i < 2 ? sim.team : sim.rival;
    SIM.reset(sim, (Date.now() & 0x7fffffff) || 1);
    paintTeams();
    for (const s of splats) s.visible = false;
    phase = "play";
    result = null;
    closeQuiz();
    el.board.hidden = el.results.hidden = true;
    el.strip.hidden = el.toolBar.hidden = false;
    el.notice.hidden = false;
    hud.el.act.hidden = !COARSE;
    hud.setAct("Jump");
    el.paintBtn.hidden = !COARSE;
    el.cross.hidden = COARSE && !cam.first;
    cam.yaw = cam.face = sim.team === "blue" ? Math.PI : 0;
    cam.pitch = 0.28;
    cam.warm = false;
    controls.reset();
    tool = "paint";
    updateTools();
    lockMouse();
    center(`BUILD ${Math.ceil(sim.prep)}`, 0);
    notice(COARSE ? "Fortify! Crate drops one · walk into crates to push" : "Fortify! B drops a crate · F lifts and stacks", 0);
    updateStrip();
  };
  const finish = () => {
    closeQuiz();
    phase = "results";
    const won = sim.winner === sim.team, ms = Math.round(sim.time * 1000);
    const best = game.recordBlock({ won, ms });
    result = { won, ms, best };
    el.strip.hidden = el.toolBar.hidden = true;
    el.center.hidden = el.notice.hidden = true;
    hud.el.act.hidden = el.paintBtn.hidden = el.cross.hidden = true;
    if (document.pointerLockElement === el.canvas) document.exitPointerLock();
    el.resultTitle.textContent = won ? "Blocks mined!" : "Rivals mined it";
    el.summary.textContent = `${sim.score[sim.team]} to ${sim.score[sim.rival]} in ${fmt(ms)}${best ? " · fastest win yet!" : ""}`;
    const me = sim.actors[0];
    el.stats.innerHTML = "";
    for (const [label, value] of [["Your captures", me.captures], ["Times splatted", me.splats], ["Fastest win", game.state.block.best ? fmt(game.state.block.best) : "—"], ["Rounds won", `${game.state.block.wins} of ${game.state.block.games}`]]) {
      const li = document.createElement("li"), span = document.createElement("span"), b = document.createElement("b");
      span.textContent = label;
      b.textContent = String(value);
      li.append(span, b);
      el.stats.append(li);
    }
    el.results.hidden = false;
    if (won) for (const a of actors.slice(0, 2)) if (a.cave) fx.burst(a.body.position.x, 1.5, a.body.position.z, 24, ORANGE_BITS, 3);
  };

  let centerTimer = 0, noticeTimer = 0;
  const center = (text, ms) => {
    el.center.textContent = text;
    el.center.hidden = false;
    window.clearTimeout(centerTimer);
    if (ms) centerTimer = window.setTimeout(() => { el.center.hidden = true; }, ms);
  };
  const notice = (text, ms) => {
    el.notice.textContent = text;
    el.notice.hidden = false;
    window.clearTimeout(noticeTimer);
    if (ms) noticeTimer = window.setTimeout(() => { el.notice.textContent = " "; }, ms);
  };
  const STATE_WORDS = { home: "home", carried: "taken", dropped: "dropped", flying: "in the air" };
  let stripKey = "";
  const updateStrip = () => {
    const own = sim.flags[sim.team], theirs = sim.flags[sim.rival], me = sim.actors[0];
    const key = `${sim.score.blue}${sim.score.red}${own.state}${theirs.state}${me.carrying}${me.splat > 0}${Math.ceil(sim.time)}`;
    if (key === stripKey) return;
    stripKey = key;
    el.scoreBlue.textContent = String(sim.score.blue);
    el.scoreRed.textContent = String(sim.score.red);
    el.own.textContent = STATE_WORDS[own.state];
    el.own.dataset.state = own.state;
    el.theirs.textContent = me.carrying ? "carrying!" : STATE_WORDS[theirs.state];
    el.theirs.dataset.state = me.carrying ? "carried" : theirs.state;
    el.time.textContent = fmt(sim.time * 1000);
    el.drop.disabled = !me.carrying;
    if (el.passBtn) el.passBtn.disabled = !me.carrying;
  };

  // The sim's events since the last frame: splats, sayings, notices.
  const readEvents = () => {
    for (let i = 0; i < sim.eventCount; i++) {
      const e = sim.events[i], mine = e.team === sim.team, me = e.actor === 0;
      if (e.type === "miss") stamp(e.team, e.x, e.y, e.z);
      else if (e.type === "splat") {
        stamp(SIM.other(e.team), e.x, 0, e.z);
        fx.burst(e.x, e.y + 0.4, e.z, 10, PAINT_BITS[SIM.other(e.team)], 2.4);
        if (me) { center("SPLAT!", 900); notice("Paint in eye! Wait it out…", 2000); }
        if (e.actor >= 0) say(e.actor, LINES.splat, 1.2);
      } else if (e.type === "pickup") {
        fx.burst(e.x, 1.2, e.z, 14, ORANGE_BITS, 2);
        if (me) { center("GOT THE BLOCK!", 1100); notice(COARSE ? "Run it home · Drop hands it off" : "Run it home to your stand · G drops it", 4000); }
        else if (mine) notice("Teammate has the block! Cover them!", 2500);
        else { notice("They took your block! Paint the carrier!", 2500); say(1, LINES.lost); }
        say(e.actor, LINES.pickup);
      } else if (e.type === "capture") {
        fx.burst(e.x, 1.4, e.z, 30, ORANGE_BITS, 3.2);
        center(mine ? "BLOCK MINED!" : "THEY MINED ONE", 1300);
        say(e.actor, LINES.capture);
      } else if (e.type === "return") {
        if (e.team === sim.team) notice("Your block is home", 1800);
        else notice("Their block is back on its stand", 1800);
      } else if (e.type === "rescue") {
        if (e.team === sim.team) notice(me ? "Got our block back! Carry it home to your stand" : "Teammate has our block · cover them home", 2500);
        else notice("They grabbed their block back! Stop them before their stand", 2500);
        say(e.actor, LINES.rescue);
      } else if (e.type === "knock" || e.type === "drop") {
        if (e.team === sim.team) notice("Our block is loose! Grab it and carry it home", 2500);
        else notice(me ? "Block dropped · grab it again, or a teammate can" : "Their block is down! Grab it", 2500);
      } else if (e.type === "go") {
        center("GO!", 900);
        notice(COARSE ? `Steal the ${sim.rival} block · bring it home · Pass throws it` : `Steal the ${sim.rival} block · bring it home · Tab throws it to a friend`, 4500);
      } else if (e.type === "build") {
        fx.burst(e.x, 0.6, e.z, 8, WOOD_BITS, 1.6);
        if (me) updateTools();
      } else if (e.type === "pop" || e.type === "boom") {
        const big = e.type === "boom";
        stamp(e.team, e.x, Math.min(e.y, 0.1), e.z);
        for (let k = 0; k < (big ? 5 : 3); k++) { const a = k * 2.1 + e.x, r = big ? 1.6 : 1.1; stamp(e.team, e.x + Math.sin(a) * r, Math.min(e.y, 0.1), e.z + Math.cos(a) * r); }
        fx.burst(e.x, e.y + 0.3, e.z, big ? 30 : 18, PAINT_BITS[e.team], big ? 4.2 : 3);
        if (big) say(e.actor, LINES.boom, 1.2);
      } else if (e.type === "net") {
        fx.burst(e.x, e.y, e.z, 10, NET_BITS, 1.8);
        if (me) { center("NETTED!", 900); notice("Tangled! Slow and no jumping for a few seconds", 2200); }
        say(e.actor, LINES.net, 1.4);
      } else if (e.type === "netmiss") fx.burst(e.x, e.y, e.z, 6, NET_BITS, 1.2);
      else if (e.type === "refill") { if (me) { notice("Refilled: grenades, rockets and nets", 1600); updateTools(); } }
      else if (e.type === "throw") { if (e.actor === 0) updateTools(); }
      else if (e.type === "rifle") { if (me) { center("SNIPER RIFLE!", 1000); notice("5 rounds · press 5 (or R) · V for the scope · E rides the zipline", 3600); updateTools(); } }
      else if (e.type === "cache") { fx.burst(e.x, e.y + 0.5, e.z, 10, ORANGE_BITS, 1.6); if (me) { notice("Ammo cache! Grenades, rockets and nets refilled", 1800); updateTools(); } }
      else if (e.type === "climbed") { if (me) updateTools(); }
      else if (e.type === "zip") { if (me) { center("ZIP!", 700); notice("Space lets go early", 1600); } }
      else if (e.type === "unzip") { if (me) updateTools(); }
      else if (e.type === "waiting") {
        if (me) { center("NOT YET!", 1200); notice("Your own block isn't home, so you can't score. Hold on here while your team brings it back, or go get it", 4000); }
        else if (mine) notice("Teammate is waiting at our stand · get our block home so they can score", 3000);
      } else if (e.type === "lift" || e.type === "set") {
        if (e.actor === 0) updateTools();
        if (e.type === "set") fx.burst(e.x, e.y + 0.2, e.z, 6, WOOD_BITS, 1.2);
        if (e.type === "lift" && e.actor === 0) notice("Crate up! Click throws it · F sets it down or stacks it", 2200);
      } else if (e.type === "smash") fx.burst(e.x, e.y + 0.4, e.z, 14, WOOD_BITS, 2.4);
      else if (e.type === "bonk") {
        fx.burst(e.x, e.y + 0.8, e.z, 14, STAR_BITS, 2.2);
        if (me) { center("BONK!", 900); notice("Crate to the head! Seeing stars…", 2000); }
        say(e.actor, LINES.bonk, 1.3);
      } else if (e.type === "pass") {
        if (me) notice("Block thrown! A teammate can catch it", 1500);
        else if (mine) notice("Pass! Catch it", 1500);
        else notice("They threw a block · intercept it!", 1500);
      } else if (e.type === "landed") fx.burst(e.x, e.y + 0.3, e.z, 8, e.team === "blue" ? PAINT_BITS.blue : PAINT_BITS.red, 1.4);
      else if (e.type === "winded") { if (me) notice("Out of breath! Sprint refills in a moment", 1400); }
      else if (e.type === "weather") {
        const w = sim.weather.kind;
        notice(w === "storm" ? "A storm rolls in! Hold on to something" : w === "breeze" ? "The wind picks up · throws drift" : "The sky clears", 2400);
      } else if (e.type === "trap") {
        fx.burst(e.x, 1, e.z, 12, QUIZ_BITS, 2);
        if (me) { center("QUIZ TRAP!", 1000); openQuiz(); }
        else say(e.actor, LINES.trap, 2);
      } else if (e.type === "escape") {
        fx.burst(e.x, 1.2, e.z, 14, QUIZ_BITS, 2.6);
        if (!me) say(e.actor, LINES.free, 1.4);
      } else if (e.type === "timeout") {
        fx.burst(e.x, 1.2, e.z, 10, QUIZ_BITS, 2);
        if (me) { closeQuiz(); notice("The bubble wore off. Run!", 2200); }
      } else if (e.type === "win") say(e.actor, LINES.win, 2.4);
    }
    sim.eventCount = 0;
  };

  // Space and the act button start a round from the board or the results; in play they fall through to the jump.
  const act = () => {
    if (phase === "board" || phase === "results") { start(); return true; }
    return false;
  };
  // Paint along the camera's look, lobbed a little higher when the camera looks up.
  // In first person the ball goes where the eye looks, less the lob the throw adds.
  const lookUp = () => clamp(-(cam.pitch - 0.28) * 1.6, -0.9, 0.9);
  // Grenades lob higher; the chase camera's tilt still nudges every throw up or down.
  // Aiming: the crosshair is the middle of the view, so a throw goes from the Ooga toward wherever the camera's
  // centre ray meets something (or 30 m out), less the lift the throw adds itself; a grenade arcs higher.
  const AIM = { x: 0, y: 0, z: 0 };
  const aimPoint = () => {
    const p = camera.position, t = camera.target;
    let fx = t.x - p.x, fy = t.y - p.y, fz = t.z - p.z;
    const l = Math.hypot(fx, fy, fz) || 1;
    fx /= l; fy /= l; fz /= l;
    // Start past the Ooga so the ray never stops on the Ooga's own spot.
    let d = cam.first ? 0.5 : CAM.dist * 0.9;
    for (; d < 30; d += 0.4) if (SIM.solidAt(p.x + fx * d, p.y + fy * d, p.z + fz * d)) break;
    AIM.x = p.x + fx * d; AIM.y = p.y + fy * d; AIM.z = p.z + fz * d;
    return AIM;
  };
  const paint = () => {
    const a = sim.actors[0], q = aimPoint(), oy = a.y + (a.crouch ? C.CROUCH_H - 0.25 : C.SHOT_Y);
    // With Lift chosen and empty hands, a click lifts the crate in front; holding a crate, a throw throws the crate.
    if (tool === "grab" && !a.holding) return grabCrate();
    if (a.holding) {
      const cdx = q.x - a.x, cdz = q.z - a.z, cflat = Math.hypot(cdx, cdz) || 1;
      const thrown = SIM.fire(sim, 0, Math.atan2(cdx, cdz), clamp(Math.atan2(q.y - a.y - 1.7, cflat) - 0.05, -0.6, 0.6), "crate");
      if (!thrown && a.splat > 0) notice(`Splatted · throwing again in ${Math.ceil(a.splat)} s`, 900);
      else if (thrown && tool !== "grab") notice(`Crate thrown · ${tool} ready`, 900);
      return thrown;
    }
    const dx = q.x - a.x, dz = q.z - a.z, flat = Math.hypot(dx, dz) || 1;
    const lob = tool === "grenade" ? 0.3 : tool === "rocket" || tool === "sniper" ? 0 : tool === "net" ? -0.12 : -0.09;
    const pitch = clamp(Math.atan2(q.y - oy, flat) + lob, -0.9, 0.9);
    const ok = SIM.fire(sim, 0, Math.atan2(dx, dz), pitch, tool);
    // Say why a throw didn't go, so the tools never seem locked: paint on you, a quiz bubble, or an empty tool.
    if (!ok && a.splat > 0) notice(`Splatted · throwing again in ${Math.ceil(a.splat)} s`, 900);
    else if (!ok && a.trapped > 0) notice("Answer the question to get out first", 1100);
    else if (!ok && tool === "sniper" && a.sniper <= 0) notice("No sniper rounds · climb a sniper tower for the rifle", 1600);
    else if (!ok && tool !== "paint" && a[tool] <= 0) notice(`Out of ${tool}s · refill on your stand or an ammo cache`, 1400);
    return ok;
  };
  const chooseTool = (k) => {
    tool = k;
    updateTools();
  };
  // The next tool along (or back), skipping any that are empty, then Lift for the crates; a right click or R steps
  // through them.
  const ORDER = ["paint", "grenade", "rocket", "net", "sniper", "grab"];
  const cycleTool = (dir = 1) => {
    const a = sim.actors[0];
    let i = ORDER.indexOf(tool);
    for (let n = 0; n < ORDER.length; n++) {
      i = (i + dir + ORDER.length) % ORDER.length;
      if (ORDER[i] === "paint" || ORDER[i] === "grab" || a[ORDER[i]] > 0) break;
    }
    chooseTool(ORDER[i]);
    if (ORDER[i] === "grab") notice("Lift · click lifts a crate, click or Tab throws it, F sets it down", 1400);
    else notice(`${ORDER[i][0].toUpperCase()}${ORDER[i].slice(1)}${ORDER[i] === "paint" ? "" : ` · ${a[ORDER[i]]} left`}`, 900);
  };
  const onRightDown = (e) => {
    if (e.button !== 2 || phase !== "play") return;
    e.preventDefault();
    cycleTool(1);
  };
  const noMenu = (e) => { if (phase === "play") e.preventDefault(); };
  const buildCrate = () => {
    if (phase !== "play") return false;
    if (SIM.build(sim, 0, cam.face)) return true;
    const a = sim.actors[0];
    notice(a.crates <= 0 ? "No crates left" : "Can't put a crate there · your own half, clear ground", 1200);
    return false;
  };
  const updateTools = () => {
    if (!sim || !el.tools) return;
    const a = sim.actors[0];
    for (const b of el.tools) {
      const k = b.dataset.tool;
      b.setAttribute("aria-pressed", String(k === tool));
      const n = b.querySelector("b");
      if (n) n.textContent = k === "paint" ? "∞" : k === "crate" ? String(a.crates) : String(a[k]);
      if (k === "pass") b.disabled = !a.carrying && !a.holding;
      if (k === "zip") b.disabled = !SIM.nearZip(sim, a);
      if (k === "grab") b.setAttribute("aria-pressed", String(a.holding || tool === "grab"));
    }
  };
  const setView = (first) => {
    cam.first = first;
    cam.warm = false;
    el.cross.hidden = phase !== "play" || (COARSE && !first);
    el.viewBtn.setAttribute("aria-pressed", String(first));
    // Switching on from a key or a click is a gesture, so the mouse can lock straight away.
    if (first) lockMouse();
    notice(first ? (COARSE ? "First person · drag to aim" : "First person · move the mouse to aim · V goes back") : "Chase camera · move the mouse to turn", 1800);
  };
  // Mouse look, as a shooter has it: the first click on the view locks the mouse (and throws), then moving the mouse
  // or touchpad turns the view in either camera, the world swinging round the Ooga, which turns with it to face the
  // aim. Unlocked, a plain move still aims in first person; in the chase camera a drag turns it (the orbit hook).
  // Escape lets the mouse go.
  const locked = () => document.pointerLockElement === el.canvas;
  const onLockedMove = (e) => {
    if (phase !== "play" || quiz.open) return;
    if (!locked() && (!cam.first || e.buttons !== 0)) return;
    cam.face = wrap(cam.face - e.movementX * 2.6e-3);
    cam.pitch = cam.first ? clamp(cam.pitch + e.movementY * 2.2e-3, -0.3, 0.86) : clamp(cam.pitch + e.movementY * 2.2e-3, CAM.pitch[0], CAM.pitch[1]);
  };
  const lockMouse = () => {
    if (COARSE || locked() || !el.canvas.requestPointerLock) return;
    const lock = el.canvas.requestPointerLock();
    if (lock && lock.catch) lock.catch(() => { });
  };
  const onLockedDown = (e) => {
    if (phase !== "play" || e.button !== 0 || quiz.open) return;
    paint();
    lockMouse();
  };
  // Tab passes in play, wherever the focus is: caught first, before the page's own key routing (which leaves Tab on a
  // focused button to the browser) and before the browser moves the focus.
  const onTabKey = (e) => {
    if (e.key !== "Tab" || phase !== "play" || quiz.open) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    if (!e.repeat) passBlock();
  };
  const onCrouchKey = (e) => { if (e.key === "c" || e.key === "C") move.crouch = e.type === "keydown" ? 1 : 0; };
  // Pick up the crate in front, or set the held one down (stacking it on a crate there).
  const grabCrate = () => {
    if (phase !== "play") return false;
    if (SIM.grab(sim, 0, cam.face)) return true;
    const a = sim.actors[0];
    notice(a.holding ? "No room to set it there (stacks go three high)" : a.carrying ? "Hands full with the block" : "No crate in reach · face one and press F", 1200);
    return false;
  };
  // Throw whatever is in hand: a held crate toward the crosshair, or the carried block straight ahead for a teammate
  // to catch.
  const passBlock = () => {
    if (phase !== "play") return false;
    if (sim.actors[0].holding) return paint();
    if (SIM.pass(sim, 0, cam.face)) return true;
    notice("Nothing to throw · pick up a block, or a crate with F", 1100);
    return false;
  };
  // Ride your tower's zipline down into the rival fort, from the platform by its gap.
  const zipNow = () => {
    if (phase !== "play") return false;
    if (SIM.zip(sim, 0, cam.face)) return true;
    const a = sim.actors[0];
    notice(sim.prep > 0 ? "The zipline opens when the round starts" : a.holding ? "Put the crate down first (F)" : "Climb your sniper tower's ladder and stand by the cable to ride", 1600);
    return false;
  };
  const dropBlock = () => {
    if (phase !== "play") return false;
    if (SIM.drop(sim, 0)) return true;
    notice("Nothing to drop", 900);
    return false;
  };

  // Steering, as Mario 64 has it: A and D (the stick's sideways push, and Q E) turn the Ooga, W and S run it forward
  // and back along where it faces, and the chase camera swings round behind it by itself (`updateCamera`), so the
  // world turns, not the Ooga on screen. A locked mouse turns it too.
  const TURN = 2.7;
  const readInput = (dt) => {
    const a = controls.read();
    cam.face = wrap(cam.face + (a.yaw - a.x) * TURN * dt);
    const fx2 = Math.sin(cam.face), fz = Math.cos(cam.face), f = clamp(a.y, -1, 1);
    move.x = fx2 * f;
    move.z = fz * f;
    move.sprint = a.sprint;
    move.face = cam.face;
    if (quiz.open) move.crouch = 0;
    const up = a.up > 0;
    // A new press waits for the sim to use it (it clears `jump`), however many substeps this frame runs, even none.
    if (up && !jumpWas) move.jump = 1;
    jumpWas = up;
  };
  // Each pet heads for a spot a little behind and beside its Ooga, trots there at up to sprint pace with a hop in its
  // step, sits when it arrives, and jumps straight to its Ooga if it falls far behind (a roof, a double jump).
  const PET_BACK = 1.1, PET_SIDE = 0.6, PET_SPEED = 9.5;
  const poseCompanions = (dt, elapsed) => {
    for (let i = 0; i < 4; i++) {
      const a = actors[i], p = a.pet;
      if (!p) continue;
      const s = sim.actors[i], h = a.body.rotation.y;
      const tx = s.x - Math.sin(h) * PET_BACK + Math.cos(h) * PET_SIDE, tz = s.z - Math.cos(h) * PET_BACK - Math.sin(h) * PET_SIDE;
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (!p.warm || d > 7) { p.x = tx; p.z = tz; p.warm = true; }
      else if (d > 0.15) {
        const step = Math.min(d, PET_SPEED * dt * Math.min(1, d / 1.2 + 0.25));
        p.x += dx / d * step; p.z += dz / d * step;
        p.heading = Math.atan2(dx, dz);
        p.step += step * 9;
      } else p.heading = h;
      const ground = SIM.groundAt(p.x, p.z, s.y + 0.1, 0.15);
      p.y = damp(p.y, ground, 18, dt);
      const moving = d > 0.15;
      setVec(p.node.position, p.x, p.y + (moving ? Math.abs(Math.sin(p.step)) * 0.08 : 0), p.z);
      p.node.rotation.y = p.heading;
      p.node.rotation.z = moving ? Math.sin(p.step) * 0.08 : 0;
      p.node.visible = a.body.visible || i === 0;
    }
  };
  const poseActors = (dt, elapsed) => {
    for (let i = 0; i < 4; i++) {
      const s = sim.actors[i], a = actors[i];
      setVec(a.body.position, s.x, s.y, s.z);
      a.body.visible = !(i === 0 && cam.first && phase === "play");
      a.body.scale.y = s.crouch ? 0.66 : 1;
      a.body.rotation.y = damp(a.body.rotation.y, a.body.rotation.y + wrap(s.heading - a.body.rotation.y), 14, dt);
      a.ring.visible = s.grounded;
      a.bubble.visible = s.trapped > 0;
      a.netted.visible = s.netted > 0;
      a.held.visible = s.holding && !(i === 0 && cam.first);
      if (s.holding) a.held.geometry = BM.crate(TEAM_INDEX[s.team]);
      a.trolley.visible = s.riding;
      // The gun in hand: the visitor's chosen tool, a bot's last throw; none while carrying, lifting or riding.
      const g = GUN_OF[i === 0 ? tool : s.lastKind || "paint"];
      const armed = g >= 0 && !s.carrying && !s.holding && !s.riding && !s.climbing && s.splat <= 0 && s.trapped <= 0;
      if (a.gun) {
        a.gun.visible = armed;
        if (armed) a.gun.geometry = BM.gun(g * 2 + TEAM_INDEX[s.team]);
      }
      // A crate to the head shows stars, not paint.
      a.blob.visible = s.splat > 0 && !s.bonked;
      if (s.trapped > 0) a.bubble.rotation.y = elapsed * 0.8;
      if (!a.cave) continue;
      const p = a.cave.parts;
      if (s.splat > 0) {
        // Splatted: arms up, wobbling, feet together.
        const w = Math.sin(elapsed * 9 + i) * 0.15;
        p.armL.rotation.x = p.armR.rotation.x = -2.6 + w;
        p.legL.rotation.x = p.legR.rotation.x = 0;
        a.blob.rotation.y += dt * 2;
        continue;
      }
      if (s.trapped > 0) {
        // Thinking: one hand on the chin, the other on the hip.
        p.armR.rotation.x = -2 + Math.sin(elapsed * 2 + i) * 0.1;
        p.armL.rotation.x = -0.3;
        p.legL.rotation.x = p.legR.rotation.x = 0;
        continue;
      }
      if (s.riding || s.climbing) {
        // Hanging from the trolley, or hand over hand up a ladder.
        const k = s.climbing ? Math.sin(elapsed * 9) * 0.4 : 0;
        p.armL.rotation.x = -2.9 + k; p.armR.rotation.x = -2.9 - k;
        p.legL.rotation.x = s.climbing ? -k : 0.3; p.legR.rotation.x = s.climbing ? k : -0.2;
        continue;
      }
      if (!s.grounded) {
        // In the air: knees up, arms out for balance.
        p.legR.rotation.x = -0.7; p.legL.rotation.x = 0.3;
        p.armL.rotation.x = p.armR.rotation.x = s.carrying ? -2.9 : -1.2;
        continue;
      }
      const sp = s.moving;
      a.phase += dt * sp * 2.1;
      const swing = Math.sin(a.phase) * Math.min(1, sp / 3);
      p.legR.rotation.x = swing * 0.6;
      p.legL.rotation.x = -swing * 0.6;
      if (s.carrying || s.holding) {
        // Both hands up holding the block (or a crate) overhead.
        p.armL.rotation.x = p.armR.rotation.x = -2.9;
      } else if (armed) {
        // Gun up and forward, the other hand under it; a big launcher sits higher, on the shoulder.
        const kick = s.cooldown > (s.bot ? C.BOT_COOLDOWN : SIM.TOOLS.paint.cool) - 0.12 ? 0.18 : 0;
        p.armR.rotation.x = (g === 2 ? -1.75 : -1.45) - kick;
        p.armL.rotation.x = g === 2 ? -1.9 : -1.25;
      } else {
        p.armR.rotation.x = s.cooldown > (s.bot ? C.BOT_COOLDOWN : SIM.TOOLS.paint.cool) - 0.2 ? -1.5 : -0.2 - swing * 0.35;
        p.armL.rotation.x = -0.2 + swing * 0.35;
      }
      // Guard after a splat blinks the ring.
      if (s.guard > 0) a.ring.visible = Math.sin(elapsed * 20) > 0;
    }
  };
  const poseBlocks = (elapsed) => {
    for (const t of SIM.TEAMS) {
      const f = sim.flags[t], b = blocks[t];
      let y = 1.3 + Math.sin(elapsed * 2.2 + TEAM_INDEX[t]) * 0.08;
      if (f.state === "carried") {
        const s = sim.actors[f.carrier];
        y = s.y + 2.45 + Math.sin(elapsed * 6) * 0.04;
      } else if (f.state === "dropped") y = f.y + 0.5 + Math.sin(elapsed * 3) * 0.06;
      else if (f.state === "flying") y = f.y;
      setVec(b.node.position, f.x, y, f.z);
      b.node.rotation.y = elapsed * (f.state === "carried" ? 3 : f.state === "flying" ? 12 : 0.9);
      b.node.glow = f.state === "dropped" ? 0.7 + 0.3 * Math.sin(elapsed * 8) : 1;
      // The countdown ring under a dropped block, one tick for each part of its twenty seconds left.
      // The ring of ticks spins round a dropped block so it is easy to find; it stays until someone picks it up.
      const shown = f.state === "dropped" ? ticks[t].length : 0;
      b.tickRoot.rotation.y = elapsed * 1.5;
      setVec(b.tickRoot.position, f.x, f.y + 0.05, f.z);
      for (let k = 0; k < ticks[t].length; k++) ticks[t][k].visible = k < shown;
    }
  };
  const poseCrates = () => {
    for (let i = 0; i < crates.length; i++) {
      const c = sim.crates[i], n = crates[i];
      n.visible = c.live;
      if (!c.live) continue;
      setVec(n.position, c.x, c.y, c.z);
      n.geometry = BM.crate(TEAM_INDEX[c.team]);
    }
  };
  // The sky follows the weather: a storm darkens the light and thickens the cloud, rain falls slanted by the wind
  // round the camera, and now and then lightning flashes.
  const poseWeather = (dt) => {
    const w = sim.weather, storm = w.kind === "storm" ? Math.min(1, w.strength / C.WIND.storm) : 0;
    RENDER_OPTS.clouds = 0.35 + 0.55 * storm;
    RENDER_OPTS.directStrength *= 1 - 0.55 * storm;
    RENDER_OPTS.sunStrength *= 1 - 0.55 * storm;
    flashT -= dt;
    if (storm > 0.6 && flashT <= 0 && Math.random() < dt * 0.25) { flash = 1; flashT = 3; }
    flash = Math.max(0, flash - dt * 5);
    RENDER_OPTS.ambientFloor = 0.22 + flash * 0.8;
    RENDER_OPTS.bloomStrength = 0.6 + flash * 1.2;
    const cx = camera.position.x, cz = camera.position.z, lean = 0.12;
    for (let i = 0; i < RAIN; i++) {
      const r = rain[i];
      r.node.visible = storm > 0.2 && i < RAIN * storm;
      if (!r.node.visible) continue;
      r.y -= dt * 14;
      r.x += w.x * dt * 0.8; r.z += w.z * dt * 0.8;
      if (r.y < 0 || Math.abs(r.x - cx) > 12 || Math.abs(r.z - cz) > 12) {
        r.x = cx + (Math.random() - 0.5) * 22; r.z = cz + (Math.random() - 0.5) * 22; r.y = 6 + Math.random() * 6;
      }
      setVec(r.node.position, r.x, r.y, r.z);
      r.node.rotation.x = w.z * lean; r.node.rotation.z = -w.x * lean;
    }
    // The wind sign: its strength, and an arrow turned to show where it blows relative to the camera.
    const key = `${w.kind}${Math.round(w.strength * 2)}${Math.round(wrap(Math.atan2(w.x, w.z) - cam.yaw) * 4)}`;
    if (key !== el.windKey) {
      el.windKey = key;
      el.windWord.textContent = WEATHER_WORDS[w.kind];
      el.windArrow.style.transform = `rotate(${(-wrap(Math.atan2(w.x, w.z) - cam.yaw)).toFixed(2)}rad)`;
      el.windArrow.style.opacity = String(Math.min(1, 0.25 + w.strength / C.WIND.storm));
    }
  };
  // The sprint gauge: full, draining while Shift is held, orange while it refills after running dry.
  const poseStamina = () => {
    const a = sim.actors[0], k = Math.round(a.stamina / C.SPRINT_S * 100);
    if (k === el.staminaK && a.tired === el.staminaTired) return;
    el.staminaK = k; el.staminaTired = a.tired;
    el.stamina.style.width = `${k}%`;
    el.stamina.dataset.tired = String(a.tired);
  };
  const posePads = (elapsed) => {
    for (let i = 0; i < pads.length; i++) {
      const t = sim.traps[i];
      pads[i].glow = t.dark > 0 ? 0.12 : 0.75 + 0.25 * Math.sin(elapsed * 3 + i);
    }
    if (quiz.open) el.quizFill.style.width = `${Math.max(0, sim.actors[0].trapped / C.TRAP_MAX_S * 100).toFixed(1)}%`;
    // An ammo cache glows while it's ready and goes grey while it rests.
    for (let i = 0; i < caches.length; i++) caches[i].geometry = BM.cache(sim.caches[i].dark > 0 ? 1 : 0);
    // The zipline button wakes as the visitor reaches the cable, with a word the first time.
    const near = phase === "play" && SIM.nearZip(sim, sim.actors[0]);
    if (near !== zipNear) {
      zipNear = near;
      updateTools();
      if (near) notice(COARSE ? "Zip rides the zipline into their fort" : "E rides the zipline into their fort", 2200);
    }
  };
  const poseShots = () => {
    for (let i = 0; i < sim.shots.length; i++) {
      const s = sim.shots[i], n = shots[i];
      n.visible = s.live;
      if (!s.live) continue;
      setVec(n.position, s.x, s.y, s.z);
      const t = TEAM_INDEX[s.team];
      n.geometry = s.kind === "grenade" ? BM.grenade(t) : s.kind === "rocket" ? BM.rocket(t) : s.kind === "net" ? BM.net() : s.kind === "crate" ? BM.crate(t) : BM.ball(t);
      n.rotation.y = Math.atan2(s.vx, s.vz);
      n.rotation.x = s.kind === "rocket" ? -Math.atan2(s.vy, Math.hypot(s.vx, s.vz)) : s.kind === "net" ? 0 : s.t * 9;
    }
  };
  const updateCamera = (dt) => {
    const me = sim ? sim.actors[0] : null, x = me ? me.x : 0, y = me ? me.y : 0, z = me ? me.z : 0;
    // First person looks exactly where the Ooga faces; the chase camera swings round behind it within a few frames.
    cam.yaw = cam.first || !cam.warm ? cam.face : wrap(cam.yaw + wrap(cam.face - cam.yaw) * Math.min(1, dt * 7));
    if (cam.first && me) {
      // The eye at the Ooga's eyes (lower when crouched), looking along the aim.
      const eye = y + (me.crouch ? 0.9 : 1.55), up = lookUp(), c = Math.cos(up);
      setVec(camera.position, x + Math.sin(cam.yaw) * 0.25, eye, z + Math.cos(cam.yaw) * 0.25);
      setVec(camera.target, x + Math.sin(cam.yaw) * c * 10, eye + Math.sin(up) * 10, z + Math.cos(cam.yaw) * c * 10);
      // The sniper's scope narrows the view; the gun in hand sits low and right of the eye.
      const scoped = tool === "sniper" && me.sniper > 0;
      camera.fov = damp(camera.fov, (scoped ? 22 : 58) * Math.PI / 180, 10, dt);
      const g = GUN_OF[tool], showGun = g >= 0 && !scoped && !me.carrying && !me.holding && !me.riding && !me.climbing && me.splat <= 0 && me.trapped <= 0;
      fpGun.visible = showGun;
      if (showGun) {
        fpGun.geometry = BM.gun(g * 2 + TEAM_INDEX[me.team]);
        const fx2 = Math.sin(cam.yaw) * c, fz2 = Math.cos(cam.yaw) * c, fy2 = Math.sin(up), rx = -Math.cos(cam.yaw), rz = Math.sin(cam.yaw);
        setVec(fpGun.position, camera.position.x + fx2 * 0.55 + rx * 0.24, eye + fy2 * 0.55 - (g === 2 ? 0.12 : 0.22), camera.position.z + fz2 * 0.55 + rz * 0.24);
        fpGun.rotation.y = cam.yaw;
        fpGun.rotation.x = -up;
      }
      setVec(RENDER_OPTS.shadowCenter, x, 0, z);
      return;
    }
    camera.fov = damp(camera.fov, 58 * Math.PI / 180, 10, dt);
    if (fpGun) fpGun.visible = false;
    // The eye comes in front of any wall between it and the Ooga, so a fort's back wall never fills the view.
    const c = Math.cos(cam.pitch), hx = -Math.sin(cam.yaw) * c, hz = -Math.cos(cam.yaw) * c, hy = Math.sin(cam.pitch), by = y + CAM.height;
    let dist = CAM.dist;
    for (let d = 0.5; d <= CAM.dist; d += 0.25) if (SIM.solidAt(x + hx * d, by + hy * d, z + hz * d)) { dist = Math.max(0.6, d - 0.4); break; }
    const ex = x + hx * dist, ez = z + hz * dist, ey = by + hy * dist;
    if (!cam.warm) {
      setVec(camera.position, ex, ey, ez);
      cam.warm = true;
    } else {
      camera.position.x = damp(camera.position.x, ex, 12, dt);
      camera.position.y = damp(camera.position.y, ey, 12, dt);
      camera.position.z = damp(camera.position.z, ez, 12, dt);
    }
    setVec(camera.target, x + Math.sin(cam.yaw) * 2, y + 1.9, z + Math.cos(cam.yaw) * 2);
    setVec(RENDER_OPTS.shadowCenter, x, 0, z);
  };
  // The board shows the whole fort from above its gate, slowly turning.
  const boardView = (elapsed) => {
    const t = selection.team, s = SIM.ARENA.stands[t], a = elapsed * 0.12;
    camera.fov = 58 * Math.PI / 180;
    if (fpGun) fpGun.visible = false;
    setVec(camera.position, s.x + Math.sin(a) * 16, 11, s.z * 0.55 + Math.cos(a) * 16);
    setVec(camera.target, s.x, 1, s.z * 0.8);
  };

  const update = (dt, elapsed) => {
    sceneTime = elapsed;
    daylight.sample(clock.read(), RENDER_OPTS, clock.dayOfYear, daylight.ISLAND_LATITUDE_DEG, clock.continuousDay, clock.utcMs);
    RENDER_OPTS.time = elapsed;
    if (phase === "play") {
      readInput(dt);
      const prepWas = sim.prep;
      SIM.step(sim, dt, move);
      if (sim.prep > 0 && Math.ceil(sim.prep) !== Math.ceil(prepWas)) center(`BUILD ${Math.ceil(sim.prep)}`, 0);
      readEvents();
      updateStrip();
      if (sim.over) finish();
    } else controls.read();
    poseActors(dt, elapsed);
    poseBlocks(elapsed);
    poseCrates();
    poseCompanions(dt, elapsed);
    poseStamina();
    posePads(elapsed);
    poseShots();
    if (phase === "board") boardView(elapsed);
    else updateCamera(dt);
    poseWeather(dt);
    fx.update(dt);
    stepTweens(dt);
  };
  const NO_EXTRA = () => { };
  const overlay = (dt) => fx.drawOverlay(dt, NO_EXTRA);

  const onDonation = (donation, counted = null) => {
    game.recordDonation(donation, counted && counted.exact);
    const bananas = gameMod.bananasFor(donation.sats), shown = counted ? counted.rounded : bananas;
    world.level = Math.min(pileMod.MAX_BANANAS, world.level + (counted ? counted.exact : bananas));
    hud.toast(`+${gameMod.formatLarge(donation.sats)} sats · ${gameMod.formatLarge(shown)} banana${shown === 1 ? "" : "s"} · ${donation.handle ? `@${donation.handle}` : "anon"}`);
    hud.setStats(game.state);
  };
  const onKey = (e) => {
    if (e.key === "Escape") {
      if (phase === "play" && locked()) document.exitPointerLock();
      else if (phase === "play" && cam.first) setView(false);
      else if (phase === "play" || phase === "results") showBoard();
      else go(home);
      return;
    }
    if (e.key === "Enter" && phase !== "play") start();
    else if (e.key === "Enter" && !e.repeat && !quiz.open) paint();
    if (phase !== "play" || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (quiz.open) {
      if (e.key >= "1" && e.key <= "4") answer(Number(e.key) - 1);
      return;
    }
    if (TOOL_KEYS[e.key]) chooseTool(TOOL_KEYS[e.key]);
    if (e.key === "t" || e.key === "T") passBlock();
    if (e.key === "r" || e.key === "R") cycleTool(1);
    if (e.key === "b" || e.key === "B") buildCrate();
    if (e.key === "f" || e.key === "F") grabCrate();
    if (e.key === "g" || e.key === "G") dropBlock();
    if (e.key === "e" || e.key === "E") zipNow();
    if (e.key === "v" || e.key === "V") setView(!cam.first);
    if (e.key === "0") cam.pitch = 0.28;
  };
  const chooseTeam = (team) => {
    selection.team = team;
    for (const b of el.teams) b.setAttribute("aria-pressed", String(b.dataset.team === team));
  };

  const enter = (ctx) => {
    ({ renderer, game, world, go } = ctx);
    home = ctx.from === "arcade" ? "arcade" : "hub";
    hudMod.leaveTo("block", home);
    camera = createCamera({ fov: 58, near: 0.3, far: 400 });
    root = createNode();
    clock = daylight.createClock({ hour: hourParam, day: dayParam, now: new Date() });
    hud = hudMod.create({ roster: contributors.activeRoster, catalog: models.SWAG, tierColors: models.TIER_COLORS, renderIcon: hudMod.renderIcon, lootEnabled: false });
    hooks = {};
    input = interactMod.create({ canvas: ctx.canvas, renderer, camera, hooks });
    fx = fxMod.create({ root, renderer, camera, hud, overlay: ctx.overlay, tickerAt: { x: 0, y: 8, z: 0 } });
    for (const id of ["board", "results", "strip", "center", "notice", "best", "record", "score-blue", "score-red", "own", "theirs", "time", "drop", "summary", "stats", "result-title", "quiz", "quiz-q", "quiz-note", "quiz-fill"]) {
      el[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = document.getElementById(`block-${id}`);
    }
    el.teams = [...document.querySelectorAll("#block-board [data-team]")];
    el.paintBtn = document.getElementById("block-paint");
    el.toolBar = document.getElementById("block-tools");
    el.passBtn = document.querySelector('#block-tools [data-tool="pass"]');
    el.tools = [...el.toolBar.querySelectorAll("[data-tool]")];
    el.onTool = (e) => { const k = e.currentTarget.dataset.tool; e.currentTarget.blur(); if (k === "crate") buildCrate(); else if (k === "grab") grabCrate(); else if (k === "pass") passBlock(); else if (k === "zip") zipNow(); else chooseTool(k); };
    for (const b of el.tools) b.addEventListener("click", el.onTool);
    el.stamina = document.getElementById("block-stamina");
    el.staminaK = -1;
    el.windWord = document.getElementById("block-wind-word");
    el.windArrow = document.getElementById("block-wind-arrow");
    el.windKey = "";
    el.cross = document.getElementById("block-cross");
    el.viewBtn = document.getElementById("block-view-btn");
    el.canvas = ctx.canvas;
    document.addEventListener("mousemove", onLockedMove);
    el.canvas.addEventListener("mousedown", onLockedDown);
    el.canvas.addEventListener("mousedown", onRightDown);
    el.canvas.addEventListener("contextmenu", noMenu);
    window.addEventListener("keydown", onCrouchKey);
    window.addEventListener("keydown", onTabKey, true);
    window.addEventListener("keyup", onCrouchKey);
    el.onPaint = (e) => { e.preventDefault(); if (phase === "play") paint(); };
    el.paintBtn.addEventListener("pointerdown", el.onPaint);
    el.oogaPick = document.getElementById("block-ooga");
    el.onOoga = () => { chooseOoga(el.oogaPick.value); el.oogaPick.blur(); };
    el.oogaPick.addEventListener("change", el.onOoga);
    el.answers = [...document.querySelectorAll("#block-quiz [data-answer]")];
    for (const b of el.answers) b.addEventListener("click", onAnswer);
    quiz.asked = quiz.solved = 0;
    const onTeam = (e) => { chooseTeam(e.currentTarget.dataset.team); e.currentTarget.blur(); };
    for (const b of el.teams) b.addEventListener("click", onTeam);
    el.onTeam = onTeam;
    place(createNode({ geometry: BM.arena() }));
    blocks = {};
    ticks = {};
    for (const t of SIM.TEAMS) {
      const s = SIM.ARENA.stands[t];
      place(createNode({ geometry: BM.stand(TEAM_INDEX[t]), position: { x: s.x, y: 0, z: s.z } }));
      const node = place(createNode({ geometry: BM.block(TEAM_INDEX[t]) }));
      const tickRoot = place(createNode());
      ticks[t] = [];
      for (let k = 0; k < 12; k++) {
        const n = createNode({ geometry: BM.tick(), rotation: { x: 0, y: k / 12 * Math.PI * 2, z: 0 }, visible: false });
        addChild(tickRoot, n);
        ticks[t].push(n);
      }
      blocks[t] = { node, tickRoot };
    }
    pads = SIM.ARENA.traps.map(([x, z]) => place(createNode({ geometry: BM.pad(), position: { x, y: 0, z } })));
    // The sniper towers' ladders and rifle racks, the ziplines, and the ammo caches.
    for (const t of SIM.TEAMS) {
      const l = SIM.ARENA.ladders[t], [x0, x1, z0, z1] = SIM.ARENA.towers[t], i = TEAM_INDEX[t];
      place(createNode({ geometry: BM.ladder(), position: { x: l.dx < 0 ? x1 + 0.05 : x0 - 0.05, y: 0, z: (l.zone[2] + l.zone[3]) / 2 } }));
      place(createNode({ geometry: BM.rack(i), position: { x: l.dx < 0 ? x0 + 0.7 : x1 - 0.7, y: C.TOWER_TOP, z: (z0 + z1) / 2 }, rotation: { x: 0, y: Math.PI / 2, z: 0 } }));
      place(createNode({ geometry: BM.zipline(i) }));
    }
    caches = SIM.ARENA.caches.map(([x, y, z]) => place(createNode({ geometry: BM.cache(0), position: { x, y, z } })));
    // The gun in view in first person.
    fpGun = place(createNode({ geometry: BM.gun(0), visible: false }));
    shots = [];
    for (let i = 0; i < C.MAX_SHOTS; i++) shots.push(place(createNode({ geometry: BM.ball(0), visible: false })));
    crates = [];
    for (let i = 0; i < C.MAX_CRATES; i++) crates.push(place(createNode({ geometry: BM.crate(0), visible: false })));
    rain = [];
    for (let i = 0; i < RAIN; i++) rain.push({ node: place(createNode({ geometry: BM.streak(), visible: false })), x: 0, y: -1, z: 0 });
    splats = [];
    for (let i = 0; i < MAX_SPLATS; i++) splats.push(place(createNode({ geometry: BM.splat(0), visible: false, depthBias: 0.2 })));
    splatNext = 0;
    sim = SIM.create({ team: selection.team, seed: 1 });
    buildActors(castNames());
    for (let i = 0; i < 4; i++) sim.actors[i].name = actors[i].name;
    paintTeams();
    // The board's Ooga picker: the roster by the name shown, held to their own Ooga for a signed-in visitor.
    el.oogaPick.textContent = "";
    // In alphabetical order by the name shown, so anyone can find theirs in a long roster.
    const names = contributors.activeRoster.map((c) => [c.name, contributors.traitsFor(c.name).display || c.name]);
    names.sort((p, q) => p[1].localeCompare(q[1], undefined, { sensitivity: "base" }));
    for (const [name, shown] of names) {
      const o = document.createElement("option");
      o.value = name;
      o.textContent = shown;
      el.oogaPick.append(o);
    }
    el.oogaPick.value = actors[0].name || "";
    el.oogaPick.disabled = !!BL.net.ownAmong(contributors.activeRoster);
    controls = controlsMod.create({ move: document.getElementById("joy-move"), look: document.getElementById("joy-look"), boost: hud.el.act, onAction: act, pressActions: true });
    blockScene.agentControls = controls;
    Object.assign(hooks, {
      onHover: (hit, p) => {
        if (hit && hit.owner.kind === "ooga") hud.tooltip.show(actors[hit.owner.index].cave.traits.display, p.x, p.y, actors[hit.owner.index].cave);
        else hud.tooltip.hide();
      },
      onHoverMove: (hit, p) => { if (hit && hit.owner.kind === "ooga") hud.tooltip.show(actors[hit.owner.index].cave.traits.display, p.x, p.y, actors[hit.owner.index].cave); },
      // A mouse throws on press (`onLockedDown`); a tap on a touch screen throws here.
      onTap: () => { if (phase === "play" && COARSE) paint(); },
      onOrbit: (dx, dy) => {
        if (phase !== "play") return;
        cam.face = wrap(cam.face - dx * 5e-3);
        cam.pitch = clamp(cam.pitch + dy * 3.5e-3, CAM.pitch[0], CAM.pitch[1]);
      },
      // The wheel steps through the tools.
      onZoom: (k) => { if (phase === "play" && k !== 1) cycleTool(k > 1 ? -1 : 1); }
    });
    hud.onAction((action) => {
      if (action === "block-start" || action === "block-again") start();
      else if (action === "block-board") showBoard();
      else if (action === "block-drop") dropBlock();
      else if (action === "block-view") setView(!cam.first);
      else if (action === "leave") go(home);
      else if (action === "act") act();
    });
    hud.setStats(game.state);
    hud.el.sheet.dataset.open = "false";
    el.help = document.getElementById("block-help");
    el.help.textContent = COARSE ? "Left stick runs · right stick turns · Jump twice to climb · Paint! throws the tool you pick · View for first person" : "W S run · A D turn · Shift sprints · Space jumps, twice to climb · click fires · R or right click switches weapon · 5 sniper (from a tower) · W into a ladder climbs · E zipline · Tab throws what you hold · F lifts crates · B new crate · C crouch · V view";
    showBoard();
    stateTimer = window.setInterval(() => fx.trimPool(), 6e4);
    hintTimer = window.setTimeout(() => hud.hint(COARSE ? "Pick a side, then Play!" : "Pick a side, then Play! (Enter)"), 1200);
    Object.assign(blockScene, {
      root, camera, input,
      debug: {
        hud, camera, controls, cavemen: null, crates: null,
        block: {
          get phase() { return phase; },
          get sim() { return sim; },
          get result() { return result; },
          get cam() { return cam; },
          get quiz() { return { open: quiz.open, right: quiz.right, locked: quiz.locked, asked: quiz.asked, solved: quiz.solved }; },
          get tool() { return tool; },
          selection, start, showBoard, paint, drop: dropBlock, build: buildCrate, chooseTool, chooseTeam, chooseOoga, answer,
          // Runs the round forward without frames, the visitor's Ooga on the sim's autopilot when `auto` is set.
          simulate: (seconds, auto = false) => {
            if (phase !== "play") return;
            sim.actors[0].bot = auto ? "auto" : false;
            const still = { x: 0, z: 0, sprint: 0, jump: 0 };
            for (let t = 0; t < seconds && !sim.over; t += C.STEP) {
              SIM.tick(sim, C.STEP, still);
              readEvents();
            }
            sim.actors[0].bot = false;
            updateStrip();
            if (sim.over) finish();
          }
        }
      }
    });
  };
  const leave = () => {
    window.clearInterval(stateTimer);
    window.clearTimeout(hintTimer);
    window.clearTimeout(centerTimer);
    window.clearTimeout(noticeTimer);
    for (const b of el.teams) b.removeEventListener("click", el.onTeam);
    el.paintBtn.removeEventListener("pointerdown", el.onPaint);
    el.toolBar.hidden = true;
    for (const b of el.tools) b.removeEventListener("click", el.onTool);
    document.removeEventListener("mousemove", onLockedMove);
    el.canvas.removeEventListener("mousedown", onLockedDown);
    el.canvas.removeEventListener("mousedown", onRightDown);
    el.canvas.removeEventListener("contextmenu", noMenu);
    window.removeEventListener("keydown", onCrouchKey);
    window.removeEventListener("keydown", onTabKey, true);
    window.removeEventListener("keyup", onCrouchKey);
    if (document.pointerLockElement === el.canvas) document.exitPointerLock();
    el.cross.hidden = true;
    cam.first = false;
    move.crouch = 0;
    el.oogaPick.removeEventListener("change", el.onOoga);
    el.paintBtn.hidden = true;
    for (const b of el.answers) b.removeEventListener("click", onAnswer);
    closeQuiz();
    disposeActors();
    fx.dispose();
    controls.dispose();
    hud.el.act.hidden = true;
    hud.setAct("Ooga!");
    for (const node of placed) removeChild(root, node);
    placed.length = 0;
    const count = input.targetCount;
    input.dispose();
    hud.dispose();
    phase = "board";
    sim = blocks = shots = splats = ticks = pads = crates = rain = caches = fpGun = result = null;
    zipNear = false;
    hud = hooks = input = fx = controls = clock = null;
    blockScene.input = blockScene.debug = blockScene.agentControls = null;
    return { targets: count };
  };
  const liveGeometry = (set) => {
    if (actors) for (const a of actors) if (a.cave) set.add(a.cave.headOpen).add(a.cave.headClosed);
    for (let i = 0; i < 6; i++) set.add(BM.splat(i));
    for (let i = 0; i < 2; i++) set.add(BM.ball(i)).add(BM.ring(i));
  };
  const stats = () => {
    let nodes = 0;
    traverseVisible(root, () => nodes++);
    const all = (n) => 1 + n.children.reduce((sum, c) => sum + all(c), 0);
    return { visibleNodes: nodes, allNodes: all(root), tweens: tweenCount(), targets: input.targetCount, ...fx.stats(), phase };
  };
  Object.assign(blockScene, { enter, update, overlay, onDonation, onKey, leave, stats, liveGeometry, onLootCleared: () => { } });
  BL.scenes = BL.scenes || {};
  BL.scenes.block = blockScene;
})();
