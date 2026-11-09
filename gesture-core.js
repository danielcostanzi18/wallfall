// Wallfall gesture logic: pose features + the per-player gesture state machine.
// Same rules as the game (index.html): HOME -> one gesture -> one action -> back HOME.
// Used by calibrate.html for live testing and for replaying recordings.

export const DEFAULTS = Object.freeze({
  homeShift: 0.3,     // home: hands' midpoint within this of the body centre (shoulder widths)
  homeLevel: 0.3,     // home: hands level within this
  stepOn: 0.55,       // both hands this far sideways -> move one column
  liftOn: 0.7,        // one hand this much higher than the other -> rotate (left higher = clockwise)
  reverseMargin: 0.25,// opposite action needs this much extra until hands rest at home
  restSpeed: 1.5,     // "at rest" = hands slower than this (shoulder widths / s)
  holdMaxDrop: 1.3,   // a hand counts as "up in front" above this many shoulder widths below the shoulders
  squatOn: 0.55,      // shoulders this far below standing height -> squat
  squatOff: 0.30,
  confirmFrames: 2,   // a gesture must hold this many camera frames
  calibFrames: 15,    // standing height = median of this many frames (hands below shoulders)
});

// Landmarks kept in recordings (MediaPipe Pose indices): nose, shoulders, elbows, wrists, hips, knees.
export const KEEP = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26];

// Features of one pose. lm = 33 MediaPipe landmarks (normalised x/y/visibility); W/H = video size.
// mirror = true when the camera faces the players (their left = smaller x after mirroring).
export function features(lm, W, H, mirror = true) {
  if (!lm) return { ok: false };
  const vx = x => (mirror ? 1 - x : x);
  const P = i => ({ x: vx(lm[i].x) * W, y: lm[i].y * H, v: lm[i].visibility ?? 1 });
  const s1 = P(11), s2 = P(12), w1 = P(15), w2 = P(16);
  const sw = Math.hypot(s1.x - s2.x, s1.y - s2.y);
  if (sw < 8 || s1.v < 0.5 || s2.v < 0.5) return { ok: false };
  const cx = (s1.x + s2.x) / 2, shY = (s1.y + s2.y) / 2;
  const hands = w1.v > 0.5 && w2.v > 0.5;
  const [hL, hR] = w1.x <= w2.x ? [w1, w2] : [w2, w1];   // left/right hand as the players see it
  return {
    ok: true, sw, cx, shY, hands,
    shift: hands ? ((hL.x + hR.x) / 2 - cx) / sw : 0,     // + = both hands to the players' right
    lift: hands ? (hR.y - hL.y) / sw : 0,                 // + = left hand higher
    lowHand: hands ? (Math.min(hL.y, hR.y) - shY) / sw : Infinity,  // highest hand, below shoulders
    handsRaised: hands && (hL.y < shY || hR.y < shY),
    hL, hR,
  };
}

function updSw(s, onCond, offCond, n) {
  if (!s.on) {
    if (onCond) { if (++s.n >= n) { s.on = true; s.n = 0; return 'rise'; } } else s.n = 0;
  } else {
    if (offCond) { if (++s.n >= n) { s.on = false; s.n = 0; return 'fall'; } } else s.n = 0;
  }
  return null;
}

const OPP = { left: 'right', right: 'left', cw: 'ccw', ccw: 'cw' };

