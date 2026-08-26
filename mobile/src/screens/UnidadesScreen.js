import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '../api/client';
import { mockUnidades } from '../api/mock';

const badgeColor = { disponible: '#059669', ocupada: '#DC2626', mantenimiento: '#EA580C', reservada: '#6B7280' };

export default function UnidadesScreen({ route }) {
  const { propiedad_id, nombre } = route.params || {};
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await api.unidades(propiedad_id ? { propiedad_id } : {});
        setData(res);
      } catch { setData(mockUnidades.filter(u => !propiedad_id || u.propiedad_id === propiedad_id)); }
      setLoading(false);
    })();
  }, [propiedad_id]);
  if (loading) return <View style={s.center}><ActivityIndicator /></View>;
  return (
    <View style={s.container}>
      <Text style={s.header}>{nombre || 'Unidades'}</Text>
      <Text style={s.sub}>Unidad = mínima arrendable. Contrato 1 activo por unidad.</Text>
      <FlatList
        data={data}
        keyExtractor={i => String(i.id)}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.title}>{item.codigo} {item.nombre ? `- ${item.nombre}` : ''}</Text>
              <View style={[s.badge, { backgroundColor: badgeColor[item.estado] || '#64748B' }]}><Text style={s.badgeText}>{item.estado}</Text></View>
            </View>
            <Text style={s.meta}>Canon ${Number(item.canon_base).toLocaleString('es-CO')} · {item.tipo} · {item.area_m2}m²</Text>
          </View>
        )}
      />
    </View>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  sub: { fontSize: 12, color: '#64748B', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '700', color: '#0F172A' },
  meta: { fontSize: 12, color: '#475569', marginTop: 4 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
});
