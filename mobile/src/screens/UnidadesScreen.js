import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, TextInput, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import Picker from '../components/Picker';
import { useAuth } from '../auth/AuthContext';

const badgeColor = { disponible: '#059669', ocupada: '#DC2626', mantenimiento: '#EA580C', reservada: '#6B7280', inactiva: '#475569' };
const TIPOS = [
  { id: 'apartamento', nombre: 'Apartamento' }, { id: 'casa', nombre: 'Casa' },
  { id: 'local', nombre: 'Local' }, { id: 'habitacion', nombre: 'Habitación' },
  { id: 'parqueadero', nombre: 'Parqueadero' }, { id: 'bodega', nombre: 'Bodega' },
  { id: 'oficina', nombre: 'Oficina' }, { id: 'lote', nombre: 'Lote' }, { id: 'otro', nombre: 'Otro' },
];

export default function UnidadesScreen({ route }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const c = theme.colors;
  const esPropietario = user?.rol === 'propietario';
  const { propiedad_id, nombre } = route.params || {};
  const [data, setData] = useState([]);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [uniNombre, setUniNombre] = useState('');
  const [tipo, setTipo] = useState('apartamento');
  const [canon, setCanon] = useState('');
  const [area, setArea] = useState('');
  const [estado, setEstado] = useState('disponible');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api.unidades(propiedad_id ? { propiedad_id } : {})); } catch { setData([]); }
    if (esPropietario) { try { const me = await api.me(); setPlan(me.plan || null); } catch {} }
    setLoading(false);
  }, [propiedad_id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const abrirNueva = () => { setForm({}); setCodigo(''); setUniNombre(''); setTipo('apartamento'); setCanon(''); setArea(''); setEstado('disponible'); setError(''); };
  const abrirEditar = (u) => { setForm(u); setCodigo(u.codigo); setUniNombre(u.nombre || ''); setTipo(u.tipo); setCanon(String(u.canon_base || 0)); setArea(String(u.area_m2 || 0)); setEstado(u.estado); setError(''); };
  const guardar = async () => {
    setError('');
    if (!codigo) return setError('Código requerido');
    setGuardando(true);
    try {
      const payload = { codigo, nombre: uniNombre, tipo, canon_base: Number(canon) || 0, area_m2: Number(area) || 0, estado };
      if (form?.id) await api.actualizarUnidad(form.id, payload);
      else await api.crearUnidad({ ...payload, propiedad_id });
      setForm(null); load();
    } catch (e) { setError(e?.response?.data?.error || 'Error'); } finally { setGuardando(false); }
  };
  const eliminar = (u) => {
    Alert.alert('Eliminar unidad', `¿Eliminar "${u.codigo}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await api.eliminarUnidad(u.id); load(); } catch (e) { console.log(e.message); } } },
    ]);
  };

  const limite = plan ? `${data.length}/${plan.max_unidades} unidades` : '';

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <Text style={[s.header, { color: c.text }]}>{nombre || 'Unidades'}</Text>
      {esPropietario && plan ? <Text style={[s.sub, { color: c.textSecondary }]}>Plan: {plan.nombre} · {limite}</Text> : null}
      {loading ? <ActivityIndicator color={c.accent} /> : (
        <FlatList
          data={data}
          keyExtractor={i => String(i.id)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={c.accent} />}
          contentContainerStyle={{ paddingBottom: 90 }}
          ListEmptyComponent={<Text style={[s.empty, { color: c.textMuted }]}>Sin unidades. Crea una con el botón +</Text>}
          renderItem={({ item }) => (
            <View style={[s.card, { backgroundColor: c.card }]}>
              <View style={s.row}>
                <Text style={[s.title, { color: c.text }]}>{item.codigo} {item.nombre ? `- ${item.nombre}` : ''}</Text>
                <View style={[s.badge, { backgroundColor: badgeColor[item.estado] || '#64748B' }]}><Text style={s.badgeText}>{item.estado}</Text></View>
              </View>
              <Text style={[s.meta, { color: c.textSecondary }]}>Canon ${Number(item.canon_base).toLocaleString('es-CO')} · {item.tipo} · {item.area_m2}m²</Text>
              <View style={s.actions}>
                <TouchableOpacity style={[s.actBtn, { borderColor: c.textMuted }]} onPress={() => abrirEditar(item)}>
                  <Ionicons name="create" size={15} color={c.textMuted} /><Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actBtn, { borderColor: c.danger }]} onPress={() => eliminar(item)}>
                  <Ionicons name="trash" size={15} color={c.danger} /><Text style={{ color: c.danger, fontSize: 12, fontWeight: '600' }}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
      {esPropietario && (
        <TouchableOpacity style={[s.fab, { backgroundColor: c.primary }]} onPress={abrirNueva}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      <Modal visible={!!form} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: c.card }]}>
            <Text style={[s.modalTitle, { color: c.text }]}>{form?.id ? 'Editar unidad' : 'Nueva unidad'}</Text>
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: c.textSecondary }]}>Código</Text>
                <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="101" placeholderTextColor={c.placeholder} value={codigo} onChangeText={setCodigo} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: c.textSecondary }]}>Nombre</Text>
                <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Apto 101" placeholderTextColor={c.placeholder} value={uniNombre} onChangeText={setUniNombre} />
              </View>
            </View>
            <Picker label="Tipo" value={tipo} options={TIPOS} onSelect={setTipo} />
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: c.textSecondary }]}>Canon $</Text>
                <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="900000" placeholderTextColor={c.placeholder} value={canon} onChangeText={setCanon} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: c.textSecondary }]}>Área m²</Text>
                <TextInput style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="60" placeholderTextColor={c.placeholder} value={area} onChangeText={setArea} keyboardType="numeric" />
              </View>
            </View>
            <Text style={[s.label, { color: c.textSecondary }]}>Estado</Text>
            <Picker label="Estado" value={estado} options={[{ id: 'disponible', nombre: 'Disponible' }, { id: 'ocupada', nombre: 'Ocupada' }, { id: 'mantenimiento', nombre: 'Mantenimiento' }, { id: 'reservada', nombre: 'Reservada' }, { id: 'inactiva', nombre: 'Inactiva' }]} onSelect={setEstado} />
            {error ? <Text style={s.error}>{error}</Text> : null}
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.btn, s.cancel, { borderColor: c.border }]} onPress={() => setForm(null)}><Text style={{ color: c.textSecondary }}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={guardar} disabled={guardando}>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 12, marginBottom: 12 },
  card: { borderRadius: 12, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 4 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  empty: { textAlign: 'center', marginTop: 20 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 12 },
  row2: { flexDirection: 'row', gap: 10 },
  error: { color: '#DC2626', fontSize: 13, marginTop: 6, textAlign: 'center' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  cancel: { borderWidth: 1 },
  btnText: { color: '#fff', fontWeight: '700' },
});