// One player's gesture state machine:
//   NO_HANDS --a hand up--> RETURN --enter HOME--> READY --gesture--> action --> RETURN
//   any --squat--> SQUAT (nothing else counts) --stand up--> RETURN
export class GestureMachine {
  constructor(th = {}) { this.th = { ...DEFAULTS, ...th }; this.reset(); }
  reset() {
    this.gs = 'NO_HANDS'; this.gestN = 0; this.lastAct = null; this.speed = null; this.prev = null;
    this.ref = null; this.calib = []; this.tallN = 0; this.sq = { on: false, n: 0 }; this.lastSeen = -Infinity;
  }
  setState(st) { if (this.gs !== st) { this.gs = st; this.gestN = 0; } }
  // f = features(...), now = ms. Returns { action, state, squat, drop, holding }.
  update(f, now) {
    const th = this.th;
    let action = null;
    if (!f || !f.ok) {
      this.gs = 'NO_HANDS'; this.gestN = 0; this.speed = null; this.prev = null; this.sq = { on: false, n: 0 };
      if (this.ref != null && now - this.lastSeen > 1500) { this.ref = null; this.calib = []; }
      return { action, state: this.gs, squat: false, drop: 0, holding: false };
    }
    this.lastSeen = now;
    const holding = f.hands && f.lowHand < th.holdMaxDrop;

    // Squat: shoulders below the standing height measured at the start (median, hands below shoulders).
    if (this.ref == null) {
      if (!f.handsRaised) this.calib.push(f.shY);
      if (this.calib.length >= th.calibFrames) {
        const c = this.calib.slice().sort((a, b) => a - b); this.ref = c[c.length >> 1]; this.calib = [];
      }
    }
    const drop = this.ref == null ? 0 : (f.shY - this.ref) / f.sw;
    updSw(this.sq, this.ref != null && drop > th.squatOn, this.ref == null || drop < th.squatOff, th.confirmFrames);
    if (this.ref != null && !f.handsRaised && drop < -th.squatOff) {
      if (++this.tallN > th.calibFrames * 3) { this.ref = null; this.calib = []; this.tallN = 0; this.sq = { on: false, n: 0 }; }
    } else this.tallN = 0;

    // Hand speed (for "at rest").
    if (this.prev && now > this.prev.t) {
      const v = Math.hypot(f.shift - this.prev.shift, f.lift - this.prev.lift) / ((now - this.prev.t) / 1000);
      this.speed = this.speed == null ? v : this.speed + (v - this.speed) * 0.5;
    }
    this.prev = { shift: f.shift, lift: f.lift, t: now };

    const atHome = Math.abs(f.shift) < th.homeShift && Math.abs(f.lift) < th.homeLevel;
    if (atHome && (this.speed ?? 0) < th.restSpeed) this.lastAct = null;
    const need = (act, base) => base + (this.lastAct && OPP[this.lastAct] === act ? th.reverseMargin : 0);

    if (this.sq.on) this.setState('SQUAT');
    else if (!holding) this.setState('NO_HANDS');
    else if (this.gs === 'RETURN') { if (atHome) this.setState('READY'); }
    else if (this.gs === 'READY') {
      const sAct = f.shift > 0 ? 'right' : 'left', rAct = f.lift > 0 ? 'cw' : 'ccw';
      const sScore = Math.abs(f.shift) / need(sAct, th.stepOn), rScore = Math.abs(f.lift) / need(rAct, th.liftOn);
      this.gestN = sScore >= 1 || rScore >= 1 ? this.gestN + 1 : 0;
      if (this.gestN >= th.confirmFrames) {
        action = sScore >= rScore ? sAct : rAct;
        this.lastAct = action; this.setState('RETURN');
      }
    } else this.setState('RETURN');   // NO_HANDS / SQUAT -> back home first
    return { action, state: this.gs, squat: this.sq.on, drop, holding };
  }
}

// Rebuild a 33-landmark array from a recorded frame (only KEEP points stored, as [x, y, visibility]).
export function unpack(p) {
  if (!p) return null;
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  KEEP.forEach((idx, k) => { const q = p[k]; lm[idx] = { x: q[0], y: q[1], visibility: q[2] }; });
  return lm;
}

// Run a recorded session through the state machine. Returns detected events [{t, a}]
// (a = left/right/cw/ccw, or 'squat' when a squat starts).
export function replay(session, th) {
  const m = new GestureMachine(th), events = [];
  let prevSq = false;
  for (const fr of session.frames) {
    const r = m.update(features(unpack(fr.p), session.W, session.H, session.mirror), fr.t);
    if (r.action) events.push({ t: fr.t, a: r.action });
    if (r.squat && !prevSq) events.push({ t: fr.t, a: 'squat' });
    prevSq = r.squat;
  }
  return events;
}
