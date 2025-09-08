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
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as MailComposer from 'expo-mail-composer';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import SplashScreen from './SplashScreen';
import {
  calcPR,
  fmtBar,
  fmtFeetIn,
  fmtStandards,
  fmtTakeoff,
  fullName,
  isRoutineHeader,
  sessionSummaryText
} from './yourUtils'; // adjust import as needed

// Removed duplicate styles object to fix redeclaration error

// Helper for pill style
function getAttemptPillStyle(a) {
  if (a.result === 'clear') {
    return { backgroundColor: '#0a84ff', color: '#fff' };
  }
  if (a.selected) {
    // Selected X: red background, white text, border
    return { backgroundColor: '#c22', color: '#fff', borderColor: '#a00', borderWidth: 2 };
  }
  // Default X
  return { backgroundColor: '#ffd7db', color: '#c22' };
}

function SessionDetailsScreen({ route, navigation }) {
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

  // --- Place the helper here ---
  function getAttemptPillStyle(a) {
    if (a.result === 'clear') {
      return { backgroundColor: '#0a84ff', color: '#fff' };
    }
    if (a.selected) {
      // Selected X: red background, white text, optional border
      return { backgroundColor: '#c22', color: '#fff', borderColor: '#a00', borderWidth: 2 };
    }
    // Default X
    return { backgroundColor: '#ffd7db', color: '#c22' };
  }

  // ----- YOUR RETURN STATEMENT; JSX content -----
  return (
    <Screen>
      <Section
        title={`${name ? `${name} – ` : ''}${session.type === 'meet' ? 'Meet' : 'Practice'} – ${new Date(session.date).toLocaleDateString()}`}
      >
        {/* Your session details go here */}
        <Text>Session Details</Text>
      </Section>
      <Row style={{ justifyContent: 'flex-end', marginBottom: 30 }}>
        <ButtonPrimary title="Share" onPress={handleShare} />
      </Row>
    </Screen>
  );
}

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
  planOverridden: false, // NEW: tracks if plan is overridden
  watermarkUri: '', // <-- NEW
};

