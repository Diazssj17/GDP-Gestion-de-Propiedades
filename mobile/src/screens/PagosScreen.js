import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { api } from '../api/client';

const colors = { pendiente: '#EA580C', pagado: '#059669', mora: '#DC2626', parcial: '#D97706' };

export default function PagosScreen() {
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
    <View style={s.container}>
      <Text style={s.header}>Pagos</Text>
      <Text style={s.sub}>Pagos pertenecen a Contrato. Periodo: 2026-08, etc.</Text>
      <View style={s.filters}>
        {['', 'pendiente', 'mora', 'pagado'].map(e => (
          <TouchableOpacity key={e || 'todos'} onPress={() => { setFiltro(e); load(e); }} style={[s.chip, filtro === e && s.chipActive]}>
            <Text style={[s.chipText, filtro === e && s.chipTextActive]}>{e || 'todos'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <ActivityIndicator /> : (
        <FlatList data={data} keyExtractor={i => String(i.id)} renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.title}>${Number(item.monto).toLocaleString()} · {item.periodo || item.concepto}</Text>
              <View style={[s.badge, { backgroundColor: colors[item.estado] || '#64748B' }]}><Text style={s.badgeText}>{item.estado}</Text></View>
            </View>
            <Text style={s.meta}>Vence {item.fecha_vencimiento} {item.fecha_pago ? `· Pagado ${item.fecha_pago}` : ''}</Text>
          </View>
        )} ListEmptyComponent={<Text style={s.empty}>Sin pagos en este filtro.</Text>} />
      )}
    </View>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9', padding: 16 },
  header: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  sub: { fontSize: 12, color: '#64748B', marginBottom: 8 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  chipText: { fontSize: 12, color: '#334155', textTransform: 'capitalize' },
  chipTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '700', color: '#0F172A' },
  meta: { fontSize: 12, color: '#475569', marginTop: 4 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  empty: { textAlign: 'center', color: '#94A3B8', marginTop: 20 },
});
