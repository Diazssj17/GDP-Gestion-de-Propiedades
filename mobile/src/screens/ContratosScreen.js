import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';

const estadoColor = { activo: '#059669', pendiente: '#EA580C', vencido: '#DC2626', terminado: '#64748B', cancelado: '#64748B' };

export default function ContratosScreen({ navigation }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api.contratos()); } catch { setData([]); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <View style={[s.center, { backgroundColor: c.background }]}><ActivityIndicator color={c.accent} /></View>;
  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.header, { color: c.text }]}>Contratos</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>Unidad ↔ Inquilino · 1 activo por unidad</Text>
      <FlatList
        data={data}
        keyExtractor={i => String(i.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={c.accent} />}
        contentContainerStyle={{ paddingBottom: 90 }}
        ListEmptyComponent={<Text style={[s.empty, { color: c.textMuted }]}>Sin contratos. Crea uno con el botón +</Text>}
        renderItem={({ item }) => (
          <View style={[s.card, { backgroundColor: c.card }]}>
            <View style={s.row}>
              <Text style={[s.title, { color: c.text }]}>{item.unidad_codigo} → {item.inquilino_nombre}</Text>
              <View style={[s.badge, { backgroundColor: estadoColor[item.estado] || '#64748B' }]}><Text style={s.badgeText}>{item.estado}</Text></View>
            </View>
            <Text style={[s.meta, { color: c.textSecondary }]}>{item.fecha_inicio} → {item.fecha_fin} · Canon ${Number(item.canon).toLocaleString('es-CO')}</Text>
          </View>
        )}
      />
      <TouchableOpacity style={[s.fab, { backgroundColor: c.primary }]} onPress={() => navigation.navigate('NuevoContrato')}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
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
  empty: { textAlign: 'center', marginTop: 20 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 },
});