const usePVStore = create(
  persist(
    (set, get) => ({
      settings: initialSettings,
      weeklyPlan: defaultWeeklyPlan,   // always from code unless overridden
      sessions: [],
      setUnits: (units) => set((s) => ({ settings: { ...s.settings, units } })),
      setAthleteField: (key, value) =>
        set((s) => ({ settings: { ...s.settings, athlete: { ...s.settings.athlete, [key]: value } } })),
      addSession: (session) => set((s) => ({ sessions: [session, ...s.sessions] })),
      updateSession: (id, patch) =>
        set((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      deleteSession: (id) => set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) })),
      // NEW: Set weekly plan from file
      setWeeklyPlan: (plan) => set((s) => ({
        weeklyPlan: plan,
        settings: { ...s.settings, planOverridden: true },
      })),
      resetWeeklyPlan: () => set((s) => ({
        weeklyPlan: defaultWeeklyPlan,
        settings: { ...s.settings, planOverridden: false },    
      })),
      setWatermarkUri: (uri) =>
        set((s) => ({ settings: { ...s.settings, watermarkUri: uri }
      })),
    }),
    {
      name: 'polevault-tracker-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: 13, // bump version
      migrate: async (persisted) => {
        const state = typeof persisted === 'object' && persisted ? { ...persisted } : {};
        if (!state.settings) state.settings = initialSettings;
        if (!state.settings.athlete) state.settings.athlete = initialSettings.athlete;
        if (!Array.isArray(state.sessions)) state.sessions = [];
        if (!state.weeklyPlan) state.weeklyPlan = defaultWeeklyPlan;
        if (typeof state.settings.planOverridden !== 'boolean') state.settings.planOverridden = false;
        return state;
      },
      partialize: (state) => ({
        settings: state.settings,
        sessions: state.sessions,
        weeklyPlan: state.weeklyPlan,
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

const ButtonPrimary = ({ title, onPress, style }) => (
  <Pressable onPress={onPress} style={[styles.btnPrimary, style]}>
    <Text style={styles.btnPrimaryText}>{title}</Text>
  </Pressable>
);
const ButtonSecondary = ({ title, onPress, style }) => (
  <Pressable onPress={onPress} style={[styles.btnSecondary, style]}>
    <Text style={styles.btnSecondaryText}>{title}</Text>
  </Pressable>
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
  const watermarkUri = usePVStore((s) => s.settings.watermarkUri);
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <Image
          source={watermarkUri ? { uri: watermarkUri } : require('./assets/sau-logo.png')}
          style={styles.bgLogo}
          resizeMode="contain"
        />
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
      // Each 'attempts' entry is a height block: {heightIn, attempts: [...]}
      for (const heightBlock of s.attempts) {
        if (
          typeof heightBlock.heightIn === 'number' &&
          Array.isArray(heightBlock.attempts) &&
          heightBlock.attempts.some(a => a.result === 'clear')
        ) {
          best = Math.max(best, Number(heightBlock.heightIn) || 0);
        }
      }
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
  
  let basics = '';
  if (session.type === 'meet' && session.meetName) basics += `Meet: ${session.meetName}\n`;
  if (session.goals) basics += `Goals:\n${session.goals}\n`;

  // Setup block
  let setup = '';
  setup += `Steps: ${session.steps ?? '—'}\n`;
  setup += `Approach: ${fmtFeetIn(session.approachIn)}\n`;
  setup += `Takeoff: ${fmtTakeoff(session.takeoffIn, units)}\n`;
  setup += `Standards: ${fmtStandards(session.standardsIn, units)}\n`;
  if (session.heightIn) setup += `Bar: ${fmtBar(session.heightIn, units)}\n`;

  let middle = '';
  if (session.type === 'meet') {
    // PATCHED LOGIC:
    const attempts = (session.attempts || []).map((heightBlock, i) => {
      const clearIdx = (heightBlock.attempts || []).findIndex(a => a.result === 'clear');
      const shownAttempts = (heightBlock.attempts || []).slice(0, clearIdx === -1 ? undefined : clearIdx + 1);
      const attemptStr = shownAttempts.map(a => (a.result === 'clear' ? 'O' : 'X')).join(' ');
      return `  ${i + 1}. ${fmtBar(heightBlock.heightIn, units)}   ${attemptStr}`;
    });
    const prToday = fmtBar(calcPR([session]), units) || '—';
    middle = `Attempts:\n${attempts.length ? attempts.join('\n') : '(none)'}\n\nPR (today): ${prToday}`;
  } else if (Array.isArray(session.routine) && session.routine.length) {
    const r = session.routine.map((item) => {
      if (typeof item === 'string') {
        return isRoutineHeader(item) ? `* ${item.replace(/:$/, '')}` : `- ${item}`;
      }
      return item.isHeader ? `* ${item.text}` : `${item.done ? '[x]' : '[ ]'} ${item.text}`;
    }).join('\n');
    middle = `Routine:\n${r}`;
  }

  const notes = session.notes ? `Notes:\n${session.notes}` : '';

  // Compose email with line breaks
  return [
    header,
    athleteLine,
    basics.trim(),
    middle,
    setup.trim(),
    notes,
    '--\nSent from PoleVault Tracker'
  ].filter(Boolean).join('\n\n');
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
        <ButtonPrimary title="Log Meet" onPress={() => navigation.navigate('MeetForm')} />
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
        <ButtonPrimary title="Log Meet" onPress={() => navigation.navigate('MeetForm')} />
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
    {/* --- BEGIN PATCHED ATTEMPTS RENDERING --- */}
    {s.type === 'practice' ? (
      <>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
          <Pill text={`Steps ${s.steps ?? '—'}`} />
          <Pill text={`Approach ${fmtFeetIn(s.approachIn)}`} />
          <Pill text={`Takeoff ${fmtTakeoff(s.takeoffIn, 'imperial')}`} />
          <Pill text={`Standards ${fmtStandards(s.standardsIn, units)}`} />
          {s.heightIn ? <Pill text={`Bar ${fmtBar(s.heightIn, units)}`} /> : null}
        </Row>
        {/* PATCH: Show attempted heights for practice */}
        {Array.isArray(s.heights) && s.heights.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.fieldLabel}>Attempted Heights:</Text>
            {s.heights.map((h, i) => (
              <Row key={h.id || i} style={{ alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <Pill text={fmtBar(h.heightIn, units)} />
                {Array.isArray(h.attempts) && h.attempts.length > 0 && (
                  <Row style={{ gap: 4 }}>
                    {h.attempts.slice(0, h.attempts.findIndex(a => a.result === 'clear') === -1 ? undefined : h.attempts.findIndex(a => a.result === 'clear') + 1).map((a, idx) => (
                      <Pill
                        key={idx}
                        text={a.result === 'clear' ? 'O' : 'X'}
                        style={a.result === 'clear'
                          ? { backgroundColor: '#0a84ff', color: '#fff' }
                          : { backgroundColor: '#ffd7db', color: '#c22' }
                        }
                      />
                    ))}
                  </Row>
                )}
              </Row>
            ))}
          </View>
        )}
      </>
    ) : (
      <View style={{ marginTop: 6 }}>
        {(s.attempts || []).map((heightBlock, i) => {
          // Find index of first clear attempt ("O")
          const clearIdx = (heightBlock.attempts || []).findIndex(a => a.result === 'clear');
          // Only show misses up to and including the clear attempt if present
          const shownAttempts = (heightBlock.attempts || []).slice(0, clearIdx === -1 ? undefined : clearIdx + 1);
          return (
            <Row key={i} style={{ flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
              <Pill text={fmtBar(heightBlock.heightIn, units)} />
              {shownAttempts.map((a, idx) =>
                <Pill
                  key={idx}
                  text={a.result === 'clear' ? 'O' : 'X'}
                  style={a.result === 'clear'
                    ? { backgroundColor: '#0a84ff', color: '#fff' }
                    : { backgroundColor: '#ffd7db', color: '#c22' }
                  }
                />
              )}
            </Row>
          );
        })}
        <Row style={{ flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          <Pill text={`PR ${fmtBar(calcPR([s]), units) || '—'}`} />
        </Row>
      </View>
    )}
    {/* --- END PATCHED ATTEMPTS RENDERING --- */}
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
        <ButtonPrimary title="Log Meet" onPress={() => navigation.navigate('MeetForm')} />
      </Row>
    </Screen>
  );
}

// --- PATCHED: Practice session details show attempted heights ---
function SessionDetailsScreen({ route, navigation }) {
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
      {Array.isArray(session.heights) && session.heights.length > 0 && (
        <Field label="Attempted Heights">
          <View style={{ gap: 6 }}>
            {session.heights.map((h, i) => (
              <Row key={h.id || i} style={{ alignItems: 'center', gap: 8 }}>
                <Pill text={fmtBar(h.heightIn, units)} />
                {Array.isArray(h.attempts) && h.attempts.length > 0 && (
                  <Row style={{ gap: 4 }}>
                    {h.attempts
                      .slice(
                        0,
                        h.attempts.findIndex(a => a.result === 'clear') === -1
                          ? undefined
                          : h.attempts.findIndex(a => a.result === 'clear') + 1
                      )
                      .map((a, idx) => (
                        <Pill
                          key={idx}
                          text={a.result === 'clear' ? 'O' : 'X'}
                          style={getAttemptPillStyle(a)}
                        />
                      ))}
                  </Row>
                )}
              </Row>
            ))}
          </View>
        </Field>
      )}
      <Section
        title={`${name ? `${name} – ` : ''}${session.type === 'meet' ? 'Meet' : 'Practice'} – ${new Date(session.date).toLocaleDateString()}`}
      >
        {session.type === 'meet' ? (
          <>
            {session.meetName ? <Field label="Meet"><Text style={styles.pText}>{session.meetName}</Text></Field> : null}
            <Field label="Goals"><Text style={styles.pText}>{session.goals || '—'}</Text></Field>
            <Field label="Attempts">
              {session.attempts?.length ? (
                <View style={{ gap: 10 }}>
                  {session.attempts.map((attemptBlock, i) => {
                    const clearIdx = (attemptBlock.attempts || []).findIndex(a => a.result === 'clear');
                    const shownAttempts = (attemptBlock.attempts || []).slice(0, clearIdx === -1 ? undefined : clearIdx + 1);
                    return (
                      <View key={i} style={{ marginBottom: 10 }}>
                        <Text style={styles.fieldLabel}>Bar: {fmtBar(attemptBlock.heightIn, units)}</Text>
                        <Row style={{ gap: 14 }}>
                          {shownAttempts.map((a, idx) => (
                            <Pill
                              key={idx}
                              text={a.result === 'clear' ? 'O' : 'X'}
                              style={getAttemptPillStyle(a)}
                            />
                          ))}
                        </Row>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.muted}>No attempts logged.</Text>
              )}
            </Field>
            <Field label="Setup used">
              <Row style={{ flexWrap: 'wrap', gap: 10 }}>
                <Pill text={`Steps ${session.steps ?? '—'}`} />
                <Pill text={`Approach ${fmtFeetIn(session.approachIn)}`} />
                <Pill text={`Takeoff ${fmtTakeoff(session.takeoffIn, 'imperial')}`} />
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
            {Array.isArray(session.heights) && session.heights.length > 0 && (
              <Field label="Attempted Heights">
                <View style={{ gap: 6 }}>
                  {session.heights.map((h, i) => (
                    <Row key={h.id || i} style={{ alignItems: 'center', gap: 8 }}>
                      <Pill text={fmtBar(h.heightIn, units)} />
                      {Array.isArray(h.attempts) && h.attempts.length > 0 && (
                        <Row style={{ gap: 4 }}>
                          {h.attempts.slice(0, h.attempts.findIndex(a => a.result === 'clear') === -1 ? undefined : h.attempts.findIndex(a => a.result === 'clear') + 1).map((a, idx) => (
                            <Pill
                              key={idx}
                              text={a.result === 'clear' ? 'O' : 'X'}
                              style={getAttemptPillStyle(a)}
                            />
                          ))}
                        </Row>
                      )}
                    </Row>
                  ))}
                </View>
              </Field>
            )}
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
      {/* PATCH: Blue Share button at page bottom */}
      <View style={{ height: 20 }} />
      <Row style={{ justifyContent: 'flex-end', marginBottom: 30 }}>
        <ButtonPrimary title="Share" onPress={handleShare} />
      </Row>
    </Screen>
  );
}

function PracticeFormScreen({ navigation }) {
  const { units, athlete } = usePVStore((s) => s.settings);
  const add = usePVStore((s) => s.addSession);
  const plan = usePVStore((s) => s.weeklyPlan);

  const dayNameStr = todayName();
  const dayPlan = plan[dayNameStr] || { goals: '', routine: [] };

  const [date] = useState(new Date().toISOString());
  const [goals, setGoals] = useState(dayPlan.goals || '');
  const allSessions = usePVStore((s) => s.sessions);
  const [attemptTypeDropdownOpen, setAttemptTypeDropdownOpen] = useState({});

  // Gather all poles from all sessions
  const previousPoles = useMemo(() => {
    const polesArr = [];
    (allSessions || []).forEach(sess => {
      if (Array.isArray(sess.poles)) {
        sess.poles.forEach(p => {
          const key = `${p.length || ''}|${p.flex || ''}|${p.weight || ''}`;
          polesArr.push({ ...p, _key: key });
        });
      }
    });
    const seen = new Set();
    const deduped = [];
    for (const p of polesArr) {
      if (p._key && !seen.has(p._key)) {
        deduped.push(p);
        seen.add(p._key);
      }
    }
    return deduped;
  }, [allSessions]);

  // Steps dropdown
  const [stepsOpen, setStepsOpen] = useState(false);
  const [steps, setSteps] = useState('');

  // Approach dropdowns
  const [approachFeet, setApproachFeet] = useState(0);
  const [approachInches, setApproachInches] = useState(0);
  const [approachFeetOpen, setApproachFeetOpen] = useState(false);
  const [approachInchesOpen, setApproachInchesOpen] = useState(false);

  // Takeoff mark dropdown state
  const [takeoffModalOpen, setTakeoffModalOpen] = useState(false);
  const [takeoffIn, setTakeoffIn] = useState(0);

  // Standards dropdown state
  const [standardsModalOpen, setStandardsModalOpen] = useState(false);
  const [standardsIn, setStandardsIn] = useState(0);

  // Heights & attempts (like meet form)
  const [heights, setHeights] = useState([]);
  const [addHeightFt, setAddHeightFt] = useState('');
  const [addHeightIn, setAddHeightIn] = useState('');
  const [addHeightM, setAddHeightM] = useState('');
  const [ftModalOpen, setFtModalOpen] = useState(false);
  const [inModalOpen, setInModalOpen] = useState(false);
  const [mModalOpen, setMModalOpen] = useState(false);

  // Notes/email
  const [notes, setNotes] = useState('');
  const [email, setEmail] = useState('');
  const settings = usePVStore((s) => s.settings);

  // Routine logic
  const initialRoutine = useMemo(
    () => (dayPlan.routine || []).map((r) => ({ text: r, done: false, isHeader: isRoutineHeader(r) })),
    [dayPlan.routine]
  );
  const [routine, setRoutine] = useState(initialRoutine);

  // Dropdown options
  const APPROACH_MAX_FEET = 150;
  const stepOptions = useMemo(() => Array.from({ length: 15 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) })), []);
  const approachFeetOptions = useMemo(() => Array.from({ length: APPROACH_MAX_FEET }, (_, i) => ({ label: `${i + 1} ft`, value: i + 1 })), []);
  const approachInchesOptions = useMemo(() => Array.from({ length: 11 }, (_, i) => ({ label: `${i + 1} in`, value: i + 1 })), []);
  const mOptions = useMemo(() => {
    const arr = [];
    for (let i = 152; i <= 609.6; i += 1) {
      const m = i / 100;
      arr.push({ label: `${m.toFixed(2).replace(/\.?0+$/,'')} m`, value: metersToInches(m), valueRaw: m });
    }
    return arr;
  }, []);
  const takeoffFtOptions = useMemo(() => Array.from({ length: ((15 - 2) / 0.25) + 1 }, (_, i) => {
    const ft = 2 + i * 0.25;
    return { label: `${ft.toFixed(2)} ft`, value: Math.round(ft * 12) };
  }), []);
  const takeoffCmOptions = useMemo(() => Array.from({ length: (85 - 40) + 1 }, (_, i) => {
    const cm = 40 + i;
    return { label: `${cm} cm`, value: (cm / 2.54) };
  }), []);
  const standardsInOptions = useMemo(() => Array.from({ length: ((31.5 - 18) / 0.5) + 1 }, (_, i) => {
    const val = 18 + i * 0.5;
    return { label: `${val}"`, value: val };
  }), []);
  const standardsCmOptions = useMemo(() => Array.from({ length: (85 - 40) + 1 }, (_, i) => {
    const cm = 40 + i;
    return { label: `${cm} cm`, value: (cm / 2.54) };
  }), []);
  const ftOptions = useMemo(() => Array.from({ length: 25 }, (_, i) => ({ label: `${i + 1} ft`, value: i + 1 })), []);
  const inOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ label: `${i} in`, value: i })), []);

  // Poles logic
  const [poles, setPoles] = useState([]);
  const [poleModalOpen, setPoleModalOpen] = useState(false);
  const [poleLength, setPoleLength] = useState('');
  const [poleFlex, setPoleFlex] = useState('');
  const [poleWeight, setPoleWeight] = useState('');
  const [editPoleIdx, setEditPoleIdx] = useState(null);
  const [addHeightPoleIdx, setAddHeightPoleIdx] = useState(null);
  const [poleSelectModalOpen, setPoleSelectModalOpen] = useState(false);

  // Heights & attempts logic (with poleIdx)
  const handleAddHeightImperial = () => {
    const ft = Number(addHeightFt);
    const inch = Number(addHeightIn);
    if ((!ft && !inch) || isNaN(ft) || isNaN(inch)) return Alert.alert('Select a valid height');
    if (addHeightPoleIdx === null) return Alert.alert('Select a pole for this height');
    const totalIn = ft * 12 + inch;
    setHeights((arr) => [
      ...arr,
      {
        id: shortId(),
        heightIn: totalIn,
        attempts: [
          { result: 'miss', idx: 1, type: 'bar' },
          { result: 'miss', idx: 2, type: 'bar' },
          { result: 'miss', idx: 3, type: 'bar' }
        ],
        poleIdx: addHeightPoleIdx
      }
    ]);
    setAddHeightFt('');
    setAddHeightIn('');
    setAddHeightPoleIdx(null);
  };
  const handleAddHeightMetric = () => {
    const m = Number(addHeightM);
    if (!m || isNaN(m)) return Alert.alert('Select a valid height');
    if (addHeightPoleIdx === null) return Alert.alert('Select a pole for this height');
    setHeights((arr) => [
      ...arr,
      {
        id: shortId(),
        heightIn: m * 39.3701, // meters to inches
        attempts: [
          { result: 'miss', idx: 1, type: 'bar' },
          { result: 'miss', idx: 2, type: 'bar' },
          { result: 'miss', idx: 3, type: 'bar' }
        ],
        poleIdx: addHeightPoleIdx
      }
    ]);
    setAddHeightM('');
    setAddHeightPoleIdx(null);
  };


  const updateAttemptResult = (heightId, attemptIdx, result) => {
    setHeights((arr) =>
      arr.map((height) => {
        if (height.id !== heightId) return height;
        if (result === 'clear') {
          return {
            ...height,
            attempts: height.attempts.map((a) =>
              a.idx === attemptIdx ? { ...a, result: 'clear' } : a
            ),
            completed: true
          };
        } else {
          if (height.attempts.some(a => a.result === 'clear')) return height;
          return {
            ...height,
            attempts: height.attempts.map((a) =>
              a.idx === attemptIdx ? { ...a, result: 'miss' } : a
            )
          };
        }
      })
    );
  };

  const removeHeight = (heightId) => setHeights((arr) => arr.filter((h) => h.id !== heightId));
  const toggleCheck = (idx) =>
    setRoutine((list) =>
      list.map((item, i) => (i === idx && !item.isHeader ? { ...item, done: !item.done } : item))
    );
  const resetChecks = () =>
    setRoutine((list) => list.map((item) => item.isHeader ? item : { ...item, done: false }));

  const calcPR = (sessions) => {
    let best = 0;
    for (const s of sessions || []) {
      if (s.type === 'meet' && Array.isArray(s.attempts)) {
        for (const a of s.attempts) { if (a.result === 'clear') best = Math.max(best, Number(a.heightIn) || 0); }
      }
    }
    return best || 0;
  };

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
      poles,
      heights,
      notes,
      routine: routine.map(({ text, done, isHeader }) => ({ text, done: !!done, isHeader: !!isHeader })),
    };
    const allSessions = usePVStore.getState().sessions;
    const formerPR = calcPR(allSessions);
    const highestPractice = Math.max(...(sess.heights || []).map(h =>
      h.attempts.some(a => a.result === 'clear') ? h.heightIn : 0
    ), 0);

    let alertMsg = `Highest cleared this practice: ${fmtBar(highestPractice, units)}\nFormer PR: ${fmtBar(formerPR, units)}\n`;
    if (highestPractice > formerPR) {
      alertMsg += `🎉 New PR (practice): ${fmtBar(highestPractice, units)}!`;
    } else {
      alertMsg += `PR unchanged.`;
    }

    add(sess);
    Alert.alert('Practice Saved!', alertMsg);
    navigation.goBack();
  };

  // Heights UI (with pole selector)
  const HeightAddUI =
    units === 'imperial' ? (
      <View>
        <Row style={{ gap: 8 }}>
          <SimpleDropdown
            label="Feet"
            valueLabel={addHeightFt ? `${addHeightFt} ft` : 'Feet'}
            onPress={() => setFtModalOpen(true)}
          />
          <DropdownModal
            visible={ftModalOpen}
            title="Feet"
            options={ftOptions}
            onSelect={(opt) => { setAddHeightFt(opt.value); setFtModalOpen(false); }}
            onClose={() => setFtModalOpen(false)}
          />
          <SimpleDropdown
            label="Inches"
            valueLabel={addHeightIn !== '' ? `${addHeightIn} in` : 'Inches'}
            onPress={() => setInModalOpen(true)}
          />
          <DropdownModal
            visible={inModalOpen}
            title="Inches"
            options={inOptions}
            onSelect={(opt) => { setAddHeightIn(opt.value); setInModalOpen(false); }}
            onClose={() => setInModalOpen(false)}
          />
          <SimpleDropdown
            label="Pole Used"
            valueLabel={
              addHeightPoleIdx !== null && poles[addHeightPoleIdx]
                ? `Pole ${addHeightPoleIdx + 1}: ${poles[addHeightPoleIdx].length || ''} ${poles[addHeightPoleIdx].flex || ''} ${poles[addHeightPoleIdx].weight || ''}`
                : 'Select Pole'
            }
            onPress={() => setPoleSelectModalOpen(true)}
          />
          <DropdownModal
            visible={poleSelectModalOpen}
            title="Select Pole"
            options={poles.map((pole, idx) => ({
              label: `Pole ${idx + 1}: ${pole.length || ''} ${pole.flex || ''} ${pole.weight || ''}`,
              value: idx
            }))}
            onSelect={(opt) => {
              setAddHeightPoleIdx(opt.value);
              setPoleSelectModalOpen(false);
            }}
            onClose={() => setPoleSelectModalOpen(false)}
          />
        </Row>
        <ButtonPrimary
          title="Add Height"
          onPress={handleAddHeightImperial}
          style={{
            marginTop: 8,
            alignSelf: 'flex-start',
            paddingHorizontal: 0,
            paddingLeft: 9,
            paddingRight: 9,
            marginLeft: 14,
          }}
        />
      </View>
    ) : (
      <View>
        <Row style={{ gap: 8 }}>
          <SimpleDropdown
            label="Meters"
            valueLabel={addHeightM ? `${addHeightM} m` : 'Meters'}
            onPress={() => setMModalOpen(true)}
          />
          <DropdownModal
            visible={mModalOpen}
            title="Meters"
            options={mOptions.map(opt => ({ ...opt, label: `${opt.valueRaw} m` }))}
            onSelect={(opt) => { setAddHeightM(opt.valueRaw); setMModalOpen(false); }}
            onClose={() => setMModalOpen(false)}
          />
          <SimpleDropdown
            label="Pole Used"
            valueLabel={
              addHeightPoleIdx !== null && poles[addHeightPoleIdx]
                ? `Pole ${addHeightPoleIdx + 1}: ${poles[addHeightPoleIdx].length || ''} ${poles[addHeightPoleIdx].flex || ''} ${poles[addHeightPoleIdx].weight || ''}`
                : 'Select Pole'
            }
            onPress={() => setPoleSelectModalOpen(true)}
          />
          <DropdownModal
            visible={poleSelectModalOpen}
            title="Select Pole"
            options={poles.map((pole, idx) => ({
              label: `Pole ${idx + 1}: ${pole.length || ''} ${pole.flex || ''} ${pole.weight || ''}`,
              value: idx
            }))}
            onSelect={(opt) => {
              setAddHeightPoleIdx(opt.value);
              setPoleSelectModalOpen(false);
            }}
            onClose={() => setPoleSelectModalOpen(false)}
          />
        </Row>
        <ButtonPrimary
          title="Add Height"
          onPress={handleAddHeightMetric}
          style={{
            marginTop: 8,
            alignSelf: 'flex-start',
            paddingHorizontal: 0,
            paddingLeft: 9,
            paddingRight: 9,
            marginLeft: 14,
            minWidth: undefined,
          }}
        />
      </View>
    );

  const TakeoffDropdown = (
    <>
      <SimpleDropdown
        label="Select takeoff mark"
        valueLabel={takeoffIn ? `${(takeoffIn / 12).toFixed(2)} ft` : 'Select takeoff mark'}
        onPress={() => setTakeoffModalOpen(true)}
      />
      <DropdownModal
        visible={takeoffModalOpen}
        title="Takeoff Mark (ft)"
        options={takeoffFtOptions}
        onSelect={(opt) => { setTakeoffIn(opt.value); setTakeoffModalOpen(false); }}
        onClose={() => setTakeoffModalOpen(false)}
      />
    </>
  );

  const StandardsDropdown = units === 'imperial'
    ? (
      <>
        <SimpleDropdown
          label="Select standards"
          valueLabel={standardsIn ? `${standardsIn}"` : 'Select standards'}
          onPress={() => setStandardsModalOpen(true)}
        />
        <DropdownModal
          visible={standardsModalOpen}
          title="Standards (in)"
          options={standardsInOptions}
          onSelect={(opt) => { setStandardsIn(opt.value); setStandardsModalOpen(false); }}
          onClose={() => setStandardsModalOpen(false)}
        />
      </>
    )
    : (
      <>
        <SimpleDropdown
          label="Select standards (cm)"
          valueLabel={standardsIn ? `${Math.round(standardsIn * 2.54)} cm` : 'Select standards (cm)'}
          onPress={() => setStandardsModalOpen(true)}
        />
        <DropdownModal
          visible={standardsModalOpen}
          title="Standards (cm)"
          options={standardsCmOptions}
          onSelect={(opt) => { setStandardsIn(opt.value); setStandardsModalOpen(false); }}
          onClose={() => setStandardsModalOpen(false)}
        />
      </>
    );

  const handleEmail = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }
    try {
      const text = sessionSummaryText({
        type: 'practice',
        date,
        dayName: dayNameStr,
        goals,
        steps: steps ? Number(steps) : undefined,
        approachIn: toInches({ feet: Number(approachFeet || 0), inches: Number(approachInches || 0) }),
        takeoffIn: Number(takeoffIn) || 0,
        standardsIn: Number(standardsIn) || 0,
        poles,
        heights,
        notes,
        routine: routine.map(({ text, done, isHeader }) => ({ text, done: !!done, isHeader: !!isHeader })),
      }, settings, athlete);
      await MailComposer.composeAsync({
        recipients: [email],
        subject: 'PoleVault Tracker Practice Session',
        body: text,
      });
    } catch (err) {
      Alert.alert('Error', 'Could not open email composer.');
    }
  };

  const SetupBlock = (
    <Section title="Setup used">
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
      <Field label="Takeoff Mark (FT)">
        {TakeoffDropdown}
      </Field>
      <Field label={`Standards setting (${units === 'metric' ? 'cm' : 'in'})`}>
        {StandardsDropdown}
      </Field>
    </Section>
  );

  return (
    <Screen>
      <Section title="New Practice">
        <Field label="Goals for today">
          <TextInput value={goals} onChangeText={setGoals} placeholder="e.g., hit 12' mid, tall at takeoff" style={styles.input} />
        </Field>
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
        {/* Poles Section */}
        <Section title="Poles">
  {poles.length === 0 ? (
    <Text style={styles.muted}>No poles added yet.</Text>
  ) : (
    <>
      {poles.map((pole, idx) => (
        <View key={idx} style={{ marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flexDirection: 'column' }}>
            {pole.length ? (
              <Text style={styles.pText}>
                Length: {pole.length}
              </Text>
            ) : null}
            {pole.weight ? (
              <Text style={styles.pText}>
                Weight: {pole.weight}
              </Text>
            ) : null}
            {pole.flex ? (
              <Text style={styles.pText}>
                Flex: {pole.flex}
              </Text>
            ) : null}
          </View>
          <ButtonSecondary title="Edit" onPress={() => {
            setEditPoleIdx(idx);
            setPoleLength(pole.length);
            setPoleFlex(pole.flex);
            setPoleWeight(pole.weight);
            setPoleModalOpen(true);
          }} />
          <ButtonSecondary title="Remove" onPress={() => {
            setPoles(poles.filter((_, i) => i !== idx));
          }} />
        </View>
      ))}
    </>
  )}
  <ButtonPrimary
    title="Add Pole"
    onPress={() => {
      setEditPoleIdx(null);
      setPoleLength('');
      setPoleFlex('');
      setPoleWeight('');
      setPoleModalOpen(true);
    }}
    style={{ alignSelf: 'flex-start' }}
  />
</Section>
        <Modal visible={poleModalOpen} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.sectionTitle}>{editPoleIdx !== null ? "Edit Pole" : "Add Pole"}</Text>
              {previousPoles.length > 0 && (
                <Field label="Copy previous pole">
                  <SimpleDropdown
                    label="Select previous pole"
                    valueLabel=""
                    onPress={() => setPoleSelectModalOpen(true)}
                  />
                  <DropdownModal
                    visible={poleSelectModalOpen}
                    title="Select Previous Pole"
                    options={previousPoles.map((pole, idx) => ({
                      label: `Pole ${idx + 1}: ${pole.length || ''} ${pole.flex || ''} ${pole.weight || ''}`,
                      value: idx
                    }))}
                    onSelect={(opt) => {
                      const p = previousPoles[opt.value];
                      setPoleLength(p.length || '');
                      setPoleFlex(p.flex || '');
                      setPoleWeight(p.weight || '');
                      setPoleSelectModalOpen(false);
                    }}
                    onClose={() => setPoleSelectModalOpen(false)}
                  />
                </Field>
              )}
              <Field label="Length (ft/in or cm)">
                <TextInput value={poleLength} onChangeText={setPoleLength} placeholder='e.g., 13"' style={styles.input} />
              </Field>
              <Field label="Flex Number">
                <TextInput value={poleFlex} onChangeText={setPoleFlex} placeholder="e.g., 16.8" style={styles.input} />
              </Field>
              <Field label="Weight Rating (lbs or kg)">
                <TextInput value={poleWeight} onChangeText={setPoleWeight} placeholder="e.g., 155 lbs" style={styles.input} />
              </Field>
              <Row style={{ justifyContent: 'flex-end', gap: 8 }}>
                <ButtonSecondary title="Cancel" onPress={() => { setPoleModalOpen(false); setEditPoleIdx(null); }} />
                <ButtonPrimary title="Save" onPress={() => {
                  if (!poleLength && !poleFlex && !poleWeight) return;
                  const poleObj = { length: poleLength, flex: poleFlex, weight: poleWeight };
                  if (editPoleIdx !== null) {
                    setPoles(poles.map((p, i) => i === editPoleIdx ? poleObj : p));
                  } else {
                    setPoles([...poles, poleObj]);
                  }
                  setPoleModalOpen(false);
                  setEditPoleIdx(null);
                }} />
              </Row>
            </View>
          </View>
        </Modal>
        {/* Heights & Attempts Section */}
        <Section title="Heights & Attempts">
          <Text style={[styles.muted, { marginBottom: 8 }]}>
            Add multiple heights for this practice. Each height has 3 attempts. Heights are listed below. Assign a pole for each height.
          </Text>
          {HeightAddUI}
          {heights.length ? (
    heights.map((h) => (
      <View key={h.id} style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Height</Text>
          <Text style={styles.pText}>{fmtBar(h.heightIn, units)}</Text>
          {h.poleIdx !== undefined && poles[h.poleIdx] ? (
            <Text style={styles.muted}>
              Pole Used: Length {poles[h.poleIdx].length}, Flex {poles[h.poleIdx].flex}, Weight {poles[h.poleIdx].weight}
            </Text>
          ) : null}
        </View>
        <View style={{ width: 16 }} />
        <View style={{ flex: 2 }}>
          <Text style={styles.fieldLabel}>Attempts</Text>
          <Row style={{ flexWrap: 'wrap' }}>
            {h.attempts.map((a, i) => {
              const clearIdx = h.attempts.findIndex(at => at.result === 'clear');
              if (clearIdx !== -1 && i > clearIdx) return null;
              return (
                <View key={a.idx} style={{ marginRight: 12 }}>
                  <Text>Attempt {a.idx}</Text>
                  <Row>
                    <Pressable
                      onPress={() => {
                        // Only allow "O" if no clear yet
                        if (clearIdx === -1) updateAttemptResult(h.id, a.idx, 'clear');
                      }}
                      style={[
                        styles.choice,
                        a.result === 'clear' && styles.choiceOn,
                        { zIndex: 10 }
                      ]}
                    >
                      <Text style={[styles.choiceText, a.result === 'clear' && styles.choiceTextOn]}>O</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        // Only allow "X" if no clear yet, or if before the clear
                        if (clearIdx === -1 || i < clearIdx) updateAttemptResult(h.id, a.idx, 'miss');
                      }}
                      style={[
                        styles.choice,
                        a.result === 'miss' && styles.choiceOnMiss,
                        { zIndex: 10 }
                      ]}
                    >
                      <Text style={[styles.choiceText, a.result === 'miss' && styles.choiceTextOn]}>
                        {clearIdx === -1 || i < clearIdx ? 'X' : ''}
                      </Text>
                    </Pressable>
                    <SimpleDropdown
                      label="Attempt Type"
                      valueLabel={a.type === 'bungee' ? 'Bungee' : 'Bar'}
                      onPress={() =>
                        setAttemptTypeDropdownOpen({
                          ...attemptTypeDropdownOpen,
                          [`${h.id}-${a.idx}`]: true,
                        })
                      }
                    />
                    <DropdownModal
                      visible={attemptTypeDropdownOpen[`${h.id}-${a.idx}`]}
                      title="Attempt Type"
                      options={[
                        { label: 'Bar', value: 'bar' },
                        { label: 'Bungee', value: 'bungee' },
                      ]}
                      onSelect={(opt) => {
                        setHeights((arr) =>
                          arr.map((height) =>
                            height.id !== h.id
                              ? height
                              : {
                                  ...height,
                                  attempts: height.attempts.map((at) =>
                                    at.idx === a.idx ? { ...at, type: opt.value } : at
                                  ),
                                }
                          )
                        );
                        setAttemptTypeDropdownOpen((open) => ({
                          ...open,
                          [`${h.id}-${a.idx}`]: false,
                        }));
                      }}
                      onClose={() =>
                        setAttemptTypeDropdownOpen((open) => ({
                          ...open,
                          [`${h.id}-${a.idx}`]: false,
                        }))
                      }
                    />
                  </Row>
                </View>
              );
            })}
            <Pressable onPress={() => removeHeight(h.id)} style={[styles.choice, { backgroundColor: '#eee', zIndex: 10 }]}>
              <Text style={[styles.choiceText, { color: '#333' }]}>Remove</Text>
            </Pressable>
          </Row>
        </View>
      </View>
    ))
  ) : (
    <Text style={styles.muted}>No heights added yet.</Text>
  )}
        </Section>
        {SetupBlock}
        <Field label="Notes">
          <TextInput value={notes} onChangeText={setNotes} placeholder="session notes…" style={[styles.input, { height: 90 }]} multiline />
        </Field>
        <Row style={{ gap: 8, marginTop: 8 }}>
          <TextInput value={email} onChangeText={setEmail} placeholder="coach@example.com" autoCapitalize="none" keyboardType="email-address" style={[styles.input, { flex: 1 }]} />
          <ButtonSecondary title="Email" onPress={handleEmail} />
        </Row>
        <View style={{ height: 10 }} />
        <ButtonPrimary title="Save Practice" onPress={save} />
      </Section>
    </Screen>
  );
}
function MeetFormScreen({ navigation }) {
  const { units, athlete } = usePVStore((s) => s.settings);
  const add = usePVStore((s) => s.addSession);

  const [date] = useState(new Date().toISOString());
  const [meetName, setMeetName] = useState('');
  const [goals, setGoals] = useState('');
  const [notes, setNotes] = useState('');
  const [email, setEmail] = useState('');
  const settings = usePVStore((s) => s.settings);
  const [attemptTypeDropdownOpen, setAttemptTypeDropdownOpen] = useState({});

  // Steps dropdown 1–15
  const [stepsOpen, setStepsOpen] = useState(false);
  const [steps, setSteps] = useState('');

  // Approach dropdowns
  const [approachFeet, setApproachFeet] = useState(0);
  const [approachInches, setApproachInches] = useState(0);
  const [approachFeetOpen, setApproachFeetOpen] = useState(false);
  const [approachInchesOpen, setApproachInchesOpen] = useState(false);

  // Takeoff & standards dropdowns
  const [takeoffModalOpen, setTakeoffModalOpen] = useState(false);
  const [takeoffIn, setTakeoffIn] = useState(0);
  const [standardsModalOpen, setStandardsModalOpen] = useState(false);
  const [standardsIn, setStandardsIn] = useState(0);

  // Poles logic
  const [poles, setPoles] = useState([]);
  const [poleModalOpen, setPoleModalOpen] = useState(false);
  const [poleLength, setPoleLength] = useState('');
  const [poleFlex, setPoleFlex] = useState('');
  const [poleWeight, setPoleWeight] = useState('');
  const [editPoleIdx, setEditPoleIdx] = useState(null);
  const allSessions = usePVStore((s) => s.sessions);

  // Gather all poles from all sessions
  const previousPoles = useMemo(() => {
    const polesArr = [];
    (allSessions || []).forEach(sess => {
      if (Array.isArray(sess.poles)) {
        sess.poles.forEach(p => {
          const key = `${p.length || ''}|${p.flex || ''}|${p.weight || ''}`;
          polesArr.push({ ...p, _key: key });
        });
      }
    });
    const seen = new Set();
    const deduped = [];
    for (const p of polesArr) {
      if (p._key && !seen.has(p._key)) {
        deduped.push(p);
        seen.add(p._key);
      }
    }
    return deduped;
  }, [allSessions]);

  // Heights logic
  const [heights, setHeights] = useState([]);
  const [addHeightFt, setAddHeightFt] = useState('');
  const [addHeightIn, setAddHeightIn] = useState('');
  const [addHeightM, setAddHeightM] = useState('');
  const [ftModalOpen, setFtModalOpen] = useState(false);
  const [inModalOpen, setInModalOpen] = useState(false);
  const [mModalOpen, setMModalOpen] = useState(false);
  // For assigning pole to height
  const [addHeightPoleIdx, setAddHeightPoleIdx] = useState(null);
  const [poleSelectModalOpen, setPoleSelectModalOpen] = useState(false);

  // Dropdown options
  const APPROACH_MAX_FEET = 150;
  const stepOptions = useMemo(() => Array.from({ length: 15 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) })), []);
  const approachFeetOptions = useMemo(() => Array.from({ length: APPROACH_MAX_FEET }, (_, i) => ({ label: `${i + 1} ft`, value: i + 1 })), []);
  const approachInchesOptions = useMemo(() => Array.from({ length: 11 }, (_, i) => ({ label: `${i + 1} in`, value: i + 1 })), []);
  const takeoffFtOptions = useMemo(() => Array.from({ length: ((15 - 2) / 0.25) + 1 }, (_, i) => {
    const ft = 2 + i * 0.25;
    return { label: `${ft.toFixed(2)} ft`, value: Math.round(ft * 12) };
  }), []);
  const takeoffCmOptions = useMemo(() => Array.from({ length: (85 - 40) + 1 }, (_, i) => {
    const cm = 40 + i;
    return { label: `${cm} cm`, value: (cm / 2.54) };
  }), []);
  const standardsInOptions = useMemo(() => Array.from({ length: ((31.5 - 18) / 0.5) + 1 }, (_, i) => {
    const val = 18 + i * 0.5;
    return { label: `${val}"`, value: val };
  }), []);
  const standardsCmOptions = useMemo(() => Array.from({ length: (85 - 40) + 1 }, (_, i) => {
    const cm = 40 + i;
    return { label: `${cm} cm`, value: (cm / 2.54) };
  }), []);
  const ftOptions = useMemo(() => Array.from({ length: 25 }, (_, i) => ({ label: `${i + 1} ft`, value: i + 1 })), []);
  const inOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ label: `${i} in`, value: i })), []);
  const mOptions = useMemo(() => {
    const arr = [];
    for (let i = 152; i <= 609.6; i += 1) {
      const m = i / 100;
      arr.push({ label: `${m.toFixed(2).replace(/\.?0+$/,'')} m`, value: m });
    }
    return arr;
  }, []);

  // Height addition logic (pole selection required!)
  const handleAddHeightImperial = () => {
  const ft = Number(addHeightFt);
  const inch = Number(addHeightIn);
  if ((!ft && !inch) || isNaN(ft) || isNaN(inch)) return Alert.alert('Select a valid height');
  if (addHeightPoleIdx === null) return Alert.alert('Select a pole for this height');
  const totalIn = ft * 12 + inch;
  setHeights((arr) => [
    ...arr,
    {
      id: shortId(),
      heightIn: totalIn,
      attempts: [
        { result: 'miss', idx: 1, type: 'bar' },
        { result: 'miss', idx: 2, type: 'bar' },
        { result: 'miss', idx: 3, type: 'bar' }
      ],
      poleIdx: addHeightPoleIdx
    }
  ]);
  setAddHeightFt('');
  setAddHeightIn('');
  setAddHeightPoleIdx(null);
};
  const handleAddHeightMetric = () => {
  const m = Number(addHeightM);
  if (!m || isNaN(m)) return Alert.alert('Select a valid height');
  if (addHeightPoleIdx === null) return Alert.alert('Select a pole for this height');
  setHeights((arr) => [
    ...arr,
    {
      id: shortId(),
      heightIn: m * 39.3701, // meters to inches
      attempts: [
        { result: 'miss', idx: 1, type: 'bar' },
        { result: 'miss', idx: 2, type: 'bar' },
        { result: 'miss', idx: 3, type: 'bar' }
      ],
      poleIdx: addHeightPoleIdx
    }
  ]);
  setAddHeightM('');
  setAddHeightPoleIdx(null);
};

  // Update attempt for a height
  const updateAttemptResult = (heightId, attemptIdx, result) => {
    setHeights((arr) =>
      arr.map((height) => {
        if (height.id !== heightId) return height;
        if (result === 'clear') {
          return {
            ...height,
            attempts: height.attempts.map((a) =>
              a.idx === attemptIdx ? { ...a, result: 'clear' } : a
            ),
            completed: true
          };
        } else {
          if (height.attempts.some(a => a.result === 'clear')) return height;
          return {
            ...height,
            attempts: height.attempts.map((a) =>
              a.idx === attemptIdx ? { ...a, result: 'miss' } : a
            )
          };
        }
      })
    );
  };

  // Remove height entry
  const removeHeight = (heightId) => setHeights((arr) => (arr || []).filter((h) => h.id !== heightId));

  // Setup block
  const SetupBlock = (
    <Section title="Setup used">
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
      <Field label="Takeoff Mark (FT)">
        <SimpleDropdown
          label="Select takeoff mark"
          valueLabel={takeoffIn ? `${(takeoffIn / 12).toFixed(2)} ft` : 'Select takeoff mark'}
          onPress={() => setTakeoffModalOpen(true)}
        />
        <DropdownModal
          visible={takeoffModalOpen}
          title="Takeoff Mark (ft)"
          options={takeoffFtOptions}
          onSelect={(opt) => { setTakeoffIn(opt.value); setTakeoffModalOpen(false); }}
          onClose={() => setTakeoffModalOpen(false)}
        />
      </Field>
      <Field label={`Standards setting (${units === 'metric' ? 'cm' : 'in'})`}>
        {units === 'imperial'
          ? <>
              <SimpleDropdown
                label="Select standards"
                valueLabel={standardsIn ? `${standardsIn}"` : 'Select standards'}
                onPress={() => setStandardsModalOpen(true)}
              />
              <DropdownModal
                visible={standardsModalOpen}
                title="Standards (in)"
                options={standardsInOptions}
                onSelect={(opt) => { setStandardsIn(opt.value); setStandardsModalOpen(false); }}
                onClose={() => setStandardsModalOpen(false)}
              />
            </>
          : <>
              <SimpleDropdown
                label="Select standards (cm)"
                valueLabel={standardsIn ? `${Math.round(standardsIn * 2.54)} cm` : 'Select standards (cm)'}
                onPress={() => setStandardsModalOpen(true)}
              />
              <DropdownModal
                visible={standardsModalOpen}
                title="Standards (cm)"
                options={standardsCmOptions}
                onSelect={(opt) => { setStandardsIn(opt.value); setStandardsModalOpen(false); }}
                onClose={() => setStandardsModalOpen(false)}
              />
            </>
        }
      </Field>
    </Section>
  );

  // Heights UI (with pole selector)
  const HeightAddUI =
    units === 'imperial' ? (
      <View>
        <Row style={{ gap: 8 }}>
          <SimpleDropdown
            label="Feet"
            valueLabel={addHeightFt ? `${addHeightFt} ft` : 'Feet'}
            onPress={() => setFtModalOpen(true)}
          />
          <DropdownModal
            visible={ftModalOpen}
            title="Feet"
            options={ftOptions}
            onSelect={(opt) => { setAddHeightFt(opt.value); setFtModalOpen(false); }}
            onClose={() => setFtModalOpen(false)}
          />
          <SimpleDropdown
            label="Inches"
            valueLabel={addHeightIn !== '' ? `${addHeightIn} in` : 'Inches'}
            onPress={() => setInModalOpen(true)}
          />
          <DropdownModal
            visible={inModalOpen}
            title="Inches"
            options={inOptions}
            onSelect={(opt) => { setAddHeightIn(opt.value); setInModalOpen(false); }}
            onClose={() => setInModalOpen(false)}
          />
          <SimpleDropdown
            label="Pole Used"
            valueLabel={
              addHeightPoleIdx !== null && poles[addHeightPoleIdx]
                ? `Pole ${addHeightPoleIdx + 1}: ${poles[addHeightPoleIdx].length || ''} ${poles[addHeightPoleIdx].flex || ''} ${poles[addHeightPoleIdx].weight || ''}`
                : 'Select Pole'
            }
            onPress={() => setPoleSelectModalOpen(true)}
          />
          <DropdownModal
            visible={poleSelectModalOpen}
            title="Select Pole"
            options={poles.map((pole, idx) => ({
              label: `Pole ${idx + 1}: ${pole.length || ''} ${pole.flex || ''} ${pole.weight || ''}`,
              value: idx
            }))}
            onSelect={(opt) => {
              setAddHeightPoleIdx(opt.value);
              setPoleSelectModalOpen(false);
            }}
            onClose={() => setPoleSelectModalOpen(false)}
          />
        </Row>
        <ButtonPrimary
          title="Add Height"
          onPress={handleAddHeightImperial}
          style={{
            marginTop: 8,
            alignSelf: 'flex-start',
            paddingHorizontal: 0,
            paddingLeft: 9,
            paddingRight: 9,
            marginLeft: 14,
          }}
        />
      </View>
    ) : (
      <View>
        <Row style={{ gap: 8 }}>
          <SimpleDropdown
            label="Meters"
            valueLabel={addHeightM ? `${addHeightM} m` : 'Meters'}
            onPress={() => setMModalOpen(true)}
          />
          <DropdownModal
            visible={mModalOpen}
            title="Meters"
            options={mOptions.map(opt => ({ ...opt, label: `${opt.value} m` }))}
            onSelect={(opt) => { setAddHeightM(opt.value); setMModalOpen(false); }}
            onClose={() => setMModalOpen(false)}
          />
          <SimpleDropdown
            label="Pole Used"
            valueLabel={
              addHeightPoleIdx !== null && poles[addHeightPoleIdx]
                ? `Pole ${addHeightPoleIdx + 1}: ${poles[addHeightPoleIdx].length || ''} ${poles[addHeightPoleIdx].flex || ''} ${poles[addHeightPoleIdx].weight || ''}`
                : 'Select Pole'
            }
            onPress={() => setPoleSelectModalOpen(true)}
          />
          <DropdownModal
            visible={poleSelectModalOpen}
            title="Select Pole"
            options={poles.map((pole, idx) => ({
              label: `Pole ${idx + 1}: ${pole.length || ''} ${pole.flex || ''} ${pole.weight || ''}`,
              value: idx
            }))}
            onSelect={(opt) => {
              setAddHeightPoleIdx(opt.value);
              setPoleSelectModalOpen(false);
            }}
            onClose={() => setPoleSelectModalOpen(false)}
          />
        </Row>
        <ButtonPrimary
          title="Add Height"
          onPress={handleAddHeightMetric}
          style={{
            marginTop: 8,
            alignSelf: 'flex-start',
            paddingHorizontal: 0,
            paddingLeft: 9,
            paddingRight: 9,
            marginLeft: 14,
            minWidth: undefined,
          }}
        />
      </View>
    );

  const handleEmail = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }
    try {
      const text = sessionSummaryText({
        type: 'meet',
        date,
        meetName: meetName?.trim() || undefined,
        goals,
        attempts: (heights || []).map(({ heightIn, attempts, poleIdx }) => ({
          heightIn,
          attempts,
          poleIdx
        })),
        notes,
        steps: steps ? Number(steps) : undefined,
        approachIn: toInches({ feet: Number(approachFeet || 0), inches: Number(approachInches || 0) }),
        takeoffIn: Number(takeoffIn) || 0,
        standardsIn: Number(standardsIn) || 0,
        poles,
      }, settings, athlete);
      await MailComposer.composeAsync({
        recipients: [email],
        subject: 'PoleVault Tracker Meet Session',
        body: text,
      });
    } catch (err) {
      Alert.alert('Error', 'Could not open email composer.');
    }
  };

  // Save logic
  const save = () => {
    const approachIn = toInches({ feet: Number(approachFeet || 0), inches: Number(approachInches || 0) });
    const sess = {
      id: shortId(),
      type: 'meet',
      date,
      meetName: meetName?.trim() || undefined,
      goals,
      attempts: (heights || []).map(({ heightIn, attempts, poleIdx }) => ({
        heightIn,
        attempts,
        poleIdx,
      })),
      notes,
      steps: steps ? Number(steps) : undefined,
      approachIn,
      takeoffIn: Number(takeoffIn) || 0,
      standardsIn: Number(standardsIn) || 0,
      poles,
    };

    // Calculate former PR (from all previous meets)
    const allSessions = usePVStore.getState().sessions;
    let formerPR = 0;
    for (const s of allSessions) {
      if (s.type === 'meet' && Array.isArray(s.attempts)) {
        for (const a of s.attempts) {
          if (a.result === 'clear') {
            formerPR = Math.max(formerPR, Number(a.heightIn) || 0);
          }
        }
      }
    }

    // Highest cleared in this meet
    let highestMeet = 0;
    for (const h of sess.attempts || []) {
      if (Array.isArray(h.attempts) && h.attempts.some(a => a.result === 'clear')) {
        highestMeet = Math.max(highestMeet, Number(h.heightIn) || 0);
      }
    }

    let alertMsg = `Highest cleared this meet: ${fmtBar(highestMeet, units)}\nFormer PR: ${fmtBar(formerPR, units)}\n`;
    if (highestMeet > formerPR) {
      alertMsg += `🎉 New PR: ${fmtBar(highestMeet, units)}!`;
    } else {
      alertMsg += `PR unchanged.`;
    }

    add(sess);
    Alert.alert('Meet Saved!', alertMsg);
    navigation.goBack();
  };

  return (
    <Screen>
      <Section title="New Meet">
        <Field label="Meet name">
          <TextInput value={meetName} onChangeText={setMeetName} placeholder="e.g., Conference Finals" style={styles.input} />
        </Field>
        <Field label="Goals">
          <TextInput value={goals} onChangeText={setGoals} placeholder="e.g., open @ 11'6, PR attempt 12'6" style={styles.input} />
        </Field>
        {/* Poles Section ABOVE Heights & Attempts, renamed to "Poles" */}
        <Section title="Poles">
  {poles.length === 0 ? (
    <Text style={styles.muted}>No poles added yet.</Text>
  ) : (
    <>
      {poles.map((pole, idx) => (
        <View key={idx} style={{ marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flexDirection: 'column' }}>
            {pole.length ? (
              <Text style={styles.pText}>
                Length: {pole.length}
              </Text>
            ) : null}
            {pole.weight ? (
              <Text style={styles.pText}>
                Weight: {pole.weight}
              </Text>
            ) : null}
            {pole.flex ? (
              <Text style={styles.pText}>
                Flex: {pole.flex}
              </Text>
            ) : null}
          </View>
          <ButtonSecondary title="Edit" onPress={() => {
            setEditPoleIdx(idx);
            setPoleLength(pole.length);
            setPoleFlex(pole.flex);
            setPoleWeight(pole.weight);
            setPoleModalOpen(true);
          }} />
          <ButtonSecondary title="Remove" onPress={() => {
            setPoles(poles.filter((_, i) => i !== idx));
          }} />
        </View>
      ))}
    </>
  )}
  <ButtonPrimary
    title="Add Pole"
    onPress={() => {
      setEditPoleIdx(null);
      setPoleLength('');
      setPoleFlex('');
      setPoleWeight('');
      setPoleModalOpen(true);
    }}
    style={{ alignSelf: 'flex-start' }}
  />
</Section>
        <Modal visible={poleModalOpen} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.sectionTitle}>{editPoleIdx !== null ? "Edit Pole" : "Add Pole"}</Text>
              {previousPoles.length > 0 && (
                <Field label="Copy previous pole">
                  <SimpleDropdown
                    label="Select previous pole"
                    valueLabel=""
                    onPress={() => setPoleSelectModalOpen(true)}
                  />
                  <DropdownModal
                    visible={poleSelectModalOpen}
                    title="Select Previous Pole"
                    options={previousPoles.map((pole, idx) => ({
                      label: `Pole ${idx + 1}: ${pole.length || ''} ${pole.flex || ''} ${pole.weight || ''}`,
                      value: idx
                    }))}
                    onSelect={(opt) => {
                      const p = previousPoles[opt.value];
                      setPoleLength(p.length || '');
                      setPoleFlex(p.flex || '');
                      setPoleWeight(p.weight || '');
                      setPoleSelectModalOpen(false);
                    }}
                    onClose={() => setPoleSelectModalOpen(false)}
                  />
                </Field>
              )}
              <Field label="Length (ft/in or cm)">
                <TextInput value={poleLength} onChangeText={setPoleLength} placeholder='e.g., 13"' style={styles.input} />
              </Field>
              <Field label="Flex Number">
                <TextInput value={poleFlex} onChangeText={setPoleFlex} placeholder="e.g., 16.8" style={styles.input} />
              </Field>
              <Field label="Weight Rating (lbs or kg)">
                <TextInput value={poleWeight} onChangeText={setPoleWeight} placeholder="e.g., 155 lbs" style={styles.input} />
              </Field>
              <Row style={{ justifyContent: 'flex-end', gap: 8 }}>
                <ButtonSecondary title="Cancel" onPress={() => { setPoleModalOpen(false); setEditPoleIdx(null); }} />
                <ButtonPrimary title="Save" onPress={() => {
                  if (!poleLength && !poleFlex && !poleWeight) return;
                  const poleObj = { length: poleLength, flex: poleFlex, weight: poleWeight };
                  if (editPoleIdx !== null) {
                    setPoles(poles.map((p, i) => i === editPoleIdx ? poleObj : p));
                  } else {
                    setPoles([...poles, poleObj]);
                  }
                  setPoleModalOpen(false);
                  setEditPoleIdx(null);
                }} />
              </Row>
            </View>
          </View>
        </Modal>
        {/* Heights & Attempts Section as Section (bold, same style as Poles) */}
        <Section title="Heights & Attempts">
          <Text style={[styles.muted, { marginBottom: 8 }]}>Add multiple heights for this meet. Each height has 3 attempts and must be assigned a pole.</Text>
          {HeightAddUI}
          {heights.length ? (
            heights.map((h) => (
              <View key={h.id} style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Height</Text>
                  <Text style={styles.pText}>{fmtBar(h.heightIn, units)}</Text>
                  {h.poleIdx !== undefined && poles[h.poleIdx] ? (
                    <Text style={styles.muted}>
                      Pole Used: Length {poles[h.poleIdx].length}, Flex {poles[h.poleIdx].flex}, Weight {poles[h.poleIdx].weight}
                    </Text>
                  ) : null}
                </View>
                <View style={{ width: 16 }} />
                <View style={{ flex: 2 }}>
                  <Text style={styles.fieldLabel}>Attempts</Text>
                  <Row style={{ flexWrap: 'wrap' }}>
                    {h.attempts.map((a, i) => {
  const clearIdx = h.attempts.findIndex(at => at.result === 'clear');
  if (clearIdx !== -1 && i > clearIdx) return null;
  return (
    <View key={a.idx} style={{ marginRight: 12 }}>
      <Text>Attempt {a.idx}</Text>
      <Row>
        <Pressable
  onPress={() => {
    // Only allow O/X to be set if no clear has happened yet, or this is the first clear
    if (clearIdx === -1) updateAttemptResult(h.id, a.idx, 'clear');
  }}
  style={[
    styles.choice,
    a.result === 'clear' && styles.choiceOn,
  ]}
>
  <Text style={[styles.choiceText, a.result === 'clear' && styles.choiceTextOn]}>O</Text>
</Pressable>
<Pressable
  onPress={() => {
    // Only allow X to be set if no clear has happened yet, or this is before the first clear
    if (clearIdx === -1 || i < clearIdx) updateAttemptResult(h.id, a.idx, 'miss');
  }}
  style={[styles.choice, a.result === 'miss' && styles.choiceOnMiss]}
>
  <Text style={[styles.choiceText, a.result === 'miss' && styles.choiceTextOn]}>
    {clearIdx === -1 || i < clearIdx ? 'X' : ''}
  </Text>
</Pressable>
        {/* Attempt type dropdown */}
        <SimpleDropdown
          label="Attempt Type"
          valueLabel={a.type === 'bungee' ? 'Bungee' : 'Bar'}
          onPress={() => setAttemptTypeDropdownOpen({ ...attemptTypeDropdownOpen, [`${h.id}-${a.idx}`]: true })}
        />
        <DropdownModal
          visible={attemptTypeDropdownOpen[`${h.id}-${a.idx}`]}
          title="Attempt Type"
          options={[
            { label: 'Bar', value: 'bar' },
            { label: 'Bungee', value: 'bungee' }
          ]}
          onSelect={(opt) => {
            setHeights(arr => arr.map(height =>
              height.id !== h.id ? height :
              {
                ...height,
                attempts: height.attempts.map(at =>
                  at.idx === a.idx ? { ...at, type: opt.value } : at
                )
              }
            ));
            setAttemptTypeDropdownOpen(open => ({ ...open, [`${h.id}-${a.idx}`]: false }));
          }}
          onClose={() => setAttemptTypeDropdownOpen(open => ({ ...open, [`${h.id}-${a.idx}`]: false }))}
        />
      </Row>
    </View>
  );
})}
                    <Pressable onPress={() => removeHeight(h.id)} style={[styles.choice, { backgroundColor: '#eee' }]}><Text style={[styles.choiceText, { color: '#333' }]}>Remove</Text></Pressable>
                  </Row>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>No heights added yet.</Text>
          )}
        </Section>
        {SetupBlock}
        <Field label="Notes"><TextInput value={notes} onChangeText={setNotes} placeholder="meet notes…" style={[styles.input, { height: 90 }]} multiline /></Field>
        <Row style={{ gap: 8, marginTop: 8 }}>
          <TextInput value={email} onChangeText={setEmail} placeholder="coach@example.com" autoCapitalize="none" keyboardType="email-address" style={[styles.input, { flex: 1 }]} />
          <ButtonSecondary title="Email" onPress={handleEmail} />
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
  const planOverridden = usePVStore((s) => s.settings.planOverridden);
  const setWeeklyPlan = usePVStore((s) => s.setWeeklyPlan);
  const resetWeeklyPlan = usePVStore((s) => s.resetWeeklyPlan);
  const [activeDay, setActiveDay] = useState(todayName());
  const [uploading, setUploading] = useState(false);

  // Validate plan format (must match shape of defaultWeeklyPlan)
  function validatePlanFile(json) {
    if (typeof json !== 'object' || !json) return false;
    for (const d of days) {
      if (!json[d] || typeof json[d] !== 'object') return false;
      if (!Array.isArray(json[d].routine)) return false;
      if (typeof json[d].goals !== 'string') return false;
    }
    return true;
  }

  // Handle upload
  async function handleUpload() {
    setUploading(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.type === 'success') {
        const fileUri = res.assets?.[0]?.uri || res.uri;
        const content = await fetch(fileUri).then((r) => r.text());
        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch (err) {
          Alert.alert('Error', 'Uploaded file is not valid JSON.');
          setUploading(false);
          return;
        }
        if (!validatePlanFile(parsed)) {
          Alert.alert('Error', 'Plan file format is not valid. Must match week plan structure.');
          setUploading(false);
          return;
        }
        setWeeklyPlan(parsed);
        Alert.alert('Success', 'Practice plan uploaded!');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not upload plan file.');
    }
    setUploading(false);
  }

  // Entry for selected day
  const entry = plan[activeDay] || { goals: '', routine: [] };

  return (
    <Screen>
      <Section title="Weekly Practice Plan">
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
      <Section title="Plan File">
        <Row style={{ gap: 8 }}>
          <ButtonPrimary
            title={planOverridden ? 'Re-upload Plan' : 'Upload Plan File'}
            onPress={handleUpload}
            disabled={uploading}
          />
          {planOverridden && (
            <ButtonSecondary
              title="Reset to Default"
              onPress={() => {
                Alert.alert('Reset plan?', 'This will restore the original weekly plan.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Reset', style: 'destructive', onPress: resetWeeklyPlan }
                ]);
              }}
            />
          )}
        </Row>
        <Text style={[styles.muted, { marginTop: 8 }]}>
          {planOverridden
            ? 'Custom plan loaded from file. You can re-upload or reset.'
            : 'You can upload a custom plan file (JSON) to override the weekly practice plan.'}
        </Text>
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
  const units = usePVStore((s) => s.settings.units);
  const athlete = usePVStore((s) => s.settings.athlete);
  const watermarkUri = usePVStore((s) => s.settings.watermarkUri);
  const setUnits = usePVStore((s) => s.setUnits);
  const setAthleteField = usePVStore((s) => s.setAthleteField);
  const setWatermarkUri = usePVStore((s) => s.setWatermarkUri);
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setWatermarkUri(result.assets[0].uri);
    }
  };
  

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
      <Section title="Watermark">
        <Row style={{ gap: 12, alignItems: 'center' }}>
          {watermarkUri ? (
            <Image source={{ uri: watermarkUri }} style={{ width: 60, height: 60, borderRadius: 8 }} />
          ) : (
            <Image source={require('./assets/sau-logo.png')} style={{ width: 60, height: 60, opacity: 0.6 }} />
          )}
          <ButtonSecondary title="Upload Image" onPress={pickImage} />
          {watermarkUri ? (
            <ButtonSecondary title="Remove" onPress={() => setWatermarkUri('')} />
          ) : null}
        </Row>
        <Text style={[styles.muted, { marginTop: 6 }]}>
          This watermark will appear at the bottom of every screen.
        </Text>
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
      <Stack.Navigator initialRouteName="Splash">
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MainTabs"
          component={MainTabsWithProfileGate} // <-- this calls your modal/tab logic
          options={{ headerShown: false }}
        />
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
  choice: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', marginRight: 8, zIndex: 10 },
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
// ------------------ Athlete Profile Modal ------------------
function AthleteProfileModal({ visible, onComplete }) {
  const athlete = usePVStore((s) => s.settings.athlete);
  const setAthleteField = usePVStore((s) => s.setAthleteField);

  // Basic validation
  const canContinue =
    (athlete.firstName || '').trim() &&
    (athlete.lastName || '').trim() &&
    (athlete.year || '').trim() &&
    (athlete.level === 'highschool' || athlete.level === 'college');

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 22, width: '100%', maxWidth: 400 }}>
          <Text style={[styles.sectionTitle, { marginBottom: 14 }]}>Welcome! Enter Athlete Info</Text>
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
          <Field label="Year">
            <TextInput
              value={athlete.year}
              onChangeText={(t) => setAthleteField('year', t.replace(/[^0-9A-Za-z ]/g, ''))}
              placeholder="e.g., 11 or FR/SO/JR/SR"
              style={styles.input}
            />
          </Field>
          <Field label="Level">
            <Row style={{ gap: 10 }}>
              <Pressable
                onPress={() => setAthleteField('level', 'highschool')}
                style={[styles.choice, athlete.level === 'highschool' && styles.choiceOn]}
              >
                <Text style={[styles.choiceText, athlete.level === 'highschool' && styles.choiceTextOn]}>High School</Text>
              </Pressable>
              <Pressable
                onPress={() => setAthleteField('level', 'college')}
                style={[styles.choice, athlete.level === 'college' && styles.choiceOn]}
              >
                <Text style={[styles.choiceText, athlete.level === 'college' && styles.choiceTextOn]}>College</Text>
              </Pressable>
            </Row>
          </Field>
          <View style={{ height: 16 }} />
          <ButtonPrimary title="Continue" onPress={onComplete} disabled={!canContinue} />
        </View>
      </View>
    </Modal>
  );
}

