# Cursor and view controls audit

Status: initial source audit complete; first cursor decision agreed and implemented. Other flows await agreement.

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

## How to read the current behavior

There are four separate pieces of state: **who is controlled**, **camera view**, **carry/combat intent**, and **pointer focus/capture**. Shoulder view can be carry or combat. Combat can remain selected with a native cursor after capture is released. Account status chooses who can be controlled and the arrival path; the shared cursor and gesture modules do not branch on authentication.

The main cursor discrepancy is direct: **Ooga carry releases pointer lock and uses the native cursor; focused gorilla carry keeps pointer lock and uses a visible virtual cursor.** Despite its name, the pilot's `carryCursor` currently starts only for combat bird's-eye, as a hidden constrained pointer. Its centered-carry camera transition does not activate a virtual cursor. Evidence: [pilot `armed`/`aimView`](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L239), [pilot `syncAim`](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L407), [gorilla `syncCursor`](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/clanker-play.js#L61).

The current-behavior tables below preserve the upstream baseline, before this PR's changes. They are not a claim of browser reproduction. Source links are pinned to that baseline; the agreed change is recorded separately below.

## Current subject and pointer flows

| Scenario | Current behavior | Evidence |
|---|---|---|
| Detached aerial camera | Native cursor. WASD/arrows translate; Q/E turn; R/F pitch; Z/Space rise; X descends. Drag orbits; wheel/pinch zooms. Speed depends on distance. | [controls](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/controls.js#L5), [pilot input](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L2084) |
| Detached eye-level camera | Zooming to the minimum enters a ground-following close view. Movement follows ground/falling rules; vertical flight input no longer translates the camera. `pilot.mode` still reports `detached`. | [close entry](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L1415), [movement](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L2117) |
| Ooga carry | Native cursor, drag to look/orbit, no combat reticle. First-person, shoulder and orbit are available. Two mouse buttons together walk forward when the shared shooter state is false. | [cursor release](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L407), [orbit hooks](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L1908), [chord](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/controls.js#L138) |
| Ooga combat shoulder/first-person | Reticle; focused/locked mouse motion looks. After focus is released, the first ordinary canvas click captures input without attacking. Later left press attacks; right hold focuses aim. | [mouse look](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L1070), [attack entry](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L1164) |
| Ooga combat bird's-eye | Hidden constrained virtual pointer. Vertical motion moves aim along the upper centerline; horizontal motion rotates. Q/E rotate; N restores north. | [cursor](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L420), [north](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L1206), [overhead input](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L2137) |
| Focused gorilla carry | Visible virtual arrow under pointer lock, routed to real HUD/world targets. Drag looks/orbits; shared move/look axes operate. This differs from Ooga carry. | [cursor](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/clanker-play.js#L61), [movement](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/clanker-play.js#L588) |
| Gorilla combat shoulder/first-person | Reticle and focused mouse look. First ordinary unfocused canvas click focuses without starting a smash. Later left hold charges smash; release attacks. Holding G changes the interaction to grab/throw. | [focus](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/clanker-play.js#L206), [pointer handling](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/clanker-play.js#L403) |
| Gorilla combat bird's-eye | Fixed center reticle; horizontal mouse movement rotates, vertical movement is ignored. It does not reproduce Ooga vertical reach aiming. | [center ray](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/clanker-play.js#L87), [look](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/clanker-play.js#L444) |
| Sleeping Ooga | Possession stays out of combat. Space wakes; close view can look from the sleeping pose. Mode toggle asks the visitor to wake/stand first. | [toggle](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L1730), [possession](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L1774) |
| Touch | Shared movement/look sticks and drag/pinch. Ooga capture explicitly skips coarse devices. Gorilla capture lacks that guard; canvas combat interception excludes touch and attacks use the smash button. The resulting phone/hybrid cursor presentation needs play-testing. | [Ooga capture](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L360), [gorilla capture](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/clanker-play.js#L206), [touch exclusion](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/clanker-play.js#L421) |

## Selection, view changes and release

| Action | Ooga | Hub gorilla |
|---|---|---|
| Single click/tap through world picking | Pokes/reacts; does not possess. | Shows its tooltip as a toast. |
| Double-click/tap another actor | Permission check, then possession. Restores that Ooga's carry/combat preference, initially combat. Successful combat selection explicitly requests focus/lock. | Any active visible companion can be possessed. Always resets to combat shoulder and requests focus/lock. |
| Select from high detached view | At least 21 m above the head preserves altitude and enters combat bird's-eye or carry orbit. | Enters shoulder regardless of height. |
| Double-click the same actor | Releases it, when the gesture reaches world picking. | Releases it, when the gesture reaches world picking. |
| Automatic/URL selection | `possess()` alone does not request pointer capture. Signed-in own-Ooga claim uses this path. | Debug URL selection starts combat shoulder but waits for a canvas click to focus. |
| X / selected portrait tap | Toggles carry/combat where the scene forwards the action. Remembered per Ooga for the page session, including across scene visits. | Toggles carry/combat; the next possession resets that preference. |
| Portrait hold | After 650 ms, dispatches detach, where the scene forwards it. | After 650 ms, releases the gorilla. |
| Scroll/pinch | First-person ↔ shoulder ↔ carry orbit/combat bird's-eye. Stops at mode boundaries per gesture. | Same broad sequence, but inward carry-orbit transition forces combat shoulder. |
| Right-click from overhead/orbit | Returns to previous close view, normally shoulder; a first-person exit can return to first-person. Preserves carry/combat intent. | Always returns to combat shoulder. |
| Quick double-right-click in close view | Goes out to carry orbit/combat bird's-eye. | Goes out to carry orbit/combat bird's-eye. |
| Right Shift | In combat shoulder: tap swaps shoulders; hold with A/D peeks. | In combat shoulder: tap swaps shoulders; hold with A/D peeks. |
| Hub map/destination | Keeps and relocates the Ooga, retaining its mode. | Releases the gorilla, then navigates detached. |
| Detach | Preserves the displayed camera eye/heading into free view. | Clears capture/action state and rebases detached pilot from displayed view. |
| Tab | Combat intercepts Tab to release capture/focus. Carry/detached use normal focus traversal. | Intercepts Tab while possessing, even after already unfocused; does not toggle back into capture. |
| Escape | Locked combat first releases capture; afterward the scene decides whether to detach or leave. With soft focus but no lock, Escape can reach the scene immediately. | Focused/locked first releases capture/focus; another Escape releases possession. |

Evidence: [Ooga possession](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L1763), [Ooga release](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L1821), [double-tap](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L2003), [Ooga right-click](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L1122), [Ooga wheel](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L1936), [Ooga Tab/Escape](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L1195), [gorilla possession](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/clanker-play.js#L269), [gorilla keys](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/clanker-play.js#L333), [gorilla right-click](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/clanker-play.js#L390), [gorilla wheel](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/clanker-play.js#L456), [portrait gestures](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/hud.js#L1641), [map handoff](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/scene-hub.js#L7240), [Ooga navigation](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L2753).

Space is intentionally context-sensitive today: Oogas jump/use nearby controls, while gorillas jump/double-jump, dismount a climb or drop-and-roll when burning. Gorillas do not have the Ooga's general nearby-use action. Weapons, grabs and actor abilities should be considered separately from camera consistency.

## Account scenarios

| Account situation | Ooga selection and arrival | Gorilla / detached behavior |
|---|---|---|
| No backend, static host or `net=0` | All Oogas permitted by `mayDrive`; hub ordinarily starts detached unless a fixture/return applies. | No shared room identity. Gorilla controls use the same local controller. |
| Worker signed out | New claims of working Oogas refused; resting/sleeping can be borrowed locally. No room socket, so online owner/driver information is unavailable. | No authentication gate for companion possession. |
| Signed-in contributor | Own Ooga only. Hub claims it once per visit; explicit detachment stays detached until retake or next visit. Automatic claim does not request mouse capture. | Any active visible companion remains locally selectable; map/retake can release it. |
| Signed-in account with server-added temporary Ooga | A server-vouched Oogatron contributor not yet bundled can receive an own Ooga before scene construction; then own-Ooga rules apply. It requires sign-in to control. This is not universal guest creation. | Same companion controls. |
| Signed-in account with no registered/temporary Ooga | Can borrow nonworking Oogas subject to the room's owner-present/taken information. | Same companion controls. |
| Owner arrival/server rejection while borrowing | Hub releases disallowed Ooga and shows the reason. | No equivalent companion ownership check. |
| Sign-out while driving | Clears room/remotes and voice. Existing bundled Ooga is rechecked with `working=false`, so a working Ooga can remain locally driven although a fresh claim would fail; temporary own Ooga is refused. | No analogous sign-out release for a controlled gorilla. |

Evidence: [account lookup](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/net.js#L275), [temporary registration](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/contributors.js#L31), [room connection gate](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/net.js#L263), [permissions](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/net.js#L467), [hub account changes/claim](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/scene-hub.js#L8285), [gorilla possession](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/clanker-play.js#L269).

Two boundaries matter for the intended design:

- The README says signed-out borrowers cannot take an online owner's Ooga, but signed-out pages do not receive the room's ownership information. This is a documentation/enforcement mismatch, not a different low-level cursor implementation.
- Only `crew.player` is reported as the network body. Normal gorilla possession releases that Ooga, leaving the network body null, like detached mode. Gorilla movement is not published as the visitor's room avatar, and room voice requires a body. Equal cursor controls would not by themselves provide multiplayer gorilla identity. Evidence: [shared body](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/scene-hub.js#L8371), [remote visibility](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/scene-hub.js#L8384), [voice eligibility](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/worker/src/protocol.js#L220).

Initial account lookup is awaited before the first scene builds ([director](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/director.js#L623)); the audit does not claim a normal startup race between delayed account lookup and gorilla selection.

## Scene exceptions

These Escape outcomes apply after any modal and pointer-capture handling above them.

| Scene | Escape | Mode-control wiring |
|---|---|---|
| Hub | Detach Ooga; detached stays on island. | X and portrait actions supported; map navigation has actor-specific handoff. |
| Debug lab | Detach, then another Escape leaves. | X and portrait actions supported. |
| Factory | Close guide menu if present; otherwise leave. Kiosk has its own flow. | X and portrait actions supported. |
| Arcade | Close prizes if present; otherwise leave. | Explicitly forces empty-handed carry and hides mode HUD. |
| Bifrost | Leave chamber. | Portrait appears through shared HUD, but only `mode-retake` is forwarded. Tap toggle/hold detach have no handler; X absent. |
| DSB | Detached overview when not inside/transitioning. | Portrait `mode-*` forwarded; X absent. |
| Poker | Leave focused table UI, then stand if seated, otherwise leave floor. | Portrait `mode-*` forwarded; X absent. |

Evidence: [hub](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/scene-hub.js#L10328), [lab](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/scene-lab.js#L337), [Factory](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/scene-factory.js#L1015), [Arcade](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/scene-arcade.js#L855), [Arcade forced carry](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/scene-arcade.js#L1733), [Bifrost Escape](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/scene-bifrost.js#L239), [Bifrost HUD](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/scene-bifrost.js#L536), [DSB](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/scene-dsb.js#L477), [poker](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/scene-poker.js#L312).

The legacy scene Agent is a third controller, not the hub companion. It has camera-relative movement, Q/E turn, C chest beat, H stance and one Escape to release, but no companion carry/combat/overhead/capture flow. Right Shift+A summons/releases it where offered; the hub explicitly excludes it. Evidence: [Agent controller](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/agent.js#L2132), [director](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/director.js#L449). Arcade games' own controls are separate from this walking-camera audit.

## Pointer gestures, UI and interruption

- World gestures: movement beyond 7 px becomes drag; a pending release within 420 ms is a tap; the second tap within 380 ms and 24 px on the same actor/target is double-tap. The first tap already fires. Touch grab waits 320 ms; a second finger cancels grab for pinch. Wheel and pinch share zoom hooks. Evidence: [interact](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/interact.js#L194).
- Virtual cursor: routes pointer presses, primary clicks, hover and wheel to real DOM/world targets. Direct fields and modal dialogs release capture for native interaction. Failed/pending lock consumes canvas presses to retry, while native HUD presses stop virtual mode; right-click can still change view. Evidence: [cursor routing](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/cursor.js#L162), [fallback](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/cursor.js#L218).
- Sheet focus differs by actor. Ooga/shared/director guards exclude all of `#sheet`; gorilla/legacy Agent guards exclude fields/dialogs but not the sheet. Gorilla capture-phase Space/Tab/Escape can consume focused sheet-button keys. Legacy Agent additionally captures arrows/WASD. Evidence: [shared guard](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/controls.js#L65), [pilot guard](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L1196), [gorilla guard](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/clanker-play.js#L149), [gorilla keys](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/clanker-play.js#L333), [Agent keys](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/agent.js#L2143).
- Field guards also disagree on `select`/`contenteditable`. Existing sheet selects are protected by their ancestor for Oogas; the mismatch is a policy gap, not evidence every field currently misbehaves.
- Native double-click resets sheet height. The virtual cursor synthesizes `click` with detail 1 and does not retarget `dblclick`, so focused gorilla carry cannot use the same reset gesture on that handle. Evidence: [synthetic click](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/cursor.js#L47), [compatibility suppression](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/cursor.js#L258), [sheet reset](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/hud.js#L1929).
- Chat-tab selection focuses its input on desktop, but virtual cursor post-click unlock checks only for a modal. Indirect focus from gorilla carry needs a play-test for cursor/focus behavior. Evidence: [Chat focus](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/chat.js#L235), [post-click](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/cursor.js#L198).
- Generic feed/recipe/board dialogs do not themselves reset every held movement key; some specialized interfaces explicitly suspend the pilot. The consequence of opening one while holding movement remains to be measured. New key presses in dialogs are filtered, and key-up still clears held state. Evidence: [controls](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/controls.js#L65), [feed](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/hud.js#L970), [board](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/hud.js#L1383), [recipe](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/hud.js#L1555).
- Window blur clears shared held keys/chords and releases controller focus. Pointer-lock loss clears attacks/virtual presses. Gorilla catches synchronous lock errors; Ooga only handles promise rejection/lock-error events. No failure-path browser observation has been made. Evidence: [controls blur](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/controls.js#L89), [pilot capture](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L360), [pilot lock loss](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L1246), [gorilla capture](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/clanker-play.js#L206).

## Findings to resolve

| ID | Finding | Evidence status | Decision |
|---|---|---|---|
| C01 | Native cursor in Ooga carry versus locked virtual cursor in gorilla carry. | Source-confirmed | Native cursor agreed and implemented below |
| C02 | Capture/Tab/Escape behavior varies with actor, capture success and entry path. | Source-confirmed | Pending |
| C03 | Gorilla right-click and inward zoom can change carry to combat; Ooga preserves intent. | Source-confirmed | Pending |
| C04 | Ooga remembers mode/preserves high selection; gorilla resets combat shoulder. | Source-confirmed | Pending |
| C05 | Ooga bird's-eye has vertical aim; gorilla has fixed center aim. | Source-confirmed | Pending |
| C06 | Hub map keeps Ooga but releases gorilla; generic presets also detach Oogas. | Source-confirmed | Pending |
| C07 | Sheet keyboard handling and field exclusions differ by actor. | Source-confirmed dispatch paths | Pending |
| C08 | Bifrost mode buttons lack handlers; X/HUD and Escape differ across walking scenes. | Source-confirmed wiring | Pending |
| C09 | Virtual/native HUD gestures differ; Chat indirect focus and coarse-device gorilla capture need review. | Missing dblclick route confirmed; visual consequences untested | Pending |
| C10 | Signed-out ownership wording exceeds available presence data; gorilla has no shared room body. | Source-confirmed boundary | Pending scope decision |
| C11 | Close-view look may apply twice: carry Q/E and R/F, and look-stick yaw/pitch in carry or combat, except lying. Combat keyboard Q/E applies once. | Suspected sensitivity defect, unmeasured: [first application](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L2059), [tail](https://github.com/OogaBoogaX/oogaboogaland/blob/4113d59b69cbcd0f85207902ce4e36bbec8dfca4/src/js/pilot.js#L2150) | Measure if runtime checks requested |
| C12 | Forced Arcade carry can become the Ooga's remembered mode on return. | Source-confirmed state path; intent undecided | Pending |

Help also lags behavior: README omits Tab, capture-only first click, detached eye-level, portrait hold and double-right-click. “Escape lets go” misses capture/scene layers. Some weapon hints say scroll out for navigation although combat zoom stays in combat overhead. AGENTS asks shared scenes to route 0 to pilot, but several walking scenes have no 0 handler. Update help after agreeing behavior, not before.

## Proposed agreement order

Only the native/captured cursor choice in scenario 1 is agreed so far. The other recommendations and the separate UI-focus policy remain proposals.

| Order | Scenario | Proposed rule | Open choice |
|---|---|---|---|
| 1 | Cursor while exploring/carrying | Detached and both actors in carry use a native cursor; drag looks, wheel zooms. Combat can capture the mouse after a deliberate gesture. | Native cursor choice agreed. Uniform keyboard UI-focus exclusions remain C07. |
| 2 | Freeing/resuming the cursor | Tab frees capture without changing actor/view/combat. Once free, Tab can navigate UI. A canvas click resumes capture without attacking. Escape closes the top UI, then frees capture, then detaches; a separate final Escape may leave a cave. | Confirm Escape order and whether detached Escape should leave interiors. |
| 3 | Selecting/retaking an actor | Same manual selection flow for Ooga/gorilla. Automatic arrivals keep native cursor until a gesture. Preserve carry/combat preference; selection and zoom should not silently change combat intent. | Initial default: carry or combat? Memory per actor or per visitor? Preserve altitude on high selection? |
| 4 | Camera modes | Same wheel boundaries and right-click returns for both actors. Keep camera distance changes separate from combat intent. | Retain double-right-click? Same overhead aim model for both? |
| 5 | Map, reset and scene transitions | Define actor retention explicitly and apply it consistently. Keep selected mode unless a scene has a clearly communicated limitation. | Map transports controlled actor, or always detaches? How should Arcade's carry restriction restore prior preference? |
| 6 | Accounts and exceptional controllers | Authentication changes eligibility/presence, with the same controls for permitted actors. Document legacy Agent and game exceptions. | Is gorilla multiplayer identity in scope, or a separate follow-up? |

Touch should provide equivalent actions using sticks/buttons and native touch UI, without requiring mouse capture. Sleeping, climbing, kiosk/table interactions and actor-specific abilities remain explicit cases to discuss.

## Agreed change: native cursor in carry

On 2026-10-18 the maintainer chose **native cursor in detached/carry** for Oogas and gorillas, with drag-to-look and wheel-to-zoom, and captured mouse look in combat.

- Gorilla combat-to-carry now releases capture and focus. It no longer constructs a virtual cursor or keeps its pointer-position/resize bookkeeping.
- Native left-drag and wheel retain the existing interaction hooks. Tab in carry reaches native keyboard navigation, as it does for Oogas; combat Tab behavior is unchanged pending scenario 2.
- Returning to combat requests capture. The existing carry-orbit zoom boundary still changes to combat shoulder and explicitly requests focus now that carry no longer supplies it. Whether that boundary should change combat intent is still C03, not silently decided here.
- Grab/throw retains its existing reticle and button handling in carry without acquiring pointer lock. Other abilities, ownership, map behavior, view defaults and scene Escape policies are unchanged.
- The existing `gorilla camera modes` check now requires native cursor state, no focus/lock and unconsumed Tab in its carry shoulder/first-person/orbit samples. This regression coverage is authored, not run under the current **wait** policy.

Found for play-test: toggle combat/carry in all three camera distances; drag, wheel, native HUD clicks and Tab in carry; capture-only canvas click and left attack after freeing combat focus; carry G/grab/throw; pending/denied capture; signed-in/out and touch behavior. The remaining C07 sheet-key interception is still open.

## Validation and play-test queue

Testing level remains **wait**. No scenes, browser sessions, probes, screenshots, simulations or automated tests were run. The initial audit build passed. Final build and syntax-check results for the agreed implementation are recorded at the review checkpoint.

Existing checks to extend if implementation and runtime testing are requested: `hubBirdsEye` (selection, view gestures and cursor handoffs), `hubWalking`/`labWalking` (movement), `hubChat` (focus), and relevant scene walking/exit checks in `test/run.mjs`. Their presence is not evidence they passed on this branch. Keep the existing value/STOP rules; do not add parallel duplicate checks.

For the maintainer's play-test, exercise each agreed flow with:

1. No backend, Worker signed out, signed-in own Ooga (bundled/temporary), and a borrowing account where available. Use manual and automatic arrival separately; `nosim` disables accounts and cannot validate the signed-in rows.
2. Ooga/gorilla/detached; carry/combat; shoulder/first-person/orbit/overhead; native cursor, successful lock, denied/lost lock, and blur/resume.
3. World selection, portrait tap/hold, X, wheel/pinch, right-click/double-right-click, Tab/Escape, map/reset, and each walking scene boundary.
4. Keyboard-focused sheet buttons, Chat, native form controls and modal dialogs; mouse and coarse/touch devices; clean console throughout.

## Review checkpoints

- `8d5346f`: baseline and audit scope, draft PR opened against `rock`.
- `28fb6b8`: current flows, source references, inconsistencies, proposals and play-test queue recorded. `npm run build` passed; no runtime tests requested or run.
- Native carry cursor decision: approved; implementation and existing regression coverage updated. `npm run build`, `node --check src/js/clanker-play.js`, `node --check test/run.mjs` and `git diff --check` passed. Runtime verification remains pending under **wait**.
- Remaining decisions: scenarios 2–6 and UI-focus policy pending.
