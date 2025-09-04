import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
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
  if (inches === 12) {
    return { feet: feet + 1, inches: 0 };
  }
  return { feet, inches };
};

const shortId = () => (
  global.crypto?.randomUUID 
    ? global.crypto.randomUUID() 
    : Math.random().toString(36).slice(2, 9)
);

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
      ' Start with warmup drills (thick mat, hurdles). On the way back from each drill do grapevine both ways and run backwards:',
      ' 2× Sidestep hurdles (both ways)',
      ' 2× Step over hurdles',
      ' 2× Hop over hurdles',
      ' 2× Crawl under',
      ' 2× Crab crawl',
      'Runway:',
      ' One arm — stretch top arm; keep form into the pit',
      ' Sweep — keep form; avoid dropping head/shoulders',
      ' Sweep with turns — ¼, ½, full',
      ' Press — top hand highest, bottom arm straight, knee driven; swing through (not inverted)',
      ' Full vault',
      'Lift: In Volt — Plyometric / explosive focused',
    ],
  },
  Tuesday: {
    goals: 'Sprint warm up with Sprints',
    routine: [
      'Sprint warm up:',
      ' 2×5 Mini hurdles w/ pole — stay tall; plant after last hurdle and jump',
      ' 2×5 Mini hurdles w/o pole — stay tall; jump after last hurdle',
      'Bubkas — progression:',
      ' Static bubkas on dip bars (target 3×10 before progressing)',
      ' Negatives on bar (slow descent)',
      ' Partials on bar: ankle → knee (10 good reps)',
      ' Full rep on bar: ankle → hip',
      ' End goal: full bubka with swing',
      'Core circuit — 3 rounds:',
      ' Plank with shoulder taps — 30s',
      ' Dead bugs — 12 each side',
      ' Russian twists — 20 reps (10/side)',
      ' Reach-through plank — 30s',
      ' Sandbag/weight drag under body until time',
    ],
  },
  Wednesday: {
    goals: 'Vault Day',
    routine: [
      'Drills before/during Full Vault Day:',
      ' 1) Rope drill',
      ' 2) Ring drill',
      ' 3) Bendy pole drill',
      ' 4) Wall plant w/ comp pole',
      'Runway:',
      ' 1) One arm',
      ' 2) Sweep',
      ' 3) Sweep with turns',
      ' 4) Press',
      ' 5) Full vault',
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
      ' 2×5 Mini hurdles w/ pole',
      ' 2×5 Mini hurdles w/o pole',
      'Choose one:',
      ' 2 × (3–5 × 30–50m sprints)',
      ' 2 × 5 × 80m @ ~80% (1 min between reps, 8 min between sets)',
      ' 2 × 80m @ ~95% (8 min rest) + 2 × 120m @ ~95% (10 min rest)',
    ],
  },
  Saturday: {
    goals: 'Lift in Volt (lower body heavy)',
    routine: [],
  },
};

// -------------------- Store -------------------- 
const initialSettings = {
  units: 'imperial',
  athlete: {
    firstName: '',
    lastName: '',
    year: '',
    level: 'highschool'
  },
};

const usePVStore = create(
  persist(
    (set, get) => ({
      settings: initialSettings,
      weeklyPlan: defaultWeeklyPlan,
      sessions: [],
      
      setUnits: (units) => set((s) => ({ 
        settings: { ...s.settings, units } 
      })),
      
      setAthleteField: (key, value) => set((s) => ({ 
        settings: { 
          ...s.settings, 
          athlete: { ...s.settings.athlete, [key]: value } 
        } 
      })),
      
      addSession: (session) => set((s) => ({ 
        sessions: [session, ...s.sessions] 
      })),
      
      updateSession: (id, patch) => set((s) => ({ 
        sessions: s.sessions.map((x) => (x.id === id ? { ...x, ...patch } : x)) 
      })),
      
      deleteSession: (id) => set((s) => ({ 
        sessions: s.sessions.filter((x) => x.id !== id) 
      })),
    }),
    {
      name: 'polevault-tracker-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: 12,
      migrate: async (persisted) => {
        const state = typeof persisted === 'object' && persisted ? { ...persisted } : {};
        state.weeklyPlan = defaultWeeklyPlan;
        
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
            norm.attempts = Array.isArray(norm.attempts) ? norm.attempts.map((a) => {
              const x = { ...a };
              if (!Array.isArray(x.results)) {
                const first = (x.result === 'clear') ? 'clear' : 'miss';
                x.results = [first, 'miss', 'miss'];
                delete x.result;
              }
              while (x.results.length < 3) x.results.push('miss');
              if (x.results.length > 3) x.results = x.results.slice(0, 3);
              x.heightIn = Number(x.heightIn || 0);
              return x;
            }) : [];
          }
          return norm;
        });
        
        return state;
      },
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

