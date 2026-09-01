import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';

const rolLabel = { superadmin: 'Superadmin', propietario: 'Propietario', inquilino: 'Inquilino', operador: 'Operador' };

export default function HeaderRight() {
  const { theme, isDark, toggle } = useTheme();
  const { user, logout } = useAuth();
  const navigation = useNavigation();
  const c = theme.colors;
  return (
    <View style={s.row}>
      <Pressable onPress={() => navigation.navigate('Alertas')} hitSlop={8} style={s.iconBtn}>
        <Ionicons name="notifications-outline" size={20} color={c.text} />
      </Pressable>
      <View style={[s.chip, { backgroundColor: c.accent }]}>
        <Text style={s.chipText}>{rolLabel[user?.rol] || 'Usuario'}</Text>
      </View>
      <Pressable onPress={toggle} hitSlop={8} style={s.iconBtn}>
        <Ionicons name={isDark ? 'sunny' : 'moon'} size={20} color={c.text} />
      </Pressable>
      <Pressable onPress={logout} hitSlop={8} style={s.iconBtn}>
        <Ionicons name="log-out-outline" size={22} color={c.text} />
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginRight: 12, gap: 6 },
  chip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  iconBtn: { padding: 6 },
});
