// Kortik's Sis in the Lightning Jet Hangar: the chief engineer of a Jet she is sure will never fly. For now she stands
// at her spot by the Jet's nose (`LAYOUT.sis`) in her concept's pose, the hammer on her right shoulder and her left
// fist on her hip, breathing, blinking, and turning her head to glare at whoever comes near. Her roaming, voice, rages
// and the poke game come next. Everything runs on the rig's fixed nodes; update allocates nothing.
(() => {
  "use strict";
  const BL = window.BL, SM = BL.sisModels, HM = BL.hangarModels;
  const { createNode, addChild } = BL.scene;

  // How near someone must come for her to glare at them, m, how far her head turns to, and how fast it follows;
  // the time between blinks and a blink's length, s.
  const GLARE = 7, TURN = 0.5, FOLLOW = 5, BLINK = [2.2, 5], SHUT = 0.12;
  // The pose: her right arm raised with the hammer's handle over her shoulder, her left fist on her hip; each part's
  // rotation, [x, y, z].
  const POSE = { armR: [-0.55, 0, -0.75], foreR: [-1.9, 0, 0.4], hammer: [Math.PI / 2 + 0.25, 0, 0.7], armL: [0.15, 0, 0.7], foreL: [-0.2, 0, -1.7], head: [0.08, 0, 0] };

  const create = () => {
    const S = HM.LAYOUT.sis, k = SM.rig(), P = k.parts, H = k.heads;
    const node = createNode({ position: { x: S.x, y: k.HIP, z: S.z }, rotation: { x: 0, y: S.turn, z: 0 } });
    addChild(node, k.root);
    for (const [key, [x, y, z]] of Object.entries(POSE)) { P[key].rotation.x = x; P[key].rotation.y = y; P[key].rotation.z = z; }
    const rand = BL.math.mulberry32(0x5153);
    let clock = 0, blinkAt = BLINK[0], shut = 0, look = 0;

    // Once a frame with where the visitor is (their Ooga, or the view), or null.
    const update = (dt, viewer) => {
      clock += dt;
      // Breathing, her shoulders and the hammer with them.
      const breath = Math.sin(clock * 1.9);
      P.torso.scale.y = 1 + breath * 0.012;
      P.armR.rotation.x = POSE.armR[0] + breath * 0.02;
      // Her head turns to glare at whoever is near, within its reach, and back ahead when they go.
      let want = 0;
      if (viewer) {
        const dx = viewer.x - S.x, dz = viewer.z - S.z;
        if (dx * dx + dz * dz < GLARE * GLARE) {
          let a = Math.atan2(dx, dz) - S.turn;
          a -= Math.PI * 2 * Math.round(a / (Math.PI * 2));
          want = Math.max(-TURN, Math.min(TURN, a));
        }
      }
      look += (want - look) * Math.min(1, dt * FOLLOW);
      P.head.rotation.y = look;
      // Blinking now and then.
      if (shut > 0) shut -= dt;
      else if ((blinkAt -= dt) <= 0) {
        shut = SHUT;
        blinkAt = BLINK[0] + rand() * (BLINK[1] - BLINK[0]);
      }
      P.head.geometry = shut > 0 ? H.closed : H.open;
    };
    // Her other faces, off the graph until she wears them, kept on the GPU.
    const liveGeometry = (set) => { for (const g of Object.values(H)) set.add(g); };

    return { node, body: P.torso, update, liveGeometry };
  };

  BL.sis = { create };
})();
