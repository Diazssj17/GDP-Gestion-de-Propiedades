import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { api } from '../api/client';
import { mockPropiedades } from '../api/mock';

export default function PropiedadesScreen({ navigation }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await api.propiedades();
        setData(res);
      } catch { setData(mockPropiedades); }
      setLoading(false);
    })();
  }, []);
  if (loading) return <View style={s.center}><ActivityIndicator /></View>;
  return (
    <View style={s.container}>
      <Text style={s.header}>Propiedades</Text>
      <Text style={s.sub}>Cada propiedad agrupa N unidades. Casa = 1 unidad.</Text>
      <FlatList
        data={data}
        keyExtractor={i => String(i.id)}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card} onPress={() => navigation.navigate('Unidades', { propiedad_id: item.id, nombre: item.nombre })}>
            <Text style={s.title}>{item.nombre}</Text>
            <Text style={s.meta}>{item.tipo} · {item.ciudad} · {item.num_unidades} unidad(es)</Text>
            <Text style={s.dir}>{item.direccion}</Text>
            <Text style={s.link}>Ver unidades →</Text>
          </TouchableOpacity>
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
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
  title: { fontWeight: '700', fontSize: 16, color: '#0F172A' },
  meta: { fontSize: 12, color: '#475569', marginTop: 2 },
  dir: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  link: { fontSize: 12, color: '#2563EB', marginTop: 6, fontWeight: '600' },
});
