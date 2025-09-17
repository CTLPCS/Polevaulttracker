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
import PolesScreen from './PolesScreen';
import SplashScreen from './SplashScreen';
import VideoScreen from './VideoScreen';
import { DropdownModal, SimpleDropdown } from './components';
import { usePVStore } from './store';

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



// -------------------- Store (persist sessions & settings only) --------------------


const initialSettings = {
  units: 'imperial', // 'imperial' | 'metric'
  athlete: { firstName: '', lastName: '', year: '', level: 'highschool' },
  planOverridden: false, // NEW: tracks if plan is overridden
  watermarkUri: '', // <-- NEW
};

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

  // Helper for O/X pill styling
  function AttemptPill({ result }) {
    return (
      <View style={[
        styles.pill,
        result === 'clear'
          ? { backgroundColor: '#e6ffe6', borderColor: 'green' }
          : { backgroundColor: '#ffe6e6', borderColor: 'red' }
      ]}>
        <Text style={{
          fontWeight: '600',
          color: result === 'clear' ? 'green' : 'red'
        }}>
          {result === 'clear' ? 'O' : 'X'}
        </Text>
      </View>
    );
  }

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
                {/* PRACTICE SESSION HEIGHTS */}
                {s.type === 'practice' && Array.isArray(s.heights) && s.heights.length > 0 && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.fieldLabel}>Attempted Heights:</Text>
                    {s.heights.map((h, i) => {
                      const pole = (Array.isArray(s.poles) && h.poleIdx !== undefined && s.poles[h.poleIdx]) ? s.poles[h.poleIdx] : null;
                      // Find attempts: show up to and including first clear
                      const clearIdx = h.attempts.findIndex(a => a.result === 'clear');
                      const shownAttempts = h.attempts.slice(0, clearIdx === -1 ? undefined : clearIdx + 1);
                      return (
                        <View key={h.id || i} style={{ marginBottom: 10 }}>
                          <Row style={{ alignItems: 'center', gap: 8, marginBottom: 2 }}>
                            <Pill text={fmtBar(h.heightIn, units)} />
                            {shownAttempts.map((a, idx) => (
                              <AttemptPill key={idx} result={a.result} />
                            ))}
                          </Row>
                          {pole ? (
                            <View style={{ marginLeft: 14 }}>
                              <Row style={{ gap: 14 }}>
                                <Text style={styles.pText}>
                                  {pole.brand ? `Brand: ${pole.brand}` : ''}
                                  {pole.length ? `   Length: ${pole.length}` : ''}
                                </Text>
                              </Row>
                              <Row style={{ gap: 14 }}>
                                <Text style={styles.pText}>
                                  {pole.flex ? `Flex: ${pole.flex}` : ''}
                                  {pole.weight ? `   Weight: ${pole.weight}` : ''}
                                </Text>
                              </Row>
                              <Text style={styles.muted}>
                                Setup: Steps {pole.steps ?? '—'}, Approach {fmtFeetIn(Number(pole.approachFeet)*12 + Number(pole.approachInches))}, Takeoff {fmtTakeoff(pole.takeoffIn, units)}, Standards {fmtStandards(pole.standardsIn, units)}, Hands: {pole.hands ?? '—'}
                              </Text>
                            </View>
                          ) : (
                            <Text style={[styles.muted, { marginLeft: 14 }]}>No pole assigned.</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
                {/* MEET SESSION ATTEMPTS */}
                {s.type === 'meet' && Array.isArray(s.attempts) && s.attempts.length > 0 && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.fieldLabel}>Attempted Heights:</Text>
                    {s.attempts.map((h, i) => {
                      const pole = (Array.isArray(s.poles) && h.poleIdx !== undefined && s.poles[h.poleIdx]) ? s.poles[h.poleIdx] : null;
                      const clearIdx = h.attempts.findIndex(a => a.result === 'clear');
                      const shownAttempts = h.attempts.slice(0, clearIdx === -1 ? undefined : clearIdx + 1);
                      return (
                        <View key={i} style={{ marginBottom: 10 }}>
                          <Row style={{ alignItems: 'center', gap: 8, marginBottom: 2 }}>
                            <Pill text={fmtBar(h.heightIn, units)} />
                            {shownAttempts.map((a, idx) => (
                              <AttemptPill key={idx} result={a.result} />
                            ))}
                          </Row>
                          {pole ? (
                            <View style={{ marginLeft: 14 }}>
                              <Row style={{ gap: 14 }}>
                                <Text style={styles.pText}>
                                  {pole.brand ? `Brand: ${pole.brand}` : ''}
                                  {pole.length ? `   Length: ${pole.length}` : ''}
                                </Text>
                              </Row>
                              <Row style={{ gap: 14 }}>
                                <Text style={styles.pText}>
                                  {pole.flex ? `Flex: ${pole.flex}` : ''}
                                  {pole.weight ? `   Weight: ${pole.weight}` : ''}
                                </Text>
                              </Row>
                              <Text style={styles.muted}>
                                Setup: Steps {pole.steps ?? '—'}, Approach {fmtFeetIn(Number(pole.approachFeet)*12 + Number(pole.approachInches))}, Takeoff {fmtTakeoff(pole.takeoffIn, units)}, Standards {fmtStandards(pole.standardsIn, units)}, Hands: {pole.hands ?? '—'}
                              </Text>
                            </View>
                          ) : (
                            <Text style={[styles.muted, { marginLeft: 14 }]}>No pole assigned.</Text>
                          )}
                        </View>
                      );
                    })}
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

  // Helper for O/X pill styling
  function AttemptPill({ result }) {
    return (
      <View style={[
        styles.pill,
        result === 'clear'
          ? { backgroundColor: '#e6ffe6', borderColor: 'green' }
          : { backgroundColor: '#ffe6e6', borderColor: 'red' }
      ]}>
        <Text style={{
          fontWeight: '600',
          color: result === 'clear' ? 'green' : 'red'
        }}>
          {result === 'clear' ? 'O' : 'X'}
        </Text>
      </View>
    );
  }

  return (
    <Screen>
      <Section
        title={`${name ? `${name} – ` : ''}${session.type === 'meet' ? 'Meet' : 'Practice'} – ${new Date(session.date).toLocaleDateString()}`}
      >
        {session.type === 'meet' ? (
          <>
            {session.meetName ? <Field label="Meet"><Text style={styles.pText}>{session.meetName}</Text></Field> : null}
            <Field label="Goals"><Text style={styles.pText}>{session.goals || '—'}</Text></Field>
            <Field label="Attempted Heights">
              {session.attempts?.length ? (
                <View style={{ gap: 10 }}>
                  {session.attempts.map((h, i) => {
                    const pole = (Array.isArray(session.poles) && h.poleIdx !== undefined && session.poles[h.poleIdx]) ? session.poles[h.poleIdx] : null;
                    const clearIdx = (h.attempts || []).findIndex(a => a.result === 'clear');
                    const shownAttempts = (h.attempts || []).slice(0, clearIdx === -1 ? undefined : clearIdx + 1);

                    return (
                      <View key={i} style={{ marginBottom: 10 }}>
                        <Row style={{ alignItems: 'center', gap: 8 }}>
                          <Pill text={fmtBar(h.heightIn, units)} />
                          {shownAttempts.map((a, idx) =>
                            <AttemptPill key={idx} result={a.result} />
                          )}
                        </Row>
                        {pole ? (
                          <View style={{ marginLeft: 14 }}>
                            <Row style={{ gap: 14 }}>
                              <Text style={styles.pText}>
                                {pole.brand ? `Brand: ${pole.brand}` : ''}
                                {pole.length ? `   Length: ${pole.length}` : ''}
                              </Text>
                            </Row>
                            <Row style={{ gap: 14 }}>
                              <Text style={styles.pText}>
                                {pole.flex ? `Flex: ${pole.flex}` : ''}
                                {pole.weight ? `   Weight: ${pole.weight}` : ''}
                              </Text>
                            </Row>
                            <Text style={styles.muted}>
                              Setup: Steps {pole.steps ?? '—'}, Approach {fmtFeetIn(Number(pole.approachFeet)*12 + Number(pole.approachInches))}, Takeoff {fmtTakeoff(pole.takeoffIn, units)}, Standards {fmtStandards(pole.standardsIn, units)}, Hands: {pole.hands ?? '—'}
                            </Text>
                          </View>
                        ) : (
                          <Text style={[styles.muted, { marginLeft: 14 }]}>No pole assigned.</Text>
                        )}
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
            {/* Practice: attempted heights with pole info */}
            {Array.isArray(session.heights) && session.heights.length > 0 && (
              <Field label="Attempted Heights">
                <View style={{ gap: 10 }}>
                  {session.heights.map((h, i) => {
                    const pole = (Array.isArray(session.poles) && h.poleIdx !== undefined && session.poles[h.poleIdx]) ? session.poles[h.poleIdx] : null;
                    const clearIdx = (h.attempts || []).findIndex(a => a.result === 'clear');
                    const shownAttempts = (h.attempts || []).slice(0, clearIdx === -1 ? undefined : clearIdx + 1);

                    return (
                      <View key={h.id || i} style={{ marginBottom: 10 }}>
                        <Row style={{ alignItems: 'center', gap: 8 }}>
                          <Pill text={fmtBar(h.heightIn, units)} />
                          {shownAttempts.map((a, idx) =>
                            <AttemptPill key={idx} result={a.result} />
                          )}
                        </Row>
                        {pole ? (
                          <View style={{ marginLeft: 14 }}>
                            <Row style={{ gap: 14 }}>
                              <Text style={styles.pText}>
                                {pole.brand ? `Brand: ${pole.brand}` : ''}
                                {pole.length ? `   Length: ${pole.length}` : ''}
                              </Text>
                            </Row>
                            <Row style={{ gap: 14 }}>
                              <Text style={styles.pText}>
                                {pole.flex ? `Flex: ${pole.flex}` : ''}
                                {pole.weight ? `   Weight: ${pole.weight}` : ''}
                              </Text>
                            </Row>
                            <Text style={styles.muted}>
                              Setup: Steps {pole.steps ?? '—'}, Approach {fmtFeetIn(Number(pole.approachFeet)*12 + Number(pole.approachInches))}, Takeoff {fmtTakeoff(pole.takeoffIn, units)}, Standards {fmtStandards(pole.standardsIn, units)}, Hands: {pole.hands ?? '—'}
                            </Text>
                          </View>
                        ) : (
                          <Text style={[styles.muted, { marginLeft: 14 }]}>No pole assigned.</Text>
                        )}
                      </View>
                    );
                  })}
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
  const { units } = usePVStore((s) => s.settings);
  const add = usePVStore((s) => s.addSession);
  const plan = usePVStore((s) => s.weeklyPlan);
  const allSessions = usePVStore((s) => s.sessions);

  const dayNameStr = todayName();
  const dayPlan = plan[dayNameStr] || { goals: '', routine: [] };

  const [date] = useState(new Date().toISOString());
  const [goals, setGoals] = useState(dayPlan.goals || '');

  // Routine logic
  const initialRoutine = useMemo(
    () => (dayPlan.routine || []).map((r) => ({ text: r, done: false, isHeader: isRoutineHeader(r) })),
    [dayPlan.routine]
  );
  const [routine, setRoutine] = useState(initialRoutine);

  // Heights & attempts logic
  const [heights, setHeights] = useState([]);
  const [addHeightFt, setAddHeightFt] = useState('');
  const [addHeightIn, setAddHeightIn] = useState('');
  const [addHeightM, setAddHeightM] = useState('');
  const [ftModalOpen, setFtModalOpen] = useState(false);
  const [inModalOpen, setInModalOpen] = useState(false);
  const [mModalOpen, setMModalOpen] = useState(false);
  const [addHeightPoleIdx, setAddHeightPoleIdx] = useState(null);
  const [poleSelectModalOpen, setPoleSelectModalOpen] = useState(false);

  // Poles section
  const [poles, setPoles] = useState([]);
  const [poleModalOpen, setPoleModalOpen] = useState(false);
  const [poleBrand, setPoleBrand] = useState('');
  const [poleLength, setPoleLength] = useState('');
  const [poleFlex, setPoleFlex] = useState('');
  const [poleWeight, setPoleWeight] = useState('');
  const [poleSteps, setPoleSteps] = useState('');
  const [poleApproachFeet, setPoleApproachFeet] = useState('');
  const [poleApproachInches, setPoleApproachInches] = useState('');
  const [poleTakeoffIn, setPoleTakeoffIn] = useState('');
  const [poleStandardsIn, setPoleStandardsIn] = useState('');
  const [poleHands, setPoleHands] = useState('');
  const [poleStepsOpen, setPoleStepsOpen] = useState(false);
  const [poleApproachFeetOpen, setPoleApproachFeetOpen] = useState(false);
  const [poleApproachInchesOpen, setPoleApproachInchesOpen] = useState(false);
  const [poleTakeoffModalOpen, setPoleTakeoffModalOpen] = useState(false);
  const [poleStandardsModalOpen, setPoleStandardsModalOpen] = useState(false);
  const [poleHandsOpen, setPoleHandsOpen] = useState(false);
  const [editPoleIdx, setEditPoleIdx] = useState(null);

  // Previous poles from all sessions (deduplicated)
  const previousPoles = useMemo(() => {
    const polesArr = [];
    (allSessions || []).forEach(sess => {
      if (Array.isArray(sess.poles)) {
        sess.poles.forEach(p => {
          const key = `${p.brand || ''}|${p.length || ''}|${p.flex || ''}|${p.weight || ''}`;
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
  const [recentPoleSelectOpen, setRecentPoleSelectOpen] = useState(false);

  // Dropdowns
  const stepOptions = useMemo(() => Array.from({ length: 15 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) })), []);
  const approachFeetOptions = useMemo(() => Array.from({ length: 150 }, (_, i) => ({ label: `${i + 1} ft`, value: i + 1 })), []);
  const approachInchesOptions = useMemo(() => Array.from({ length: 11 }, (_, i) => ({ label: `${i + 1} in`, value: i + 1 })), []);
  const takeoffFtOptions = useMemo(() => Array.from({ length: ((15 - 2) / 0.25) + 1 }, (_, i) => {
    const ft = 2 + i * 0.25;
    return { label: `${ft.toFixed(2)} ft`, value: Math.round(ft * 12) };
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
      arr.push({ label: `${m.toFixed(2)}`, value: m });
    }
    return arr;
  }, []);
  const handsOptions = useMemo(() => {
    const arr = [];
    for (let val = 1; val <= 10; val += 0.25) {
      arr.push({ label: val.toFixed(2), value: val });
    }
    return arr;
  }, []);

  const [notes, setNotes] = useState('');

  // Heights Add UI (same as meetform, requires pole)
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
                ? `Pole ${addHeightPoleIdx + 1}: ${poles[addHeightPoleIdx].brand || ''} ${poles[addHeightPoleIdx].length || ''} ${poles[addHeightPoleIdx].flex || ''} ${poles[addHeightPoleIdx].weight || ''}`
                : 'Select Pole'
            }
            onPress={() => setPoleSelectModalOpen(true)}
          />
          <DropdownModal
            visible={poleSelectModalOpen}
            title="Select Pole"
            options={poles.map((pole, idx) => ({
              label: `Pole ${idx + 1}: ${pole.brand || ''} ${pole.length || ''} ${pole.flex || ''} ${pole.weight || ''}`,
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
          onPress={() => {
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
          }}
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
                ? `Pole ${addHeightPoleIdx + 1}: ${poles[addHeightPoleIdx].brand || ''} ${poles[addHeightPoleIdx].length || ''} ${poles[addHeightPoleIdx].flex || ''} ${poles[addHeightPoleIdx].weight || ''}`
                : 'Select Pole'
            }
            onPress={() => setPoleSelectModalOpen(true)}
          />
          <DropdownModal
            visible={poleSelectModalOpen}
            title="Select Pole"
            options={poles.map((pole, idx) => ({
              label: `Pole ${idx + 1}: ${pole.brand || ''} ${pole.length || ''} ${pole.flex || ''} ${pole.weight || ''}`,
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
          onPress={() => {
            const m = Number(addHeightM);
            if (!m || isNaN(m)) return Alert.alert('Select a valid height');
            if (addHeightPoleIdx === null) return Alert.alert('Select a pole for this height');
            setHeights((arr) => [
              ...arr,
              {
                id: shortId(),
                heightIn: m * 39.3701,
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
          }}
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

  // FULL POLE MODAL
  const PoleModal = (
    <Modal visible={poleModalOpen} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.sectionTitle}>{editPoleIdx !== null ? "Edit Pole" : "Add Pole"}</Text>
          {previousPoles.length > 0 && (
            <Field label="Copy previous pole">
              <SimpleDropdown
                label="Select previous pole"
                valueLabel=""
                onPress={() => setRecentPoleSelectOpen(true)}
              />
              <DropdownModal
                visible={recentPoleSelectOpen}
                title="Select Previous Pole"
                options={previousPoles.map((pole, idx) => ({
                  label: `Pole ${idx + 1}: ${pole.brand || ''} ${pole.length || ''} ${pole.flex || ''} ${pole.weight || ''}`,
                  value: idx
                }))}
                onSelect={(opt) => {
                  const p = previousPoles[opt.value];
                  setPoleBrand(p.brand || '');
                  setPoleLength(p.length || '');
                  setPoleFlex(p.flex || '');
                  setPoleWeight(p.weight || '');
                  setPoleSteps(p.steps || '');
                  setPoleApproachFeet(p.approachFeet || '');
                  setPoleApproachInches(p.approachInches || '');
                  setPoleTakeoffIn(p.takeoffIn || '');
                  setPoleStandardsIn(p.standardsIn || '');
                  setPoleHands(p.hands || '');
                  setRecentPoleSelectOpen(false);
                }}
                onClose={() => setRecentPoleSelectOpen(false)}
              />
            </Field>
          )}
          <Row style={{ gap: 8 }}>
            <Field label="Brand">
              <TextInput
                value={poleBrand}
                onChangeText={setPoleBrand}
                style={[styles.input, { width: 110 }]}
                placeholder="Brand"
              />
            </Field>
            <Field label="Length">
              <TextInput
                value={poleLength}
                onChangeText={setPoleLength}
                style={[styles.input, { width: 90 }]}
                placeholder="Length"
              />
            </Field>
          </Row>
          <Row style={{ gap: 8 }}>
            <Field label="Flex">
              <TextInput
                value={poleFlex}
                onChangeText={setPoleFlex}
                style={[styles.input, { width: 90 }]}
                placeholder="Flex"
              />
            </Field>
            <Field label="Weight">
              <TextInput
                value={poleWeight}
                onChangeText={setPoleWeight}
                style={[styles.input, { width: 90 }]}
                placeholder="Weight"
              />
            </Field>
          </Row>
          <Field label="Steps">
            <SimpleDropdown
              label="Select steps"
              valueLabel={poleSteps ? `${poleSteps}` : 'Select steps'}
              onPress={() => setPoleStepsOpen(true)}
            />
            <DropdownModal
              visible={poleStepsOpen}
              title="Steps"
              options={stepOptions}
              onSelect={(opt) => setPoleSteps(opt.value)}
              onClose={() => setPoleStepsOpen(false)}
            />
          </Field>
          <Field label="Approach">
            <Row style={{ gap: 8 }}>
              <View style={{ flex: 1 }}>
                <SimpleDropdown
                  label="Feet"
                  valueLabel={poleApproachFeet ? `${poleApproachFeet} ft` : 'Feet'}
                  onPress={() => setPoleApproachFeetOpen(true)}
                />
                <DropdownModal
                  visible={poleApproachFeetOpen}
                  title="Feet"
                  options={approachFeetOptions}
                  onSelect={(opt) => setPoleApproachFeet(opt.value)}
                  onClose={() => setPoleApproachFeetOpen(false)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <SimpleDropdown
                  label="Inches"
                  valueLabel={poleApproachInches ? `${poleApproachInches} in` : 'Inches'}
                  onPress={() => setPoleApproachInchesOpen(true)}
                />
                <DropdownModal
                  visible={poleApproachInchesOpen}
                  title="Inches"
                  options={approachInchesOptions}
                  onSelect={(opt) => setPoleApproachInches(opt.value)}
                  onClose={() => setPoleApproachInchesOpen(false)}
                />
              </View>
            </Row>
          </Field>
          <Field label="Takeoff Mark (FT)">
            <SimpleDropdown
              label="Select takeoff mark"
              valueLabel={poleTakeoffIn ? `${(poleTakeoffIn / 12).toFixed(2)} ft` : 'Select takeoff mark'}
              onPress={() => setPoleTakeoffModalOpen(true)}
            />
            <DropdownModal
              visible={poleTakeoffModalOpen}
              title="Takeoff Mark (ft)"
              options={takeoffFtOptions}
              onSelect={(opt) => { setPoleTakeoffIn(opt.value); setPoleTakeoffModalOpen(false); }}
              onClose={() => setPoleTakeoffModalOpen(false)}
            />
          </Field>
          <Field label={`Standards setting (${units === 'metric' ? 'cm' : 'in'})`}>
            {units === 'imperial'
              ? <>
                  <SimpleDropdown
                    label="Select standards"
                    valueLabel={poleStandardsIn ? `${poleStandardsIn}"` : 'Select standards'}
                    onPress={() => setPoleStandardsModalOpen(true)}
                  />
                  <DropdownModal
                    visible={poleStandardsModalOpen}
                    title="Standards (in)"
                    options={standardsInOptions}
                    onSelect={(opt) => { setPoleStandardsIn(opt.value); setPoleStandardsModalOpen(false); }}
                    onClose={() => setPoleStandardsModalOpen(false)}
                  />
                </>
              : <>
                  <SimpleDropdown
                    label="Select standards (cm)"
                    valueLabel={poleStandardsIn ? `${Math.round(poleStandardsIn * 2.54)} cm` : 'Select standards (cm)'}
                    onPress={() => setPoleStandardsModalOpen(true)}
                  />
                  <DropdownModal
                    visible={poleStandardsModalOpen}
                    title="Standards (cm)"
                    options={standardsCmOptions}
                    onSelect={(opt) => { setPoleStandardsIn(opt.value); setPoleStandardsModalOpen(false); }}
                    onClose={() => setPoleStandardsModalOpen(false)}
                  />
                </>
            }
          </Field>
          <Field label="Hands">
            <SimpleDropdown
              label="Select hands"
              valueLabel={poleHands ? poleHands.toString() : 'Hands'}
              onPress={() => setPoleHandsOpen(true)}
            />
            <DropdownModal
              visible={poleHandsOpen}
              title="Hands"
              options={handsOptions}
              onSelect={(opt) => { setPoleHands(opt.value); setPoleHandsOpen(false); }}
              onClose={() => setPoleHandsOpen(false)}
            />
          </Field>
          <Row style={{ justifyContent: 'flex-end', gap: 8 }}>
            <ButtonSecondary title="Cancel" onPress={() => { setPoleModalOpen(false); setEditPoleIdx(null); }} />
            <ButtonPrimary title="Save" onPress={() => {
              if (!poleLength && !poleFlex && !poleWeight) return;
              const poleObj = {
                brand: poleBrand,
                length: poleLength,
                flex: poleFlex,
                weight: poleWeight,
                steps: poleSteps,
                approachFeet: poleApproachFeet,
                approachInches: poleApproachInches,
                takeoffIn: poleTakeoffIn,
                standardsIn: poleStandardsIn,
                hands: poleHands
              };
              if (editPoleIdx !== null) {
                setPoles(poles.map((p, i) => i === editPoleIdx ? poleObj : p));
              } else {
                setPoles([...poles, poleObj]);
              }
              setPoleModalOpen(false);
              setEditPoleIdx(null);
              setPoleBrand('');
              setPoleLength('');
              setPoleFlex('');
              setPoleWeight('');
              setPoleSteps('');
              setPoleApproachFeet('');
              setPoleApproachInches('');
              setPoleTakeoffIn('');
              setPoleStandardsIn('');
              setPoleHands('');
            }} />
          </Row>
        </View>
      </View>
    </Modal>
  );

  // Save logic
  const save = () => {
    const sess = {
      id: shortId(),
      type: 'practice',
      date,
      dayName: dayNameStr,
      goals,
      poles,
      heights,
      notes,
      routine: routine.map(({ text, done, isHeader }) => ({ text, done: !!done, isHeader: !!isHeader })),
    };
    add(sess);
    Alert.alert('Practice Saved!', 'Your practice session has been logged.');
    navigation.goBack();
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16 }}>
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
                      onToggle={() => setRoutine(list => list.map((it, i) => i === idx && !it.isHeader ? { ...it, done: !it.done } : it))}
                    />
                  )
                )}
              </View>
            ) : (
              <Text style={styles.muted}>No routine items for today.</Text>
            )}
          </Field>
          <Section title="Poles">
            {poles.length === 0 ? (
              <Text style={styles.muted}>No poles added yet.</Text>
            ) : (
              <>
                {poles.map((pole, idx) => (
                  <View key={idx} style={{ marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderColor: '#eee' }}>
                    <Row style={{ gap: 14 }}>
                      <Text style={styles.pText}>
                        {pole.brand ? `Brand: ${pole.brand}` : ''}
                        {pole.length ? `   Length: ${pole.length}` : ''}
                      </Text>
                    </Row>
                    <Row style={{ gap: 14 }}>
                      <Text style={styles.pText}>
                        {pole.flex ? `Flex: ${pole.flex}` : ''}
                        {pole.weight ? `   Weight: ${pole.weight}` : ''}
                      </Text>
                    </Row>
                    <Text style={styles.muted}>
                      Setup: Steps {pole.steps ?? '—'}, Approach {fmtFeetIn(Number(pole.approachFeet)*12 + Number(pole.approachInches))}, Takeoff {fmtTakeoff(pole.takeoffIn, units)}, Standards {fmtStandards(pole.standardsIn, units)}, Hands: {pole.hands ?? '—'}
                    </Text>
                    <Row style={{ justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                      <ButtonSecondary
                        title="Edit"
                        onPress={() => {
                          setEditPoleIdx(idx);
                          setPoleBrand(pole.brand);
                          setPoleLength(pole.length);
                          setPoleFlex(pole.flex);
                          setPoleWeight(pole.weight);
                          setPoleSteps(pole.steps);
                          setPoleApproachFeet(pole.approachFeet);
                          setPoleApproachInches(pole.approachInches);
                          setPoleTakeoffIn(pole.takeoffIn);
                          setPoleStandardsIn(pole.standardsIn);
                          setPoleHands(pole.hands);
                          setPoleModalOpen(true);
                        }}
                        style={{ marginBottom: 4 }}
                      />
                      <ButtonSecondary
                        title="Remove"
                        onPress={() => setPoles(poles.filter((_, i) => i !== idx))}
                      />
                    </Row>
                  </View>
                ))}
              </>
            )}
            <ButtonPrimary title="Add Pole" onPress={() => {
              setEditPoleIdx(null);
              setPoleBrand('');
              setPoleLength('');
              setPoleFlex('');
              setPoleWeight('');
              setPoleSteps('');
              setPoleApproachFeet('');
              setPoleApproachInches('');
              setPoleTakeoffIn('');
              setPoleStandardsIn('');
              setPoleHands('');
              setPoleModalOpen(true);
            }} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
          </Section>
          {PoleModal}
          <Section title="Heights & Attempts">
            <Text style={[styles.muted, { marginBottom: 8 }]}>
              Add multiple heights for this practice. Each height has 3 attempts and must be assigned a pole.
            </Text>
            {HeightAddUI}
            {heights.length ? (
              heights.map((h, heightIdx) => {
                const pole = h.poleIdx !== undefined && poles[h.poleIdx] ? poles[h.poleIdx] : null;
                return (
                  <View key={h.id} style={styles.cardRow}>
                    <Text style={styles.fieldLabel}>Height</Text>
                    <Text style={styles.pText}>{fmtBar(h.heightIn, units)}</Text>
                    {pole ? (
                      <View style={{ marginBottom: 6 }}>
                        <Text style={styles.fieldLabel}>Pole Used</Text>
                        <Row style={{ gap: 14 }}>
                          <Text style={styles.pText}>
                            {pole.brand ? `Brand: ${pole.brand}` : ''}
                            {pole.length ? `   Length: ${pole.length}` : ''}
                          </Text>
                        </Row>
                        <Row style={{ gap: 14 }}>
                          <Text style={styles.pText}>
                            {pole.flex ? `Flex: ${pole.flex}` : ''}
                            {pole.weight ? `   Weight: ${pole.weight}` : ''}
                          </Text>
                        </Row>
                        <Text style={styles.muted}>
                          Setup: Steps {pole.steps ?? '—'}, Approach {fmtFeetIn(Number(pole.approachFeet) * 12 + Number(pole.approachInches))}, Takeoff {fmtTakeoff(pole.takeoffIn, units)}, Standards {fmtStandards(pole.standardsIn, units)}, Hands: {pole.hands ?? '—'}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.muted}>No pole assigned.</Text>
                    )}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                      {h.attempts.map((attempt, attemptIdx) => (
                        <Pressable
                          key={attemptIdx}
                          onPress={() => {
                            setHeights(heightsArr => heightsArr.map((heightItem, i) =>
                              i === heightIdx
                                ? {
                                    ...heightItem,
                                    attempts: heightItem.attempts.map((a, j) =>
                                      j === attemptIdx
                                        ? { ...a, result: a.result === 'clear' ? 'miss' : 'clear' }
                                        : a
                                    )
                                  }
                                : heightItem
                            ));
                          }}
                          style={{
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 8,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: attempt.result === 'clear' ? 'green' : 'red',
                            backgroundColor: attempt.result === 'clear' ? '#e6ffe6' : '#ffe6e6',
                            minWidth: 56,
                            marginRight: 8,
                          }}>
                          <Text style={{ fontWeight: 'bold', fontSize: 16, color: attempt.result === 'clear' ? 'green' : 'red' }}>
                            {attempt.result === 'clear' ? 'O' : 'X'}
                          </Text>
                          <Text style={{ fontSize: 12 }}>{attempt.idx}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.muted}>No heights added yet.</Text>
            )}
          </Section>
          <Field label="Notes">
            <TextInput value={notes} onChangeText={setNotes} placeholder="session notes…" style={[styles.input, { height: 90 }]} multiline />
          </Field>
          <ButtonPrimary title="Save Practice" onPress={save} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function MeetFormScreen({ navigation }) {
  const { units } = usePVStore((s) => s.settings);
  const add = usePVStore((s) => s.addSession);
  const allSessions = usePVStore((s) => s.sessions);

  const [date] = useState(new Date().toISOString());
  const [meetName, setMeetName] = useState('');
  const [goals, setGoals] = useState('');
  const [notes, setNotes] = useState('');

  // Heights logic
  const [heights, setHeights] = useState([]);
  const [addHeightFt, setAddHeightFt] = useState('');
  const [addHeightIn, setAddHeightIn] = useState('');
  const [addHeightM, setAddHeightM] = useState('');
  const [ftModalOpen, setFtModalOpen] = useState(false);
  const [inModalOpen, setInModalOpen] = useState(false);
  const [mModalOpen, setMModalOpen] = useState(false);
  const [addHeightPoleIdx, setAddHeightPoleIdx] = useState(null);
  const [poleSelectModalOpen, setPoleSelectModalOpen] = useState(false);

  // Poles logic + full per-pole setup
  const [poles, setPoles] = useState([]);
  const [poleModalOpen, setPoleModalOpen] = useState(false);
  const [poleBrand, setPoleBrand] = useState('');
  const [poleLength, setPoleLength] = useState('');
  const [poleFlex, setPoleFlex] = useState('');
  const [poleWeight, setPoleWeight] = useState('');
  const [poleSteps, setPoleSteps] = useState('');
  const [poleApproachFeet, setPoleApproachFeet] = useState('');
  const [poleApproachInches, setPoleApproachInches] = useState('');
  const [poleTakeoffIn, setPoleTakeoffIn] = useState('');
  const [poleStandardsIn, setPoleStandardsIn] = useState('');
  const [poleHands, setPoleHands] = useState('');
  const [poleStepsOpen, setPoleStepsOpen] = useState(false);
  const [poleApproachFeetOpen, setPoleApproachFeetOpen] = useState(false);
  const [poleApproachInchesOpen, setPoleApproachInchesOpen] = useState(false);
  const [poleTakeoffModalOpen, setPoleTakeoffModalOpen] = useState(false);
  const [poleStandardsModalOpen, setPoleStandardsModalOpen] = useState(false);
  const [poleHandsOpen, setPoleHandsOpen] = useState(false);
  const [editPoleIdx, setEditPoleIdx] = useState(null);

  // Previous poles from all sessions (deduplicated)
  const previousPoles = useMemo(() => {
    const polesArr = [];
    (allSessions || []).forEach(sess => {
      if (Array.isArray(sess.poles)) {
        sess.poles.forEach(p => {
          const key = `${p.brand || ''}|${p.length || ''}|${p.flex || ''}|${p.weight || ''}`;
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
  const [recentPoleSelectOpen, setRecentPoleSelectOpen] = useState(false);

  // Dropdown options
  const stepOptions = useMemo(() => Array.from({ length: 20 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) })), []);
  const approachFeetOptions = useMemo(() => Array.from({ length: 150 }, (_, i) => ({ label: `${i + 1} ft`, value: i + 1 })), []);
  const approachInchesOptions = useMemo(() => Array.from({ length: 11 }, (_, i) => ({ label: `${i + 1} in`, value: i + 1 })), []);
  const takeoffFtOptions = useMemo(() => Array.from({ length: ((15 - 2) / 0.25) + 1 }, (_, i) => {
    const ft = 2 + i * 0.25;
    return { label: `${ft.toFixed(2)} ft`, value: Math.round(ft * 12) };
  }), []);
  const standardsInOptions = useMemo(() => Array.from({ length: ((31.5 - 18) / 0.25) + 1 }, (_, i) => {
    const val = 18 + i * 0.25;
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
      arr.push({ label: `${m.toFixed(2)}`, value: m });
    }
    return arr;
  }, []);
  const handsOptions = useMemo(() => {
    const arr = [];
    for (let val = 1; val <= 10; val += 0.25) {
      arr.push({ label: val.toFixed(2), value: val });
    }
    return arr;
  }, []);

  // Heights add UI (with pole selector)
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
                ? `Pole ${addHeightPoleIdx + 1}: ${poles[addHeightPoleIdx].brand || ''} ${poles[addHeightPoleIdx].length || ''} ${poles[addHeightPoleIdx].flex || ''} ${poles[addHeightPoleIdx].weight || ''}`
                : 'Select Pole'
            }
            onPress={() => setPoleSelectModalOpen(true)}
          />
          <DropdownModal
            visible={poleSelectModalOpen}
            title="Select Pole"
            options={poles.map((pole, idx) => ({
              label: `Pole ${idx + 1}: ${pole.brand || ''} ${pole.length || ''} ${pole.flex || ''} ${pole.weight || ''}`,
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
          onPress={() => {
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
          }}
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
                ? `Pole ${addHeightPoleIdx + 1}: ${poles[addHeightPoleIdx].brand || ''} ${poles[addHeightPoleIdx].length || ''} ${poles[addHeightPoleIdx].flex || ''} ${poles[addHeightPoleIdx].weight || ''}`
                : 'Select Pole'
            }
            onPress={() => setPoleSelectModalOpen(true)}
          />
          <DropdownModal
            visible={poleSelectModalOpen}
            title="Select Pole"
            options={poles.map((pole, idx) => ({
              label: `Pole ${idx + 1}: ${pole.brand || ''} ${pole.length || ''} ${pole.flex || ''} ${pole.weight || ''}`,
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
          onPress={() => {
            const m = Number(addHeightM);
            if (!m || isNaN(m)) return Alert.alert('Select a valid height');
            if (addHeightPoleIdx === null) return Alert.alert('Select a pole for this height');
            setHeights((arr) => [
              ...arr,
              {
                id: shortId(),
                heightIn: m * 39.3701,
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
          }}
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

  // FULL POLE MODAL (with copy previous pole)
  const PoleModal = (
    <Modal visible={poleModalOpen} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.sectionTitle}>{editPoleIdx !== null ? "Edit Pole" : "Add Pole"}</Text>
          {previousPoles.length > 0 && (
            <Field label="Copy previous pole">
              <SimpleDropdown
                label="Select previous pole"
                valueLabel=""
                onPress={() => setRecentPoleSelectOpen(true)}
              />
              <DropdownModal
                visible={recentPoleSelectOpen}
                title="Select Previous Pole"
                options={previousPoles.map((pole, idx) => ({
                  label: `Pole ${idx + 1}: ${pole.brand || ''} ${pole.length || ''} ${pole.flex || ''} ${pole.weight || ''}`,
                  value: idx
                }))}
                onSelect={(opt) => {
                  const p = previousPoles[opt.value];
                  setPoleBrand(p.brand || '');
                  setPoleLength(p.length || '');
                  setPoleFlex(p.flex || '');
                  setPoleWeight(p.weight || '');
                  setPoleSteps(p.steps || '');
                  setPoleApproachFeet(p.approachFeet || '');
                  setPoleApproachInches(p.approachInches || '');
                  setPoleTakeoffIn(p.takeoffIn || '');
                  setPoleStandardsIn(p.standardsIn || '');
                  setPoleHands(p.hands || '');
                  setRecentPoleSelectOpen(false);
                }}
                onClose={() => setRecentPoleSelectOpen(false)}
              />
            </Field>
          )}
          <Row style={{ gap: 8 }}>
  <Field label="Brand">
    <TextInput
      value={poleBrand}
      onChangeText={setPoleBrand}
      style={[styles.input, { width: 110 }]}
      placeholder="Brand"
    />
  </Field>
  <Field label="Length">
    <TextInput
      value={poleLength}
      onChangeText={setPoleLength}
      style={[styles.input, { width: 90 }]}
      placeholder="Length"
    />
  </Field>
</Row>
<Row style={{ gap: 8 }}>
  <Field label="Flex">
    <TextInput
      value={poleFlex}
      onChangeText={setPoleFlex}
      style={[styles.input, { width: 90 }]}
      placeholder="Flex"
    />
  </Field>
  <Field label="Weight">
    <TextInput
      value={poleWeight}
      onChangeText={setPoleWeight}
      style={[styles.input, { width: 90 }]}
      placeholder="Weight"
    />
  </Field>
</Row>
          {/* Steps dropdown */}
          <Field label="Steps">
            <SimpleDropdown
              label="Select steps"
              valueLabel={poleSteps ? `${poleSteps}` : 'Select steps'}
              onPress={() => setPoleStepsOpen(true)}
            />
            <DropdownModal
              visible={poleStepsOpen}
              title="Steps"
              options={stepOptions}
              onSelect={(opt) => setPoleSteps(opt.value)}
              onClose={() => setPoleStepsOpen(false)}
            />
          </Field>
          {/* Approach dropdowns */}
          <Field label="Approach">
            <Row style={{ gap: 8 }}>
              <View style={{ flex: 1 }}>
                <SimpleDropdown
                  label="Feet"
                  valueLabel={poleApproachFeet ? `${poleApproachFeet} ft` : 'Feet'}
                  onPress={() => setPoleApproachFeetOpen(true)}
                />
                <DropdownModal
                  visible={poleApproachFeetOpen}
                  title="Feet"
                  options={approachFeetOptions}
                  onSelect={(opt) => setPoleApproachFeet(opt.value)}
                  onClose={() => setPoleApproachFeetOpen(false)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <SimpleDropdown
                  label="Inches"
                  valueLabel={poleApproachInches ? `${poleApproachInches} in` : 'Inches'}
                  onPress={() => setPoleApproachInchesOpen(true)}
                />
                <DropdownModal
                  visible={poleApproachInchesOpen}
                  title="Inches"
                  options={approachInchesOptions}
                  onSelect={(opt) => setPoleApproachInches(opt.value)}
                  onClose={() => setPoleApproachInchesOpen(false)}
                />
              </View>
            </Row>
          </Field>
          {/* Takeoff mark dropdown */}
          <Field label="Takeoff Mark (FT)">
            <SimpleDropdown
              label="Select takeoff mark"
              valueLabel={poleTakeoffIn ? `${(poleTakeoffIn / 12).toFixed(2)} ft` : 'Select takeoff mark'}
              onPress={() => setPoleTakeoffModalOpen(true)}
            />
            <DropdownModal
              visible={poleTakeoffModalOpen}
              title="Takeoff Mark (ft)"
              options={takeoffFtOptions}
              onSelect={(opt) => { setPoleTakeoffIn(opt.value); setPoleTakeoffModalOpen(false); }}
              onClose={() => setPoleTakeoffModalOpen(false)}
            />
          </Field>
          {/* Standards dropdown */}
          <Field label={`Standards setting (${units === 'metric' ? 'cm' : 'in'})`}>
            {units === 'imperial'
              ? <>
                  <SimpleDropdown
                    label="Select standards"
                    valueLabel={poleStandardsIn ? `${poleStandardsIn}"` : 'Select standards'}
                    onPress={() => setPoleStandardsModalOpen(true)}
                  />
                  <DropdownModal
                    visible={poleStandardsModalOpen}
                    title="Standards (in)"
                    options={standardsInOptions}
                    onSelect={(opt) => { setPoleStandardsIn(opt.value); setPoleStandardsModalOpen(false); }}
                    onClose={() => setPoleStandardsModalOpen(false)}
                  />
                </>
              : <>
                  <SimpleDropdown
                    label="Select standards (cm)"
                    valueLabel={poleStandardsIn ? `${Math.round(poleStandardsIn * 2.54)} cm` : 'Select standards (cm)'}
                    onPress={() => setPoleStandardsModalOpen(true)}
                  />
                  <DropdownModal
                    visible={poleStandardsModalOpen}
                    title="Standards (cm)"
                    options={standardsCmOptions}
                    onSelect={(opt) => { setPoleStandardsIn(opt.value); setPoleStandardsModalOpen(false); }}
                    onClose={() => setPoleStandardsModalOpen(false)}
                  />
                </>
            }
          </Field>
          {/* Hands dropdown */}
          <Field label="Hands">
            <SimpleDropdown
              label="Select hands"
              valueLabel={poleHands ? poleHands.toString() : 'Hands'}
              onPress={() => setPoleHandsOpen(true)}
            />
            <DropdownModal
              visible={poleHandsOpen}
              title="Hands"
              options={handsOptions}
              onSelect={(opt) => { setPoleHands(opt.value); setPoleHandsOpen(false); }}
              onClose={() => setPoleHandsOpen(false)}
            />
          </Field>
          <Row style={{ justifyContent: 'flex-end', gap: 8 }}>
            <ButtonSecondary title="Cancel" onPress={() => { setPoleModalOpen(false); setEditPoleIdx(null); }} />
            <ButtonPrimary title="Save" onPress={() => {
              if (!poleLength && !poleFlex && !poleWeight) return;
              const poleObj = {
                brand: poleBrand,
                length: poleLength,
                flex: poleFlex,
                weight: poleWeight,
                steps: poleSteps,
                approachFeet: poleApproachFeet,
                approachInches: poleApproachInches,
                takeoffIn: poleTakeoffIn,
                standardsIn: poleStandardsIn,
                hands: poleHands
              };
              if (editPoleIdx !== null) {
                setPoles(poles.map((p, i) => i === editPoleIdx ? poleObj : p));
              } else {
                setPoles([...poles, poleObj]);
              }
              setPoleModalOpen(false);
              setEditPoleIdx(null);
              setPoleBrand('');
              setPoleLength('');
              setPoleFlex('');
              setPoleWeight('');
              setPoleSteps('');
              setPoleApproachFeet('');
              setPoleApproachInches('');
              setPoleTakeoffIn('');
              setPoleStandardsIn('');
              setPoleHands('');
            }} />
          </Row>
        </View>
      </View>
    </Modal>
  );

  // Save logic
  const save = () => {
    const sess = {
      id: shortId(),
      type: 'meet',
      date,
      meetName: meetName?.trim() || undefined,
      goals,
      attempts: heights.map(({ heightIn, attempts, poleIdx }) => ({
        heightIn,
        attempts,
        poleIdx,
      })),
      notes,
      poles,
    };
    add(sess);
    Alert.alert('Meet Saved!', 'Your meet session has been logged.');
    navigation.goBack();
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16, paddingBottom: 48 }}>
        <Section title="New Meet">
          <Field label="Meet name">
            <TextInput value={meetName} onChangeText={setMeetName} placeholder="e.g., Conference Finals" style={styles.input} />
          </Field>
          <Field label="Goals">
            <TextInput value={goals} onChangeText={setGoals} placeholder="e.g., open @ 11'6, PR attempt 12'6" style={styles.input} />
          </Field>
          <Section title="Poles">
            {poles.length === 0 ? (
              <Text style={styles.muted}>No poles added yet.</Text>
            ) : (
              <>
                {poles.map((pole, idx) => (
  <View key={idx} style={{ marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderColor: '#eee' }}>
    {/* Brand & Length on the same line */}
    <Row style={{ gap: 14 }}>
      <Text style={styles.pText}>
        {pole.brand ? `Brand: ${pole.brand}` : ''}
        {pole.length ? `   Length: ${pole.length}` : ''}
      </Text>
    </Row>
    {/* Flex & Weight on the same line */}
    <Row style={{ gap: 14 }}>
      <Text style={styles.pText}>
        {pole.flex ? `Flex: ${pole.flex}` : ''}
        {pole.weight ? `   Weight: ${pole.weight}` : ''}
      </Text>
    </Row>
    {/* Setup - unchanged */}
    <Text style={styles.muted}>
      Setup: Steps {pole.steps ?? '—'}, Approach {fmtFeetIn(Number(pole.approachFeet)*12 + Number(pole.approachInches))}, Takeoff {fmtTakeoff(pole.takeoffIn, units)}, Standards {fmtStandards(pole.standardsIn, units)}, Hands: {pole.hands ?? '—'}
    </Text>
    <Row style={{ justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
      <ButtonSecondary
        title="Edit"
        onPress={() => {
          // ...edit logic...
        }}
        style={{ marginBottom: 4 }}
      />
      <ButtonSecondary
        title="Remove"
        onPress={() => {
          // ...remove logic...
        }}
      />
    </Row>
  </View>
))}
              </>
            )}
            <ButtonPrimary title="Add Pole" onPress={() => {
              setEditPoleIdx(null);
              setPoleBrand('');
              setPoleLength('');
              setPoleFlex('');
              setPoleWeight('');
              setPoleSteps('');
              setPoleApproachFeet('');
              setPoleApproachInches('');
              setPoleTakeoffIn('');
              setPoleStandardsIn('');
              setPoleHands('');
              setPoleModalOpen(true);
            }} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
          </Section>
          {PoleModal}
          <Section title="Heights & Attempts">
            <Text style={[styles.muted, { marginBottom: 8 }]}>Add multiple heights for this meet. Each height has 3 attempts and must be assigned a pole.</Text>
            {HeightAddUI}
           {heights.length ? (
  heights.map((h, heightIdx) => {
    const pole = h.poleIdx !== undefined && poles[h.poleIdx] ? poles[h.poleIdx] : null;
    return (
      <View key={h.id} style={styles.cardRow}>
        <Text style={styles.fieldLabel}>Height</Text>
        <Text style={styles.pText}>{fmtBar(h.heightIn, units)}</Text>

        {/* POLE INFO */}
        {pole ? (
          <View style={{ marginBottom: 6 }}>
            <Text style={styles.fieldLabel}>Pole Used</Text>
            <Row style={{ gap: 14 }}>
              <Text style={styles.pText}>
                {pole.brand ? `Brand: ${pole.brand}` : ''}
                {pole.length ? `   Length: ${pole.length}` : ''}
              </Text>
            </Row>
            <Row style={{ gap: 14 }}>
              <Text style={styles.pText}>
                {pole.flex ? `Flex: ${pole.flex}` : ''}
                {pole.weight ? `   Weight: ${pole.weight}` : ''}
              </Text>
            </Row>
            <Text style={styles.muted}>
              Setup: Steps {pole.steps ?? '—'}, Approach {fmtFeetIn(Number(pole.approachFeet) * 12 + Number(pole.approachInches))}, Takeoff {fmtTakeoff(pole.takeoffIn, units)}, Standards {fmtStandards(pole.standardsIn, units)}, Hands: {pole.hands ?? '—'}
            </Text>
          </View>
        ) : (
          <Text style={styles.muted}>No pole assigned.</Text>
        )}
        {/* ATTEMPTS UI */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
          {h.attempts.map((attempt, attemptIdx) => (
            <Pressable
              key={attemptIdx}
              onPress={() => {
                setHeights(heightsArr => heightsArr.map((heightItem, i) =>
                  i === heightIdx
                    ? {
                        ...heightItem,
                        attempts: heightItem.attempts.map((a, j) =>
                          j === attemptIdx
                            ? { ...a, result: a.result === 'clear' ? 'miss' : 'clear' }
                            : a
                        )
                      }
                    : heightItem
                ));
              }}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                padding: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: attempt.result === 'clear' ? 'green' : 'red',
                backgroundColor: attempt.result === 'clear' ? '#e6ffe6' : '#ffe6e6',
                minWidth: 56,
                marginRight: 8,
              }}>
              <Text style={{ fontWeight: 'bold', fontSize: 16, color: attempt.result === 'clear' ? 'green' : 'red' }}>
                {attempt.result === 'clear' ? 'O' : 'X'}
              </Text>
              <Text style={{ fontSize: 12 }}>{attempt.idx}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  })
) : (
  <Text style={styles.muted}>No heights added yet.</Text>
)}
          </Section>
          <Field label="Notes">
            <TextInput value={notes} onChangeText={setNotes} placeholder="meet notes…" style={[styles.input, { height: 90 }]} multiline />
          </Field>
          <ButtonPrimary title="Save Meet" onPress={save} />
        </Section>
      </ScrollView>
    </SafeAreaView>
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
  //console.log("Plan from store:", plan);

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
    <Tab.Screen name="Poles" component={PolesScreen} />
    <Tab.Screen name="Video" component={VideoScreen} />
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

export {
  DropdownModal, SimpleDropdown
};
