// The Timechain Sphere's doorway on the island: the keypad, the doors and the short crossing into a room and back.
// The hub creates it with the sphere (`create`) and drives it every frame; it owns no geometry of its own.
//
// Space beside the keypad (or a tap on it) engages it: the view turns to it and the keypad's panel takes the keys.
// 1–9 choose exactly one room (choosing another replaces it), Enter is off until one is chosen, Back or Escape lets
// go without anything loading. Enter commits: the visitor's account must already be resolved (signed in: a shared
// room; signed out: a solo copy); an unanswered account look offers Retry or an explicit Continue solo instead of
// guessing. The Ooga steps to the waiting spot square to the doors while the room's code and the traveler's look into
// it prepare; a slow or failed preparation holds there, with Cancel, and returns to the keypad. Only then does a shared
// crossing ask the island room for the doorway (net.js `askDoor`, docs/timechain-sphere/doorway-contract.md), waiting
// with "Door in use · waiting" while someone else crosses; a solo one asks nobody. The doors part (on every signed-in
// page in the sphere's zone too, from the room's `transit`), the view moves into the Ooga's eyes before the guided
// approach and stays there while it walks in, and
// once it is through the curtain at the end of the passage the room's scene takes over. Coming back, the Ooga appears
// behind that curtain (the sphere's zone, out of sight), asks for the doorway again when shared, and walks out onto the
// bridge in first person; only after the doors close does the normal island view return, and its jetpack comes back as
// it was.
//
// The plug across the doorway (timechain-models.js) is lifted only for this page's own traveler, while it crosses.
(() => {
  "use strict";
  const BL = window.BL = window.BL || {};
  const ROOMS = BL.timechainRooms, TM = BL.timechainModels, S = TM.SPOTS, P = TM.PASSAGE;
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");
  // Seconds: the doors' slide, a preparation's limit, the room socket's grace before a shared crossing goes ahead
  // without a reservation, and the longest any one walk may take.
  const DOOR_TIME = 0.75, PREPARE_LIMIT = 15, CONNECT_GRACE = 6, WALK_LIMIT = 8;
  const WALK_SPEED = 0.6, TURN_RATE = 6, GLIDE = 0.45, HINT_GAP = 4;
  // The traveler's look into the room: the picture's size at the curtain.
  const PICTURE_W = 2 * P.halfW, PICTURE_H = P.top - P.floor;

  const create = (h) => {
    const { site, place, pilot, crew, hud, camera, renderer, canvas, world, go } = h;
    const cos = Math.cos(place.ry), sin = Math.sin(place.ry);
    const worldX = (x, z) => place.x + x * cos + z * sin, worldZ = (x, z) => place.z - x * sin + z * cos;
    const localZ = (x, z) => (x - place.x) * sin + (z - place.z) * cos, localX = (x, z) => (x - place.x) * cos - (z - place.z) * sin;
    const panel = document.getElementById("sphere-keypad");
    const el = {
      room: document.getElementById("sphere-keypad-room"), status: document.getElementById("sphere-keypad-status"), mode: document.getElementById("sphere-keypad-mode"),
      keys: [...panel.querySelectorAll("[data-sphere-key]")]
    };
    // idle, keypad, account, preparing, waiting, crossing, gone, arriving, leaving.
    const g = {
      state: "idle", selection: 0, room: null, mode: null, prep: 0, prepared: null, shot: null, picture: null, pictureTries: 0, t: 0, ask: 0,
      cycle: null, exp: 0, open: 0, want: 0, remoteUntil: 0, swoop: 0, hintAt: -Infinity, jetpack: null, from: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
      // The view's lens, since the pilot leaves the camera alone while it is held: null (the pilot's own), "keypad"
      // (gliding to and holding the keypad's), "trail" (gliding to and following a view over the Ooga's shoulder),
      // "eyes" (held at the Ooga's eyes throughout a committed trip) or "back" (gliding back to the pilot's, once free).
      to: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, lens: null, glide: 1, hidden: null, exit: null, failures: 0, login: null
    };
    const action = { kind: "sphere-keypad" };
    // A room chosen in advance (a signed-in arrival at its address, sent out here), lit when the keypad is next used.
    let preselect = ROOMS.parse(world.sphereKeypad) || 0;
    world.sphereKeypad = null;
    const at = (spot) => ({ x: worldX(spot.x, spot.z), z: worldZ(spot.x, spot.z) });
    const WAIT = at(S.WAIT), PARK = at(S.PARK);
    const KEYPAD = { x: worldX(S.KEYPAD.x, S.KEYPAD.z), y: place.y + S.KEYPAD.y, z: worldZ(S.KEYPAD.x, S.KEYPAD.z) };
    // Facing the doors from the bridge, and out of them.
    const IN_HEADING = place.ry + Math.PI, OUT_HEADING = place.ry;

    const accountWords = () => {
      const net = BL.net.state;
      if (!net.resolved) return "Account unavailable";
      return net.me ? `Signed in · a shared room` : "Solo visit · not signed in";
    };
    const show = (status = "") => {
      const busy = g.state === "preparing" || g.state === "waiting";
      el.room.textContent = g.selection ? `ROOM ${g.selection}` : "CHOOSE A ROOM";
      el.status.textContent = status;
      el.mode.textContent = g.state === "account" ? "Account unavailable" : accountWords();
      for (const b of el.keys) {
        const k = b.dataset.sphereKey, digit = Number(k);
        if (digit) {
          b.setAttribute("aria-pressed", String(digit === g.selection));
          b.disabled = g.state !== "keypad";
        } else if (k === "enter") b.disabled = g.state !== "keypad" || !g.selection;
        else if (k === "back") { b.hidden = busy || g.state === "account"; b.disabled = g.state !== "keypad"; }
        else if (k === "cancel") b.hidden = !busy && g.state !== "account";
        else if (k === "retry" || k === "solo") b.hidden = g.state !== "account";
      }
      panel.dataset.state = g.state;
    };
    const openPanel = (open) => {
      panel.hidden = !open;
      if (!open && panel.contains(document.activeElement)) document.activeElement.blur();
    };
    // The view eases between poses (eye and heading) after the pilot's update, as the factory's kiosk does.
    const readPose = (out) => {
      const p = camera.position, t = camera.target, dx = t.x - p.x, dy = t.y - p.y, dz = t.z - p.z;
      out.x = p.x; out.y = p.y; out.z = p.z; out.yaw = Math.atan2(dx, dz); out.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    };
    const putPose = (a, b, k) => {
      const e = k * k * (3 - 2 * k), yaw = a.yaw + Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw)) * e;
      const pitch = a.pitch + (b.pitch - a.pitch) * e, cp = Math.cos(pitch), p = camera.position, t = camera.target;
      p.x = a.x + (b.x - a.x) * e; p.y = a.y + (b.y - a.y) * e; p.z = a.z + (b.z - a.z) * e;
      t.x = p.x + Math.sin(yaw) * cp; t.y = p.y + Math.sin(pitch); t.z = p.z + Math.cos(yaw) * cp;
      camera.up = null;
    };
    // Square on to the keypad, a little to the left of it, at a standing eye.
    const keypadPose = (out) => {
      const nx = sin, nz = cos;
      out.x = KEYPAD.x + nx * 1.15 - cos * 0.3; out.y = KEYPAD.y + 0.25; out.z = KEYPAD.z + nz * 1.15 + sin * 0.3;
      const dx = KEYPAD.x - out.x, dy = KEYPAD.y - out.y, dz = KEYPAD.z - out.z;
      out.yaw = Math.atan2(dx, dz); out.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    };
    // Over the Ooga's shoulder, a few steps behind it, looking past it the way it faces.
    const trailPose = (cave, out) => {
      const p = cave.root.position, heading = cave.root.rotation.y, fx = Math.sin(heading), fz = Math.cos(heading), feet = p.y - cave.baseY;
      out.x = p.x - fx * 3.4; out.z = p.z - fz * 3.4; out.y = feet + 2.1;
      const dx = p.x + fx * 1.5 - out.x, dy = feet + 1.4 - out.y, dz = p.z + fz * 1.5 - out.z;
      out.yaw = Math.atan2(dx, dz); out.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    };
    // The driven Ooga's eyes, as the pilot's first person places them.
    const eyePose = (cave, out) => {
      const p = cave.root.position, heading = cave.root.rotation.y;
      out.x = p.x + Math.sin(heading) * 0.16; out.z = p.z + Math.cos(heading) * 0.16;
      out.y = p.y - cave.baseY + cave.headOffset * 0.95 + cave.viewLift;
      out.yaw = heading; out.pitch = -0.02;
    };
    const hideHead = (cave, on) => {
      if (on && !g.hidden) { g.hidden = { head: cave.parts.head, was: cave.parts.head.cameraHidden }; cave.parts.head.cameraHidden = true; }
      else if (!on && g.hidden) { g.hidden.head.cameraHidden = g.hidden.was; g.hidden = null; }
    };

    // Walks the Ooga as a held stick would, at a stroll, and turns the pilot's own view the same way.
    const steerTo = (x, z, dt) => {
      const cave = crew.player, p = cave.root.position, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.12) { crew.steer(0, 0, 0, 0, 0); return true; }
      crew.steer(dx / d, dz / d, 0, 1, 0, WALK_SPEED);
      const yaw = Math.atan2(-dx, -dz), o = pilot.orbit;
      o.yaw = o.tYaw = o.yaw + Math.atan2(Math.sin(yaw - o.yaw), Math.cos(yaw - o.yaw)) * Math.min(1, dt * TURN_RATE);
      return false;
    };
    const turnTo = (heading, dt) => {
      const cave = crew.player, r = cave.root.rotation;
      r.y += Math.atan2(Math.sin(heading - r.y), Math.cos(heading - r.y)) * Math.min(1, dt * TURN_RATE);
    };
    const hold = (on) => {
      pilot.setExternalControl(on);
      if (on) { crew.steer(0, 0, 0, 0, 0); crew.thrust(false); hud.el.act.hidden = true; }
      else { hud.el.act.hidden = !crew.player; pilot.showAct(); }
    };
    // The view glides from wherever it is now: to the keypad, or back to the pilot's.
    const lens = (name) => {
      readPose(g.from);
      g.lens = name;
      g.glide = 0;
    };

    // ---------- the keypad ----------
    const nearKeypad = (x, y, z) => g.state === "idle" && !!crew.player && Math.hypot(x - KEYPAD.x, z - KEYPAD.z) < S.KEYPAD_REACH && Math.abs(y - KEYPAD.y) < 2;
    const engage = () => {
      if (g.state !== "idle" || !crew.player) return false;
      g.state = "keypad";
      g.selection = preselect;
      preselect = 0;
      site.choose(g.selection);
      hold(true);
      if (document.pointerLockElement) document.exitPointerLock();
      lens("keypad");
      hud.tooltip.hide();
      show(g.selection ? `Press Enter to go to Room ${g.selection}` : "Choose a room, 1 to 9");
      openPanel(true);
      return true;
    };
    // Back to walking, the view gliding back from the keypad.
    const disengage = () => {
      if (g.state !== "keypad" && g.state !== "account") return;
      g.state = "idle";
      openPanel(false);
      site.choose(0);
      lens("back");
      hold(false);
    };
    const choose = (digit) => {
      if (g.state !== "keypad" || !ROOMS.parse(digit)) return;
      g.selection = digit;
      site.choose(digit);
      show(`Press Enter to go to Room ${digit}`);
    };
    // Enter: the room, the account's answer, then the walk to the waiting spot and the preparation.
    const commit = (solo = false) => {
      const room = ROOMS.get(g.selection);
      if (!room || g.state !== "keypad" && g.state !== "account") return;
      const net = BL.net.state;
      if (!solo && !net.resolved) {
        g.state = "account";
        show("Your account could not be looked up. Try again, or visit a private copy of the room on your own.");
        return;
      }
      g.room = room;
      g.mode = !solo && net.me ? "shared" : "solo";
      g.login = g.mode === "shared" ? net.me.login : null;
      const cave = crew.player;
      g.jetpack = { equipped: !!cave.jet, fuel: cave.jetFuel };
      g.state = "preparing";
      g.t = 0;
      g.lens = "eyes";
      g.swoop = 1;
      hideHead(cave, true);
      show(`Preparing Room ${room.id}…`);
      prepare();
    };
    const retryAccount = () => {
      if (g.state !== "account") return;
      show("Looking up your account…");
      BL.net.recheck().then(() => {
        if (g.state !== "account") return;
        if (BL.net.state.resolved) { g.state = "keypad"; show(`Press Enter to go to Room ${g.selection}`); }
        else show("Still unavailable. Try again, or continue solo.");
      });
    };
    // Preparing: the room's code (deferred on a hosted page) and the traveler's look into it, bounded in time. A
    // cancel or a newer preparation makes an older one's answer moot.
    // The room's code must arrive; the look into it is a nicety, and a crossing goes on without one.
    const prepare = () => {
      const stamp = ++g.prep;
      g.prepared = null;
      Promise.resolve(BL.deferred.load("timechain")).then(() => BL.timechainInterior.preview(g.room.id, renderer).catch(() => null)).then((shot) => {
        if (stamp !== g.prep) { if (shot) shot.dispose(); return; }
        g.shot = shot;
        g.pictureTries = 8;
        g.prepared = true;
      }, () => {
        if (stamp === g.prep) g.prepared = false;
      });
    };
    const dropPicture = () => {
      if (g.shot) { g.shot.dispose(); g.shot = null; }
      if (g.picture) { site.picture.geometry = null; renderer.releaseGeometry(g.picture); g.picture = null; }
    };
    // Back to the keypad with the room still chosen: a cancel, a failure, a lost connection, a stale crossing.
    const fallBack = (words) => {
      g.prep++;
      if (g.cycle !== null || g.ask) BL.net.cancelDoor();
      g.cycle = null; g.ask = 0;
      dropPicture();
      g.want = 0;
      site.plug.visible = true;
      if (crew.player) hideHead(crew.player, false);
      g.state = "keypad";
      lens("keypad");
      show(words);
      openPanel(true);
    };
    const hangPicture = () => {
      if (!g.shot || g.picture || g.pictureTries <= 0) return;
      g.pictureTries--;
      const asset = g.shot.take(canvas, PICTURE_W, PICTURE_H);
      if (!asset) return;
      g.shot = null;
      const w = PICTURE_W, hgt = PICTURE_H;
      const geo = { verts: [-w / 2, 0, 0, w / 2, 0, 0, w / 2, hgt, 0, -w / 2, hgt, 0], faces: [{ i: [0, 1, 2, 3], color: [0, 0, 0], emissive: 0 }], lines: [], castShadow: false };
      geo.imageSurface = { asset, rect: [-w / 2, 0, w, hgt] };
      g.picture = site.picture.geometry = geo;
    };

    // ---------- the doorway ----------
    // The island room's word on the doorway, for this page's own crossing and for anyone else's.
    const onDoor = (event) => {
      if (event.t === "transit") {
        if (event.door !== ROOMS.EXTERIOR_ZONE || event.cycle === g.cycle) return;
        g.remoteUntil = Math.max(g.remoteUntil, performance.now() + Math.max(0, Math.min(12000, event.exp - BL.net.serverNow())));
      } else if (event.t === "transit-end") {
        if (event.cycle !== g.cycle) g.remoteUntil = Math.min(g.remoteUntil, performance.now() + 1200);
      } else if (event.op === "wait") {
        if (g.state === "waiting") show(event.ahead ? `Door in use · waiting (${event.ahead} ahead)` : "Door in use · waiting");
        else if (g.state === "arriving") hud.hint("Door in use · waiting", 3000);
      } else if (event.op === "grant") {
        if (!g.ask) return;
        g.ask = 0;
        g.cycle = event.cycle;
        g.exp = event.exp;
        granted();
      } else if (event.op === "lost" && g.ask) {
        if (g.state === "waiting") fallBack("Connection lost · press Enter to try again");
        else g.ask = 0;
      }
    };
    const unsubscribeDoor = BL.net.subscribeDoor(onDoor);
    // Whether this crossing should wait its turn: shared, with a room that knows the doorway.
    const reserving = () => g.mode === "shared" && BL.net.state.doorway;
    const askDoor = (dir) => {
      g.ask = BL.net.askDoor(dir, g.room.id) ? performance.now() : 0;
      return !!g.ask;
    };
    // A grant: still ready and still where it was asked from, or it goes back unused.
    const granted = () => {
      const cave = crew.player;
      if (g.state === "waiting" && cave && Math.hypot(cave.root.position.x - WAIT.x, cave.root.position.z - WAIT.z) < 0.6) { BL.net.goDoor(g.cycle); startCrossing(); }
      else if (g.state === "arriving" && cave) { BL.net.goDoor(g.cycle); startLeaving(); }
      else { BL.net.cancelDoor(); g.cycle = null; }
    };
    const startCrossing = () => {
      g.state = "crossing";
      g.t = 0;
      g.want = 1;
      openPanel(false);
      g.lens = "eyes";
      g.swoop = 1;
      if (crew.player) hideHead(crew.player, true);
    };
    // Through the curtain: the room takes over with this Ooga and what it carried.
    const handOff = () => {
      const cave = crew.player;
      world.sphereVisit = { room: g.room.id, mode: g.mode, login: g.login, character: cave.traits.name, guided: true, jetpack: g.jetpack };
      world.pilot = cave.traits.name;
      if (go("timechain", String(g.room.id))) { g.state = "gone"; g.t = 0; }
      else world.sphereVisit = null;
    };

    // ---------- the way back out ----------
    // Called by the hub as it opens with the Ooga a room handed back: it stands behind the curtain, in the sphere's
    // zone and out of sight, and walks out once the doorway is its own.
    const arrive = (exit) => {
      const cave = crew.player;
      if (!cave) return false;
      g.exit = exit;
      g.room = ROOMS.get(exit.room);
      g.mode = exit.mode;
      g.jetpack = exit.jetpack || null;
      pilot.navigate({ position: { x: PARK.x, y: place.y + P.floor, z: PARK.z }, yaw: OUT_HEADING + Math.PI, pitch: 0.05, dist: 4 });
      cave.root.rotation.y = OUT_HEADING;
      hold(true);
      g.state = "arriving";
      // A beat behind the curtain first, so the room hears the sphere's zone with this pose before the doors part.
      g.t = -0.3;
      g.lens = "eyes";
      g.swoop = 1;
      hideHead(cave, true);
      return true;
    };
    const startLeaving = () => {
      g.state = "leaving";
      g.t = 0;
      g.want = 1;
      site.plug.visible = false;
    };
    const finishLeaving = () => {
      const cave = crew.player;
      g.state = "idle";
      g.want = 0;
      if (g.cycle !== null) BL.net.doneDoor(g.cycle);
      g.cycle = null;
      hideHead(cave, false);
      hold(false);
      if (g.jetpack && g.jetpack.equipped && cave && h.equipJetpack(cave)) cave.jetFuel = g.jetpack.fuel;
      else if (g.jetpack && cave) cave.jetFuel = g.jetpack.fuel;
      g.jetpack = null;
      g.exit = null;
      lens("back");
    };

    // Per frame, before the crew moves: the walks. After the pilot: the view.
    const update = (dt) => {
      const cave = crew.player, now = performance.now();
      g.t += dt;
      if (g.state === "preparing") {
        if (!cave) { fallBack("Walk an Ooga up to the keypad"); return; }
        const there = steerTo(WAIT.x, WAIT.z, dt);
        if (there) turnTo(IN_HEADING, dt);
        if (g.prepared === false || g.t > PREPARE_LIMIT) { g.failures++; fallBack(`Room ${g.room.id} could not be opened · press Enter to try again`); return; }
        // The look in is taken while the Ooga still stands outside, so the frame it costs is not one of the walk's.
        hangPicture();
        if (g.prepared && there) {
          g.state = "waiting";
          g.t = 0;
          if (reserving()) { askDoor("in"); show("Waiting for the door…"); }
          else if (g.mode === "shared" && BL.net.state.room !== "live") show("Connecting to the island…");
          else startCrossing();
        }
      } else if (g.state === "waiting") {
        if (!cave) { fallBack("Walk an Ooga up to the keypad"); return; }
        hangPicture();
        if (steerTo(WAIT.x, WAIT.z, dt)) turnTo(IN_HEADING, dt);
        // A shared crossing with no room to reserve from goes ahead after a grace; one whose request vanished asks again.
        if (!g.ask && g.cycle === null) {
          if (reserving()) askDoor("in");
          else if (g.mode !== "shared" || BL.net.state.room === "live" || g.t > CONNECT_GRACE) startCrossing();
        }
      } else if (g.state === "crossing") {
        if (!cave) { fallBack("Walk an Ooga up to the keypad"); return; }
        // A grant that expired while the tab slept is not resumed: back to the waiting spot.
        if (g.cycle !== null && BL.net.serverNow() > g.exp && g.t > 0.5) { fallBack("The door closed again · press Enter to try again"); pilot.navigate({ position: { x: WAIT.x, y: place.y, z: WAIT.z }, yaw: IN_HEADING + Math.PI, pitch: 0.1, dist: 4 }); return; }
        if (g.open > 0.55) {
          site.plug.visible = false;
          steerTo(PARK.x, PARK.z, dt);
        } else turnTo(IN_HEADING, dt);
        hangPicture();
        if (localZ(cave.root.position.x, cave.root.position.z) < P.curtain + 0.9 || g.t > WALK_LIMIT) handOff();
      } else if (g.state === "gone") {
        if (cave) steerTo(PARK.x, PARK.z, dt);
        // The room's scene takes over within a fade; one that could not be prepared leaves the island running, and the
        // Ooga goes back out to the bridge.
        if (g.t > 4) {
          world.sphereVisit = null;
          fallBack(`Room ${g.room.id} could not be opened · press Enter to try again`);
          if (cave) pilot.navigate({ position: { x: WAIT.x, y: place.y, z: WAIT.z }, yaw: IN_HEADING + Math.PI, pitch: 0.1, dist: 4 });
        }
      } else if (g.state === "arriving") {
        if (g.t > 0 && !g.ask && g.cycle === null && !(reserving() && askDoor("out"))) startLeaving();
      } else if (g.state === "leaving") {
        // The walk starts once the doors are open enough and goes on while they close behind it.
        if (cave && (g.open > 0.55 || g.want === 0)) {
          const out = steerTo(WAIT.x, WAIT.z, dt), z = localZ(cave.root.position.x, cave.root.position.z);
          if (z > S.THRESHOLD + 1.2) { g.want = 0; site.plug.visible = true; }
          // Hold the eye through the walk and the doors closing; the ordinary island camera returns afterward.
          if (out && g.open === 0 || g.t > WALK_LIMIT) { site.plug.visible = true; finishLeaving(); }
        }
      } else if (g.state === "idle" && cave) {
        // Pressing against the doorway: it only opens from the keypad.
        const lx = localX(cave.root.position.x, cave.root.position.z), lz = localZ(cave.root.position.x, cave.root.position.z);
        if (Math.abs(lx) < P.halfW && lz > S.THRESHOLD && lz < S.THRESHOLD + 1.1 && now - g.hintAt > HINT_GAP * 1000) {
          g.hintAt = now;
          hud.hint("Use keypad to choose a room", 3000);
        }
      }
      // The doors: open for this page's crossing or another player's, closed otherwise.
      const want = Math.max(g.want, now < g.remoteUntil ? 1 : 0), step = REDUCED.matches ? 1 : dt / DOOR_TIME;
      g.open = g.open < want ? Math.min(want, g.open + step) : Math.max(want, g.open - step);
      site.setDoors(g.open * g.open * (3 - 2 * g.open));
    };
    const view = (dt) => {
      const cave = crew.player;
      if (g.lens === "keypad") {
        g.glide = Math.min(1, g.glide + dt / GLIDE);
        keypadPose(g.to);
        putPose(g.from, g.to, g.glide);
      } else if (g.lens === "back") {
        // The pilot is free again and has set its own view this frame: glide from where the doorway left it.
        g.glide = Math.min(1, g.glide + dt / GLIDE);
        readPose(g.to);
        putPose(g.from, g.to, g.glide);
        if (g.glide >= 1) g.lens = null;
      } else if (g.lens === "trail" && cave) {
        g.glide = Math.min(1, g.glide + dt / GLIDE);
        trailPose(cave, g.to);
        putPose(g.from, g.to, g.glide);
      } else if (g.lens === "eyes" && cave) {
        // Every committed approach, crossing and exit frame is from the Ooga's eyes.
        trailPose(cave, g.from);
        eyePose(cave, g.to);
        hideHead(cave, true);
        putPose(g.from, g.to, g.swoop);
      }
    };
    const keyOf = (e) => e.key.length === 1 ? e.key.toLowerCase() : e.key;
    // From the keypad until the Ooga is through, the doorway has the keys: nothing reaches the Ooga, the camera or
    // the hub's shortcuts (a chat line being typed still gets its own).
    const onKey = (e) => {
      if (g.state === "idle" || e.metaKey || e.ctrlKey || e.altKey || e.target && e.target.closest && e.target.closest("input, textarea, [contenteditable]")) return false;
      const k = keyOf(e);
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat || g.state !== "keypad" && g.state !== "account" && g.state !== "preparing" && g.state !== "waiting") return true;
      if (/^[1-9]$/.test(k)) choose(Number(k));
      else if (k === "Enter") { if (g.state === "keypad") commit(); }
      else if (k === "Escape" || k === "Backspace") { if (g.state === "keypad" || g.state === "account") disengage(); else fallBack(`Cancelled · press Enter for Room ${g.selection}`); }
      return true;
    };
    window.addEventListener("keydown", onKey, true);
    const onClick = (e) => {
      const b = e.target.closest("[data-sphere-key]");
      if (!b || b.disabled) return;
      b.blur();
      const k = b.dataset.sphereKey;
      if (/^[1-9]$/.test(k)) choose(Number(k));
      else if (k === "enter") commit();
      else if (k === "back") disengage();
      else if (k === "cancel") { if (g.state === "account") { g.state = "keypad"; show(`Press Enter to go to Room ${g.selection}`); } else fallBack(`Cancelled · press Enter for Room ${g.selection}`); }
      else if (k === "retry") retryAccount();
      else if (k === "solo") commit(true);
    };
    panel.addEventListener("click", onClick);
    // A hidden tab can come back long after a grant ran out; a waiting request is then given up rather than kept.
    const onVisibility = () => {
      if (!document.hidden && g.state === "waiting" && g.ask && performance.now() - g.ask > 60000) fallBack("The wait ran out · press Enter to try again");
    };
    document.addEventListener("visibilitychange", onVisibility);
    const dispose = () => {
      window.removeEventListener("keydown", onKey, true);
      panel.removeEventListener("click", onClick);
      document.removeEventListener("visibilitychange", onVisibility);
      unsubscribeDoor();
      // Through the curtain the crossing is done; anything short of that gives the doorway back.
      if (g.state === "gone" && g.cycle !== null) BL.net.doneDoor(g.cycle);
      else if (g.cycle !== null || g.ask) BL.net.cancelDoor();
      g.prep++;
      dropPicture();
      if (crew.player) hideHead(crew.player, false);
      openPanel(false);
      g.state = "idle";
    };
    show();
    return {
      action, nearKeypad, engage, update, view, arrive, dispose, onKey, get preselected() { return preselect; },
      get busy() { return g.state !== "idle"; },
      get crossing() { return g.state === "crossing" || g.state === "gone" || g.state === "leaving" || g.state === "arriving"; },
      debug: g, choose, commit, disengage
    };
  };
  BL.timechainGate = { create };
})();
