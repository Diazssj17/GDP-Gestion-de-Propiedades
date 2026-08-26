import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { api } from '../api/client';
import { mockPropiedades } from '../api/mock';
import { useTheme } from '../theme/ThemeContext';

export default function PropiedadesScreen({ navigation }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { setData(await api.propiedades()); } catch { setData(mockPropiedades); }
      setLoading(false);
    })();
  }, []);
  if (loading) return <View style={[s.center, { backgroundColor: c.background }]}><ActivityIndicator color={c.accent} /></View>;
  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.header, { color: c.text }]}>Propiedades</Text>
      <FlatList
        data={data}
        keyExtractor={i => String(i.id)}
        renderItem={({ item }) => (
          <TouchableOpacity style={[s.card, { backgroundColor: c.card }]} onPress={() => navigation.navigate('Unidades', { propiedad_id: item.id, nombre: item.nombre })}>
            <Text style={[s.title, { color: c.text }]}>{item.nombre}</Text>
            <Text style={[s.meta, { color: c.textSecondary }]}>{item.tipo} · {item.ciudad} · {item.num_unidades} unidad(es)</Text>
            <Text style={[s.dir, { color: c.textMuted }]}>{item.direccion}</Text>
            <Text style={[s.link, { color: c.accent }]}>Ver unidades →</Text>
          </TouchableOpacity>
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
  card: { borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
  title: { fontWeight: '700', fontSize: 16 },
  meta: { fontSize: 12, marginTop: 2 },
  dir: { fontSize: 12, marginTop: 2 },
  link: { fontSize: 12, marginTop: 6, fontWeight: '600' },
});
