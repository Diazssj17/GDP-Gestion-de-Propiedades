import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, TextInput, RefreshControl, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';

const colors = { pendiente: '#EA580C', pagado: '#059669', mora: '#DC2626', parcial: '#D97706', vencido: '#7C3AED' };
const METODOS = ['efectivo', 'transferencia', 'consignacion', 'pse', 'otro'];
const METODO_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia', consignacion: 'Consignación', pse: 'PSE', otro: 'Otro' };

export default function PagosScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const c = theme.colors;
  const esInquilino = user?.rol === 'inquilino';
  const [filtro, setFiltro] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  // modal detalle
  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  // modal abono
  const [registrar, setRegistrar] = useState(null);
  const [metodo, setMetodo] = useState('efectivo');
  const [montoAbono, setMontoAbono] = useState('');
  const [guardando, setGuardando] = useState(false);

  const load = useCallback(async (estado = '') => {
    setLoading(true);
    try { setData(await api.pagos(estado)); } catch { setData([]); }
    setLoading(false);
  }, []);
  useEffect(() => { load(''); }, [load]);

  const restanteDe = (p) => Math.max(0, Number(p.monto) - Number(p.pagado || 0));

  const verDetalle = async (p) => {
    setCargandoDetalle(true);
    setDetalle({ ...p, abonos: [] });
    try { setDetalle(await api.detallePago(p.id)); } catch (e) { console.log(e.message); }
    setCargandoDetalle(false);
  };
  const abrirAbonar = (p) => { setDetalle(null); setRegistrar(p); setMetodo('efectivo'); setMontoAbono(String(restanteDe(p))); };

  const abonar = async (monto) => {
    setGuardando(true);
    try {
      await api.registrarPago(registrar.id, { metodo, monto_abono: monto });
      setRegistrar(null);
      load(filtro);
    } catch (e) { console.log(e.message); } finally { setGuardando(false); }
  };

  const fmt = n => `$${Number(n).toLocaleString('es-CO')}`;
  const esAbonable = (p) => p.estado === 'pendiente' || p.estado === 'mora' || p.estado === 'parcial';

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.header, { color: c.text }]}>Pagos</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>Toca un pago para ver el detalle</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtersScroll} contentContainerStyle={s.filters}>
        {['', 'pendiente', 'mora', 'parcial', 'pagado'].map(e => (
          <TouchableOpacity key={e || 'todos'} onPress={() => { setFiltro(e); load(e); }} style={[s.chip, { backgroundColor: c.card, borderColor: c.border }, filtro === e && { backgroundColor: c.chipActive, borderColor: c.chipActive }]}>
            <Text style={[s.chipText, { color: filtro === e ? c.chipTextActive : c.textSecondary }]}>{e || 'todos'}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {loading ? <ActivityIndicator color={c.accent} /> : (
        <FlatList
          data={data}
          keyExtractor={i => String(i.id)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(filtro)} tintColor={c.accent} />}
          contentContainerStyle={{ paddingBottom: 90 }}
          ListEmptyComponent={<Text style={[s.empty, { color: c.textMuted }]}>Sin pagos en este filtro.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={[s.card, { backgroundColor: c.card }]} onPress={() => verDetalle(item)} activeOpacity={0.8}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.title, { color: c.text }]}>{fmt(item.monto)} · {item.periodo || item.concepto}</Text>
                  <Text style={[s.meta, { color: c.textSecondary }]}>{item.unidad_codigo} · {item.inquilino_nombre}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: colors[item.estado] || '#64748B' }]}><Text style={s.badgeText}>{item.estado}</Text></View>
              </View>
              {Number(item.pagado) > 0 ? <Text style={[s.meta, { color: c.success }]}>Abonado {fmt(item.pagado)} de {fmt(item.monto)}</Text> : null}
              <Text style={[s.meta, { color: c.textSecondary }]}>Vence {item.fecha_vencimiento}{item.fecha_pago ? ` · Último abono ${item.fecha_pago}` : ''}</Text>
              {item.metodo ? <Text style={[s.meta, { color: c.info, fontWeight: '600' }]}>Método: {METODO_LABEL[item.metodo] || item.metodo}</Text> : null}
              <Text style={[s.registrar, { color: c.accent }]}>Ver detalle →</Text>
            </TouchableOpacity>
          )}
        />
      )}
      <TouchableOpacity style={[s.fab, { backgroundColor: c.primary }]} onPress={() => navigation.navigate('NuevoPago')}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal detalle */}
      <Modal visible={!!detalle} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: c.card }]}>
            <ScrollView>
              <View style={s.detalleHead}>
                <Text style={[s.modalTitle, { color: c.text }]}>{detalle?.periodo || detalle?.concepto}</Text>
                <View style={[s.badge, { backgroundColor: colors[detalle?.estado] || '#64748B' }]}><Text style={s.badgeText}>{detalle?.estado}</Text></View>
              </View>
              <View style={[s.resumen, { backgroundColor: theme.dark ? '#12243B' : '#EFF6FF' }]}>
                <Text style={[s.meta, { color: c.textSecondary }]}>Total: {fmt(detalle?.monto || 0)}</Text>
                <Text style={[s.meta, { color: c.textSecondary }]}>Abonado: {fmt(detalle?.pagado || 0)}</Text>
                <Text style={[s.restante, { color: c.danger }]}>Restante: {fmt(restanteDe(detalle || {}))}</Text>
              </View>
              <View style={s.detalleRow}><Text style={[s.detalleLabel, { color: c.textSecondary }]}>Inquilino</Text><Text style={[s.detalleVal, { color: c.text }]}>{detalle?.inquilino_nombre}{detalle?.inquilino_documento ? ` · ${detalle.inquilino_documento}` : ''}</Text></View>
              <View style={s.detalleRow}><Text style={[s.detalleLabel, { color: c.textSecondary }]}>Unidad</Text><Text style={[s.detalleVal, { color: c.text }]}>{detalle?.unidad_codigo}{detalle?.unidad_nombre ? ` - ${detalle.unidad_nombre}` : ''}</Text></View>
              <View style={s.detalleRow}><Text style={[s.detalleLabel, { color: c.textSecondary }]}>Vencimiento</Text><Text style={[s.detalleVal, { color: c.text }]}>{detalle?.fecha_vencimiento}</Text></View>
              <View style={s.detalleRow}><Text style={[s.detalleLabel, { color: c.textSecondary }]}>Método</Text><Text style={[s.detalleVal, { color: c.text }]}>{detalle?.metodo ? METODO_LABEL[detalle.metodo] || detalle.metodo : '—'}</Text></View>
              <View style={s.detalleRow}><Text style={[s.detalleLabel, { color: c.textSecondary }]}>Último pago</Text><Text style={[s.detalleVal, { color: c.text }]}>{detalle?.fecha_pago || '—'}</Text></View>

              <Text style={[s.abonosTitle, { color: c.text }]}>Historial de abonos</Text>
              {cargandoDetalle ? <ActivityIndicator color={c.accent} style={{ marginTop: 8 }} /> : (
                detalle?.abonos?.length ? detalle.abonos.map(a => (
                  <View key={a.id} style={[s.abono, { borderBottomColor: c.border }]}>
                    <Text style={[s.abonoMonto, { color: c.text }]}>{fmt(a.monto)}</Text>
                    <Text style={[s.meta, { color: c.textSecondary }]}>{a.fecha} · {METODO_LABEL[a.metodo] || a.metodo || '—'}</Text>
                  </View>
                )) : <Text style={[s.empty, { color: c.textMuted }]}>Sin abonos registrados.</Text>
              )}

              <View style={s.modalBtns}>
                <TouchableOpacity style={[s.btn, s.cancel, { borderColor: c.border }]} onPress={() => setDetalle(null)}><Text style={{ color: c.textSecondary }}>Cerrar</Text></TouchableOpacity>
                {!esInquilino && detalle && esAbonable(detalle) ? (
                  <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={() => abrirAbonar(detalle)}><Text style={s.btnText}>Abonar</Text></TouchableOpacity>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal abono */}
      <Modal visible={!!registrar} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: c.card }]}>
            <Text style={[s.modalTitle, { color: c.text }]}>Registrar abono</Text>
            <Text style={[s.meta, { color: c.textSecondary }]}>{registrar?.periodo || registrar?.concepto} · vence {registrar?.fecha_vencimiento}</Text>
            <View style={[s.resumen, { backgroundColor: theme.dark ? '#12243B' : '#EFF6FF' }]}>
              <Text style={[s.meta, { color: c.textSecondary }]}>Total: {fmt(registrar?.monto || 0)}</Text>
              <Text style={[s.meta, { color: c.textSecondary }]}>Abonado: {fmt(registrar?.pagado || 0)}</Text>
              <Text style={[s.restante, { color: c.danger }]}>Restante: {fmt(restanteDe(registrar || {}))}</Text>
            </View>
            <Text style={[s.label, { color: c.textSecondary }]}>Método</Text>
            <View style={s.methods}>
              {METODOS.map(m => (
                <TouchableOpacity key={m} style={[s.chip, { backgroundColor: metodo === m ? c.primary : c.card, borderColor: c.border }]} onPress={() => setMetodo(m)}>
                  <Text style={{ color: metodo === m ? '#fff' : c.textSecondary, fontSize: 12 }}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[s.label, { color: c.textSecondary }]}>Monto a abonar</Text>
            <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={montoAbono} onChangeText={setMontoAbono} keyboardType="numeric" placeholder="0" placeholderTextColor={c.placeholder} />
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.btn, s.cancel, { borderColor: c.border }]} onPress={() => setRegistrar(null)}><Text style={{ color: c.textSecondary }}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.parcialBtn, { borderColor: c.warning }]} onPress={() => abonar(Number(montoAbono) || 0)} disabled={guardando}>
                <Text style={{ color: c.warning, fontWeight: '700' }}>Abonar parcial</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={() => abonar(restanteDe(registrar))} disabled={guardando}>
                {guardando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Abonar total</Text>}
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
  filtersScroll: { flexGrow: 0, marginBottom: 12 },
  filters: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, height: 32, justifyContent: 'center', alignItems: 'center' },
  chipText: { fontSize: 12, textTransform: 'capitalize' },
  card: { borderRadius: 12, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 4 },
  registrar: { fontSize: 12, marginTop: 6, fontWeight: '600' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  empty: { textAlign: 'center', marginTop: 20 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  detalleHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resumen: { borderRadius: 10, padding: 12, marginTop: 12 },
  restante: { fontSize: 14, fontWeight: '800', marginTop: 4 },
  detalleRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  detalleLabel: { fontSize: 12, fontWeight: '600' },
  detalleVal: { fontSize: 13, fontWeight: '600' },
  abonosTitle: { fontSize: 14, fontWeight: '800', marginTop: 16, marginBottom: 4 },
  abono: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  abonoMonto: { fontSize: 13, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '600', marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalBtns: { flexDirection: 'row', gap: 8, marginTop: 20 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  cancel: { borderWidth: 1 },
  parcialBtn: { borderWidth: 1 },
  btnText: { color: '#fff', fontWeight: '700' },
});
