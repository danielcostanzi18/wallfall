# Wallfall

A falling-blocks puzzle game made to be projected on a wall and played with your whole body.
A webcam watches the players and turns big gestures into moves. Up to two people play side by side.

## Run

```
python3 serve.py          # then open http://localhost:8000 in Chrome
```

Use `localhost`, not `0.0.0.0` or an IP address, or the browser blocks the camera.
`serve.py` also prints the game's log in the terminal. The body-tracking model
(MediaPipe Pose) loads from a CDN, so you need internet on first load.

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

## Keys

P1: A/D move, W/Q rotate, S drop. P2: ←/→ move, ↑ rotate, ↓ drop.
Enter start · P pause · 0/1/2 players · F fullscreen · M swap sides (camera behind players) · B gesture debug.

## Setup tips

- Put the laptop below the projected image with the camera facing the players.
- Players should be visible from head to hips, ideally to the knees.
- Gesture thresholds are in the `C` object at the top of the script in `index.html`.
