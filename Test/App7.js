// PoleVault Tracker – React Native (Expo) MVP
// One-file starter you can drop in as App.js in an Expo project
// Features:
// - Weekly Practice Plan (routine + goals for each day)
// - Log Practice & Meet sessions (height, steps, takeoff, standards, goals, notes)
// - Meet attempts with success/fail and automatic PR calculation
// - Basic Stats (PR, averages)
// - Units: Imperial or Metric (stored internally as inches; converted at the edges)
// - Local persistence via Zustand + AsyncStorage
// SafeArea-enabled rewrite with Spring Arbor University logo watermark on every screen
// Centered Spring Arbor University logo (in color) on every screen
// - Home: PR + latest practice steps/standards/takeoff
// - Local persistence via Zustand + AsyncStorage
// - SAU logo watermark on every screen
// PoleVault Tracker – React Native (Expo) MVP (rev: static plan + email on forms)
// Changes:
// - Plan: read-only (no editing, no Save Day)
// - Today: no checklist, no email (just shows goals + routine)
// - PracticeForm: shows today's routine with checkmarks + email button
// - MeetForm: adds steps/standards/takeoff fields + email button
// - Practice sessions store routine completion with the session
// PoleVault Tracker – React Native (Expo) MVP (rev: athlete profile + personalization + dropdown + nav fix)
// rev: metric split (cm for standards, m for bar) + custom dropdowns (no deps)
// Full rewrite: metric split (cm for standards, m for bar), Steps dropdown 1–15,
// Approach dropdown (ft 1–150, in 1–11), approachIn persisted/displayed, emails updated.
// Full app: static weekly plan (from code), header-aware routine rendering (no checkboxes on headings),
// Steps dropdown (1–15), Approach dropdowns (ft 1–150, in 1–11), metric split (cm for standards/takeoff, m for bar),
// athlete personalization (name/year/level), share/email, bottom SAU watermark, local persistence (plan not persisted).
// Cleaned & de-duplicated build with:
// - Home (PR + latest practice steps/approach/standards/takeoff)
// - Today (read-only goals + routine with headers)
// - Log (list, details, delete, share)
// - Plan (read-only, static from code)
// - Stats (PR & averages)
// - Settings (athlete profile + units)
// - PracticeForm (header-aware routine with checkboxes, steps & approach dropdowns, email summary)
// - MeetForm (attempts with O/X, setup fields, email summary)
// - SAU color logo watermark on every screen
// - Local persistence via Zustand + AsyncStorage (plan not persisted; always from code)

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// -------------------- Utilities --------------------
// Max feet for approach selector
const APPROACH_MAX_FEET = 150;
const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const todayIdx = () => new Date().getDay();
const todayName = () => days[todayIdx()];

const inchesToCm = (inches) => (Number(inches) || 0) * 2.54;
const cmToInches = (cm) => (Number(cm) || 0) / 2.54;
const inchesToMeters = (inch) => (Number(inch) || 0) * 0.0254;
const metersToInches = (m) => (Number(m) || 0) / 0.0254;

const toInches = ({ feet = 0, inches = 0 }) => {
  const f = Number(feet) || 0;
  const i = Number(inches) || 0;
  return Math.max(0, f * 12 + i);
};

const fromInches = (total) => {
  const t = Math.max(0, Number(total) || 0);
  const feet = Math.floor(t / 12);
  let inches = Math.round(t - feet * 12);
  if (inches === 12) { return { feet: feet + 1, inches: 0 }; }
  return { feet, inches };
};

const shortId = () =>
  (global.crypto?.randomUUID ? global.crypto.randomUUID() : Math.random().toString(36).slice(2, 9));

// Treat any routine string that ends with ":" as a section header (no checkbox)
const isRoutineHeader = (s) => typeof s === 'string' && s.trim().endsWith(':');

// -------------------- Static Weekly Plan --------------------
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

// -------------------- Store (persist sessions & settings only) --------------------
const initialSettings = {
  units: 'imperial', // 'imperial' | 'metric'
  athlete: { firstName: '', lastName: '', year: '', level: 'highschool' },
};

const usePVStore = create(
  persist(
    (set, get) => ({
      settings: initialSettings,
      weeklyPlan: defaultWeeklyPlan,   // always from code
      sessions: [],

      setUnits: (units) => set((s) => ({ settings: { ...s.settings, units } })),
      setAthleteField: (key, value) =>
        set((s) => ({ settings: { ...s.settings, athlete: { ...s.settings.athlete, [key]: value } } })),
      addSession: (session) => set((s) => ({ sessions: [session, ...s.sessions] })),
      updateSession: (id, patch) =>
        set((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      deleteSession: (id) => set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) })),
    }),
    {
      name: 'polevault-tracker-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: 12,
      migrate: async (persisted) => {
        const state = typeof persisted === 'object' && persisted ? { ...persisted } : {};
        state.weeklyPlan = defaultWeeklyPlan; // force plan from code
        if (!state.settings) state.settings = initialSettings;
        if (!state.settings.athlete) state.settings.athlete = initialSettings.athlete;
        if (!Array.isArray(state.sessions)) state.sessions = [];
        state.sessions = state.sessions.map((s) => {
          const norm = { ...s };
          if (typeof norm.approachIn !== 'number') norm.approachIn = 0;
          if (norm.type === 'practice') {
            norm.steps = Number.isFinite(norm.steps) ? norm.steps : undefined;
            norm.takeoffIn = Number(norm.takeoffIn || 0);
            norm.standardsIn = Number(norm.standardsIn || 0);
            norm.heightIn = Number(norm.heightIn || 0);
            norm.routine = Array.isArray(norm.routine) ? norm.routine : [];
          } else if (norm.type === 'meet') {
            norm.steps = Number.isFinite(norm.steps) ? norm.steps : undefined;
            norm.takeoffIn = Number(norm.takeoffIn || 0);
            norm.standardsIn = Number(norm.standardsIn || 0);
            norm.attempts = Array.isArray(norm.attempts) ? norm.attempts : [];
          }
          return norm;
        });
        return state;
      },
      // Only persist settings & sessions
      partialize: (state) => ({
        settings: state.settings,
        sessions: state.sessions,
      }),
    }
  )
);

// -------------------- Reusable UI --------------------
const Section = ({ title, children, right }) => (
  <View style={styles.section}>
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right ? <View style={{ marginLeft: 'auto' }}>{right}</View> : null}
    </View>
    <View style={{ marginTop: 8 }}>{children}</View>
  </View>
);

const Row = ({ children, style }) => (<View style={[styles.row, style]}>{children}</View>);