const Row = ({ children, style }) => (
  <View style={[styles.row, style]}>{children}</View>
);

const Field = ({ label, children }) => (
  <View style={{ marginBottom: 10 }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
  </View>
);

const Pill = ({ text }) => (
  <View style={styles.pill}>
    <Text style={{ fontWeight: '600' }}>{text}</Text>
  </View>
);

const ButtonPrimary = ({ title, onPress }) => (
  <Pressable onPress={onPress} style={styles.btnPrimary}>
    <Text style={styles.btnPrimaryText}>{title}</Text>
  </Pressable>
);

const ButtonSecondary = ({ title, onPress }) => (
  <Pressable onPress={onPress} style={styles.btnSecondary}>
    <Text style={styles.btnSecondaryText}>{title}</Text>
  </Pressable>
);

const CheckboxChip = ({ checked, label, onToggle }) => (
  <Pressable 
    onPress={onToggle} 
    style={[styles.checkboxChip, checked ? styles.checkboxChipOn : null]}
  >
    <Text style={[styles.checkboxText, checked ? styles.checkboxTextOn : null]}>
      {checked ? '✓ ' : '○ '} {label}
    </Text>
  </Pressable>
);

function SimpleDropdown({ label, valueLabel, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.dropdown}>
      <Text style={styles.dropdownText}>{valueLabel || label}</Text>
    </Pressable>
  );
}

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
                onPress={() => {
                  onSelect(opt);
                  onClose();
                }}
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

function Screen({ children }) {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <Image 
          source={require('./assets/sau-logo.png')} 
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
    setFt(f);
    setIns(i);
    onChangeInches(toInches({ feet: Number(f), inches: Number(i) }));
  };

  const handleMetric = (c) => {
    setCm(c);
    onChangeInches(cmToInches(Number(c)));
  };

  if (units === 'imperial') {
    return (
      <Row>
        <TextInput
          value={ft}
          onChangeText={(t) => handleImperial(t, ins)}
          keyboardType="number-pad"
          placeholder="ft"
          style={styles.inputSmall}
        />
        <Text style={{ fontSize: 16 }}>ft</Text>
        <TextInput
          value={ins}
          onChangeText={(t) => handleImperial(ft, t)}
          keyboardType="number-pad"
          placeholder="in"
          style={styles.inputSmall}
        />
        <Text style={{ fontSize: 16 }}>in</Text>
      </Row>
    );
  }

  return (
    <Row>
      <TextInput
        value={cm}
        onChangeText={(t) => handleMetric(t)}
        keyboardType="number-pad"
        placeholder={placeholder || 'cm'}
        style={styles.input}
      />
      <Text style={{ fontSize: 16 }}>cm</Text>
    </Row>
  );
}

// -------------------- Helpers -------------------- 
function selectLatestPractice(sessions) {
  return sessions.find(s => s.type === 'practice') || null;
}

function calculatePR(sessions) {
  let maxHeight = 0;
  sessions.forEach(session => {
    if (session.type === 'meet' && Array.isArray(session.attempts)) {
      session.attempts.forEach(attempt => {
        if (Array.isArray(attempt.results) && attempt.results.includes('clear')) {
          maxHeight = Math.max(maxHeight, attempt.heightIn || 0);
        }
      });
    }
  });
  return maxHeight;
}

