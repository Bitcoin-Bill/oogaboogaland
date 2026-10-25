// Bitcoin Bill of Bitcoin Guide (bitcoinguide.app): salt-and-pepper hair swept back under a frayed beach straw hat,
// a full beard going grey at the chin, and glowing orange laser eyes. A tie-dye tank in blue and green with
// a cord necklace and an orange coin, and a woven hammock sling across his chest carrying his chihuahua, painted up
// like an alebrije in violet, orange and turquoise.
(() => {
  "use strict";
  const BL = window.BL;
  const { makeVox } = BL.models;
  const { createNode, addChild } = BL.scene;
  const ORANGE = "#ff9a1f", ORANGE_CORE = "#fff1c4";
  const STRAW = ["#d8c08a", "#c4a768", "#e8d7a8"], BAND = "#7a5a3a";
  const DYE = ["#2f8fd8", "#3fc6b5", "#7fd36a", "#1f6fb0", "#56b8e8"];
  const WEAVE = ["#d9603b", "#2fb5a8", "#f2c14e", "#e2477f"];
  // The straw hat in the head's voxel grid: a domed crown with a dark band, and a wide brim that droops at its rim and
  // trails ragged strands. Built once a page for each build kit, from the kit's own random draws.
  const hatVox = (k) => {
    // The crown sits over the hair's whole footprint (x -1 to 7, z -1 to 6), so no cell doubles a hair cell.
    const v = makeVox(), colors = STRAW.map((c) => k.color(c)), band = k.color(BAND), pick = () => colors[Math.floor(k.rand() * colors.length)];
    for (let y = 9; y <= 12; y++) {
      const inset = y >= 12 ? 1 : 0;
      v.fill(-1 + inset, 7 - inset, y, y, -1 + inset, 6 - inset, y === 10 ? band : pick);
    }
    const cx = 3, cz = 2.5;
    for (let x = -6; x <= 12; x++) for (let z = -6; z <= 11; z++) {
      const d = Math.hypot(x - cx, z - cz);
      if (d > 8.2 || (x >= -1 && x <= 7 && z >= -1 && z <= 6)) continue;
      const rim = d > 6.8;
      v.set(x, rim ? 8 : 9, z, pick());
      // Strands hanging from the rim, one or two cells long, but none across the front, where they'd hide his eyes.
      if (rim && k.rand() < 0.3 && !(z > 7 && Math.abs(x - cx) < 4.5)) {
        v.set(x, 7, z, pick());
        if (k.rand() < 0.4) v.set(x, 6, z, pick());
      }
    }
    return v;
  };
  BL.characters.add({
    handle: "Bitcoin-Bill",
    github: "Bitcoin-Bill",
    display: "Bitcoin Bill",
    joined: 1792943472,
    lastCommit: 1792943472,
    look: {
      face: "beard", noPupils: true, height: 1.04, hatY: 13,
      skin: "#d99a74", hair: "#3b3430", fur: "#a97f52",
      portrait: { min: [-1, -2, 0], max: [7, 6, 8] }
    },
    voice: {
      poke: "Bitcoin the easy way!",
      idle: [
        "Roll the dice, make the seed.",
        "Not your keys, not your coconuts.",
        "Read the white paper. Then read it again.",
        "Laser eyes on. Stack sats.",
        "Hold on tight, little dog.",
        "Proof of work, not proof of talk."
      ]
    },
    dress: {
      // The tie-dye tank: a spiral of blue, teal and green rings over the chest, bare shoulders and a scoop neck, a cord
      // necklace with an orange coin, then the hammock sling from his right shoulder to his left hip with its pouch
      // on his belly and the chihuahua's head poking out.
      torso(k, v) {
        const dye = DYE.map((c) => k.color(c)), skin = k.skinJ, cord = k.color("#2a2018"), coin = k.color("#f7931a");
        const weave = WEAVE.map((c) => k.color(c));
        v.fill(1, 7, 3, 7, 1, 4, (x, y) => dye[(Math.round(Math.hypot(x - 4, y - 5) * 1.3) + (k.rand() < 0.15 ? 1 : 0)) % dye.length]);
        v.fill(1, 1, 7, 7, 1, 4, skin);
        v.fill(7, 7, 7, 7, 1, 4, skin);
        v.fill(3, 5, 6, 7, 4, 4, skin);
        v.set(4, 5, 4, skin);
        v.set(3, 6, 4, cord); v.set(5, 6, 4, cord); v.set(4, 5, 4, cord);
        v.set(4, 4, 4, coin);
        // The sling, woven in three-colour stripes, front and back.
        for (let y = 3; y <= 7; y++) {
          const x = 1 + Math.round((7 - y) * 0.4) + (7 - y);
          for (const z of [1, 4]) for (const dx of [0, 1]) if (x + dx >= 1 && x + dx <= 7) v.set(x + dx, y, z, weave[y % 3]);
        }
        // The pouch hangs in front of his belly.
        for (let x = 4; x <= 8; x++) for (let y = 2; y <= 4; y++) for (let z = 5; z <= 6; z++) {
          if (y === 2 && (x === 4 || x === 8)) continue;
          v.set(x, y, z, weave[(y + (x === 4 || x === 8 ? 3 : 0)) % weave.length]);
        }
        // The chihuahua as an alebrije: a red-brown head painted with violet swirls, an orange flower on the brow and
        // turquoise dots, a cream muzzle, big brown ears with pink insides, dark eyes and nose, and a collar of blue
        // beads at the pouch's lip.
        const coat = k.color("#8a4a2e"), coatDk = k.color("#6e3a24"), violet = k.color("#7a3fd0"), flower = k.color("#ff7a2a");
        const teal = k.color("#3fd8e0"), cream = k.color("#f0d2a8"), pink = k.color("#f28ab0"), black = k.color("#15100c"), bead = k.color("#5ab8ff");
        v.fill(5, 7, 5, 7, 5, 7, k.jit(coat, coatDk, 0.2));
        v.set(5, 7, 7, violet); v.set(7, 7, 6, violet); v.set(5, 5, 5, violet); v.set(7, 5, 5, violet);
        v.set(6, 7, 7, flower);
        v.set(5, 5, 7, teal); v.set(7, 5, 7, teal);
        v.set(6, 5, 8, cream);
        v.set(6, 5, 9, black);
        v.set(5, 6, 7, black); v.set(7, 6, 7, black);
        for (const x of [5, 7]) {
          v.set(x, 8, 6, coat); v.set(x, 9, 6, coat);
          v.set(x, 8, 7, pink);
        }
        for (let x = 5; x <= 7; x++) v.set(x, 4, 7, bead);
        // A paw over the pouch's lip.
        v.set(4, 4, 7, cream);
      },
      // Salt and pepper: grey through the sides and back of the hair.
      crown(k, v) {
        const grey = k.color("#8b8279"), silver = k.color("#b3aba1");
        for (let y = 2; y <= 8; y++) for (let z = -1; z <= 6; z++) for (const x of [-1, 7]) {
          if (v.has(x, y, z) && k.rand() < 0.35) v.set(x, y, z, k.rand() < 0.5 ? grey : silver);
        }
        for (let x = 0; x <= 6; x++) for (let y = 2; y <= 8; y++) if (v.has(x, y, -1) && k.rand() < 0.25) v.set(x, y, -1, grey);
      },
      // Laser eyes: both glowing Bitcoin orange, each with a white-hot core.
      eyes(k, v) {
        const o = k.color(ORANGE), oc = k.color(ORANGE_CORE);
        for (const [x0, ring, core] of [[0, o, oc], [5, o, oc]]) {
          for (let x = x0; x <= x0 + 1; x++) for (let y = 2; y <= 3; y++) {
            v.set(x, y, 5, ring);
            k.eyeCells.push([x, y]);
          }
          v.set(x0 + (x0 ? 0 : 1), 3, 5, core);
        }
        k.headEmissive = { [o]: 1, [oc]: 1.4 };
        return true;
      },
      // The beard greys toward the chin: dark through the moustache and cheeks, silver at the bottom.
      mark(k, v) {
        const dark = k.color("#3f3732"), mid = k.color("#857c72"), silver = k.color("#c9c3b9"), skip = new Set([k.P.nose, k.P.white, k.P.skin, k.P.skinDk]);
        for (let x = 0; x <= 6; x++) for (let y = -2; y <= 1; y++) for (let z = 5; z <= 7; z++) {
          if (!v.has(x, y, z) || skip.has(v.get(x, y, z))) continue;
          const r = k.rand();
          v.set(x, y, z, y <= -1 ? (r < 0.7 ? silver : mid) : y === 0 ? (r < 0.4 ? silver : r < 0.75 ? mid : dark) : (r < 0.6 ? dark : mid));
        }
      },
      headgear(k) {
        addChild(k.parts.head, createNode({ geometry: k.vg(hatVox(k), { x: -3.5 * k.u, y: 0, z: -3 * k.u }) }));
      }
    }
  });
})();
