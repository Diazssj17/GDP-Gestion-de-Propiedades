import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '../api/client';

export default function ContratosScreen() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { setData(await api.contratos()); } catch { setData([]); }
      setLoading(false);
    })();
  }, []);
  if (loading) return <View style={s.center}><ActivityIndicator /></View>;
  if (!data.length) return <View style={s.center}><Text style={s.empty}>Sin contratos. Crea uno desde la web o API.</Text><Text style={s.sub}>Regla: 1 activo por unidad.</Text></View>;
  return (
    <View style={s.container}>
      <Text style={s.header}>Contratos</Text>
      <FlatList data={data} keyExtractor={i => String(i.id)} renderItem={({ item }) => (
        <View style={s.card}>
          <Text style={s.title}>{item.unidad_codigo} → {item.inquilino_nombre}</Text>
          <Text style={s.meta}>{item.fecha_inicio} → {item.fecha_fin} · ${Number(item.canon).toLocaleString()} · {item.estado}</Text>
        </View>
      )} />
    </View>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  title: { fontWeight: '700', color: '#0F172A' },
  meta: { fontSize: 12, color: '#475569', marginTop: 4 },
  empty: { color: '#64748B', textAlign: 'center' },
  sub: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
});
