# Cursor and view controls audit

Status: current-behavior audit in progress; no control changes agreed or implemented.

Baseline: `origin/rock` at `4113d59b69cbcd0f85207902ce4e36bbec8dfca4`, fetched on 2026-10-18. Work proceeds on `codex/controls-audit` in a separate worktree; existing uncommitted work in the original checkout is outside this PR.

## Purpose and sequence

1. Record the current flows and their source evidence.
2. Identify differences that a player can encounter.
3. Agree the intended flows one scenario at a time.
4. Implement those decisions in small commits on this draft PR.
5. Verify with the repository's requested testing level and the maintainer's play-test.

This document is the review log for the work. Proposed behavior must remain explicitly proposed until agreed. Runtime observations must be distinguished from source inspection.

## Scenario inventory

| Dimension | Cases to compare |
|---|---|
| Controlled subject | Ooga; hub companion gorilla; detached camera; legacy scene Agent where available |
| View | Carry; combat shoulder; first person; orbit/bird's-eye; detached free/orbit views |
| Account | No backend; Worker signed out; signed-in contributor; signed-in noncontributor; ownership/room changes |
| Pointer | Native cursor; locked virtual cursor; focused mouse look; pointer-lock denied or lost |
| Input | Mouse and keyboard; touch sticks and buttons; text fields; dialogs and side panel |
| Transitions | Select/retake actor; switch actor; change view; detach; reset; navigate; enter/leave scene; blur/resume |

## Implementation map

| Source | Responsibility |
|---|---|
| `src/js/interact.js` | Picking, pointer gestures, tap/double-tap, drag, wheel and pinch |
| `src/js/controls.js` | Held keyboard state, touch sticks, Space/action priority, two-button walking |
| `src/js/cursor.js` | Virtual cursor, pointer-lock event routing, native form-control handoff |
| `src/js/pilot.js` | Ooga and detached camera/view state, pointer focus, cursor integration |
| `src/js/clanker-play.js` | Hub companion possession, gorilla keyboard and pointer behavior |
| `src/js/agent.js` | Dedicated scene Agent controller |
| `src/js/net.js` | Account and Ooga ownership permission |
| `src/js/scene-hub.js` and interior scene modules | Controller handoffs, selection, defaults, scene-specific navigation |
| `src/js/hud.js`, `src/js/director.js`, `src/index.html` | Buttons, help, modal handling and top-level shortcut routing |
| `README.md`, `docs/auth-and-presence.md` | Published player controls and ownership rules |
| `test/run.mjs` | Existing control, ownership and view coverage to inspect before extending |

## Evidence and validation

The first pass is a source audit. No browser scenario, simulation, screenshot or automated test is implied by this log. The repository's default testing level is **wait**: build after the documentation update; syntax-check any changed JavaScript if implementation begins. Fast/full runtime verification requires a testing request.

## Review checkpoints

- Baseline and audit scope recorded. Current-behavior tables and findings are being traced against this exact baseline.
- Intended behavior: pending discussion.
- Implementation: pending agreement.
