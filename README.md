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

Hold your hands out in front of you, as if holding the block:

| Gesture | Action |
|---|---|
| Shift both hands left / right | Move (hold to keep sliding) |
| Tilt: one hand up, the other down | Rotate (right hand up = counter-clockwise) |
| Squat | Drop faster |
| Both hands above your head (hold) | Start / resume |

In 2-player mode, whoever stands on the left plays the left board.

## Keys

P1: A/D move, W/Q rotate, S drop. P2: ←/→ move, ↑ rotate, ↓ drop.
Enter start · P pause · 1/2 players · F fullscreen · M swap sides (camera behind players) · B gesture debug.

## Setup tips

- Put the laptop below the projected image with the camera facing the players.
- Players should be visible from head to hips, ideally to the knees.
- Gesture thresholds are in the `C` object at the top of the script in `index.html`.
