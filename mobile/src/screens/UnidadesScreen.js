import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '../api/client';
import { mockUnidades } from '../api/mock';
import { useTheme } from '../theme/ThemeContext';

const badgeColor = { disponible: '#059669', ocupada: '#DC2626', mantenimiento: '#EA580C', reservada: '#6B7280', inactiva: '#475569' };

export default function UnidadesScreen({ route }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { propiedad_id, nombre } = route.params || {};
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        setData(await api.unidades(propiedad_id ? { propiedad_id } : {}));
      } catch { setData(mockUnidades.filter(u => !propiedad_id || u.propiedad_id === propiedad_id)); }
      setLoading(false);
    })();
  }, [propiedad_id]);
  if (loading) return <View style={[s.center, { backgroundColor: c.background }]}><ActivityIndicator color={c.accent} /></View>;
  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.header, { color: c.text }]}>{nombre || 'Unidades'}</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>Unidad = mínima arrendable. Contrato 1 activo por unidad.</Text>
      <FlatList
        data={data}
        keyExtractor={i => String(i.id)}
        renderItem={({ item }) => (
          <View style={[s.card, { backgroundColor: c.card }]}>
            <View style={s.row}>
              <Text style={[s.title, { color: c.text }]}>{item.codigo} {item.nombre ? `- ${item.nombre}` : ''}</Text>
              <View style={[s.badge, { backgroundColor: badgeColor[item.estado] || '#64748B' }]}><Text style={s.badgeText}>{item.estado}</Text></View>
            </View>
            <Text style={[s.meta, { color: c.textSecondary }]}>Canon ${Number(item.canon_base).toLocaleString('es-CO')} · {item.tipo} · {item.area_m2}m²</Text>
          </View>
        )}
      />
    </View>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 12, marginBottom: 12 },
  card: { borderRadius: 12, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 4 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
});
