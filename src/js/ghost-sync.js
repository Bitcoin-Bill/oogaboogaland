// HALLOWEEN: the ghost hunt kept in step for signed-in players. The room's elected host (npc-sync.js's role) runs the
// hunt and sends its whole state as one `gh` record in the npc frame's event tail (`npcSync.extra`), four times a
// second while a page follows; a follower takes each one as it arrives (`onSnapshot`). Followers report to the host
// through the room (`net.sendGhost`, relayed to the host alone, worker/src/room.js): `start` when they click the
// herald, `hit` when their weapon lands on a ghost, `pause` when they press P. The host hears them with `onMessage(msg)`, `msg.from` the room's
// id of the page that sent it. Signed out, or with no room, a page is "solo" and runs its own hunt.
(() => {
  "use strict";
  const BL = window.BL = window.BL || {};

  const create = ({ npcSync, write, onSnapshot, onMessage }) => {
    const net = BL.net;
    npcSync.extra = { write, read: onSnapshot };
    const unsubscribe = net.subscribeGhost((msg) => {
      if (npcSync.role !== "host" || !Number.isSafeInteger(msg.from) || msg.from <= 0) return;
      if (msg.k === "start" || msg.k === "pause") onMessage({ k: msg.k, from: msg.from, g: 0, d: 0 });
      else if (msg.k === "hit" && Number.isInteger(msg.g) && msg.g >= 0 && Number.isInteger(msg.d) && msg.d >= 1 && msg.d <= 60) onMessage({ k: "hit", from: msg.from, g: msg.g, d: msg.d });
    });
    const START = { t: "ghost", k: "start" }, PAUSE = { t: "ghost", k: "pause" }, HIT = { t: "ghost", k: "hit", g: 0, d: 0 };
    const start = () => net.sendGhost(START);
    const pause = () => net.sendGhost(PAUSE);
    const hit = (id, damage) => {
      HIT.g = id;
      HIT.d = Math.max(1, Math.min(60, Math.round(damage)));
      net.sendGhost(HIT);
    };
    const dispose = () => {
      unsubscribe();
      if (npcSync.extra && npcSync.extra.write === write) npcSync.extra = null;
    };
    return { start, pause, hit, dispose, get role() { return npcSync.role; } };
  };

  BL.ghostSync = { create };
})();
