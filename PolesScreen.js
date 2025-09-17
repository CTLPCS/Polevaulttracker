import { useFocusEffect } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { ButtonPrimary, ButtonSecondary, DropdownModal, Field, Row, Section, SimpleDropdown, styles } from './components';
import { usePVStore } from './store';

// Utility functions for formatting
function fmtFeetIn(inchesTotal) {
  const t = Math.max(0, Number(inchesTotal) || 0);
  const feet = Math.floor(t / 12);
  let inches = Math.round(t - feet * 12);
  if (inches === 12) { return `${feet + 1}'0"`; }
  return `${feet}'${inches}"`;
}
function fmtTakeoff(inches, units) {
  const val = Number(inches || 0);
  if (!val) return '—';
  if (units === 'metric') return `${Math.round(val * 2.54)} cm`;
  const feet = Math.floor(val / 12);
  const ins = Math.round(val - feet * 12);
  return `${feet}'${ins}"`;
}
function fmtStandards(inches, units) {
  const val = Number(inches || 0);
  if (!val) return '—';
  if (units === 'metric') return `${Math.round(val * 2.54)} cm`;
  const feet = Math.floor(val / 12);
  const ins = Math.round(val - feet * 12);
  return `${feet}'${ins}"`;
}

// Dropdown options (for modal editing)
const BRANDS = ['Pacer', 'Spirit', 'Altius', 'Essx', 'Gill', 'Nordic', 'UCS', 'Other'];
const LENGTHS = ['14', '14.5', '15', '15.5', '16'];
const FLEXES = ['19', '21', '23', '25'];
const WEIGHTS = ['135', '145', '155', '165', '175', '185', '200'];
const STEPS = ['1','2','3','4', '5', '6', '7', '8','9','10','11','12','13','14','15','16','17','18','19','20'];
const APPROACH_FEET = Array.from({ length: 151 }, (_, i) => i.toString()); // '0' to '150'
const APPROACH_INCHES = ['0','1','2','3', '6', '9', '10', '11'];
const TAKEOFF_MARKS = ['2','2.5','3','3.5','4','4.5','5','5.5','6','6.5','7','7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13', '13.5', '14', '14.5', '15', '15.5', '16', '16.5', '17', '17.5', '18', '18.5', '19', '19.5', '20'];
const STANDARDS = ['18','18.25','18.5','18.75','19','19.25','19.5','19.75','20','20.25','20.5','20.75','21','21.25','21.5','21.75','22','22.25','22.5','22.75','23','23.25','23.5','23.75','24','24.25','24.5','24.75','25','25.25','25.5','25.75','26','26.25','26.5','26.75','27','27.25','27.5','27.75','28','28.25','28.5','28.75','29','29.25','29.5','29.75','30','30.25','30.5','30.75','31','31.25','31.5'];
const HANDS = ['1','1.25','1.5','1.75','2','2.25','2.5','2.75','3','3.25','3.5','3.75','4','4.25','4.5','4.75','5','5.25','5.5','5.75','6','6.25','6.5','6.75','7','7.25','7.5','7.75','8','8.25','8.5','8.75','9','9.25','9.5','9.75','10'];

