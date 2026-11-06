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

**Home**: both hands up in front of you, level, centred on your body.
From home, do **one** gesture; it does exactly one thing, then nothing else counts until you're back home.

| Gesture (from home) | Action |
|---|---|
| Both hands sideways | Move one column |
| Lift your left hand | Rotate 90° clockwise |
| Lift your right hand | Rotate 90° counter-clockwise |
| Squat | Drop faster (nothing else counts while squatting) |
| Both hands above your head (hold) | Start / resume |

If a gesture is a bit of both (sideways and lifted), whichever is clearer wins: it's always a move
*or* a rotation, never both. A small bar at the top of each board shows your hands: dashed box =
home, ticks = how far to swing. It's grey with "back to home" until you return home.
Press **C** for "carry" controls instead, where the block follows your hands across your half of
the camera view (rotation works the same).

The game switches between 1 and 2 players by itself, from how many people the camera sees
(press 0 for auto, 1 or 2 to lock it). In 2-player mode, whoever stands on the left plays the left board. Both players get the same
sequence of blocks.

## Keys

P1: A/D move, W/Q rotate, S drop. P2: ←/→ move, ↑ rotate, ↓ drop.
Enter start · P pause · 0/1/2 players · C step/carry controls · F fullscreen · M swap sides (camera behind players) · B gesture debug.

## Setup tips

- Put the laptop below the projected image with the camera facing the players.
- Players should be visible from head to hips, ideally to the knees.
- Gesture thresholds are in the `C` object at the top of the script in `index.html`.
