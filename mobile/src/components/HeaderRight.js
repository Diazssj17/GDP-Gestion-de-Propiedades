import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';

const rolLabel = { superadmin: 'Superadmin', propietario: 'Propietario', inquilino: 'Inquilino', operador: 'Operador' };

export default function HeaderRight() {
  const { theme, isDark, toggle } = useTheme();
  const { user, logout } = useAuth();
  const c = theme.colors;
  return (
    <View style={s.row}>
      <View style={[s.chip, { backgroundColor: c.accent }]}>
        <Text style={s.chipText}>{rolLabel[user?.rol] || 'Usuario'}</Text>
      </View>
      <TouchableOpacity onPress={toggle} style={s.iconBtn}>
        <Ionicons name={isDark ? 'sunny' : 'moon'} size={20} color={c.text} />
      </TouchableOpacity>
      <TouchableOpacity onPress={logout} style={s.iconBtn}>
        <Ionicons name="log-out-outline" size={22} color={c.text} />
      </TouchableOpacity>
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginRight: 12, gap: 6 },
  chip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  iconBtn: { padding: 4 },
});
