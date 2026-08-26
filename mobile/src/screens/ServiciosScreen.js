import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';

const estadoColor = { pendiente: '#EA580C', pagado: '#059669', vencido: '#DC2626', parcial: '#D97706' };

export default function ServiciosScreen({ navigation }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try { setData(await api.recibos()); } catch (e) { setData([]); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const fmt = n => `$${Number(n).toLocaleString('es-CO')}`;

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.header, { color: c.text }]}>Recibos de servicios</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>Agua · Energía · Gas · Compartidos entre unidades</Text>
      {loading ? <ActivityIndicator color={c.accent} style={{ marginTop: 20 }} /> : (
        <FlatList
          data={data}
          keyExtractor={i => String(i.id)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={c.accent} />}
          contentContainerStyle={{ paddingBottom: 90 }}
          ListEmptyComponent={<Text style={[s.empty, { color: c.textMuted }]}>Sin recibos. Crea el primero con el botón +</Text>}
          renderItem={({ item }) => (
            <View style={[s.card, { backgroundColor: c.card }]}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.title, { color: c.text }]}>{item.servicio_nombre} · {item.propiedad_nombre}</Text>
                  <Text style={[s.meta, { color: c.textSecondary }]}>{item.periodo} · {item.empresa_prestadora || '—'} {item.numero_cuenta ? `· Cuenta ${item.numero_cuenta}` : ''}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: estadoColor[item.estado] || '#64748B' }]}><Text style={s.badgeText}>{item.estado}</Text></View>
              </View>
              <Text style={[s.valor, { color: c.text }]}>{fmt(item.valor)}</Text>
              {item.distribucion?.length > 1 ? (
                <View style={[s.dist, { backgroundColor: theme.dark ? '#12243B' : '#EFF6FF' }]}>
                  <Text style={[s.distTitle, { color: c.accent }]}>Distribución ({item.distribucion[0].metodo.replace('_', ' ')})</Text>
                  {item.distribucion.map(d => (
                    <Text key={d.id} style={[s.distItem, { color: c.textSecondary }]}>
                      {d.codigo} {d.nombre ? `- ${d.nombre}` : ''} → {fmt(d.monto)}{d.porcentaje ? ` (${d.porcentaje}%)` : ''}{d.consumo ? ` (${d.consumo} cons.)` : ''}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        />
      )}
      <TouchableOpacity style={[s.fab, { backgroundColor: c.primary }]} onPress={() => navigation.navigate('NuevoRecibo')}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 12, marginBottom: 12 },
  empty: { textAlign: 'center', marginTop: 24 },
  card: { borderRadius: 12, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { fontWeight: '700', fontSize: 15 },
  meta: { fontSize: 11, marginTop: 2 },
  valor: { fontSize: 20, fontWeight: '800', marginTop: 8 },
  dist: { borderRadius: 8, padding: 10, marginTop: 10 },
  distTitle: { fontWeight: '700', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 },
  distItem: { fontSize: 12, lineHeight: 18 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 },
});
