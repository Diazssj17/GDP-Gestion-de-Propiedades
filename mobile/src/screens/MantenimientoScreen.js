import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl, Image, Modal, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, BASE_URL } from '../api/client';
import { useTheme } from '../theme/ThemeContext';

const estadoColor = { reportado: '#EA580C', pendiente: '#EA580C', en_revision: '#D97706', en_proceso: '#2563EB', resuelto: '#059669', cancelado: '#64748B' };
const prioridadColor = { baja: '#059669', media: '#D97706', alta: '#EA580C', critica: '#DC2626' };
const ESTADOS = ['reportado', 'pendiente', 'en_revision', 'en_proceso', 'resuelto', 'cancelado'];
const ESTADO_LABEL = { reportado: 'Reportado', pendiente: 'Pendiente', en_revision: 'En revisión', en_proceso: 'En proceso', resuelto: 'Resuelto', cancelado: 'Cancelado' };

export default function MantenimientoScreen({ navigation }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [filtro, setFiltro] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  // modal cambiar estado
  const [editar, setEditar] = useState(null);
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [costo, setCosto] = useState('');
  const [guardando, setGuardando] = useState(false);

  const load = useCallback(async (estado = '') => {
    setLoading(true);
    try { setData(await api.mantenimientos(estado ? { estado } : {})); } catch { setData([]); }
    setLoading(false);
  }, []);
  useEffect(() => { load(''); }, [load]);

  const abrirEstado = (t) => { setEditar(t); setNuevoEstado(t.estado); setCosto(t.costo_real ? String(t.costo_real) : ''); };
  const confirmarEstado = async () => {
    setGuardando(true);
    try {
      await api.actualizarMantenimiento(editar.id, { estado: nuevoEstado, costo_real: Number(costo || 0) });
      setEditar(null);
      load(filtro);
    } catch (e) { console.log(e.message); } finally { setGuardando(false); }
  };

  const fotosDe = (t) => { try { return JSON.parse(t.fotografias || '[]'); } catch { return []; } };
  const fotoUrl = (name) => `${BASE_URL}/static/uploads/mantenimiento/${name}`;

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.header, { color: c.text }]}>Mantenimiento</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>Toca un ticket para cambiar su estado</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
        {['', ...ESTADOS].map(e => (
          <TouchableOpacity key={e || 'todos'} onPress={() => { setFiltro(e); load(e); }} style={[s.chip, { backgroundColor: c.card, borderColor: c.border }, filtro === e && { backgroundColor: c.chipActive, borderColor: c.chipActive }]}>
            <Text style={[s.chipText, { color: filtro === e ? c.chipTextActive : c.textSecondary }]}>{e ? ESTADO_LABEL[e] || e : 'todos'}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {loading ? <ActivityIndicator color={c.accent} /> : (
        <FlatList
          data={data}
          keyExtractor={i => String(i.id)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(filtro)} tintColor={c.accent} />}
          contentContainerStyle={{ paddingBottom: 90 }}
          ListEmptyComponent={<Text style={[s.empty, { color: c.textMuted }]}>Sin tickets en este filtro.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={[s.card, { backgroundColor: c.card }]} onPress={() => abrirEstado(item)} activeOpacity={0.8}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.title, { color: c.text }]}>{item.titulo}</Text>
                  <Text style={[s.meta, { color: c.textSecondary }]}>{item.unidad_codigo} · {item.propiedad_nombre || '—'} · {item.reportado_nombre || '—'}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: estadoColor[item.estado] || '#64748B' }]}><Text style={s.badgeText}>{ESTADO_LABEL[item.estado] || item.estado}</Text></View>
              </View>
              <Text style={[s.desc, { color: c.textSecondary }]}>{item.descripcion}</Text>
              <View style={s.tags}>
                <View style={[s.tag, { backgroundColor: prioridadColor[item.prioridad] || '#64748B' }]}><Text style={s.tagText}>{item.prioridad}</Text></View>
                <Text style={[s.meta, { color: c.textMuted }]}>{item.tipo} · {item.fecha_reporte?.slice(0, 10)}</Text>
              </View>
              <View style={s.costos}>
                <Text style={[s.meta, { color: c.textSecondary }]}>Costo estimado: ${Number(item.costo_estimado || 0).toLocaleString('es-CO')}</Text>
                <Text style={[s.meta, { color: c.success }]}>Costo real: ${Number(item.costo_real || 0).toLocaleString('es-CO')}</Text>
              </View>
              {item.fotografias && item.fotografias !== '[]' ? (
                <View style={s.fotos}>
                  {fotosDe(item).map((f, i) => <Image key={i} source={{ uri: fotoUrl(f) }} style={s.foto} resizeMode="cover" />)}
                </View>
              ) : null}
              <Text style={[s.link, { color: c.accent }]}>Cambiar estado →</Text>
            </TouchableOpacity>
          )}
        />
      )}
      <TouchableOpacity style={[s.fab, { backgroundColor: c.primary }]} onPress={() => navigation.navigate('NuevoMantenimiento')}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={!!editar} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: c.card }]}>
            <Text style={[s.modalTitle, { color: c.text }]}>Cambiar estado</Text>
            <Text style={[s.meta, { color: c.textSecondary }]}>{editar?.titulo}</Text>
            <View style={s.estadoGrid}>
              {ESTADOS.map(e => (
                <TouchableOpacity key={e} style={[s.estadoBtn, { backgroundColor: nuevoEstado === e ? c.primary : c.input, borderColor: c.border }]} onPress={() => setNuevoEstado(e)}>
                  <Text style={{ color: nuevoEstado === e ? '#fff' : c.textSecondary, fontSize: 12 }}>{ESTADO_LABEL[e] || e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[s.label, { color: c.textSecondary }]}>Costo estimado</Text>
            <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={String(editar?.costo_estimado || 0)} editable={false} />
            <Text style={[s.label, { color: c.textSecondary }]}>Costo real $</Text>
            <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={costo} onChangeText={setCosto} keyboardType="numeric" placeholder="0" placeholderTextColor={c.placeholder} />
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.btn, s.cancel, { borderColor: c.border }]} onPress={() => setEditar(null)}><Text style={{ color: c.textSecondary }}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={confirmarEstado} disabled={guardando}>
                {guardando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 12, marginBottom: 8 },
  filters: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 12, paddingBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, height: 32, justifyContent: 'center', alignItems: 'center' },
  chipText: { fontSize: 12, textTransform: 'capitalize' },
  card: { borderRadius: 12, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontWeight: '700', fontSize: 15 },
  meta: { fontSize: 11, marginTop: 3 },
  desc: { fontSize: 13, marginTop: 8 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  costos: { flexDirection: 'row', gap: 16, marginTop: 6 },
  tag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  empty: { textAlign: 'center', marginTop: 20 },
  link: { fontSize: 12, marginTop: 10, fontWeight: '600' },
  fotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  foto: { width: 100, height: 100, borderRadius: 8 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  estadoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  estadoBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  label: { fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  cancel: { borderWidth: 1 },
  btnText: { color: '#fff', fontWeight: '700' },
});
