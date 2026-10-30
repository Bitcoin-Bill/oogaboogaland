"""
sad_womp.py — generates the "sad womp" (wah-wah-wah) sound effect from scratch.

Origin: written by Claude (an AI model by Anthropic) for a Tee Sniper promo reel,
Oct 2026. No recordings, samples or sound libraries are used: every sample is
computed below from sine waves. The idea (a falling "sad trombone" cue) is a
common comedy gag; this code and the sound it produces are original.

Needs: Python 3 and numpy (pip install numpy).
Run:   python3 sad_womp.py            -> writes sad-womp.wav
       python3 sad_womp.py out.wav    -> writes out.wav
Optional MP3 preview: ffmpeg -i sad-womp.wav -b:a 192k sad-womp.mp3

How it works:
  - three falling notes (about B-flat3, A3, then a longer A-flat3);
  - each note = a sine wave plus 2nd and 3rd harmonics (the brassy "buzz");
  - each note's pitch droops 6% over its length (the "sad" bend);
  - volume rises in 20 ms, then decays exponentially; 80 ms fade at the end.
Output: 44.1 kHz, 16-bit, stereo (same signal both sides), 1.94 s.
"""
import sys
import wave

import numpy as np

SR = 44100  # sample rate (Hz)

# (start time s, pitch Hz, length s)
NOTES = [(0.10, 233.0, 0.35),   # ~B-flat3
         (0.47, 220.0, 0.35),   # A3
         (0.84, 208.0, 0.60)]   # ~A-flat3, held longer
TOTAL = 1.94                   # seconds
PEAK = 0.89                    # final peak level (0..1)


def womp(f0, dur, vel=0.14):
    """One drooping, brassy note."""
    n = int(dur * SR)
    x = np.arange(n) / SR
    f = f0 * (1 - 0.06 * x / dur)                 # pitch slides down 6%
    phase = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(phase) + 0.4 * np.sin(2 * phase) + 0.2 * np.sin(3 * phase)
    envelope = np.minimum(1, x / 0.02) * np.exp(-x * 1.5)
    return vel * tone * envelope


def render():
    n = int(TOTAL * SR)
    out = np.zeros(n)
    for start, f0, dur in NOTES:
        s = womp(f0, dur)
        i = int(start * SR)
        out[i:i + len(s)] += s
    fade = int(0.08 * SR)
    out[-fade:] *= np.linspace(1, 0, fade)        # soft ending
    return out / np.max(np.abs(out)) * PEAK


def write_wav(path, mono):
    stereo = np.stack([mono, mono], 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((stereo * 32767).astype("<i2").tobytes())


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "sad-womp.wav"
    write_wav(path, render())
    print("wrote", path)
