// The Lightning Jet Hangar's engine static fire test: the station behind the Jet's right engine (`HM.fireStation`,
// standing at `LAYOUT.fireTest`, its back to the engines) and the test its big red button starts. A press flips the
// guard, sinks the button and sets the beacons turning; the screen and the status lamps follow the sequence (`AT`), the
// meter climbing with the spool-up, full while the engines fire, flickering as they falter, dark from the blast, and
// refilling through the cooldown while the result stands on the screen, until the station is ready again. Everything
// is built once a visit and moved in place, allocating nothing a frame.
(() => {
  "use strict";
  const BL = window.BL = window.BL || {};
  const { createNode, addChild } = BL.scene;
  const HM = BL.hangarModels;

  // The test from the press, in seconds: armed, the engines spooling up, firing, faltering (warning) and blowing (boom),
  // the presser out cold (out), and the result standing until the station is ready again.
  const AT = { spool: 0.5, fire: 3, warning: 6, boom: 7.5, out: 7.6, result: 10.6, ready: 30.6 };
  // What the screen shows in each phase.
  const SCREEN = { ready: "ready", armed: "armed", spool: "spool", fire: "fire", warning: "warning", boom: "boom", out: "boom", result: "result" };
  const SCREENS = ["ready", "armed", "spool", "fire", "warning", "boom", "result"];
  // How far the guard swings open and how long it takes, the button's travel, how near the button an Ooga reaches it,
  // m, and how high its feet may stand; the beacons' turn a second and the strobe's flashes.
  const GUARD_OPEN = 1.95, GUARD_TIME = 0.25, PRESS_DEPTH = 0.035, REACH = 1.7, FEET = 0.5, SPIN = 9, STROBE = 6;
  // A lamp's glow when out; how far in front of the faces they lie on the Canvas 2D sort keeps the parts on the
  // console's faces.
  const DIM = 0.12, FRONT = -0.15;

  const phaseAt = (t) => t < 0 ? "ready" : t < AT.spool ? "armed" : t < AT.fire ? "spool" : t < AT.warning ? "fire" : t < AT.boom ? "warning"
    : t < AT.out ? "boom" : t < AT.result ? "out" : "result";
  const ease = (u) => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
  // A lamp blinking `hz` times a second on the clock.
  const blink = (clock, hz) => (clock * hz) % 1 < 0.5 ? 1 : DIM;

  // The station under `parent` (the scene's root), with its cables across the floor to the engines.
  const create = (parent) => {
    const L = HM.LAYOUT.fireTest, F = HM.FIRE, P = HM.fireStation(), c = Math.cos(L.turn), s = Math.sin(L.turn);
    const at = (p, dy = 0) => ({ x: p[0], y: p[1] + dy, z: p[2] });
    const group = createNode({ position: { x: L.x, y: 0, z: L.z }, rotation: { x: 0, y: L.turn, z: 0 } });
    const body = createNode({ geometry: P.body });
    const button = createNode({ position: at(F.button), geometry: P.button, depthBias: FRONT });
    const guard = createNode({ position: at(F.hinge), rotation: { x: 0, y: 0, z: 0 }, geometry: P.guard, sightHidden: true, depthBias: 2 * FRONT });
    const beacons = F.beacons.map(([x, z]) => {
      const dome = createNode({ position: { x, y: F.beaconY + 0.06, z }, geometry: P.beacon, sightHidden: true });
      const reflector = createNode({ rotation: { x: 0, y: 0, z: 0 }, geometry: P.reflector, sightHidden: true });
      addChild(dome, reflector);
      return { dome, reflector };
    });
    const strobe = createNode({ position: at(F.strobe, 0.05), geometry: P.strobe, sightHidden: true });
    const lamps = F.lamps.map((p, i) => createNode({ position: at(p), geometry: P.lamps[i], sightHidden: true, depthBias: 2 * FRONT }));
    const meter = Array.from({ length: 10 }, (_, i) => createNode({ position: { x: F.meter[0] + i * F.meter[3], y: F.meter[1], z: F.meter[2] }, geometry: P.segment, sightHidden: true, depthBias: 2 * FRONT }));
    const screens = {};
    for (const key of SCREENS) screens[key] = createNode({ position: at(F.screen), geometry: HM.firePicture(key), sightHidden: true, visible: key === "ready", depthBias: FRONT });
    addChild(group, body, createNode({ geometry: P.details, depthBias: FRONT }), button, guard, createNode({ position: at(F.hinge), geometry: P.hinge }), strobe,
      ...beacons.map((b) => b.dome), ...lamps, ...meter, ...Object.values(screens),
      createNode({ position: at(F.title), geometry: HM.firePicture("title"), sightHidden: true, depthBias: FRONT }),
      createNode({ position: at(F.plate), geometry: HM.firePicture("plate"), sightHidden: true, depthBias: FRONT }));
    const cables = createNode({ geometry: HM.fireCables() });
    addChild(parent, group, cables);

    // `t` is the time since the press, -1 while the station stands ready; `clock` times the blinking.
    let t = -1, clock = 0, phase = "ready", shown = "ready", near = false;
    const ready = () => t < 0;
    const press = () => {
      if (t >= 0) return false;
      t = 0;
      return true;
    };
    // Whether an Ooga standing at (x, z), its feet `feet` up, reaches the button: in front of the console and near it.
    const reaches = (x, z, feet) => {
      const dx = x - L.x, dz = z - L.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
      return feet < FEET && lz > F.footprint[3] && Math.hypot(lx - F.button[0], lz - F.button[2]) < REACH;
    };
    // Space beside the button presses it while the station is ready; during the test and its cooldown it stays the
    // visitor's own.
    const useNear = (x, z, reach, feet) => ready() && reaches(x, z, feet) && press();
    const actLabel = () => (near && ready() ? "DON'T PRESS" : null);

    // Once a frame, with the Ooga the visitor drives here (or null).
    const update = (dt, driven) => {
      clock += dt;
      if (t >= 0) {
        t += dt;
        if (t >= AT.ready) t = -1;
      }
      phase = phaseAt(t);
      if (driven) {
        const p = driven.root.position;
        near = reaches(p.x, p.z, p.y - driven.baseY);
      } else near = false;
      const running = t >= 0;
      // The guard opens at the press and closes a second into the result; the button sinks and springs back.
      const open = !running ? 0 : t < AT.result + 1 ? ease(t / GUARD_TIME) : 1 - ease((t - AT.result - 1) / 0.6);
      guard.rotation.x = -GUARD_OPEN * open;
      button.position.y = F.button[1] - PRESS_DEPTH * (running && t > 0.1 && t < 0.5 ? ease((t - 0.1) / 0.08) : 0);
      button.glow = !running ? 0.7 + 0.3 * Math.sin(clock * 3) : phase === "result" ? 0.25 : 1;
      // The beacons turn from the press to the result; the strobe flashes from the warning until the presser comes to.
      const turning = running && phase !== "result";
      for (let i = 0; i < beacons.length; i++) {
        const b = beacons[i];
        if (turning) b.reflector.rotation.y += SPIN * dt;
        b.dome.glow = turning ? 0.85 + 0.15 * Math.sin(b.reflector.rotation.y * 2) : DIM;
        b.reflector.glow = turning ? 1 : 0;
      }
      strobe.glow = phase === "warning" || phase === "boom" || phase === "out" ? blink(clock, STROBE) : DIM;
      lamps[0].glow = phase === "ready" ? 1 : DIM;
      lamps[1].glow = phase === "armed" || phase === "spool" ? blink(clock, 2) : phase === "result" ? 1 : DIM;
      lamps[2].glow = phase === "fire" || phase === "boom" || phase === "out" ? 1 : phase === "warning" ? blink(clock, 5) : DIM;
      // The meter, its unlit segments leaving the dark slot: full while ready, climbing with the spool-up, full under
      // fire, flickering in the warning, out from the blast, and refilling through the cooldown.
      const lit = phase === "ready" || phase === "fire" ? 10 : phase === "spool" ? 10 * (t - AT.spool) / (AT.fire - AT.spool)
        : phase === "result" ? 10 * (t - AT.result) / (AT.ready - AT.result) : 0;
      for (let i = 0; i < meter.length; i++) meter[i].visible = phase === "warning" ? Math.sin(clock * 37 + i * 2.3) > 0.2 : i < lit;
      const key = SCREEN[phase];
      if (key !== shown) {
        screens[shown].visible = false;
        screens[key].visible = true;
        shown = key;
      }
    };

    return {
      group, body, cables, press, update, useNear, actLabel, AT,
      get phase() { return phase; }, get t() { return t; }, get near() { return near; }, get ready() { return ready(); }
    };
  };

  BL.hangarFire = { create, AT };
})();
