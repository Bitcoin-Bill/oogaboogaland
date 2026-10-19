# Timechain Sphere doorway contract

The frontend side of [issue #235](https://github.com/OogaBoogaX/oogaboogaland/issues/235)'s shared doorway, as `src/js/net.js` and `src/js/timechain-gate.js` implement it. The island room (`worker/src/room.js`, `worker/src/protocol.js`) does not speak it yet: that is the backend work this document hands over. Until the room advertises it, every crossing runs on the traveler's page alone, with no reservation and no spectator animation, and everything else on this page works as written.

## What it is for

The Sphere has one doorway on the island (zone `sphere`) and nine rooms behind it (zones `sphere-1` … `sphere-9`). Signed-in players share it, so its short crossing is serialized and shown: an outside observer sees the doors part and the traveler walk into the dim passage and out of sight behind its curtain, and the doors close again. Only the crossing is serialized, never keypad use or loading: a page asks for the doorway only once its room is prepared (code loaded, picture taken), from the waiting spot square to the doors. The reservation coordinates presentation; the room does not simulate anyone's walk.

Signed-out (solo) visits never send any of this: their crossings are local and invisible to everyone else.

## Capability

`welcome` carries `features: ["door", …]` when the room speaks this contract. The page keeps it as `net.state.doorway`; every send below returns `false` and sends nothing without it, and a socket's close clears it.

`welcome` may also carry `transit` (the shape below) when a crossing is under way as a page joins, so that page opens its doors too.

## Messages

Client → room (each under `MESSAGE_MAX`):

| Message | When |
|---|---|
| `{ t: "door", op: "ask", dir: "in" \| "out", room: 1…9 }` | Prepared and standing at the source-side waiting point: outside on the bridge for `in`, hidden behind the passage's curtain (already in zone `sphere`, with a valid pose there) for `out`. |
| `{ t: "door", op: "go", cycle }` | A `grant` arrived and the page rechecked that it is still ready and still where it asked from; the walk starts now. |
| `{ t: "door", op: "done", cycle }` | The traveler is through: behind the curtain at the scene handoff (`in`), or clear of the threshold on the bridge (`out`). |
| `{ t: "door", op: "cancel" }` | Withdraws a pending ask or gives back a grant not yet used (Cancel, a failed recheck, a stale tab). |
| `{ t: "door", op: "pass", door: "sphere-<id>", dir }` | Announces a walk through a room's own doors (arriving in it, or leaving it), so others in that room see them open. Not reserved. |

Room → client:

| Message | Meaning |
|---|---|
| `{ t: "door", op: "wait", ahead? }` | Busy; the request is queued. The page shows "Door in use · waiting" and keeps Cancel. |
| `{ t: "door", op: "grant", cycle, exp }` | The doorway is this page's until `exp` (room clock, ms) if it sends `go` first. |
| `{ t: "door", op: "denied", reason }` | Refused (for example, a second pending request). |
| `{ t: "transit", cycle, actor, door, dir, at, exp }` | A crossing started (`go`) or a room door was passed (`pass`): `actor` is the player id, `door` is `sphere` or `sphere-<id>`, `at`/`exp` are room-clock ms. Sent to every page in the doorway's zone (`sphere`) or in that room's zone. The traveler's own page ignores it. |
| `{ t: "transit-end", cycle }` | The crossing finished (`done`), was cancelled, expired, or its traveler disconnected. |

`cycle` is an opaque id of 1–64 characters from `[A-Za-z0-9_-]`, issued by the room.

## Rules the room should keep

- One pending request per socket; a second `ask` while one is pending is `denied`. Requests from signed-out or bodiless sockets are ignored.
- Serve requests in order, one crossing of the shared doorway (`door: "sphere"`) at a time, whichever its direction. A grant that is not followed by `go` within a few seconds lapses and the next request is served.
- A started crossing ends at `done`, `cancel`, the traveler's disconnect or zone leaving `sphere` for anything but `none` or `sphere-<id>`, or its `exp` (a bound of about ten seconds); each sends `transit-end`. A request also drops when its socket closes.
- Keep no idle timers for this: expiry can be checked on the next message and by the existing stale sweep, since every page also stops showing a transit at its `exp`.
- `pass` needs no reservation; the room relays it as a `transit` to the named room's zone only.

## What the page does with it (`timechain-gate.js`)

- Enter on the keypad needs a resolved account (`net.state.resolved`). Signed in, the visit is shared; signed out, solo; unresolved, pressing the selected room retries (`net.recheck`), Enter continues solo, Back returns to room choice and the client never guesses.
- Preparation (the room's deferred code and the traveler's picture) is bounded at 15 s and happens before any `ask`. A failure returns to the keypad with the room still chosen.
- With `state.doorway`, a shared crossing asks and waits; without it (or with no live socket for 6 s), it crosses locally. A lost socket while waiting falls back to the keypad; a grant that expires before the walk starts (a tab that slept) is not resumed.
- The plug across the doorway (`timechain-models.js`) is lifted only for this page's own guided walk, so nobody tailgates through doors another player opened.
- On the way out the hub enters with the Ooga hidden behind the curtain in zone `sphere`, waits a beat, asks for `out` when shared, then walks onto the bridge and sends `done` once the doors can close.

## Zones, presence and voice

Unchanged room behaviour is enough for the rooms themselves: `sphere-1` … `sphere-9` match `ZONE_NAME`, have no dot, and so are nine separate voice groups, apart from each other and from `sphere`. The page publishes `none` across a scene handoff, its room's zone once its Ooga stands in it (with a pose there), and filters remote players by exact zone. A solo visit publishes `none` with no body for its whole length. Backend regression coverage still owed: nine-way voice isolation, stale pulls from a room left behind, and a reconnect restoring the active room.
