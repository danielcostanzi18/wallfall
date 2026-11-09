# Wallfall

A falling-blocks puzzle game made to be projected on a wall and played with your whole body.
A webcam watches the players and turns big gestures into moves. Up to two people play side by side.

## Run

```
./start.sh                # starts the server and opens the game in its own Chrome window
```

The launcher's Chrome window may play sound straight away (normally browsers wait for a click or
key press, which never happens when you only use gestures). It uses its own Chrome profile, so your
normal browser isn't affected; the camera permission is asked once and remembered.

Without the launcher: `python3 serve.py`, open http://localhost:8000 in Chrome, and press any key
once for sound. Use `localhost`, not `0.0.0.0` or an IP address, or the browser blocks the camera.
`serve.py` prints the game's log in the terminal. The body-tracking model (MediaPipe Pose) loads
from a CDN, so you need internet on first load.

## Gestures

**Home**: both hands up in front of you, level, centred on your body. From home do **one** gesture;
it does exactly one thing, and nothing else counts until your hands are back in the home area
(you're ready again the moment they are).

| Gesture (from home) | Action |
|---|---|
| Both hands sideways | Move one column |
| Left hand higher (lift it, or drop the right) | Rotate 90° clockwise |
| Right hand higher (lift it, or drop the left) | Rotate 90° counter-clockwise |
| Squat | Drop faster (nothing else counts while squatting) |
| Both hands above your head (hold) | Start / resume |

The blocks fall faster and faster the longer you play (pauses don't count): after about
4 minutes they fall almost as fast as a squat drop. Tune `startGravity`, `endGravity` and `rampMs` in `C`.

The controls are a small state machine per player: `NO_HANDS → RETURN → READY → one action → RETURN`,
with `SQUAT` from any state. Two kinds of hysteresis keep it to one action per gesture:
- **Area**: the home area is smaller than the action thresholds; the band in between does nothing.
- **Movement**: right after an action, the *opposite* action needs a bit more travel until your hands
  come to rest at home, so the swing back (and its overshoot) never undoes the move.

The bar at the top of each board shows your hands (dashed box = home): grey "back to home",
your colour = READY, green = action, yellow = squatting. Press **B** to see the state and gesture
numbers; every action is printed in the terminal.

The game switches between 1 and 2 players by itself, from how many people the camera sees
(press 0 for auto, 1 or 2 to lock it). In 2-player mode, whoever stands on the left plays the left board. Both players get the same
sequence of blocks.

## Calibration (testing)

`./start.sh 8000 calibrate.html` (or http://localhost:8000/calibrate.html) opens the calibration page:

1. Type a player name and press **Record session**. Follow the big prompts (~2 min): hold HOME, then
   5 × each gesture (move left/right, rotate ↻/↺, squat), returning home after each.
2. The page measures your movements and fits **personal thresholds**, then replays your recording
   with the default and your thresholds and shows hits / misses / wrong / extra for each gesture.
3. **Live test** shows every detected action as you move, with default or your thresholds.

Recordings go to `recordings/<name>/` (raw pose data, for analysis) and thresholds to
`profiles/<name>.json`; both are git-ignored. The game itself doesn't use the profiles yet.
The gesture logic shared by the page lives in `gesture-core.js` (same rules as the game),
fitting/scoring in `calibration.js`.

## Music

Wallfall's own 8-bit arrangement of *Korobeiniki* (19th-century Russian folk song, public domain):
the folk tune's main theme over an original bass line, plus an original bridge. It's synthesised live
in the browser, plays while someone is playing and speeds up with the fall speed. Browsers only allow sound
after a click or key press, so press any key once (F for fullscreen works). N turns the music on/off;
+ and − change its volume.

A rendered copy (two loops) is in [`music/wallfall-korobeiniki-8bit.mp3`](music/wallfall-korobeiniki-8bit.mp3).

## Keys

P1: A/D move, W/Q rotate, S drop. P2: ←/→ move, ↑ rotate, ↓ drop.
Enter start · P pause · 0/1/2 players · F fullscreen · M swap sides (camera behind players) · N music on/off · +/− music volume · B gesture debug.

## Setup tips

- Put the laptop below the projected image with the camera facing the players.
- Players should be visible from head to hips, ideally to the knees.
- Gesture thresholds are in the `C` object at the top of the script in `index.html`.

## Starguard (second game)

`starguard.html`: an original co-op space shooter for 1–2 players, using the same camera setup.
Run `./start.sh 8000 starguard.html` (or `python3 serve.py` and open http://localhost:8000/starguard.html).

| Body | Action |
|---|---|
| Step / lean left–right | Fly (your position in the room is the ship's position) |
| Arms out wide (T-pose) | Spread shot while held (uses the yellow energy bar) |
| Squat | Shield, up to 2.5 s (no shooting meanwhile) |
| Both hands above your head, hold | NOVA bomb (clears the screen) / start / join / resume |

The ship fires by itself. It gets faster and busier over 4 minutes, and a Warden boss arrives every 80 s.
A second person can join mid-game by holding both hands up. Tuning is in the `C` object at the top.
Keys: P1 A/D fly · W spread · S shield · E nova — P2 ←/→ · ↑ · ↓ · / — Enter start · P pause · V camera · M mirror · B gesture debug.
