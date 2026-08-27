import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';

const OPERATIVOS = [
  { name: 'Contratos', icon: 'document-text', desc: 'Unidad ↔ Inquilino · renovar, terminar', color: '#2563EB' },
  { name: 'Pagos', icon: 'cash', desc: 'Cobros, abonos parciales y mora', color: '#059669' },
  { name: 'Servicios', icon: 'water', desc: 'Recibos de agua, luz, gas', color: '#0891B2' },
  { name: 'Mantenimiento', icon: 'construct', desc: 'Tickets de reparación', color: '#EA580C' },
];

export default function MasMenuScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const c = theme.colors;
  const rol = user?.rol;
  // superadmin: operativos + inquilinos (los demas son pestanas)
  const modulos = rol === 'superadmin'
    ? [...OPERATIVOS, { name: 'Inquilinos', icon: 'people', desc: 'Ver todos los inquilinos', color: '#7C3AED' }]
    : OPERATIVOS;
  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.header, { color: c.text }]}>Más módulos</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>Gestión y operación diaria</Text>
      {modulos.map(m => (
        <TouchableOpacity key={m.name} style={[s.card, { backgroundColor: c.card }]} onPress={() => navigation.navigate(m.name)}>
          <View style={[s.icon, { backgroundColor: m.color + '22' }]}>
            <Ionicons name={m.icon} size={22} color={m.color} />
          </View>
          <View style={s.txt}>
            <Text style={[s.title, { color: c.text }]}>{m.name}</Text>
            <Text style={[s.desc, { color: c.textSecondary }]}>{m.desc}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
        </TouchableOpacity>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 12, marginBottom: 16 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 14, marginBottom: 10 },
  icon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  txt: { flex: 1 },
  title: { fontWeight: '700', fontSize: 15 },
  desc: { fontSize: 12, marginTop: 2 },
});
