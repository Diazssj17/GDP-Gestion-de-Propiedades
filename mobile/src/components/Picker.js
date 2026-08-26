import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

export default function Picker({ label, value, options, onSelect, labelKey = 'nombre', valueKey = 'id', placeholder = 'Seleccionar...' }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o[valueKey] === value);
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={[s.label, { color: c.textSecondary }]}>{label}</Text> : null}
      <TouchableOpacity style={[s.input, { backgroundColor: c.input, borderColor: c.border }]} onPress={() => setOpen(true)}>
        <Text style={{ color: selected ? c.text : c.placeholder }}>{selected ? selected[labelKey] : placeholder}</Text>
        <Ionicons name="chevron-down" size={16} color={c.textMuted} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={[s.box, { backgroundColor: c.card }]}>
            <FlatList
              data={options}
              keyExtractor={o => String(o[valueKey])}
              renderItem={({ item }) => (
                <TouchableOpacity style={[s.item, { borderBottomColor: c.border }]} onPress={() => { onSelect(item[valueKey]); setOpen(false); }}>
                  <Text style={{ color: c.text }}>{item[labelKey]}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  box: { borderRadius: 12, maxHeight: 400, overflow: 'hidden' },
  item: { padding: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});