// -------------------- Screen Components -------------------- 
function HomeScreen() {
  const { sessions, settings } = usePVStore();
  const latest = selectLatestPractice(sessions);
  const pr = calculatePR(sessions);

  const formatHeight = (inches) => {
    if (settings.units === 'imperial') {
      const { feet, inches: ins } = fromInches(inches);
      return `${feet}'${ins}"`;
    }
    return `${Math.round(inchesToCm(inches))}cm`;
  };

  const formatApproach = (totalIn) => {
    if (settings.units === 'imperial') {
      const { feet, inches } = fromInches(totalIn);
      return `${feet}'${inches}"`;
    }
    return `${(inchesToMeters(totalIn)).toFixed(1)}m`;
  };

  return (
    <Screen>
      <Section title="Personal Record">
        <Text style={styles.prText}>
          {pr > 0 ? formatHeight(pr) : 'No PR yet'}
        </Text>
      </Section>

      {latest && (
        <Section title="Latest Practice">
          <Row>
            <Pill text={`Steps: ${latest.steps || 'N/A'}`} />
            <Pill text={`Approach: ${formatApproach(latest.approachIn || 0)}`} />
          </Row>
          <Row style={{ marginTop: 8 }}>
            <Pill text={`Standards: ${formatHeight(latest.standardsIn || 0)}`} />
            <Pill text={`Takeoff: ${formatHeight(latest.takeoffIn || 0)}`} />
          </Row>
        </Section>
      )}
    </Screen>
  );
}

function TodayScreen() {
  const { weeklyPlan } = usePVStore();
  const today = weeklyPlan[todayName()] || { goals: '', routine: [] };

  return (
    <Screen>
      <Section title={`Today (${todayName()})`}>
        <Text style={styles.goalsText}>{today.goals}</Text>
      </Section>

      <Section title="Routine">
        {today.routine.map((item, idx) => {
          const isHeader = isRoutineHeader(item);
          return (
            <Text
              key={idx}
              style={isHeader ? styles.routineHeader : styles.routineItem}
            >
              {item}
            </Text>
          );
        })}
      </Section>
    </Screen>
  );
}

