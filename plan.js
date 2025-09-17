// plan.js
const defaultWeeklyPlan = {
  Sunday: {
    goals: 'Rest',
    routine: ['Recovery jog 20 min', 'Mobility & foam roll'],
  },
  Monday: {
    goals: 'Vault day',
    routine: [
      'Drills:',
      '  Start with warmup drills (thick mat, hurdles). On the way back from each drill do grapevine both ways and run backwards:',
      '  2× Sidestep hurdles (both ways)',
      '  2× Step over hurdles',
      '  2× Hop over hurdles',
      '  2× Crawl under',
      '  2× Crab crawl',
      'Runway:',
      '  One arm — stretch top arm; keep form into the pit',
      '  Sweep — keep form; avoid dropping head/shoulders',
      '  Sweep with turns — ¼, ½, full',
      '  Press — top hand highest, bottom arm straight, knee driven; swing through (not inverted)',
      '  Full vault',
      'Lift: In Volt — Plyometric / explosive focused',
    ],
  },
  Tuesday: {
    goals: 'Sprint warm up with Sprints',
    routine: [
      'Sprint warm up:',
      '  2×5 Mini hurdles w/ pole — stay tall; plant after last hurdle and jump',
      '  2×5 Mini hurdles w/o pole — stay tall; jump after last hurdle',
      'Bubkas — progression:',
      '  Static bubkas on dip bars (target 3×10 before progressing)',
      '  Negatives on bar (slow descent)',
      '  Partials on bar: ankle → knee (10 good reps)',
      '  Full rep on bar: ankle → hip',
      '  End goal: full bubka with swing',
      'Core circuit — 3 rounds:',
      '  Plank with shoulder taps — 30s',
      '  Dead bugs — 12 each side',
      '  Russian twists — 20 reps (10/side)',
      '  Reach-through plank — 30s',
      '  Sandbag/weight drag under body until time',
    ],
  },
  Wednesday: {
    goals: 'Vault Day',
    routine: [
      'Drills before/during Full Vault Day:',
      '  1) Rope drill',
      '  2) Ring drill',
      '  3) Bendy pole drill',
      '  4) Wall plant w/ comp pole',
      'Runway:',
      '  1) One arm',
      '  2) Sweep',
      '  3) Sweep with turns',
      '  4) Press',
      '  5) Full vault',
    ],
  },
  Thursday: {
    goals: 'Recovery Day',
    routine: ['Light jog', 'Mobility & foam roll', 'Stretching'],
  },
  Friday: {
    goals: 'Sprint Workout',
    routine: [
      'Sprint warm up:',
      '  2×5 Mini hurdles w/ pole',
      '  2×5 Mini hurdles w/o pole',
      'Choose one:',
      '  2 × (3–5 × 30–50m sprints)',
      '  2 × 5 × 80m @ ~80% (1 min between reps, 8 min between sets)',
      '  2 × 80m @ ~95% (8 min rest) + 2 × 120m @ ~95% (10 min rest)',
    ],
  },
  Saturday: {
    goals: 'Lift in Volt (lower body heavy)',
    routine: [],
  },
};

export default defaultWeeklyPlan;