// Block Frenzy: capture the flag on Fort Chaos, Bitcoin themed. Each side guards its Bitcoin block, a glowing orange
// cube on a stand in its fort; steal the other side's, carry it home and touch your own stand while your own block is
// home. Paint splats a rival for a moment (a carrier drops what they carry) and nobody dies. Two a side: the visitor
// and a teammate against two rivals, the three bots run by `block-sim.js`. First to three captures.
//
// Phases `board` (choose a side), `play` and `results`. The rules run in `blockSim.step` on a fixed step; this file
// draws them: the arena and stands built once a visit, the four Oogas posed from the sim each frame, the two blocks on
// their stands, at a carrier's back or lying with a countdown ring, pooled paint balls and splats, and a chase camera
// behind the visitor's Ooga that the mouse drag, Q E or the look stick turns. W A S D run toward where the camera
// looks, Shift sprints, Space jumps and jumps again in the air, a left click or Enter paints one ball a press, G drops
// the block, C crouches while held, V switches between the chase camera and first person (a click there locks the
// mouse for aiming; Escape lets it go). On touch the act button jumps and `#block-paint` paints. The intro card, the board (side and Ooga), the
// quiz card and the results are in `src/index.html` under `#block`.
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
    trap: ["Quiz?! Ooga think…", "Hmm. Satoshi who?", "Big brain time."],
    free: ["Ooga know!", "Easy! Twenty-one million!", "Brain unlocked!"]
  };
  const QUIZ_BITS = ["#3dff7a", "#b8ffcf"].map((c) => models.particleGeometry(c, 0.09, 1));
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
  let renderer, game, world, go, testBananas, root, camera, hud, hooks, input, fx, controls, clock;
  let sim = null, phase = "board", sceneTime = 0, stateTimer = 0, hintTimer = 0, lineN = 0, result = null;
  let actors = null, blocks = null, shots = null, splats = null, splatNext = 0, ticks = null, pads = null;
  // The quiz: the deck of question indices still to ask this visit, the one on the card and where its right answer sits.
  const quiz = { open: false, deck: [], index: -1, right: -1, locked: false, lockTimer: 0, asked: 0, solved: 0 };
  const placed = [];
  const cam = { yaw: Math.PI, pitch: 0.28, warm: false, first: false };
  const move = { x: 0, z: 0, sprint: 0, jump: 0, crouch: 0 };
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
      addChild(body, ring, blob, bubble);
      place(body);
      if (cave) input.add(cave.parts.torso, { kind: "ooga", index: i, priority: 1 });
      return { body, cave, ring, blob, bubble, phase: 0, name };
    });
  };
  const disposeActors = () => {
    if (!actors) return;
    for (const a of actors) {
      if (a.cave) input.remove(a.cave.parts.torso);
      removeChild(root, a.body);
      const i = placed.indexOf(a.body);
      if (i >= 0) placed.splice(i, 1);
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
    el.results.hidden = el.strip.hidden = el.center.hidden = el.notice.hidden = true;
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
    el.strip.hidden = false;
    el.notice.hidden = false;
    hud.el.act.hidden = !COARSE;
    hud.setAct("Jump");
    el.paintBtn.hidden = !COARSE;
    el.cross.hidden = !cam.first;
    cam.yaw = sim.team === "blue" ? Math.PI : 0;
    cam.pitch = 0.28;
    cam.warm = false;
    controls.reset();
    center("GO!", 900);
    notice(COARSE ? "Steal the orange block · bring it home · Jump twice to climb" : "Steal the orange block · bring it home · click or Enter paints · Space twice climbs", 4500);
    updateStrip();
  };
  const finish = () => {
    closeQuiz();
    phase = "results";
    const won = sim.winner === sim.team, ms = Math.round(sim.time * 1000);
    const best = game.recordBlock({ won, ms });
    result = { won, ms, best };
    el.strip.hidden = true;
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
  const STATE_WORDS = { home: "home", carried: "taken", dropped: "dropped" };
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
        else notice("Their block went home", 1800);
      } else if (e.type === "knock" || e.type === "drop") {
        if (me && e.type === "drop") notice("Block dropped · it goes home in 20 s", 2500);
        else if (!mine) notice(e.type === "knock" ? "Carrier splatted! Your block is loose" : "Your block is loose", 2200);
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
  const paint = () => SIM.fire(sim, 0, cam.yaw, cam.first ? lookUp() - 0.09 : clamp((cam.pitch - 0.28) * -0.5, -0.12, 0.2));
  const setView = (first) => {
    cam.first = first;
    cam.warm = false;
    el.cross.hidden = !first || phase !== "play";
    el.viewBtn.setAttribute("aria-pressed", String(first));
    if (!first && document.pointerLockElement === el.canvas) document.exitPointerLock();
    notice(first ? (COARSE ? "First person · drag to aim" : "First person · click to lock the mouse and aim · V goes back") : "Chase camera", 1800);
  };
  // With the mouse locked in first person, it aims directly and a left press paints.
  const onLockedMove = (e) => {
    if (document.pointerLockElement !== el.canvas || phase !== "play") return;
    cam.yaw = wrap(cam.yaw - e.movementX * 2.6e-3);
    cam.pitch = clamp(cam.pitch + e.movementY * 2.2e-3, -0.3, 0.86);
  };
  const onLockedDown = (e) => {
    if (phase !== "play" || !cam.first || e.button !== 0) return;
    if (document.pointerLockElement === el.canvas) paint();
    else if (!COARSE && el.canvas.requestPointerLock) {
      const lock = el.canvas.requestPointerLock();
      if (lock && lock.catch) lock.catch(() => { });
    }
  };
  const onCrouchKey = (e) => { if (e.key === "c" || e.key === "C") move.crouch = e.type === "keydown" ? 1 : 0; };
  const dropBlock = () => {
    if (phase !== "play") return false;
    if (SIM.drop(sim, 0)) return true;
    notice("Nothing to drop", 900);
    return false;
  };

  const readInput = (dt) => {
    const a = controls.read();
    cam.yaw = wrap(cam.yaw + a.yaw * CAM.yawRate * dt);
    // Forward is where the camera looks.
    const fx2 = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
    let x = fx2 * a.y - fz * a.x, z = fz * a.y + fx2 * a.x;
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    move.x = x;
    move.z = z;
    move.sprint = a.sprint;
    if (quiz.open) move.crouch = 0;
    const up = a.up > 0;
    move.jump = up && !jumpWas ? 1 : 0;
    jumpWas = up;
  };
  const poseActors = (dt, elapsed) => {
    for (let i = 0; i < 4; i++) {
      const s = sim.actors[i], a = actors[i];
      setVec(a.body.position, s.x, s.y, s.z);
      a.body.visible = !(i === 0 && cam.first && phase === "play");
      a.body.scale.y = s.crouch ? 0.66 : 1;
      a.body.rotation.y = damp(a.body.rotation.y, a.body.rotation.y + wrap(s.heading - a.body.rotation.y), 14, dt);
      a.ring.visible = s.grounded;
      a.blob.visible = s.splat > 0;
      a.bubble.visible = s.trapped > 0;
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
      if (s.carrying) {
        // Both hands up holding the block overhead.
        p.armL.rotation.x = p.armR.rotation.x = -2.9;
      } else {
        p.armR.rotation.x = s.cooldown > (s.bot ? C.BOT_COOLDOWN : C.COOLDOWN) - 0.2 ? -1.5 : -0.2 - swing * 0.35;
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
      setVec(b.node.position, f.x, y, f.z);
      b.node.rotation.y = elapsed * (f.state === "carried" ? 3 : 0.9);
      b.node.glow = f.state === "dropped" ? 0.7 + 0.3 * Math.sin(elapsed * 8) : 1;
      // The countdown ring under a dropped block, one tick for each part of its twenty seconds left.
      const left = f.state === "dropped" ? (f.returnAt - sim.time) / C.RETURN_S : 0;
      const shown = Math.ceil(left * ticks[t].length);
      setVec(b.tickRoot.position, f.x, f.y + 0.05, f.z);
      for (let k = 0; k < ticks[t].length; k++) ticks[t][k].visible = k < shown;
    }
  };
  const posePads = (elapsed) => {
    for (let i = 0; i < pads.length; i++) {
      const t = sim.traps[i];
      pads[i].glow = t.dark > 0 ? 0.12 : 0.75 + 0.25 * Math.sin(elapsed * 3 + i);
    }
    if (quiz.open) el.quizFill.style.width = `${Math.max(0, sim.actors[0].trapped / C.TRAP_MAX_S * 100).toFixed(1)}%`;
  };
  const poseShots = () => {
    for (let i = 0; i < sim.shots.length; i++) {
      const s = sim.shots[i], n = shots[i];
      n.visible = s.live;
      if (!s.live) continue;
      setVec(n.position, s.x, s.y, s.z);
      n.geometry = BM.ball(TEAM_INDEX[s.team]);
    }
  };
  const updateCamera = (dt) => {
    const me = sim ? sim.actors[0] : null, x = me ? me.x : 0, y = me ? me.y : 0, z = me ? me.z : 0;
    if (cam.first && me) {
      // The eye at the Ooga's eyes (lower when crouched), looking along the aim.
      const eye = y + (me.crouch ? 0.9 : 1.55), up = lookUp(), c = Math.cos(up);
      setVec(camera.position, x + Math.sin(cam.yaw) * 0.25, eye, z + Math.cos(cam.yaw) * 0.25);
      setVec(camera.target, x + Math.sin(cam.yaw) * c * 10, eye + Math.sin(up) * 10, z + Math.cos(cam.yaw) * c * 10);
      setVec(RENDER_OPTS.shadowCenter, x, 0, z);
      return;
    }
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
    setVec(camera.target, x + Math.sin(cam.yaw) * 2, y + 1.3, z + Math.cos(cam.yaw) * 2);
    setVec(RENDER_OPTS.shadowCenter, x, 0, z);
  };
  // The board shows the whole fort from above its gate, slowly turning.
  const boardView = (elapsed) => {
    const t = selection.team, s = SIM.ARENA.stands[t], a = elapsed * 0.12;
    setVec(camera.position, s.x + Math.sin(a) * 16, 11, s.z * 0.55 + Math.cos(a) * 16);
    setVec(camera.target, s.x, 1, s.z * 0.8);
  };

  const update = (dt, elapsed) => {
    sceneTime = elapsed;
    daylight.sample(clock.read(), RENDER_OPTS, clock.dayOfYear, daylight.ISLAND_LATITUDE_DEG, clock.continuousDay, clock.utcMs);
    RENDER_OPTS.time = elapsed;
    if (phase === "play") {
      readInput(dt);
      SIM.step(sim, dt, move);
      readEvents();
      updateStrip();
      if (sim.over) finish();
    } else controls.read();
    poseActors(dt, elapsed);
    poseBlocks(elapsed);
    posePads(elapsed);
    poseShots();
    if (phase === "board") boardView(elapsed);
    else updateCamera(dt);
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
      if (phase === "play" || phase === "results") showBoard();
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
    if (e.key === "g" || e.key === "G") dropBlock();
    if (e.key === "v" || e.key === "V") setView(!cam.first);
    if (e.key === "0") cam.pitch = 0.28;
    if (e.key === "b" || e.key === "B") {
      world.level = Math.min(pileMod.MAX_BANANAS, world.level + testBananas);
      hud.toast(`+${testBananas} test bananas`);
    }
  };
  const chooseTeam = (team) => {
    selection.team = team;
    for (const b of el.teams) b.setAttribute("aria-pressed", String(b.dataset.team === team));
  };

  const enter = (ctx) => {
    ({ renderer, game, world, go, testBananas } = ctx);
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
    el.cross = document.getElementById("block-cross");
    el.viewBtn = document.getElementById("block-view-btn");
    el.canvas = ctx.canvas;
    document.addEventListener("mousemove", onLockedMove);
    el.canvas.addEventListener("mousedown", onLockedDown);
    window.addEventListener("keydown", onCrouchKey);
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
    shots = [];
    for (let i = 0; i < C.MAX_SHOTS; i++) shots.push(place(createNode({ geometry: BM.ball(0), visible: false })));
    splats = [];
    for (let i = 0; i < MAX_SPLATS; i++) splats.push(place(createNode({ geometry: BM.splat(0), visible: false, depthBias: 0.2 })));
    splatNext = 0;
    sim = SIM.create({ team: selection.team, seed: 1 });
    buildActors(castNames());
    for (let i = 0; i < 4; i++) sim.actors[i].name = actors[i].name;
    paintTeams();
    // The board's Ooga picker: the roster by display name, held to their own Ooga for a signed-in visitor.
    el.oogaPick.textContent = "";
    for (const c of contributors.activeRoster) {
      const o = document.createElement("option");
      o.value = c.name;
      o.textContent = contributors.traitsFor(c.name).display || c.name;
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
      onTap: () => { if (phase === "play" && !(cam.first && !COARSE)) paint(); },
      onOrbit: (dx, dy) => {
        if (phase !== "play") return;
        cam.yaw = wrap(cam.yaw - dx * 5e-3);
        cam.pitch = clamp(cam.pitch + dy * 3.5e-3, CAM.pitch[0], CAM.pitch[1]);
      },
      onZoom: () => { }
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
    el.help.textContent = COARSE ? "Left stick runs · right stick turns · Jump twice to climb · Paint! throws · View for first person" : "W A S D run · drag or Q E turn · Shift sprints · Space jumps, twice to climb · click or Enter paints · C crouches · V first person · G drops";
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
          selection, start, showBoard, paint, drop: dropBlock, chooseTeam, chooseOoga, answer,
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
    document.removeEventListener("mousemove", onLockedMove);
    el.canvas.removeEventListener("mousedown", onLockedDown);
    window.removeEventListener("keydown", onCrouchKey);
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
    sim = blocks = shots = splats = ticks = pads = result = null;
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