function LogScreen({ navigation }) {
  const { sessions, deleteSession } = usePVStore();

  const handleDelete = (id) => {
    Alert.alert('Delete Session', 'Are you sure?', [
      { text: 'Cancel' },
      { text: 'Delete', onPress: () => deleteSession(id) }
    ]);
  };

  const handleShare = async (session) => {
    try {
      await Share.share({
        message: `Session: ${session.type} on ${session.date}\nNotes: ${session.notes || 'None'}`
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  return (
    <Screen>
      <Section 
        title="Sessions" 
        right={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ButtonSecondary 
              title="Practice" 
              onPress={() => navigation.navigate('PracticeForm')} 
            />
            <ButtonSecondary 
              title="Meet" 
              onPress={() => navigation.navigate('MeetForm')} 
            />
          </View>
        }
      >
        {sessions.length === 0 ? (
          <Text style={styles.emptyText}>No sessions logged yet</Text>
        ) : (
          sessions.map((session) => (
            <View key={session.id} style={styles.sessionCard}>
              <Row>
                <Text style={styles.sessionType}>{session.type}</Text>
                <Text style={styles.sessionDate}>{session.date}</Text>
              </Row>
              <Row style={{ marginTop: 8 }}>
                <ButtonSecondary 
                  title="View" 
                  onPress={() => navigation.navigate('SessionDetails', { sessionId: session.id })} 
                />
                <ButtonSecondary 
                  title="Share" 
                  onPress={() => handleShare(session)} 
                />
                <ButtonSecondary 
                  title="Delete" 
                  onPress={() => handleDelete(session.id)} 
                />
              </Row>
            </View>
          ))
        )}
      </Section>
    </Screen>
  );
}

function PlanScreen() {
  const { weeklyPlan } = usePVStore();

  return (
    <Screen>
      <Section title="Weekly Plan">
        {days.map((day) => {
          const plan = weeklyPlan[day] || { goals: '', routine: [] };
          return (
            <View key={day} style={styles.dayCard}>
              <Text style={styles.dayTitle}>{day}</Text>
              <Text style={styles.dayGoals}>{plan.goals}</Text>
              {plan.routine.map((item, idx) => {
                const isHeader = isRoutineHeader(item);
                return (
                  <Text
                    key={idx}
                    style={isHeader ? styles.routineHeader : styles.routineItem}
                  >
                    {item}
                  </Text>
                );
              })}
            </View>
          );
        })}
      </Section>
    </Screen>
  );
}

function StatsScreen() {
  const { sessions, settings } = usePVStore();
  const pr = calculatePR(sessions);

  const formatHeight = (inches) => {
    if (settings.units === 'imperial') {
      const { feet, inches: ins } = fromInches(inches);
      return `${feet}'${ins}"`;
    }
    return `${Math.round(inchesToCm(inches))}cm`;
  };

  return (
    <Screen>
      <Section title="Statistics">
        <Text style={styles.statItem}>
          Personal Record: {pr > 0 ? formatHeight(pr) : 'No PR yet'}
        </Text>
        <Text style={styles.statItem}>
          Total Sessions: {sessions.length}
        </Text>
        <Text style={styles.statItem}>
          Practice Sessions: {sessions.filter(s => s.type === 'practice').length}
        </Text>
        <Text style={styles.statItem}>
          Meet Sessions: {sessions.filter(s => s.type === 'meet').length}
        </Text>
      </Section>
    </Screen>
  );
}

function SettingsScreen() {
  const { settings, setUnits, setAthleteField } = usePVStore();

  return (
    <Screen>
      <Section title="Units">
        <Row>
          <ButtonSecondary
            title={settings.units === 'imperial' ? '✓ Imperial' : 'Imperial'}
            onPress={() => setUnits('imperial')}
          />
          <ButtonSecondary
            title={settings.units === 'metric' ? '✓ Metric' : 'Metric'}
            onPress={() => setUnits('metric')}
          />
        </Row>
      </Section>

      <Section title="Athlete Profile">
        <Field label="First Name">
          <TextInput
            value={settings.athlete.firstName}
            onChangeText={(text) => setAthleteField('firstName', text)}
            style={styles.input}
            placeholder="Enter first name"
          />
        </Field>
        <Field label="Last Name">
          <TextInput
            value={settings.athlete.lastName}
            onChangeText={(text) => setAthleteField('lastName', text)}
            style={styles.input}
            placeholder="Enter last name"
          />
        </Field>
        <Field label="Year">
          <TextInput
            value={settings.athlete.year}
            onChangeText={(text) => setAthleteField('year', text)}
            style={styles.input}
            placeholder="e.g., 2024"
          />
        </Field>
        <Field label="Level">
          <TextInput
            value={settings.athlete.level}
            onChangeText={(text) => setAthleteField('level', text)}
            style={styles.input}
            placeholder="e.g., highschool, college"
          />
        </Field>
      </Section>
    </Screen>
  );
}

function PracticeFormScreen({ navigation }) {
  const { addSession, weeklyPlan, settings } = usePVStore();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [steps, setSteps] = useState(undefined);
  const [approachFt, setApproachFt] = useState(0);
  const [approachIn, setApproachIn] = useState(0);
  const [standardsIn, setStandardsIn] = useState(0);
  const [takeoffIn, setTakeoffIn] = useState(0);
  const [heightIn, setHeightIn] = useState(0);
  const [notes, setNotes] = useState('');
  const [routineCompletion, setRoutineCompletion] = useState({});
  const [showStepsModal, setShowStepsModal] = useState(false);
  const [showApproachFtModal, setShowApproachFtModal] = useState(false);
  const [showApproachInModal, setShowApproachInModal] = useState(false);

  const today = weeklyPlan[todayName()] || { routine: [] };

  const stepsOptions = Array.from({ length: 15 }, (_, i) => ({
    label: `${i + 1} steps`,
    value: i + 1
  }));

  const approachFtOptions = Array.from({ length: APPROACH_MAX_FEET }, (_, i) => ({
    label: `${i + 1} ft`,
    value: i + 1
  }));

  const approachInOptions = Array.from({ length: 12 }, (_, i) => ({
    label: `${i} in`,
    value: i
  }));

  const handleRoutineToggle = (idx) => {
    setRoutineCompletion(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const handleSave = () => {
    const session = {
      id: shortId(),
      type: 'practice',
      date,
      steps,
      approachIn: toInches({ feet: approachFt, inches: approachIn }),
      standardsIn,
      takeoffIn,
      heightIn,
      notes,
      routine: today.routine.map((item, idx) => ({
        text: item,
        completed: !!routineCompletion[idx]
      }))
    };

    addSession(session);
    navigation.goBack();
  };

  const handleEmail = async () => {
    const completedItems = today.routine
      .map((item, idx) => routineCompletion[idx] ? `✓ ${item}` : `○ ${item}`)
      .join('\n');

    const body = `Practice Session - ${date}

Steps: ${steps || 'N/A'}
Approach: ${approachFt}'${approachIn}"
Standards: ${settings.units === 'imperial' ? 
  `${fromInches(standardsIn).feet}'${fromInches(standardsIn).inches}"` : 
  `${Math.round(inchesToCm(standardsIn))}cm`}
Takeoff: ${settings.units === 'imperial' ? 
  `${fromInches(takeoffIn).feet}'${fromInches(takeoffIn).inches}"` : 
  `${Math.round(inchesToCm(takeoffIn))}cm`}

Routine Completion:
${completedItems}

Notes: ${notes}`;

    try {
      await Linking.openURL(`mailto:?subject=Practice Session&body=${encodeURIComponent(body)}`);
    } catch (error) {
      Alert.alert('Error', 'Could not open email client');
    }
  };

  return (
    <Screen>
      <Field label="Date">
        <TextInput
          value={date}
          onChangeText={setDate}
          style={styles.input}
          placeholder="YYYY-MM-DD"
        />
      </Field>

      <Field label="Steps">
        <SimpleDropdown
          label="Select steps"
          valueLabel={steps ? `${steps} steps` : 'Select steps'}
          onPress={() => setShowStepsModal(true)}
        />
      </Field>

      <Field label="Approach">
        <Row>
          <SimpleDropdown
            label="Feet"
            valueLabel={`${approachFt} ft`}
            onPress={() => setShowApproachFtModal(true)}
          />
          <SimpleDropdown
            label="Inches"
            valueLabel={`${approachIn} in`}
            onPress={() => setShowApproachInModal(true)}
          />
        </Row>
      </Field>

      <Field label="Standards Height">
        <UnitAwareHeightInput
          units={settings.units}
          valueInches={standardsIn}
          onChangeInches={setStandardsIn}
          placeholder="Standards height"
        />
      </Field>

      <Field label="Takeoff Height">
        <UnitAwareHeightInput
          units={settings.units}
          valueInches={takeoffIn}
          onChangeInches={setTakeoffIn}
          placeholder="Takeoff height"
        />
      </Field>

      <Field label="Bar Height">
        <UnitAwareHeightInput
          units={settings.units}
          valueInches={heightIn}
          onChangeInches={setHeightIn}
          placeholder="Bar height"
        />
      </Field>

      <Section title="Today's Routine">
        {today.routine.map((item, idx) => {
          const isHeader = isRoutineHeader(item);
          if (isHeader) {
            return (
              <Text key={idx} style={styles.routineHeader}>
                {item}
              </Text>
            );
          }
          return (
            <CheckboxChip
              key={idx}
              checked={!!routineCompletion[idx]}
              label={item}
              onToggle={() => handleRoutineToggle(idx)}
            />
          );
        })}
      </Section>

      <Field label="Notes">
        <TextInput
          value={notes}
          onChangeText={setNotes}
          style={[styles.input, { height: 80 }]}
          multiline
          placeholder="Practice notes..."
        />
      </Field>

      <Row>
        <ButtonPrimary title="Save Practice" onPress={handleSave} />
        <ButtonSecondary title="Email Summary" onPress={handleEmail} />
      </Row>

      <DropdownModal
        visible={showStepsModal}
        title="Select Steps"
        options={stepsOptions}
        onSelect={(opt) => setSteps(opt.value)}
        onClose={() => setShowStepsModal(false)}
      />
      <DropdownModal
        visible={showApproachFtModal}
        title="Select Feet"
        options={approachFtOptions}
        onSelect={(opt) => setApproachFt(opt.value)}
        onClose={() => setShowApproachFtModal(false)}
      />

      <DropdownModal
        visible={showApproachInModal}
        title="Select Inches"
        options={approachInOptions}
        onSelect={(opt) => setApproachIn(opt.value)}
        onClose={() => setShowApproachInModal(false)}
      />
    </Screen>
  );
}

function MeetFormScreen({ navigation }) {
  const { addSession, settings } = usePVStore();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetName, setMeetName] = useState('');
  const [steps, setSteps] = useState(undefined);
  const [approachFt, setApproachFt] = useState(0);
  const [approachIn, setApproachIn] = useState(0);
  const [standardsIn, setStandardsIn] = useState(0);
  const [takeoffIn, setTakeoffIn] = useState(0);
  const [attempts, setAttempts] = useState([]);
  const [notes, setNotes] = useState('');
  const [showStepsModal, setShowStepsModal] = useState(false);
  const [showApproachFtModal, setShowApproachFtModal] = useState(false);
  const [showApproachInModal, setShowApproachInModal] = useState(false);

  const stepsOptions = Array.from({ length: 15 }, (_, i) => ({
    label: `${i + 1} steps`,
    value: i + 1
  }));

  const approachFtOptions = Array.from({ length: APPROACH_MAX_FEET }, (_, i) => ({
    label: `${i + 1} ft`,
    value: i + 1
  }));

  const approachInOptions = Array.from({ length: 12 }, (_, i) => ({
    label: `${i} in`,
    value: i
  }));

  const addAttempt = () => {
    setAttempts(prev => [...prev, {
      heightIn: 0,
      results: ['miss', 'miss', 'miss']
    }]);
  };

  const updateAttemptHeight = (idx, heightIn) => {
    setAttempts(prev => prev.map((attempt, i) => 
      i === idx ? { ...attempt, heightIn } : attempt
    ));
  };

  const updateAttemptResult = (attemptIdx, resultIdx, result) => {
    setAttempts(prev => prev.map((attempt, i) => 
      i === attemptIdx ? {
        ...attempt,
        results: attempt.results.map((r, j) => j === resultIdx ? result : r)
      } : attempt
    ));
  };

  const removeAttempt = (idx) => {
    setAttempts(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    const session = {
      id: shortId(),
      type: 'meet',
      date,
      meetName,
      steps,
      approachIn: toInches({ feet: approachFt, inches: approachIn }),
      standardsIn,
      takeoffIn,
      attempts,
      notes
    };

    addSession(session);
    navigation.goBack();
  };

  const handleEmail = async () => {
    const formatHeight = (inches) => {
      if (settings.units === 'imperial') {
        const { feet, inches: ins } = fromInches(inches);
        return `${feet}'${ins}"`;
      }
      return `${Math.round(inchesToCm(inches))}cm`;
    };

    const attemptsSummary = attempts.map((attempt, idx) => {
      const results = attempt.results.map(r => r === 'clear' ? 'O' : 'X').join(' ');
      return `${formatHeight(attempt.heightIn)}: ${results}`;
    }).join('\n');

    const body = `Meet Results - ${date}

Meet: ${meetName}
Steps: ${steps || 'N/A'}
Approach: ${approachFt}'${approachIn}"
Standards: ${formatHeight(standardsIn)}
Takeoff: ${formatHeight(takeoffIn)}

Attempts:
${attemptsSummary}

Notes: ${notes}`;

    try {
      await Linking.openURL(`mailto:?subject=Meet Results&body=${encodeURIComponent(body)}`);
    } catch (error) {
      Alert.alert('Error', 'Could not open email client');
    }
  };

  return (
    <Screen>
      <Field label="Date">
        <TextInput
          value={date}
          onChangeText={setDate}
          style={styles.input}
          placeholder="YYYY-MM-DD"
        />
      </Field>

      <Field label="Meet Name">
        <TextInput
          value={meetName}
          onChangeText={setMeetName}
          style={styles.input}
          placeholder="Meet name"
        />
      </Field>

      <Field label="Steps">
        <SimpleDropdown
          label="Select steps"
          valueLabel={steps ? `${steps} steps` : 'Select steps'}
          onPress={() => setShowStepsModal(true)}
        />
      </Field>

      <Field label="Approach">
        <Row>
          <SimpleDropdown
            label="Feet"
            valueLabel={`${approachFt} ft`}
            onPress={() => setShowApproachFtModal(true)}
          />
          <SimpleDropdown
            label="Inches"
            valueLabel={`${approachIn} in`}
            onPress={() => setShowApproachInModal(true)}
          />
        </Row>
      </Field>

      <Field label="Standards Height">
        <UnitAwareHeightInput
          units={settings.units}
          valueInches={standardsIn}
          onChangeInches={setStandardsIn}
          placeholder="Standards height"
        />
      </Field>

      <Field label="Takeoff Height">
        <UnitAwareHeightInput
          units={settings.units}
          valueInches={takeoffIn}
          onChangeInches={setTakeoffIn}
          placeholder="Takeoff height"
        />
      </Field>

      <Section 
        title="Attempts" 
        right={<ButtonSecondary title="Add Attempt" onPress={addAttempt} />}
      >
        {attempts.map((attempt, attemptIdx) => (
          <View key={attemptIdx} style={styles.attemptCard}>
            <Row>
              <Text style={styles.attemptTitle}>Attempt {attemptIdx + 1}</Text>
              <ButtonSecondary 
                title="Remove" 
                onPress={() => removeAttempt(attemptIdx)} 
              />
            </Row>
            
            <Field label="Height">
              <UnitAwareHeightInput
                units={settings.units}
                valueInches={attempt.heightIn}
                onChangeInches={(height) => updateAttemptHeight(attemptIdx, height)}
                placeholder="Attempt height"
              />
            </Field>

            <Field label="Results">
              <Row>
                {attempt.results.map((result, resultIdx) => (
                  <View key={resultIdx} style={{ marginRight: 8 }}>
                    <Text style={styles.fieldLabel}>#{resultIdx + 1}</Text>
                    <Row>
                      <ButtonSecondary
                        title={result === 'clear' ? '✓ O' : 'O'}
                        onPress={() => updateAttemptResult(attemptIdx, resultIdx, 'clear')}
                      />
                      <ButtonSecondary
                        title={result === 'miss' ? '✓ X' : 'X'}
                        onPress={() => updateAttemptResult(attemptIdx, resultIdx, 'miss')}
                      />
                    </Row>
                  </View>
                ))}
              </Row>
            </Field>
          </View>
        ))}
      </Section>

      <Field label="Notes">
        <TextInput
          value={notes}
          onChangeText={setNotes}
          style={[styles.input, { height: 80 }]}
          multiline
          placeholder="Meet notes..."
        />
      </Field>

      <Row>
        <ButtonPrimary title="Save Meet" onPress={handleSave} />
        <ButtonSecondary title="Email Results" onPress={handleEmail} />
      </Row>

      <DropdownModal
        visible={showStepsModal}
        title="Select Steps"
        options={stepsOptions}
        onSelect={(opt) => setSteps(opt.value)}
        onClose={() => setShowStepsModal(false)}
      />

      <DropdownModal
        visible={showApproachFtModal}
        title="Select Feet"
        options={approachFtOptions}
        onSelect={(opt) => setApproachFt(opt.value)}
        onClose={() => setShowApproachFtModal(false)}
      />

      <DropdownModal
        visible={showApproachInModal}
        title="Select Inches"
        options={approachInOptions}
        onSelect={(opt) => setApproachIn(opt.value)}
        onClose={() => setShowApproachInModal(false)}
      />
    </Screen>
  );
}

function SessionDetailsScreen({ route, navigation }) {
  const { sessionId } = route.params;
  const { sessions, settings } = usePVStore();
  const session = sessions.find(s => s.id === sessionId);

  if (!session) {
    return (
      <Screen>
        <Text style={styles.emptyText}>Session not found</Text>
      </Screen>
    );
  }

  const formatHeight = (inches) => {
    if (settings.units === 'imperial') {
      const { feet, inches: ins } = fromInches(inches);
      return `${feet}'${ins}"`;
    }
    return `${Math.round(inchesToCm(inches))}cm`;
  };

  const formatApproach = (totalIn) => {
    if (settings.units === 'imperial') {
      const { feet, inches } = fromInches(totalIn);
      return `${feet}'${inches}"`;
    }
    return `${(inchesToMeters(totalIn)).toFixed(1)}m`;
  };

  return (
    <Screen>
      <Section title="Session Details">
        <Text style={styles.detailItem}>Type: {session.type}</Text>
        <Text style={styles.detailItem}>Date: {session.date}</Text>
        {session.meetName && (
          <Text style={styles.detailItem}>Meet: {session.meetName}</Text>
        )}
        <Text style={styles.detailItem}>Steps: {session.steps || 'N/A'}</Text>
        <Text style={styles.detailItem}>
          Approach: {formatApproach(session.approachIn || 0)}
        </Text>
        <Text style={styles.detailItem}>
          Standards: {formatHeight(session.standardsIn || 0)}
        </Text>
        <Text style={styles.detailItem}>
          Takeoff: {formatHeight(session.takeoffIn || 0)}
        </Text>
      </Section>

      {session.type === 'practice' && session.routine && (
        <Section title="Routine Completion">
          {session.routine.map((item, idx) => {
            const isHeader = isRoutineHeader(item.text);
            if (isHeader) {
              return (
                <Text key={idx} style={styles.routineHeader}>
                  {item.text}
                </Text>
              );
            }
            return (
              <Text key={idx} style={styles.routineItem}>
                {item.completed ? '✓' : '○'} {item.text}
              </Text>
            );
          })}
        </Section>
      )}

      {session.type === 'meet' && session.attempts && (
        <Section title="Attempts">
          {session.attempts.map((attempt, idx) => (
            <View key={idx} style={styles.attemptSummary}>
              <Text style={styles.attemptHeight}>
                {formatHeight(attempt.heightIn)}
              </Text>
              <Text style={styles.attemptResults}>
                {attempt.results.map(r => r === 'clear' ? 'O' : 'X').join(' ')}
              </Text>
            </View>
          ))}
        </Section>
      )}

      {session.notes && (
        <Section title="Notes">
          <Text style={styles.notesText}>{session.notes}</Text>
        </Section>
      )}
    </Screen>
  );
}

// -------------------- Navigation Setup -------------------- 
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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
        <Stack.Screen 
          name="MainTabs" 
          component={TabNav} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="PracticeForm" 
          component={PracticeFormScreen} 
          options={{ title: 'New Practice' }} 
        />
        <Stack.Screen 
          name="MeetForm" 
          component={MeetFormScreen} 
          options={{ title: 'New Meet' }} 
        />
        <Stack.Screen 
          name="SessionDetails" 
          component={SessionDetailsScreen} 
          options={{ title: 'Session' }} 
        />
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

// -------------------- Styles -------------------- 
const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    backgroundColor: '#fff',
    fontSize: 16,
    flex: 1,
  },
  inputSmall: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    backgroundColor: '#fff',
    fontSize: 16,
    width: 60,
    textAlign: 'center',
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    backgroundColor: '#fff',
    minWidth: 120,
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
  },
  pill: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 4,
  },
  btnPrimary: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    flex: 1,
    marginRight: 4,
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 16,
  },
  btnSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#1976d2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 4,
  },
  btnSecondaryText: {
    color: '#1976d2',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 14,
  },
  checkboxChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 4,
  },
  checkboxChipOn: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4caf50',
  },
  checkboxText: {
    fontSize: 14,
    color: '#333',
  },
  checkboxTextOn: {
    color: '#2e7d32',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    width: '100%',
    maxWidth: 300,
  },
  optionRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  bgLogo: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 80,
    height: 80,
    opacity: 0.1,
    zIndex: -1,
  },
  prText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976d2',
    textAlign: 'center',
  },
  goalsText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  routineHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  routineItem: {
    fontSize: 14,
    color: '#555',
    marginBottom: 2,
    paddingLeft: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  sessionCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  sessionType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textTransform: 'capitalize',
  },
  sessionDate: {
    fontSize: 14,
    color: '#666',
    marginLeft: 'auto',
  },
  dayCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 4,
  },
  dayGoals: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  statItem: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  attemptCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  attemptTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  attemptSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  attemptHeight: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  attemptResults: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'monospace',
  },
  detailItem: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
});