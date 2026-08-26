import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl, Image, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, BASE_URL } from '../api/client';
import { useTheme } from '../theme/ThemeContext';

const estadoColor = { pendiente: '#EA580C', pagado: '#059669', vencido: '#DC2626', parcial: '#D97706' };
const ESTADO_LABEL = { pendiente: 'Espera', vencido: 'Mora', pagado: 'Pagado', parcial: 'Parcial' };
const FILTROS = ['', 'pendiente', 'vencido', 'pagado'];
const ESTADOS_MARK = ['pendiente', 'vencido', 'pagado', 'parcial'];

export default function ServiciosScreen({ navigation }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [filtro, setFiltro] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marcar, setMarcar] = useState(null); // recibo seleccionado para cambiar estado
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [guardando, setGuardando] = useState(false);

  const load = useCallback(async (estado = '') => {
    setLoading(true);
    try { setData(await api.recibos(estado ? { estado } : {})); } catch (e) { setData([]); }
    setLoading(false);
  }, []);
  useEffect(() => { load(''); }, [load]);

  const abrirMarcar = (r) => { setMarcar(r); setNuevoEstado(r.estado); };
  const confirmarEstado = async () => {
    setGuardando(true);
    try { await api.actualizarRecibo(marcar.id, { estado: nuevoEstado }); setMarcar(null); load(filtro); }
    catch (e) { console.log(e.message); } finally { setGuardando(false); }
  };

  const fmt = n => `$${Number(n).toLocaleString('es-CO')}`;

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.header, { color: c.text }]}>Recibos de servicios</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>Toca un recibo para marcar su estado</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
        {FILTROS.map(e => (
          <TouchableOpacity key={e || 'todos'} onPress={() => { setFiltro(e); load(e); }} style={[s.chip, { backgroundColor: c.card, borderColor: c.border }, filtro === e && { backgroundColor: c.chipActive, borderColor: c.chipActive }]}>
            <Text style={[s.chipText, { color: filtro === e ? c.chipTextActive : c.textSecondary }]}>{e ? ESTADO_LABEL[e] || e : 'todos'}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {loading ? <ActivityIndicator color={c.accent} style={{ marginTop: 20 }} /> : (
        <FlatList
          data={data}
          keyExtractor={i => String(i.id)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(filtro)} tintColor={c.accent} />}
          contentContainerStyle={{ paddingBottom: 90 }}
          ListEmptyComponent={<Text style={[s.empty, { color: c.textMuted }]}>Sin recibos en este filtro.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={[s.card, { backgroundColor: c.card }]} onPress={() => abrirMarcar(item)} activeOpacity={0.8}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.title, { color: c.text }]}>{item.servicio_nombre} · {item.propiedad_nombre}</Text>
                  <Text style={[s.meta, { color: c.textSecondary }]}>{item.periodo} · {item.empresa_prestadora || '—'} {item.numero_cuenta ? `· Cuenta ${item.numero_cuenta}` : ''}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: estadoColor[item.estado] || '#64748B' }]}><Text style={s.badgeText}>{ESTADO_LABEL[item.estado] || item.estado}</Text></View>
              </View>
              <Text style={[s.valor, { color: c.text }]}>{fmt(item.valor)}</Text>
              {item.recibo_adjunto ? (
                <Image source={{ uri: `${BASE_URL}/static/uploads/recibos/${item.recibo_adjunto}` }} style={s.foto} resizeMode="cover" />
              ) : null}
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
              <Text style={[s.link, { color: c.accent }]}>Cambiar estado →</Text>
            </TouchableOpacity>
          )}
        />
      )}
      <TouchableOpacity style={[s.fab, { backgroundColor: c.primary }]} onPress={() => navigation.navigate('NuevoRecibo')}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={!!marcar} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: c.card }]}>
            <Text style={[s.modalTitle, { color: c.text }]}>Marcar estado</Text>
            <Text style={[s.meta, { color: c.textSecondary }]}>{marcar?.servicio_nombre} · {marcar?.periodo} · {fmt(marcar?.valor || 0)}</Text>
            <View style={s.estadoGrid}>
              {ESTADOS_MARK.map(e => (
                <TouchableOpacity key={e} style={[s.estadoBtn, { backgroundColor: nuevoEstado === e ? c.primary : c.input, borderColor: c.border }]} onPress={() => setNuevoEstado(e)}>
                  <Text style={{ color: nuevoEstado === e ? '#fff' : c.textSecondary, fontSize: 13 }}>{ESTADO_LABEL[e] || e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.btn, s.cancel, { borderColor: c.border }]} onPress={() => setMarcar(null)}><Text style={{ color: c.textSecondary }}>Cancelar</Text></TouchableOpacity>
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
  empty: { textAlign: 'center', marginTop: 24 },
  card: { borderRadius: 12, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { fontWeight: '700', fontSize: 15 },
  meta: { fontSize: 11, marginTop: 2 },
  valor: { fontSize: 20, fontWeight: '800', marginTop: 8 },
  foto: { width: 100, height: 100, borderRadius: 8, marginTop: 8 },
  dist: { borderRadius: 8, padding: 10, marginTop: 10 },
  distTitle: { fontWeight: '700', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 },
  distItem: { fontSize: 12, lineHeight: 18 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  link: { fontSize: 12, marginTop: 8, fontWeight: '600' },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  estadoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  estadoBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  cancel: { borderWidth: 1 },
  btnText: { color: '#fff', fontWeight: '700' },
});