export default function PolesScreen() {
  const sessions = usePVStore((s) => s.sessions) || [];
  const units = usePVStore((s) => s.settings.units);
  const updateSession = usePVStore((s) => s.updateSession);

  // Force update on focus
  const [refresh, setRefresh] = useState(0);
  useFocusEffect(
    React.useCallback(() => {
      setRefresh(r => r + 1);
    }, [])
  );

  // Deduplicate poles from all sessions
  const polesList = useMemo(() => {
    const arr = [];
    sessions.forEach(sess => {
      if (Array.isArray(sess.poles)) {
        sess.poles.forEach(p => {
          const key = `${p.brand || ''}|${p.length || ''}|${p.flex || ''}|${p.weight || ''}`;
          arr.push({ ...p, _key: key });
        });
      }
    });
    const seen = new Set();
    const deduped = [];
    for (const p of arr) {
      if (p._key && !seen.has(p._key)) {
        deduped.push(p);
        seen.add(p._key);
      }
    }
    return deduped;
  }, [sessions, refresh]);

  // Modal state for editing/adding
  const [editPoleIdx, setEditPoleIdx] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [poleDraft, setPoleDraft] = useState({
    brand: '',
    length: '',
    flex: '',
    weight: '',
    steps: '',
    approachFeet: '',
    approachInches: '',
    takeoffIn: '',
    standardsIn: '',
    hands: '',
  });

  // Dropdown modal states for editing pole
  const [stepsModalOpen, setStepsModalOpen] = useState(false);
  const [approachFeetModalOpen, setApproachFeetModalOpen] = useState(false);
  const [approachInchesModalOpen, setApproachInchesModalOpen] = useState(false);
  const [takeoffModalOpen, setTakeoffModalOpen] = useState(false);
  const [standardsModalOpen, setStandardsModalOpen] = useState(false);
  const [handsModalOpen, setHandsModalOpen] = useState(false);

  // Edit/Add logic
  const handleEdit = (idx) => {
    setEditPoleIdx(idx);
    setPoleDraft({ ...polesList[idx] });
    setModalVisible(true);
  };
  const handleSave = () => {
    const newPole = { ...poleDraft, _key: `${poleDraft.brand || ''}|${poleDraft.length || ''}|${poleDraft.flex || ''}|${poleDraft.weight || ''}` };
    if (editPoleIdx === null) {
      // Add to all sessions (or refactor to use a global pole list if you prefer)
      sessions.forEach(sess => {
        const nextPoles = Array.isArray(sess.poles) ? [...sess.poles, newPole] : [newPole];
        updateSession(sess.id, { poles: nextPoles });
      });
    } else {
      // Edit logic
      const originalPole = polesList[editPoleIdx];
      sessions.forEach(sess => {
        if (Array.isArray(sess.poles)) {
          const newPoles = sess.poles.map(p => {
            const key = `${p.brand || ''}|${p.length || ''}|${p.flex || ''}|${p.weight || ''}`;
            if (key === originalPole._key) {
              return newPole;
            }
            return p;
          });
          updateSession(sess.id, { poles: newPoles });
        }
      });
    }
    setModalVisible(false);
    setEditPoleIdx(null);
    setPoleDraft({
      brand: '',
      length: '',
      flex: '',
      weight: '',
      steps: '',
      approachFeet: '',
      approachInches: '',
      takeoffIn: '',
      standardsIn: '',
      hands: '',
    });
  };
  const handleDelete = (idx) => {
    const pole = polesList[idx];
    sessions.forEach(sess => {
      if (Array.isArray(sess.poles)) {
        const newPoles = sess.poles.filter(p => {
          const key = `${p.brand || ''}|${p.length || ''}|${p.flex || ''}|${p.weight || ''}`;
          return key !== pole._key;
        });
        updateSession(sess.id, { poles: newPoles });
      }
    });
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16, paddingTop: 48, paddingBottom: 40 }}>
      <Section title="Poles" style={{ marginTop: 0 }}>
        <ButtonPrimary
          title="Add Pole"
          onPress={() => {
            setPoleDraft({
              brand: '',
              length: '',
              flex: '',
              weight: '',
              steps: '',
              approachFeet: '',
              approachInches: '',
              takeoffIn: '',
              standardsIn: '',
              hands: '',
            });
            setEditPoleIdx(null);
            setModalVisible(true);
          }}
          style={{ alignSelf: 'flex-start', marginBottom: 14 }}
        />
        {polesList.length === 0 ? (
          <Text style={styles.muted}>No poles have been added yet.</Text>
        ) : (
          <View>
            {polesList.map((pole, idx) => (
              <View
                key={idx}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 14,
                  borderWidth: 1,
                  borderColor: '#eee',
                  shadowColor: '#000',
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                }}
              >
                <Text style={[styles.sectionTitle, { marginBottom: 6 }]}>{`Pole ${idx + 1}:`}</Text>
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
                <Row style={{ justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                  <ButtonSecondary
                    title="Edit"
                    onPress={() => handleEdit(idx)}
                  />
                  <ButtonSecondary
                    title="Delete"
                    onPress={() => handleDelete(idx)}
                  />
                </Row>
              </View>
            ))}
          </View>
        )}
      </Section>
      {/* Modal for editing/adding pole */}
      {modalVisible && (
        <View style={[styles.modalOverlay, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}>
          <View style={[styles.modalCard, { padding: 22, maxWidth: 400 }]}>
            <Text style={styles.sectionTitle}>{editPoleIdx === null ? "Add Pole" : "Edit Pole"}</Text>
            <Row style={{ gap: 12 }}>
              <Field label="Brand" style={{ flex: 1, minWidth: 0 }}>
                <TextInput
                  value={poleDraft.brand}
                  onChangeText={text => setPoleDraft(d => ({ ...d, brand: text }))}
                  style={styles.input}
                  placeholder="Brand"
                />
              </Field>
              <Field label="Length" style={{ flex: 1, minWidth: 0 }}>
                <TextInput
                  value={poleDraft.length}
                  onChangeText={text => setPoleDraft(d => ({ ...d, length: text }))}
                  style={styles.input}
                  placeholder="Length"
                />
              </Field>
            </Row>
            <Row style={{ gap: 12, marginTop: 12 }}>
              <Field label="Flex" style={{ flex: 1, minWidth: 0 }}>
                <TextInput
                  value={poleDraft.flex}
                  onChangeText={text => setPoleDraft(d => ({ ...d, flex: text }))}
                  style={styles.input}
                  placeholder="Flex"
                />
              </Field>
              <Field label="Weight" style={{ flex: 1, minWidth: 0 }}>
                <TextInput
                  value={poleDraft.weight}
                  onChangeText={text => setPoleDraft(d => ({ ...d, weight: text }))}
                  style={styles.input}
                  placeholder="Weight"
                />
              </Field>
            </Row>
            <Field label="Steps" style={{ marginTop: 12 }}>
              <SimpleDropdown
                label="Select Steps"
                valueLabel={poleDraft.steps || 'Steps'}
                onPress={() => setStepsModalOpen(true)}
              />
            </Field>
            <Field label="Approach" style={{ marginTop: 12 }}>
              <Row style={{ gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <SimpleDropdown
                    label="Feet"
                    valueLabel={poleDraft.approachFeet || 'Feet'}
                    onPress={() => setApproachFeetModalOpen(true)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <SimpleDropdown
                    label="Inches"
                    valueLabel={poleDraft.approachInches || 'Inches'}
                    onPress={() => setApproachInchesModalOpen(true)}
                  />
                </View>
              </Row>
            </Field>
            <Field label="Takeoff Mark (FT)" style={{ marginTop: 12 }}>
              <SimpleDropdown
                label="Select Takeoff Mark"
                valueLabel={poleDraft.takeoffIn || 'Takeoff'}
                onPress={() => setTakeoffModalOpen(true)}
              />
            </Field>
            <Field label="Standards setting (in)" style={{ marginTop: 12 }}>
              <SimpleDropdown
                label="Select Standards"
                valueLabel={poleDraft.standardsIn || 'Standards'}
                onPress={() => setStandardsModalOpen(true)}
              />
            </Field>
            <Field label="Hands" style={{ marginTop: 12 }}>
              <SimpleDropdown
                label="Select Hands"
                valueLabel={poleDraft.hands || 'Hands'}
                onPress={() => setHandsModalOpen(true)}
              />
            </Field>
            <Row style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <ButtonSecondary title="Cancel" onPress={() => { setModalVisible(false); setEditPoleIdx(null); }} />
              <ButtonPrimary title="Save" onPress={handleSave} />
            </Row>
          </View>
        </View>
      )}
      <DropdownModal
        visible={stepsModalOpen}
        title="Steps"
        options={STEPS.map(s => ({ label: s, value: s }))}
        onSelect={opt => { setPoleDraft(d => ({ ...d, steps: opt.value })); setStepsModalOpen(false); }}
        onClose={() => setStepsModalOpen(false)}
      />
      <DropdownModal
        visible={approachFeetModalOpen}
        title="Approach (Feet)"
        options={APPROACH_FEET.map(f => ({ label: f, value: f }))}
        onSelect={opt => { setPoleDraft(d => ({ ...d, approachFeet: opt.value })); setApproachFeetModalOpen(false); }}
        onClose={() => setApproachFeetModalOpen(false)}
      />
      <DropdownModal
        visible={approachInchesModalOpen}
        title="Approach (Inches)"
        options={APPROACH_INCHES.map(i => ({ label: i, value: i }))}
        onSelect={opt => { setPoleDraft(d => ({ ...d, approachInches: opt.value })); setApproachInchesModalOpen(false); }}
        onClose={() => setApproachInchesModalOpen(false)}
      />
      <DropdownModal
        visible={takeoffModalOpen}
        title="Takeoff Mark"
        options={TAKEOFF_MARKS.map(m => ({ label: m, value: m }))}
        onSelect={opt => { setPoleDraft(d => ({ ...d, takeoffIn: opt.value })); setTakeoffModalOpen(false); }}
        onClose={() => setTakeoffModalOpen(false)}
      />
      <DropdownModal
        visible={standardsModalOpen}
        title="Standards"
        options={STANDARDS.map(s => ({ label: s, value: s }))}
        onSelect={opt => { setPoleDraft(d => ({ ...d, standardsIn: opt.value })); setStandardsModalOpen(false); }}
        onClose={() => setStandardsModalOpen(false)}
      />
      <DropdownModal
        visible={handsModalOpen}
        title="Hands"
        options={HANDS.map(h => ({ label: h, value: h }))}
        onSelect={opt => { setPoleDraft(d => ({ ...d, hands: opt.value })); setHandsModalOpen(false); }}
        onClose={() => setHandsModalOpen(false)}
      />
    </ScrollView>
  );
}