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
  Pressable,
  ScrollView,
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
const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const todayIdx = () => new Date().getDay();
const todayName = () => days[todayIdx()];
const inchesToCm = (inches) => (Number(inches) || 0) * 2.54;
const cmToInches = (cm) => (Number(cm) || 0) / 2.54;

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

const shortId = () => (global.crypto?.randomUUID ? global.crypto.randomUUID() : Math.random().toString(36).slice(2, 9));

// -------------------- Static Weekly Plan --------------------
const defaultWeeklyPlan = {
  Sunday: { goals: '', routine: ['Recovery jog 20 min', 'Mobility & foam roll'] },
  Monday: { goals: 'Speed + Takeoff focus', routine: ['Dynamic warm-up', '3-5 step pop-ups', 'Short-run takeoffs (3-5L)', 'Core circuit'] },
  Tuesday: { goals: 'Technical vault', routine: ['Full approach drills', '6-8 takeoffs', '3-6 bar attempts', 'Video review'] },
  Wednesday: { goals: 'Strength + Active recovery', routine: ['Lift (posterior chain)', 'Hurdle mobility', 'Stretching'] },
  Thursday: { goals: 'Standards & Mid control', routine: ['Run-throughs', 'Mid mark checks', 'Standards calibration'] },
  Friday: { goals: 'Light session / pre-meet', routine: ['Warm-up', 'Drills only', '2-4 easy vaults'] },
  Saturday: { goals: 'Meet day goals here', routine: ['Warm-up checklist', 'Standards & mid check', 'Opening height plan'] },
};

// -------------------- Store --------------------
const usePVStore = create(
  persist(
    (set, get) => ({
      settings: { units: 'imperial' },
      weeklyPlan: defaultWeeklyPlan, // read-only in UI
      sessions: [],

      setUnits: (units) => set((s) => ({ settings: { ...s.settings, units } })),
      addSession: (session) => set((s) => ({ sessions: [session, ...s.sessions] })),
      updateSession: (id, patch) =>
        set((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      deleteSession: (id) => set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) })),
    }),
    { name: 'polevault-tracker-store', storage: createJSONStorage(() => AsyncStorage), version: 3 }
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

const CheckboxChip = ({ checked, label, onToggle }) => (
  <Pressable
    onPress={onToggle}
    style={[styles.checkboxChip, checked ? styles.checkboxChipOn : null]}>
    <Text style={[styles.checkboxText, checked ? styles.checkboxTextOn : null]}>
      {checked ? '✓ ' : '○ '} {label}
    </Text>
  </Pressable>
);

// Screen wrapper with SAU watermark
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

function UnitAwareHeightInput({ units, valueInches, onChangeInches, placeholder }) {
  const [feet, setFeet] = useState(fromInches(valueInches).feet.toString());
  const [inches, setInches] = useState(fromInches(valueInches).inches.toString());
  const [cm, setCm] = useState(Math.round(inchesToCm(valueInches)).toString());

  React.useEffect(() => {
    if (units === 'imperial') {
      const { feet: f, inches: i } = fromInches(valueInches);
      setFeet(String(f));
      setInches(String(i));
    } else {
      setCm(String(Math.round(inchesToCm(valueInches))));
    }
  }, [units, valueInches]);

  const handleImperial = (f, i) => { setFeet(f); setInches(i); onChangeInches(toInches({ feet: Number(f), inches: Number(i) })); };
  const handleMetric = (c) => { setCm(c); onChangeInches(cmToInches(Number(c))); };

  if (units === 'imperial') {
    return (
      <Row>
        <TextInput value={feet} onChangeText={(t) => handleImperial(t, inches)} keyboardType="number-pad" placeholder="ft" style={styles.inputSmall} />
        <Text style={{ fontSize: 16 }}>ft</Text>
        <TextInput value={inches} onChangeText={(t) => handleImperial(feet, t)} keyboardType="number-pad" placeholder="in" style={styles.inputSmall} />
        <Text style={{ fontSize: 16 }}>in</Text>
      </Row>
    );
  }
  return (
    <Row>
      <TextInput value={cm} onChangeText={(t) => handleMetric(t)} keyboardType="number-pad" placeholder={placeholder || 'cm'} style={styles.input} />
      <Text style={{ fontSize: 16 }}>cm</Text>
    </Row>
  );
}

