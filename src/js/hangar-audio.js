// The Lightning Jet Hangar's sound, on the Lightning Factory's pattern: one AudioContext opened from a gesture the
// browser has already activated, a bed of voices built once and only ever re-levelled, so nothing is allocated or
// restarted while it plays, and one noise loop behind every hiss.
//
// The bed is the hangar humming: everywhere the mains' low hum, a deep drone that beats and swells slowly, and the
// vast hall's air breathing; and, louder as the visitor nears each, the launch tunnel's neon buzzing all round them
// inside it, and the shimmer of each shield, the launch shield's at the tunnel's end and the door's. `listen` says
// where the visitor hears from and which way the view faces, and `update(dt)` levels the bed from there ten times a
// second. It honours the page-wide mute (`oogaboogaland.audio`) and the tab's visibility, and `dispose` closes it.
(() => {
  "use strict";
  const BL = window.BL = window.BL || {};
  const { clamp } = BL.math;
  const NOISE_SECONDS = 2, MASTER = 0.5, STORAGE_KEY = "oogaboogaland.audio", PAN = 0.75;
  // How loud each part of the bed sits: the hum, the drone and the air everywhere, more air inside the tunnel, the
  // neon at its loudest inside it, and each shield close to; and at how many metres each of those last falls to half.
  const LEVEL = { mains: 0.05, drone: 0.08, air: 0.045, tunnelAir: 0.035, neon: 0.05, launch: 0.11, door: 0.06 };
  const REF = { neon: 5, launch: 9, door: 5 };

  // `spots`: the door's shield and the launch shield, { x, y, z } each, and the tunnel's axis { y, z0, z1 }.
  const create = (spots) => {
    let ctx = null, master = null, buffer = null, ready = false, muted = false, disposed = false, since = 0;
    try {
      muted = localStorage.getItem(STORAGE_KEY) === "off";
    } catch {
      muted = false;
    }
    const bed = {};
    // Where the visitor hears from and the way the view faces on the ground, and where the last spot was placed.
    const ear = { x: 0, y: 0, z: 0, fx: 0, fz: -1 }, AT = { level: 0, pan: 0 };

    const gain = (value, to) => {
      const g = ctx.createGain();
      g.gain.value = value;
      if (to) g.connect(to);
      return g;
    };
    const filter = (type, freq, q, to) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      if (to) f.connect(to);
      return f;
    };
    const panner = () => {
      const p = ctx.createStereoPanner();
      p.connect(master);
      return p;
    };
    const osc = (type, freq, to) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.connect(to);
      o.start();
      return o;
    };
    const hissOf = (to) => {
      const s = ctx.createBufferSource();
      s.buffer = buffer;
      s.loop = true;
      s.connect(to);
      s.start(0, Math.random() * NOISE_SECONDS);
      return s;
    };
    // A wobble on `param` round its value: an oscillator at `hz` swinging it `depth` either way.
    const wobble = (param, hz, depth) => {
      const d = gain(depth, null);
      d.connect(param);
      return osc("sine", hz, d);
    };
    // A shield's shimmer: two tones a little apart, beating, and a thin fizz, panned to its side.
    const shimmer = (f) => {
      const pan = panner(), g = gain(0, pan);
      return { pan, gain: g, a: osc("sine", f, g), b: osc("sine", f * 1.0138, g), fizz: hissOf(filter("bandpass", 5200, 8, gain(0.5, g))) };
    };

    const init = () => {
      ctx = new AudioContext();
      master = gain(muted ? 0 : MASTER, ctx.destination);
      buffer = ctx.createBuffer(1, ctx.sampleRate * NOISE_SECONDS, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      // The mains' hum, a low saw's lower harmonics so small speakers carry it.
      bed.mainsGain = gain(0, master);
      bed.mains = osc("sawtooth", 55, filter("lowpass", 260, 0.6, bed.mainsGain));
      bed.mains2 = osc("sine", 110, gain(0.3, bed.mainsGain));
      // The drone the hall itself seems to make: two low tones a hair apart, beating, their octave over them, and the
      // whole swelling and falling back slowly.
      bed.droneGain = gain(0, master);
      const drone = filter("lowpass", 220, 0.7, bed.droneGain);
      bed.drone = osc("sine", 41.2, drone);
      bed.drone2 = osc("sine", 41.75, drone);
      bed.drone3 = osc("triangle", 82.4, gain(0.35, drone));
      bed.swell = wobble(bed.droneGain.gain, 0.07, 0.02);
      // The hall's air, breathing slowly.
      bed.airGain = gain(0, master);
      bed.airFilter = filter("lowpass", 280, 0.8, bed.airGain);
      bed.air = hissOf(bed.airFilter);
      bed.breath = wobble(bed.airFilter.frequency, 0.23, 90);
      // The tunnel's neon, buzzing: a mains-rate square through a narrow band, and its fizz.
      bed.neonPan = panner();
      bed.neonGain = gain(0, bed.neonPan);
      bed.neon = osc("square", 120, filter("bandpass", 240, 3, bed.neonGain));
      bed.neonFizz = hissOf(filter("bandpass", 4200, 6, gain(0.6, bed.neonGain)));
      // The launch shield's shimmer, lower than the door's.
      bed.launch = shimmer(174.6);
      bed.door = shimmer(196);
      ready = true;
    };

    // Only from a gesture the browser has already counted, so nothing warns in the console; a gesture also wakes a
    // context the browser started suspended.
    const activate = () => {
      if (disposed) return;
      if (ready) {
        if (ctx.state === "suspended" && !document.hidden) ctx.resume().catch(() => {});
        return;
      }
      if (muted || typeof AudioContext === "undefined" || navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
      init();
    };
    window.addEventListener("pointerdown", activate, true);
    window.addEventListener("keydown", activate, true);
    // A hidden tab stops the bed; showing it again picks it up.
    const onVisibility = () => {
      if (!ready) return;
      if (document.hidden) ctx.suspend().catch(() => {});
      else ctx.resume().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Where (x, y, z) is from the visitor, into AT: its level, half at `ref` metres, and its side of the view.
    const place = (x, y, z, ref) => {
      const dx = x - ear.x, dy = y - ear.y, dz = z - ear.z, flat = Math.hypot(dx, dz), r = Math.hypot(flat, dy) / ref;
      AT.level = 1 / (1 + r * r);
      AT.pan = flat > 0.5 ? clamp((dx * -ear.fz + dz * ear.fx) / flat, -1, 1) * PAN * Math.min(1, flat / 3) : 0;
    };
    const listen = (x, y, z, fx, fz) => {
      const l = Math.hypot(fx, fz) || 1;
      ear.x = x; ear.y = y; ear.z = z; ear.fx = fx / l; ear.fz = fz / l;
    };

    // The bed, ten times a second, eased: the neon from the nearest point on the tunnel's axis, so it surrounds a
    // visitor inside it and comes out of its mouth to one in the hall, and each shield from where it stands.
    const set = (param, value, now) => param.setTargetAtTime(value, now, 0.15);
    const update = (dt) => {
      if (!ready) {
        activate();
        if (!ready) return;
      }
      since += dt;
      if (since < 0.1 || muted) return;
      since = 0;
      const now = ctx.currentTime, T = spots.tunnel, L = spots.launch, D = spots.door;
      set(bed.mainsGain.gain, LEVEL.mains, now);
      set(bed.droneGain.gain, LEVEL.drone, now);
      set(bed.airGain.gain, LEVEL.air + LEVEL.tunnelAir * clamp((T.z0 - ear.z) / 6, 0, 1), now);
      place(0, T.y, clamp(ear.z, T.z1, T.z0), REF.neon);
      set(bed.neonGain.gain, LEVEL.neon * AT.level, now);
      set(bed.neonPan.pan, AT.pan * 0.4, now);
      place(L.x, L.y, L.z, REF.launch);
      set(bed.launch.gain.gain, LEVEL.launch * AT.level, now);
      set(bed.launch.pan.pan, AT.pan, now);
      place(D.x, D.y, D.z, REF.door);
      set(bed.door.gain.gain, LEVEL.door * AT.level, now);
      set(bed.door.pan.pan, AT.pan, now);
    };

    const setMuted = (value) => {
      muted = !!value;
      try {
        localStorage.setItem(STORAGE_KEY, muted ? "off" : "on");
      } catch {
      }
      if (ready) master.gain.setTargetAtTime(muted ? 0 : MASTER, ctx.currentTime, 0.05);
      else if (!muted) activate();
      return muted;
    };

    const dispose = () => {
      disposed = true;
      window.removeEventListener("pointerdown", activate, true);
      window.removeEventListener("keydown", activate, true);
      document.removeEventListener("visibilitychange", onVisibility);
      if (ctx) ctx.close().catch(() => {});
      ctx = master = buffer = null;
      ready = false;
      for (const key of Object.keys(bed)) bed[key] = null;
    };

    return {
      listen, update, setMuted, dispose,
      get muted() { return muted; },
      get ready() { return ready; },
      get state() { return ctx ? ctx.state : "none"; }
    };
  };

  BL.hangarAudio = { create };
})();
