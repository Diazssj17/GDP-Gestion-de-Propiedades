import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

function parseDate(v) {
  if (!v) return new Date();
  const d = new Date(`${v}T00:00:00`);
  return isNaN(d.getTime()) ? new Date() : d;
}

export default function DateField({ label, value, onChange, placeholder = 'YYYY-MM-DD' }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [show, setShow] = useState(false);

  const onDate = (event, selected) => {
    if (Platform.OS === 'android') setShow(false);
    if (event.type === 'set' && selected) {
      const y = selected.getFullYear();
      const m = String(selected.getMonth() + 1).padStart(2, '0');
      const day = String(selected.getDate()).padStart(2, '0');
      onChange(`${y}-${m}-${day}`);
    } else if (event.type === 'dismissed') {
      setShow(false);
    }
  };

  return (
    <View>
      {label ? <Text style={[s.label, { color: c.textSecondary }]}>{label}</Text> : null}
      <TouchableOpacity style={[s.input, { backgroundColor: c.input, borderColor: c.border }]} onPress={() => setShow(true)}>
        <Text style={{ color: value ? c.text : c.placeholder, fontSize: 14 }}>{value || placeholder}</Text>
        <Ionicons name="calendar" size={16} color={c.textMuted} />
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={parseDate(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDate}
        />
      )}
    </View>
  );
}
const s = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
});
