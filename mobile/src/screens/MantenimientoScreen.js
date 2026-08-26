import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';

const estadoColor = { reportado: '#EA580C', pendiente: '#EA580C', en_revision: '#D97706', en_proceso: '#2563EB', resuelto: '#059669', cancelado: '#64748B' };
const prioridadColor = { baja: '#059669', media: '#D97706', alta: '#EA580C', critica: '#DC2626' };
const ESTADOS = ['reportado', 'pendiente', 'en_revision', 'en_proceso', 'resuelto', 'cancelado'];

export default function MantenimientoScreen({ navigation }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [filtro, setFiltro] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (estado = filtro) => {
    setLoading(true);
    try { setData(await api.mantenimientos(estado ? { estado } : {})); } catch { setData([]); }
    setLoading(false);
  }, [filtro]);
  useEffect(() => { load(''); }, [load]);

  const resolver = async (t) => {
    try { await api.actualizarMantenimiento(t.id, { estado: 'resuelto' }); load(filtro); } catch (e) { console.log(e.message); }
  };

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.header, { color: c.text }]}>Mantenimiento</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>Tickets por unidad · toca el check para resolver</Text>
      <View style={s.filters}>
        {['', ...ESTADOS].map(e => (
          <TouchableOpacity key={e || 'todos'} onPress={() => { setFiltro(e); load(e); }} style={[s.chip, { backgroundColor: c.card, borderColor: c.border }, filtro === e && { backgroundColor: c.chipActive, borderColor: c.chipActive }]}>
            <Text style={[s.chipText, { color: filtro === e ? c.chipTextActive : c.textSecondary }]}>{e || 'todos'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <ActivityIndicator color={c.accent} /> : (
        <FlatList
          data={data}
          keyExtractor={i => String(i.id)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(filtro)} tintColor={c.accent} />}
          contentContainerStyle={{ paddingBottom: 90 }}
          ListEmptyComponent={<Text style={[s.empty, { color: c.textMuted }]}>Sin tickets en este filtro.</Text>}
          renderItem={({ item }) => (
            <View style={[s.card, { backgroundColor: c.card }]}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.title, { color: c.text }]}>{item.titulo}</Text>
                  <Text style={[s.meta, { color: c.textSecondary }]}>{item.unidad_codigo} · {item.propiedad_nombre || '—'} · {item.reportado_nombre || '—'}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: estadoColor[item.estado] || '#64748B' }]}><Text style={s.badgeText}>{item.estado}</Text></View>
              </View>
              <Text style={[s.desc, { color: c.textSecondary }]}>{item.descripcion}</Text>
              <View style={s.tags}>
                <View style={[s.tag, { backgroundColor: prioridadColor[item.prioridad] || '#64748B' }]}><Text style={s.tagText}>{item.prioridad}</Text></View>
                <Text style={[s.meta, { color: c.textMuted }]}>{item.tipo} · {item.fecha_reporte?.slice(0, 10)}</Text>
                {item.costo_real ? <Text style={[s.meta, { color: c.success }]}>Costo ${Number(item.costo_real).toLocaleString('es-CO')}</Text> : null}
              </View>
              {item.fotografias && item.fotografias !== '[]' ? (
                <Text style={[s.meta, { color: c.accent }]}>📷 {item.fotografias}</Text>
              ) : null}
              {item.estado !== 'resuelto' && item.estado !== 'cancelado' && (
                <TouchableOpacity style={[s.resolveBtn, { borderColor: c.accent }]} onPress={() => resolver(item)}>
                  <Ionicons name="checkmark-circle" size={16} color={c.accent} />
                  <Text style={{ color: c.accent, fontWeight: '600' }}>Marcar resuelto</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
      <TouchableOpacity style={[s.fab, { backgroundColor: c.primary }]} onPress={() => navigation.navigate('NuevoMantenimiento')}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 12, marginBottom: 8 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12, textTransform: 'capitalize' },
  card: { borderRadius: 12, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontWeight: '700', fontSize: 15 },
  meta: { fontSize: 11, marginTop: 3 },
  desc: { fontSize: 13, marginTop: 8 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  tag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  empty: { textAlign: 'center', marginTop: 20 },
  resolveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start', marginTop: 10 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 },
});
