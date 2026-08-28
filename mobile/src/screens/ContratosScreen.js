import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl, Modal, TextInput, Alert, Linking, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, BASE_URL } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';
import DateField from '../components/DateField';

const estadoColor = { activo: '#059669', pendiente: '#EA580C', vencido: '#DC2626', proximo_a_vencer: '#D97706', terminado: '#64748B', cancelado: '#64748B' };
const TIPO_LABEL = { contrato: 'Contrato', cedula: 'Cédula', certificado_laboral: 'Certificado laboral', fiador: 'Fiador', otro: 'Otro' };
const ESTADO_LABEL = { activo: 'Activo', pendiente: 'Pendiente', vencido: 'Vencido', proximo_a_vencer: 'Próximo a vencer', finalizado: 'Finalizado', terminado: 'Terminado', cancelado: 'Cancelado' };
const FILTROS = ['', 'activo', 'pendiente', 'vencido', 'proximo_a_vencer', 'terminado', 'cancelado'];

export default function ContratosScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const c = theme.colors;
  const esInquilino = user?.rol === 'inquilino';
  const [filtro, setFiltro] = useState('');
  const [data, setData] = useState([]);
  const [docsMap, setDocsMap] = useState({});
  const [loading, setLoading] = useState(true);
  // modal renovar
  const [renovar, setRenovar] = useState(null);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevoCanon, setNuevoCanon] = useState('');
  const [guardando, setGuardando] = useState(false);

  const load = useCallback(async (estado = '') => {
    setLoading(true);
    try {
      const contratos = await api.contratos(estado ? { estado } : {});
      setData(contratos);
      const map = {};
      await Promise.all(contratos.map(async (ct) => {
        try { map[ct.id] = await api.documentosContrato(ct.id); } catch { map[ct.id] = []; }
      }));
      setDocsMap(map);
    } catch { setData([]); }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(filtro); }, [load, filtro]));

  const abrirRenovar = (item) => {
    const fin = item.fecha_fin;
    let d;
    try { d = new Date(fin); d.setFullYear(d.getFullYear() + 1); } catch { d = new Date(); }
    setNuevaFecha(d.toISOString().slice(0, 10));
    setNuevoCanon(String(item.canon));
    setRenovar(item);
  };
  const confirmarRenovar = async () => {
    setGuardando(true);
    try { await api.actualizarContrato(renovar.id, { accion: 'renovar', nueva_fecha_fin: nuevaFecha, canon: Number(nuevoCanon) || 0 }); setRenovar(null); load(filtro); }
    catch (e) { console.log(e.message); } finally { setGuardando(false); }
  };
  const terminar = (item) => {
    Alert.alert('Terminar contrato', `¿Terminar el contrato de ${item.unidad_codigo} → ${item.inquilino_nombre}? La unidad quedará disponible.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Terminar', style: 'destructive', onPress: async () => { await api.actualizarContrato(item.id, { accion: 'terminar' }); load(filtro); } },
    ]);
  };
  const cancelar = (item) => {
    Alert.alert('Cancelar contrato', `¿Cancelar el contrato de ${item.unidad_codigo}?`, [
      { text: 'No', style: 'cancel' },
      { text: 'Sí, cancelar', style: 'destructive', onPress: async () => { await api.actualizarContrato(item.id, { accion: 'cancelar' }); load(filtro); } },
    ]);
  };

  if (loading) return <View style={[s.center, { backgroundColor: c.background }]}><ActivityIndicator color={c.accent} /></View>;
  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.header, { color: c.text }]}>Contratos</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtersScroll} contentContainerStyle={s.filters}>
        {FILTROS.map(e => (
          <TouchableOpacity key={e || 'todos'} onPress={() => { setFiltro(e); load(e); }} style={[s.chip, { backgroundColor: c.card, borderColor: c.border }, filtro === e && { backgroundColor: c.chipActive, borderColor: c.chipActive }]}>
            <Text style={[s.chipText, { color: filtro === e ? c.chipTextActive : c.textSecondary }]}>{e ? ESTADO_LABEL[e] || e : 'todos'}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FlatList
        data={data}
        keyExtractor={i => String(i.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(filtro)} tintColor={c.accent} />}
        contentContainerStyle={{ paddingBottom: 90 }}
        ListEmptyComponent={<Text style={[s.empty, { color: c.textMuted }]}>Sin contratos. Crea uno con el botón +</Text>}
        renderItem={({ item }) => (
          <View style={[s.card, { backgroundColor: c.card }]}>
            <View style={s.row}>
              <Text style={[s.title, { color: c.text }]}>{item.unidad_codigo} → {item.inquilino_nombre}</Text>
              <View style={[s.badge, { backgroundColor: estadoColor[item.estado] || '#64748B' }]}><Text style={s.badgeText}>{ESTADO_LABEL[item.estado] || item.estado}</Text></View>
            </View>
            <Text style={[s.meta, { color: c.textSecondary }]}>{item.fecha_inicio} → {item.fecha_fin} · Canon ${Number(item.canon).toLocaleString('es-CO')}</Text>
            {item.propiedad_nombre ? <Text style={[s.meta, { color: c.textSecondary }]}>Propiedad: {item.propiedad_nombre}</Text> : null}
            {item.propietario_nombre ? <Text style={[s.meta, { color: c.textSecondary }]}>Propietario: {item.propietario_nombre}</Text> : null}
            {item.documento ? (
              <TouchableOpacity onPress={() => Linking.openURL(`${BASE_URL}/static/uploads/contratos/${item.documento}`)}>
                <Text style={[s.docLink, { color: c.accent }]}>📄 Contrato (documento principal)</Text>
              </TouchableOpacity>
            ) : null}
            {(docsMap[item.id] || []).map(d => (
              <TouchableOpacity key={d.id} onPress={() => Linking.openURL(`${BASE_URL}/static/uploads/documentos/${d.ruta}`)}>
                <Text style={[s.docLink, { color: c.accent }]}>📄 {TIPO_LABEL[d.tipo] || d.tipo}: {d.nombre}</Text>
              </TouchableOpacity>
            ))}
            {!esInquilino && (item.estado === 'activo' || item.estado === 'proximo_a_vencer' || item.estado === 'vencido' ? (
              <View style={s.actions}>
                <TouchableOpacity style={[s.actBtn, { borderColor: c.accent }]} onPress={() => abrirRenovar(item)}>
                  <Ionicons name="refresh" size={15} color={c.accent} />
                  <Text style={{ color: c.accent, fontWeight: '600', fontSize: 13 }}>Renovar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actBtn, { borderColor: c.danger }]} onPress={() => terminar(item)}>
                  <Ionicons name="checkmark-done" size={15} color={c.danger} />
                  <Text style={{ color: c.danger, fontWeight: '600', fontSize: 13 }}>Terminar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actBtn, { borderColor: c.textMuted }]} onPress={() => cancelar(item)}>
                  <Ionicons name="close" size={15} color={c.textMuted} />
                  <Text style={{ color: c.textMuted, fontWeight: '600', fontSize: 13 }}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            ) : null)}
          </View>
        )}
      />
      {!esInquilino && (
        <TouchableOpacity style={[s.fab, { backgroundColor: c.primary }]} onPress={() => navigation.navigate('NuevoContrato')}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      <Modal visible={!!renovar} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: c.card }]}>
            <Text style={[s.modalTitle, { color: c.text }]}>Renovar contrato</Text>
            <Text style={[s.meta, { color: c.textSecondary }]}>{renovar?.unidad_codigo} → {renovar?.inquilino_nombre}</Text>
            <DateField label="Nueva fecha de finalización" value={nuevaFecha} onChange={setNuevaFecha} />
            <Text style={[s.label, { color: c.textSecondary }]}>Nuevo canon $</Text>
            <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={nuevoCanon} onChangeText={setNuevoCanon} keyboardType="numeric" placeholder="900000" placeholderTextColor={c.placeholder} />
            <Text style={[s.hint, { color: c.textMuted }]}>La unidad sigue ocupada y el contrato continúa activo.</Text>
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.btn, s.cancel, { borderColor: c.border }]} onPress={() => setRenovar(null)}><Text style={{ color: c.textSecondary }}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={confirmarRenovar} disabled={guardando}>
                {guardando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Renovar</Text>}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  docLink: { fontSize: 12, marginTop: 6, fontWeight: '600' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  empty: { textAlign: 'center', marginTop: 20 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  hint: { fontSize: 11, marginTop: 6 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  cancel: { borderWidth: 1 },
  btnText: { color: '#fff', fontWeight: '700' },
});
