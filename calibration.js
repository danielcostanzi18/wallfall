// Calibration: fit personal thresholds from a recorded session, and score a session by replaying it.
import { DEFAULTS, features, unpack, replay } from './gesture-core.js';

export const GESTURES = ['left', 'right', 'cw', 'ccw', 'squat'];

const pct = (arr, p) => {
  if (!arr.length) return NaN;
  const a = arr.slice().sort((x, y) => x - y), i = (a.length - 1) * p / 100, lo = Math.floor(i), hi = Math.ceil(i);
  return a[lo] + (a[hi] - a[lo]) * (i - lo);
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r2 = v => Math.round(v * 100) / 100;

// Each "GO" cue's evaluation window runs until the next GO cue (so it includes the return home).
function goWindows(session) {
  const go = session.cues.filter(c => GESTURES.includes(c.label));
  const end = session.frames.length ? session.frames[session.frames.length - 1].t + 1 : 0;
  return go.map((c, i) => ({ ...c, t1w: i + 1 < go.length ? go[i + 1].t0 : end }));
}

// Measure the player's movements and derive personal thresholds.
export function fit(session) {
  const F = session.frames.map(fr => ({ t: fr.t, f: features(unpack(fr.p), session.W, session.H, session.mirror) }));
  const between = (t0, t1) => F.filter(x => x.t >= t0 && x.t < t1 && x.f.ok);
  const home = session.cues.find(c => c.label === 'home');
  const notes = [];
  if (!home) return { error: 'No HOME phase in this recording.' };
  // Only frames where the hands are really up in front count (same "holding" rule as the game).
  const holding = f => f.hands && f.lowHand < DEFAULTS.holdMaxDrop;
  const homeVis = between(home.t0 + 1000, home.t1).filter(x => x.f.hands);   // skip the first second (settling)
  if (homeVis.length < 10) return { error: 'Not enough frames at HOME with both hands visible. Stand so the camera sees your hands.' };
  const homeF = homeVis.filter(x => holding(x.f));
  if (homeF.length < 10) return { error: 'During HOME your hands were down by your sides, so the game would not see you holding the block. Hold both hands UP in front of your chest, level, at every HOME cue, and record again.' };
  const standF = homeF.filter(x => !x.f.handsRaised);
  const ref = pct((standF.length ? standF : homeF).map(x => x.f.shY), 50);

  const stats = {
    homeShiftP95: pct(homeF.map(x => Math.abs(x.f.shift)), 95),
    homeLevelP95: pct(homeF.map(x => Math.abs(x.f.lift)), 95),
  };
  const peaks = Object.fromEntries(GESTURES.map(g => [g, []]));
  const cross = Object.fromEntries(GESTURES.map(g => [g, []]));   // the "other" signal during each rep
  for (const w of goWindows(session)) {
    const win = between(w.t0, w.t1w), g = w.label;
    const val = x => g === 'left' ? -x.f.shift : g === 'right' ? x.f.shift
      : g === 'cw' ? x.f.lift : g === 'ccw' ? -x.f.lift : (x.f.shY - ref) / x.f.sw;
    const use = g === 'squat' ? win : win.filter(x => x.f.hands);
    if (!use.length) { notes.push(`${g} rep ${w.rep}: you weren't visible (or hands not visible)`); continue; }
    peaks[g].push(Math.max(...use.map(val)));
    if (g !== 'squat') cross[g].push(Math.max(...use.map(x => Math.abs(g === 'left' || g === 'right' ? x.f.lift : x.f.shift))));
  }
  const swing = [...peaks.left, ...peaks.right], lifts = [...peaks.cw, ...peaks.ccw], sq = peaks.squat;
  Object.assign(stats, {
    swingMedian: pct(swing, 50), swingMin: Math.min(...swing),
    liftMedian: pct(lifts, 50), liftMin: Math.min(...lifts),
    squatMedian: pct(sq, 50), squatMin: Math.min(...sq),
    liftDuringSwings: pct([...cross.left, ...cross.right], 80),
    swingDuringLifts: pct([...cross.cw, ...cross.ccw], 80),
  });

  // Thresholds: HOME just big enough for your jitter at home; actions at ~60% of your typical (low-end) movement.
  const th = { ...DEFAULTS };
  // HOME only gates "ready", so a smaller zone can only cause missed gestures: never go below the default.
  th.homeShift = clamp(1.6 * stats.homeShiftP95, DEFAULTS.homeShift, 0.45);
  th.homeLevel = clamp(1.6 * stats.homeLevelP95, DEFAULTS.homeLevel, 0.45);
  if (swing.length >= 3) th.stepOn = Math.max(th.homeShift + 0.15, 0.6 * pct(swing, 20));
  else notes.push('Too few sideways reps detected: kept the default for moving.');
  if (lifts.length >= 3) th.liftOn = Math.max(th.homeLevel + 0.15, 0.6 * pct(lifts, 20));
  else notes.push('Too few rotation reps detected: kept the default for rotating.');
  if (sq.length >= 3) { th.squatOn = Math.max(0.25, 0.55 * pct(sq, 20)); th.squatOff = 0.5 * th.squatOn; }
  else notes.push('Too few squats detected: kept the default for squatting.');
  th.reverseMargin = 0.45 * th.stepOn;
  for (const k of ['homeShift', 'homeLevel', 'stepOn', 'liftOn', 'squatOn', 'squatOff', 'reverseMargin']) th[k] = r2(th[k]);

  // Warnings about movements that will be hard to tell apart.
  peaks.left.concat(peaks.right).forEach((v, i) => { if (v < th.stepOn) notes.push(`A sideways rep (${r2(v)}) stayed below the move threshold (${th.stepOn}).`); });
  peaks.cw.concat(peaks.ccw).forEach(v => { if (v < th.liftOn) notes.push(`A rotation rep (${r2(v)}) stayed below the rotate threshold (${th.liftOn}).`); });
  if (stats.liftDuringSwings / th.liftOn > 0.8) notes.push('Your sideways swings also tilt your hands a lot: some moves may be read as rotations. Keep hands level while swinging.');
  if (stats.swingDuringLifts / th.stepOn > 0.8) notes.push('Your rotations also move your hands sideways: some rotations may be read as moves. Lift straight up/down.');
  const retF = session.cues.filter(c => c.label === 'return').flatMap(c => between(c.t0 + 500, c.t1));
  const retHold = retF.length ? retF.filter(x => holding(x.f)).length / retF.length : 1;
  stats.returnHoldingFrac = retHold;
  if (retHold < 0.6) notes.push(`Between gestures your hands were down ${Math.round(100 * (1 - retHold))}% of the time. In the game you keep them up at HOME, so this recording is not like real play: record again keeping your hands up between gestures.`);

  // Safety net: a personal value is kept only if it does not score worse than the default on this recording.
  const score = t => { const e = evaluate(session, t); return e.total.correct - 0.5 * e.total.extra - e.spurious; };
  const groups = [['stepOn', 'reverseMargin'], ['liftOn'], ['squatOn', 'squatOff'], ['homeShift'], ['homeLevel']];
  let best = score(th);
  for (const keys of groups) {
    const trial = { ...th }; for (const k of keys) trial[k] = DEFAULTS[k];
    if (keys.some(k => th[k] !== DEFAULTS[k])) {
      const sc = score(trial);
      if (sc >= best) { if (sc > best) notes.push(`Kept the default for ${keys[0]}: your measured value scored worse on the replay.`); Object.assign(th, trial); best = sc; }
    }
  }
  for (const k in stats) stats[k] = Number.isFinite(stats[k]) ? r2(stats[k]) : null;
  return { th, stats, peaks: Object.fromEntries(Object.entries(peaks).map(([k, v]) => [k, v.map(r2)])), notes };
}

// Replay a session with thresholds `th` and score each GO cue:
// correct = the first detected action is the requested one; extra = more actions in the same window.
export function evaluate(session, th) {
  const events = replay(session, th), wins = goWindows(session);
  const res = Object.fromEntries(GESTURES.map(g => [g, { reps: 0, correct: 0, missed: 0, wrong: 0, extra: 0 }]));
  const firstGo = wins.length ? wins[0].t0 : Infinity;
  const spurious = events.filter(e => e.t < firstGo).length;
  const detail = [];
  for (const w of wins) {
    const ev = events.filter(e => e.t >= w.t0 && e.t < w.t1w), r = res[w.label];
    r.reps++;
    if (!ev.length) r.missed++;
    else if (ev[0].a === w.label) r.correct++;
    else r.wrong++;
    r.extra += Math.max(0, ev.length - 1);
    detail.push({ gesture: w.label, rep: w.rep, got: ev.map(e => e.a) });
  }
  const tot = Object.values(res).reduce((a, r) => ({ reps: a.reps + r.reps, correct: a.correct + r.correct, extra: a.extra + r.extra }), { reps: 0, correct: 0, extra: 0 });
  return { res, spurious, total: tot, detail };
}