// ------------------ Main App Wrapper with Modal Logic ------------------

function WatermarkPromptModal({ visible, onUpload, onSkip }) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 22, width: '100%', maxWidth: 400 }}>
          <Text style={[styles.sectionTitle, { marginBottom: 14 }]}>Would you like to upload a custom watermark/logo?</Text>
          <Text style={styles.pText}>You can skip this and change it later in Settings.</Text>
          <View style={{ height: 16 }} />
          <Row style={{ justifyContent: 'flex-end', gap: 10 }}>
            <ButtonSecondary title="Skip" onPress={onSkip} />
            <ButtonPrimary title="Upload" onPress={onUpload} />
          </Row>
        </View>
      </View>
    </Modal>
  );
}

function MainTabsWithProfileGate() {
  const [showModal, setShowModal] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showWatermarkPrompt, setShowWatermarkPrompt] = useState(false);

  const setProfileComplete = async () => {
    await AsyncStorage.setItem('pv-athlete-profile-complete', 'true');
    setShowModal(false);
    setShowWatermarkPrompt(true); // Show watermark modal next!
  };

  const setWatermarkUri = usePVStore((s) => s.setWatermarkUri);

  const handleWatermarkUpload = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setWatermarkUri(result.assets[0].uri);
    }
    setShowWatermarkPrompt(false);
  };

  const handleSkipWatermark = () => setShowWatermarkPrompt(false);

  useEffect(() => {
    AsyncStorage.getItem('pv-athlete-profile-complete').then((val) => {
      setShowModal(!val);
      setChecking(false);
    });
  }, []);

  if (checking) return null;

  return (
    <>
      <AthleteProfileModal visible={showModal} onComplete={setProfileComplete} />
      <WatermarkPromptModal
        visible={showWatermarkPrompt}
        onUpload={handleWatermarkUpload}
        onSkip={handleSkipWatermark}
      />
      <TabNav />
    </>
  );
}
