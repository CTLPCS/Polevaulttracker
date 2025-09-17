import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// ---- Section, Row, Field, Buttons ----
export const Section = ({ title, children, right, style }) => (
  <View style={[styles.section, style]}>
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right ? <View style={{ marginLeft: 'auto' }}>{right}</View> : null}
    </View>
    <View style={{ marginTop: 8 }}>{children}</View>
  </View>
);

export const Row = ({ children, style }) => (
  <View style={[styles.row, style]}>{children}</View>
);

export const Field = ({ label, children, style }) => (
  <View style={[{ marginBottom: 8 }, style]}>
    <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>{label}</Text>
    {children}
  </View>
);

export const ButtonPrimary = ({ title, onPress, style }) => (
  <Pressable onPress={onPress} style={[styles.btnPrimary, style]}>
    <Text style={styles.btnPrimaryText}>{title}</Text>
  </Pressable>
);

export const ButtonSecondary = ({ title, onPress, style }) => (
  <Pressable onPress={onPress} style={[styles.btnSecondary, style]}>
    <Text style={styles.btnSecondaryText}>{title}</Text>
  </Pressable>
);

// ---- SimpleDropdown ----
export function SimpleDropdown({ label, valueLabel, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.dropdown}>
      <Text style={styles.dropdownText}>{valueLabel || label}</Text>
    </Pressable>
  );
}

// ---- DropdownModal ----
export function DropdownModal({ visible, title, options, onSelect, onClose }) {
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

// ---- Styles ----
export const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  sectionTitle: { fontWeight: 'bold', fontSize: 22, color: '#222', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' },
  field: { marginBottom: 16, flex: 1, minWidth: 0 },
  fieldLabel: { color: '#555', marginBottom: 4, fontWeight: '600', fontSize: 15 },
  btnPrimary: {
    backgroundColor: '#0a84ff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    minWidth: 90,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 16, textAlign: 'center' },
  btnSecondary: {
    backgroundColor: '#eef0f3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    minWidth: 90,
  },
  btnSecondaryText: { color: '#111', fontWeight: '700', fontSize: 16, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#fafbfc',
  },
  pickerBox: {
    backgroundColor: '#fafbfc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 8,
    height: 44,
    justifyContent: 'center',
    flex: 1,
    minWidth: 0,
  },
  picker: {
    fontSize: 16,
    color: '#222',
    height: 44,
    width: '100%',
  },
  muted: { color: '#888', fontSize: 15 },
  pText: { fontSize: 16, color: '#222', fontWeight: '400' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.13)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 32,
    minWidth: 320,
    maxWidth: 400,
    width: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    alignSelf: 'center',
  },
  dropdown: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minWidth: 100,
  },
  dropdownText: { fontSize: 16, color: '#222' },
  optionRow: { paddingVertical: 10 },
  optionText: { fontSize: 16, color: '#111' },
});
