# Sad womp — proposed gameplay sound

An optional falling, brassy comedy cue offered for maintainer consideration. This directory does not change gameplay, add a runtime dependency or load audio on the live page. Maintainers can choose an appropriate event and adapt the generator to the existing pooled Web Audio voices.

## Origin

The submitter reports that Claude (Anthropic) wrote this generator for a Tee Sniper promo reel in October 2026. No recordings, samples or sound libraries were used. The three notes are synthesized from sine waves with second and third harmonics, a 6% downward pitch bend and an attack/decay envelope. Source and preview are offered as an original AI-assisted contribution under the repository's Ooga Booga License. This statement records the submitter's account, not an independent authorship investigation.

## Files and regeneration

- `sad_womp.py`: unmodified supplied source. Python 3 and NumPy are only needed for this offline reference generator, not for the game.
- `sad-womp.mp3`: supplied 192 kb/s preview (48,318 bytes). It is not automatically staged or loaded by the game.

```sh
python3 sad_womp.py
ffmpeg -i sad-womp.wav -b:a 192k sad-womp.mp3
```

The WAV is 44,100 Hz, 16-bit stereo, 85,554 frames (1.94 seconds). MP3 container duration includes encoder padding. MP3 bytes can vary by encoder version; the generated WAV hash is the reference.

## Verification

The Python source was inspected and run. Its WAV SHA-256 matches the supplied reference. Decoding the supplied MP3 and comparing it with the WAV gives a correlation of 0.999999, rounded to six decimals. No browser playback or game integration is claimed.

The script's last 80 ms fade acts on an already-silent tail. Notes end abruptly; a runtime adaptation should consider short release ramps to avoid clicks. The submitted source and preview have been preserved unchanged.

SHA-256:

- Script: `951f4c2b7eeb5758fa47616bd794ab6fe189673550f2535a972b16c5364f0fc4`
- Generated WAV: `0b7272b26637f06d972be5e5576b17c77524e0350de7ad6764712c9628002e2a`
- Supplied MP3: `078a858156ac3f2ec23872a8b5ae49d05a40793a260f3ca43916b8da8e6e4c69`

Developed with AI assistance (Claude Code).