function NumberInput({ value, onChange, placeholder, style }) {
  return (
    <TextInput value={String(value ?? '')} onChangeText={(t) => onChange(t.replace(/[^0-9.]/g, ''))} keyboardType="number-pad" placeholder={placeholder} style={[styles.input, style]} />
  );
}

// -------------------- Screens --------------------
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeScreen({ navigation }) {
  const sessions = usePVStore((s) => s.sessions);
  const units = usePVStore((s) => s.settings.units);

  const prInches = useMemo(() => calcPR(sessions), [sessions]);
  const latestPractice = useMemo(() => selectLatestPractice(sessions), [sessions]);

  return (
    <Screen>
      <StatusBar style="auto" />
      <Section title="Overview">
        <Field label="Best Vault (PR)">
          <Text style={styles.h2}>{prInches ? fmtInches(prInches, units) : '—'}</Text>
        </Field>
      </Section>

      <Section title="Current Setup">
        <Row style={{ flexWrap: 'wrap', gap: 10 }}>
          <Pill text={`Steps ${latestPractice?.steps ?? '—'}`} />
          <Pill text={`Standards ${fmtInches(latestPractice?.standardsIn, units)}`} />
          <Pill text={`Takeoff ${fmtInches(latestPractice?.takeoffIn, units)}`} />
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

// TODAY: read-only (no checkmarks, no email)
function TodayScreen({ navigation }) {
  const plan = usePVStore((s) => s.weeklyPlan);
  const day = todayName();
  const entry = plan[day] || { goals: '', routine: [] };

  return (
    <Screen>
      <StatusBar style="auto" />
      <Section title={`Today – ${day}`}>
        {!!entry.goals && (
          <Field label="Goals"><Text style={styles.pText}>{entry.goals}</Text></Field>
        )}
        <Field label="Routine">
          {entry.routine?.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {entry.routine.map((r, idx) => (<Pill key={idx} text={r} />))}
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
                <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                  {s.type === 'practice' ? (
                    <>
                      <Pill text={`Steps ${s.steps ?? '—'}`} />
                      <Pill text={`Takeoff ${fmtInches(s.takeoffIn)}`} />
                      <Pill text={`Standards ${fmtInches(s.standardsIn)}`} />
                      {s.heightIn ? <Pill text={`Bar ${fmtInches(s.heightIn)}`} /> : null}
                    </>
                  ) : (
                    <>
                      {s.attempts?.length ? (<Pill text={`Attempts ${s.attempts.length}`} />) : null}
                      <Pill text={`PR ${fmtInches(calcPR([s])) || '—'}`} />
                    </>
                  )}
                </Row>
                <View style={{ height: 10 }} />
                <Row style={{ justifyContent: 'flex-end' }}>
                  <ButtonSecondary title="Delete" onPress={() => Alert.alert('Delete session?', 'This cannot be undone.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => del(s.id) },
                  ])} />
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
  const units = usePVStore((s) => s.settings.units);

  if (!session) return (<Screen><Text>Session not found.</Text></Screen>);

  return (
    <Screen>
      <Section title={`${session.type === 'meet' ? 'Meet' : 'Practice'} – ${new Date(session.date).toLocaleDateString()}`}>
        {session.type === 'meet' ? (
          <>
            {session.meetName ? <Field label="Meet"><Text style={styles.pText}>{session.meetName}</Text></Field> : null}
            <Field label="Goals"><Text style={styles.pText}>{session.goals || '—'}</Text></Field>
            <Field label="Attempts">
              {session.attempts?.length ? (
                <View style={{ gap: 6 }}>
                  {session.attempts.map((a, idx) => (
                    <Row key={idx} style={{ justifyContent: 'space-between' }}>
                      <Text>{fmtInches(a.heightIn, units)}</Text>
                      <Text style={{ fontWeight: '700', color: a.result === 'clear' ? '#0a7' : '#c22' }}>{a.result === 'clear' ? 'O' : 'X'}</Text>
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
                <Pill text={`Takeoff ${fmtInches(session.takeoffIn, units)}`} />
                <Pill text={`Standards ${fmtInches(session.standardsIn, units)}`} />
              </Row>
            </Field>
            <Field label="PR (best cleared)"><Text style={styles.h2}>{fmtInches(calcPR([session]), units) || '—'}</Text></Field>
            {session.notes ? <Field label="Notes"><Text style={styles.pText}>{session.notes}</Text></Field> : null}
          </>
        ) : (
          <>
            <Field label="Goals"><Text style={styles.pText}>{session.goals || '—'}</Text></Field>
            <Row style={{ flexWrap: 'wrap', gap: 10 }}>
              <Pill text={`Steps ${session.steps ?? '—'}`} />
              <Pill text={`Takeoff ${fmtInches(session.takeoffIn, units)}`} />
              <Pill text={`Standards ${fmtInches(session.standardsIn, units)}`} />
              {session.heightIn ? <Pill text={`Bar ${fmtInches(session.heightIn, units)}`} /> : null}
            </Row>
            {Array.isArray(session.routine) && session.routine.length ? (
              <Field label="Routine completion">
                <View style={{ gap: 6 }}>
                  {session.routine.map((r, i) => (
                    <Text key={i} style={styles.pText}>{r.done ? '✓' : '○'} {r.text}</Text>
                  ))}
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

// PRACTICE FORM: routine checklist + email
function PracticeFormScreen({ navigation }) {
  const units = usePVStore((s) => s.settings.units);
  const add = usePVStore((s) => s.addSession);
  const plan = usePVStore((s) => s.weeklyPlan);
  const dayName = todayName();
  const dayPlan = plan[dayName] || { goals: '', routine: [] };

  const [date, setDate] = useState(new Date().toISOString());
  const [goals, setGoals] = useState(dayPlan.goals || '');
  const [steps, setSteps] = useState('');
  const [takeoffIn, setTakeoffIn] = useState(0);
  const [standardsIn, setStandardsIn] = useState(0);
  const [heightIn, setHeightIn] = useState(0);
  const [notes, setNotes] = useState('');
  const [email, setEmail] = useState('');
  const [checks, setChecks] = useState(() => dayPlan.routine.map(() => false));

  const toggleCheck = (idx) => setChecks((c) => c.map((v, i) => (i === idx ? !v : v)));
  const resetChecks = () => setChecks(dayPlan.routine.map(() => false));

  const save = () => {
    const routine = dayPlan.routine.map((text, i) => ({ text, done: !!checks[i] }));
    const sess = {
      id: shortId(),
      type: 'practice',
      date,
      dayName,
      goals,
      steps: steps ? Number(steps) : undefined,
      takeoffIn: Number(takeoffIn) || 0,
      standardsIn: Number(standardsIn) || 0,
      heightIn: Number(heightIn) || 0,
      notes,
      routine, // store completion with session
    };
    add(sess);
    Alert.alert('Saved', 'Practice session saved.');
    navigation.goBack();
  };

  const emailSummary = async () => {
    const to = (email || '').trim();
    if (!to) { Alert.alert('Add an email', 'Enter an email address to send the results.'); return; }
    const lines = [
      `Pole Vault – PRACTICE (${new Date(date).toLocaleDateString()})`,
      '',
      `Day: ${dayName}`,
      goals ? `Goals:\n${goals}\n` : '',
      'Routine:',
      ...dayPlan.routine.map((r, idx) => `${checks[idx] ? '[x]' : '[ ]'} ${r}`),
      '',
      `Steps: ${steps || '—'}`,
      `Takeoff: ${fmtInches(takeoffIn, units)}`,
      `Standards: ${fmtInches(standardsIn, units)}`,
      heightIn ? `Bar: ${fmtInches(heightIn, units)}` : '',
      notes ? `\nNotes:\n${notes}\n` : '',
      '--',
      'Sent from PoleVault Tracker',
    ];
    const subject = encodeURIComponent(`Practice – ${dayName} ${new Date(date).toLocaleDateString()}`);
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

  return (
    <Screen>
      <Section title="New Practice">
        <Field label="Goals for today"><TextInput value={goals} onChangeText={setGoals} placeholder="e.g., hit 12' mid, tall at takeoff" style={styles.input} /></Field>
        <Field label="Today's routine (tap to check)">
          {dayPlan.routine.length ? (
            <View style={{ gap: 8 }}>
              {dayPlan.routine.map((r, idx) => (
                <CheckboxChip key={idx} checked={!!checks[idx]} label={r} onToggle={() => toggleCheck(idx)} />
              ))}
              <Row style={{ justifyContent: 'flex-end', marginTop: 4 }}>
                <ButtonSecondary title="Reset Checks" onPress={resetChecks} />
              </Row>
            </View>
          ) : <Text style={styles.muted}>No routine items for today.</Text>}
        </Field>
        <Field label="Steps (approach)"><NumberInput value={steps} onChange={setSteps} placeholder="e.g., 8" /></Field>
        <Field label="Takeoff mark"><UnitAwareHeightInput units={units} valueInches={takeoffIn} onChangeInches={setTakeoffIn} placeholder={units === 'metric' ? 'takeoff cm' : undefined} /></Field>
        <Field label="Standards setting"><UnitAwareHeightInput units={units} valueInches={standardsIn} onChangeInches={setStandardsIn} placeholder={units === 'metric' ? 'standards cm' : undefined} /></Field>
        <Field label="Bar height (optional)"><UnitAwareHeightInput units={units} valueInches={heightIn} onChangeInches={setHeightIn} placeholder={units === 'metric' ? 'height cm' : undefined} /></Field>
        <Field label="Notes"><TextInput value={notes} onChangeText={setNotes} placeholder="session notes…" style={[styles.input, { height: 90 }]} multiline /></Field>

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

// MEET FORM: adds steps/standards/takeoff + email button
function MeetFormScreen({ navigation }) {
  const units = usePVStore((s) => s.settings.units);
  const add = usePVStore((s) => s.addSession);

  const [date, setDate] = useState(new Date().toISOString());
  const [meetName, setMeetName] = useState('');
  const [goals, setGoals] = useState('');
  const [attempts, setAttempts] = useState([]); // {id,heightIn,result}
  const [notes, setNotes] = useState('');
  const [email, setEmail] = useState('');

  const [steps, setSteps] = useState('');
  const [takeoffIn, setTakeoffIn] = useState(0);
  const [standardsIn, setStandardsIn] = useState(0);

  const addAttempt = () => setAttempts((a) => [...a, { id: shortId(), heightIn: 0, result: 'miss' }]);
  const updateAttempt = (id, patch) => setAttempts((arr) => arr.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeAttempt = (id) => setAttempts((arr) => arr.filter((x) => x.id !== id));

  const save = () => {
    const sess = {
      id: shortId(),
      type: 'meet',
      date,
      meetName: meetName?.trim() || undefined,
      goals,
      attempts: attempts.map(({ id, ...rest }) => rest),
      notes,
      steps: steps ? Number(steps) : undefined,
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
    const pr = fmtInches(calcPR([{ type: 'meet', attempts: attempts.map(({ id, ...rest }) => rest) }]), units);
    const lines = [
      `Pole Vault – MEET (${new Date(date).toLocaleDateString()})`,
      meetName ? `Meet: ${meetName}` : '',
      '',
      goals ? `Goals:\n${goals}\n` : '',
      'Attempts:',
      ...(attempts.length
        ? attempts.map((a, i) => `  ${i + 1}. ${fmtInches(a.heightIn, units)}  ${a.result === 'clear' ? 'O' : 'X'}`)
        : ['  (none)']),
      '',
      `PR (today): ${pr || '—'}`,
      '',
      'Setup used:',
      `Steps: ${steps || '—'}`,
      `Takeoff: ${fmtInches(takeoffIn, units)}`,
      `Standards: ${fmtInches(standardsIn, units)}`,
      notes ? `\nNotes:\n${notes}\n` : '',
      '--',
      'Sent from PoleVault Tracker',
    ];
    const subject = encodeURIComponent(`Meet – ${meetName || ''} ${new Date(date).toLocaleDateString()}`.trim());
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

  return (
    <Screen>
      <Section title="New Meet">
        <Field label="Meet name"><TextInput value={meetName} onChangeText={setMeetName} placeholder="e.g., Conference Finals" style={styles.input} /></Field>
        <Field label="Goals"><TextInput value={goals} onChangeText={setGoals} placeholder="e.g., open @ 11'6, PR attempt 12'6" style={styles.input} /></Field>

        <Field label="Attempts">
          <View style={{ gap: 10 }}>
            {attempts.map((a) => (
              <View key={a.id} style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Height</Text>
                  <UnitAwareHeightInput units={units} valueInches={a.heightIn} onChangeInches={(v) => updateAttempt(a.id, { heightIn: v })} />
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
            <ButtonSecondary title="Add Attempt" onPress={addAttempt} />
          </View>
        </Field>

        <Section title="Setup used">
          <Field label="Steps (approach)"><NumberInput value={steps} onChange={setSteps} placeholder="e.g., 8" /></Field>
          <Field label="Takeoff mark"><UnitAwareHeightInput units={units} valueInches={takeoffIn} onChangeInches={setTakeoffIn} /></Field>
          <Field label="Standards setting"><UnitAwareHeightInput units={units} valueInches={standardsIn} onChangeInches={setStandardsIn} /></Field>
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

// PLAN: read-only view (no editing, no Save button)
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
              {entry.routine.map((r, i) => <Text key={i} style={styles.pText}>• {r}</Text>)}
            </View>
          ) : <Text style={styles.muted}>No routine items.</Text>}
        </Field>
      </Section>
    </Screen>
  );
}

function StatsScreen() {
  const sessions = usePVStore((s) => s.sessions);
  const units = usePVStore((s) => s.settings.units);

  const prInches = useMemo(() => calcPR(sessions), [sessions]);
  const avgTakeoffIn = useMemo(() => avgOf(sessions.map((s) => s.takeoffIn).filter(Boolean)), [sessions]);
  const avgStandardsIn = useMemo(() => avgOf(sessions.map((s) => s.standardsIn).filter(Boolean)), [sessions]);
  const avgSteps = useMemo(() => avgOf(sessions.map((s) => s.steps).filter((x) => Number.isFinite(x))), [sessions]);

  return (
    <Screen>
      <Section title="Highlights">
        <Field label="Personal Record (best cleared)"><Text style={styles.h2}>{prInches ? fmtInches(prInches, units) : '—'}</Text></Field>
        <Field label="Average takeoff mark"><Text style={styles.h3}>{avgTakeoffIn ? fmtInches(avgTakeoffIn, units) : '—'}</Text></Field>
        <Field label="Average standards"><Text style={styles.h3}>{avgStandardsIn ? fmtInches(avgStandardsIn, units) : '—'}</Text></Field>
        <Field label="Average steps"><Text style={styles.h3}>{avgSteps ? Number(avgSteps).toFixed(1) : '—'}</Text></Field>
      </Section>
    </Screen>
  );
}

function SettingsScreen() {
  const units = usePVStore((s) => s.settings.units);
  const setUnits = usePVStore((s) => s.setUnits);

  return (
    <Screen>
      <Section title="Units">
        <Row>
          <Pressable onPress={() => setUnits('imperial')} style={[styles.choice, units === 'imperial' && styles.choiceOn]}><Text style={[styles.choiceText, units === 'imperial' && styles.choiceTextOn]}>Imperial (ft/in)</Text></Pressable>
          <Pressable onPress={() => setUnits('metric')} style={[styles.choice, units === 'metric' && styles.choiceOn]}><Text style={[styles.choiceText, units === 'metric' && styles.choiceTextOn]}>Metric (cm)</Text></Pressable>
        </Row>
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
        <Stack.Screen name="Home" component={TabNav} options={{ headerShown: false }} />
        <Stack.Screen name="PracticeForm" component={PracticeFormScreen} options={{ title: 'New Practice' }} />
        <Stack.Screen name="MeetForm" component={MeetFormScreen} options={{ title: 'New Meet' }} />
        <Stack.Screen name="SessionDetails" component={SessionDetailsScreen} options={{ title: 'Session' }} />
      </Stack.Navigator>
    </NavigationContainer>
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

function fmtInches(inches, units = 'imperial') {
  const val = Number(inches || 0);
  if (!val) return '—';
  if (units === 'metric') { const cm = inchesToCm(val); return `${Math.round(cm)} cm`; }
  const { feet, inches: ins } = fromInches(val);
  return `${feet}'${ins}"`;
}

// -------------------- Styles --------------------
const styles = StyleSheet.create({
  // Centered watermark logo
  bgLogo: {
    position: 'absolute',
    bottom: 5,          // 👈 move near the bottom; bump this up/down to taste
    left: '50%',
    width: 260,
    height: 260,
    transform: [{ translateX: -130 }],
    opacity: 0.18,
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
  checkboxChipOn: {
    backgroundColor: '#e6f2ff',
    borderColor: '#0a84ff',
  },
  checkboxText: { fontWeight: '700', color: '#333' },
  checkboxTextOn: { color: '#0a84ff' },
});
