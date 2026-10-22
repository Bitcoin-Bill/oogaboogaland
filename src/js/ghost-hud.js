// HALLOWEEN: the ghost hunt's HUD (`#ghost-hud`, `#ghost-flash` in index.html): the round line, the visitor's own
// bar, the banners the lab showed ("Round 3", "THE BOSS is here", ...), the boss's health and the flash when a ghost
// gets you. The markup carries no data-scene (the director would show it on every arrival); this module alone shows
// and hides it. Every setter writes the DOM only when its value changed, so calling them each frame costs nothing.
// The banners are set in Creepster (ghost-font-data.js), the lab's face, added once from its bytes: a FontFace made from
// a buffer fetches nothing, so the content policy needs no font source. Until it is ready they show in the fallback.
(() => {
  "use strict";
  const BL = window.BL = window.BL || {};
  let face = null;
  const loadFace = () => {
    if (face || typeof FontFace === "undefined" || !BL.ghostFontData) return;
    const raw = atob(BL.ghostFontData), bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    face = new FontFace("Creepster", bytes.buffer);
    face.load().then(() => document.fonts.add(face), () => {});
  };

  // How to play: each line its keys and what they do, for a keyboard and mouse or for touch.
  const INTRO = {
    keys: [[["W", "A", "S", "D"], "Move your Ooga"], [["Mouse"], "Aim, and click to fire"], [["X"], "Switch to your weapon"]],
    touch: [[["Left stick"], "Move your Ooga"], [["Combat"], "Switch to your weapon"], [["Hold fire"], "Shoot the ghosts"]]
  };
  /** The HUD; `onGo` when the visitor dismisses how to play. */
  const create = ({ onGo = null } = {}) => {
    loadFace();
    const el = {
      hud: document.getElementById("ghost-hud"), top: document.getElementById("ghost-top"), lives: document.getElementById("ghost-lives"), health: document.getElementById("ghost-health"),
      banner: document.getElementById("ghost-banner"), title: document.getElementById("ghost-banner-title"), sub: document.getElementById("ghost-banner-sub"),
      boss: document.getElementById("ghost-boss"), bar: document.getElementById("ghost-boss-bar"), flash: document.getElementById("ghost-flash"),
      intro: document.getElementById("ghost-intro"), introKeys: document.getElementById("ghost-intro-keys"), introGo: document.getElementById("ghost-intro-go")
    };
    const go = () => { if (onGo) onGo(); };
    // Inside the dialog the island leaves the keys alone, so it takes its own: Enter, Space or Escape go on.
    const introKey = (e) => {
      if (e.key !== "Enter" && e.key !== " " && e.key !== "Escape") return;
      e.preventDefault();
      if (!e.repeat) go();
    };
    el.introGo.addEventListener("click", go);
    el.intro.addEventListener("keydown", introKey);
    const last = { shown: false, top: null, lives: null, title: null, sub: null, boss: -1, livesState: "", health: -2 };
    const cells = el.health.children;
    const text = (node, key, value) => {
      if (last[key] === value) return;
      last[key] = value;
      node.textContent = value;
    };
    const show = (on) => {
      if (last.shown === on) return;
      last.shown = on;
      el.hud.hidden = !on;
      if (!on) { banner(null); boss(-1); health(-1); intro(false); el.flash.hidden = true; }
    };
    const top = (value) => text(el.top, "top", value);
    // `state` styles the bar: "", "frozen" or "away".
    const lives = (value, state = "") => {
      text(el.lives, "lives", value);
      if (last.livesState !== state) { last.livesState = state; el.lives.dataset.state = state; }
    };
    const banner = (title, sub = "") => {
      if (title === null) {
        if (last.title !== null) { last.title = null; el.banner.hidden = true; }
        return;
      }
      if (last.title === null) el.banner.hidden = false;
      text(el.title, "title", title);
      text(el.sub, "sub", sub);
    };
    // The visitor's health, `filled` cells of the bar lit, or below 0 to hide it; two or fewer lit go red.
    const health = (filled) => {
      if (filled === last.health) return;
      if ((filled < 0) !== (last.health < 0)) el.health.hidden = filled < 0;
      last.health = filled;
      if (filled < 0) return;
      for (let i = 0; i < cells.length; i++) cells[i].toggleAttribute("data-on", i < filled);
      el.health.toggleAttribute("data-low", filled <= 2);
      el.health.setAttribute("aria-valuenow", String(filled));
    };
    // A round's start: the bar glows orange and its cells fill back one after another (the stagger only while it glows,
    // so a hit after it empties a cell at once).
    const healed = () => el.health.classList.remove("healing");
    el.health.addEventListener("animationend", healed);
    const heal = () => {
      el.health.classList.remove("healing");
      void el.health.offsetWidth;
      el.health.classList.add("healing");
    };
    // How to play, shown (`coarse` for touch words) or put away.
    const intro = (on, coarse = false) => {
      if (!on) { if (!el.intro.hidden) { el.intro.hidden = true; el.introGo.blur(); } return; }
      el.introKeys.replaceChildren(...(coarse ? INTRO.touch : INTRO.keys).map(([keys, what]) => {
        const li = document.createElement("li"), span = document.createElement("span"), text = document.createElement("b");
        for (const k of keys) { const kbd = document.createElement("kbd"); kbd.textContent = k; span.append(kbd); }
        text.textContent = what;
        li.append(span, text);
        return li;
      }));
      el.intro.hidden = false;
      el.introGo.focus({ preventScroll: true });
    };
    // The boss's health, 0..1, or below 0 to hide the bar.
    const boss = (fraction) => {
      const v = fraction < 0 ? -1 : Math.round(fraction * 200) / 200;
      if (v === last.boss) return;
      if ((v < 0) !== (last.boss < 0)) el.boss.hidden = v < 0;
      last.boss = v;
      if (v >= 0) el.bar.value = v;
    };
    // A ghost got you ("hurt") or a wraith has your soul ("soul"); the CSS animation fades it.
    const flash = (kind) => {
      el.flash.hidden = false;
      el.flash.dataset.kind = kind;
      el.flash.classList.remove("on");
      void el.flash.offsetWidth;
      el.flash.classList.add("on");
    };
    const soul = (on) => {
      if (on) { if (el.flash.dataset.kind !== "soul" || el.flash.hidden) { el.flash.hidden = false; el.flash.dataset.kind = "soul"; el.flash.classList.remove("on"); } }
      else if (el.flash.dataset.kind === "soul" && !el.flash.hidden) el.flash.hidden = true;
    };
    const dispose = () => {
      el.introGo.removeEventListener("click", go);
      el.intro.removeEventListener("keydown", introKey);
      el.health.removeEventListener("animationend", healed);
      healed();
      show(false);
      el.flash.classList.remove("on");
    };
    return { show, top, lives, health, heal, intro, banner, boss, flash, soul, dispose };
  };

  BL.ghostHud = { create };
})();
