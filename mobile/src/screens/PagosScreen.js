import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, TextInput, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';

const colors = { pendiente: '#EA580C', pagado: '#059669', mora: '#DC2626', parcial: '#D97706', vencido: '#7C3AED' };
const METODOS = ['efectivo', 'transferencia', 'consignacion', 'pse', 'otro'];

export default function PagosScreen({ navigation }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [filtro, setFiltro] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  // modal registrar pago
  const [registrar, setRegistrar] = useState(null); // pago seleccionado
  const [metodo, setMetodo] = useState('efectivo');
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().slice(0, 10));
  const [montoPagado, setMontoPagado] = useState('');
  const [guardando, setGuardando] = useState(false);

  const load = useCallback(async (estado = filtro) => {
    setLoading(true);
    try { setData(await api.pagos(estado)); } catch { setData([]); }
    setLoading(false);
  }, [filtro]);
  useEffect(() => { load(''); }, [load]);

  const abrirRegistrar = (p) => { setRegistrar(p); setMetodo('efectivo'); setMontoPagado(String(p.monto)); };
  const confirmarPago = async () => {
    setGuardando(true);
    try {
      await api.registrarPago(registrar.id, { fecha_pago: fechaPago, metodo, monto_pagado: Number(montoPagado) || undefined });
      setRegistrar(null);
      load(filtro);
    } catch (e) {
      console.log(e.message);
    } finally { setGuardando(false); }
  };

  const fmt = n => `$${Number(n).toLocaleString('es-CO')}`;

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.header, { color: c.text }]}>Pagos</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>Pagos pertenecen a contrato · toca uno para registrarlo</Text>
      <View style={s.filters}>
        {['', 'pendiente', 'mora', 'pagado'].map(e => (
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
          ListEmptyComponent={<Text style={[s.empty, { color: c.textMuted }]}>Sin pagos en este filtro.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={[s.card, { backgroundColor: c.card }]} onPress={() => (item.estado === 'pendiente' || item.estado === 'mora') && abrirRegistrar(item)}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.title, { color: c.text }]}>{fmt(item.monto)} · {item.periodo || item.concepto}</Text>
                  <Text style={[s.meta, { color: c.textSecondary }]}>{item.unidad_codigo} · {item.inquilino_nombre}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: colors[item.estado] || '#64748B' }]}><Text style={s.badgeText}>{item.estado}</Text></View>
              </View>
              <Text style={[s.meta, { color: c.textSecondary }]}>Vence {item.fecha_vencimiento}{item.fecha_pago ? ` · Pagado ${item.fecha_pago}` : ''}</Text>
              {(item.estado === 'pendiente' || item.estado === 'mora') && <Text style={[s.registrar, { color: c.accent }]}>Toca para registrar pago →</Text>}
            </TouchableOpacity>
          )}
        />
      )}
      <TouchableOpacity style={[s.fab, { backgroundColor: c.primary }]} onPress={() => navigation.navigate('NuevoPago')}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={!!registrar} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: c.card }]}>
            <Text style={[s.modalTitle, { color: c.text }]}>Registrar pago</Text>
            <Text style={[s.meta, { color: c.textSecondary }]}>{fmt(registrar?.monto || 0)} · {registrar?.periodo} · vence {registrar?.fecha_vencimiento}</Text>
            <Text style={[s.label, { color: c.textSecondary }]}>Fecha de pago</Text>
            <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={fechaPago} onChangeText={setFechaPago} placeholder="2026-08-20" placeholderTextColor={c.placeholder} />
            <Text style={[s.label, { color: c.textSecondary }]}>Monto pagado (vacío = total)</Text>
            <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={montoPagado} onChangeText={setMontoPagado} keyboardType="numeric" placeholderTextColor={c.placeholder} />
            <Text style={[s.label, { color: c.textSecondary }]}>Método</Text>
            <View style={s.methods}>
              {METODOS.map(m => (
                <TouchableOpacity key={m} style={[s.chip, { backgroundColor: metodo === m ? c.primary : c.card, borderColor: c.border }]} onPress={() => setMetodo(m)}>
                  <Text style={{ color: metodo === m ? '#fff' : c.textSecondary, fontSize: 12 }}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.btn, s.cancel, { borderColor: c.border }]} onPress={() => setRegistrar(null)}><Text style={{ color: c.textSecondary }}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={confirmarPago} disabled={guardando}>
                {guardando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Confirmar</Text>}
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
  filters: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
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
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '600', marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  cancel: { borderWidth: 1 },
  btnText: { color: '#fff', fontWeight: '700' },
});