const Field = ({ label, children }) => (
  <View style={{ marginBottom: 10 }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
  </View>
);

const Pill = ({ text }) => (<View style={styles.pill}><Text style={{ fontWeight: '600' }}>{text}</Text></View>);

const ButtonPrimary = ({ title, onPress }) => (
  <Pressable onPress={onPress} style={styles.btnPrimary}><Text style={styles.btnPrimaryText}>{title}</Text></Pressable>
);
const ButtonSecondary = ({ title, onPress }) => (
  <Pressable onPress={onPress} style={styles.btnSecondary}><Text style={styles.btnSecondaryText}>{title}</Text></Pressable>
);

// Checkbox chip for drills (not for headers)
const CheckboxChip = ({ checked, label, onToggle }) => (
  <Pressable onPress={onToggle} style={[styles.checkboxChip, checked ? styles.checkboxChipOn : null]}>
    <Text style={[styles.checkboxText, checked ? styles.checkboxTextOn : null]}>
      {checked ? '✓ ' : '○ '} {label}
    </Text>
  </Pressable>
);

// Simple faux dropdown field
function SimpleDropdown({ label, valueLabel, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.dropdown}>
      <Text style={styles.dropdownText}>{valueLabel || label}</Text>
    </Pressable>
  );
}

// Generic modal dropdown (no external deps)
function DropdownModal({ visible, title, options, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>{title}</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            {options.map((opt) => (
              <Pressable
                key={`${title}-${opt.label}-${opt.value}`}
                onPress={() => { onSelect(opt); onClose(); }}
                style={styles.optionRow}
              >
                <Text style={styles.optionText}>{opt.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={{ height: 8 }} />
          <ButtonSecondary title="Cancel" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

// Screen wrapper with SAU watermark at the bottom
function Screen({ children }) {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <Image source={require('./assets/sau-logo.png')} style={styles.bgLogo} resizeMode="contain" />
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16, paddingBottom: 40 }}>
          {children}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// Height input for imperial (ft/in) or free cm entry (metric) — used for takeoff/standards/bar
function UnitAwareHeightInput({ units, valueInches, onChangeInches, placeholder }) {
  const { feet, inches } = fromInches(valueInches);
  const [ft, setFt] = useState(String(feet));
  const [ins, setIns] = useState(String(inches));
  const [cm, setCm] = useState(String(Math.round(inchesToCm(valueInches))));

  React.useEffect(() => {
    if (units === 'imperial') {
      const f = fromInches(valueInches).feet;
      const i = fromInches(valueInches).inches;
      setFt(String(f));
      setIns(String(i));
    } else {
      setCm(String(Math.round(inchesToCm(valueInches))));
    }
  }, [units, valueInches]);

  const handleImperial = (f, i) => {
    setFt(f); setIns(i);
    onChangeInches(toInches({ feet: Number(f), inches: Number(i) }));
  };
  const handleMetric = (c) => {
    setCm(c);
    onChangeInches(cmToInches(Number(c)));
  };

  if (units === 'imperial') {
    return (
      <Row>
        <TextInput value={ft} onChangeText={(t) => handleImperial(t, ins)} keyboardType="number-pad" placeholder="ft" style={styles.inputSmall} />
        <Text style={{ fontSize: 16 }}>ft</Text>
        <TextInput value={ins} onChangeText={(t) => handleImperial(ft, t)} keyboardType="number-pad" placeholder="in" style={styles.inputSmall} />
        <Text style={{ fontSize: 16 }}>in</Text>
      </Row>
    );
  }
  // metric free entry in cm
  return (
    <Row>
      <TextInput value={cm} onChangeText={(t) => handleMetric(t)} keyboardType="number-pad" placeholder={placeholder || 'cm'} style={styles.input} />
      <Text style={{ fontSize: 16 }}>cm</Text>
    </Row>
  );
}

// -------------------- Helpers --------------------
function selectLatestPractice(sessions) {
  let latest = null;
  for (const s of sessions || []) {
    if (s.type === 'practice') {
      if (!latest || new Date(s.date) > new Date(latest.date)) latest = s;
    }
  }
  return latest;
}
function avgOf(arr) { if (!arr?.length) return 0; const n = arr.length; return arr.reduce((a, b) => a + Number(b || 0), 0) / n; }
function calcPR(sessions) {
  let best = 0;
  for (const s of sessions || []) {
    if (s.type === 'meet' && Array.isArray(s.attempts)) {
      for (const a of s.attempts) { if (a.result === 'clear') best = Math.max(best, Number(a.heightIn) || 0); }
    }
  }
  return best || 0;
}
function fmtStandards(inches, units) {
  const val = Number(inches || 0);
  if (!val) return '—';
  if (units === 'metric') return `${Math.round(inchesToCm(val))} cm`;
  const { feet, inches: ins } = fromInches(val);
  return `${feet}'${ins}"`;
}
function fmtTakeoff(inches, units) {
  const val = Number(inches || 0);
  if (!val) return '—';
  if (units === 'metric') return `${Math.round(inchesToCm(val))} cm`;
  const { feet, inches: ins } = fromInches(val);
  return `${feet}'${ins}"`;
}
function fmtBar(inches, units) {
  const val = Number(inches || 0);
  if (!val) return '—';
  if (units === 'metric') {
    const m = inchesToMeters(val);
    return `${m.toFixed(2).replace(/\.?0+$/,'')} m`;
  }
  const { feet, inches: ins } = fromInches(val);
  return `${feet}'${ins}"`;
}
function fmtFeetIn(inchesTotal) {
  const { feet, inches } = fromInches(Number(inchesTotal || 0));
  if (!feet && !inches) return '—';
  return `${feet}'${inches}"`;
}
const fullName = (athlete) => {
  const f = (athlete?.firstName || '').trim();
  const l = (athlete?.lastName || '').trim();
  return (f || l) ? `${f}${f && l ? ' ' : ''}${l}` : '';
};
const levelLabel = (level) => level === 'college' ? 'College' : 'High School';

function sessionSummaryText(session, settings, athlete) {
  const units = settings?.units || 'imperial';
  const name = fullName(athlete);
  const header = `${session.type === 'meet' ? 'MEET' : 'PRACTICE'} – ${new Date(session.date).toLocaleDateString()}`;
  const athleteLine = name ? `Athlete: ${name}${athlete?.year ? ` (Year ${athlete.year})` : ''} – ${levelLabel(athlete?.level)}` : '';
  const basics = [
    session.type === 'meet' && session.meetName ? `Meet: ${session.meetName}` : '',
    session.goals ? `Goals:\n${session.goals}` : '',
  ].filter(Boolean).join('\\n\\n');

  const setup = [
    `Steps: ${session.steps ?? '—'}`,
    `Approach: ${fmtFeetIn(session.approachIn)}`,
    `Takeoff: ${fmtTakeoff(session.takeoffIn, units)}`,
    `Standards: ${fmtStandards(session.standardsIn, units)}`,
    session.heightIn ? `Bar: ${fmtBar(session.heightIn, units)}` : '',
  ].filter(Boolean).join('\\n');

  let middle = '';
  if (session.type === 'meet') {
    const attempts = (session.attempts || []).map((a, i) =>
      `  ${i + 1}. ${fmtBar(a.heightIn, units)}  ${a.result === 'clear' ? 'O' : 'X'}`
    );
    const prToday = fmtBar(calcPR([session]), units) || '—';
    middle = `Attempts:\\n${attempts.length ? attempts.join('\\n') : '(none)'}\\n\\nPR (today): ${prToday}`;
  } else if (Array.isArray(session.routine) && session.routine.length) {
    const r = session.routine.map((item) => {
      if (typeof item === 'string') {
        return isRoutineHeader(item) ? item : `[ ] ${item}`;
      }
      return item.isHeader ? item.text : `${item.done ? '[x]' : '[ ]'} ${item.text}`;
    }).join('\\n');
    middle = `Routine:\\n${r}`;
  }

  const notes = session.notes ? `\\n\\nNotes:\\n${session.notes}` : '';

  return [header, athleteLine, basics, middle, setup, notes, '\\n--\\nSent from PoleVault Tracker']
    .filter(Boolean)
    .join('\\n\\n');
}

// -------------------- Screens --------------------
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeScreen({ navigation }) {
  const sessions = usePVStore((s) => s.sessions);
  const { units, athlete } = usePVStore((s) => s.settings);
  const name = fullName(athlete);
  const prInches = useMemo(() => calcPR(sessions), [sessions]);
  const latestPractice = useMemo(() => selectLatestPractice(sessions), [sessions]);

  return (
    <Screen>
      <StatusBar style="auto" />
      <Section title={name ? `Welcome, ${athlete.firstName}!` : 'Welcome'}>
        {name ? (
          <Row style={{ flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <Pill text={name} />
            {athlete.year ? <Pill text={`Year ${athlete.year}`} /> : null}
            {athlete.level ? <Pill text={levelLabel(athlete.level)} /> : null}
          </Row>
        ) : null}
        <Field label="Best Vault (PR)">
          <Text style={styles.h2}>{prInches ? fmtBar(prInches, units) : '—'}</Text>
        </Field>
      </Section>

      <Section title="Current Setup">
        <Row style={{ flexWrap: 'wrap', gap: 10 }}>
          <Pill text={`Steps ${latestPractice?.steps ?? '—'}`} />
          <Pill text={`Approach ${fmtFeetIn(latestPractice?.approachIn)}`} />
          <Pill text={`Standards ${fmtStandards(latestPractice?.standardsIn, units)}`} />
          <Pill text={`Takeoff ${fmtTakeoff(latestPractice?.takeoffIn, units)}`} />
        </Row>
        {latestPractice ? (
          <Text style={[styles.muted, { marginTop: 8 }]}>From practice on {new Date(latestPractice.date).toLocaleDateString()}</Text>
        ) : (
          <Text style={[styles.muted, { marginTop: 8 }]}>No practices logged yet.</Text>
        )}
      </Section>

      <Row style={{ justifyContent: 'space-evenly', marginTop: 8 }}>
        <ButtonPrimary title="Log Practice" onPress={() => navigation.navigate('PracticeForm')} />
        <ButtonSecondary title="Log Meet" onPress={() => navigation.navigate('MeetForm')} />
      </Row>
    </Screen>
  );
}

// Read-only Today (no checkmarks, no email)
function TodayScreen({ navigation }) {
  const plan = usePVStore((s) => s.weeklyPlan);
  const athlete = usePVStore((s) => s.settings.athlete);
  const day = todayName();
  const entry = plan[day] || { goals: '', routine: [] };
  const name = fullName(athlete);

  return (
    <Screen>
      <StatusBar style="auto" />
      <Section title={name ? `${day} – ${name}` : `Today – ${day}`}>
        {!!entry.goals && (
          <Field label="Goals"><Text style={styles.pText}>{entry.goals}</Text></Field>
        )}
        <Field label="Routine">
          {entry.routine?.length ? (
            <View style={{ gap: 6 }}>
              {entry.routine.map((r, idx) =>
                isRoutineHeader(r) ? (
                  <Text key={idx} style={{ fontWeight: '800', fontSize: 16, marginTop: 6 }}>
                    {String(r).replace(/:$/, '')}
                  </Text>
                ) : (
                  <Text key={idx} style={styles.pText}>• {r}</Text>
                )
              )}
            </View>
          ) : (
            <Text style={styles.muted}>No routine set for today.</Text>
          )}
        </Field>
      </Section>
      <Row style={{ justifyContent: 'space-evenly', marginTop: 8 }}>
        <ButtonPrimary title="Log Practice" onPress={() => navigation.navigate('PracticeForm')} />
        <ButtonSecondary title="Log Meet" onPress={() => navigation.navigate('MeetForm')} />
      </Row>
    </Screen>
  );
}

function LogScreen({ navigation }) {
  const sessions = usePVStore((s) => s.sessions);
  const del = usePVStore((s) => s.deleteSession);
  const units = usePVStore((s) => s.settings.units);
  const settings = usePVStore((s) => s.settings);

  const handleShare = async (session) => {
    try {
      const text = sessionSummaryText(session, settings, settings.athlete);
      await Share.share({ message: text });
    } catch {
      Alert.alert('Error', 'Could not open share sheet.');
    }
  };

  return (
    <Screen>
      <Section title="Session Log">
        {sessions.length === 0 ? (
          <Text style={styles.muted}>No sessions logged yet.</Text>
        ) : (
          <View>
            {sessions.map((s) => (
              <Pressable key={s.id} onPress={() => navigation.navigate('SessionDetails', { id: s.id })} style={styles.card}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '700', fontSize: 16 }}>{s.type === 'meet' ? 'Meet' : 'Practice'} – {new Date(s.date).toLocaleDateString()}</Text>
                  <Text style={styles.muted}>{s.meetName || s.dayName || ''}</Text>
                </Row>
                <View style={{ height: 6 }} />
                <Text style={styles.pText} numberOfLines={2}>Goals: {s.goals || '—'}</Text>
                <View style={{ height: 6 }} />
                <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
                  {s.type === 'practice' ? (
                    <>
                      <Pill text={`Steps ${s.steps ?? '—'}`} />
                      <Pill text={`Approach ${fmtFeetIn(s.approachIn)}`} />
                      <Pill text={`Takeoff ${fmtTakeoff(s.takeoffIn, units)}`} />
                      <Pill text={`Standards ${fmtStandards(s.standardsIn, units)}`} />
                      {s.heightIn ? <Pill text={`Bar ${fmtBar(s.heightIn, units)}`} /> : null}
                    </>
                  ) : (
                    <>
                      {s.attempts?.length ? (<Pill text={`Attempts ${s.attempts.length}`} />) : null}
                      <Pill text={`PR ${fmtBar(calcPR([s]), units) || '—'}`} />
                    </>
                  )}
                </Row>
                <View style={{ height: 10 }} />
                <Row style={{ justifyContent: 'space-between' }}>
                  <ButtonSecondary title="Share" onPress={() => handleShare(s)} />
                  <ButtonSecondary
                    title="Delete"
                    onPress={() => Alert.alert('Delete session?', 'This cannot be undone.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => del(s.id) },
                    ])}
                  />
                </Row>
              </Pressable>
            ))}
          </View>
        )}
      </Section>
      <Row style={{ justifyContent: 'space-evenly', marginBottom: 28 }}>
        <ButtonPrimary title="Log Practice" onPress={() => navigation.navigate('PracticeForm')} />
        <ButtonSecondary title="Log Meet" onPress={() => navigation.navigate('MeetForm')} />
      </Row>
    </Screen>
  );
}

function SessionDetailsScreen({ route }) {
  const { id } = route.params;
  const session = usePVStore((s) => s.sessions.find((x) => x.id === id));
  const settings = usePVStore((s) => s.settings);
  const { units, athlete } = settings;

  if (!session) return (<Screen><Text>Session not found.</Text></Screen>);

  const name = fullName(athlete);
  const handleShare = async () => {
    try {
      const text = sessionSummaryText(session, settings, athlete);
      await Share.share({ message: text });
    } catch {
      Alert.alert('Error', 'Could not open share sheet.');
    }
  };

  return (
    <Screen>
      <Section
        title={`${name ? `${name} – ` : ''}${session.type === 'meet' ? 'Meet' : 'Practice'} – ${new Date(session.date).toLocaleDateString()}`}
        right={<ButtonSecondary title="Share" onPress={handleShare} />}
      >
        {session.type === 'meet' ? (
          <>
            {session.meetName ? <Field label="Meet"><Text style={styles.pText}>{session.meetName}</Text></Field> : null}
            <Field label="Goals"><Text style={styles.pText}>{session.goals || '—'}</Text></Field>

            <Field label="Attempts">
              {session.attempts?.length ? (
                <View style={{ gap: 6 }}>
                  {session.attempts.map((a, idx) => (
                    <Row key={idx} style={{ justifyContent: 'space-between' }}>
                      <Text>{fmtBar(a.heightIn, units)}</Text>
                      <Text style={{ fontWeight: '700', color: a.result === 'clear' ? '#0a7' : '#c22' }}>
                        {a.result === 'clear' ? 'O' : 'X'}
                      </Text>
                    </Row>
                  ))}
                </View>
              ) : (
                <Text style={styles.muted}>No attempts logged.</Text>
              )}
            </Field>

            <Field label="Setup used">
              <Row style={{ flexWrap: 'wrap', gap: 10 }}>
                <Pill text={`Steps ${session.steps ?? '—'}`} />
                <Pill text={`Approach ${fmtFeetIn(session.approachIn)}`} />
                <Pill text={`Takeoff ${fmtTakeoff(session.takeoffIn, units)}`} />
                <Pill text={`Standards ${fmtStandards(session.standardsIn, units)}`} />
              </Row>
            </Field>

            <Field label="PR (best cleared)"><Text style={styles.h2}>{fmtBar(calcPR([session]), units) || '—'}</Text></Field>
            {session.notes ? <Field label="Notes"><Text style={styles.pText}>{session.notes}</Text></Field> : null}
          </>
        ) : (
          <>
            <Field label="Goals"><Text style={styles.pText}>{session.goals || '—'}</Text></Field>
            <Row style={{ flexWrap: 'wrap', gap: 10 }}>
              <Pill text={`Steps ${session.steps ?? '—'}`} />
              <Pill text={`Approach ${fmtFeetIn(session.approachIn)}`} />
              <Pill text={`Takeoff ${fmtTakeoff(session.takeoffIn, units)}`} />
              <Pill text={`Standards ${fmtStandards(session.standardsIn, units)}`} />
              {session.heightIn ? <Pill text={`Bar ${fmtBar(session.heightIn, units)}`} /> : null}
            </Row>

            {/* Routine (header-aware) */}
            {Array.isArray(session.routine) && session.routine.length ? (
              <Field label="Routine">
                <View style={{ gap: 6 }}>
                  {session.routine.map((r, i) => {
                    const text = typeof r === 'string' ? r : r?.text;
                    const done = typeof r === 'string' ? false : !!r?.done;
                    const header = typeof r === 'string' ? isRoutineHeader(r) : !!r?.isHeader;

                    if (!text) return null;

                    if (header) {
                      return (
                        <Text key={i} style={{ fontWeight: '800', fontSize: 16, marginTop: 6 }}>
                          {text.replace(/:$/, '')}
                        </Text>
                      );
                    }
                    return (
                      <Text key={i} style={styles.pText}>
                        {done ? '✓' : '○'} {text}
                      </Text>
                    );
                  })}
                </View>
              </Field>
            ) : null}

            {session.notes ? <Field label="Notes"><Text style={styles.pText}>{session.notes}</Text></Field> : null}
          </>
        )}
      </Section>
    </Screen>
  );
}

// PRACTICE FORM (header-aware routine with checkboxes only for items)
function PracticeFormScreen({ navigation }) {
  const { units, athlete } = usePVStore((s) => s.settings);
  const add = usePVStore((s) => s.addSession);
  const plan = usePVStore((s) => s.weeklyPlan);

  const dayNameStr = todayName();
  const dayPlan = plan[dayNameStr] || { goals: '', routine: [] };

  const [date] = useState(new Date().toISOString());
  const [goals, setGoals] = useState(dayPlan.goals || '');

  // Steps dropdown 1–15
  const [stepsOpen, setStepsOpen] = useState(false);
  const [steps, setSteps] = useState('');

  // Approach dropdowns (ft 1–40, in 1–11)
  const [approachFeet, setApproachFeet] = useState(0);
  const [approachInches, setApproachInches] = useState(0);
  const [approachFeetOpen, setApproachFeetOpen] = useState(false);
  const [approachInchesOpen, setApproachInchesOpen] = useState(false);

  const [takeoffIn, setTakeoffIn] = useState(0);
  const [standardsIn, setStandardsIn] = useState(0);
  const [heightIn, setHeightIn] = useState(0);
  const [notes, setNotes] = useState('');
  const [email, setEmail] = useState('');

  const [cmVisible, setCmVisible] = useState(false);
  const [mVisible, setMVisible] = useState(false);

  // Build routine with header-awareness
  const initialRoutine = useMemo(
    () => (dayPlan.routine || []).map((r) => ({ text: r, done: false, isHeader: isRoutineHeader(r) })),
    [dayPlan.routine]
  );
  const [routine, setRoutine] = useState(initialRoutine);

  // Options
  const stepOptions = useMemo(
    () => Array.from({ length: 15 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) })),
    []
  );
  const approachFeetOptions = useMemo(
  () => Array.from({ length: APPROACH_MAX_FEET }, (_, i) => ({ label: `${i + 1} ft`, value: i + 1 })),
    []
  );
  const approachInchesOptions = useMemo(
    () => Array.from({ length: 11 }, (_, i) => ({ label: `${i + 1} in`, value: i + 1 })),
    []
  );
  const cmOptions = useMemo(() => {
    const arr = [];
    for (let cm = 45; cm <= 80; cm++) arr.push({ label: `${cm} cm`, value: cmToInches(cm), valueRaw: cm });
    return arr;
  }, []);
  const mOptions = useMemo(() => {
    const arr = [];
    for (let i = 152; i <= 609.6; i += 1) {
      const m = i / 100;
      arr.push({ label: `${m.toFixed(2).replace(/\.?0+$/,'')} m`, value: metersToInches(m), valueRaw: m });
    }
    return arr;
  }, []);

  const toggleCheck = (idx) =>
    setRoutine((list) =>
      list.map((item, i) => (i === idx && !item.isHeader ? { ...item, done: !item.done } : item))
    );

  const resetChecks = () =>
    setRoutine((list) => list.map((item) => (item.isHeader ? item : { ...item, done: false })));

  const save = () => {
    const approachIn = toInches({ feet: Number(approachFeet || 0), inches: Number(approachInches || 0) });
    const sess = {
      id: shortId(),
      type: 'practice',
      date,
      dayName: dayNameStr,
      goals,
      steps: steps ? Number(steps) : undefined,
      approachIn,
      takeoffIn: Number(takeoffIn) || 0,
      standardsIn: Number(standardsIn) || 0,
      heightIn: Number(heightIn) || 0,
      notes,
      routine: routine.map(({ text, done, isHeader }) => ({ text, done: !!done, isHeader: !!isHeader })),
    };
    add(sess);
    Alert.alert('Saved', 'Practice session saved.');
    navigation.goBack();
  };

  const emailSummary = async () => {
    const to = (email || '').trim();
    if (!to) { Alert.alert('Add an email', 'Enter an email address to send the results.'); return; }
    const name = fullName(athlete);
    const approachIn = toInches({ feet: Number(approachFeet || 0), inches: Number(approachInches || 0) });

    const routineLines = routine.map((item) =>
      item.isHeader ? item.text : `${item.done ? '[x]' : '[ ]'} ${item.text}`
    );

    const lines = [
      `Pole Vault – PRACTICE (${new Date(date).toLocaleDateString()})`,
      name ? `Athlete: ${name}${athlete.year ? ` (Year ${athlete.year})` : ''} – ${levelLabel(athlete.level)}` : '',
      '',
      `Day: ${dayNameStr}`,
      goals ? `Goals:\n${goals}\n` : '',
      'Routine:',
      ...routineLines,
      '',
      `Steps: ${steps || '—'}`,
      `Approach: ${fmtFeetIn(approachIn)}`,
      `Takeoff: ${fmtTakeoff(takeoffIn, units)}`,
      `Standards: ${fmtStandards(standardsIn, units)}`,
      heightIn ? `Bar: ${fmtBar(heightIn, units)}` : '',
      notes ? `\nNotes:\n${notes}\n` : '',
      '--',
      'Sent from PoleVault Tracker',
    ];

    const subject = encodeURIComponent(`Practice – ${name || 'Athlete'} ${new Date(date).toLocaleDateString()}`);
    const body = encodeURIComponent(lines.filter(Boolean).join('\n'));
    const url = `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert('No mail app available', 'Could not open your email client.');
    } catch {
      Alert.alert('Error', 'Could not open your email client.');
    }
  };

  const StandardsChooser = units === 'metric'
    ? (
      <>
        <SimpleDropdown
          label="Select standards (cm)"
          valueLabel={standardsIn ? fmtStandards(standardsIn, 'metric') : 'Select standards (cm)'}
          onPress={() => setCmVisible(true)}
        />
        <DropdownModal
          visible={cmVisible}
          title="Standards (cm)"
          options={cmOptions}
          onSelect={(opt) => setStandardsIn(opt.value)}
          onClose={() => setCmVisible(false)}
        />
      </>
    )
    : <UnitAwareHeightInput units={units} valueInches={standardsIn} onChangeInches={setStandardsIn} />;

  const BarChooser = units === 'metric'
    ? (
      <>
        <SimpleDropdown
          label="Select bar height (m)"
          valueLabel={heightIn ? fmtBar(heightIn, 'metric') : 'Select bar height (m)'}
          onPress={() => setMVisible(true)}
        />
        <DropdownModal
          visible={mVisible}
          title="Bar height (m)"
          options={mOptions}
          onSelect={(opt) => setHeightIn(opt.value)}
          onClose={() => setMVisible(false)}
        />
      </>
    )
    : <UnitAwareHeightInput units={units} valueInches={heightIn} onChangeInches={setHeightIn} />;

  return (
    <Screen>
      <Section title="New Practice">
        <Field label="Goals for today">
          <TextInput value={goals} onChangeText={setGoals} placeholder="e.g., hit 12' mid, tall at takeoff" style={styles.input} />
        </Field>

        {/* Header-aware routine list */}
        <Field label="Today's routine (tap to check)">
          {routine.length ? (
            <View style={{ gap: 8 }}>
              {routine.map((item, idx) =>
                item.isHeader ? (
                  <Text key={idx} style={{ fontWeight: '800', fontSize: 16, marginTop: 6 }}>
                    {item.text.replace(/:$/, '')}
                  </Text>
                ) : (
                  <CheckboxChip
                    key={idx}
                    checked={!!item.done}
                    label={item.text}
                    onToggle={() => toggleCheck(idx)}
                  />
                )
              )}
              <Row style={{ justifyContent: 'flex-end', marginTop: 4 }}>
                <ButtonSecondary title="Reset Checks" onPress={resetChecks} />
              </Row>
            </View>
          ) : (
            <Text style={styles.muted}>No routine items for today.</Text>
          )}
        </Field>

        {/* Steps dropdown 1–15 */}
        <Field label="Steps">
          <SimpleDropdown
            label="Select steps"
            valueLabel={steps ? `${steps}` : 'Select steps'}
            onPress={() => setStepsOpen(true)}
          />
          <DropdownModal
            visible={stepsOpen}
            title="Steps"
            options={stepOptions}
            onSelect={(opt) => setSteps(opt.value)}
            onClose={() => setStepsOpen(false)}
          />
        </Field>

        {/* Approach feet/inches dropdowns */}
        <Field label="Approach">
          <Row style={{ gap: 8 }}>
            <View style={{ flex: 1 }}>
              <SimpleDropdown
                label="Feet"
                valueLabel={approachFeet ? `${approachFeet} ft` : 'Feet'}
                onPress={() => setApproachFeetOpen(true)}
              />
              <DropdownModal
                visible={approachFeetOpen}
                title="Feet"
                options={approachFeetOptions}
                onSelect={(opt) => setApproachFeet(opt.value)}
                onClose={() => setApproachFeetOpen(false)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <SimpleDropdown
                label="Inches"
                valueLabel={approachInches ? `${approachInches} in` : 'Inches'}
                onPress={() => setApproachInchesOpen(true)}
              />
              <DropdownModal
                visible={approachInchesOpen}
                title="Inches"
                options={approachInchesOptions}
                onSelect={(opt) => setApproachInches(opt.value)}
                onClose={() => setApproachInchesOpen(false)}
              />
            </View>
          </Row>
        </Field>

        <Field label={`Takeoff mark (${units === 'metric' ? 'cm' : 'ft/in'})`}>
          <UnitAwareHeightInput units={units} valueInches={takeoffIn} onChangeInches={setTakeoffIn} />
        </Field>

        <Field label={`Standards setting (${units === 'metric' ? 'cm' : 'ft/in'})`}>
          {StandardsChooser}
        </Field>

        <Field label={`Bar height (optional) (${units === 'metric' ? 'm' : 'ft/in'})`}>
          {BarChooser}
        </Field>

        <Field label="Notes">
          <TextInput value={notes} onChangeText={setNotes} placeholder="session notes…" style={[styles.input, { height: 90 }]} multiline />
        </Field>

        <Row style={{ gap: 8, marginTop: 8 }}>
          <TextInput value={email} onChangeText={setEmail} placeholder="coach@example.com" autoCapitalize="none" keyboardType="email-address" style={[styles.input, { flex: 1 }]} />
          <ButtonSecondary title="Email" onPress={emailSummary} />
        </Row>

        <View style={{ height: 10 }} />
        <ButtonPrimary title="Save Practice" onPress={save} />
      </Section>
    </Screen>
  );
}

// MEET FORM
function MeetFormScreen({ navigation }) {
  const { units, athlete } = usePVStore((s) => s.settings);
  const add = usePVStore((s) => s.addSession);

  const [date] = useState(new Date().toISOString());
  const [meetName, setMeetName] = useState('');
  const [goals, setGoals] = useState('');
  const [attempts, setAttempts] = useState([]); // {id,heightIn,result}
  const [notes, setNotes] = useState('');
  const [email, setEmail] = useState('');

  // Steps dropdown 1–15
  const [stepsOpen, setStepsOpen] = useState(false);
  const [steps, setSteps] = useState('');

  // Approach dropdowns (ft 1–40, in 1–11)
  const [approachFeet, setApproachFeet] = useState(0);
  const [approachInches, setApproachInches] = useState(0);
  const [approachFeetOpen, setApproachFeetOpen] = useState(false);
  const [approachInchesOpen, setApproachInchesOpen] = useState(false);

  const [takeoffIn, setTakeoffIn] = useState(0);
  const [standardsIn, setStandardsIn] = useState(0);

  const [cmVisible, setCmVisible] = useState(false);
  const [mVisible, setMVisible] = useState(false);

  const stepOptions = useMemo(
    () => Array.from({ length: 15 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) })),
    []
  );
  const approachFeetOptions = useMemo(
  () => Array.from({ length: APPROACH_MAX_FEET }, (_, i) => ({ label: `${i + 1} ft`, value: i + 1 })),
    []
  );
  const approachInchesOptions = useMemo(
    () => Array.from({ length: 11 }, (_, i) => ({ label: `${i + 1} in`, value: i + 1 })),
    []
  );
  const cmOptions = useMemo(() => {
    const arr = [];
    for (let cm = 45; cm <= 80; cm++) arr.push({ label: `${cm} cm`, value: cmToInches(cm), valueRaw: cm });
    return arr;
  }, []);
  const mOptions = useMemo(() => {
    const arr = [];
    for (let i = 152; i <= 609.6; i += 1) {
      const m = i / 100;
      arr.push({ label: `${m.toFixed(2).replace(/\.?0+$/,'')} m`, value: metersToInches(m), valueRaw: m });
    }
    return arr;
  }, []);

  const addAttempt = () => setAttempts((a) => [...a, { id: shortId(), heightIn: 0, result: 'miss' }]);
  const updateAttempt = (id, patch) => setAttempts((arr) => arr.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeAttempt = (id) => setAttempts((arr) => arr.filter((x) => x.id !== id));

  const save = () => {
    const approachIn = toInches({ feet: Number(approachFeet || 0), inches: Number(approachInches || 0) });
    const sess = {
      id: shortId(),
      type: 'meet',
      date,
      meetName: meetName?.trim() || undefined,
      goals,
      attempts: attempts.map(({ id, ...rest }) => rest),
      notes,
      steps: steps ? Number(steps) : undefined,
      approachIn,
      takeoffIn: Number(takeoffIn) || 0,
      standardsIn: Number(standardsIn) || 0,
    };
    add(sess);
    Alert.alert('Saved', 'Meet saved.');
    navigation.goBack();
  };

  const emailSummary = async () => {
    const to = (email || '').trim();
    if (!to) { Alert.alert('Add an email', 'Enter an email address to send the results.'); return; }
    const name = fullName(athlete);
    const pr = fmtBar(calcPR([{ type: 'meet', attempts: attempts.map(({ id, ...rest }) => rest) }]), units);
    const approachIn = toInches({ feet: Number(approachFeet || 0), inches: Number(approachInches || 0) });
    const lines = [
      `Pole Vault – MEET (${new Date(date).toLocaleDateString()})`,
      name ? `Athlete: ${name}${athlete.year ? ` (Year ${athlete.year})` : ''} – ${levelLabel(athlete.level)}` : '',
      meetName ? `Meet: ${meetName}` : '',
      '',
      goals ? `Goals:\n${goals}\n` : '',
      'Attempts:',
      ...(attempts.length
        ? attempts.map((a, i) => `  ${i + 1}. ${fmtBar(a.heightIn, units)}  ${a.result === 'clear' ? 'O' : 'X'}`)
        : ['  (none)']),
      '',
      `PR (today): ${pr || '—'}`,
      '',
      'Setup used:',
      `Steps: ${steps || '—'}`,
      `Approach: ${fmtFeetIn(approachIn)}`,
      `Takeoff: ${fmtTakeoff(takeoffIn, units)}`,
      `Standards: ${fmtStandards(standardsIn, units)}`,
      notes ? `\nNotes:\n${notes}\n` : '',
      '--',
      'Sent from PoleVault Tracker',
    ];
    const subject = encodeURIComponent(`Meet – ${name || 'Athlete'} ${new Date(date).toLocaleDateString()}`);
    const body = encodeURIComponent(lines.filter(Boolean).join('\n'));
    const url = `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert('No mail app available', 'Could not open your email client.');
    } catch {
      Alert.alert('Error', 'Could not open your email client.');
    }
  };

  const StandardsChooser = units === 'metric'
    ? (
      <>
        <SimpleDropdown
          label="Select standards (cm)"
          valueLabel={standardsIn ? fmtStandards(standardsIn, 'metric') : 'Select standards (cm)'}
          onPress={() => setCmVisible(true)}
        />
        <DropdownModal
          visible={cmVisible}
          title="Standards (cm)"
          options={cmOptions}
          onSelect={(opt) => setStandardsIn(opt.value)}
          onClose={() => setCmVisible(false)}
        />
      </>
    )
    : <UnitAwareHeightInput units={units} valueInches={standardsIn} onChangeInches={setStandardsIn} />;

  const BarChooser = units === 'metric'
    ? (
      <>
        <SimpleDropdown
          label="Add attempt height (m)"
          valueLabel={'Add attempt height (m)'}
          onPress={() => setMVisible(true)}
        />
        <DropdownModal
          visible={mVisible}
          title="Set attempt height (m)"
          options={mOptions}
          onSelect={(opt) => {
            setAttempts((arr) => [...arr, { id: shortId(), heightIn: opt.value, result: 'miss' }]);
          }}
          onClose={() => setMVisible(false)}
        />
      </>
    )
    : null;

  return (
    <Screen>
      <Section title="New Meet">
        <Field label="Meet name"><TextInput value={meetName} onChangeText={setMeetName} placeholder="e.g., Conference Finals" style={styles.input} /></Field>
        <Field label="Goals"><TextInput value={goals} onChangeText={setGoals} placeholder="e.g., open @ 11'6, PR attempt 12'6" style={styles.input} /></Field>

        <Field label="Attempts">
          <View style={{ gap: 10 }}>
            {units === 'metric' ? (
              <View>
                <Text style={[styles.muted, { marginBottom: 8 }]}>Use the selector below to add heights in meters.</Text>
                {BarChooser}
              </View>
            ) : null}

            {attempts.map((a) => (
              <View key={a.id} style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Height</Text>
                  {units === 'metric' ? (
                    <Text style={styles.pText}>{fmtBar(a.heightIn, 'metric')}</Text>
                  ) : (
                    <UnitAwareHeightInput units={units} valueInches={a.heightIn} onChangeInches={(v) => updateAttempt(a.id, { heightIn: v })} />
                  )}
                </View>
                <View style={{ width: 16 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Result</Text>
                  <Row>
                    <Pressable onPress={() => updateAttempt(a.id, { result: 'clear' })} style={[styles.choice, a.result === 'clear' && styles.choiceOn]}><Text style={[styles.choiceText, a.result === 'clear' && styles.choiceTextOn]}>Clear</Text></Pressable>
                    <Pressable onPress={() => updateAttempt(a.id, { result: 'miss' })} style={[styles.choice, a.result === 'miss' && styles.choiceOnMiss]}><Text style={[styles.choiceText, a.result === 'miss' && styles.choiceTextOn]}>Miss</Text></Pressable>
                    <Pressable onPress={() => removeAttempt(a.id)} style={[styles.choice, { backgroundColor: '#eee' }]}><Text style={[styles.choiceText, { color: '#333' }]}>Remove</Text></Pressable>
                  </Row>
                </View>
              </View>
            ))}
            <ButtonSecondary
              title={units==='metric' ? 'Add Height (m)' : 'Add Attempt'}
              onPress={() => { if (units === 'metric') setMVisible(true); else addAttempt(); }}
            />
          </View>
        </Field>

        <Section title="Setup used">
          {/* Steps dropdown 1–15 */}
          <Field label="Steps">
            <SimpleDropdown
              label="Select steps"
              valueLabel={steps ? `${steps}` : 'Select steps'}
              onPress={() => setStepsOpen(true)}
            />
            <DropdownModal
              visible={stepsOpen}
              title="Steps"
              options={stepOptions}
              onSelect={(opt) => setSteps(opt.value)}
              onClose={() => setStepsOpen(false)}
            />
          </Field>

          {/* Approach feet/inches dropdowns */}
          <Field label="Approach">
            <Row style={{ gap: 8 }}>
              <View style={{ flex: 1 }}>
                <SimpleDropdown
                  label="Feet"
                  valueLabel={approachFeet ? `${approachFeet} ft` : 'Feet'}
                  onPress={() => setApproachFeetOpen(true)}
                />
                <DropdownModal
                  visible={approachFeetOpen}
                  title="Feet"
                  options={approachFeetOptions}
                  onSelect={(opt) => setApproachFeet(opt.value)}
                  onClose={() => setApproachFeetOpen(false)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <SimpleDropdown
                  label="Inches"
                  valueLabel={approachInches ? `${approachInches} in` : 'Inches'}
                  onPress={() => setApproachInchesOpen(true)}
                />
                <DropdownModal
                  visible={approachInchesOpen}
                  title="Inches"
                  options={approachInchesOptions}
                  onSelect={(opt) => setApproachInches(opt.value)}
                  onClose={() => setApproachInchesOpen(false)}
                />
              </View>
            </Row>
          </Field>

          <Field label={`Takeoff mark (${units === 'metric' ? 'cm' : 'ft/in'})`}>
            <UnitAwareHeightInput units={units} valueInches={takeoffIn} onChangeInches={setTakeoffIn} />
          </Field>
          <Field label={`Standards setting (${units === 'metric' ? 'cm' : 'ft/in'})`}>
            {units === 'metric' ? (
              <>
                <SimpleDropdown
                  label="Select standards (cm)"
                  valueLabel={standardsIn ? fmtStandards(standardsIn, 'metric') : 'Select standards (cm)'}
                  onPress={() => setCmVisible(true)}
                />
                <DropdownModal
                  visible={cmVisible}
                  title="Standards (cm)"
                  options={cmOptions}
                  onSelect={(opt) => setStandardsIn(opt.value)}
                  onClose={() => setCmVisible(false)}
                />
              </>
            ) : (
              <UnitAwareHeightInput units={units} valueInches={standardsIn} onChangeInches={setStandardsIn} />
            )}
          </Field>
        </Section>

        <Field label="Notes"><TextInput value={notes} onChangeText={setNotes} placeholder="meet notes…" style={[styles.input, { height: 90 }]} multiline /></Field>

        <Row style={{ gap: 8, marginTop: 8 }}>
          <TextInput value={email} onChangeText={setEmail} placeholder="coach@example.com" autoCapitalize="none" keyboardType="email-address" style={[styles.input, { flex: 1 }]} />
          <ButtonSecondary title="Email" onPress={emailSummary} />
        </Row>

        <View style={{ height: 10 }} />
        <ButtonPrimary title="Save Meet" onPress={save} />
      </Section>
    </Screen>
  );
}

// PLAN: read-only (no editing, uses code-defined plan)
function PlanScreen() {
  const plan = usePVStore((s) => s.weeklyPlan);
  const [activeDay, setActiveDay] = useState(todayName());
  const entry = plan[activeDay] || { goals: '', routine: [] };

  return (
    <Screen>
      <Section title="Weekly Practice Plan (read-only)">
        <Row style={{ flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {days.map((d) => (
            <Pressable key={d} onPress={() => setActiveDay(d)} style={[styles.dayChip, activeDay === d && styles.dayChipOn]}>
              <Text style={[styles.dayChipText, activeDay === d && styles.dayChipTextOn]}>{d.slice(0, 3)}</Text>
            </Pressable>
          ))}
        </Row>
        <Field label={`${activeDay} goals`}>
          <Text style={styles.pText}>{entry.goals || '—'}</Text>
        </Field>
        <Field label={`${activeDay} routine`}>
          {entry.routine.length ? (
            <View style={{ gap: 6 }}>
              {entry.routine.map((r, i) =>
                isRoutineHeader(r) ? (
                  <Text key={i} style={{ fontWeight: '800', fontSize: 16, marginTop: 6 }}>
                    {String(r).replace(/:$/, '')}
                  </Text>
                ) : (
                  <Text key={i} style={styles.pText}>• {r}</Text>
                )
              )}
            </View>
          ) : <Text style={styles.muted}>No routine items.</Text>}
        </Field>
      </Section>
    </Screen>
  );
}

function StatsScreen() {
  const sessions = usePVStore((s) => s.sessions);
  const { units, athlete } = usePVStore((s) => s.settings);
  const name = (athlete?.firstName || '').trim();

  const prInches = useMemo(() => calcPR(sessions), [sessions]);
  const avgTakeoffIn = useMemo(() => avgOf(sessions.map((s) => s.takeoffIn).filter(Boolean)), [sessions]);
  const avgStandardsIn = useMemo(() => avgOf(sessions.map((s) => s.standardsIn).filter(Boolean)), [sessions]);
  const avgSteps = useMemo(() => avgOf(sessions.map((s) => s.steps).filter((x) => Number.isFinite(x))), [sessions]);

  return (
    <Screen>
      <Section title={name ? `${name}’s Highlights` : 'Highlights'}>
        <Field label="Personal Record (best cleared)"><Text style={styles.h2}>{prInches ? fmtBar(prInches, units) : '—'}</Text></Field>
        <Field label="Average takeoff mark"><Text style={styles.h3}>{avgTakeoffIn ? fmtTakeoff(avgTakeoffIn, units) : '—'}</Text></Field>
        <Field label="Average standards"><Text style={styles.h3}>{avgStandardsIn ? fmtStandards(avgStandardsIn, units) : '—'}</Text></Field>
        <Field label="Average steps"><Text style={styles.h3}>{avgSteps ? Number(avgSteps).toFixed(1) : '—'}</Text></Field>
      </Section>
    </Screen>
  );
}

// SETTINGS: athlete profile inputs + Level dropdown + Units
function SettingsScreen() {
  const { units, athlete } = usePVStore((s) => s.settings);
  const setUnits = usePVStore((s) => s.setUnits);
  const setAthleteField = usePVStore((s) => s.setAthleteField);

  return (
    <Screen>
      <Section title="Athlete">
        <Field label="First name">
          <TextInput
            value={athlete.firstName}
            onChangeText={(t) => setAthleteField('firstName', t)}
            placeholder="e.g., Alex"
            style={styles.input}
            autoCapitalize="words"
          />
        </Field>
        <Field label="Last name">
          <TextInput
            value={athlete.lastName}
            onChangeText={(t) => setAthleteField('lastName', t)}
            placeholder="e.g., Morgan"
            style={styles.input}
            autoCapitalize="words"
          />
        </Field>
        <Row style={{ gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Year</Text>
            <TextInput
              value={athlete.year}
              onChangeText={(t) => setAthleteField('year', t.replace(/[^0-9A-Za-z ]/g, ''))}
              placeholder="e.g., 11 or FR/SO/JR/SR"
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Level</Text>
            <Pressable
              onPress={() => Alert.alert('Select Level','',[
                { text:'High School', onPress:()=>setAthleteField('level','highschool')},
                { text:'College', onPress:()=>setAthleteField('level','college')},
                { text:'Cancel', style:'cancel'}
              ])}
              style={styles.dropdown}>
              <Text style={styles.dropdownText}>{athlete.level==='college'?'College':'High School'}</Text>
            </Pressable>
          </View>
        </Row>
      </Section>

      <Section title="Units">
        <Row>
          <Pressable onPress={() => setUnits('imperial')} style={[styles.choice, units === 'imperial' && styles.choiceOn]}>
            <Text style={[styles.choiceText, units === 'imperial' && styles.choiceTextOn]}>Imperial (ft/in)</Text>
          </Pressable>
          <Pressable onPress={() => setUnits('metric')} style={[styles.choice, units === 'metric' && styles.choiceOn]}>
            <Text style={[styles.choiceText, units === 'metric' && styles.choiceTextOn]}>Metric (cm/m)</Text>
          </Pressable>
        </Row>
        <Text style={[styles.muted, { marginTop: 6 }]}>Metric uses cm for standards & takeoff, meters for bar height.</Text>
      </Section>

      <Section title="About"><Text style={styles.pText}>PoleVault Tracker – local-only MVP. Data stays on device.</Text></Section>
    </Screen>
  );
}

// --------------- Navigation Shell ---------------
const TabNav = () => (
  <Tab.Navigator screenOptions={{ headerShown: false }}>
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Today" component={TodayScreen} />
    <Tab.Screen name="Log" component={LogScreen} />
    <Tab.Screen name="Plan" component={PlanScreen} />
    <Tab.Screen name="Stats" component={StatsScreen} />
    <Tab.Screen name="Settings" component={SettingsScreen} />
  </Tab.Navigator>
);

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="MainTabs" component={TabNav} options={{ headerShown: false }} />
        <Stack.Screen name="PracticeForm" component={PracticeFormScreen} options={{ title: 'New Practice' }} />
        <Stack.Screen name="MeetForm" component={MeetFormScreen} options={{ title: 'New Meet' }} />
        <Stack.Screen name="SessionDetails" component={SessionDetailsScreen} options={{ title: 'Session' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// -------------------- Styles --------------------
const styles = StyleSheet.create({
  // Bottom watermark logo
  bgLogo: {
    position: 'absolute',
    bottom: 1,
    left: '50%',
    width: 260,
    height: 260,
    transform: [{ translateX: -130 }],
    opacity: 0.75,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  section: { backgroundColor: '#ffffffcc', borderRadius: 14, padding: 14, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6, color: '#444' },
  pText: { fontSize: 16, color: '#222' },
  muted: { color: '#777' },
  h2: { fontSize: 28, fontWeight: '800' },
  h3: { fontSize: 20, fontWeight: '700' },
  pill: { backgroundColor: '#e9f5ff', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  btnPrimary: { backgroundColor: '#0a84ff', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  btnPrimaryText: { color: 'white', fontWeight: '800', fontSize: 16 },
  btnSecondary: { backgroundColor: '#eef0f3', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  btnSecondaryText: { color: '#111', fontWeight: '700', fontSize: 16 },
  input: { backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  inputSmall: { backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, fontSize: 16, width: 70 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  cardRow: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#eee' },
  choice: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', marginRight: 8 },
  choiceOn: { backgroundColor: '#0a84ff', borderColor: '#0a84ff' },
  choiceOnMiss: { backgroundColor: '#ffd7db', borderColor: '#ffd7db' },
  choiceText: { fontWeight: '700', color: '#333' },
  choiceTextOn: { color: '#fff' },
  dayChip: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f5f5f5' },
  dayChipOn: { backgroundColor: '#0a84ff', borderColor: '#0a84ff' },
  dayChipText: { fontWeight: '700', color: '#333' },
  dayChipTextOn: { color: 'white' },

  // checkbox chips
  checkboxChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d7d7d7',
    backgroundColor: '#fafafa',
  },
  checkboxChipOn: { backgroundColor: '#e6f2ff', borderColor: '#0a84ff' },
  checkboxText: { fontWeight: '700', color: '#333' },
  checkboxTextOn: { color: '#0a84ff' },

  // dropdown & modal
  dropdown: { backgroundColor: '#f3f4f6', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12 },
  dropdownText: { fontSize: 16, color: '#222' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14 },
  optionRow: { paddingVertical: 10 },
  optionText: { fontSize: 16, color: '#111' },
});

