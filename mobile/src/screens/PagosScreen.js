import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';

const colors = { pendiente: '#EA580C', pagado: '#059669', mora: '#DC2626', parcial: '#D97706' };

export default function PagosScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const [filtro, setFiltro] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async (estado = filtro) => {
    setLoading(true);
    try { setData(await api.pagos(estado)); } catch { setData([]); }
    setLoading(false);
  };
  useEffect(() => { load(''); }, []);
  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.header, { color: c.text }]}>Pagos</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>Pagos pertenecen a Contrato. Periodo: 2026-08, etc.</Text>
      <View style={s.filters}>
        {['', 'pendiente', 'mora', 'pagado'].map(e => (
          <TouchableOpacity key={e || 'todos'} onPress={() => { setFiltro(e); load(e); }} style={[s.chip, { backgroundColor: c.card, borderColor: c.border }, filtro === e && { backgroundColor: c.chipActive, borderColor: c.chipActive }]}>
            <Text style={[s.chipText, { color: filtro === e ? c.chipTextActive : c.textSecondary }]}>{e || 'todos'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <ActivityIndicator color={c.accent} /> : (
        <FlatList data={data} keyExtractor={i => String(i.id)} renderItem={({ item }) => (
          <View style={[s.card, { backgroundColor: c.card }]}>
            <View style={s.row}>
              <Text style={[s.title, { color: c.text }]}>${Number(item.monto).toLocaleString()} · {item.periodo || item.concepto}</Text>
              <View style={[s.badge, { backgroundColor: colors[item.estado] || '#64748B' }]}><Text style={s.badgeText}>{item.estado}</Text></View>
            </View>
            <Text style={[s.meta, { color: c.textSecondary }]}>Vence {item.fecha_vencimiento} {item.fecha_pago ? `· Pagado ${item.fecha_pago}` : ''}</Text>
          </View>
        )} ListEmptyComponent={<Text style={[s.empty, { color: c.textMuted }]}>Sin pagos en este filtro.</Text>} />
      )}
    </View>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 12, marginBottom: 8 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12, textTransform: 'capitalize' },
  card: { borderRadius: 12, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 4 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  empty: { textAlign: 'center', marginTop: 20 },
});
