import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';

export default function ContratosScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { setData(await api.contratos()); } catch { setData([]); }
      setLoading(false);
    })();
  }, []);
  if (loading) return <View style={[s.center, { backgroundColor: c.background }]}><ActivityIndicator color={c.accent} /></View>;
  if (!data.length) return <View style={[s.center, { backgroundColor: c.background }]}><Text style={[s.empty, { color: c.textSecondary }]}>Sin contratos. Crea uno desde la web o API.</Text><Text style={[s.sub, { color: c.textMuted }]}>Regla: 1 activo por unidad.</Text></View>;
  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.header, { color: c.text }]}>Contratos</Text>
      <FlatList data={data} keyExtractor={i => String(i.id)} renderItem={({ item }) => (
        <View style={[s.card, { backgroundColor: c.card }]}>
          <Text style={[s.title, { color: c.text }]}>{item.unidad_codigo} → {item.inquilino_nombre}</Text>
          <Text style={[s.meta, { color: c.textSecondary }]}>{item.fecha_inicio} → {item.fecha_fin} · ${Number(item.canon).toLocaleString()} · {item.estado}</Text>
        </View>
      )} />
    </View>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  card: { borderRadius: 12, padding: 14, marginBottom: 10 },
  title: { fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 4 },
  empty: { textAlign: 'center' },
  sub: { fontSize: 12, marginTop: 4 },
});
